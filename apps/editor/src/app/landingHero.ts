/**
 * The arithmetic and the timings of the landing's hero, kept out of the component so they can be
 * tested without a browser — the arrangement `questionnaire/proposalsRow.ts` already set for the
 * three-proposals row (sprint 21 day 2).
 *
 * **What the hero is.** A device frame holding the real page from `landingSample.ts`, which
 * changes width from a desktop to a phone and back, once, on its own — and after that only when
 * somebody asks. The page inside is not re-rendered and not swapped: its viewport narrows, so its
 * own `max-width: 720px` query fires part-way across and the sections genuinely re-lay-out. That
 * is the editor's device switch, which direction singled out — «el cliente dijo que le encanta cómo
 * transiciona de vista pc a vista móvil» — shown on the landing with nothing simulated.
 */

/** The viewport the page is laid out at in the desktop state, and the height both states show. */
export const HERO_PAGE = { width: 1280, height: 800 } as const;

/**
 * The phone state's viewport, in the page's own pixels: 390, which is what an iPhone has and the
 * width sprint 21 measured the whole application at. Comfortably below the renderer's 720px
 * breakpoint, so the page inside is unambiguously in its phone layout.
 */
export const HERO_PHONE_WIDTH = 390;

/**
 * The browser bar above the page, in the page's own pixels so that it scales with it.
 *
 * It is drawn as a percentage of the frame rather than a pixel height for one reason: the frame's
 * height has to be reserved **before any JavaScript runs**, which `aspect-ratio` does and a
 * measured pixel cannot. A bar of a fixed 40px would make the frame's total height depend on the
 * scale, and the aspect ratio would then be circular.
 */
export const HERO_BAR = 40;

/** The frame's aspect ratio, bar included — what reserves its space at first paint. */
export const HERO_ASPECT = `${HERO_PAGE.width} / ${HERO_PAGE.height + HERO_BAR}`;

/** The bar's and the page's shares of the frame's height, as CSS percentages. */
export const HERO_BAR_SHARE = `${(100 * HERO_BAR) / (HERO_PAGE.height + HERO_BAR)}%`;
export const HERO_PAGE_SHARE = `${(100 * HERO_PAGE.height) / (HERO_PAGE.height + HERO_BAR)}%`;

/**
 * The frame's width in each state, as a share of the slot it sits in.
 *
 * A percentage rather than a measured pixel so the transition survives a window resize mid-flight
 * and needs nothing from JavaScript: the phone is exactly as much narrower than the desktop as 390
 * is narrower than 1280, which is what makes the page inside land on 390 of its own pixels.
 */
export const HERO_FRAME_WIDTH = {
  desktop: "100%",
  phone: `${Math.round((10_000 * HERO_PHONE_WIDTH) / HERO_PAGE.width) / 100}%`,
} as const;

/**
 * The demonstration: one trip to the phone and back, and then it stops.
 *
 * **Once, not in a loop**, which is the budget of this sprint said in the one place it would be
 * most tempting to break: a frame that keeps flipping is an advertisement on the page it is
 * supposed to be explaining, and the restraint budget in `docs/design/REVIEW.md` gives the landing
 * one looping animation, which the background orbs already spend.
 *
 * 1500ms before it starts, so somebody arriving reads the headline and sees a still page first and
 * the movement is an answer to «what does this do» rather than the first thing that happens.
 * 3000ms in the phone state, which is long enough to take in that the page re-arranged.
 */
export const HERO_DEMO = {
  toPhoneMs: 1500,
  toDesktopMs: 4500,
  /**
   * When the hero reports `data-hero-state="rest"`: after the return trip has finished moving.
   *
   * A margin over `--ui-slow` rather than the duration itself, because this is «the demonstration
   * is over», not «the transition lasts this long» — and the e2e that reads it also waits for the
   * browser's own `getAnimations()` to be empty, so the number does not have to be exact. The
   * margin is held against the stylesheet's real token by `test/landingHero.test.ts`.
   */
  restMs: 4900,
} as const;

/**
 * How much of the frame has to be on screen before the hero loads its page and demonstrates itself.
 *
 * A bit over a third, rather than a single pixel: the point is that somebody can *see* the frame
 * rearrange, and a sliver of it at the bottom edge of a phone is not that. Nor is it so much that
 * the hero refuses to start on a short laptop window, where the frame can only ever be partly in
 * view — measured in a 1280 × 720 window, where 61 % of it is visible on load.
 */
export const HERO_IN_VIEW = 0.35;

/** The media query the hero asks before deciding whether to demonstrate anything at all. */
export const REDUCED_MOTION_MEDIA = "(prefers-reduced-motion: reduce)";

/**
 * The scale that draws the page at `HERO_PAGE.width` inside a slot this wide.
 *
 * Zero until the slot has been measured, and zero is the signal the component uses to hold the
 * iframe back: there is no sensible first guess here, because the slot is 680px on a desktop and
 * about 342 on a phone, and guessing one would mean drawing the page at the wrong size for a frame
 * before correcting it.
 */
export function heroScale(slotWidth: number): number {
  return slotWidth > 0 ? slotWidth / HERO_PAGE.width : 0;
}

/**
 * The width, in the page's own pixels, that the frame's inner box must have for the page to fill
 * it at `scale` — which is how the page's viewport tracks the frame while the frame is moving.
 *
 * Written as `calc(100% / scale)` rather than as a number so it is resolved by the browser on
 * every frame of the transition, against the width the frame has *at that moment*. A number would
 * be the width the frame will end up with, and the page would re-lay-out once, at the start, which
 * is precisely the jump this hero exists not to make.
 */
export function heroInnerWidth(scale: number): string {
  return `calc(100% / ${scale})`;
}
