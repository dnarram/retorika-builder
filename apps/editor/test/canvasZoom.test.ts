import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NARROWEST_DESKTOP,
  NARROWEST_WIDTH,
  PHONE_BREAKPOINT,
} from "../src/editor/overflowCheck.ts";

/**
 * The canvas holds its layout width and zooms, and the number it floors at is the renderer's own.
 *
 * `PHONE_BREAKPOINT` is restated in `overflowCheck.ts` rather than imported, because
 * `packages/renderer` writes the figure into CSS text and exports no constant. That restatement
 * is only safe if something fails when the two drift, which is what this file is — the same
 * arrangement `AccountPage`'s grace window has, and for the same reason: a copied number with
 * nothing holding the copy to its source is a number that will be wrong one day without a single
 * test going red.
 *
 * If the renderer ever changes its breakpoint, this fails and names the figure to change here.
 */

const BUILD = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "packages", "renderer", "src", "build.ts"),
  "utf8",
);

describe("the canvas zoom's floor", () => {
  it("floors at the renderer's own breakpoint, read from the renderer", () => {
    const widths = [...BUILD.matchAll(/@media \(max-width: (\d+)px\)/g)].map((m) => Number(m[1]));

    expect(widths.length, "the renderer declares no media query at all any more").toBeGreaterThan(
      0,
    );
    // One breakpoint, and the editor's copy is it. `new Set` rather than checking the first: a
    // second, different breakpoint would mean "the phone layout" is no longer one thing, and the
    // floor below would be answering a question that had changed shape.
    expect(new Set(widths), "the renderer's breakpoints").toEqual(new Set([PHONE_BREAKPOINT]));
  });

  it("is one pixel past it, which is the least zoom-out that is still the desktop page", () => {
    // The whole point of the floor: at `PHONE_BREAKPOINT` the media query has already applied, so
    // a canvas laid out there is the phone. One more pixel is the narrowest desktop there is, and
    // therefore the largest the page can be drawn in whatever room a panel leaves.
    expect(NARROWEST_DESKTOP).toBe(PHONE_BREAKPOINT + 1);
    expect(NARROWEST_DESKTOP).toBeGreaterThan(PHONE_BREAKPOINT);
  });

  it("never floors the phone preview, which is narrower than the breakpoint on purpose", () => {
    // `NARROWEST_WIDTH` is the device toggle's own width and must stay below the breakpoint —
    // otherwise the "mobile" preview would be showing the desktop layout.
    expect(NARROWEST_WIDTH).toBeLessThanOrEqual(PHONE_BREAKPOINT);
  });
});
