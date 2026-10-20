import { describe, expect, it } from "vitest";
import { FINE_COLUMNS, type Placement, type RetorikaDocument, type Section } from "../src/index.ts";
import { overlappingTexts, overlaps } from "../src/overlapping.ts";
import { parseDocument } from "../src/parse.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * Text over text, which is the one overlap worth telling an owner about (ADR 0050 §6, día 5).
 *
 * Overlapping is allowed since día 3. David's condition when he decided it is what this file is:
 * «Texto sobre texto avisa […] no un bloqueo» — so the pair is found here, in the document, and the
 * editor's review before the download is what shows it.
 */

const theme = {
  ...(Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme),
  "space.md": "16px",
} as Theme;

/** A text of the fine grid, placed where the caller says. */
function text(id: string, slot: string, words: string, placement: Omit<Placement, "elementId">) {
  return {
    element: {
      id,
      role: slot === "headline" ? ("heading" as const) : ("body" as const),
      hidden: false,
      slot,
      value: { kind: "text" as const, text: words },
    },
    placement: { elementId: id, ...placement },
  };
}

function sectionOf(
  entries: readonly { element: Section["content"][number]; placement: Placement }[],
  extra: Partial<Section> = {},
): Section {
  return {
    id: "sec-cover",
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "free",
    layout: {
      grid: { columns: FINE_COLUMNS },
      placements: entries.map((entry) => entry.placement),
      breakpoints: { mobile: [] },
    },
    content: entries.map((entry) => entry.element),
    ...extra,
  } as Section;
}

function documentWith(section: Section): RetorikaDocument {
  return parseDocument({
    schemaVersion: "1.12.0",
    id: "doc-1",
    siteName: "Taberna",
    theme,
    collections: [],
    pages: [{ id: "home", slug: "index", title: "Taberna", sections: [section] }],
  });
}

describe("overlaps", () => {
  it("is true only when the two rectangles share a cell", () => {
    const a = { column: 1, columnSpan: 8, row: 1, rowSpan: 2 };
    expect(overlaps(a, { column: 8, columnSpan: 8, row: 1, rowSpan: 1 })).toBe(true);
    expect(overlaps(a, { column: 9, columnSpan: 8, row: 1, rowSpan: 1 })).toBe(false);
    expect(overlaps(a, { column: 1, columnSpan: 8, row: 3, rowSpan: 1 })).toBe(false);
  });

  it("touching edges do not overlap, in either direction", () => {
    // David's own definition from sprint 24, and the reason it is the whole rectangle on both
    // sides: an element in units 1..8 and one starting at 9 are neighbours, not a stack.
    const a = { column: 1, columnSpan: 8, row: 1, rowSpan: 1 };
    expect(overlaps(a, { column: 9, columnSpan: 8, row: 1, rowSpan: 1 })).toBe(false);
    expect(overlaps(a, { column: 1, columnSpan: 8, row: 2, rowSpan: 1 })).toBe(false);
  });

  it("is symmetric, which a one-sided comparison would not be", () => {
    const a = { column: 1, columnSpan: 48, row: 1, rowSpan: 7 };
    const b = { column: 25, columnSpan: 48, row: 4, rowSpan: 7 };
    expect(overlaps(a, b)).toBe(overlaps(b, a));
    expect(overlaps(a, b)).toBe(true);
  });
});

describe("overlappingTexts", () => {
  const headline = { column: 1, columnSpan: 48, row: 1, rowSpan: 7 };

  it("finds a pair of texts on top of each other, with the words of both", () => {
    const doc = documentWith(
      sectionOf([
        text("el-headline", "headline", "Taberna Santo Domingo", headline),
        text("el-body", "intro", "Comer, beber y volver", {
          column: 25,
          columnSpan: 48,
          row: 4,
          rowSpan: 7,
        }),
      ]),
    );
    expect(overlappingTexts(doc)).toEqual([
      {
        pageId: "home",
        sectionId: "sec-cover",
        first: { elementId: "el-headline", words: "Taberna Santo Domingo" },
        second: { elementId: "el-body", words: "Comer, beber y volver" },
      },
    ]);
  });

  it("says nothing about texts that only touch, which is the whole of «no avisa por nada»", () => {
    const doc = documentWith(
      sectionOf([
        text("el-headline", "headline", "Taberna", headline),
        // The row right after the headline's last, and the unit right after its last.
        text("el-body", "intro", "Comer", { column: 49, columnSpan: 48, row: 8, rowSpan: 3 }),
      ]),
    );
    expect(overlappingTexts(doc)).toEqual([]);
  });

  it("says nothing about a text over an image, because that is design", () => {
    // And the renderer even draws a panel behind those words so they stay legible (`panelArea`).
    // Warning about it would be warning about the commonest cover in the catalog.
    const doc = documentWith(
      sectionOf([
        {
          element: {
            id: "el-image",
            role: "image" as const,
            hidden: false,
            slot: "image",
            value: { kind: "image" as const, src: "photo.jpg", alt: "" },
          },
          placement: { elementId: "el-image", column: 1, columnSpan: 96, row: 1, rowSpan: 40 },
        },
        text("el-headline", "headline", "Taberna", headline),
      ]),
    );
    expect(overlappingTexts(doc)).toEqual([]);
  });

  it("says nothing about a text the page does not draw", () => {
    // Rule 3 keeps a hidden element so the place to fill it in still exists; the renderer draws
    // nothing for it, so there is nothing on top of anything.
    const shown = text("el-headline", "headline", "Taberna", headline);
    const hidden = text("el-body", "intro", "Comer", {
      column: 25,
      columnSpan: 48,
      row: 4,
      rowSpan: 7,
    });
    hidden.element.hidden = true;
    expect(overlappingTexts(documentWith(sectionOf([shown, hidden])))).toEqual([]);
    // And the sabotage: the same pair with both drawn is a finding, so the filter above is what
    // this test is measuring rather than a layout that never overlapped.
    hidden.element.hidden = false;
    expect(overlappingTexts(documentWith(sectionOf([shown, hidden])))).toHaveLength(1);
  });

  it("says nothing about a section the catalog draws, which holds no placements at all", () => {
    const doc = documentWith(
      sectionOf([text("el-headline", "headline", "Taberna", headline)], {
        source: "catalog",
        layout: null,
      }),
    );
    expect(overlappingTexts(doc)).toEqual([]);
  });

  it("lists every pair once, in document order", () => {
    // Three texts in the same place are three pairs, not six and not one: the review has to name
    // each collision, and naming one twice would read as two problems.
    const all = { column: 1, columnSpan: 48, row: 1, rowSpan: 7 };
    const doc = documentWith(
      sectionOf([
        text("el-a", "headline", "Uno", all),
        text("el-b", "intro", "Dos", all),
        text("el-c", "body", "Tres", all),
      ]),
    );
    expect(
      overlappingTexts(doc).map((pair) => `${pair.first.elementId}/${pair.second.elementId}`),
    ).toEqual(["el-a/el-b", "el-a/el-c", "el-b/el-c"]);
  });
});
