# packages/publisher — a document becomes a site, and a ZIP

> **Claude-only. Exclusive zone.** Part 2 names `packages/renderer` because *"su salida es la web
> del cliente y viaja en el ZIP"*. This package is what builds that ZIP. The reason applies word
> for word; the table simply predates the package, and Part 2 has now been amended to say so.
>
> Not delegated to OpenCode under any circumstances, however mechanical a change looks.

## Objective

A validated document becomes the exact set of files that constitute a website, and those files
become a ZIP that a client opens by double-clicking `index.html` — with no server, no network
and nothing of ours in it.

## Where it comes from

- Protocol Part 14, Phase 0: the acceptance criterion is *"publicar un sitio de una sección en
  un subdominio real, descargar su ZIP, abrirlo con doble clic y que se vea igual"*.
- Protocol Part 3.4: `packages/publisher` — "Empaqueta el sitio: HTML, CSS, imágenes, sitemap,
  ZIP".
- ADR 0001: the published site is static, carries no runtime framework and depends on no API of
  ours.
- Protocol Part 16: the export always works, even with the account lapsed or in dispute.
- Concept dossier §5, screen 6, and §8: the download is one of the two equally-priced ways a
  site can live.

## Files that may be touched

Closed list. Anything not on it is a file this task must not create.

```
packages/publisher/package.json
packages/publisher/tsconfig.json
packages/publisher/src/index.ts
packages/publisher/src/site.ts
packages/publisher/src/manifest.ts
packages/publisher/src/metafiles.ts
packages/publisher/src/zip.ts
packages/publisher/test/site.test.ts
packages/publisher/test/zip.test.ts
packages/publisher/test/double-click.test.ts
scripts/build-sample-site.ts
tsconfig.json                          (add the project reference only)
vitest.config.ts                       (add the "publisher" project only)
package.json                           (add the site:sample script only)
coverage-thresholds.json               (only if the floor rises; never lowered)
README.md                              (phase table, and the site:sample script)
```

Package name `@retorika/publisher`, private, `"type": "module"`, exports `"." -> "./src/index.ts"`.
Dependencies: `@retorika/schema` and `@retorika/renderer`, both `workspace:*`. **No third-party
runtime dependency** — see step 5.

## Invariants it touches

**`INV_5` — "Publishing produces identical output with tools on or off".** This package is where
"publishing" stops being a figure of speech. Its output must be deterministic for the same
reason the renderer's is: same document in, same bytes out, or the golden corpus is noise.

The other four are untouched: this task adds no document behaviour and must not alter one.
`pnpm test:golden` staying byte-identical is part of done.

## Steps

### 1. `src/manifest.ts`

```ts
export interface SiteManifest {
  /** Stable id of the site this bundle was built from. */
  siteId: string;
  /** The schemaVersion of the source document, so a stale bundle is identifiable. */
  schemaVersion: string;
  /** The file a visitor lands on. Always "index.html". */
  entry: string;
  pages: { slug: string; path: string; title: string }[];
  /** Every asset path in the bundle, relative, e.g. "assets/photo.svg". */
  assets: string[];
}
```

No timestamps and no build ids. Anything that changes between two builds of the same document
breaks `INV_5`.

### 2. `src/site.ts` — the main entry point

```ts
import type { RetorikaDocument } from "@retorika/schema";
import type { SiteManifest } from "./manifest.ts";

export interface SiteFile {
  /** Relative, forward slashes, never leading "/" and never containing "..". */
  path: string;
  contents: Uint8Array;
  contentType: string;
}

export interface BuildSiteOptions {
  siteId: string;
  /**
   * Absolute origin the site will be served from, e.g. "https://lua.retorika.app".
   * Omitted for a download: a ZIP has no URL, and sitemap.xml is then not emitted.
   */
  baseUrl?: string;
  /**
   * Asset bytes, keyed by the src exactly as it appears in the document.
   * Resolution is the caller's job, so buildSite stays synchronous and pure.
   */
  assets: ReadonlyMap<string, Uint8Array>;
}

export interface SiteBundle {
  /** The website. This, and only this, is what the client's ZIP contains. */
  files: SiteFile[];
  /** Metadata for serve. A sibling field, never an entry in files. */
  manifest: SiteManifest;
}

/** Throws on a missing asset, an unknown page slug collision, or an unsafe path. */
export function buildSite(doc: RetorikaDocument, options: BuildSiteOptions): SiteBundle;
```

**The manifest is a sibling field, not a file.** The client's download contains their website and
nothing else; `bundleToZip` therefore cannot include the manifest even by mistake, because it
only ever walks `files`.

**Layout, and it is decided — do not improvise:**

- the entry is `index.html`, built from the document's first page;
- every other page is `<slug>.html` at the bundle root;
- assets are `assets/<basename>`, and `buildSite` rewrites each `AssetRef.src` to that path;
- internal links are `./<slug>.html`, written out with the file name.

That last point is the one that matters. The links must work identically from `file://` and from
the server, which rules out extensionless URLs (`/about`) and directory URLs (`/about/`): both
work on a server and both break on double-click. A relative link naming the file works in both.

Use `render(doc, "html")` for each page. The CSS is already inlined by the renderer, so a page is
self-contained; do not extract it to a separate stylesheet.

### 3. `src/metafiles.ts`

```ts
export function buildRobotsTxt(baseUrl: string | undefined): string;
export function buildSitemapXml(manifest: SiteManifest, baseUrl: string): string;
```

`robots.txt` is always emitted. It names the sitemap only when `baseUrl` is given.

`sitemap.xml` is emitted **only** when `baseUrl` is given. A sitemap of placeholder or relative
URLs is worse than no sitemap: it is a file that looks correct and is not.

### 4. `src/zip.ts`

```ts
/** A ZIP of bundle.files. The manifest is not in it. Deterministic for the same bundle. */
export function bundleToZip(bundle: SiteBundle): Uint8Array;
```

Written by hand against `node:zlib`, with no third-party dependency. This artefact is handed to
clients, so a hundred lines of local-file-header, central-directory and end-of-central-directory
is a better trade than a supply chain. Deflate via `zlib.deflateRawSync`; fall back to stored
(method 0) when deflate does not shrink the entry.

**Determinism:** a fixed DOS timestamp for every entry, entries in sorted path order, no extra
fields. Two builds of the same document must produce byte-identical archives.

### 5. `src/index.ts`

Re-export `buildSite`, `bundleToZip`, and the types `SiteFile`, `SiteBundle`, `BuildSiteOptions`,
`SiteManifest`.

### 6. `scripts/build-sample-site.ts` and the `site:sample` script

```
pnpm site:sample <fixture-name> <out-dir>
```

Renders a fixture from `fixtures/documents/` into a real directory and also writes the ZIP
beside it. Add `"site:sample": "node scripts/build-sample-site.ts"` to the root `package.json`.
This is what makes the double-click check something a person can actually do.

Default `<out-dir>` to `.scratch/site`, which is already gitignored. Never write to the
repository root.

### 7. The tests

`test/site.test.ts`:
- Over every fixture in `fixtures/documents/`, `buildSite` produces an `index.html`.
- No `path` starts with `/` or contains `..`.
- Every `AssetRef` from `render(doc, "html")` has a corresponding `assets/…` file, and a missing
  asset in the options map **throws** rather than producing a bundle with a broken image.
- The manifest is not present anywhere in `files`.
- Two calls with the same input produce deep-equal bundles (`INV_5`).
- `sitemap.xml` is absent without `baseUrl` and present with it.

`test/zip.test.ts`:
- The archive parses: local headers, central directory and EOCD in the right places.
- Entry names match `bundle.files` exactly — in particular the manifest is absent.
- Byte-identical across two builds.
- An entry's decompressed bytes equal the original `contents`.

`test/double-click.test.ts`:
- Every `href` and `src` in every generated page is relative — no leading `/`, no `http://`, no
  `https://`, no `file://`.
- Every internal `href` ends in `.html` and names a file that exists in the bundle.
- Every `src` names an asset that exists in the bundle.

That last suite is the acceptance criterion of phase 0 turned into a test. It is the reason this
package exists.

### 8. Wiring

Project reference in the root `tsconfig.json`, a `"publisher"` project in `vitest.config.ts`
with `environment: "node"`, and `packages/publisher` moved to **here** in the README phase table.

## Definition of done

| Command | Must answer |
|---|---|
| `zsh -c 'node -v; pnpm -v'` | `v24.21.0` and `12.4.2`. If not, stop |
| `pnpm install` | completes |
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | all suites pass, including the new `publisher` project |
| `pnpm test:golden` | exit 0 and **unchanged** — this task must not move a rendered byte |
| `pnpm test:invariants` | exit 0, all reported by canonical name |
| `pnpm size` | exit 0 — under 60 KB gzipped, zero JavaScript |
| `pnpm renderer:deps` | exit 0 — the allowlist is untouched |
| `pnpm site:sample barbershop-cover .scratch/site` | writes `.scratch/site/index.html` and `.scratch/site.zip` |
| `open .scratch/site/index.html` | the page renders **with the image visible**, with no server and no network |
| unzip the ZIP into an empty directory and open its `index.html` | identical result, and **no manifest file inside** |
| `pre-commit run --all-files` | six hooks, all Passed |

**Status: done.** Verified 25 September 2026: two independent runs of
`pnpm site:sample barbershop-cover` produced byte-identical ZIPs (`cmp` clean); the extracted ZIP
contains `assets/`, `index.html` and `robots.txt` only — no manifest file; `packages/publisher`'s
only dependencies are `@retorika/schema` and `@retorika/renderer`, both workspace packages, no
third party. `pnpm test` (453/453) and `pnpm test:golden` (13/13, untouched) both green.

- [x] New tests that failed before and pass now
- [x] `pnpm test:golden` byte-identical
- [x] Two builds of the same fixture produce identical ZIP bytes
- [x] No third-party runtime dependency in `packages/publisher/package.json`
- [x] No keys and no real client data — `pre-commit run gitleaks --all-files` passes repo-wide

## Out of scope

Things someone could reasonably add unasked, and must not:

- **Uploading anything.** This package produces bytes; `apps/serve` and a later publish flow move
  them. No network calls, no R2 client, no credentials.
- **The manifest inside the client ZIP.** It is deliberately excluded.
- A third-party ZIP or archiver dependency.
- Image optimisation, resizing or format conversion.
- Minifying HTML or CSS. It would change golden output for no measured gain.
- A separate `styles.css`. The renderer inlines CSS and that is what makes double-click work.
- `og:` tags, favicons, analytics, or anything else SEO-adjacent — phase 2.
- Multi-page navigation UI. A menu is the editor's job; this package only writes the links.
- Touching `packages/renderer` to make packaging easier.

## If anything is unclear, stop and ask

The executor may **not** decide any of the following.

1. **The public URL shape.** `baseUrl` is a parameter and the tests pass a placeholder. What a
   real published site's origin looks like is a product decision, and `apps/serve` depends on it.
2. **Whether a page may be anything other than `<slug>.html`.** If a real requirement conflicts
   with that layout, it conflicts with the double-click promise, and that is ADR territory.
3. **What to do if a fixture's asset cannot be resolved.** The answer here is "throw", and if
   some caller needs a bundle with missing assets, that need is a conversation, not a default.
4. **Anything touching payment, ownership or the preview watermark of dossier §8.** Money and
   permissions are exclusive zones of their own.
