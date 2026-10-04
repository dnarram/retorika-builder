import { afterEach, describe, expect, it, vi } from "vitest";
import type { Client } from "../src/auth/clients.ts";
import { serviceRoleKey } from "../src/auth/env.server.ts";
import {
  authConfigured,
  PUBLIC_ANON_KEY_VAR,
  PUBLIC_URL_VAR,
  publicConfig,
} from "../src/auth/env.ts";
import {
  googleSignInOptions,
  requestPasswordReset,
  setNewPassword,
  signInWithPassword,
  startGoogleSignIn,
} from "../src/auth/operations.ts";
import { viewerFrom } from "../src/auth/session.ts";

/**
 * What can be verified about signing in on a machine with no Supabase project.
 *
 * Which is more than it sounds: every rule ADR 0034 fixed about *how* we talk to Supabase is a
 * property of the call we make, not of the answer we get back. The one thing these cannot prove
 * is that Google's consent screen works end to end, and ADR 0034 §4 says so — David verifies that
 * on the real deployment, because it needs his credentials.
 */

/** Just enough of a Supabase client to answer the one method under test. */
function stub(auth: Record<string, unknown>): Client {
  return { auth } as unknown as Client;
}

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  vi.unstubAllGlobals();
});

describe("the Google options ADR 0034 §4 fixes", () => {
  it("asks for no offline access, so Google sends no refresh token to mishandle", () => {
    const options = googleSignInOptions("https://example.test/auth/callback");
    // The whole point: Google expires an unverified app's refresh tokens after 7 days, and that
    // cannot sign anybody out of Retorika as long as we never hold one. Supabase issues its own.
    expect(JSON.stringify(options)).not.toContain("offline");
    expect(JSON.stringify(options)).not.toContain("access_type");
    expect(JSON.stringify(options)).not.toContain("prompt");
  });

  it("names Google and carries the redirect, and nothing else", () => {
    expect(googleSignInOptions("https://example.test/auth/callback")).toEqual({
      provider: "google",
      options: { redirectTo: "https://example.test/auth/callback" },
    });
  });

  it("hands back the URL to send the browser to", async () => {
    const client = stub({
      signInWithOAuth: () =>
        Promise.resolve({ data: { url: "https://accounts.google.test/x" }, error: null }),
    });
    expect(await startGoogleSignIn(client, "https://example.test/cb")).toEqual({
      url: "https://accounts.google.test/x",
    });
  });

  it("reports a failure instead of returning a half-built redirect", async () => {
    const client = stub({
      signInWithOAuth: () => Promise.resolve({ data: { url: null }, error: null }),
    });
    expect(await startGoogleSignIn(client, "https://example.test/cb")).toEqual({
      ok: false,
      reason: "unknown",
    });
  });
});

describe("signing in with a password", () => {
  it("succeeds quietly", async () => {
    const client = stub({ signInWithPassword: () => Promise.resolve({ error: null }) });
    expect(await signInWithPassword(client, "a@b.test", "secreto")).toEqual({ ok: true });
  });

  it("turns a wrong password into a reason, not a stack trace", async () => {
    const client = stub({
      signInWithPassword: () =>
        Promise.resolve({
          error: { message: "Invalid login credentials", code: "invalid_credentials" },
        }),
    });
    expect(await signInWithPassword(client, "a@b.test", "nope")).toEqual({
      ok: false,
      reason: "invalid_credentials",
    });
  });

  it("recognises being rate limited, which the free plan's mail makes likely", async () => {
    const client = stub({
      signInWithPassword: () =>
        Promise.resolve({ error: { message: "too many", code: "over_request_rate_limit" } }),
    });
    expect(await signInWithPassword(client, "a@b.test", "x")).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it("never passes the provider's own English through", async () => {
    const client = stub({
      signInWithPassword: () =>
        Promise.resolve({ error: { message: "Something went terribly wrong", code: "weird" } }),
    });
    const outcome = await signInWithPassword(client, "a@b.test", "x");
    expect(JSON.stringify(outcome)).not.toContain("terribly");
  });
});

describe("the reset mail", () => {
  it("answers the same whether or not the address has an account", async () => {
    // Anything but a rate limit is reported as success, because «no existe esa cuenta» would turn
    // the form into a way of finding out who has an account here.
    const missing = stub({
      resetPasswordForEmail: () =>
        Promise.resolve({ error: { message: "User not found", code: "user_not_found" } }),
    });
    const present = stub({ resetPasswordForEmail: () => Promise.resolve({ error: null }) });
    expect(await requestPasswordReset(missing, "nobody@b.test", "/x")).toEqual({ ok: true });
    expect(await requestPasswordReset(present, "a@b.test", "/x")).toEqual({ ok: true });
  });

  it("does say when the send limit was hit, because that one is actionable", async () => {
    const limited = stub({
      resetPasswordForEmail: () =>
        Promise.resolve({ error: { message: "limit", code: "over_email_send_rate_limit" } }),
    });
    expect(await requestPasswordReset(limited, "a@b.test", "/x")).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it("reports a password the provider refuses as too weak", async () => {
    const client = stub({
      updateUser: () => Promise.resolve({ error: { message: "too short", code: "weak_password" } }),
    });
    expect(await setNewPassword(client, "abc")).toEqual({ ok: false, reason: "weak_password" });
  });
});

describe("who is asking", () => {
  it("verifies the token with getUser rather than believing the cookie", async () => {
    const getUser = vi.fn(() =>
      Promise.resolve({ data: { user: { id: "u1", email: "a@b.test" } }, error: null }),
    );
    // getSession would read the cookie and trust it. A cookie is something a browser can edit.
    const getSession = vi.fn();
    expect(await viewerFrom(stub({ getUser, getSession }))).toEqual({
      id: "u1",
      email: "a@b.test",
    });
    expect(getUser).toHaveBeenCalledOnce();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("is nobody when there is no session, which is this app's ordinary state", async () => {
    const client = stub({ getUser: () => Promise.resolve({ data: { user: null }, error: null }) });
    expect(await viewerFrom(client)).toBeNull();
  });
});

describe("the environment boundary of Part 15", () => {
  it("names the missing variable instead of failing vaguely", () => {
    delete process.env[PUBLIC_URL_VAR];
    delete process.env[PUBLIC_ANON_KEY_VAR];
    expect(() => publicConfig()).toThrow(new RegExp(PUBLIC_URL_VAR));
  });

  it("reports honestly whether signing in can work at all", () => {
    delete process.env[PUBLIC_URL_VAR];
    expect(authConfigured()).toBe(false);
    process.env[PUBLIC_URL_VAR] = "https://x.supabase.co";
    process.env[PUBLIC_ANON_KEY_VAR] = "anon";
    expect(authConfigured()).toBe(true);
  });

  it("refuses to hand over the service key if it is ever read in a browser", () => {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-key-value";
    vi.stubGlobal("window", {});
    expect(() => serviceRoleKey()).toThrow(/Part 15/);
  });

  it("never puts the service key's value in the error that refuses it", () => {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-key-value";
    vi.stubGlobal("window", {});
    try {
      serviceRoleKey();
      expect.unreachable("it should have thrown");
    } catch (error) {
      expect(String(error)).not.toContain("service-key-value");
    }
  });
});
