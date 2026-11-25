import type { Point } from "./barPosition.ts";
import type { EdgeBox } from "./resizeBox.ts";

/**
 * **The point of a photograph its crop keeps, held by the hand** (ADR 0084, sprint 41 día 5),
 * decided without a DOM.
 *
 * The point is drawn over the chosen photograph where its `focus` is — the middle when it has
 * none — and dragged, or moved with the arrows, to where the part worth keeping is. Everything is
 * whole percent of the photograph's box, as the document stores it.
 */
export interface Focus {
  readonly x: number;
  readonly y: number;
}

/** Where nobody chose: the middle, which is what a photograph with no `focus` is drawn at. */
export const MIDDLE: Focus = { x: 50, y: 50 };

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** The point the hand is at, as whole percent of the photograph's box, held inside it. */
export function focusAt(point: Point, box: EdgeBox): Focus {
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  if (width <= 0 || height <= 0) return MIDDLE;
  return {
    x: clamp(((point.x - box.left) / width) * 100),
    y: clamp(((point.y - box.top) / height) * 100),
  };
}

/** Where the point is drawn, in the same coordinates as the box. */
export function pointOf(focus: Focus, box: EdgeBox): Point {
  return {
    x: box.left + ((box.right - box.left) * focus.x) / 100,
    y: box.top + ((box.bottom - box.top) * focus.y) / 100,
  };
}

/** One percent a press, ten with Shift; anything else, or a modifier the platform owns, is not ours. */
export function focusKey(
  focus: Focus,
  press: {
    readonly key: string;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
  },
): Focus | null {
  if (press.altKey || press.ctrlKey || press.metaKey) return null;
  const step = press.shiftKey ? 10 : 1;
  const dx = press.key === "ArrowLeft" ? -step : press.key === "ArrowRight" ? step : 0;
  const dy = press.key === "ArrowUp" ? -step : press.key === "ArrowDown" ? step : 0;
  if (dx === 0 && dy === 0) return null;
  return { x: clamp(focus.x + dx), y: clamp(focus.y + dy) };
}

/**
 * The shape a side pull gives a photograph (ADR 0084): the box the hand made, width to height in
 * whole pixels. `setPhotoShape` reduces it; a side that left one dimension alone keeps it, so a
 * bottom edge changes the height and nothing else, and a right edge the width.
 */
export function shapeOf(width: number, height: number): { width: number; height: number } | null {
  const w = Math.round(width);
  const h = Math.round(height);
  if (w < 1 || h < 1) return null;
  return { width: w, height: h };
}
