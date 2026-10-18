import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { gzipSync } from "node:zlib";
import { EMPTY_ANSWERS, generate, VARIANTS } from "@retorika/generator";
import { hasSamplePhotos, recordById, sectorsInBank } from "@retorika/photobank";
import { readSampleBytes } from "@retorika/photobank/server";
import { buildSite, readFontBundle } from "@retorika/publisher";
import { render } from "@retorika/renderer";
import { flattenElements, parseDocument, type RetorikaDocument } from "@retorika/schema";

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
 * the OFL requires beside them. Inter's pair and EB Garamond's are within four kilobytes, so the worst case for
 * either is about the same. 80 KB is roughly 1.5× that worst case: loose enough not to fail on a
 * rounding, tight enough that a third family or an uncompressed asset cannot slip in unseen.
 *
 * **It measures our bytes, not the owner's.** A real site with six uploaded photos can exceed any
 * number here, and should. What this budget protects is the part we decide.
 *
 * **And since 9 October 2026 it means that literally: photographs are weighed and reported, and
 * subtracted before this number is applied.** Until that day the script measured
 * `fixtures/documents/` and not one of those seventeen documents carried a `sample` field, so a
 * real site of a sector with a filled bank passed a budget that never saw it — 103.3 KB gzipped
 * when the backlog measured one on 8 October 2026, and **79.2 to 127.9 KB across the three
 * compositions when this script started measuring them**, of which 30.6 to 79.3 KB is the
 * photograph and 48.5 KB is ours.
 *
 * The 80 was chosen in sprint 11 from a worst case that was fonts and nothing else, and it keeps
 * that meaning: raising it to swallow a photograph would have retired the only number here that
 * protects anything.
 *
 * **What bounds the photographs is the bank's own cap**, `MAX_IMAGE_BYTES` (200 KB per approved
 * photograph), enforced where it belongs in `packages/photobank`. This script's job is that the part
 * we author stays small and that the whole download is visible.
 */
const MAX_BUNDLE_GZIP_BYTES = 80 * 1024;

/**
 * What one more emitted page may add to the bundle (ADR 0040 §8), **measured on 13 October 2026**
 * rather than chosen: a page drawn per entry of the twelve-entry fixture `una-pagina-por-ficha`
 * gzips to 1.7 KB (22.6 KB of ours for 13 files, 2.4 of them the home page), and the heaviest
 * page in the corpus and the generated sample — restaurante-bar on `image-left`, with the gallery
 * and the menu — to 3.1 KB. Four kilobytes holds a drawn page of the heavier composition and
 * nothing more. Every page re-inlines the stylesheet (ADR 0001's self-contained files), which is
 * most of that figure; the fonts are counted once for the site, not per page.
 *
 * The 80 above keeps its meaning — our bytes for a one-page site — and the allowance grows by this
 * per page actually emitted, counted off the bundle's `.html` files, so a page per entry with
 * twelve entries is budgeted as thirteen pages and not as one.
 */
const PER_PAGE_GZIP_BYTES = 4 * 1024;

const FIXTURES_DIR = join(import.meta.dirname, "..", "fixtures");
const DOCUMENTS_DIR = join(FIXTURES_DIR, "documents");

let failed = false;

/**
 * One site, weighed: the page, the bytes we author, the photographs, and the whole download.
 *
 * `photographs` names the asset keys that are photographs rather than something we drew, so the
 * budget above can be applied to what it was chosen for. A bundle puts every asset under `assets/`
 * keyed by its own base name, which is what lets a path be matched back to the `src` it came from.
 */
function weigh(
  label: string,
  document: RetorikaDocument,
  assets: Map<string, Uint8Array>,
  photographs: ReadonlySet<string>,
): void {
  const { html } = render(document, "html");

  const bytes = gzipSync(Buffer.from(html, "utf8")).length;
  const kb = (bytes / 1024).toFixed(1);

  // Zero JavaScript unless a section genuinely needs it. No cover variant does, so any
  // script tag here is a regression rather than a judgement call.
  const scripts = (html.match(/<script\b/gi) ?? []).length;

  const bundle = buildSite(document, {
    siteId: "size",
    assets,
    fonts: readFontBundle(document),
  });

  const photoNames = new Set([...photographs].map((src) => basename(src)));
  let bundleBytes = 0;
  let fontBytes = 0;
  let photoBytes = 0;
  // **Every emitted page against the page budget, not only the home page.** Until 13 October 2026
  // only `render(document, "html")` — the first page — was weighed, so a second page, let alone a
  // page drawn once per entry (ADR 0040), was never seen by this number. The heaviest file is what
  // the budget is held to, and it is named when it is not the home page.
  let pages = 0;
  let heaviest = { path: "index.html", bytes };
  for (const bundled of bundle.files) {
    const size = gzipSync(Buffer.from(bundled.contents)).length;
    bundleBytes += size;
    if (bundled.path.startsWith("fonts/")) fontBytes += size;
    if (bundled.path.startsWith("assets/") && photoNames.has(basename(bundled.path))) {
      photoBytes += size;
    }
    if (bundled.path.endsWith(".html")) {
      pages += 1;
      if (size > heaviest.bytes) heaviest = { path: bundled.path, bytes: size };
    }
  }
  const ourBytes = bundleBytes - photoBytes;
  const bundleBudget = MAX_BUNDLE_GZIP_BYTES + PER_PAGE_GZIP_BYTES * Math.max(0, pages - 1);

  const over = heaviest.bytes > MAX_GZIP_BYTES;
  const overBundle = ourBytes > bundleBudget;
  const withScript = scripts > 0;
  if (over || overBundle || withScript) failed = true;

  const status = over || overBundle || withScript ? "FAIL" : "ok";
  const fonts = fontBytes === 0 ? "no fonts" : `${(fontBytes / 1024).toFixed(1)} KB of fonts`;
  const photos =
    photoNames.size === 0
      ? "no photographs"
      : `${(photoBytes / 1024).toFixed(1)} KB in ${photoNames.size} photograph(s)`;
  const pageNote =
    pages > 1
      ? ` (${pages} pages, heaviest ${heaviest.path} ${(heaviest.bytes / 1024).toFixed(1)} KB, ` +
        `budget ${(bundleBudget / 1024).toFixed(0)} KB)`
      : "";
  console.log(
    `${status.padEnd(4)} ${label.padEnd(38)} ${kb.padStart(6)} KB page   ` +
      `${(ourBytes / 1024).toFixed(1).padStart(6)} KB ours   ` +
      `${(bundleBytes / 1024).toFixed(1).padStart(6)} KB total   ` +
      `${scripts} script tag(s)   ${fonts}   ${photos}${pageNote}`,
  );
}

/** The corpus: what we author, with the stand-in assets it references read from `fixtures/`. */
for (const file of readdirSync(DOCUMENTS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  const document = parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, file), "utf8")));
  const assets = new Map<string, Uint8Array>();
  for (const page of document.pages) {
    for (const section of page.sections) {
      for (const el of flattenElements(section.content)) {
        if (el.value?.kind !== "image" || el.value.src.startsWith("data:")) continue;
        assets.set(el.value.src, new Uint8Array(readFileSync(join(FIXTURES_DIR, el.value.src))));
      }
    }
  }
  weigh(file, document, assets, new Set());
}

/**
 * **A real generated site of every sector that has photographs**, which is what the corpus could
 * never be.
 *
 * Generator output rather than a hand-written fixture, and the difference is not stylistic: the
 * number this prints is the one an owner of that sector downloads, and it cannot drift from what
 * the generator produces because it *is* what the generator produced. A fixture imitating a
 * generated site would also have forced four asset resolvers — this script and the publisher's
 * three bundle suites — to learn how to read the bank, for a document that is a copy of something
 * the generator can hand over for free.
 *
 * The three compositions are all weighed, because they are three different documents and «Con foto
 * grande» is the one that shows the photograph largest. The business name is fixed, so the
 * photograph the bank picks is fixed too: the generator has no clock and no randomness, which is
 * what makes a weight budget over it meaningful at all.
 */
const EXAMPLE_NAME = "Taberna del Puerto";

for (const sector of sectorsInBank().filter(hasSamplePhotos).sort()) {
  const answers = {
    ...EMPTY_ANSWERS,
    businessName: EXAMPLE_NAME,
    sector: sector as (typeof EMPTY_ANSWERS)["sector"],
    services: ["Comidas", "Cenas", "Terraza"],
    address: "Muelle 3, Ronda",
    mainAction: "book" as const,
    bookingLink: "https://reservas.example.com/taberna",
  };
  for (const variant of VARIANTS) {
    const site = generate(answers, variant);
    const assets = new Map<string, Uint8Array>();
    const photographs = new Set<string>();
    for (const page of site.document.pages) {
      for (const section of page.sections) {
        for (const el of flattenElements(section.content)) {
          if (el.value?.kind !== "image" || el.value.src.startsWith("data:")) continue;
          // A `sample` that resolves to a bank record is a photograph; the catalog's marker
          // resolves to nothing and is a `data:` URI anyway, so it never reaches here.
          const record = el.value.sample === undefined ? undefined : recordById(el.value.sample);
          if (!record) {
            throw new Error(`size-budget: ${el.value.src} is neither a bank sample nor inline`);
          }
          assets.set(el.value.src, readSampleBytes(record.id));
          photographs.add(el.value.src);
        }
      }
    }
    weigh(`${sector} · ${variant.id} ${variant.cover}`, site.document, assets, photographs);
  }
}

console.log(
  `\nBudget: ${MAX_GZIP_BYTES / 1024} KB gzipped per emitted page and ` +
    `${MAX_BUNDLE_GZIP_BYTES / 1024} KB of our own bytes per bundle, ` +
    `plus ${PER_PAGE_GZIP_BYTES / 1024} KB per page after the first, zero JavaScript.\n` +
    "Photographs are reported, not budgeted here: the bank caps each approved one at " +
    "200 KB (`MAX_IMAGE_BYTES`), and an owner's own photo is the owner's.",
);

if (failed) {
  console.error("\nA weight budget was exceeded.");
  process.exit(1);
}
