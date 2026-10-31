import { FINE_COLUMNS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { MAX_ROW } from "../src/editor/designTree.ts";
import {
  cursorFor,
  EDGE_ZONE,
  EDGE_ZONE_WRITING_INSIDE,
  type Edge,
  edgeAt,
  resizeTo,
} from "../src/editor/resizeBox.ts";

/**
 * The edges of the blue box (ADR 0050, sprint 25 día 4), as arithmetic.
 *
 * Two questions, and the second is the one rule 4 cares about: which edge a point is on, and what
 * the placement becomes when that edge is pulled to a grid line. No pixels reach the document —
 * `resizeTo` answers in units and rows, and clamps rather than refusing.
 */

/** A box of 200×60 at (100, 200), the size a headline has on a real cover. */
const box = { left: 100, right: 300, top: 200, bottom: 260 };
const chosen = { outside: EDGE_ZONE, inside: EDGE_ZONE };
const writing = { outside: EDGE_ZONE, inside: EDGE_ZONE_WRITING_INSIDE };

describe("edgeAt", () => {
  it("answers each of the four sides, from either side of the line", () => {
    expect(edgeAt({ x: 100, y: 230 }, box, chosen)).toBe("left");
    expect(edgeAt({ x: 95, y: 230 }, box, chosen)).toBe("left");
    expect(edgeAt({ x: 104, y: 230 }, box, chosen)).toBe("left");
    expect(edgeAt({ x: 300, y: 230 }, box, chosen)).toBe("right");
    expect(edgeAt({ x: 200, y: 200 }, box, chosen)).toBe("top");
    expect(edgeAt({ x: 200, y: 260 }, box, chosen)).toBe("bottom");
  });

  it("answers the corner when a point is on two edges at once", () => {
    expect(edgeAt({ x: 101, y: 201 }, box, chosen)).toBe("nw");
    expect(edgeAt({ x: 299, y: 203 }, box, chosen)).toBe("ne");
    expect(edgeAt({ x: 98, y: 258 }, box, chosen)).toBe("sw");
    expect(edgeAt({ x: 302, y: 262 }, box, chosen)).toBe("se");
  });

  it("answers nothing in the middle of the box or well outside it", () => {
    expect(edgeAt({ x: 200, y: 230 }, box, chosen)).toBeNull();
    expect(edgeAt({ x: 60, y: 230 }, box, chosen)).toBeNull();
    expect(edgeAt({ x: 200, y: 400 }, box, chosen)).toBeNull();
    // Beside the box but level with nothing of it: the zones are a frame, not two bands crossing
    // the page.
    expect(edgeAt({ x: 100, y: 400 }, box, chosen)).toBeNull();
  });

  /**
   * **The asymmetry while writing is David's adjustment 8**, and it is the difference between a
   * text whose first letter can be clicked and one whose border has eaten it: six pixels outside
   * the box, two inside.
   */
  it("reaches six pixels out and two in while a text is being written in", () => {
    expect(edgeAt({ x: 94, y: 230 }, box, writing)).toBe("left");
    expect(edgeAt({ x: 102, y: 230 }, box, writing)).toBe("left");
    // Three pixels inside the box is a caret while writing, and still the edge when merely chosen.
    expect(edgeAt({ x: 103, y: 230 }, box, writing)).toBeNull();
    expect(edgeAt({ x: 103, y: 230 }, box, chosen)).toBe("left");
    expect(edgeAt({ x: 297, y: 230 }, box, writing)).toBeNull();
    expect(edgeAt({ x: 298, y: 230 }, box, writing)).toBe("right");
  });

  it("gives a small element the edge the hand is nearer, rather than the first one tested", () => {
    // A button of 60×30, whose top and bottom zones overlap in the middle: every point answers,
    // and the answer is the nearer line.
    const button = { left: 0, right: 60, top: 0, bottom: 30 };
    expect(edgeAt({ x: 30, y: 4 }, button, chosen)).toBe("top");
    expect(edgeAt({ x: 30, y: 26 }, button, chosen)).toBe("bottom");
    // And in its corners, the corner.
    expect(edgeAt({ x: 1, y: 1 }, button, chosen)).toBe("nw");
    expect(edgeAt({ x: 59, y: 29 }, button, chosen)).toBe("se");
  });

  /**
   * **The middle half is the element's, however small and however zoomed** (sprint 31 día 1). A
   * one-line text at a zoom of 0.616 — a 1280 laptop with a panel open — is 20 px of the frame,
   * and the six screen pixels of zone are 9.75 of the frame: before the cap they left half a pixel
   * in the middle, and a press there to write began a resize instead. Measured in the walk that
   * found it, which failed on Linux and passed on macOS by a quarter of a pixel.
   */
  it("keeps the middle half of a short element for the hand", () => {
    const zoomed = { outside: EDGE_ZONE / 0.615625, inside: EDGE_ZONE / 0.615625 };
    const line = { left: 48, right: 640, top: 300, bottom: 320 };
    expect(edgeAt({ x: 344, y: 310 }, line, zoomed), "the middle of the line").toBeNull();
    expect(edgeAt({ x: 344, y: 306 }, line, zoomed), "a quarter in, still the line").toBeNull();
    expect(edgeAt({ x: 344, y: 304 }, line, zoomed)).toBe("top");
    expect(edgeAt({ x: 344, y: 316 }, line, zoomed)).toBe("bottom");
    // From outside, the zone keeps its whole reach: the edge is still where the hand looks for it.
    expect(edgeAt({ x: 344, y: 291 }, line, zoomed)).toBe("top");
    expect(edgeAt({ x: 344, y: 329 }, line, zoomed)).toBe("bottom");
    // Along the other axis the line is wide, so its sides keep the full inner reach.
    expect(edgeAt({ x: 57, y: 310 }, line, zoomed)).toBe("left");
  });
});

describe("cursorFor", () => {
  it("is the four the platform has, so nobody has to be told what the pointer means", () => {
    expect(cursorFor("left")).toBe("ew-resize");
    expect(cursorFor("right")).toBe("ew-resize");
    expect(cursorFor("top")).toBe("ns-resize");
    expect(cursorFor("bottom")).toBe("ns-resize");
    expect(cursorFor("nw")).toBe("nwse-resize");
    expect(cursorFor("se")).toBe("nwse-resize");
    expect(cursorFor("ne")).toBe("nesw-resize");
    expect(cursorFor("sw")).toBe("nesw-resize");
  });
});

describe("resizeTo", () => {
  /** A headline across six catalog columns — units 9..56 — four rows down and seven rows tall. */
  const placement = { elementId: "el-headline", column: 9, columnSpan: 48, row: 4, rowSpan: 7 };

  /** The hand on one cell, as the four readings see it when they agree. */
  const at = (column: number, row: number) => ({
    startColumn: column,
    endColumn: column,
    startRow: row,
    endRow: row,
  });

  it("widens by the right edge and leaves the left one where it was", () => {
    // Two catalog columns further right: units 9..72, which is forty-eight units plus sixteen.
    expect(resizeTo(placement, "right", at(72, 11))).toEqual({ columnSpan: 64 });
  });

  it("moves the start by the left edge and keeps the right edge still", () => {
    // Pulled left to unit 1: the element now starts there and is eight units wider, so its last
    // unit — 56 — has not moved.
    expect(resizeTo(placement, "left", at(1, 11))).toEqual({ column: 1, columnSpan: 56 });
    // And pulled right: narrower from the left, same last unit.
    expect(resizeTo(placement, "left", at(25, 11))).toEqual({ column: 25, columnSpan: 32 });
  });

  it("grows downwards by the bottom edge and upwards by the top one", () => {
    expect(resizeTo(placement, "bottom", at(9, 19))).toEqual({ rowSpan: 16 });
    expect(resizeTo(placement, "top", at(9, 2))).toEqual({ row: 2, rowSpan: 9 });
  });

  it("does both at a corner, and only the two numbers that corner owns", () => {
    expect(resizeTo(placement, "se", at(96, 29))).toEqual({ columnSpan: 88, rowSpan: 26 });
    expect(resizeTo(placement, "nw", at(1, 1))).toEqual({
      column: 1,
      columnSpan: 56,
      row: 1,
      rowSpan: 10,
    });
  });

  /**
   * **Each edge takes its own reading, which is the correction día 4 needed from Chromium.**
   *
   * The unit whose left edge is nearest and the unit whose right edge is nearest are not the same
   * unit — between them there can be a gutter of sixteen pixels — and a resize that asked one
   * question for both borders came out one unit short of where the hand had pulled it. A target
   * whose four numbers disagree is what proves each border reads the one it owns.
   */
  it("takes the start reading for the left and top edges, the end one for the right and bottom", () => {
    const target = { startColumn: 20, endColumn: 30, startRow: 6, endRow: 9 };
    expect(resizeTo(placement, "left", target)).toEqual({ column: 20, columnSpan: 37 });
    expect(resizeTo(placement, "right", target)).toEqual({ columnSpan: 22 });
    expect(resizeTo(placement, "top", target)).toEqual({ row: 6, rowSpan: 5 });
    expect(resizeTo(placement, "bottom", target)).toEqual({ rowSpan: 6 });
  });

  it("reaches the last unit of the grid", () => {
    const wide = resizeTo(
      { ...placement, column: 1, columnSpan: 8 },
      "right",
      at(FINE_COLUMNS, 11),
    );
    expect(wide).toEqual({ columnSpan: FINE_COLUMNS });
  });

  it("clamps instead of refusing, in both directions and on both axes", () => {
    // Past the grid's right edge means «as far as it goes».
    expect(resizeTo(placement, "right", at(400, 11))).toEqual({ columnSpan: 88 });
    // Past the far edge leaves one unit, never an inverted box.
    expect(resizeTo(placement, "right", at(1, 11))).toEqual({ columnSpan: 1 });
    expect(resizeTo(placement, "left", at(400, 11))).toEqual({ column: 56, columnSpan: 1 });
    // And one row, never none.
    expect(resizeTo(placement, "bottom", at(9, 1))).toEqual({ rowSpan: 1 });
    expect(resizeTo(placement, "top", at(9, 400))).toEqual({ row: 10, rowSpan: 1 });
    // Nor past the interface's own floor on rows.
    expect(resizeTo(placement, "bottom", at(9, MAX_ROW + 80))).toEqual({
      rowSpan: MAX_ROW - placement.row + 1,
    });
  });

  it("never writes a number `setPlacement` would refuse, from any edge at any line", () => {
    // The exhaustive half: every edge, every reading in both axes, against rule 4's own limits.
    const edges: Edge[] = ["left", "right", "top", "bottom", "nw", "ne", "sw", "se"];
    for (const edge of edges) {
      for (const column of [1, 2, 9, 48, 57, 96, 97, 200]) {
        for (const row of [1, 2, 4, 11, 200, MAX_ROW + 1]) {
          const edit = resizeTo(placement, edge, at(column, row));
          const next = { ...placement, ...edit };
          const where = `${edge} → ${column}/${row}`;
          expect(next.column, where).toBeGreaterThanOrEqual(1);
          expect(next.columnSpan, where).toBeGreaterThanOrEqual(1);
          expect(next.column + next.columnSpan - 1, where).toBeLessThanOrEqual(FINE_COLUMNS);
          expect(next.row, where).toBeGreaterThanOrEqual(1);
          expect(next.rowSpan, where).toBeGreaterThanOrEqual(1);
          expect(next.row + next.rowSpan - 1, where).toBeLessThanOrEqual(MAX_ROW);
        }
      }
    }
  });
});
