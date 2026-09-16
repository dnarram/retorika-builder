import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";

const here = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = join(here, "..", "..", "..");
export const DOCUMENTS_DIR = join(REPO_ROOT, "fixtures", "documents");
export const GOLDEN_DIR = join(REPO_ROOT, "fixtures", "golden");
export const ASSETS_DIR = join(REPO_ROOT, "fixtures", "assets");

export interface CorpusEntry {
  name: string;
  document: RetorikaDocument;
}

/**
 * The golden corpus (protocol Part 8.3). Every document is parsed rather than cast, so a
 * fixture that stops being valid fails loudly instead of quietly testing nothing.
 */
export function loadCorpus(): CorpusEntry[] {
  return readdirSync(DOCUMENTS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({
      name: file.replace(/\.json$/, ""),
      document: parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, file), "utf8"))),
    }));
}
