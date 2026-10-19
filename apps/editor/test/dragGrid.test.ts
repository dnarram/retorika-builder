import { describe, expect, it } from "vitest";
import { MAX_ROW } from "../src/editor/designTree.ts";
import {
  announceText,
  arrowAction,
  arrowDrop,
  cellAt,
  columnWidth,
  dropAt,
  type GridMetrics,
  overlaps,
  rectOf,
  reorderAt,
} from "../src/editor/dragGrid.ts";
import type { KeyPress } from "../src/editor/shortcuts.ts";

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

describe("arrowAction", () => {
  const press = (key: string, modifiers: Partial<KeyPress> = {}): KeyPress => ({
    key,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...modifiers,
  });

  it("moves one cell per bare arrow, in both axes", () => {
    expect(arrowAction(press("ArrowLeft"))).toEqual({ kind: "move", column: -1, row: 0 });
    expect(arrowAction(press("ArrowRight"))).toEqual({ kind: "move", column: 1, row: 0 });
    expect(arrowAction(press("ArrowUp"))).toEqual({ kind: "move", column: 0, row: -1 });
    expect(arrowAction(press("ArrowDown"))).toEqual({ kind: "move", column: 0, row: 1 });
  });

  it("widens and narrows with Shift, sideways only", () => {
    // **This is the clause that amends ADR 0047 §1**, and only in the chosen state: there is no
    // caret there, so «Shift+Arrow is a selection gesture everywhere» does not apply.
    expect(arrowAction(press("ArrowRight", { shiftKey: true }))).toEqual({
      kind: "span",
      columns: 1,
    });
    expect(arrowAction(press("ArrowLeft", { shiftKey: true }))).toEqual({
      kind: "span",
      columns: -1,
    });
    // Vertical with Shift does nothing: a row's height is its content's, and `rowSpan` belongs to
    // the panel's own stepper. Half a pair here would read as the other half being broken.
    expect(arrowAction(press("ArrowDown", { shiftKey: true }))).toEqual({ kind: "none" });
    expect(arrowAction(press("ArrowUp", { shiftKey: true }))).toEqual({ kind: "none" });
  });

  it("takes nothing with Alt, Meta or Control, nor any other key", () => {
    for (const modifier of ["altKey", "metaKey", "ctrlKey"] as const) {
      expect(arrowAction(press("ArrowRight", { [modifier]: true })), modifier).toEqual({
        kind: "none",
      });
    }
    for (const key of ["Enter", "Escape", "a", "Tab", " "]) {
      expect(arrowAction(press(key)), key).toEqual({ kind: "none" });
    }
  });
});

describe("arrowDrop", () => {
  const headline = place("el-headline", 1, 4, 1, 1);
  const photo = place("el-photo", 9, 4, 1, 2);
  const section = [headline, photo];

  it("moves one cell, keeping the spans", () => {
    expect(
      arrowDrop({
        moving: headline,
        placements: section,
        action: { kind: "move", column: 1, row: 0 },
      }),
    ).toEqual({ kind: "place", at: { column: 2, columnSpan: 4, row: 1, rowSpan: 1 } });
  });

  it("refuses the cell another element holds, with the same word the drag uses", () => {
    // One vocabulary and one refusal for the hand and the keyboard: otherwise the arrows would
    // quietly do what the drag is told it may not (ADR 0048 §4).
    const against = place("el-headline", 8, 4, 1, 1);
    expect(
      arrowDrop({
        moving: against,
        placements: [against, photo],
        action: { kind: "move", column: 1, row: 0 },
      }),
    ).toMatchObject({ kind: "refuse", why: "occupied" });
  });

  it("does nothing at the edges, rather than clamping a deliberate press", () => {
    expect(
      arrowDrop({
        moving: headline,
        placements: section,
        action: { kind: "move", column: -1, row: 0 },
      }),
    ).toEqual({ kind: "none" });
    expect(
      arrowDrop({
        moving: headline,
        placements: section,
        action: { kind: "move", column: 0, row: -1 },
      }),
    ).toEqual({ kind: "none" });
    // Nine columns wide starting at nine would reach seventeen.
    expect(
      arrowDrop({ moving: photo, placements: section, action: { kind: "span", columns: 1 } }),
    ).toEqual({ kind: "none" });
    // And one column cannot become none.
    const thin = place("el-thin", 1, 1, 6, 1);
    expect(
      arrowDrop({ moving: thin, placements: [thin], action: { kind: "span", columns: -1 } }),
    ).toEqual({ kind: "none" });
  });

  it("refuses past the interface's own floor on rows", () => {
    const low = place("el-low", 1, 2, MAX_ROW, 1);
    expect(
      arrowDrop({ moving: low, placements: [low], action: { kind: "move", column: 0, row: 1 } }),
    ).toEqual({ kind: "none" });
  });

  it("widens into free cells and refuses widening into a taken one", () => {
    const narrow = place("el-narrow", 1, 4, 1, 1);
    expect(
      arrowDrop({
        moving: narrow,
        placements: [narrow, photo],
        action: { kind: "span", columns: 1 },
      }),
    ).toEqual({ kind: "place", at: { column: 1, columnSpan: 5, row: 1, rowSpan: 1 } });
    const wide = place("el-wide", 1, 8, 1, 1);
    expect(
      arrowDrop({ moving: wide, placements: [wide, photo], action: { kind: "span", columns: 1 } }),
    ).toMatchObject({ kind: "refuse", why: "occupied" });
  });

  it("answers none to none, so a key nobody mapped changes nothing", () => {
    expect(arrowDrop({ moving: headline, placements: section, action: { kind: "none" } })).toEqual({
      kind: "none",
    });
  });
});

describe("announceText", () => {
  it("says where it went, in the words the owner's language uses", () => {
    expect(announceText({ column: 3, columnSpan: 4, row: 2, rowSpan: 1 }, "move")).toBe(
      "Columna 3 de 12, fila 2",
    );
  });

  it("says how wide it is when the width is what changed", () => {
    // Two sentences for two acts: a move that said «ancho 4» every time would bury the number that
    // changed under one that did not.
    expect(announceText({ column: 3, columnSpan: 5, row: 2, rowSpan: 1 }, "span")).toBe(
      "Ancho 5 de 12 columnas, desde la columna 3",
    );
  });
});

describe("reorderAt", () => {
  // Three elements stacked as a phone shows them, with a gap between each.
  const rows = [
    { elementId: "el-headline", top: 0, bottom: 60 },
    { elementId: "el-photo", top: 80, bottom: 380 },
    { elementId: "el-cta", top: 400, bottom: 444 },
  ];

  it("moves an element up when it is dragged above its own box", () => {
    expect(reorderAt({ rows, moving: "el-photo", y: -20 })).toEqual({
      kind: "moveUp",
      elementId: "el-photo",
    });
  });

  it("moves the neighbour below up when the element is dragged under its own box", () => {
    // Dragging down **is** the one below moving up: one verb, one history step, and no second
    // function in the schema to keep level with the first.
    expect(reorderAt({ rows, moving: "el-photo", y: 500 })).toEqual({
      kind: "moveUp",
      elementId: "el-cta",
    });
  });

  it("does nothing while the finger is still inside the element's own box", () => {
    // Which is also «sideways does nothing», because only `y` is read: rule 7 admits hiding,
    // reordering and narrowing, and there is no column on a phone to move between.
    // Inside **its own** box, which is 80 to 380 — not 0, which is the headline's own top edge and
    // is therefore «dragged above itself», as the first version of this list wrongly asserted.
    for (const y of [80, 200, 380]) {
      expect(reorderAt({ rows, moving: "el-photo", y }), String(y)).toEqual({ kind: "none" });
    }
  });

  it("does nothing at the ends, where there is nothing to trade places with", () => {
    expect(reorderAt({ rows, moving: "el-headline", y: -100 })).toEqual({ kind: "none" });
    expect(reorderAt({ rows, moving: "el-cta", y: 900 })).toEqual({ kind: "none" });
  });

  it("does nothing for an element the page is not showing", () => {
    expect(reorderAt({ rows, moving: "el-hidden", y: 900 })).toEqual({ kind: "none" });
  });
});
