import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import { presetFor } from "@retorika/catalog";
import {
  escalateSection,
  FINE_COLUMNS,
  FINE_PER_COLUMN,
  FINE_TRACKS,
  GRID_COLUMNS,
  parseDocument,
  type RetorikaDocument,
  ROW_STEP_PX,
} from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { ASSETS_DIR, DOCUMENTS_DIR } from "./corpus.ts";

/**
 * The fine grid, measured in the browser that resolves it (ADR 0050).
 *
 * `fineGrid.test.ts` proves the arithmetic and `fine-grid.test.ts` proves the emission; neither
 * can say what a track *is* in pixels. The three claims the sprint rests on are claims about
 * pixels: that escalating a section moves nothing sideways, that a unit is what the ADR's table
 * says it is, and that on a phone the eight-pixel rows do not open holes down the one column.
 */

const ORIGIN = "http://site.test";
const ASSET_TYPES: Readonly<Record<string, string>> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

function fixture(name: string): RetorikaDocument {
  return parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, `${name}.json`), "utf8")));
}

/** Every section of the document, designed by hand — the catalog's drawing copied in. */
function escalated(doc: RetorikaDocument): RetorikaDocument {
  let out = doc;
  for (const page of doc.pages) {
    for (const section of page.sections) {
      out = escalateSection(out, section.id, presetFor(section.preset.catalogId));
    }
  }
  return out;
}

async function open(doc: RetorikaDocument, width = 1280): Promise<Page> {
  const html = render(doc, "html").html;
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
      if (!contentType) throw new Error(`no content type for ${name}`);
      return route.fulfill({ contentType, body: readFileSync(join(ASSETS_DIR, name)) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  const response = await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  if (response?.status() !== 200) throw new Error("page did not load");
  return page;
}

interface Box {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The box of every placed element of a section, relative to the page. */
function boxesOf(page: Page, sectionId: string): Promise<Box[]> {
  return page.evaluate((id) => {
    const section = document.querySelector(`[data-section="${id}"]`);
    if (!section) throw new Error(`no section ${id}`);
    return [...section.querySelectorAll<HTMLElement>(":scope > [data-id]")].map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        id: el.dataset["id"] ?? "",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });
  }, sectionId);
}

function tracksOf(page: Page, sectionId: string): Promise<{ columns: number[]; gap: number }> {
  return page.evaluate((id) => {
    const section = document.querySelector(`[data-section="${id}"]`);
    if (!section) throw new Error(`no section ${id}`);
    const style = getComputedStyle(section);
    return {
      columns: style.gridTemplateColumns.split(" ").map((entry) => Number.parseFloat(entry)),
      gap: Number.parseFloat(style.getPropertyValue("--space-md")),
    };
  }, sectionId);
}

describe("escalating a section moves nothing sideways", () => {
  /**
   * The same document twice — once as the catalog draws it, once with every section designed by
   * hand — and every element's left edge and width compared. **Exact, not within a tolerance**,
   * because the fine grid keeps the catalog's twelve bands and eleven gutters as tracks and
   * `coarseToFine` is an integer multiplication; a difference here would be a wrong gutter.
   *
   * Vertically the claim is deliberately narrower and the ADR says why: the catalog's rows are
   * content-sized with a gap and the fine grid's are eight-pixel steps aligned to `start`, so a
   * short text beside a taller photograph sits at the top of its row rather than centred in it,
   * and the photograph's spare height is spread over more rows than before (measured on this cover:
   * the headline 27 px up, the button 27 px down, inside a 438 px photograph that did not move). So
   * the vertical is asserted only where it is exact — the next test, on a section with no such
   * photograph.
   */
  it("keeps every element's left edge and width to the pixel, across a whole site", async () => {
    const doc = fixture("cover-and-services");
    const before = await open(doc);
    const after = await open(escalated(doc));
    try {
      for (const page of doc.pages) {
        for (const section of page.sections) {
          const was = await boxesOf(before, section.id);
          const now = await boxesOf(after, section.id);
          expect(
            now.map((box) => box.id),
            section.id,
          ).toEqual(was.map((box) => box.id));
          for (const [index, box] of was.entries()) {
            const moved = now[index];
            expect(moved?.left, `${section.id}/${box.id} left`).toBeCloseTo(box.left, 0);
            expect(moved?.width, `${section.id}/${box.id} width`).toBeCloseTo(box.width, 0);
          }
        }
      }
    } finally {
      await before.context().close();
      await after.context().close();
    }
  });

  it("keeps a section of stacked texts exactly where it was, rows included", async () => {
    // The services section: a headline, a line and a list, one under the other — no photograph
    // spanning rows, so the rhythm `gapRowsFor` writes is the gap the catalog drew.
    const doc = fixture("cover-and-services");
    const before = await open(doc);
    const after = await open(escalated(doc));
    try {
      const was = await boxesOf(before, "sec-services");
      const now = await boxesOf(after, "sec-services");
      expect(was.length).toBeGreaterThan(1);
      for (const [index, box] of was.entries()) {
        expect(now[index]?.top, `${box.id} top`).toBeCloseTo(box.top, 0);
        expect(now[index]?.height, `${box.id} height`).toBeCloseTo(box.height, 0);
      }
    } finally {
      await before.context().close();
      await after.context().close();
    }
  });
});

describe("the unit, measured", () => {
  it("resolves to 107 tracks: equal units, and gutters of exactly the theme's gap", async () => {
    const page = await open(escalated(fixture("cover-and-services")));
    try {
      const { columns, gap } = await tracksOf(page, "sec-cover");
      expect(columns).toHaveLength(FINE_TRACKS);
      const units = columns.filter((_, index) => index % (FINE_PER_COLUMN + 1) !== FINE_PER_COLUMN);
      const gutters = columns.filter(
        (_, index) => index % (FINE_PER_COLUMN + 1) === FINE_PER_COLUMN,
      );
      expect(units).toHaveLength(FINE_COLUMNS);
      expect(gutters).toHaveLength(GRID_COLUMNS - 1);
      for (const gutter of gutters) expect(gutter).toBeCloseTo(gap, 1);
      // Every unit the same width, photograph or not — `minmax(0, 1fr)`, so an image with an
      // intrinsic width of its own cannot inflate the units it crosses (David's adjustment 2).
      const first = units[0] ?? 0;
      for (const unit of units) expect(unit).toBeCloseTo(first, 1);
      // And the ADR's table: at 1280 with the default scale, (1184 − 11·16) / 96.
      expect(first).toBeCloseTo((1280 - 2 * 48 - 11 * 16) / 96, 1);
    } finally {
      await page.context().close();
    }
  });

  it("gives an empty row exactly eight pixels where nothing spans it", async () => {
    // The services section: stacked, so the two rows that stand for each 16px gap hold nothing
    // and resolve to their minimum. In the cover a photograph spans them and they grow — the case
    // the ADR names, and the reason this is measured here and not there.
    const page = await open(escalated(fixture("cover-and-services")));
    try {
      const rows = await page.evaluate(() => {
        const section = document.querySelector('[data-section="sec-services"]');
        if (!section) throw new Error("no services");
        return getComputedStyle(section)
          .gridTemplateRows.split(" ")
          .map((e) => Number.parseFloat(e));
      });
      expect(rows.filter((height) => height === ROW_STEP_PX).length).toBeGreaterThanOrEqual(2);
      expect(Math.min(...rows)).toBe(ROW_STEP_PX);
    } finally {
      await page.context().close();
    }
  });
});

describe("on a phone the fine grid steps aside", () => {
  it("is one column with the theme's row gap, and no element overlaps another", async () => {
    const page = await open(escalated(fixture("cover-and-services")), 390);
    try {
      const { columns } = await tracksOf(page, "sec-cover");
      expect(columns).toHaveLength(1);
      const gaps = await page.evaluate(() => {
        const section = document.querySelector('[data-section="sec-cover"]');
        if (!section) throw new Error("no cover");
        const style = getComputedStyle(section);
        return { rowGap: style.rowGap, autoRows: style.gridAutoRows };
      });
      expect(gaps.rowGap).toBe("16px");
      expect(gaps.autoRows).toBe("auto");

      // Rule 7 reorders in one column, so no two boxes may intersect — David's condition for the
      // mobile walk, asserted here on the published page as well.
      const boxes = await boxesOf(page, "sec-cover");
      for (const a of boxes) {
        for (const b of boxes) {
          if (a.id === b.id) continue;
          const apart = a.top + a.height <= b.top + 1 || b.top + b.height <= a.top + 1;
          expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
        }
      }
    } finally {
      await page.context().close();
    }
  });
});
