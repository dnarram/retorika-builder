import { fontDataFor } from "@retorika/publisher";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as download } from "../src/app/api/download/route.ts";
import { POST as inspect } from "../src/app/api/fuentes/inspeccionar/route.ts";
import {
  clientAddress,
  createRateLimiter,
  isSameOrigin,
  PUBLIC_BYTES_LIMIT,
} from "../src/app/api/publicGuard.ts";
import { MAX_FONT_BYTES } from "../src/editor/fontBytes.ts";

/**
 * The guard in front of the two public routes that work on a stranger's bytes (sprint 29 día 5),
 * and the inspection route behind it. David's three conditions, 27 October 2026: same origin with
 * a fallback, one limit shared by both routes, and a CPU budget measured — the last in ADR 0056.
 */

const ORIGIN = "http://localhost";
const KARLA = fontDataFor("karla-latin-400-normal.woff2") as Uint8Array;

function post(
  path: string,
  body: Uint8Array | FormData | null,
  headers: Record<string, string> = {},
): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    ...(body === null ? {} : { body: body instanceof FormData ? body : Uint8Array.from(body) }),
    headers,
  });
}

/** What a browser on our page sends with a file of these bytes. */
function fromOurPage(bytes: Uint8Array, extra: Record<string, string> = {}): Request {
  return post("/api/fuentes/inspeccionar", bytes, {
    "sec-fetch-site": "same-origin",
    "content-length": String(bytes.byteLength),
    "x-forwarded-for": "203.0.113.7",
    ...extra,
  });
}

beforeEach(() => PUBLIC_BYTES_LIMIT.reset());
afterEach(() => {
  delete process.env["APP_ORIGIN"];
});

describe("isSameOrigin — condition 1, the three variants", () => {
  it("decides by Sec-Fetch-Site alone when the browser sends it", () => {
    expect(isSameOrigin(post("/x", null, { "sec-fetch-site": "same-origin" }))).toBe(true);
    // `same-site` is a sibling subdomain — somebody else's page — and it does not pass, nor does
    // a matching Origin rescue a header that said otherwise.
    for (const site of ["same-site", "cross-site", "none"]) {
      expect(isSameOrigin(post("/x", null, { "sec-fetch-site": site, origin: ORIGIN }))).toBe(
        false,
      );
    }
  });

  it("falls back to Origin against the public origin when there is no Sec-Fetch-Site (Safari < 16.4)", () => {
    expect(isSameOrigin(post("/x", null, { origin: ORIGIN }))).toBe(true);
    expect(isSameOrigin(post("/x", null, { origin: "https://evil.example" }))).toBe(false);
    // Behind Render's proxy the request's own URL is the internal bind address; the public origin
    // is what the browser's Origin must match.
    process.env["APP_ORIGIN"] = "https://retorika-builder.onrender.com";
    expect(
      isSameOrigin(post("/x", null, { origin: "https://retorika-builder.onrender.com" })),
    ).toBe(true);
    expect(isSameOrigin(post("/x", null, { origin: ORIGIN }))).toBe(false);
  });

  it("refuses a request with neither header", () => {
    expect(isSameOrigin(post("/x", null))).toBe(false);
  });
});

describe("clientAddress", () => {
  it("reads Cloudflare's header before the one a client can prepend to", () => {
    const request = post("/x", null, {
      "x-forwarded-for": "198.51.100.1, 203.0.113.9",
      "true-client-ip": "203.0.113.8",
      "cf-connecting-ip": "203.0.113.9",
    });
    expect(clientAddress(request)).toBe("203.0.113.9");
    expect(clientAddress(post("/x", null, { "true-client-ip": "203.0.113.8" }))).toBe(
      "203.0.113.8",
    );
    expect(clientAddress(post("/x", null, { "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe(
      "198.51.100.1",
    );
    expect(clientAddress(post("/x", null))).toBe("unknown");
  });
});

describe("createRateLimiter", () => {
  it("allows twenty in a burst, refuses the twenty-first with Retry-After, and refills", () => {
    const limiter = createRateLimiter({ capacity: 20, windowMs: 60_000 });
    for (let index = 0; index < 20; index += 1) expect(limiter.take("a", 0).ok).toBe(true);
    expect(limiter.take("a", 0)).toEqual({ ok: false, retryAfterSeconds: 3 });
    // Another address has its own bucket.
    expect(limiter.take("b", 0).ok).toBe(true);
    // One token every three seconds.
    expect(limiter.take("a", 2_999).ok).toBe(false);
    expect(limiter.take("a", 3_000).ok).toBe(true);
    expect(limiter.take("a", 3_000).ok).toBe(false);
  });

  it("keeps no more than maxKeys addresses: a flood evicts the oldest", () => {
    const limiter = createRateLimiter({ capacity: 1, windowMs: 60_000, maxKeys: 3 });
    expect(limiter.take("first", 0).ok).toBe(true);
    expect(limiter.take("first", 0).ok).toBe(false);
    for (const key of ["a", "b", "c"]) limiter.take(key, 1);
    // Four addresses for three places: «first» was the oldest and is gone, so it starts full —
    // the cost of a bound, and the reason the bound is ten thousand in production.
    expect(limiter.take("first", 2).ok).toBe(true);
  });

  it("drops a bucket that has refilled before one that still carries a count", () => {
    // One token a second, three at most.
    const limiter = createRateLimiter({ capacity: 3, windowMs: 3_000, maxKeys: 3 });
    for (let index = 0; index < 3; index += 1) limiter.take("drained", 0);
    limiter.take("refilled", 100);
    // At 1.2 s «refilled» is full again and «drained» holds 1.2 tokens: the flood must take the
    // full one, which says nothing, and keep the one that is still being counted.
    for (const key of ["a", "b"]) limiter.take(key, 1_200);
    expect(limiter.take("drained", 1_200).ok).toBe(true);
    expect(limiter.take("drained", 1_200).ok).toBe(false);
  });
});

describe("POST /api/fuentes/inspeccionar", () => {
  it("answers what a real file says about itself, with the inspection's own time", async () => {
    const response = await inspect(fromOurPage(KARLA));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      format: "woff2",
      name: "Karla",
      sanitised: "Karla",
      hasFvar: false,
      wght: null,
      weight: 400,
      italic: false,
      bytes: KARLA.byteLength,
    });
    expect(response.headers.get("server-timing")).toMatch(/^inspect;dur=\d+(\.\d)?$/);
  });

  it("refuses another website's page, and a request with no origin at all, with a 403", async () => {
    const crossSite = fromOurPage(KARLA, { "sec-fetch-site": "cross-site" });
    expect((await inspect(crossSite)).status).toBe(403);
    const bare = post("/api/fuentes/inspeccionar", KARLA, {
      "content-length": String(KARLA.byteLength),
    });
    expect((await inspect(bare)).status).toBe(403);
  });

  it("wants a Content-Length (411) of at most 2 MB (413) before reading the body", async () => {
    const noLength = post("/api/fuentes/inspeccionar", KARLA, { "sec-fetch-site": "same-origin" });
    expect((await inspect(noLength)).status).toBe(411);
    const declaredBig = fromOurPage(KARLA, { "content-length": String(MAX_FONT_BYTES + 1) });
    expect((await inspect(declaredBig)).status).toBe(413);
  });

  it("stops reading at 2 MB when the Content-Length lies small", async () => {
    const big = new Uint8Array(MAX_FONT_BYTES + 1);
    big.set(KARLA);
    const liar = fromOurPage(big, { "content-length": "100" });
    expect((await inspect(liar)).status).toBe(413);
  });

  it("names the refusal so the dialog can say it in Spanish", async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
    const notAFont = await inspect(fromOurPage(svg));
    expect(notAFont.status).toBe(422);
    expect(await notAFont.json()).toEqual({ reason: "notAFont" });
    const collection = await inspect(fromOurPage(new TextEncoder().encode("ttcf\0\x02\0\0")));
    expect(await collection.json()).toEqual({ reason: "collection" });
  });
});

describe("condition 2 — one limit across both routes", () => {
  it("refuses the twenty-first request of an address with 429, whichever route it spent them on", async () => {
    for (let index = 0; index < 20; index += 1) {
      expect((await inspect(fromOurPage(KARLA))).status).toBe(200);
    }
    const twentyFirst = await inspect(fromOurPage(KARLA));
    expect(twentyFirst.status).toBe(429);
    expect(Number(twentyFirst.headers.get("retry-after"))).toBeGreaterThan(0);

    // The download shares the bucket: the same address is refused there before its body is read.
    const form = new FormData();
    form.set("document", "{}");
    const downloaded = await download(
      post("/api/download", form, { "x-forwarded-for": "203.0.113.7" }),
    );
    expect(downloaded.status).toBe(429);

    // Another address is untouched.
    const other = await inspect(fromOurPage(KARLA, { "x-forwarded-for": "203.0.113.8" }));
    expect(other.status).toBe(200);
  });

  it("does not spend a visitor's budget on a request it refuses for its origin", async () => {
    for (let index = 0; index < 25; index += 1) {
      await inspect(fromOurPage(KARLA, { "sec-fetch-site": "cross-site" }));
    }
    expect((await inspect(fromOurPage(KARLA))).status).toBe(200);
  });
});
