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

/** The viewport the page is laid out at in the desktop state. */
export const HERO_PAGE_WIDTH = 1280;

/**
 * The phone state's viewport, in the page's own pixels: 390, which is what an iPhone has and the
 * width sprint 21 measured the whole application at. Comfortably below the renderer's 720px
 * breakpoint, so the page inside is unambiguously in its phone layout.
 */
export const HERO_PHONE_WIDTH = 390;

/** The viewport each state lays the page out at. */
export const HERO_VIEWPORT = { desktop: HERO_PAGE_WIDTH, phone: HERO_PHONE_WIDTH } as const;

export type HeroDevice = keyof typeof HERO_VIEWPORT;

/**
 * **How much of the page each state shows, and these two numbers are measurements** (sprint 23
 * day 1).
 *
 * They were one number, 800, for both states, and that was the defect David reported: «se corta en
 * extremo hasta el punto de que prácticamente lo único que se ve es parte de la imagen de portada
 * sin visualizar un botón o texto». Measured in Chromium on 16 October 2026 against the real
 * sample, in the page's own pixels:
 *
 * | | alto total | la portada acaba en | «Reservar mesa» acaba en |
 * |---|---|---|---|
 * | escritorio (1280) | 2137 | 939 | **891** |
 * | móvil (390) | 2880 | 640 | 616 |
 *
 * So at 800 the desktop state cut the cover's own button off by **91 pixels** — the photograph and
 * nothing else — while the phone state had 160 pixels to spare. One number could not serve both.
 *
 * **What each one is chosen to show: the cover whole, its button included, and a slice of the
 * section below it** so the frame reads as the top of a page rather than as a picture. Desktop
 * 1040 leaves 101 pixels of «Qué ponemos»; phone 844 leaves 204 — and 844 is also exactly an
 * iPhone 13's viewport height, so the phone state is a real phone screen rather than a crop.
 *
 * `test/heroWindow.browser.test.ts` re-measures both against the sample and fails if the cover or
 * its button ever falls outside, which is what keeps these from going stale the next time the
 * renderer or the photo bank moves.
 */
export const HERO_WINDOW = { desktop: 1040, phone: 844 } as const;

/**
 * **How wide the hero's column is allowed to be, and the floor is the decision** (sprint 24 día 2).
 *
 * David reported the mock-up «demasiado arriba», and the cause was one line: the landing's grid
 * centres its two columns vertically and the hero is much the taller of the two. Measured in
 * Chromium at 1280, 1440 and 1680 — all three identical, because the grid is capped at 1180:
 *
 * | | alto | desfase del tope |
 * |---|---|---|
 * | columna de texto | 371 | — |
 * | columna del héroe, al 45 % (531 de marco) | 548 | **89 px por encima del titular** |
 *
 * So the two columns are aligned at the top instead, and the hero's column is narrowed until the
 * two weigh something like the same. **Equal they cannot be**: the column carries 100 pixels of
 * chrome that do not scale — 12 of gap, a 41-pixel switch, 8 more and a two-line caption — so
 * matching 371 would need a frame of **321**, and at 321 the phone state is 98 pixels wide and
 * stops reading as a phone.
 *
 * **420 is that floor, and the phone state is why.** The phone frame is 30.47 % of this number
 * (`HERO_FRAME_WIDTH`), so 420 keeps it at **128 pixels** — small, still a telephone. At the floor
 * the hero's column measures 454 against the text's 371: **83 pixels of overhang, none of it above
 * the headline**, and the page drops from 1067 to 973, so more of «Cómo funciona» is in the first
 * screenful. David chose that over a bigger mock-up floating 89 pixels high.
 *
 * **The number is a Tailwind arbitrary value in `page.tsx`**, which cannot read a constant, so
 * `test/landingHero.test.ts` reads the class out of that file and asserts it matches this — the
 * same thing `canvasZoom.test.ts` does for the renderer's own breakpoint.
 */
export const HERO_COLUMN_MAX = 420;

/** The browser bar above the page, in the page's own pixels, so it scales with it. */
export const HERO_BAR = 40;

/** The taller of the two states, which is what the slot reserves while nobody has asked for one. */
export const HERO_TALLEST = Math.max(HERO_WINDOW.desktop, HERO_WINDOW.phone);

/**
 * The aspect ratio the slot reserves **before any JavaScript runs** — the tallest state, bar
 * included. `aspect-ratio` can do that against a width CSS already knows; a measured pixel cannot.
 */
export const HERO_RESERVED_ASPECT = `${HERO_PAGE_WIDTH} / ${HERO_TALLEST + HERO_BAR}`;

/**
 * The frame's width in each state, as a share of the slot it sits in.
 *
 * A percentage rather than a measured pixel so the transition survives a window resize mid-flight
 * and needs nothing from JavaScript: the phone is exactly as much narrower than the desktop as 390
 * is narrower than 1280, which is what makes the page inside land on 390 of its own pixels.
 */
export const HERO_FRAME_WIDTH = {
  desktop: "100%",
  phone: `${Math.round((10_000 * HERO_PHONE_WIDTH) / HERO_PAGE_WIDTH) / 100}%`,
} as const;

/**
 * The demonstration: one trip to the phone and back, and then it stops.
 *
 * **Once, not in a loop**, which is the budget of sprint 22 said in the one place it would be most
 * tempting to break: a frame that keeps flipping is an advertisement on the page it is supposed to
 * be explaining, and the restraint budget in `docs/design/REVIEW.md` gives the landing one looping
 * animation, which the background orbs already spend.
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
 * The scale that draws the page at `HERO_PAGE_WIDTH` inside a slot this wide.
 *
 * Zero until the slot has been measured, and zero is the signal the component uses to hold the
 * iframe back: there is no sensible first guess here, because the slot is some 560px in two
 * columns and about 342 on a phone, and guessing one would mean drawing the page at the wrong size
 * for a frame before correcting it. **The component never feeds it a zero width** — see its
 * `ResizeObserver`, and the defect that taught it.
 */
export function heroScale(slotWidth: number): number {
  return slotWidth > 0 ? slotWidth / HERO_PAGE_WIDTH : 0;
}

/**
 * The drawn height of the frame in one state: the bar plus that state's window, shrunk.
 *
 * **This is the fix for «el marco ampliado sin contenido».** Before, the frame's height came from
 * CSS (one `aspect-ratio`, both states) while the page's drawn height came from JavaScript (the
 * scale), and nothing derived one from the other — so the two agreed only while
 * `scale === slotWidth / 1280` and disagreed visibly the moment anything made them drift. Now the
 * box and the drawing come from the same two numbers, the way `thumbnailHeight` already does it
 * for a proposal's preview: «la caja es siempre exactamente la página encogida».
 */
export function heroFrameHeight(scale: number, device: HeroDevice): number {
  return (HERO_BAR + HERO_WINDOW[device]) * scale;
}

/** The slot's reserved height while nobody has chosen a state: the taller of the two. */
export function heroReservedHeight(scale: number): number {
  return (HERO_BAR + HERO_TALLEST) * scale;
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
