import { cacheControlFor, securityHeaders } from "./headers.ts";
import { objectKeyFor, siteIdFromHost } from "./routing.ts";

/**
 * The Worker that serves published sites from R2 (protocol Part 3.3 and 3.4).
 *
 * It depends on no other service of ours: if our API is down, published sites keep
 * serving. That is Part 16's promise, and test/fetch.test.ts holds it by reading this
 * file's imports — nothing but its own two modules and the R2 binding.
 */

/** Metadata of a stored object, as R2 reports it. */
export interface SiteObject {
  /** Already quoted, e.g. "\"abc\"", ready for the ETag header. */
  httpEtag: string;
  httpMetadata?: { contentType?: string };
}

/**
 * The part of R2Bucket this Worker uses. The real binding satisfies it structurally, and
 * the test fake implements exactly this. Declared here instead of importing
 * @cloudflare/workers-types, whose globals clash with the @types/node the workspace
 * compiles against — and it keeps this app free of dependencies.
 */
export interface SitesBucket {
  get(key: string): Promise<(SiteObject & { body: ReadableStream }) | null>;
  head(key: string): Promise<SiteObject | null>;
}

export interface Env {
  /** R2 bucket binding. Its real name comes from wrangler configuration, never from code. */
  SITES: SitesBucket;
  /** The apex the wildcard hangs off, e.g. "retorika.app". Supplied as a var. */
  SITES_DOMAIN: string;
}

function plain(status: number, body: string, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders(), ...extra },
  });
}

/**
 * One body for every miss — unknown host, unknown site, unsafe path, missing object — so
 * that no response reveals whether a site exists. Never a redirect to another site.
 */
function notFound(): Response {
  return plain(404, "Not found\n");
}

/** RFC 9110: a list of entity tags, weak or strong, or "*". Compared weakly for GET/HEAD. */
function matchesIfNoneMatch(header: string | null, etag: string): boolean {
  if (header === null) return false;
  const strip = (tag: string) => tag.trim().replace(/^W\//, "");
  return header.split(",").some((tag) => tag.trim() === "*" || strip(tag) === strip(etag));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Static files, not an API.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return plain(405, "Method not allowed\n", { Allow: "GET, HEAD" });
    }

    // A missing domain is a misconfigured Worker. A 404 for every site would hide it.
    if (!env.SITES_DOMAIN) return plain(500, "Server misconfigured\n");

    const url = new URL(request.url);
    const siteId = siteIdFromHost(url.host, env.SITES_DOMAIN);
    if (siteId === null) return notFound();
    const key = objectKeyFor(siteId, url.pathname);
    if (key === null) return notFound();

    // HEAD reads metadata only; the body is never fetched for a response that has none.
    let object: SiteObject | null;
    let body: ReadableStream | null = null;
    if (request.method === "HEAD") {
      object = await env.SITES.head(key);
    } else {
      const found = await env.SITES.get(key);
      object = found;
      body = found?.body ?? null;
    }
    if (object === null) return notFound();

    // The content type is whatever publisher stored. Guessing from the extension here
    // would hide a broken upload; so would application/octet-stream, which breaks the
    // page just as surely without saying why.
    const contentType = object.httpMetadata?.contentType;
    if (!contentType) return plain(500, "Stored object has no content type\n");

    const headers = {
      ...securityHeaders(),
      "Cache-Control": cacheControlFor(key),
      ETag: object.httpEtag,
    };
    if (matchesIfNoneMatch(request.headers.get("If-None-Match"), object.httpEtag)) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(body, {
      status: 200,
      headers: { ...headers, "Content-Type": contentType },
    });
  },
};
