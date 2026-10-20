import { FINE_COLUMNS, FINE_PER_COLUMN, fineTrack, GRID_COLUMNS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { MAX_ROW } from "../src/editor/designTree.ts";
import {
  ARROW_UNITS,
  announceText,
  arrowAction,
  arrowDrop,
  cellAt,
  dropAt,
  fineColumnAt,
  type GridMetrics,
  overlaps,
  reorderAt,
  rowAt,
} from "../src/editor/dragGrid.ts";
import type { KeyPress } from "../src/editor/shortcuts.ts";

/**
 * Where a dragged element lands on the fine grid (ADR 0050, sprint 25 día 3).
 *
 * **The numbers are a measured section's**, not invented: the editor's canvas at a window of 1440
 * with no panel open gives a section of 1168 px, 1072 of content, a gutter of 16 and therefore a
 * unit of (1072 − 11·16) / 96 = 9.333 px — the ADR's own table, read off Chromium on 20 October
 * 2026. The rows are the ones the probe printed for an escalated cover: a headline of 52, two empty
 * rows of eight, a tagline of 31, and so on. A module that divided `y` by eight would answer row 7
 * where this says row 2, which is the whole of David's adjustment 1.
 */

const UNIT = (1072 - 11 * 16) / FINE_COLUMNS;
const GUTTER = 16;

/** The 107 tracks a free section resolves to: eight units, a gutter, eight units … */
function fineTracks(unit: number, gutter: number): number[] {
  const tracks: number[] = [];
  for (let group = 0; group < GRID_COLUMNS; group += 1) {
    for (let step = 0; step < FINE_PER_COLUMN; step += 1) tracks.push(unit);
    if (group < GRID_COLUMNS - 1) tracks.push(gutter);
  }
  return tracks;
}

/** A cover as the editor measures it after escalating: content rows and the empty ones between. */
const ROWS = [52, 8, 8, 31, 8, 8, 20, 8, 8, 36, 8, 8, 8, 8, 8, 8];

const metrics: GridMetrics = {
  left: 48,
  top: 48,
  columns: fineTracks(UNIT, GUTTER),
  rows: ROWS,
};

/** The left edge of a fine unit, in frame coordinates — the arithmetic the module does backwards. */
function unitLeft(column: number): number {
  const tracks = metrics.columns.slice(0, fineTrack(column) - 1);
  return metrics.left + tracks.reduce((total, width) => total + width, 0);
}

/** The top edge of a row, in frame coordinates. */
function rowTop(row: number): number {
  return metrics.top + ROWS.slice(0, row - 1).reduce((total, height) => total + height, 0);
}

const place = (
  elementId: string,
  column: number,
  columnSpan: number,
  row: number,
  rowSpan: number,
) => ({ elementId, column, columnSpan, row, rowSpan });

describe("fineColumnAt", () => {
  it("answers the unit whose own left edge the point is on", () => {
    for (const column of [1, 2, 8, 9, 48, 89, 96]) {
      expect(fineColumnAt(unitLeft(column), metrics), `unit ${column}`).toBe(column);
    }
  });

  it("pulls to the nearest unit, which is what «se queda donde se suelta» means at this size", () => {
    // A third of the way into unit 36 is still unit 36; two thirds is unit 37. With a unit of
    // 9.3px that is never more than five pixels from where the hand actually let go.
    expect(fineColumnAt(unitLeft(36) + UNIT * 0.3, metrics)).toBe(36);
    expect(fineColumnAt(unitLeft(36) + UNIT * 0.7, metrics)).toBe(37);
    // **Inside a group of eight.** Unit 40 is the last of its group, so its neighbour is a gutter
    // away: two thirds into it is still nearer 40 than 41, which is the gutter doing its job and
    // not a rounding this function gets wrong.
    expect(fineColumnAt(unitLeft(40) + UNIT * 0.7, metrics)).toBe(40);
  });

  it("falls to the nearer unit either side of a gutter, because no placement starts on one", () => {
    // The gutter between units 8 and 9 is sixteen pixels wide. Its first third belongs to 8 and
    // its last third to 9 — the document never names the gutter itself (`fineGrid.ts`).
    const gutterStart = unitLeft(8) + UNIT;
    expect(fineColumnAt(gutterStart + 2, metrics)).toBe(8);
    expect(fineColumnAt(gutterStart + GUTTER - 2, metrics)).toBe(9);
  });

  it("clamps rather than inventing a ninety-seventh unit or a zeroth", () => {
    expect(fineColumnAt(metrics.left - 400, metrics)).toBe(1);
    expect(fineColumnAt(metrics.left + 100_000, metrics)).toBe(FINE_COLUMNS);
  });
});

describe("rowAt", () => {
  it("walks the rows the browser resolved, which is not `y / 8`", () => {
    // **David's adjustment 1, as one assertion.** The first row of this cover is 52px tall because
    // a headline lives in it, so a point 50px down is still inside it and the nearest edge below is
    // row 2. Divided by eight, the same point would answer row 7 — four rows and 48 pixels wrong,
    // in every document the migration converted.
    expect(rowAt(metrics.top + 50, metrics)).toBe(2);
    expect(Math.round(50 / 8) + 1).toBe(7);
  });

  it("answers the row whose own top edge the point is on", () => {
    for (const row of [1, 2, 4, 7, 10]) {
      expect(rowAt(rowTop(row), metrics), `row ${row}`).toBe(row);
    }
  });

  it("pulls to the nearest row edge", () => {
    // Row 4 starts at 68 (52 + 8 + 8) and is 31 tall: 80 is nearer its own edge, 96 is nearer the
    // next one.
    expect(rowAt(metrics.top + 80, metrics)).toBe(4);
    expect(rowAt(metrics.top + 96, metrics)).toBe(5);
  });

  it("extrapolates below the last row, because that is how a section grows", () => {
    const below = ROWS.reduce((total, height) => total + height, 0);
    expect(rowAt(metrics.top + below, metrics)).toBe(ROWS.length + 1);
    expect(rowAt(metrics.top + below + 24, metrics)).toBe(ROWS.length + 4);
  });

  it("clamps at the interface's own floor and at the first row", () => {
    expect(rowAt(metrics.top - 500, metrics)).toBe(1);
    expect(rowAt(metrics.top + 1_000_000, metrics)).toBe(MAX_ROW);
  });

  it("puts everything in the first row of a section with nothing in it", () => {
    const empty: GridMetrics = { ...metrics, rows: [] };
    expect(rowAt(metrics.top, empty)).toBe(1);
    // Row 1 is the only one there is, so 500px below the top is sixty-three rows of eight further
    // down than row 1 — the section growing into the space, which is the honest answer here.
    expect(rowAt(metrics.top + 500, empty)).toBe(64);
  });
});

describe("cellAt", () => {
  it("is the two answers together", () => {
    expect(cellAt({ x: unitLeft(25), y: rowTop(4) }, metrics)).toEqual({ column: 25, row: 4 });
  });
});

describe("overlaps", () => {
  it("is true only when the two rectangles share a cell", () => {
    const a = place("a", 1, 8, 1, 2);
    expect(overlaps(a, place("b", 8, 8, 1, 1))).toBe(true);
    expect(overlaps(a, place("b", 9, 8, 1, 1))).toBe(false);
    expect(overlaps(a, place("b", 1, 8, 3, 1))).toBe(false);
  });

  it("touching edges do not overlap, in either direction", () => {
    const a = place("a", 1, 8, 1, 1);
    expect(overlaps(a, place("b", 9, 8, 1, 1))).toBe(false);
    expect(overlaps(a, place("b", 1, 8, 2, 1))).toBe(false);
  });
});

describe("dropAt", () => {
  const moving = place("el-headline", 1, 48, 1, 7);

  it("lands on the unit and row nearest the corner it was let go at", () => {
    const drop = dropAt({
      metrics,
      at: { x: unitLeft(13), y: rowTop(4) },
      moving,
    });
    expect(drop).toEqual({ kind: "place", at: { column: 13, columnSpan: 48, row: 4, rowSpan: 7 } });
  });

  it("keeps the element's spans: a drag moves it, it never resizes it", () => {
    const drop = dropAt({ metrics, at: { x: unitLeft(20), y: rowTop(2) }, moving });
    expect(drop.at.columnSpan).toBe(48);
    expect(drop.at.rowSpan).toBe(7);
  });

  /**
   * **Overlapping is allowed, which is the amendment of ADR 0048 §4.**
   *
   * Sprint 24 refused a drop onto a cell another element held and put the element back. With a unit
   * of nine pixels almost every drop touches something, so the rule that protected the gesture
   * became the thing that made it impossible — and `dropAt` no longer even takes the other
   * placements, which is the strongest way to say it cannot refuse for that reason.
   */
  it("drops onto another element's own cell, stacking instead of refusing", () => {
    const drop = dropAt({
      metrics,
      // Exactly where a neighbour at unit 49 row 1 would be.
      at: { x: unitLeft(49), y: rowTop(1) },
      moving,
    });
    expect(drop.kind).toBe("place");
    expect(drop.at.column).toBe(49);
    expect(overlaps(drop.at, place("el-photo", 49, 48, 1, 7))).toBe(true);
  });

  it("clamps at the right edge instead of refusing, because overshooting means «as far as it goes»", () => {
    const drop = dropAt({ metrics, at: { x: unitLeft(96) + 400, y: rowTop(1) }, moving });
    // 48 units wide, so the furthest it can start is 49.
    expect(drop).toMatchObject({ kind: "place", at: { column: FINE_COLUMNS - 48 + 1 } });
  });

  it("lets a section grow by a row, which is what dropping under it means", () => {
    const below = ROWS.reduce((total, height) => total + height, 0);
    const drop = dropAt({ metrics, at: { x: unitLeft(1), y: metrics.top + below + 40 }, moving });
    expect(drop.kind).toBe("place");
    expect(drop.at.row).toBe(ROWS.length + 6);
  });

  it("refuses past the interface's own floor rather than clamping into it", () => {
    const tall: GridMetrics = { ...metrics, rows: Array.from({ length: MAX_ROW }, () => 8) };
    const drop = dropAt({
      metrics: tall,
      at: { x: unitLeft(1), y: metrics.top + MAX_ROW * 8 },
      moving,
    });
    expect(drop).toMatchObject({ kind: "refuse", why: "rows" });
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
  // In the fine grid's units: a headline across the first four catalog columns, a photograph
  // across the last four but one.
  const headline = place("el-headline", 1, 32, 1, 1);
  const photo = place("el-photo", 65, 32, 1, 2);

  it("moves one catalog column per press, keeping the spans", () => {
    // `ARROW_UNITS` until día 6, which makes a bare press one unit and `Shift` eight — the two
    // halves of David's condition arrive together there, with the accumulated run.
    expect(arrowDrop({ moving: headline, action: { kind: "move", column: 1, row: 0 } })).toEqual({
      kind: "place",
      at: { column: 1 + ARROW_UNITS, columnSpan: 32, row: 1, rowSpan: 1 },
    });
    expect(ARROW_UNITS).toBe(FINE_PER_COLUMN);
  });

  it("moves one row per vertical press, because a row is the vertical unit", () => {
    expect(
      arrowDrop({ moving: headline, action: { kind: "move", column: 0, row: 1 } }),
    ).toMatchObject({ at: { row: 2, rowSpan: 1 } });
  });

  /**
   * **And it walks onto the cell another element holds** (ADR 0050 §6, amending ADR 0048 §4).
   *
   * One vocabulary and one permission for the hand and the keyboard: what the pointer may drop on
   * top of, the arrows may walk onto. `arrowDrop` no longer takes the section's other placements at
   * all, which is the strongest way to say it cannot refuse for that reason.
   */
  it("walks onto an occupied cell instead of refusing", () => {
    const against = place("el-headline", 57, 32, 1, 1);
    const drop = arrowDrop({ moving: against, action: { kind: "move", column: 1, row: 0 } });
    expect(drop).toMatchObject({ kind: "place", at: { column: 65 } });
    expect(drop.kind === "place" && overlaps(drop.at, photo)).toBe(true);
  });

  it("does nothing at the edges, rather than clamping a deliberate press", () => {
    expect(arrowDrop({ moving: headline, action: { kind: "move", column: -1, row: 0 } })).toEqual({
      kind: "none",
    });
    expect(arrowDrop({ moving: headline, action: { kind: "move", column: 0, row: -1 } })).toEqual({
      kind: "none",
    });
    // Thirty-two units from unit 65 reaches 96 exactly, so one column more does not fit.
    expect(arrowDrop({ moving: photo, action: { kind: "span", columns: 1 } })).toEqual({
      kind: "none",
    });
    // And a span of one catalog column cannot become none.
    const thin = place("el-thin", 1, ARROW_UNITS, 6, 1);
    expect(arrowDrop({ moving: thin, action: { kind: "span", columns: -1 } })).toEqual({
      kind: "none",
    });
  });

  it("refuses past the interface's own floor on rows", () => {
    const low = place("el-low", 1, 16, MAX_ROW, 1);
    expect(arrowDrop({ moving: low, action: { kind: "move", column: 0, row: 1 } })).toEqual({
      kind: "none",
    });
  });

  it("widens by a catalog column, into a taken cell as readily as a free one", () => {
    const narrow = place("el-narrow", 1, 32, 1, 1);
    expect(arrowDrop({ moving: narrow, action: { kind: "span", columns: 1 } })).toEqual({
      kind: "place",
      at: { column: 1, columnSpan: 32 + ARROW_UNITS, row: 1, rowSpan: 1 },
    });
    const wide = place("el-wide", 1, 64, 1, 1);
    expect(arrowDrop({ moving: wide, action: { kind: "span", columns: 1 } })).toMatchObject({
      kind: "place",
      at: { columnSpan: 72 },
    });
  });

  it("answers none to none, so a key nobody mapped changes nothing", () => {
    expect(arrowDrop({ moving: headline, action: { kind: "none" } })).toEqual({ kind: "none" });
  });
});

describe("announceText", () => {
  /**
   * **In catalog columns, from the fine unit** — because that is what one press moves
   * (`ARROW_UNITS`). «Columna 25 de 96» would be arithmetically true and useless: nobody counts in
   * ninety-sixths, and a press lands exactly on a twelfth. Día 6 replaces the sentence with pixels,
   * which is what David asked for once a press is worth one unit.
   */
  it("says where it went, in the words the owner's language uses", () => {
    expect(announceText({ column: 17, columnSpan: 32, row: 2, rowSpan: 1 }, "move")).toBe(
      "Columna 3 de 12, fila 2",
    );
  });

  it("says how wide it is when the width is what changed", () => {
    // Two sentences for two acts: a move that said «ancho 4» every time would bury the number that
    // changed under one that did not.
    expect(announceText({ column: 17, columnSpan: 40, row: 2, rowSpan: 1 }, "span")).toBe(
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
