import { describe, expect, it } from "vitest";
import { focusAt, focusKey, MIDDLE, pointOf, shapeOf } from "../src/editor/focalPoint.ts";

const BOX = { left: 100, right: 500, top: 50, bottom: 250 };
const press = (key: string, shiftKey = false) => ({
  key,
  shiftKey,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
});

describe("focusAt and pointOf", () => {
  it("reads the hand as whole percent of the photograph, and draws it back", () => {
    expect(focusAt({ x: 220, y: 190 }, BOX)).toEqual({ x: 30, y: 70 });
    expect(pointOf({ x: 30, y: 70 }, BOX)).toEqual({ x: 220, y: 190 });
    expect(pointOf(MIDDLE, BOX)).toEqual({ x: 300, y: 150 });
  });

  it("holds the point inside the photograph, and answers the middle for a box with no area", () => {
    expect(focusAt({ x: -40, y: 900 }, BOX)).toEqual({ x: 0, y: 100 });
    expect(focusAt({ x: 1, y: 1 }, { left: 0, right: 0, top: 0, bottom: 0 })).toEqual(MIDDLE);
  });
});

describe("focusKey", () => {
  it("moves one percent a press and ten with Shift, clamped to the photograph", () => {
    expect(focusKey({ x: 30, y: 70 }, press("ArrowLeft"))).toEqual({ x: 29, y: 70 });
    expect(focusKey({ x: 30, y: 70 }, press("ArrowDown", true))).toEqual({ x: 30, y: 80 });
    expect(focusKey({ x: 95, y: 3 }, press("ArrowRight", true))).toEqual({ x: 100, y: 3 });
    expect(focusKey({ x: 95, y: 3 }, press("ArrowUp", true))).toEqual({ x: 95, y: 0 });
  });

  it("leaves every other key, and every modifier the platform owns, alone", () => {
    expect(focusKey(MIDDLE, press("Enter"))).toBeNull();
    expect(focusKey(MIDDLE, { ...press("ArrowLeft"), metaKey: true })).toBeNull();
    expect(focusKey(MIDDLE, { ...press("ArrowLeft"), altKey: true })).toBeNull();
  });
});

describe("shapeOf", () => {
  it("is the box in whole pixels, and nothing for a box with no area", () => {
    expect(shapeOf(448.4, 300.6)).toEqual({ width: 448, height: 301 });
    expect(shapeOf(0.2, 300)).toBeNull();
  });
});
