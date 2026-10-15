import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HERO_ASPECT,
  HERO_BAR,
  HERO_BAR_SHARE,
  HERO_DEMO,
  HERO_FRAME_WIDTH,
  HERO_PAGE,
  HERO_PAGE_SHARE,
  HERO_PHONE_WIDTH,
  heroInnerWidth,
  heroScale,
} from "../src/app/landingHero.ts";
import { PHONE_BREAKPOINT } from "../src/editor/overflowCheck.ts";

/** The stylesheet, read rather than restated — the arrangement `chromeContrast.test.ts` set. */
const CSS = readFileSync(
  join(import.meta.dirname, "..", "src", "app", "globals.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

function ms(name: string): number {
  const found = CSS.match(new RegExp(`--ui-${name}:\\s*([0-9.]+)ms\\s*;`));
  if (!found?.[1]) throw new Error(`globals.css declares no --ui-${name}`);
  return Number(found[1]);
}

describe("the landing hero's geometry", () => {
  /**
   * **The claim the whole hero rests on**: that the phone state really is the phone layout.
   *
   * The frame narrowing is only worth watching because the page inside crosses the renderer's own
   * breakpoint on the way and re-lays-out. If somebody raised `HERO_PHONE_WIDTH` above 720 the
   * animation would still look fine and would be showing a desktop page in a narrow box — a
   * demonstration of nothing, with nothing to tell you so.
   */
  it("puts the phone state inside the renderer's phone layout", () => {
    expect(HERO_PHONE_WIDTH).toBeLessThan(PHONE_BREAKPOINT);
    expect(HERO_PAGE.width).toBeGreaterThan(PHONE_BREAKPOINT);
  });

  it("narrows the frame by exactly as much as the page narrows", () => {
    // What makes the page land on 390 of its own pixels: the share is the ratio, not a round number
    // somebody liked.
    const share = Number(HERO_FRAME_WIDTH.phone.replace("%", "")) / 100;
    expect(share).toBeCloseTo(HERO_PHONE_WIDTH / HERO_PAGE.width, 4);
    expect(HERO_FRAME_WIDTH.desktop).toBe("100%");
  });

  it("reserves its height before any JavaScript runs", () => {
    // `aspect-ratio` on the slot, bar included, so the frame's box is the right size at first
    // paint and the deferred iframe arrives into a space that is already open.
    expect(HERO_ASPECT).toBe(`${HERO_PAGE.width} / ${HERO_PAGE.height + HERO_BAR}`);
    const bar = Number(HERO_BAR_SHARE.replace("%", ""));
    const page = Number(HERO_PAGE_SHARE.replace("%", ""));
    expect(bar + page).toBeCloseTo(100, 6);
  });

  it("scales the page to the slot, and holds the iframe back until it knows the slot", () => {
    expect(heroScale(1280)).toBe(1);
    expect(heroScale(680)).toBeCloseTo(0.53125, 5);
    // Zero rather than a guess: there is no sensible first value for a slot that is 680px on a
    // desktop and about 342 on a phone, and the component reads zero as «not measured yet».
    expect(heroScale(0)).toBe(0);
  });

  it("asks the browser to resolve the page's width on every frame of the travel", () => {
    // A percentage, so it is resolved against the width the frame has *at that moment*. A number
    // would be the width the frame ends with, and the page would re-lay-out once, at the start.
    expect(heroInnerWidth(0.5)).toBe("calc(100% / 0.5)");
  });
});

describe("the landing hero's one demonstration", () => {
  it("waits before it starts, and stays long enough to be read", () => {
    expect(HERO_DEMO.toPhoneMs).toBeGreaterThanOrEqual(1000);
    expect(HERO_DEMO.toDesktopMs - HERO_DEMO.toPhoneMs).toBeGreaterThanOrEqual(2000);
  });

  /**
   * **`rest` has to mean rest**, because it is what the e2e waits for before measuring anything on
   * this page. If the margin over the stylesheet's own reflow duration were ever lost, the phone
   * walk would measure a frame still in motion — the ADR 0042 failure, in the one place this
   * sprint deliberately animates a width.
   */
  it("reports rest only after the return trip has finished moving", () => {
    expect(HERO_DEMO.restMs).toBeGreaterThan(HERO_DEMO.toDesktopMs + ms("slow"));
  });
});
