import { describe, expect, it } from "vitest";
import { FINE_COLUMNS, FINE_PER_COLUMN, GRID_COLUMNS, ROW_STEP_PX } from "../src/document.ts";
import {
  coarseToFine,
  FINE_TRACKS,
  fineColumnOf,
  fineSpanOf,
  fineTemplateColumns,
  fineTrack,
  fineTrackSpan,
  gapRowsFor,
  measuredToFine,
} from "../src/fineGrid.ts";

/**
 * The fine grid's arithmetic (ADR 0050), tested as arithmetic: no DOM, no renderer.
 *
 * What matters most is **the round trip through the gutters** — a unit becomes a track and the
 * track becomes the same unit again — and that a catalog column converts to the same pixels. The
 * renderer, the editor's drag and the walks all read these functions, so a wrong gutter here would
 * put an element in one place in the editor and another on the published page; a browser test in
 * `packages/renderer` measures that the two agree, and this file is why it should.
 */

describe("the constants", () => {
  it("are ninety-six units, eight to a catalog column, in steps of eight pixels", () => {
    expect(FINE_COLUMNS).toBe(96);
    expect(FINE_PER_COLUMN).toBe(8);
    expect(FINE_COLUMNS).toBe(GRID_COLUMNS * FINE_PER_COLUMN);
    expect(ROW_STEP_PX).toBe(8);
    // Ninety-six units and the eleven gutters between the twelve groups of eight.
    expect(FINE_TRACKS).toBe(107);
  });
});

describe("fineTrack", () => {
  it("puts the first eight units on the first eight tracks and skips a gutter after each group", () => {
    expect(fineTrack(1)).toBe(1);
    expect(fineTrack(8)).toBe(8);
    // Track 9 is the first gutter.
    expect(fineTrack(9)).toBe(10);
    expect(fineTrack(16)).toBe(17);
    expect(fineTrack(17)).toBe(19);
    expect(fineTrack(96)).toBe(107);
  });

  it("lands every catalog column on the line it was on with twelve columns and a gap", () => {
    // Column c of the catalog is unit (c − 1)·8 + 1; with a gutter per group that is CSS line
    // (c − 1)·9 + 1 — the same place `repeat(12, 1fr)` with `gap` draws column c, measured in
    // tracks rather than pixels.
    for (let column = 1; column <= GRID_COLUMNS; column += 1) {
      expect(fineTrack((column - 1) * FINE_PER_COLUMN + 1)).toBe((column - 1) * 9 + 1);
    }
  });

  it("refuses a unit outside the grid rather than extrapolating a track for it", () => {
    expect(() => fineTrack(0)).toThrow(/outside 1\.\.96/);
    expect(() => fineTrack(97)).toThrow(/outside 1\.\.96/);
    expect(() => fineTrack(1.5)).toThrow(/outside 1\.\.96/);
  });
});

describe("fineTrackSpan", () => {
  it("is the span itself while it stays inside one group of eight", () => {
    expect(fineTrackSpan(1, 8)).toBe(8);
    expect(fineTrackSpan(3, 2)).toBe(2);
  });

  it("takes the gutters it crosses with it, which is what keeps a catalog width a catalog width", () => {
    // Six catalog columns: forty-eight units plus the five gutters between them.
    expect(fineTrackSpan(1, 48)).toBe(53);
    // The full width: every unit and every gutter.
    expect(fineTrackSpan(1, 96)).toBe(107);
    // Two units either side of a gutter.
    expect(fineTrackSpan(8, 2)).toBe(3);
  });

  it("refuses a span that runs past the last unit", () => {
    expect(() => fineTrackSpan(90, 8)).toThrow(/outside 1\.\.96/);
  });
});

describe("fineColumnOf and fineSpanOf — the way back", () => {
  it("round-trips every unit through its track", () => {
    for (let column = 1; column <= FINE_COLUMNS; column += 1) {
      expect(fineColumnOf(fineTrack(column)), `unit ${column}`).toBe(column);
    }
  });

  it("round-trips every span from every start, gutters and all", () => {
    for (let column = 1; column <= FINE_COLUMNS; column += 7) {
      for (let span = 1; column + span - 1 <= FINE_COLUMNS; span += 5) {
        expect(
          fineSpanOf(fineTrack(column), fineTrackSpan(column, span)),
          `unit ${column} span ${span}`,
        ).toBe(span);
      }
    }
  });

  it("refuses a gutter, because no placement starts or ends on one", () => {
    expect(() => fineColumnOf(9)).toThrow(/gutter/);
    expect(() => fineColumnOf(18)).toThrow(/gutter/);
    expect(() => fineColumnOf(108)).toThrow(/outside 1\.\.107/);
  });
});

describe("fineTemplateColumns", () => {
  it("declares eleven groups of eight units and a gutter, then the last eight", () => {
    const css = fineTemplateColumns();
    expect(css.startsWith("repeat(11, ")).toBe(true);
    expect(css.match(/minmax\(0, 1fr\)/g)).toHaveLength(16);
    expect(css.match(/var\(--space-md\)/g)).toHaveLength(1);
    // Resolved, that is 107 tracks: 11 × 9 and the trailing 8.
    expect(11 * 9 + 8).toBe(FINE_TRACKS);
  });

  it("floors every unit at zero, so a long word cannot widen the unit it sits in", () => {
    expect(fineTemplateColumns()).not.toMatch(/(^|[^(,] )1fr/);
  });
});

describe("gapRowsFor", () => {
  it("is how many eight-pixel rows stand for the theme's space.md", () => {
    expect(gapRowsFor("16px")).toBe(2);
    expect(gapRowsFor("24px")).toBe(3);
    // The compact scale's 12px rounds to two rows (16px), which is the ±4 px the ADR names.
    expect(gapRowsFor("12px")).toBe(2);
    expect(gapRowsFor("0px")).toBe(0);
  });

  it("refuses anything that is not a pixel length, rather than guessing a rhythm", () => {
    expect(() => gapRowsFor("1rem")).toThrow(/pixel length/);
    expect(() => gapRowsFor(undefined)).toThrow(/pixel length/);
    expect(() => gapRowsFor("space.md-x")).toThrow(/pixel length/);
  });
});

describe("measuredToFine", () => {
  const place = (column: number, columnSpan: number) => ({
    elementId: "el",
    column,
    columnSpan,
    row: 1,
    rowSpan: 1,
  });

  it("converts the columns exactly and reads the rows off the pixels", () => {
    // A headline 92px tall sitting 100px down the section's content box: row 1 + round(100/8) = 14,
    // and ceil(92/8) = 12 rows of span.
    expect(measuredToFine(place(6, 7), { top: 100, height: 92 })).toEqual({
      elementId: "el",
      column: 41,
      columnSpan: 56,
      row: 14,
      rowSpan: 12,
    });
  });

  it("puts the top row where the element started, within half a row", () => {
    // The whole «no se mueve nada al empezar» claim, as arithmetic: the worst case is four pixels.
    for (let top = 0; top <= 1600; top += 1) {
      const { row } = measuredToFine(place(1, 1), { top, height: 24 });
      expect(Math.abs((row - 1) * ROW_STEP_PX - top), `top ${top}`).toBeLessThanOrEqual(
        ROW_STEP_PX / 2,
      );
    }
  });

  /**
   * **The span never leaves the content taller than its area**, which is why it ceils where the row
   * rounds. A span four pixels short would make its rows grow past the eight-pixel minimum, and
   * every element below would be pushed down by somebody else's rounding — an error that adds up
   * down the section instead of staying under four pixels.
   */
  it("never asks for fewer pixels than the element had", () => {
    for (let height = 0; height <= 800; height += 1) {
      const { rowSpan } = measuredToFine(place(1, 1), { top: 0, height });
      expect(rowSpan * ROW_STEP_PX, `height ${height}`).toBeGreaterThanOrEqual(height);
      expect(rowSpan).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives an element with no height a row of its own rather than none", () => {
    expect(measuredToFine(place(1, 12), { top: 0, height: 0 })).toMatchObject({
      row: 1,
      rowSpan: 1,
    });
  });

  it("clamps an element drawn above its own section to the first row", () => {
    expect(measuredToFine(place(1, 1), { top: -40, height: 20 })).toMatchObject({ row: 1 });
  });

  it("refuses a box that is not finite pixels, rather than writing NaN into a document", () => {
    expect(() => measuredToFine(place(1, 1), { top: Number.NaN, height: 10 })).toThrow(
      /finite pixels/,
    );
    expect(() => measuredToFine(place(1, 1), { top: 0, height: -1 })).toThrow(/finite pixels/);
  });
});

describe("coarseToFine", () => {
  const place = (column: number, columnSpan: number, row: number, rowSpan: number) => ({
    elementId: "el",
    column,
    columnSpan,
    row,
    rowSpan,
  });

  it("is exact sideways for every valid catalog placement", () => {
    for (let column = 1; column <= GRID_COLUMNS; column += 1) {
      for (let span = 1; column + span - 1 <= GRID_COLUMNS; span += 1) {
        const fine = coarseToFine(place(column, span, 1, 1), 2);
        expect(fine.column).toBe((column - 1) * 8 + 1);
        expect(fine.columnSpan).toBe(span * 8);
        // And the fine placement draws on the lines the catalog's did.
        expect(fineTrack(fine.column)).toBe((column - 1) * 9 + 1);
        expect(fineTrackSpan(fine.column, fine.columnSpan)).toBe(span * 9 - 1);
      }
    }
  });

  it("follows each content row with the empty rows that stand for its gap", () => {
    // Rows 1, 2, 3 of the catalog become fine rows 1, 4, 7 with two gap rows between each pair.
    expect(coarseToFine(place(1, 12, 1, 1), 2)).toMatchObject({ row: 1, rowSpan: 1 });
    expect(coarseToFine(place(1, 12, 2, 1), 2)).toMatchObject({ row: 4, rowSpan: 1 });
    expect(coarseToFine(place(1, 12, 3, 1), 2)).toMatchObject({ row: 7, rowSpan: 1 });
    // A photograph over rows 1–3 covers its three rows and the two gaps between them: seven.
    expect(coarseToFine(place(1, 5, 1, 3), 2)).toMatchObject({ row: 1, rowSpan: 7 });
    // The generous scale's three gap rows.
    expect(coarseToFine(place(1, 12, 2, 2), 3)).toMatchObject({ row: 5, rowSpan: 5 });
    // No gap at all: rows are rows.
    expect(coarseToFine(place(1, 12, 3, 2), 0)).toMatchObject({ row: 3, rowSpan: 2 });
  });

  it("keeps the element id and refuses a rhythm that is not a whole number", () => {
    expect(coarseToFine(place(2, 3, 1, 1), 2).elementId).toBe("el");
    expect(() => coarseToFine(place(1, 1, 1, 1), -1)).toThrow(/gapRows/);
    expect(() => coarseToFine(place(1, 1, 1, 1), 1.5)).toThrow(/gapRows/);
  });
});
