import { FINE_COLUMNS, type Placement } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { MAX_ROW } from "../src/editor/designTree.ts";
import { scaleOf, stretchedBox, stretchKey } from "../src/editor/stretchKeys.ts";

const press = (
  key: string,
  mods: Partial<Record<"shiftKey" | "altKey" | "ctrlKey" | "metaKey", boolean>> = {},
) => ({
  key,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

describe("stretchKey", () => {
  it("scales with + and − in either mode, whichever key the layout puts them on", () => {
    for (const stretching of [false, true]) {
      expect(stretchKey(press("+"), stretching)).toEqual({ kind: "scale", steps: 1 });
      expect(stretchKey(press("+", { shiftKey: true }), stretching)).toEqual({
        kind: "scale",
        steps: 1,
      });
      expect(stretchKey(press("="), stretching)).toEqual({ kind: "scale", steps: 1 });
      expect(stretchKey(press("-"), stretching)).toEqual({ kind: "scale", steps: -1 });
    }
  });

  it("enters and leaves «estirando» with E, and leaves with Escape and Intro", () => {
    expect(stretchKey(press("e"), false)).toEqual({ kind: "enter" });
    expect(stretchKey(press("E", { shiftKey: true }), false)).toEqual({ kind: "enter" });
    expect(stretchKey(press("e"), true)).toEqual({ kind: "leave" });
    expect(stretchKey(press("Escape"), true)).toEqual({ kind: "leave" });
    expect(stretchKey(press("Enter"), true)).toEqual({ kind: "leave" });
    // Outside it, Escape and Intro are somebody else's.
    expect(stretchKey(press("Escape"), false)).toEqual({ kind: "none" });
  });

  it("stretches with the arrows only while stretching, one unit or eight with Shift", () => {
    expect(stretchKey(press("ArrowRight"), true)).toEqual({ kind: "stretch", columns: 1, rows: 0 });
    expect(stretchKey(press("ArrowUp", { shiftKey: true }), true)).toEqual({
      kind: "stretch",
      columns: 0,
      rows: -8,
    });
    // Not stretching, the arrows move, which is the other handler's.
    expect(stretchKey(press("ArrowRight"), false)).toEqual({ kind: "none" });
  });

  it("leaves every modifier the platform owns alone", () => {
    for (const mod of ["altKey", "ctrlKey", "metaKey"] as const) {
      expect(stretchKey(press("+", { [mod]: true }), true)).toEqual({ kind: "none" });
      expect(stretchKey(press("e", { [mod]: true }), false)).toEqual({ kind: "none" });
      expect(stretchKey(press("ArrowRight", { [mod]: true }), true)).toEqual({ kind: "none" });
    }
  });
});

describe("scaleOf and stretchedBox", () => {
  const placement: Placement = { elementId: "el", column: 17, columnSpan: 32, row: 5, rowSpan: 8 };

  it("multiplies by a tenth a press", () => {
    expect(scaleOf(0)).toBe(1);
    expect(scaleOf(3)).toBeCloseTo(1.331, 6);
    expect(scaleOf(-1)).toBeCloseTo(1 / 1.1, 6);
  });

  it("moves the far edges and keeps the top-left corner, and returns only what changed", () => {
    expect(stretchedBox(placement, 8, 0)).toEqual({ columnSpan: 40 });
    expect(stretchedBox(placement, 0, -3)).toEqual({ rowSpan: 5 });
    expect(stretchedBox(placement, 0, 0)).toEqual({});
  });

  it("clamps at the grid and at one unit and one row", () => {
    expect(stretchedBox(placement, 999, 0)).toEqual({ columnSpan: FINE_COLUMNS - 17 + 1 });
    expect(stretchedBox(placement, -999, -999)).toEqual({ columnSpan: 1, rowSpan: 1 });
    expect(stretchedBox(placement, 0, 9999)).toEqual({ rowSpan: MAX_ROW - 5 + 1 });
  });
});
