import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The OAuth callback, and the two things it must never do.
 *
 * A callback that redirects wherever its query string says is an open redirector: a link on our
 * own domain that lands somebody on somebody else's page, which is what makes a phishing mail
 * convincing. So `next` is accepted only as a path on this origin, and that is asserted here
 * rather than left to review.
 *
 * **The second is the bug David found on the real deployment, 5 October 2026**: a redirect built
 * from `request.url` lands on Render's internal bind address, never the public one. The "behind
 * Render's proxy" describe block below reconstructs exactly what Render hands the process — the
 * request line naming the internal port, `x-forwarded-host`/`x-forwarded-proto` naming what the
 * browser actually connected to — and asserts the redirect lands on the public domain. See
 * `apps/editor/src/auth/publicOrigin.ts` and `test/publicOrigin.test.ts` for that function on its
 * own; what belongs here is that the route actually uses it, end to end, for every branch.
 */

const exchangeCodeForSession = vi.fn();

vi.mock("../src/auth/clients.server.ts", () => ({
  serverClient: () => Promise.resolve({ auth: { exchangeCodeForSession } }),
}));

const original = { ...process.env };
beforeEach(() => {
  process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://project.supabase.co";
  process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "anon";
  exchangeCodeForSession.mockReset();
  exchangeCodeForSession.mockResolvedValue({ error: null });
});
afterEach(() => {
  process.env = { ...original };
});

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const { GET } = await import("../src/app/auth/callback/route.ts");
  return GET(new Request(url, { headers }));
}

/** The internal address Render's own proxy hands the Node process — never the public one. */
const RENDER_INTERNAL_URL = "http://localhost:10000/auth/callback";
/** What Render reports the original request actually was, in the two headers it forwards. */
const RENDER_FORWARDED_HEADERS = {
  "x-forwarded-host": "retorika-builder.onrender.com",
  "x-forwarded-proto": "https",
};
const PUBLIC_ORIGIN = "https://retorika-builder.onrender.com";

describe("where the callback sends people", () => {
  it("lands on the path it was given", async () => {
    const response = await get("https://app.test/auth/callback?code=abc&next=/mis-webs");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://app.test/mis-webs");
  });

  it("refuses an absolute URL and goes home instead", async () => {
    const response = await get(
      "https://app.test/auth/callback?code=abc&next=https://phishing.test/login",
    );
    expect(response.headers.get("location")).toBe("https://app.test/");
  });

  it("refuses a protocol-relative URL, which is the one that looks like a path", async () => {
    // `//phishing.test` has no scheme, so it reads like a path and is not one — the browser
    // treats it as a host. This is the case a `startsWith("/")` check alone would wave through.
    const response = await get("https://app.test/auth/callback?code=abc&next=//phishing.test");
    expect(response.headers.get("location")).toBe("https://app.test/");
  });

  it("stays on our origin even when the path is strange", async () => {
    const response = await get("https://app.test/auth/callback?code=abc&next=/../../etc");
    expect(new URL(response.headers.get("location") ?? "").origin).toBe("https://app.test");
  });
});

describe("when the exchange does not happen", () => {
  it("sends a cancelled consent screen back to sign in", async () => {
    const response = await get("https://app.test/auth/callback");
    expect(response.headers.get("location")).toBe("https://app.test/entrar?error=unknown");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("names an expired code as expired, because that one tells somebody what to do", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: "expired", code: "otp_expired" },
    });
    const response = await get("https://app.test/auth/callback?code=stale");
    expect(response.headers.get("location")).toBe("https://app.test/entrar?error=expired_link");
  });

  it("does not try to exchange anything when there is no project configured", async () => {
    delete process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const response = await get("https://app.test/auth/callback?code=abc");
    expect(response.headers.get("location")).toBe("https://app.test/entrar?error=unknown");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe("behind Render's proxy — the real deployment, 5 October 2026", () => {
  it("lands the success redirect on the public domain, not the internal bind address", async () => {
    const response = await get(
      `${RENDER_INTERNAL_URL}?code=abc&next=/mis-webs`,
      RENDER_FORWARDED_HEADERS,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${PUBLIC_ORIGIN}/mis-webs`);
  });

  it("sends a cancelled consent screen to the public domain", async () => {
    const response = await get(RENDER_INTERNAL_URL, RENDER_FORWARDED_HEADERS);
    expect(response.headers.get("location")).toBe(`${PUBLIC_ORIGIN}/entrar?error=unknown`);
  });

  it("sends an expired-code failure to the public domain", async () => {
    exchangeCodeForSession.mockResolvedValue({
      error: { message: "expired", code: "otp_expired" },
    });
    const response = await get(`${RENDER_INTERNAL_URL}?code=stale`, RENDER_FORWARDED_HEADERS);
    expect(response.headers.get("location")).toBe(`${PUBLIC_ORIGIN}/entrar?error=expired_link`);
  });

  it("refuses an open redirect even once the host is the real one", async () => {
    // The two defences are independent, and this is the test that proves it: fixing the host
    // must not loosen the `next`-path guard.
    const response = await get(
      `${RENDER_INTERNAL_URL}?code=abc&next=https://phishing.test/login`,
      RENDER_FORWARDED_HEADERS,
    );
    expect(response.headers.get("location")).toBe(`${PUBLIC_ORIGIN}/`);
  });

  it("never falls back to the internal address, even with no project configured", async () => {
    delete process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const response = await get(RENDER_INTERNAL_URL, RENDER_FORWARDED_HEADERS);
    expect(response.headers.get("location")).toBe(`${PUBLIC_ORIGIN}/entrar?error=unknown`);
  });
});

describe("APP_ORIGIN, once David sets it", () => {
  // No local backup/restore here: the module-level `afterEach` above already resets
  // `process.env` after every test, including these.

  it("is used even with no forwarded headers at all", async () => {
    process.env["APP_ORIGIN"] = PUBLIC_ORIGIN;
    const response = await get(`${RENDER_INTERNAL_URL}?code=abc`);
    expect(response.headers.get("location")).toBe(`${PUBLIC_ORIGIN}/`);
  });

  it("wins over a forwarded header that disagrees with it", async () => {
    process.env["APP_ORIGIN"] = PUBLIC_ORIGIN;
    const response = await get(`${RENDER_INTERNAL_URL}?code=abc`, {
      "x-forwarded-host": "some-other-service.onrender.com",
      "x-forwarded-proto": "https",
    });
    expect(response.headers.get("location")).toBe(`${PUBLIC_ORIGIN}/`);
  });

  it("fails loudly on a misconfigured value instead of redirecting somewhere wrong", async () => {
    process.env["APP_ORIGIN"] = `${PUBLIC_ORIGIN}/auth/callback`;
    await expect(get(`${RENDER_INTERNAL_URL}?code=abc`)).rejects.toThrow(/APP_ORIGIN/);
  });
});
