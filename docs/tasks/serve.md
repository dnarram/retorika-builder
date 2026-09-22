# apps/serve — the Worker that serves published sites

> **Status: on hold — [ADR 0007](../decisions/0007-hosted-publishing-on-hold.md).** Hosted publishing is
> paused by a CEO decision (2026-09-22). The code below is built and tested and stays that way,
> but nothing here is deployed, and the manual acceptance waits for the ADR's reactivation
> checklist. The rest of this file is the record of the task as it was specified and executed.

> **Claude-only. Exclusive zone.** Mapping a subdomain to a site is tenancy: one mistake serves a
> client's site under another client's domain. It is the closest thing in this repository to
> Part 2's *"permisos y propiedad"*, and it is also where the object-storage credentials are
> referenced. Part 2 has now been amended to name it.
>
> **This task is blocked** until `docs/tasks/publisher.md` is done. It serves exactly the file
> layout and manifest that `publisher` defines; writing it first means inventing that contract
> and then rewriting it.

## Two things to read before anything else

**Built complete, hidden at launch.** Direction has decided that publishing to a Retorika
subdomain is built now but **not exposed to users in the initial launch**. `apps/serve` is
infrastructure and gets finished as infrastructure — complete, tested, deployable. The hiding
lives in the editor, in a later phase. **Do not wire this to any interface**, do not add a
"publish" button anywhere, and do not treat its absence from the product as a reason to build
less than a working Worker. Phase 0's acceptance criterion still requires a real subdomain,
used internally.

**The repository is public.** No credential, no token, no account id and no bucket secret enters
this repository — not in code, not in a comment, not in a test fixture, not "temporarily".
Secrets live in GitHub Actions secrets and in Cloudflare's own secret store. This task writes
down *where* a value comes from and *what shape* it has, never the value. `gitleaks` runs on
every commit and will catch the obvious cases; it will not catch a bucket name that turns out to
be sensitive, so the rule is: configuration is referenced by binding name, never inlined.

## Objective

A request to `<site>.<domain>` returns that site's files from object storage, and no request can
reach any other site's files.

## Where it comes from

- Protocol Part 3.4: `apps/serve` — "Worker que sirve los sitios publicados desde R2".
- Protocol Part 3.3: Cloudflare R2 plus a Worker on a wildcard subdomain, which is what makes
  the cost per site cents and therefore what makes the single price possible.
- Protocol Part 16: publishing writes to object storage and is a matter of seconds; each publish
  keeps a version, and rolling back is moving a pointer. And the rule that matters most here:
  **no published site depends on an API of ours in order to keep being visible.**
- ADR 0001: the published site is static.

## Files that may be touched

Closed list. Anything not on it is a file this task must not create.

```
apps/serve/package.json
apps/serve/tsconfig.json
apps/serve/wrangler.toml
apps/serve/src/index.ts
apps/serve/src/routing.ts
apps/serve/src/headers.ts
apps/serve/test/routing.test.ts
apps/serve/test/fetch.test.ts
pnpm-workspace.yaml                    (add apps/* to the workspace)
tsconfig.json                          (add the project reference only)
vitest.config.ts                       (add the "serve" project only)
coverage-thresholds.json               (only if the floor rises; never lowered)
README.md                              (phase table)
docs/runbook.md                        (create: the "a published site is not being served" case)
```

`wrangler.toml` carries **binding names and route patterns only**. Account ids, bucket names and
tokens are supplied by the deployment environment.

## Invariants it touches

**None of the five.** They are properties of the document model, and this app never parses a
document — it serves bytes that `publisher` already produced.

It carries one guarantee of its own, and it is the reason this is an exclusive zone:
**no request for site A can ever return a byte belonging to site B.** The routing tests below
are that guarantee.

## Steps

### 1. `src/routing.ts` — the whole risk lives here

```ts
/**
 * The site id from a Host header, or null when the host is not a site host.
 *
 * Returns null - never throws, never guesses - for: the apex domain, an unknown domain,
 * an empty or multi-label subdomain, uppercase, and anything outside [a-z0-9-].
 */
export function siteIdFromHost(host: string, domain: string): string | null;

/**
 * The object key for a request path within a site, or null if the path is unsafe.
 *
 * Returns null for: "..", percent-encoded traversal, a backslash, a NUL byte, an
 * absolute path that escapes the prefix, and anything else that would resolve outside
 * "sites/<siteId>/".
 */
export function objectKeyFor(siteId: string, pathname: string): string | null;
```

Rules, and they are not negotiable:

- The key is always `sites/<siteId>/<relative path>`, built by **construction**, not by
  concatenating and then checking. Validate the site id and the relative path separately, then
  join them.
- `/` maps to `index.html`. A path ending in `/` maps to `<path>index.html`.
- An extensionless path maps to `<path>.html`, so the server also answers the pretty URL even
  though `publisher` writes explicit `.html` links. The link that ships stays the one that works
  from `file://`.
- Strip the query string and the fragment before mapping. They never affect the key.
- On any doubt, return `null` and let the caller answer 404. Never fall back to a default site.

### 2. `src/headers.ts`

```ts
export function cacheControlFor(key: string): string;
export function securityHeaders(): Record<string, string>;
```

- Assets under `assets/` are immutable and cached long; HTML is revalidated, because republishing
  must be visible without waiting out a cache.
- Always send `X-Content-Type-Options: nosniff`. Content types come from the stored object's
  metadata, which `publisher` set, never from guessing at the extension at request time.
- No `Access-Control-Allow-Origin: *`. Nothing needs it, and it is easier to add later than to
  withdraw.

### 3. `src/index.ts`

```ts
export interface Env {
  /** R2 bucket binding. Its real name comes from wrangler configuration, never from code. */
  SITES: R2Bucket;
  /** The apex the wildcard hangs off, e.g. "retorika.app". Supplied as a var. */
  SITES_DOMAIN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response>;
};
```

Behaviour:

- `GET` and `HEAD` only. Anything else is 405. This serves static files; it is not an API.
- Unknown host, unknown site, unsafe path, or a missing object → **404 with a plain body**. Never
  leak whether a site exists, and never redirect to another site.
- A found object is returned with its stored content type, `ETag` from R2, and the cache headers
  above. Honour `If-None-Match` with a 304.
- **No dependency on any other service of ours.** If our API is down, published sites keep
  serving. That is Part 16's promise and it is checked by reading the code: this file imports
  nothing but its own two modules and the R2 binding.

### 4. `wrangler.toml`

Route pattern for the wildcard subdomain, the `SITES` R2 binding by name, and `SITES_DOMAIN` as
a var. Nothing else. No account id, no bucket name that is not already public, no token.

### 5. The tests

`test/routing.test.ts` — this is the important suite, and it needs no Worker runtime:

- Valid hosts return the expected id: `lua.example.com` on domain `example.com` → `lua`.
- **null** for: the apex; a different domain; `a.b.example.com`; the empty label `.example.com`;
  `LUA.example.com`; `lu_a.example.com`; a host with a port that does not match; an IP.
- `objectKeyFor` maps `/` → `sites/x/index.html`, `/about` → `sites/x/about.html`,
  `/about/` → `sites/x/about/index.html`, `/assets/a.svg` → `sites/x/assets/a.svg`.
- **null** for: `/../other/index.html`, `/%2e%2e/other`, `/..%2f..%2fetc`, a backslash path, a
  path containing `%00`, and `//other.example.com/`.
- A property test with `fast-check`: for any generated site id and any generated path, the result
  is either `null` or a string that starts with `sites/<siteId>/` and contains no `..` segment.
  That is the tenancy guarantee stated as a property rather than a list of examples.

`test/fetch.test.ts` — with a fake `R2Bucket` (an in-memory map):

- 404 for unknown host, unknown site and missing object, with no body difference between them.
- 405 for `POST`.
- 200 with the right content type and cache header for an asset and for a page.
- 304 when `If-None-Match` matches.

### 6. `docs/runbook.md`

Protocol Part 17 asks for it and it does not exist yet. Write the first case only: **a published
site is not being served.** First question: is it one site or all of them — one means its last
deploy, all means the Worker or the storage. Then what to check, in order, and what not to touch.

## Definition of done

| Command | Must answer |
|---|---|
| `zsh -c 'node -v; pnpm -v'` | `v24.21.0` and `12.4.2`. If not, stop |
| `pnpm install` | completes; `apps/serve` appears as a workspace project |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | all suites pass, including the new `serve` project |
| `pnpm vitest run --project serve` | the traversal cases and the fast-check property all pass |
| `pnpm test:golden` | exit 0 and unchanged |
| `pre-commit run --all-files` | six hooks, all Passed, **gitleaks included** |
| `grep -rIn --exclude-dir=node_modules -E '(sk_|AKIA\|[0-9a-f]{32})' apps/serve` | no match |

Manual, and it is the phase-0 acceptance criterion:

- [ ] `pnpm site:sample barbershop-cover .scratch/site`, upload that bundle to the bucket under
      `sites/<id>/`, and load `https://<id>.<domain>/` — the page renders with its image
- [ ] Download the ZIP from step 7 of `publisher.md`, open `index.html` by double-clicking, and
      it looks the same
- [ ] `https://<id>.<domain>/../other/index.html` returns 404, not another site's page

## Out of scope

Things someone could reasonably add unasked, and must not:

- **Any user interface, button or link that exposes subdomain publishing.** Direction's decision:
  built now, hidden at launch. The hiding lives in the editor, later.
- The upload path. This Worker reads; something else writes.
- Custom domains, TLS for them, or a domain-connection flow — phase 3.
- Authentication, sessions or private areas. Phase 4, and a different product.
- The preview watermark of dossier §8: it is tied to the paywall, which is money, which is its
  own exclusive zone.
- Analytics, logging of visitor data, or anything that collects a visitor's personal data.
- Server-side rendering, redirects beyond the `.html` mapping above, or edge caching cleverness.
- Any secret value in any file in this repository.

## If anything is unclear, stop and ask

The executor may **not** decide any of the following.

1. **The real domain.** `SITES_DOMAIN` is a variable and the tests use `example.com`. Which apex
   the wildcard hangs off is a product and DNS decision.
2. **The bucket's key layout, if it must match something that already exists.** This task
   proposes `sites/<siteId>/…`; if storage is already laid out differently, the existing layout
   wins and the mapping changes.
3. **Where the manifest lives in storage.** `publisher` keeps it out of the client ZIP, but
   whether `serve` reads it at all — and from which key — depends on what publishing writes.
   Until that is settled, serve does not need it: it serves files by path.
4. **Anything touching the paywall, ownership or the preview marker.** Money and permissions are
   exclusive zones and none of them is decided here.
5. **A finding that a site id could collide with a reserved subdomain** (`www`, `api`, `admin`).
   There is no reserved list yet. If one is needed, that is a decision, not a default.
