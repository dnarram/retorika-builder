import { FINE_COLUMNS, type Placement, ROLES, type Theme } from "@retorika/schema";
import { buildTheme, STARTING_PALETTE_ID } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { cornerMeaning } from "../src/editor/cornerMeaning.ts";
import { MAX_ROW } from "../src/editor/designTree.ts";
import {
  isCorner,
  LETTER_CEILING_PX,
  LETTER_FLOOR_PX,
  scaledBox,
  scaledLetter,
  scaleFactor,
} from "../src/editor/scaleBox.ts";

/** A 400 × 100 box at (100, 50): its diagonals are the long way round, so a pull along one is
 * unmistakably not a pull along a side. */
const BOX = { left: 100, right: 500, top: 50, bottom: 150 };

describe("cornerMeaning", () => {
  it("scales the letter of everything that is words, the photo of an image, the box of the rest", () => {
    // Written out per role, so a role added to the vocabulary has to be placed here on purpose.
    const expected = {
      heading: "letter",
      subheading: "letter",
      body: "letter",
      button: "letter",
      link: "letter",
      map: "letter",
      image: "photo",
      list: "box",
      field: "box",
      embed: "box",
    } as const;
    expect(Object.keys(expected).sort()).toEqual([...ROLES].sort());
    for (const role of ROLES) expect(cornerMeaning(role), role).toBe(expected[role]);
  });
});

describe("isCorner", () => {
  it("is the four corners and none of the four sides", () => {
    expect(["nw", "ne", "sw", "se"].every((edge) => isCorner(edge as "nw"))).toBe(true);
    expect(["left", "right", "top", "bottom"].some((edge) => isCorner(edge as "left"))).toBe(false);
  });
});

describe("scaleFactor", () => {
  const from = { x: 500, y: 150 };

  it("is the hand's travel along the diagonal, outwards past one and inwards under it", () => {
    // The south-east corner's diagonal is (400, 100) from the north-west anchor: the same vector
    // again is twice the box, half of it back is half.
    expect(scaleFactor({ box: BOX, corner: "se", from, now: { x: 900, y: 250 } })).toBeCloseTo(2);
    expect(scaleFactor({ box: BOX, corner: "se", from, now: { x: 300, y: 100 } })).toBeCloseTo(0.5);
    expect(scaleFactor({ box: BOX, corner: "se", from, now: from })).toBe(1);
  });

  it("ignores travel across the diagonal", () => {
    // Perpendicular to (400, 100) is (−100, 400): the hand moved and the box did not.
    expect(scaleFactor({ box: BOX, corner: "se", from, now: { x: 400, y: 550 } })).toBeCloseTo(1);
  });

  it("reads each corner against its own anchor", () => {
    // Pulling the north-west corner up and left, away from the south-east anchor, grows the box.
    const nw = { x: 100, y: 50 };
    expect(scaleFactor({ box: BOX, corner: "nw", from: nw, now: { x: -300, y: -50 } })).toBeCloseTo(
      2,
    );
    // The north-east corner's diagonal runs up and right from the south-west anchor.
    const ne = { x: 500, y: 50 };
    expect(scaleFactor({ box: BOX, corner: "ne", from: ne, now: { x: 900, y: -50 } })).toBeCloseTo(
      2,
    );
    const sw = { x: 100, y: 150 };
    expect(scaleFactor({ box: BOX, corner: "sw", from: sw, now: { x: -300, y: 250 } })).toBeCloseTo(
      2,
    );
  });

  it("never goes under zero, and a box with no diagonal answers one", () => {
    expect(scaleFactor({ box: BOX, corner: "se", from, now: { x: -900, y: -200 } })).toBe(0);
    const flat = { left: 100, right: 100, top: 50, bottom: 50 };
    expect(scaleFactor({ box: flat, corner: "se", from, now: { x: 900, y: 250 } })).toBe(1);
  });
});

describe("scaledLetter", () => {
  // The default scale: heading 40 px, subheading 24, body 16.
  const theme: Theme = buildTheme({ paletteId: STARTING_PALETTE_ID, typePairId: "modern-sans" });
  const exact = (px: number) => ({ exact: `${px}px`, exception: true as const });

  it("writes the scaled letter as a marked exception, rounded to a pixel", () => {
    expect(scaledLetter({ basePx: 40, factor: 1.3, theme, current: undefined })).toEqual({
      value: exact(52),
      px: 52,
      factor: 1.3,
    });
  });

  it("writes the reference when the hand lands within two pixels of a system size", () => {
    // 40 × 0.61 = 24.4: the subheading's 24, by reference and not as «24px».
    expect(scaledLetter({ basePx: 40, factor: 0.61, theme, current: undefined })).toEqual({
      value: { ref: "size.subheading" },
      px: 24,
      factor: 0.6,
    });
    // And 40 × 0.42 = 16.8 is the body's 16.
    expect(scaledLetter({ basePx: 40, factor: 0.42, theme, current: undefined }).value).toEqual({
      ref: "size.body",
    });
    // Three pixels off is not on it.
    expect(scaledLetter({ basePx: 40, factor: 0.675, theme, current: undefined }).value).toEqual(
      exact(27),
    );
  });

  it("writes nothing when the hand lands on the size the element already draws with no size of its own", () => {
    // A headline drawn at the heading's 40 px, with no `fontSize` of its own, pulled by a pixel:
    // no exception and no reference, the element's own size again.
    expect(scaledLetter({ basePx: 40, factor: 1.02, theme, current: undefined })).toEqual({
      value: undefined,
      px: 40,
      factor: 1,
    });
    // The same hand on a headline that *had* a size of its own writes the reference it landed on.
    expect(scaledLetter({ basePx: 40, factor: 1.02, theme, current: exact(40) }).value).toEqual({
      ref: "size.heading",
    });
  });

  it("holds the floor and the ceiling, and the box's factor follows the letter's", () => {
    const small = scaledLetter({ basePx: 40, factor: 0.1, theme, current: undefined });
    expect(small.px).toBe(LETTER_FLOOR_PX);
    expect(small.factor).toBeCloseTo(LETTER_FLOOR_PX / 40);
    const huge = scaledLetter({ basePx: 40, factor: 9, theme, current: undefined });
    expect(huge.px).toBe(LETTER_CEILING_PX);
    expect(huge.factor).toBeCloseTo(LETTER_CEILING_PX / 40);
  });

  it("judges the magnet against the theme's own scale", () => {
    // The generous scale's heading is 48 px: 40 × 1.2 lands on it there and on nothing at the default.
    const generous: Theme = { ...theme, "size.heading": "3rem" };
    expect(
      scaledLetter({ basePx: 40, factor: 1.2, theme: generous, current: undefined }).value,
    ).toEqual({ ref: "size.heading" });
    expect(scaledLetter({ basePx: 40, factor: 1.2, theme, current: undefined }).value).toEqual(
      exact(48),
    );
  });
});

describe("scaledBox", () => {
  const placement: Placement = {
    elementId: "el",
    column: 17,
    columnSpan: 32,
    row: 5,
    rowSpan: 8,
  };

  it("scales both spans from the south-east corner, the north-west corner staying put", () => {
    expect(scaledBox(placement, "se", 1.5)).toEqual({ columnSpan: 48, rowSpan: 12 });
    expect(scaledBox(placement, "se", 0.5)).toEqual({ columnSpan: 16, rowSpan: 4 });
  });

  it("moves the start so the far edge does not, from the other three corners", () => {
    // Last column 48 and last row 12 before and after.
    expect(scaledBox(placement, "nw", 1.5)).toEqual({
      column: 1,
      columnSpan: 48,
      row: 1,
      rowSpan: 12,
    });
    expect(scaledBox(placement, "ne", 0.5)).toEqual({ columnSpan: 16, row: 9, rowSpan: 4 });
    expect(scaledBox(placement, "sw", 0.5)).toEqual({ column: 33, columnSpan: 16, rowSpan: 4 });
  });

  it("returns only what changed, and nothing for a factor of one", () => {
    expect(scaledBox(placement, "se", 1)).toEqual({});
    expect(scaledBox(placement, "se", 1.01)).toEqual({});
  });

  it("clamps at the grid's edges and at one unit, never refusing", () => {
    // Right: column 17 leaves 80 units to the edge.
    expect(scaledBox(placement, "se", 9).columnSpan).toBe(FINE_COLUMNS - 17 + 1);
    // Left: the far edge is column 48, so the span can be at most 48 and the start at least 1.
    expect(scaledBox(placement, "nw", 9)).toMatchObject({ column: 1, columnSpan: 48 });
    // Down: the floor on rows.
    expect(scaledBox(placement, "se", 100).rowSpan).toBe(MAX_ROW - 5 + 1);
    // Shrunk to nothing is one unit and one row, not zero.
    expect(scaledBox(placement, "se", 0)).toEqual({ columnSpan: 1, rowSpan: 1 });
    expect(scaledBox(placement, "nw", 0)).toEqual({
      column: 48,
      columnSpan: 1,
      row: 12,
      rowSpan: 1,
    });
  });
});
