import { describe, expect, it } from "vitest";
import {
  BAR_INSET,
  BAR_STEP,
  type Bounds,
  CORNERS,
  clampToHost,
  cornerPoint,
  defaultPoint,
  dragged,
  gripKeyAction,
  isDrag,
  nearestCorner,
  nextCorner,
  type Point,
  stepped,
  tipSide,
} from "../src/editor/barPosition.ts";

/**
 * Where a floating bar lands, and what a press on its grip means.
 *
 * Measured against a section the size of a real one: a restaurant's «Comidas» at 1200 × 600 with
 * the eight verbs' 284 × 32 cluster in it. The numbers below are worked from those two rectangles
 * rather than written as constants, so a test cannot agree with itself while the arithmetic drifts.
 */
const SECTION: Bounds = { hostWidth: 1200, hostHeight: 600, barWidth: 284, barHeight: 32 };

/** The far edges of that section, which almost every expectation is one of. */
const RIGHT = SECTION.hostWidth - SECTION.barWidth - BAR_INSET; // 908
const BOTTOM = SECTION.hostHeight - SECTION.barHeight - BAR_INSET; // 560

const press = (
  key: string,
  held: Partial<Record<"altKey" | "metaKey" | "ctrlKey" | "shiftKey", boolean>> = {},
) => ({
  key,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  ...held,
});

describe("where a bar starts, and where it is allowed to be", () => {
  it("starts in the corner it has been in since sprint 2, eight pixels in", () => {
    expect(defaultPoint(SECTION)).toEqual({ x: RIGHT, y: BAR_INSET });
    expect(defaultPoint(SECTION)).toEqual(cornerPoint("top-right", SECTION));
  });

  it("names the four corners with the inset on every edge", () => {
    expect(cornerPoint("top-left", SECTION)).toEqual({ x: BAR_INSET, y: BAR_INSET });
    expect(cornerPoint("top-right", SECTION)).toEqual({ x: RIGHT, y: BAR_INSET });
    expect(cornerPoint("bottom-right", SECTION)).toEqual({ x: RIGHT, y: BOTTOM });
    expect(cornerPoint("bottom-left", SECTION)).toEqual({ x: BAR_INSET, y: BOTTOM });
  });

  it("brings a point outside the section back in, on both axes and in both directions", () => {
    expect(clampToHost({ x: -400, y: -400 }, SECTION)).toEqual({ x: BAR_INSET, y: BAR_INSET });
    expect(clampToHost({ x: 9_000, y: 9_000 }, SECTION)).toEqual({ x: RIGHT, y: BOTTOM });
    // And leaves alone one that was already inside.
    expect(clampToHost({ x: 100, y: 100 }, SECTION)).toEqual({ x: 100, y: 100 });
  });

  /**
   * At 320px the eight verbs are 248 of the 304 there is room for, so this is one verb away from
   * being the ordinary case rather than the edge one. A negative left would push the bar under the
   * frame's own `overflow-x: clip`, where it is on the screen and cannot be pressed.
   */
  it("leaves a bar wider than its section at the inset, rather than at a negative left", () => {
    const narrow: Bounds = { hostWidth: 200, hostHeight: 400, barWidth: 284, barHeight: 32 };
    expect(clampToHost({ x: -50, y: 10 }, narrow).x).toBe(BAR_INSET);
    expect(clampToHost({ x: 500, y: 10 }, narrow).x).toBe(BAR_INSET);
    expect(cornerPoint("top-right", narrow).x).toBe(BAR_INSET);
  });
});

describe("the corner the grip sends it to next", () => {
  it("walks clockwise from where the bar is born and comes home on the fourth press", () => {
    let at: Point = defaultPoint(SECTION);
    const walked = CORNERS.map(() => {
      const corner = nextCorner(at, SECTION);
      at = cornerPoint(corner, SECTION);
      return corner;
    });
    expect(walked).toEqual(["bottom-right", "bottom-left", "top-left", "top-right"]);
    expect(at).toEqual(defaultPoint(SECTION));
  });

  it("starts from the nearest corner, so a bar dragged into the middle still has a next one", () => {
    // Nearer the bottom-left than any other: a third across, three quarters down.
    const middling: Point = { x: 60, y: 500 };
    expect(nearestCorner(middling, SECTION)).toBe("bottom-left");
    expect(nextCorner(middling, SECTION)).toBe("top-left");
  });

  it("knows each corner as its own nearest", () => {
    for (const corner of CORNERS) {
      expect(nearestCorner(cornerPoint(corner, SECTION), SECTION)).toBe(corner);
    }
  });
});

describe("what a press on the grip means", () => {
  const steps: [string, number, number][] = [
    ["ArrowUp", 0, -BAR_STEP],
    ["ArrowDown", 0, BAR_STEP],
    ["ArrowLeft", -BAR_STEP, 0],
    ["ArrowRight", BAR_STEP, 0],
  ];

  for (const [key, dx, dy] of steps) {
    it(`${key} is a step of ${BAR_STEP} and nothing else`, () => {
      expect(gripKeyAction(press(key))).toEqual({ kind: "step", dx, dy });
    });
  }

  it("Home means back to where it starts", () => {
    expect(gripKeyAction(press("Home"))).toEqual({ kind: "home" });
  });

  /**
   * Enter and Space fire a `click` on a `<button>`, and the corner cycle lives in the click
   * handler — so a key press and a mouse press take one path rather than two that have to be kept
   * agreeing. Taking them here would run the cycle twice for one press.
   */
  it("leaves Enter and Space to the button, which is what fires the corner cycle", () => {
    expect(gripKeyAction(press("Enter"))).toEqual({ kind: "ignore" });
    expect(gripKeyAction(press(" "))).toEqual({ kind: "ignore" });
  });

  it("is not ours for any other key", () => {
    for (const key of ["Escape", "Tab", "a", "PageDown", "End"]) {
      expect(gripKeyAction(press(key)), `«${key}» was taken`).toEqual({ kind: "ignore" });
    }
  });

  it("refuses any modifier, Shift included", () => {
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home"]) {
      for (const held of ["altKey", "metaKey", "ctrlKey", "shiftKey"] as const) {
        expect(gripKeyAction(press(key, { [held]: true })), `${held}+${key} was taken`).toEqual({
          kind: "ignore",
        });
      }
    }
  });
});

describe("moving it", () => {
  it("takes one step and stops at the edge instead of leaving the section", () => {
    const from: Point = { x: 100, y: 100 };
    expect(stepped(from, { dx: -BAR_STEP, dy: 0 }, SECTION)).toEqual({ x: 100 - BAR_STEP, y: 100 });

    // Pressed against the left edge, the next press changes nothing rather than going negative.
    const edge: Point = { x: BAR_INSET, y: 100 };
    expect(stepped(edge, { dx: -BAR_STEP, dy: 0 }, SECTION)).toEqual(edge);
  });

  it("is a click under four pixels of travel and a drag over it", () => {
    const from: Point = { x: 500, y: 500 };
    expect(isDrag(from, { x: 503, y: 503 })).toBe(false);
    expect(isDrag(from, { x: 504, y: 500 })).toBe(true);
    expect(isDrag(from, { x: 500, y: 496 })).toBe(true);
    expect(isDrag(from, from)).toBe(false);
  });

  it("follows the pointer's travel rather than the pointer, so the grip stays where it was grabbed", () => {
    const start: Point = { x: 400, y: 200 };
    // The pointer went down at (1000, 900) — nowhere near the bar's own coordinates — and moved
    // 60 left and 25 down. The bar does the same, from where *it* was.
    expect(dragged(start, { x: 1000, y: 900 }, { x: 940, y: 925 }, SECTION)).toEqual({
      x: 340,
      y: 225,
    });
  });

  it("clamps a drag that would take it out of the section", () => {
    const start: Point = { x: 400, y: 200 };
    expect(dragged(start, { x: 0, y: 0 }, { x: -9_000, y: 9_000 }, SECTION)).toEqual({
      x: BAR_INSET,
      y: BOTTOM,
    });
  });
});

describe("which side the words go on", () => {
  it("below while the bar is anywhere there is room for one", () => {
    expect(tipSide(defaultPoint(SECTION), SECTION)).toBe("below");
    expect(tipSide({ x: 100, y: 100 }, SECTION)).toBe("below");
  });

  it("above once the bar is low enough that a word under it would be drawn past the edge", () => {
    expect(tipSide(cornerPoint("bottom-right", SECTION), SECTION)).toBe("above");
    expect(tipSide(cornerPoint("bottom-left", SECTION), SECTION)).toBe("above");
  });
});
