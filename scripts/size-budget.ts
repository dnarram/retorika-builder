import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { buildSite, readFontBundle } from "@retorika/publisher";
import { render } from "@retorika/renderer";
import { flattenElements, parseDocument } from "@retorika/schema";

/**
 * The published-page weight budget of protocol Part 8.5.
 *
 * These numbers are a product feature, not housekeeping: they are the visible difference
 * between a Retorika site and one built with a template builder. Measured in process with
 * node:zlib, so no extra dependency is needed yet.
 */

const MAX_GZIP_BYTES = 60 * 1024;

/**
 * The second number, added in sprint 11 day 6: **the whole bundle, not just the page.**
 *
 * Until fonts there was nothing to measure — a bundle was a page, a robots.txt and a couple of small
 * assets, so the page budget covered everything that mattered. A face is 20–25 KB and two of them are
 * most of a download, which is exactly the kind of weight that arrives without anybody noticing.
 *
 * **Chosen from the measurement rather than invented.** Measured on 1 October 2026 across the corpus:
 * a site on `editorial-serif` comes to **1.8–2.5 KB** and carries no font at all; the one on
 * `classic-display` comes to **52.7 KB**, of which 43.9 KB is the two `woff2` and 2.0 KB the licence
 * the OFL requires beside them. Inter's pair is within a kilobyte of Playfair's, so the worst case for
 * either is about the same. 80 KB is roughly 1.5× that worst case: loose enough not to fail on a
 * rounding, tight enough that a third family or an uncompressed asset cannot slip in unseen.
 *
 * **It measures our bytes, not the owner's.** These fixtures carry sample photographs only; a real
 * site with six uploaded photos can exceed any number here, and should. What this budget protects is
 * the part we decide.
 */
const MAX_BUNDLE_GZIP_BYTES = 80 * 1024;

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");
const DOCUMENTS_DIR = join(FIXTURES_DIR, "documents");

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

  // The whole bundle: every file the owner downloads, each gzipped and summed. A ZIP already deflates
  // its entries, so this is the closest honest analogue of the download without measuring the ZIP
  // container's own overhead, which is not a thing anybody can act on.
  const assets = new Map<string, Uint8Array>();
  for (const page of document.pages) {
    for (const section of page.sections) {
      for (const el of flattenElements(section.content)) {
        if (el.value?.kind !== "image" || el.value.src.startsWith("data:")) continue;
        assets.set(el.value.src, new Uint8Array(readFileSync(join(FIXTURES_DIR, el.value.src))));
      }
    }
  }
  const bundle = buildSite(document, {
    siteId: "size",
    assets,
    fonts: readFontBundle(document),
  });
  let bundleBytes = 0;
  let fontBytes = 0;
  for (const bundled of bundle.files) {
    const size = gzipSync(Buffer.from(bundled.contents)).length;
    bundleBytes += size;
    if (bundled.path.startsWith("fonts/")) fontBytes += size;
  }

  const over = bytes > MAX_GZIP_BYTES;
  const overBundle = bundleBytes > MAX_BUNDLE_GZIP_BYTES;
  const withScript = scripts > 0;
  if (over || overBundle || withScript) failed = true;

  const status = over || overBundle || withScript ? "FAIL" : "ok";
  const fonts = fontBytes === 0 ? "no fonts" : `${(fontBytes / 1024).toFixed(1)} KB of fonts`;
  console.log(
    `${status.padEnd(4)} ${file.padEnd(32)} ${kb.padStart(6)} KB page   ` +
      `${(bundleBytes / 1024).toFixed(1).padStart(6)} KB bundle   ` +
      `${scripts} script tag(s)   ${fonts}`,
  );
}

console.log(
  `\nBudget: ${MAX_GZIP_BYTES / 1024} KB gzipped per page and ` +
    `${MAX_BUNDLE_GZIP_BYTES / 1024} KB per bundle, zero JavaScript.`,
);

if (failed) {
  console.error("\nA weight budget was exceeded.");
  process.exit(1);
}
