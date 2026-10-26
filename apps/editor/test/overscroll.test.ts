import { describe, expect, it } from "vitest";
import { overscrollFor } from "../src/editor/overscroll.ts";

/**
 * The numbers are the ones measured on 26 October 2026 at a 1024 × 800 window: the canvas row is
 * 718 px tall (800 − header 58 − 24 of padding), the frame's viewport 654 at zoom 1, and opening
 * «Diseño» leaves the card at 532 of 721, a zoom of 0.738, where the viewport grows to 909. The room
 * the page needs is the difference, and it is what keeps the greatest scroll where it was.
 */
describe("overscrollFor", () => {
  it("gives the page exactly the room the viewport gained", () => {
    expect(overscrollFor(718, 532 / 721)).toBeCloseTo(909 - 654, 0);
  });

  it("is zero at zoom 1, where the preview is the page and nothing has grown", () => {
    expect(overscrollFor(718, 1)).toBe(0);
  });

  it("never magnifies: a zoom above 1 is treated as 1", () => {
    expect(overscrollFor(718, 1.2)).toBe(0);
  });

  it("is zero before the row has been measured, and for a zoom that is not a number yet", () => {
    expect(overscrollFor(0, 0.7)).toBe(0);
    expect(overscrollFor(718, 0)).toBe(0);
    expect(overscrollFor(Number.NaN, 0.7)).toBe(0);
    expect(overscrollFor(718, Number.NaN)).toBe(0);
  });

  it("grows as the zoom falls, because the viewport does", () => {
    expect(overscrollFor(718, 0.9)).toBeLessThan(overscrollFor(718, 0.7));
    expect(overscrollFor(718, 0.7)).toBeLessThan(overscrollFor(718, 0.6));
  });
});
