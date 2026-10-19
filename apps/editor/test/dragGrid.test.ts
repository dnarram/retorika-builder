import { describe, expect, it } from "vitest";
import { MAX_ROW } from "../src/editor/designTree.ts";
import {
  cellAt,
  columnWidth,
  dropAt,
  type GridMetrics,
  overlaps,
  rectOf,
} from "../src/editor/dragGrid.ts";

/**
 * Where a dragged element lands and whether it may (ADR 0048, sprint 24 día 8).
 *
 * The numbers below are a real section's: a 1040px canvas with `var(--space-xl)` padding either
 * side and `var(--space-md)` gaps, which is 944px of content, a 24px gap and so a 58.67px column.
 * Rows are three of the heights a cover actually has — a headline, a photograph, a button.
 */

const metrics: GridMetrics = {
  left: 48,
  top: 48,
  width: 944,
  columnGap: 24,
  rowGap: 24,
  rows: [56, 320, 44],
};

/** The left edge of a column, in frame coordinates — the arithmetic the module does backwards. */
const columnLeft = (column: number) =>
  metrics.left + (column - 1) * (columnWidth(metrics) + metrics.columnGap);

/** The top edge of a row, in frame coordinates. */
const rowTop = (row: number) =>
  metrics.top +
  metrics.rows.slice(0, row - 1).reduce((total, height) => total + height + metrics.rowGap, 0);

const place = (
  elementId: string,
  column: number,
  columnSpan: number,
  row: number,
  rowSpan: number,
) => ({ elementId, column, columnSpan, row, rowSpan });

describe("columnWidth", () => {
  it("takes the eleven gaps out before dividing by twelve", () => {
    // 944 - 11×24 = 680, over twelve.
    expect(columnWidth(metrics)).toBeCloseTo(56.67, 1);
  });

  it("never goes negative on a section narrower than its own gaps", () => {
    expect(columnWidth({ ...metrics, width: 40 })).toBe(0);
  });
});

describe("cellAt", () => {
  it("lands on the column and row whose corner the point is on", () => {
    for (const column of [1, 2, 7, 12]) {
      for (const row of [1, 2, 3]) {
        expect(
          cellAt({ x: columnLeft(column), y: rowTop(row) }, metrics),
          `${column}/${row}`,
        ).toEqual({ column, row });
      }
    }
  });

  it("pulls to the nearest column, which is what «imán» means", () => {
    const step = columnWidth(metrics) + metrics.columnGap;
    // A third of the way into column 3's band is still column 3 …
    expect(cellAt({ x: columnLeft(3) + step * 0.3, y: rowTop(1) }, metrics).column).toBe(3);
    // … and two thirds of the way is column 4. Flooring would answer 3 to both, which reads as the
    // drag resisting the hand.
    expect(cellAt({ x: columnLeft(3) + step * 0.7, y: rowTop(1) }, metrics).column).toBe(4);
  });

  it("pulls to the nearest row, with rows of their own measured heights", () => {
    // Row 2 is 320px tall. A quarter of the way down it is still row 2; past the middle it is row 3.
    expect(cellAt({ x: columnLeft(1), y: rowTop(2) + 80 }, metrics).row).toBe(2);
    expect(cellAt({ x: columnLeft(1), y: rowTop(2) + 300 }, metrics).row).toBe(3);
  });

  it("answers the row after the last one for a point below the section's content", () => {
    // How a section grows: three rows, so a drop under them is row 4. Whether it is allowed is
    // `dropAt`'s question, not this one's.
    expect(cellAt({ x: columnLeft(1), y: rowTop(3) + 400 }, metrics).row).toBe(4);
  });

  it("clamps rather than inventing a thirteenth column or a row zero", () => {
    expect(cellAt({ x: 10_000, y: rowTop(1) }, metrics).column).toBe(12);
    expect(cellAt({ x: -500, y: -500 }, metrics)).toEqual({ column: 1, row: 1 });
    // A point far below a three-row section is **row four**, not row twenty-four: the rows that
    // exist are the only ones to be near, and the one after them is how a section grows. The clamp
    // below is the backstop, and it needs a section deep enough to reach it.
    expect(cellAt({ x: columnLeft(1), y: 1_000_000 }, metrics).row).toBe(4);
    const deep = { ...metrics, rows: Array.from({ length: MAX_ROW + 6 }, () => 40) };
    expect(cellAt({ x: columnLeft(1), y: 1_000_000 }, deep).row).toBe(MAX_ROW);
  });

  it("puts everything in the first cell of a section with nothing in it", () => {
    const empty = { ...metrics, rows: [] };
    expect(cellAt({ x: columnLeft(1), y: metrics.top + 500 }, empty)).toEqual({
      column: 1,
      row: 1,
    });
  });
});

describe("overlaps", () => {
  it("is true only when the two rectangles share a cell", () => {
    const a = place("a", 1, 6, 1, 1);
    expect(overlaps(a, place("b", 7, 6, 1, 1))).toBe(false); // beside it
    expect(overlaps(a, place("b", 1, 6, 2, 1))).toBe(false); // under it
    expect(overlaps(a, place("b", 6, 6, 1, 1))).toBe(true); // one column into it
    expect(overlaps(a, place("b", 1, 12, 1, 3))).toBe(true); // over all of it
  });

  it("touching edges do not overlap, in either direction", () => {
    // The cell after the last one a span covers: 1+6 = 7, so column 7 is free.
    expect(overlaps(place("a", 1, 6, 1, 2), place("b", 7, 1, 1, 1))).toBe(false);
    expect(overlaps(place("a", 1, 6, 1, 2), place("b", 1, 1, 3, 1))).toBe(false);
  });
});

describe("dropAt", () => {
  /**
   * Four columns of headline on the left and four of photograph on the right, with **four free in
   * between** — which is what the self-overlap case needs: an element with nowhere to go cannot
   * show that moving it one column is allowed, it can only show that the cell beside it is taken.
   * The first fixture here had the photograph at column 7 and proved the wrong thing.
   */
  const headline = place("el-headline", 1, 4, 1, 1);
  const photo = place("el-photo", 9, 4, 1, 2);
  const section = [headline, photo];

  it("**moves an element one column right over its own cells, and accepts it**", () => {
    /**
     * David's own case, given when he approved the plan: «Moverlo una columna a la derecha solapa
     * sus propias celdas y no debe rechazarse.» The exclusion is by element id and happens inside
     * `dropAt`, so a caller cannot forget it — and this is the commonest drag there is.
     */
    const step = columnWidth(metrics) + metrics.columnGap;
    const drop = dropAt({
      metrics,
      at: { x: columnLeft(1) + step, y: rowTop(1) },
      moving: headline,
      placements: section,
    });
    expect(drop).toEqual({ kind: "place", at: { column: 2, columnSpan: 4, row: 1, rowSpan: 1 } });
  });

  it("**refuses a partial overlap with another element, and says why**", () => {
    // The second of the two cases David asked for. Column 8 with a span of 4 reaches column 11, and
    // the photograph holds 9 to 12: three cells in common, which is enough.
    const drop = dropAt({
      metrics,
      at: { x: columnLeft(8), y: rowTop(1) },
      moving: headline,
      placements: section,
    });
    expect(drop.kind).toBe("refuse");
    expect(drop).toMatchObject({ why: "occupied" });
    // And the refusal still carries the cell it was aiming at, because the ghost has to draw the
    // result it is refusing — not disappear and leave the element to come back unexplained.
    expect(drop.at).toEqual({ column: 8, columnSpan: 4, row: 1, rowSpan: 1 });
  });

  it("keeps the element's spans: a drag moves it, it never resizes it", () => {
    const drop = dropAt({
      metrics,
      at: { x: columnLeft(1), y: rowTop(3) },
      moving: photo,
      placements: section,
    });
    expect(drop).toEqual({ kind: "place", at: { column: 1, columnSpan: 4, row: 3, rowSpan: 2 } });
  });

  it("clamps at the right edge instead of refusing, because overshooting means «as far as it goes»", () => {
    const drop = dropAt({
      metrics,
      at: { x: 10_000, y: rowTop(3) },
      moving: headline,
      placements: section,
    });
    // 13 − 4 = 9 is where a four-column element may still start.
    expect(drop).toEqual({ kind: "place", at: { column: 9, columnSpan: 4, row: 3, rowSpan: 1 } });
  });

  it("lets a section grow by a row, which is what dropping under it means", () => {
    const drop = dropAt({
      metrics,
      at: { x: columnLeft(1), y: rowTop(3) + 400 },
      moving: headline,
      placements: section,
    });
    expect(drop).toEqual({ kind: "place", at: { column: 1, columnSpan: 4, row: 4, rowSpan: 1 } });
  });

  it("refuses past the interface's own floor rather than clamping into it", () => {
    // A tall section: `MAX_ROW` rows already, so there is no row after them for a one-row element.
    const deep: GridMetrics = { ...metrics, rows: Array.from({ length: MAX_ROW }, () => 40) };
    const drop = dropAt({
      metrics: deep,
      at: { x: columnLeft(1), y: 1_000_000 },
      moving: place("el-headline", 1, 6, 1, 2),
      placements: [place("el-headline", 1, 6, 1, 2)],
    });
    expect(drop).toMatchObject({ kind: "refuse", why: "rows" });
  });

  it("drops into a free cell beside an element without touching it", () => {
    const drop = dropAt({
      metrics,
      at: { x: columnLeft(1), y: rowTop(2) },
      moving: headline,
      placements: section,
    });
    expect(drop).toEqual({ kind: "place", at: { column: 1, columnSpan: 4, row: 2, rowSpan: 1 } });
  });
});

describe("rectOf", () => {
  it("draws a one-cell area over that cell", () => {
    const rect = rectOf({ column: 2, columnSpan: 1, row: 2, rowSpan: 1 }, metrics);
    expect(rect.left).toBeCloseTo(columnLeft(2), 1);
    expect(rect.top).toBeCloseTo(rowTop(2), 1);
    expect(rect.width).toBeCloseTo(columnWidth(metrics), 1);
    expect(rect.height).toBe(320);
  });

  it("adds the gaps a span swallows, in both directions", () => {
    const rect = rectOf({ column: 1, columnSpan: 6, row: 1, rowSpan: 2 }, metrics);
    // Six columns and the five gaps between them.
    expect(rect.width).toBeCloseTo(columnWidth(metrics) * 6 + metrics.columnGap * 5, 1);
    // Two rows and the gap between them: 56 + 24 + 320.
    expect(rect.height).toBe(400);
  });

  it("gives the row a section would grow by the height of the last one it has", () => {
    const rect = rectOf({ column: 1, columnSpan: 2, row: 4, rowSpan: 1 }, metrics);
    expect(rect.top).toBeCloseTo(rowTop(3) + 44 + metrics.rowGap, 1);
    expect(rect.height).toBe(44);
  });
});
