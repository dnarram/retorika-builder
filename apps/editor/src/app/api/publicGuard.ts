import { publicOrigin } from "../../auth/publicOrigin.ts";

/**
 * What stands in front of the two public routes that work on bytes somebody else sent —
 * `/api/download` and `/api/fuentes/inspeccionar` (sprint 29 día 5, ADR 0056 §10).
 *
 * **Why this and not a session.** The plan's adjustment 2 asked the inspection route for «the same
 * session as `/api/download`», and `/api/download` has none: the questionnaire and the download are
 * anonymous by ADR 0034 §2, and the route has said «public, unauthenticated» about itself since
 * sprint 3. David's decision on 27 October 2026, at the opening of día 5, was to keep both routes
 * public and bound what one caller can make them do, with three conditions — two of them are here:
 *
 * 1. **Same origin, with a fallback** (`isSameOrigin`), for the inspection route: `Sec-Fetch-Site`
 *    when the browser sends it, `Origin` against this application's public origin when it does not
 *    (Safari before 16.4), and a 403 with neither. It keeps another website from spending a visitor's
 *    browser on our decompressor; it does not stop `curl`, which can write any header it likes —
 *    the limit below is what bounds that.
 * 2. **One limit per address, shared by both routes** (`PUBLIC_BYTES_LIMIT`): twenty requests a
 *    minute, a 429 with `Retry-After` past it. Shared because they are the only two endpoints that
 *    take a stranger's bytes and do work proportional to them, and a caller who has spent their
 *    budget on one should not find a fresh one on the other.
 *
 * The third condition — the measured CPU of the worst file the caps admit — is in the ADR.
 */

/**
 * Whether the request comes from a page of this application.
 *
 * `Sec-Fetch-Site` is set by the browser and cannot be written by a script, so when it is present
 * it decides alone — `same-site` is not enough, because a sibling subdomain is somebody else's page.
 * Without it, `Origin` must be exactly this application's public origin as `publicOrigin` reads it
 * behind Render's proxy — the request's own URL there is `http://localhost:10000`. A request with
 * neither header is not from a browser on our page, and is refused.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  return origin === publicOrigin(request);
}

/**
 * The caller's address, for the limit.
 *
 * **In the order the infrastructure writes them, not the order a client could.** Render serves
 * through Cloudflare, which sets `CF-Connecting-IP` to the address that connected to it and
 * overwrites whatever the client sent under that name; `True-Client-IP` is the same value where
 * Cloudflare adds it. `X-Forwarded-For` is last because Render's proxy *appends* to it — its first
 * entry can be a client's invention — and it is what `next dev` and `next start` fill from the
 * socket when nothing is in front of them, which is how the e2e and local development see it.
 * Read from Cloudflare's documentation and Render's community answers, **not measured on the
 * deployment**; `docs/runbook.md` §9 says how to check.
 *
 * A request with none of them shares one bucket, `"unknown"`: refused together rather than waved
 * through apart.
 */
export function clientAddress(request: Request): string {
  for (const header of ["cf-connecting-ip", "true-client-ip"]) {
    const value = request.headers.get(header)?.trim();
    if (value) return value;
  }
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

export type Take = { ok: true } | { ok: false; retryAfterSeconds: number };

export interface RateLimiter {
  take(key: string, now?: number): Take;
  /** Forget every address. For the tests, which post more than twenty times a minute from none. */
  reset(): void;
}

interface Bucket {
  tokens: number;
  at: number;
}

/**
 * A token bucket per key, in this process's memory: `capacity` requests at once, refilled at
 * `capacity` per `windowMs`. **In memory on purpose**: the editor is one service on Render's free
 * plan (`render.yaml`, `plan: free`), one process that sees every request, and a limit kept anywhere else
 * would be a database write per download. Two instances would each allow twenty — said in the
 * runbook rather than built for.
 *
 * `maxKeys` bounds the memory a flood of addresses can take: past it, buckets that have refilled
 * completely are dropped — they carry no information — and then the oldest. A dropped address
 * starts again with a full bucket, which is the honest cost of a bound.
 */
export function createRateLimiter({
  capacity,
  windowMs,
  maxKeys = 10_000,
}: {
  capacity: number;
  windowMs: number;
  maxKeys?: number;
}): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const rate = capacity / windowMs;
  const level = (bucket: Bucket, now: number): number =>
    Math.min(capacity, bucket.tokens + Math.max(0, now - bucket.at) * rate);

  function prune(now: number): void {
    if (buckets.size <= maxKeys) return;
    for (const [key, bucket] of buckets) {
      if (level(bucket, now) >= capacity) buckets.delete(key);
    }
    for (const key of buckets.keys()) {
      if (buckets.size <= maxKeys) break;
      buckets.delete(key);
    }
  }

  return {
    take(key, now = Date.now()) {
      const bucket = buckets.get(key);
      const tokens = bucket === undefined ? capacity : level(bucket, now);
      if (tokens < 1) {
        return { ok: false, retryAfterSeconds: Math.ceil((1 - tokens) / rate / 1000) };
      }
      buckets.delete(key);
      buckets.set(key, { tokens: tokens - 1, at: now });
      prune(now);
      return { ok: true };
    },
    reset() {
      buckets.clear();
    },
  };
}

/** Twenty requests a minute per address, across both routes — David's number. */
export const PUBLIC_BYTES_LIMIT = createRateLimiter({ capacity: 20, windowMs: 60_000 });

/** The 429 for a caller past the limit, or `null` to go on. One token per call. */
export function limited(request: Request): Response | null {
  const take = PUBLIC_BYTES_LIMIT.take(clientAddress(request));
  if (take.ok) return null;
  return new Response("too many requests", {
    status: 429,
    headers: { "Retry-After": String(take.retryAfterSeconds) },
  });
}
