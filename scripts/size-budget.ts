import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { render } from "@retorika/renderer";
import { parseDocument } from "@retorika/schema";

/**
 * The published-page weight budget of protocol Part 8.5.
 *
 * These numbers are a product feature, not housekeeping: they are the visible difference
 * between a Retorika site and one built with a template builder. Measured in process with
 * node:zlib, so no extra dependency is needed yet.
 */

const MAX_GZIP_BYTES = 60 * 1024;
const DOCUMENTS_DIR = join(import.meta.dirname, "..", "fixtures", "documents");

let failed = false;

for (const file of readdirSync(DOCUMENTS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  const document = parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, file), "utf8")));
  const { html } = render(document, "html");

  const bytes = gzipSync(Buffer.from(html, "utf8")).length;
  const kb = (bytes / 1024).toFixed(1);

  // Zero JavaScript unless a section genuinely needs it. No cover variant does, so any
  // script tag here is a regression rather than a judgement call.
  const scripts = (html.match(/<script\b/gi) ?? []).length;

  const over = bytes > MAX_GZIP_BYTES;
  const withScript = scripts > 0;
  if (over || withScript) failed = true;

  const status = over || withScript ? "FAIL" : "ok";
  console.log(
    `${status.padEnd(4)} ${file.padEnd(32)} ${kb.padStart(6)} KB gzipped   ${scripts} script tag(s)`,
  );
}

console.log(`\nBudget: ${MAX_GZIP_BYTES / 1024} KB gzipped per page, zero JavaScript.`);

if (failed) {
  console.error("\nThe published-page budget was exceeded.");
  process.exit(1);
}
