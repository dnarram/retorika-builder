import { describe, expect, it } from "vitest";
import { autoScrollStep, sectionDropIndex, sectionGapAt } from "../src/editor/sectionDrop.ts";

/** Five sections of 400 px, a cover first and a footer last. */
const boxes = ["cover", "a", "b", "c", "footer"].map((id, at) => ({
  id,
  top: at * 400,
  bottom: at * 400 + 400,
}));
const ENDS = { coverFirst: true, footerLast: true };

describe("sectionGapAt", () => {
  it("finds the nearest gap between the sections", () => {
    expect(sectionGapAt(boxes, 790, ENDS)).toEqual({ index: 2, y: 800 });
    expect(sectionGapAt(boxes, 1250, ENDS)).toEqual({ index: 3, y: 1200 });
  });

  it("has no gap above a cover that opens the page, nor below a footer that closes it", () => {
    expect(sectionGapAt(boxes, -50, ENDS)).toEqual({ index: 1, y: 400 });
    expect(sectionGapAt(boxes, 5000, ENDS)).toEqual({ index: 4, y: 1600 });
  });

  it("lets a page without them be let go of at either end", () => {
    const open = { coverFirst: false, footerLast: false };
    expect(sectionGapAt(boxes, -50, open)).toEqual({ index: 0, y: 0 });
    expect(sectionGapAt(boxes, 5000, open)).toEqual({ index: 5, y: 2000 });
  });
});

describe("sectionDropIndex", () => {
  it("counts the carried section out below itself", () => {
    // «a» (1) let go above «c» (gap 3) ends third — index 2 — two places down is one gap further.
    expect(sectionDropIndex(1, { index: 3, y: 0 })).toBe(2);
    expect(sectionDropIndex(1, { index: 4, y: 0 })).toBe(3);
    // Upwards nothing is counted out.
    expect(sectionDropIndex(3, { index: 1, y: 0 })).toBe(1);
  });

  it("writes nothing at its own two gaps", () => {
    expect(sectionDropIndex(2, { index: 2, y: 0 })).toBeNull();
    expect(sectionDropIndex(2, { index: 3, y: 0 })).toBeNull();
  });
});

describe("autoScrollStep", () => {
  it("is still outside the bands, and faster the deeper the hand goes into one", () => {
    expect(autoScrollStep(400, 800, 60, 24)).toBe(0);
    expect(autoScrollStep(30, 800, 60, 24)).toBe(-12);
    expect(autoScrollStep(0, 800, 60, 24)).toBe(-24);
    expect(autoScrollStep(770, 800, 60, 24)).toBe(12);
    expect(autoScrollStep(900, 800, 60, 24)).toBe(24);
  });

  it("does nothing with no band or no viewport", () => {
    expect(autoScrollStep(0, 800, 0, 24)).toBe(0);
    expect(autoScrollStep(0, 0, 60, 24)).toBe(0);
  });
});
