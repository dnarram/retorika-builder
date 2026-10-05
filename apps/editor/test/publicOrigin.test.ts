import { afterEach, describe, expect, it } from "vitest";
import { ORIGIN_VAR, publicOrigin } from "../src/auth/publicOrigin.ts";

/**
 * Where this application is reachable from, as seen from inside a request — the fix for the
 * localhost redirect David found on the real deployment on 5 October 2026.
 */

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

describe("with nothing configured and no proxy in front — local development", () => {
  it("falls back to the request's own origin", () => {
    expect(publicOrigin(request("http://localhost:3000/auth/callback?code=abc"))).toBe(
      "http://localhost:3000",
    );
  });
});

describe("behind Render's proxy — the bug David found", () => {
  it("uses x-forwarded-host and x-forwarded-proto rather than the internal bind address", () => {
    // Exactly what Render hands the process: the request line names the internal port, and the
    // forwarded headers name what the browser actually connected to.
    const seenByRender = request("http://localhost:10000/auth/callback?code=abc", {
      "x-forwarded-host": "retorika-builder.onrender.com",
      "x-forwarded-proto": "https",
    });
    expect(publicOrigin(seenByRender)).toBe("https://retorika-builder.onrender.com");
  });

  it("takes the first entry when a chain of proxies repeated the header", () => {
    const chained = request("http://localhost:10000/x", {
      "x-forwarded-host": "retorika-builder.onrender.com, internal-lb.render.internal",
      "x-forwarded-proto": "https, http",
    });
    expect(publicOrigin(chained)).toBe("https://retorika-builder.onrender.com");
  });

  it("falls back to request.url when only one of the two headers is present", () => {
    // Half a signal is not a signal. Guessing a protocol or a host from nothing would be the
    // silent fallback the project's own style guide refuses.
    const hostOnly = request("http://localhost:10000/x", {
      "x-forwarded-host": "retorika-builder.onrender.com",
    });
    expect(publicOrigin(hostOnly)).toBe("http://localhost:10000");

    const protoOnly = request("http://localhost:10000/x", { "x-forwarded-proto": "https" });
    expect(publicOrigin(protoOnly)).toBe("http://localhost:10000");
  });

  it("falls back to request.url when the forwarded host does not parse into an origin", () => {
    const malformed = request("http://localhost:10000/x", {
      "x-forwarded-host": "not a host at all",
      "x-forwarded-proto": "https",
    });
    expect(publicOrigin(malformed)).toBe("http://localhost:10000");
  });
});

describe(`${ORIGIN_VAR}, the explicit and deterministic source`, () => {
  it("wins over the forwarded headers when both are present", () => {
    process.env[ORIGIN_VAR] = "https://retorika-builder.onrender.com";
    const withConflictingHeaders = request("http://localhost:10000/x", {
      "x-forwarded-host": "something-else.onrender.com",
      "x-forwarded-proto": "https",
    });
    expect(publicOrigin(withConflictingHeaders)).toBe("https://retorika-builder.onrender.com");
  });

  it("wins over request.url when there are no headers at all", () => {
    process.env[ORIGIN_VAR] = "https://retorika-builder.onrender.com";
    expect(publicOrigin(request("http://localhost:10000/x"))).toBe(
      "https://retorika-builder.onrender.com",
    );
  });

  it("strips a trailing slash down to a bare origin", () => {
    process.env[ORIGIN_VAR] = "https://retorika-builder.onrender.com/";
    expect(publicOrigin(request("http://localhost:10000/x"))).toBe(
      "https://retorika-builder.onrender.com",
    );
  });

  it("throws rather than silently redirecting somewhere wrong when it carries a path", () => {
    // "validada como origen https:// sin ruta" — a path here is a deploy mistake, and the
    // honest failure is loud, not a 303 to a URL nobody meant.
    process.env[ORIGIN_VAR] = "https://retorika-builder.onrender.com/auth/callback";
    expect(() => publicOrigin(request("http://localhost:10000/x"))).toThrow(new RegExp(ORIGIN_VAR));
  });

  it("throws on a query string or a fragment, which are just as much 'more than an origin'", () => {
    process.env[ORIGIN_VAR] = "https://retorika-builder.onrender.com?x=1";
    expect(() => publicOrigin(request("http://localhost:10000/x"))).toThrow();
  });

  it("throws on http, because a deliberately configured value is held to the stricter rule", () => {
    // The forwarded-header path allows http for infrastructure's own report; a hand-typed
    // APP_ORIGIN is a deploy decision and is not given that same latitude.
    process.env[ORIGIN_VAR] = "http://retorika-builder.onrender.com";
    expect(() => publicOrigin(request("http://localhost:10000/x"))).toThrow();
  });

  it("throws on a value that is not a URL at all", () => {
    process.env[ORIGIN_VAR] = "not a url";
    expect(() => publicOrigin(request("http://localhost:10000/x"))).toThrow();
  });
});
