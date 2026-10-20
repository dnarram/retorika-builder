/**
 * **The alignment guides** (ADR 0050, sprint 25 día 5), decided without a DOM.
 *
 * David asked for them when he chose the fine grid: «Sí, guías de alineación». They are what makes
 * a grid of ninety-six units usable by hand — a unit is 7–10 px, so «line this up with that» is a
 * thing the eye can want and the hand cannot hit. The element is magnetised to its neighbours'
 * edges and centres and to the centre of the section, and **the guide wins inside the threshold;
 * outside it, the fine grid decides** as it did before.
 *
 * **Lines in, a displacement out.** The caller says which of the moving thing's lines are live — a
 * drag offers three per axis (left, centre, right), a resize offers only the border being pulled —
 * and this answers with how far to shift, plus the lines to draw. It knows nothing about pixels
 * being screen or frame ones: the caller divides the threshold by the canvas zoom, so «six pixels»
 * is six under the hand at every width (David's adjustment 3).
 *
 * **No vertical candidate for the section itself, and that is deliberate.** A section's height is
 * its content's, so its vertical centre moves while the thing being dragged is still in the air —
 * a magnet to a line that moves with you is not a guide. Horizontally the content box is fixed by
 * the canvas, so its centre is a real place to put something.
 */

/** Six pixels of the screen, the same number the edge zone uses — and for the same reason: it is
 * what a hand aiming at a line is worth. Divided by the canvas zoom by the caller. */
export const GUIDE_ZONE = 6;

/** A box in whatever coordinates the caller is using; a `DOMRect` fits. */
export interface Rect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** A line to draw, in the caller's own coordinates. `x` is vertical on screen — it marks a
 * position along the x axis — which is the one place this vocabulary reads backwards. */
export interface Guide {
  readonly axis: "x" | "y";
  readonly at: number;
}

export interface Guided {
  readonly dx: number;
  readonly dy: number;
  readonly lines: readonly Guide[];
}

const NONE: Guided = { dx: 0, dy: 0, lines: [] };

/** The three lines a neighbour offers on each axis: its two edges and its middle. */
function candidatesX(others: readonly Rect[], centreX: number | undefined): number[] {
  const out: number[] = [];
  for (const other of others) out.push(other.left, (other.left + other.right) / 2, other.right);
  // The section's own centre last, so a neighbour's line wins a tie: lining up with something on
  // the page is a stronger intention than lining up with the middle of nothing.
  if (centreX !== undefined) out.push(centreX);
  return out;
}

function candidatesY(others: readonly Rect[]): number[] {
  const out: number[] = [];
  for (const other of others) out.push(other.top, (other.top + other.bottom) / 2, other.bottom);
  return out;
}

/** The nearest candidate to any live line, and how far it is — or nothing within the threshold. */
function snap(
  lines: readonly number[],
  candidates: readonly number[],
  threshold: number,
): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null;
  for (const candidate of candidates) {
    for (const line of lines) {
      const delta = candidate - line;
      if (Math.abs(delta) > threshold) continue;
      // Strictly nearer, so an earlier candidate keeps a tie and the answer is deterministic.
      if (best === null || Math.abs(delta) < Math.abs(best.delta)) best = { delta, at: candidate };
    }
  }
  return best;
}

/**
 * How far to shift the thing being moved so it lines up, and which lines to draw.
 *
 * Each axis is decided on its own: a drag can snap sideways and be free vertically, which is what
 * lining up a column of texts feels like. `{ dx: 0, dy: 0, lines: [] }` is «nothing is near», and
 * the fine grid then does what it always did.
 */
export function guidesFor(args: {
  /** The moving thing's live lines along the x axis — a drag's left, centre and right; a resize's
   * pulled border and nothing else. */
  readonly x: readonly number[];
  readonly y: readonly number[];
  /** Every other placed element's box. The moving one is not in here: the caller leaves it out,
   * because an element lining up with itself is not a guide. */
  readonly others: readonly Rect[];
  /** The centre of the section's content box along the x axis, or nothing to leave it out. */
  readonly centreX?: number;
  readonly threshold: number;
}): Guided {
  const { x, y, others, centreX, threshold } = args;
  if (threshold <= 0) return NONE;

  const alongX = x.length > 0 ? snap(x, candidatesX(others, centreX), threshold) : null;
  const alongY = y.length > 0 ? snap(y, candidatesY(others), threshold) : null;

  const lines: Guide[] = [];
  if (alongX) lines.push({ axis: "x", at: alongX.at });
  if (alongY) lines.push({ axis: "y", at: alongY.at });

  return { dx: alongX?.delta ?? 0, dy: alongY?.delta ?? 0, lines };
}
