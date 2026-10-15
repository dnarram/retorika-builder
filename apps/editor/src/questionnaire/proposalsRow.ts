/**
 * The arithmetic of the three-proposals row, kept out of the component so it can be tested
 * without a browser (sprint 21 day 2, ADR 0042 §2 and §6).
 *
 * **The thumbnail is the real page, drawn small.** Each card holds an `iframe` of the rendered
 * site laid out at a desktop width and shrunk with `transform: scale()`. The scale used to be a
 * constant, 0.28, which is right for a 358px card in the 1180px row of the mockup and for nothing
 * else: on a 390px phone the card was 60px wide and the owner saw 17 % of each proposal. So the
 * scale is the card's measured width divided by the page's, and the box's height follows.
 *
 * **Below `THREE_COLUMNS_FROM` the row is a carousel**, one card about 85 % of the width with the
 * next one peeking, snapping card to card. David chose it over stacking the three vertically: the
 * dossier calls this «la pantalla más importante del producto», the three must be compared, and a
 * stack costs some 1200px of scrolling to compare them.
 */

/** The width and height the renderer lays the thumbnail out at — a desktop page, as the mockup. */
export const THUMBNAIL_PAGE = { width: 1280, height: 900 } as const;

/** The mockup's own scale: what a 358px card showed, and the first paint before anything is measured. */
export const DESKTOP_THUMBNAIL_SCALE = 0.28;

/** The thumbnail box's hairline, which `height` has to add back because the box is `border-box`. */
export const THUMBNAIL_BORDER = 1;

/**
 * From this window width up, the three cards sit side by side as the mockup draws them. Below it
 * they would be narrower than 273px each, so the row becomes the carousel. Read through
 * `matchMedia` like every other width in the application, never from `innerWidth`.
 */
export const THREE_COLUMNS_FROM = 900;

/**
 * How much of the row one carousel card takes: enough to read, little enough that the next shows.
 * The first version said 85 % and drew 64 %: the share was applied to the row's content box, which
 * the gutters had already narrowed. The card is now the whole content box and the gutters are what
 * is left — so this number is the card's real share of the row, measured at 390 as 274 of 343.
 * 0.8 rather than 0.85 because at 390 a 7.5 % gutter minus the 12px gap left 14px of the next
 * card showing, which does not read as «there is another one»; 10 % leaves 27.
 */
export const CAROUSEL_CARD_SHARE = 0.8;

/** The proposal the row opens on — «Con foto grande», the one the cards mark «Elegida». */
export const RECOMMENDED_INDEX = 1;

/** The scale that draws the whole page inside a box this wide; the mockup's until something is measured. */
export function thumbnailScale(boxWidth: number): number {
  return boxWidth > 0 ? boxWidth / THUMBNAIL_PAGE.width : DESKTOP_THUMBNAIL_SCALE;
}

/** The thumbnail box's outer height for a scale: the shrunk page plus its two hairlines. */
export function thumbnailHeight(scale: number): number {
  return THUMBNAIL_PAGE.height * scale + 2 * THUMBNAIL_BORDER;
}

/** The side gutter that lets the first and the last card be centred like the ones between. */
export function carouselGutter(): string {
  // Rounded, because 0.15 / 2 in floating point is 7.500000000000001 and CSS has no use for it.
  return `${Math.round(((1 - CAROUSEL_CARD_SHARE) / 2) * 10_000) / 100}%`;
}

/** Where the row must be scrolled for a card at `cardLeft` to sit centred in a row this wide. */
export function centredScrollLeft(cardLeft: number, cardWidth: number, rowWidth: number): number {
  return Math.max(0, cardLeft - (rowWidth - cardWidth) / 2);
}

/** Which of `count` cards is nearest the current scroll, given the distance between two cards. */
export function nearestCard(scrollLeft: number, stride: number, count: number): number {
  if (stride <= 0 || count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(scrollLeft / stride)));
}
