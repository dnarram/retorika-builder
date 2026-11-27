/**
 * **A section carried by its grip on the canvas** (ADR 0087's día 11 amendment, sprint 41), decided
 * without a DOM: which gap between the page's sections the hand is nearest, what index letting go
 * there writes, and how fast the canvas scrolls when the hand is near its top or bottom.
 *
 * The section does not travel — it is taller than the screen more often than not — so the gesture
 * means «change the order», as it does on a phone (ADR 0049 §7): the section dims and a line marks
 * the gap. **A cover that opens the page and a footer that closes it keep their places**: there is no
 * gap above the cover and none below the footer, so nothing can be let go of where only they belong.
 */
export interface SectionBox {
  readonly id: string;
  readonly top: number;
  readonly bottom: number;
}

export interface SectionGap {
  /** How many sections are above it, the carried one included. */
  readonly index: number;
  /** Where its line is drawn: the top of the section below it, or the bottom of the last. */
  readonly y: number;
}

/** The gap nearest `y`, among those the page's ends allow. */
export function sectionGapAt(
  boxes: readonly SectionBox[],
  y: number,
  ends: { readonly coverFirst: boolean; readonly footerLast: boolean },
): SectionGap | null {
  const first = ends.coverFirst ? 1 : 0;
  const last = ends.footerLast ? boxes.length - 1 : boxes.length;
  let best: SectionGap | null = null;
  for (let index = first; index <= last; index += 1) {
    const at = index < boxes.length ? boxes[index]?.top : boxes[boxes.length - 1]?.bottom;
    if (at === undefined) continue;
    if (!best || Math.abs(at - y) < Math.abs(best.y - y)) best = { index, y: at };
  }
  return best;
}

/**
 * What letting go at a gap writes: the index the section ends at, **the carried one counted out**
 * below itself — the gap under the next section is one place down, since `moveSection` takes the
 * index after the section has left — or `null` at either of its own two gaps, where nothing moves.
 */
export function sectionDropIndex(from: number, gap: SectionGap): number | null {
  const to = gap.index > from ? gap.index - 1 : gap.index;
  return to === from ? null : to;
}

/**
 * How far the canvas scrolls this frame with the hand at `y` of a viewport `height` tall: nothing
 * outside the bands at its top and bottom, and inside one, faster the deeper the hand is — up to
 * `max` at the very edge or past it. Negative is up. All in the frame's pixels; the caller divides the
 * screen's band by the zoom, so the band is the same width under the hand at every zoom.
 */
export function autoScrollStep(y: number, height: number, band: number, max: number): number {
  if (band <= 0 || height <= 0) return 0;
  if (y < band) return -Math.round(max * Math.min(1, (band - y) / band));
  if (y > height - band) return Math.round(max * Math.min(1, (y - (height - band)) / band));
  return 0;
}
