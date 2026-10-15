import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_STUDIO_WIDTH } from "../src/editor/designTools.ts";
import {
  NARROWEST_DESKTOP,
  NARROWEST_WIDTH,
  PHONE_BREAKPOINT,
} from "../src/editor/overflowCheck.ts";
import { PHONE_MEDIA } from "../src/editor/viewport.ts";

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

const GLOBALS = readFileSync(join(import.meta.dirname, "..", "src", "app", "globals.css"), "utf8");

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

/**
 * The application's own width classes (ADR 0042) are the same two numbers, written in CSS.
 *
 * `globals.css` declares `phone`, `tablet` and `studio` as `@custom-variant`s because a stylesheet
 * cannot import a constant, and `viewport.ts` builds the one media query JavaScript needs from the
 * constant directly. Three copies of a boundary are three ways for it to be wrong by a pixel, so
 * this is what holds them together: the CSS is parsed for its numbers and each must be the constant
 * it restates. If `PHONE_BREAKPOINT` or `MIN_STUDIO_WIDTH` ever moves, this names the lines to edit.
 */
describe("the application's width classes", () => {
  const variant = (name: string) =>
    GLOBALS.match(new RegExp(`@custom-variant ${name} \\(@media \\(([^)]*)\\)\\);`))?.[1] ?? "";

  it("ends the phone where the published site's phone layout begins", () => {
    expect(variant("phone")).toBe(`width <= ${PHONE_BREAKPOINT}px`);
    expect(PHONE_MEDIA).toBe(`(max-width: ${PHONE_BREAKPOINT}px)`);
  });

  it("starts the studio where ADR 0025 §5 does, and the tablet is what lies between", () => {
    expect(variant("studio")).toBe(`width >= ${MIN_STUDIO_WIDTH}px`);
    expect(variant("tablet")).toBe(`${PHONE_BREAKPOINT}px < width < ${MIN_STUDIO_WIDTH}px`);
  });
});
