import { describe, expect, it } from "vitest";
import { canvasModeFrom, DEFAULT_CANVAS_MODE } from "../src/editor/canvasMode.ts";

describe("the canvas route is read from what is stored, once", () => {
  it("takes the two routes by name and nothing else", () => {
    expect(canvasModeFrom("patch")).toBe("patch");
    expect(canvasModeFrom("swap")).toBe("swap");
  });

  it("falls back to the default for anything it does not know, including nothing", () => {
    for (const stored of [null, undefined, "", "PATCH", "yes", "1"]) {
      expect(canvasModeFrom(stored)).toBe(DEFAULT_CANVAS_MODE);
    }
  });

  it("defaults to swap until día 5 turns it around", () => {
    // Written as a test so the day that flips the default has to touch this line and say why.
    expect(DEFAULT_CANVAS_MODE).toBe("swap");
  });
});
