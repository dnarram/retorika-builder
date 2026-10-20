import { describe, expect, it } from "vitest";
import { guidesFor, type Rect } from "../src/editor/guides.ts";

/**
 * The alignment guides (ADR 0050, sprint 25 día 5), as arithmetic.
 *
 * A neighbour at 100..300 and a section 1072 wide, which is a real cover at a window of 1440: the
 * numbers are the ones the canvas has. What matters is which candidate wins, by how much the thing
 * being moved shifts, and that nothing moves when nothing is near.
 */

const neighbour: Rect = { left: 100, right: 300, top: 200, bottom: 260 };
const others = [neighbour];
const CENTRE_X = 48 + 1072 / 2;

describe("guidesFor", () => {
  it("snaps a left edge to a neighbour's left edge, and says where the line goes", () => {
    const guided = guidesFor({ x: [104], y: [], others, threshold: 6 });
    expect(guided.dx).toBe(-4);
    expect(guided.dy).toBe(0);
    expect(guided.lines).toEqual([{ axis: "x", at: 100 }]);
  });

  it("snaps to a neighbour's right edge and to its centre too", () => {
    expect(guidesFor({ x: [297], y: [], others, threshold: 6 }).lines).toEqual([
      { axis: "x", at: 300 },
    ]);
    // The middle of 100..300 is 200, and a candidate nothing else offers.
    expect(guidesFor({ x: [203], y: [], others, threshold: 6 })).toMatchObject({
      dx: -3,
      lines: [{ axis: "x", at: 200 }],
    });
  });

  /**
   * **The sabotage the plan asked for: the centre.** A version that offered only the two edges
   * would answer «nothing is near» here — 203 is 97 pixels from one edge and 103 from the other —
   * and lining a text up with the middle of a photograph is one of the two things these guides are
   * for.
   */
  it("would answer nothing if the centre were not a candidate", () => {
    const edgesOnly = guidesFor({ x: [203], y: [], others: [], threshold: 6 });
    expect(edgesOnly).toEqual({ dx: 0, dy: 0, lines: [] });
  });

  it("snaps vertically to a neighbour's top, middle and bottom", () => {
    expect(guidesFor({ x: [], y: [197], others, threshold: 6 }).lines).toEqual([
      { axis: "y", at: 200 },
    ]);
    expect(guidesFor({ x: [], y: [233], others, threshold: 6 })).toMatchObject({
      dy: -3,
      lines: [{ axis: "y", at: 230 }],
    });
    expect(guidesFor({ x: [], y: [262], others, threshold: 6 })).toMatchObject({
      dy: -2,
      lines: [{ axis: "y", at: 260 }],
    });
  });

  it("snaps to the section's own centre along x, and to nothing of the sort along y", () => {
    const guided = guidesFor({
      x: [CENTRE_X + 3],
      y: [CENTRE_X + 3],
      others: [],
      centreX: CENTRE_X,
      threshold: 6,
    });
    expect(guided.dx).toBe(-3);
    // A section's height is its content's, so its vertical centre moves while the thing being
    // dragged is still in the air: a magnet to a line that moves with you is not a guide.
    expect(guided.dy).toBe(0);
    expect(guided.lines).toEqual([{ axis: "x", at: CENTRE_X }]);
  });

  it("decides each axis on its own, which is what a column of texts feels like", () => {
    const guided = guidesFor({ x: [102], y: [500], others, threshold: 6 });
    expect(guided.dx).toBe(-2);
    expect(guided.dy).toBe(0);
    expect(guided.lines).toEqual([{ axis: "x", at: 100 }]);
  });

  it("snaps both axes at once when both are near", () => {
    const guided = guidesFor({ x: [98], y: [204], others, threshold: 6 });
    expect(guided).toEqual({
      dx: 2,
      dy: -4,
      lines: [
        { axis: "x", at: 100 },
        { axis: "y", at: 200 },
      ],
    });
  });

  it("takes the nearest candidate when several are within reach", () => {
    // 296 is four from the right edge and ninety-six from the centre; the nearer wins.
    expect(guidesFor({ x: [296], y: [], others, threshold: 6 }).lines).toEqual([
      { axis: "x", at: 300 },
    ]);
    // And with a neighbour's edge and the section's centre both in range, the neighbour wins the
    // tie: lining up with something on the page is a stronger intention than with the middle of
    // nothing.
    const tie = guidesFor({
      x: [CENTRE_X - 3],
      y: [],
      others: [{ left: CENTRE_X - 6, right: CENTRE_X + 100, top: 0, bottom: 10 }],
      centreX: CENTRE_X,
      threshold: 6,
    });
    expect(tie.lines).toEqual([{ axis: "x", at: CENTRE_X - 6 }]);
  });

  it("tries every live line, so a drag lines up by whichever of its three edges is nearest", () => {
    // The moving box is 400 wide and its *right* edge is what is near the neighbour's left.
    const guided = guidesFor({ x: [-304, -104, 96], y: [], others, threshold: 6 });
    expect(guided.dx).toBe(4);
    expect(guided.lines).toEqual([{ axis: "x", at: 100 }]);
  });

  it("answers nothing when nothing is within the threshold, so the fine grid decides", () => {
    expect(guidesFor({ x: [140], y: [140], others, threshold: 6 })).toEqual({
      dx: 0,
      dy: 0,
      lines: [],
    });
  });

  it("answers nothing for a threshold of zero, rather than snapping to everything exactly", () => {
    expect(guidesFor({ x: [100], y: [200], others, threshold: 0 })).toEqual({
      dx: 0,
      dy: 0,
      lines: [],
    });
  });
});
