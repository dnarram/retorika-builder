import { fontFilesFor } from "@retorika/renderer";
import type { RetorikaDocument } from "@retorika/schema";
import { fontDataFor } from "./fontData.ts";
import { licencesFor } from "./fonts.ts";

/**
 * The bytes for a set of faces, read from the packages they come from.
 *
 * **Separate from `buildSite`, and synchronous**, because in the end there is nothing to wait for: the
 * bytes live in `fontData.ts`, generated from the packages and checked against them by a test. It stays
 * a separate function anyway — `buildSite` takes a map exactly as it does for photos, so there is one
 * shape for "bytes the caller supplies" rather than two.
 *
 * **Resolved through the package's own `exports`**, not by guessing at a path inside `node_modules`:
 * `@fontsource` exposes `./files/*.woff2` and `./LICENSE`, so resolution finds them wherever the
 * package manager actually put them. pnpm's store means a hand-built path would be wrong on the first
 * machine that was not this one.
 *
 * **Three ways of reading these bytes from `node_modules` were tried and all three failed in the one
 * place that matters** — inside Next's bundled server runtime — while every unit test passed:
 * `import.meta.resolve` is not a function there; a dynamic `require.resolve` is «too dynamic» for the
 * bundler; and a literal one has its result rewritten to a `[project]/…` placeholder that then does not
 * exist. Each was found by posting to the real route. `scripts/generate-font-data.ts` records the whole
 * sequence, and the conclusion is that the way to be certain is to have nothing to resolve.
 *
 * Returns both the faces and the licence texts, keyed the way `BuildSiteOptions.fonts` wants them:
 * a face by its file name, a licence by the path it takes in the bundle. One map, because they are one
 * obligation — the OFL requires the text to travel with the Font Software, so a caller that could
 * fetch one without the other would be a caller that could get it wrong.
 */
export function readFontBundle(doc: RetorikaDocument): Map<string, Uint8Array> {
  // Asked of the renderer rather than taken as a list, so a caller cannot hand over a set of faces
  // that disagrees with the ones the stylesheet will name. `fontFilesFor` reads the theme and no more:
  // no page is rendered to answer it.
  const files = fontFilesFor(doc);
  const bytes = new Map<string, Uint8Array>();
  if (files.length === 0) return bytes;

  // The faces, and then the licences they oblige — derived rather than passed in, so no caller can ask
  // for a face and forget its licence. `licencesFor` is the same function `buildSite` uses to decide
  // what it requires, so the two cannot disagree about the obligation.
  for (const key of [...files, ...licencesFor(files)]) {
    const data = fontDataFor(key);
    if (data === undefined) throw new Error(`readFontBundle: no bytes for "${key}"`);
    bytes.set(key, data);
  }

  return bytes;
}
