import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_STUDIO_WIDTH } from "../src/editor/designTools.ts";
import {
  CANVAS_ZOOM_FLOOR,
  DESKTOP_LAYOUT_WIDTH,
  desktopLayoutWidth,
  NARROWEST_DESKTOP,
  NARROWEST_WIDTH,
  PHONE_BREAKPOINT,
} from "../src/editor/overflowCheck.ts";
import { PHONE_MEDIA } from "../src/editor/viewport.ts";

/**
 * The canvas lays out at one width and zooms, and the numbers it rests on are the renderer's own.
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

describe("the document's one breakpoint, read from the renderer", () => {
  it("is declared once in build.ts, and the editor's copy is it", () => {
    const widths = [...BUILD.matchAll(/@media \(max-width: (\d+)px\)/g)].map((m) => Number(m[1]));

    expect(widths.length, "the renderer declares no media query at all any more").toBeGreaterThan(
      0,
    );
    // One breakpoint for the document, and the editor's copy is it. `new Set` rather than checking
    // the first: a second, different breakpoint in `build.ts` would mean "the phone layout" is no
    // longer one thing. (The header has thresholds of its own since sprint 31 — ADR 0060 — and
    // writes them from `header.ts`, which is deliberately not read here: those fold a rail, they
    // do not change which layout the document is in.)
    expect(new Set(widths), "the renderer's breakpoints").toEqual(new Set([PHONE_BREAKPOINT]));
  });

  it("puts the narrowest desktop one pixel past it, which is the least that is still the desktop page", () => {
    // At `PHONE_BREAKPOINT` the media query has already applied, so a canvas laid out there is the
    // phone. One more pixel is the narrowest desktop there is.
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
 * **The desktop canvas lays out at 1280 and scales** (ADR 0061, sprint 31 día 1).
 *
 * The room the panels leave used to be the layout width, floored at `NARROWEST_DESKTOP`, so the
 * canvas was a different page at every window and with every panel. Now it is `DESKTOP_LAYOUT_WIDTH`
 * wherever that still zooms at or above David's legibility floor, and narrower only under it — and
 * then the card says so. The rooms below are the ones measured in Chromium on 30 October 2026
 * before the formula was written (window 1024 / 1280 / 1440 / 1680, with no panel and with «Menú»).
 */
describe("the desktop layout width", () => {
  const zoomFor = (room: number) => Math.min(1, room / desktopLayoutWidth(room));

  it("is the published page's own width, and above the phone's", () => {
    expect(DESKTOP_LAYOUT_WIDTH).toBe(1280);
    expect(DESKTOP_LAYOUT_WIDTH).toBeGreaterThan(PHONE_BREAKPOINT);
    // The studio's own minimum window (ADR 0025 §5) is narrower than the page: the page zooms.
    expect(DESKTOP_LAYOUT_WIDTH).toBeGreaterThan(MIN_STUDIO_WIDTH);
  });

  it("is 1280 at every room that zooms at or above the floor", () => {
    for (const room of [1008, 788, 1168, 948, 1408, 1188]) {
      expect(desktopLayoutWidth(room), `room ${room}`).toBe(DESKTOP_LAYOUT_WIDTH);
      expect(zoomFor(room), `zoom at room ${room}`).toBeGreaterThanOrEqual(CANVAS_ZOOM_FLOOR);
    }
    // A 1280 laptop with «Menú» open is the closest call there is: 788 of room, 0.6156.
    expect(zoomFor(788)).toBeCloseTo(0.6156, 3);
    // More room than the page needs is grey at either side, never a magnified page.
    expect(zoomFor(1408)).toBe(1);
  });

  it("gives up width before legibility under the floor, and says so", () => {
    // A 1024 window: 752 of room with no panel, 532 with one. Both would zoom under 0.6 at 1280,
    // so the width comes down to exactly where 0.6 holds — and the shell shows «Vista a N px».
    expect(desktopLayoutWidth(752)).toBeCloseTo(1253.33, 1);
    expect(desktopLayoutWidth(532)).toBeCloseTo(886.67, 1);
    expect(zoomFor(752)).toBeCloseTo(CANVAS_ZOOM_FLOOR, 6);
    expect(zoomFor(532)).toBeCloseTo(CANVAS_ZOOM_FLOOR, 6);
    // The boundary itself: 768 of room is the least that is still the 1280 page.
    expect(desktopLayoutWidth(768)).toBe(DESKTOP_LAYOUT_WIDTH);
    expect(desktopLayoutWidth(767)).toBeLessThan(DESKTOP_LAYOUT_WIDTH);
  });

  it("never lays the desktop page out narrower than the desktop, whatever the room", () => {
    // Under 433 px of room the desktop floor wins over the legibility floor, as it did before
    // this function existed: a 768 tablet with a panel open is 276 of room and a page at 721.
    for (const room of [276, 400, 432, 0]) {
      expect(desktopLayoutWidth(room), `room ${room}`).toBe(NARROWEST_DESKTOP);
    }
    expect(zoomFor(276)).toBeLessThan(CANVAS_ZOOM_FLOOR);
  });

  it("is monotone in the room, so a panel opening never makes the page wider", () => {
    let previous = desktopLayoutWidth(0);
    for (let room = 1; room <= 1700; room += 1) {
      const width = desktopLayoutWidth(room);
      expect(width, `room ${room}`).toBeGreaterThanOrEqual(previous);
      previous = width;
    }
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
