import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Browser, Page } from "@playwright/test";
import { CATALOG, COVER_ID, COVER_VARIANTS } from "@retorika/catalog";
import { type ContentElement, parseDocument, type RetorikaDocument } from "@retorika/schema";
import { buildTheme, PALETTES, TYPE_PAIRS } from "@retorika/tokens";
import { render } from "../src/index.ts";
import { ASSETS_DIR, DOCUMENTS_DIR } from "./corpus.ts";

/**
 * The matrix the browser suites run over, and the page they run it in.
 *
 * Part 8.5, as amended: every preset, every variant and every palette. Type pairs are in the
 * matrix too, because contrast does not depend on the font but overflow does — a wider face
 * is exactly what pushes a heading past 320 pixels.
 */

export interface Combination {
  /** Stable, human-readable: "cover/image-right/dark-slate/modern-sans". */
  id: string;
  catalogId: string;
  variantId: string;
  paletteId: string;
  typePairId: string;
  document: RetorikaDocument;
}

/**
 * A preset's variants, and the content that exercises every slot it declares, built from the
 * base fixture's content.
 *
 * Keyed by catalog id and checked against CATALOG below: a new preset that is not listed here
 * makes allCombinations() throw, rather than quietly leaving the matrix one preset short.
 */
const PRESET_CASES: Record<
  string,
  { variants: readonly string[]; content: (base: readonly ContentElement[]) => ContentElement[] }
> = {
  [COVER_ID]: {
    variants: COVER_VARIANTS,
    content: (base) => [...base, ...secondaryActions()],
  },
};

/**
 * The fixture fills every cover slot except secondaryAction, which admits two links. Added
 * here rather than in the fixture, which is golden input: without them the harness would never
 * measure the colour of a plain link, which is the one text colour the stylesheet leaves to
 * the browser.
 */
function secondaryActions(): ContentElement[] {
  const link = (id: string, text: string, href: string): ContentElement => ({
    id,
    role: "link",
    hidden: false,
    slot: "secondaryAction",
    value: { kind: "link", text, href },
  });
  return [
    link("el-secondary-1", "Ver servicios", "#servicios"),
    link("el-secondary-2", "Cómo llegar", "#contacto"),
  ];
}

function baseDocument(): RetorikaDocument {
  const raw: unknown = JSON.parse(
    readFileSync(join(DOCUMENTS_DIR, "barbershop-cover.json"), "utf8"),
  );
  return parseDocument(raw);
}

/** Every preset x every variant x every palette (x every type pair). This is Part 8.5, as code. */
export function allCombinations(): Combination[] {
  const base = baseDocument();
  const [page] = base.pages;
  const [section] = page?.sections ?? [];
  if (!page || !section) throw new Error("the base fixture has no section");

  const combinations: Combination[] = [];
  for (const catalogId of Object.keys(CATALOG).sort()) {
    const preset = PRESET_CASES[catalogId];
    if (!preset) {
      throw new Error(
        `Catalog preset "${catalogId}" has no entry in browser-fixtures.ts, so no browser check covers it`,
      );
    }
    for (const variantId of preset.variants) {
      for (const palette of PALETTES) {
        for (const typePair of TYPE_PAIRS) {
          const id = [catalogId, variantId, palette.id, typePair.id].join("/");
          // Parsed, not cast: a combination that is not a valid document is a bug in this
          // generator, and it must fail here rather than be reported as a finding.
          const document = parseDocument({
            ...base,
            theme: buildTheme({ paletteId: palette.id, typePairId: typePair.id }),
            pages: [
              {
                ...page,
                sections: [
                  {
                    ...section,
                    preset: { catalogId, variantId },
                    source: "catalog",
                    layout: null,
                    content: preset.content(section.content),
                  },
                ],
              },
            ],
          });
          combinations.push({
            id,
            catalogId,
            variantId,
            paletteId: palette.id,
            typePairId: typePair.id,
            document,
          });
        }
      }
    }
  }
  return combinations;
}

/** A made-up origin the page is served from; nothing ever resolves it over the network. */
const ORIGIN = "http://site.test";

const ASSET_TYPES: Readonly<Record<string, string>> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/**
 * The published page at a given width, with its images.
 *
 * Served through routes rather than page.setContent: setContent has no base URL, so the
 * page's relative "assets/..." images would not load, and axe would then measure the text of
 * image-background against the plain surface and pass it without having compared anything.
 * Every request outside ORIGIN is aborted, so the run needs no network.
 *
 * The HTML is exactly render(doc, "html"), the same bytes the golden corpus stores.
 */
export async function openCombination(
  browser: Browser,
  combination: Combination,
  width: number,
): Promise<Page> {
  const html = render(combination.document, "html").html;
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/") {
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    }
    if (url.pathname.startsWith("/assets/")) {
      const name = basename(url.pathname);
      const contentType = ASSET_TYPES[name.slice(name.lastIndexOf(".") + 1)];
      if (!contentType) throw new Error(`no content type for asset ${name}`);
      return route.fulfill({ contentType, body: readFileSync(join(ASSETS_DIR, name)) });
    }
    return route.fulfill({ status: 404, body: "" });
  });

  const response = await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  if (response?.status() !== 200) throw new Error(`${combination.id}: page did not load`);
  // An image that silently failed would change both layout and contrast; fail instead.
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src),
  );
  if (broken.length > 0)
    throw new Error(`${combination.id}: images did not load: ${broken.join(", ")}`);
  return page;
}

/** Closes the page's own context, which is what openCombination created. */
export async function closeCombination(page: Page): Promise<void> {
  await page.context().close();
}
