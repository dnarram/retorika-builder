import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import worker, { type Env, type SitesBucket } from "../src/index.ts";

interface StoredObject {
  body: string;
  contentType?: string;
  etag: string;
}

/** An in-memory R2 stand-in that also records which method served each key. */
function fakeBucket(objects: Record<string, StoredObject>) {
  const calls: { method: "get" | "head"; key: string }[] = [];
  const meta = (object: StoredObject) => ({
    httpEtag: `"${object.etag}"`,
    httpMetadata: object.contentType === undefined ? {} : { contentType: object.contentType },
  });
  const bucket: SitesBucket = {
    async get(key) {
      calls.push({ method: "get", key });
      const object = objects[key];
      if (!object) return null;
      const body = new Response(object.body).body;
      if (!body) throw new Error("fake bucket could not build a body");
      return { ...meta(object), body };
    },
    async head(key) {
      calls.push({ method: "head", key });
      const object = objects[key];
      return object ? meta(object) : null;
    },
  };
  return { bucket, calls };
}

const OBJECTS: Record<string, StoredObject> = {
  "sites/lua/index.html": {
    body: "<!doctype html><title>Lua</title>",
    contentType: "text/html; charset=utf-8",
    etag: "e-lua-index",
  },
  "sites/lua/servicios.html": {
    body: "<!doctype html><title>Servicios</title>",
    contentType: "text/html; charset=utf-8",
    etag: "e-lua-servicios",
  },
  "sites/lua/assets/photo.svg": {
    body: "<svg/>",
    contentType: "image/svg+xml",
    etag: "e-lua-photo",
  },
  "sites/lua/broken.html": { body: "no type", etag: "e-lua-broken" },
  "sites/other/index.html": {
    body: "<!doctype html><title>Another client</title>",
    contentType: "text/html; charset=utf-8",
    etag: "e-other-index",
  },
};

function serve(url: string, init: RequestInit = {}, env: Partial<Env> = {}) {
  const { bucket, calls } = fakeBucket(OBJECTS);
  const response = worker.fetch(new Request(url, init), {
    SITES: bucket,
    SITES_DOMAIN: "example.com",
    ...env,
  });
  return { response, calls };
}

function expectSecurityHeaders(response: Response) {
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
}

describe("fetch", () => {
  it("serves a page with its stored content type, ETag and a revalidating cache", async () => {
    const response = await serve("https://lua.example.com/").response;
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("etag")).toBe('"e-lua-index"');
    expect(response.headers.get("cache-control")).toBe("public, no-cache");
    expect(await response.text()).toBe("<!doctype html><title>Lua</title>");
    expectSecurityHeaders(response);
  });

  it("answers the pretty URL as well as the file name", async () => {
    for (const path of ["/servicios", "/servicios.html"]) {
      const response = await serve(`https://lua.example.com${path}`).response;
      expect(response.status, path).toBe(200);
      expect(await response.text(), path).toContain("Servicios");
    }
  });

  it("serves an asset with its stored content type and a short revalidating cache", async () => {
    const response = await serve("https://lua.example.com/assets/photo.svg").response;
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300, must-revalidate");
    expectSecurityHeaders(response);
  });

  it("answers HEAD with headers and no body, without reading the object", async () => {
    const { response, calls } = serve("https://lua.example.com/", { method: "HEAD" });
    const result = await response;
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await result.text()).toBe("");
    expect(calls).toEqual([{ method: "head", key: "sites/lua/index.html" }]);
  });

  it.each([
    ["the exact ETag", '"e-lua-index"'],
    ["a weak ETag", 'W/"e-lua-index"'],
    ["a list containing it", '"stale", "e-lua-index"'],
    ["a wildcard", "*"],
  ])("answers 304 to If-None-Match with %s", async (_label, value) => {
    const response = await serve("https://lua.example.com/", {
      headers: { "If-None-Match": value },
    }).response;
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"e-lua-index"');
    expect(response.headers.get("cache-control")).toBe("public, no-cache");
    expect(await response.text()).toBe("");
    expectSecurityHeaders(response);
  });

  it("answers 200 to an If-None-Match that does not match", async () => {
    const response = await serve("https://lua.example.com/", {
      headers: { "If-None-Match": '"stale"' },
    }).response;
    expect(response.status).toBe(200);
  });

  it("answers the same 404 for every kind of miss, so a site's existence never leaks", async () => {
    const misses = [
      "https://lua.example.org/", // unknown domain
      "https://example.com/", // apex
      "https://a.b.example.com/", // multi-label host
      "https://nobody.example.com/", // unknown site
      "https://lua.example.com/nope", // missing object
      "https://lua.example.com/..%2fother/index.html", // unsafe path
      "https://lua.example.com/%2e%2e/other/index.html", // traversal toward another site
    ];
    const answers = await Promise.all(
      misses.map(async (url) => {
        const response = await serve(url).response;
        expectSecurityHeaders(response);
        return {
          url,
          status: response.status,
          type: response.headers.get("content-type"),
          body: await response.text(),
        };
      }),
    );
    for (const answer of answers) {
      expect(answer, answer.url).toEqual({
        url: answer.url,
        status: 404,
        type: "text/plain; charset=utf-8",
        body: "Not found\n",
      });
    }
  });

  it("never serves another site's page, whatever the path", async () => {
    for (const path of ["/../other/index.html", "/%2e%2e/other/", "/sites/other/index.html"]) {
      const response = await serve(`https://lua.example.com${path}`).response;
      expect(await response.text(), path).not.toContain("Another client");
    }
  });

  it.each(["POST", "PUT", "DELETE", "PATCH"])("answers 405 to %s", async (method) => {
    const response = await serve("https://lua.example.com/", { method }).response;
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expectSecurityHeaders(response);
  });

  it("answers 500 for a stored object with no content type, rather than guessing one", async () => {
    const response = await serve("https://lua.example.com/broken.html").response;
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expectSecurityHeaders(response);
  });

  it("answers 500 when SITES_DOMAIN is not configured, rather than 404 for every site", async () => {
    const response = await serve("https://lua.example.com/", {}, { SITES_DOMAIN: "" }).response;
    expect(response.status).toBe(500);
    expectSecurityHeaders(response);
  });

  it("imports nothing but its own two modules (Part 16: no dependency on our services)", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "src", "index.ts"), "utf8");
    const specifiers = [...source.matchAll(/^\s*(?:import|export)\b[^;]*?from\s+"([^"]+)"/gm)].map(
      (match) => match[1],
    );
    expect(specifiers.sort()).toEqual(["./headers.ts", "./routing.ts"]);
    // Its own fetch handler is fine; calling out to the network is not.
    expect(source).not.toMatch(/await\s+fetch\(|globalThis\.fetch|\bWebSocket\b/);
  });
});
