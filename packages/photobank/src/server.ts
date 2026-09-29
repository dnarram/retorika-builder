import { readFileSync } from "node:fs";
import { join } from "node:path";
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
const BANK_PHOTOS_DIR = join(import.meta.dirname, "..", "bank", "photos");

export function readSampleBytes(
  id: string,
  root: string = BANK_PHOTOS_DIR,
  lookup: (id: string) => ImageRecord | undefined = recordById,
): Uint8Array {
  const record = lookup(id);
  if (!record) throw new Error(`readSampleBytes: no bank image "${id}"`);
  return new Uint8Array(readFileSync(join(root, record.file)));
}
