import es from "../locales/es.json" with { type: "json" };
import type { Point } from "./barPosition.ts";

/**
 * **A card carried by its grip to another place in its list** (ADR 0086's día 8 amendment, sprint 41),
 * decided without a DOM.
 *
 * A list's cards run down the page (a price list) or across it in a grid that wraps (a gallery, «Qué
 * hago»), so the place a card is let go at is read in two dimensions: the card whose middle is nearest
 * the hand. That card's index is where the carried one goes — `moveItem` and `moveEntry` both take the
 * index the card ends at, removing it first — so carrying the third card onto the first makes it first,
 * and onto itself changes nothing.
 */
export interface CardBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export function cardDropIndex(cards: readonly CardBox[], point: Point): number {
  let best = 0;
  let distance = Number.POSITIVE_INFINITY;
  for (const [index, card] of cards.entries()) {
    const dx = point.x - (card.left + card.right) / 2;
    const dy = point.y - (card.top + card.bottom) / 2;
    const to = dx * dx + dy * dy;
    if (to < distance) {
      distance = to;
      best = index;
    }
  }
  return best;
}

/** One press of an arrow on the grip: the card before or after, held inside the list. */
export function cardKeyIndex(
  index: number,
  count: number,
  press: {
    readonly key: string;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
  },
): number | null {
  if (press.altKey || press.ctrlKey || press.metaKey) return null;
  const step =
    press.key === "ArrowLeft" || press.key === "ArrowUp"
      ? -1
      : press.key === "ArrowRight" || press.key === "ArrowDown"
        ? 1
        : 0;
  if (step === 0) return null;
  const next = Math.min(count - 1, Math.max(0, index + step));
  return next === index ? null : next;
}

/**
 * **What the help line says while a bound list's grip is held** (David's adjustment 3): the order of
 * a list bound to a collection is the list's, one order wherever it shows, so a card moved here moves
 * in every section that shows it — and the sentence says so, true for one section and for many.
 */
export function boundOrderSentence(places: number, list: string): string {
  return places > 1
    ? es["editor.help.grip.boundMany"].replace("{list}", list).replace("{n}", String(places))
    : es["editor.help.grip.boundOne"].replace("{list}", list);
}
