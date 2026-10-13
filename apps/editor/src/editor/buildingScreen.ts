/**
 * How long the building screen holds the download back, and nothing else.
 *
 * The screen covers real work — the overflow measurement, the photographs, the request, the ZIP —
 * and then **holds for a minimum**, which is David's decision of 13 October 2026, in his words:
 * «un mínimo de unos dos segundos, para que el momento se perciba». That is an added wait, said
 * as such here and in `docs/design/REVIEW.md`, and the screen's own text promises no duration
 * (the lesson of mockup 11: «desaparecerá solo en unos segundos» was cut because the product could
 * not keep it). The ZIP is handed over the instant the hold ends, and the screen goes with it.
 *
 * Pure, so the arithmetic is tested without a clock: the caller measures and waits.
 */
export const MIN_BUILDING_MS = 2000;

/** How much longer to wait before releasing the download: zero when the work already took longer. */
export function holdFor(startedAt: number, readyAt: number, minimum = MIN_BUILDING_MS): number {
  const elapsed = Math.max(0, readyAt - startedAt);
  return Math.max(0, minimum - elapsed);
}
