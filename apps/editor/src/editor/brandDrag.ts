import { LOGO_HEIGHTS } from "@retorika/renderer";
import {
  BRAND_NAME_SIZES,
  type BrandNameSize,
  type Header,
  LOGO_SIZES,
  type LogoSize,
  type RetorikaDocument,
} from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };
import type { Point } from "./barPosition.ts";
import { type BrandState, brandPlacePatch, logoSizePatch, nameSizePatch } from "./headerState.ts";
import type { Rect, ZoneRectOf } from "./menuDrag.ts";
import { PHONE_BREAKPOINT } from "./overflowCheck.ts";

/**
 * **The brand is dragged to its place, and the logo is stretched to its size** (ADR 0070 §5 and
 * ADR 0069; sprint 35 día 6, David's third decision), decided without a DOM — the split
 * `menuDrag.ts` made for the menus, and the same judgement: which zones the brand has and where
 * each one lies on the bar, which one a point is over, what letting go there writes (the very patch
 * the panel's «Dónde va la marca» segment writes, and nothing else), and what the live region says.
 * The gesture chooses between the three words and makes none: no coordinate reaches the document.
 *
 * **The zones are the bar in thirds**, in the bar's own box: the words are «al principio, en medio,
 * al final» of the brand's line, and the thirds are where the eye would look for each — on the
 * stacked bar the brand's own line is inside the same box, so the thirds are the same thirds. None
 * in the phone view, as for a menu (`zonesFor`): the brand's place on a phone is the renderer's
 * derivation (ADR 0070 §4), not a choice. And none where the brand has gone into a column with the
 * pages: its place in the bar is inert there, and a zone that writes a word nobody sees is the
 * canvas promising what the page does not do.
 *
 * **The logo's edge steps through the three sizes**: a pull of the bottom, the right or the corner
 * lands on whichever of 28, 40 and 56 is nearest the height the hand has reached. The ghost says the
 * word and the pixels, the drop writes `logoSizePatch`, and between words the ghost is already
 * drawn at the next one, so the hand sees where it is going before it lets go.
 */

export type BrandPlace = BrandState["place"];
export const BRAND_PLACES: readonly BrandPlace[] = ["start", "center", "end"];

export interface BrandZone {
  readonly zone: BrandPlace;
  /** The panel's own word for the place, so the zone and the segment say the same thing. */
  readonly label: string;
  /** The brand is there now: dropping here writes nothing. */
  readonly current: boolean;
}

/** The zones of the brand at a layout width, or none where the gesture does not exist. */
export function brandZonesFor(brand: BrandState, layoutWidth: number): BrandZone[] {
  if (layoutWidth <= PHONE_BREAKPOINT || !brand.shown || brand.inRail) return [];
  return BRAND_PLACES.map((zone) => ({
    zone,
    label: es[`editor.menuPanel.place.${zone}`],
    current: zone === brand.place,
  }));
}

export type BrandZoneRect = ZoneRectOf<BrandPlace>;

/** The bar's box in thirds, left to right: the start, the middle, the end of the brand's line. */
export function brandZoneRects(zones: readonly BrandZone[], bar: Rect): BrandZoneRect[] {
  const third = bar.width / 3;
  return zones.map(({ zone }) => ({
    zone,
    left: bar.left + BRAND_PLACES.indexOf(zone) * third,
    top: bar.top,
    width: third,
    height: bar.height,
  }));
}

export type BrandDropOutcome =
  | { readonly kind: "none" }
  | { readonly kind: "write"; readonly zone: BrandPlace; readonly patch: Partial<Header> };

/**
 * What letting go over `zone` does: nothing over no zone or the place the brand is drawn at — the
 * renderer's reading of the document, so a drop on the layout's own place with the key absent writes
 * nothing — and otherwise the segment's patch: one `setHeader`, one step of history.
 */
export function brandDropOutcome(
  zone: BrandPlace | null,
  brand: BrandState,
  doc: RetorikaDocument,
): BrandDropOutcome {
  if (zone === null || zone === brand.place) return { kind: "none" };
  return { kind: "write", zone, patch: brandPlacePatch(doc, zone) };
}

/** What the live region says once the brand has landed: «Marca: en medio». */
export function brandDropText(zone: BrandPlace): string {
  const place = es[`editor.menuPanel.place.${zone}`];
  return es["editor.brandDrag.dropped"].replace(
    "{zone}",
    place.charAt(0).toLowerCase() + place.slice(1),
  );
}

export interface LogoStep {
  readonly size: LogoSize;
  /** The height the page draws that size at, on a wide screen. */
  readonly px: number;
  /** The ghost's word: «Grande · 56 px». */
  readonly label: string;
}

/**
 * The size nearest the height a pull has reached: the logo's drawn height plus how far the hand
 * has gone down (or right, scaled to the logo's ratio by the caller). Ties go to the larger size,
 * which is the direction a hand that has moved at all is moving in.
 */
export function logoStep(startHeight: number, delta: number): LogoStep {
  const reached = startHeight + delta;
  let best: LogoSize = LOGO_SIZES[0];
  for (const size of LOGO_SIZES) {
    const better = Math.abs(LOGO_HEIGHTS[size] - reached);
    const sofar = Math.abs(LOGO_HEIGHTS[best] - reached);
    if (better < sofar || (better === sofar && LOGO_HEIGHTS[size] > LOGO_HEIGHTS[best]))
      best = size;
  }
  return stepOf(best);
}

export function stepOf(size: LogoSize): LogoStep {
  const px = LOGO_HEIGHTS[size];
  return {
    size,
    px,
    label: es["editor.brandDrag.logoStep"]
      .replace("{size}", es[`editor.menuPanel.logoSize.${size}`])
      .replace("{px}", String(px)),
  };
}

/** What letting go of the logo's edge writes: nothing at the size it has, the size's patch otherwise. */
export function logoDropOutcome(
  step: LogoStep | null,
  brand: BrandState,
  doc: RetorikaDocument,
): { kind: "none" } | { kind: "write"; size: LogoSize; patch: Partial<Header> } {
  if (step === null || step.size === brand.logoSize) return { kind: "none" };
  return { kind: "write", size: step.size, patch: logoSizePatch(doc, step.size) };
}

/** What the live region says once the logo has its size: «Logo: grande». */
export function logoDropText(size: LogoSize): string {
  const word = es[`editor.menuPanel.logoSize.${size}`];
  return es["editor.brandDrag.logoDropped"].replace("{size}", word.toLowerCase());
}

export interface NameStep {
  readonly size: BrandNameSize;
  /** The font size the page draws that word at, on a wide screen. */
  readonly px: number;
  /** The ghost's word: «Grande · 48 px». */
  readonly label: string;
}

/**
 * **The name's edge steps through its three words, as the logo's does through its three heights**
 * (sprint 41 día 10b, ADR 0069's note; `logoStep`'s sister, the second use — a third would earn the
 * shared shape).
 *
 * The hand's pull is read as a stretch of the name's own box: its height grows by `delta`, so the
 * font size the hand has reached is the drawn one scaled by the same ratio, and the word is the one
 * whose size is nearest — `sizes` being the pixels the page draws the three words at, measured by the
 * caller (the reading size is 0.875 of itself on a «small» bar). Ties go to the larger word, the
 * direction a hand that has moved at all is moving in.
 */
export function nameStep(
  sizes: Readonly<Record<BrandNameSize, number>>,
  drawnPx: number,
  boxHeight: number,
  delta: number,
): NameStep {
  const reached = boxHeight > 0 ? (drawnPx * (boxHeight + delta)) / boxHeight : drawnPx;
  let best: BrandNameSize = BRAND_NAME_SIZES[0];
  for (const size of BRAND_NAME_SIZES) {
    const better = Math.abs(sizes[size] - reached);
    const sofar = Math.abs(sizes[best] - reached);
    if (better < sofar || (better === sofar && sizes[size] > sizes[best])) best = size;
  }
  return nameStepOf(best, sizes[best]);
}

/**
 * The three words' pixels from the page's own tokens: the reading size is 0.875 of itself on a
 * «small» bar, as the stylesheet's `data-size` rule draws it, and the other two are the scale's.
 */
export function nameSizesOf(
  tokens: Readonly<Record<BrandNameSize, number>>,
  small: boolean,
): Record<BrandNameSize, number> {
  return { ...tokens, body: small ? tokens.body * 0.875 : tokens.body };
}

export function nameStepOf(size: BrandNameSize, px: number): NameStep {
  return {
    size,
    px,
    label: es["editor.brandDrag.nameStep"]
      .replace("{size}", es[`editor.menuPanel.nameSize.${size}`])
      .replace("{px}", String(Math.round(px))),
  };
}

/** What letting go of the name's edge writes: nothing at the word it has, the word's patch otherwise. */
export function nameDropOutcome(
  step: NameStep | null,
  brand: BrandState,
  doc: RetorikaDocument,
): { kind: "none" } | { kind: "write"; nameSize: BrandNameSize; patch: Partial<Header> } {
  if (step === null || step.size === brand.nameSize) return { kind: "none" };
  return { kind: "write", nameSize: step.size, patch: nameSizePatch(doc, step.size) };
}

/** What the live region says once the name has its word: «Nombre: grande». */
export function nameDropText(size: BrandNameSize): string {
  const word = es[`editor.menuPanel.nameSize.${size}`];
  return es["editor.brandDrag.nameDropped"].replace("{size}", word.toLowerCase());
}

/** A point's distance below and right of a box's bottom-right corner — what a pull of the logo's
 * edge is measured by, each axis in the logo's own height (the width scaled by its ratio). */
export function pulledHeight(
  from: Point,
  to: Point,
  box: { readonly width: number; readonly height: number },
  edge: "bottom" | "right" | "se",
): number {
  const ratio = box.width > 0 ? box.height / box.width : 1;
  const down = to.y - from.y;
  const across = (to.x - from.x) * ratio;
  if (edge === "bottom") return down;
  if (edge === "right") return across;
  return Math.max(down, across);
}
