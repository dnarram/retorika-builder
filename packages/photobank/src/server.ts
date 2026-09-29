import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { recordById } from "./index.ts";
import type { ImageRecord } from "./schema.ts";

/**
 * The bytes of a bank photograph, read off disk.
 *
 * **The only module in this package that touches `node:fs`**, and deliberately apart from
 * `src/index.ts`, which the generator imports into a browser bundle. A test source-checks that
 * `src/index.ts` never reaches this file and never imports anything under `node:` — the same
 * boundary `packages/copybank/test/drafts.test.ts` draws around `drafts/`, drawn here around the
 * runtime instead of a directory.
 *
 * This is called from one place today: the editor's own route that serves a sample photograph
 * into the preview and reads it into a ZIP (day 4). It is what makes that route safe. The `id` is
 * looked up in the *parsed and validated* bank first, and the filename comes from the record that
 * lookup finds — the caller's string is never concatenated into a path. A `muestra-../../../etc`
 * fails at the lookup, before a `join` ever sees it.
 *
 * `root` and `lookup` are overridable, and that is for the tests rather than for any real caller.
 * `recordById` only knows the real bank, which is empty today — without the ability to inject a
 * stand-in, the one case that matters most, a known id resolving to real bytes, could never be
 * exercised until the bank had a real photograph in it.
 */
/**
 * `fileURLToPath(import.meta.url)` and not `import.meta.dirname`, and the difference is the whole
 * reason this line has a comment.
 *
 * This module is imported by a Next route handler, which means Next bundles it — and in that
 * bundle **`import.meta.dirname` is `undefined`** while `import.meta.url` still resolves to this
 * file's real path on disk. The first version used `dirname` and `pnpm build:editor` failed with
 * `The "path" argument must be of type string. Received undefined`, at module evaluation, so the
 * route could not even be collected. Measured rather than guessed: a throwaway probe route built
 * and served in production mode printed both, and only one of them was there.
 *
 * It is the same lesson `packages/copybank` recorded for the browser — "a filesystem path would
 * work on a laptop and fail once deployed" — arriving from the other side.
 */
const BANK_PHOTOS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "bank", "photos");

export function readSampleBytes(
  id: string,
  root: string = BANK_PHOTOS_DIR,
  lookup: (id: string) => ImageRecord | undefined = recordById,
): Uint8Array {
  const record = lookup(id);
  if (!record) throw new Error(`readSampleBytes: no bank image "${id}"`);
  return new Uint8Array(readFileSync(join(root, record.file)));
}
