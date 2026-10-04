import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The OAuth callback, and the one thing it must never become.
 *
 * A callback that redirects wherever its query string says is an open redirector: a link on our
 * own domain that lands somebody on somebody else's page, which is what makes a phishing mail
 * convincing. So `next` is accepted only as a path on this origin, and that is asserted here
 * rather than left to review.
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

async function get(url: string): Promise<Response> {
  const { GET } = await import("../src/app/auth/callback/route.ts");
  return GET(new Request(url));
}

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
