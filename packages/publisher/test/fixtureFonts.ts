import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { RetorikaDocument } from "@retorika/schema";
import { readFontBundle } from "../src/fontBytes.ts";
import { ownFontKeysFor } from "../src/fonts.ts";

/**
 * The font bytes a corpus document needs, the way a caller would assemble them: the table's faces
 * and their OFLs from `readFontBundle`, and **the owner's own from `fixtures/fonts/`** — the
 * fixture directory stands in for the browser and the account, exactly as `fixtures/assets/` stands
 * in for the owner's photographs. Keyed as `BuildSiteOptions.fonts` wants them.
 */
const FONTS_DIR = join(import.meta.dirname, "..", "..", "..", "fixtures", "fonts");

export function fixtureFontBundle(document: RetorikaDocument): Map<string, Uint8Array> {
  const bytes = readFontBundle(document);
  for (const key of ownFontKeysFor(document)) {
    bytes.set(key, new Uint8Array(readFileSync(join(FONTS_DIR, basename(key)))));
  }
  return bytes;
}
