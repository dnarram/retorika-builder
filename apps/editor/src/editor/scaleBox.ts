import {
  FINE_COLUMNS,
  type Placement,
  type PlacementEdit,
  STYLE_REFS,
  type StyleValue,
  type Theme,
  tokenPx,
} from "@retorika/schema";
import type { Point } from "./barPosition.ts";
import { MAX_ROW } from "./designTree.ts";
import type { Edge, EdgeBox } from "./resizeBox.ts";

/**
 * **A corner scales what is inside the box** (ADR 0082, sprint 41 día 2), decided without a DOM.
 *
 * The hand takes a corner and pulls; the opposite corner stays where it is, as it does in Canva
 * and in Word, and everything between them grows or shrinks by one factor. For a text that factor
 * is applied to its letter and to its box together, so a headline that was two lines of twelve
 * words is still two lines of twelve words, bigger; for a photograph it is applied to its box, and
 * the photograph — `width: 100%` of its area, its shape the catalog's — follows.
 *
 * Everything is pixels in, document units out, as `resizeBox.ts` has it: rule 4 is untouched, a
 * scale writes a column, a span and a row, and a letter is the one exact value rule 6 already
 * admits for `fontSize` — marked as the exception it is, unless the hand lands on one of the
 * system's own three sizes, where the reference is written instead (rule 6 prefers one).
 */

export type Corner = "nw" | "ne" | "sw" | "se";

export function isCorner(edge: Edge): edge is Corner {
  return edge === "nw" || edge === "ne" || edge === "sw" || edge === "se";
}

/**
 * How much the hand has scaled the box, from where the press began to where it is now.
 *
 * **The projection of the hand's travel onto the box's diagonal**, anchor to corner: pulling along
 * it outwards is more than one, inwards is less, and a hand that wanders across the diagonal
 * changes nothing. One number for both axes is the whole difference between a corner and a side —
 * a side's hand is read against a grid line (`resizeTo`), a corner's against the box it holds.
 *
 * Never below zero, and never read from a box with no diagonal: a degenerate box answers one.
 */
export function scaleFactor(args: {
  readonly box: EdgeBox;
  readonly corner: Corner;
  readonly from: Point;
  readonly now: Point;
}): number {
  const { box, corner, from, now } = args;
  const anchor = anchorOf(box, corner);
  const held = cornerOf(box, corner);
  const dx = held.x - anchor.x;
  const dy = held.y - anchor.y;
  const length = dx * dx + dy * dy;
  if (length === 0) return 1;
  const travel = ((now.x - from.x) * dx + (now.y - from.y) * dy) / length;
  return Math.max(0, 1 + travel);
}

/** The corner the hand holds, and the one that stays put. */
function cornerOf(box: EdgeBox, corner: Corner): Point {
  return {
    x: corner === "ne" || corner === "se" ? box.right : box.left,
    y: corner === "sw" || corner === "se" ? box.bottom : box.top,
  };
}
function anchorOf(box: EdgeBox, corner: Corner): Point {
  return {
    x: corner === "ne" || corner === "se" ? box.left : box.right,
    y: corner === "sw" || corner === "se" ? box.top : box.bottom,
  };
}

/** The least a letter may be scaled to by hand, and the most: the toolbar's own ceiling, and a
 * floor above its 8 — a number typed on purpose is one thing, a hand that slipped another. */
export const LETTER_FLOOR_PX = 12;
export const LETTER_CEILING_PX = 200;
/** How close to one of the system's three sizes the hand has to land for the reference to be
 * written instead of an exact value: two pixels, under what a hand can hold still. */
export const LETTER_MAGNET_PX = 2;

export type SizeRef = (typeof STYLE_REFS.fontSize)[number];

export interface ScaledLetter {
  /** What `fontSize` becomes: a reference, an exact value, or nothing — the element's own size
   * again, because the hand landed on it and it had no size of its own to begin with. */
  readonly value: StyleValue | undefined;
  /** The size on screen, in the frame's pixels, for the preview and for the sentence. */
  readonly px: number;
  /** The factor as it stands after the floor and the ceiling, so the box follows the letter and
   * not the hand past the letter's limits. */
  readonly factor: number;
}

/**
 * The letter the hand has scaled to.
 *
 * `basePx` is the letter as the browser draws it now, whatever the document says it is; the three
 * sizes are the theme's own, in pixels, so the magnet knows where they are. **A hand that lands
 * on a system size writes the reference** — rule 6's first arm, which follows the theme's scale
 * forever — and a hand that lands on the size the element already draws with no size of its own
 * writes nothing at all, so a corner barely touched leaves no exception behind.
 */
export function scaledLetter(args: {
  readonly basePx: number;
  readonly factor: number;
  readonly theme: Theme;
  readonly current: StyleValue | undefined;
}): ScaledLetter {
  const { basePx, theme, current } = args;
  const wanted = Math.min(LETTER_CEILING_PX, Math.max(LETTER_FLOOR_PX, basePx * args.factor));
  for (const ref of STYLE_REFS.fontSize) {
    const size = tokenPx(theme[ref]);
    if (Math.abs(wanted - size) <= LETTER_MAGNET_PX) {
      const alreadyDrawn = current === undefined && Math.abs(basePx - size) <= LETTER_MAGNET_PX;
      return { value: alreadyDrawn ? undefined : { ref }, px: size, factor: size / basePx };
    }
  }
  const px = Math.round(wanted);
  return { value: { exact: `${px}px`, exception: true }, px, factor: px / basePx };
}

/**
 * The placement scaled by `factor` from `corner`, the opposite corner staying put.
 *
 * Both spans take the factor, rounded, and never under one unit or one row; where the corner is
 * on the left or the top the start moves so that the far edge does not, exactly as `resizeTo`
 * moves it for a side. **Clamped, never refused**, as every gesture on this grid is: a span that
 * would cross the section's edge stops at it, and the factor the letter was given is therefore not
 * always the factor the box gets — which is the honest answer at the edge of the page.
 *
 * Only the fields that change come back, so `setPlacement` sees an edit and not a whole placement.
 */
export function scaledBox(placement: Placement, corner: Corner, factor: number): PlacementEdit {
  const edit: PlacementEdit = {};
  const lastColumn = placement.column + placement.columnSpan - 1;
  const lastRow = placement.row + placement.rowSpan - 1;

  let columnSpan = Math.max(1, Math.round(placement.columnSpan * factor));
  let rowSpan = Math.max(1, Math.round(placement.rowSpan * factor));

  if (corner === "nw" || corner === "sw") {
    columnSpan = Math.min(columnSpan, lastColumn);
    const column = lastColumn - columnSpan + 1;
    if (column !== placement.column) edit.column = column;
  } else {
    columnSpan = Math.min(columnSpan, FINE_COLUMNS - placement.column + 1);
  }
  if (columnSpan !== placement.columnSpan) edit.columnSpan = columnSpan;

  if (corner === "nw" || corner === "ne") {
    rowSpan = Math.min(rowSpan, lastRow);
    const row = lastRow - rowSpan + 1;
    if (row !== placement.row) edit.row = row;
  } else {
    rowSpan = Math.min(rowSpan, MAX_ROW - placement.row + 1);
  }
  if (rowSpan !== placement.rowSpan) edit.rowSpan = rowSpan;

  return edit;
}
