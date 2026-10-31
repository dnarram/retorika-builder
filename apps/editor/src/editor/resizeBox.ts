import { FINE_COLUMNS, type Placement, type PlacementEdit } from "@retorika/schema";
import type { Point } from "./barPosition.ts";
import { MAX_ROW } from "./designTree.ts";

/**
 * **The blue box's edges stretch it** (ADR 0050, sprint 25 día 4), decided without a DOM.
 *
 * David's second request for this sprint, beside «se queda donde se suelta»: «quiero además que las
 * cajas que limitan el tamaño del objeto visual (el recuadro azul) sea **ajustable al arrastrar los
 * bordes**, bien para agrandarlo o bien para reducirlo (parecido a como funcionan los cuadros de
 * texto insertados en un documento de Word)». And his own gesture for finding it: «cursor
 * `ew-resize` en una zona de ±6 px alrededor del borde, para que se descubra sin explicación».
 *
 * **No handles with a mouse.** A zone around the edge and a cursor that changes in it, which is what
 * Word does and what keeps the canvas free of eight squares nobody asked for. Touch cannot work
 * that way — a finger is 44 px wide — and gets real handles on día 7, which is why nothing here
 * knows about pointer types: the editor only asks this module about a mouse.
 *
 * Everything is pixels in, document units out: `edgeAt` says which edge a point is on and
 * `resizeTo` turns a grid line into the two numbers that edge owns. Rule 4 is untouched — a resize
 * writes a column, a span and a row, and never a width in pixels.
 */

export type Edge = "left" | "right" | "top" | "bottom" | "nw" | "ne" | "sw" | "se";

/**
 * How far either side of an edge counts as being on it.
 *
 * **Two numbers and not one, because the inner side is contested** (David's adjustment 8): while a
 * text is being written in, the first and the last letter are inside their own box and a click on
 * them has to place the caret. So the zone reaches **6 px outside and 2 inside** there, where it is
 * ±6 for an element that is merely chosen and has no caret to compete with.
 *
 * In the frame's own pixels: the caller divides by the canvas zoom, so «six pixels» is six pixels
 * under the hand at every window width (adjustment 3).
 */
export interface EdgeZone {
  readonly outside: number;
  readonly inside: number;
}

/** Six pixels, which is the number David gave, and two for the inner side while writing. */
export const EDGE_ZONE = 6;
export const EDGE_ZONE_WRITING_INSIDE = 2;

/** The rectangle of the element, in the same coordinates as the point — a `DOMRect` fits. */
export interface EdgeBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** How far a coordinate is into the zone around a line, or `null` when it is outside it. `inner` is
 * the side the element's own body is on. */
function distanceToLine(value: number, line: number, inner: 1 | -1, zone: EdgeZone): number | null {
  const towardsInside = (value - line) * inner;
  if (towardsInside > zone.inside) return null;
  if (towardsInside < -zone.outside) return null;
  return Math.abs(value - line);
}

/**
 * Which edge a point is on, or `null` for a point that is on none.
 *
 * **A corner wins over a side**, because that is what the hand means: a point in the zone of both
 * the left edge and the top one is on the corner, and dragging it moves both. And where two
 * opposite edges both answer — a button thirty pixels tall, whose top and bottom zones overlap —
 * **the nearer line wins**, so a small element is still resizable from the side the hand is on
 * rather than from whichever this function happened to test first.
 */
export function edgeAt(point: Point, box: EdgeBox, zone: EdgeZone): Edge | null {
  /*
   * **The middle half of an element is always the element** (sprint 31 día 1, measured). The zone
   * reaches its six screen pixels inside on every side, divided by the canvas zoom; at 0.616 — a
   * 1280 laptop with a panel open, since ADR 0061 — a one-line text is 20 px of the frame and 12 of
   * the screen, the two zones took 19.5 of its 20 px, and a press to start writing in it began a
   * resize instead (half a frame pixel was left, and Linux's rounding of the press missed it). So
   * the inner reach is capped, per axis, at a quarter of the element: an edge is still taken from
   * outside at full width, and what the hand presses in the middle is the element — to choose it,
   * to write in it, to drag it. Every box the size of a headline is untouched: 6 is under a quarter.
   */
  const across = {
    outside: zone.outside,
    inside: Math.min(zone.inside, (box.right - box.left) / 4),
  };
  const down = { outside: zone.outside, inside: Math.min(zone.inside, (box.bottom - box.top) / 4) };
  const toLeft = distanceToLine(point.x, box.left, 1, across);
  const toRight = distanceToLine(point.x, box.right, -1, across);
  const toTop = distanceToLine(point.y, box.top, 1, down);
  const toBottom = distanceToLine(point.y, box.bottom, -1, down);

  // Within the element's own extent on the other axis, plus the outside margin, so the zones form a
  // frame around the box and not two infinite bands crossing the page.
  const alongX =
    point.x >= box.left - zone.outside && point.x <= box.right + zone.outside ? true : false;
  const alongY =
    point.y >= box.top - zone.outside && point.y <= box.bottom + zone.outside ? true : false;

  const horizontal = !alongY
    ? null
    : toLeft !== null && (toRight === null || toLeft <= toRight)
      ? "left"
      : toRight !== null
        ? "right"
        : null;
  const vertical = !alongX
    ? null
    : toTop !== null && (toBottom === null || toTop <= toBottom)
      ? "top"
      : toBottom !== null
        ? "bottom"
        : null;

  if (horizontal && vertical) {
    if (vertical === "top") return horizontal === "left" ? "nw" : "ne";
    return horizontal === "left" ? "sw" : "se";
  }
  return horizontal ?? vertical;
}

/**
 * The cursor for an edge — the whole of «se descubra sin explicación».
 *
 * The four the platform has, and they are the four every application uses for this, so nobody has
 * to be told what the pointer means when it changes.
 */
export function cursorFor(edge: Edge): string {
  switch (edge) {
    case "left":
    case "right":
      return "ew-resize";
    case "top":
    case "bottom":
      return "ns-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
  }
}

/**
 * Where the hand is, in the document's own units — **two readings, because the two borders ask
 * different questions**.
 *
 * A left border aims at the unit whose *left* edge is nearest; a right border at the unit whose
 * *right* edge is nearest, and between those two units there can be a gutter of sixteen pixels.
 * Asking one question for both is what made a resize of two catalog columns land one unit short
 * (measured, día 4). Vertically it is the same shape without the gutter: the bottom of row 7 is the
 * top of row 8, and a border that confused them grew the element by a row nobody asked for.
 *
 * `fineColumnAt`/`fineLastColumnAt` and `rowAt`/`lastRowAt` are the four readings, all in
 * `dragGrid.ts` so that the drag and the resize share one walk of the resolved tracks.
 */
export interface ResizeTarget {
  readonly startColumn: number;
  readonly endColumn: number;
  readonly startRow: number;
  readonly endRow: number;
}

/** Which of the two axes an edge owns — which is also which axes the guides may snap while it is
 * being pulled (día 5): a right border lines up sideways and has nothing to say about rows. */
export function axes(edge: Edge): { horizontal: boolean; vertical: boolean } {
  return {
    horizontal: ["left", "right", "nw", "ne", "sw", "se"].includes(edge),
    vertical: ["top", "bottom", "nw", "ne", "sw", "se"].includes(edge),
  };
}

/**
 * What the element's placement becomes when `edge` is dragged to `at`.
 *
 * **The far edge stays put, which is the whole behaviour of a box's edge.** Dragging the left one
 * moves the start and shortens the span by the same amount, so the right-hand edge does not budge;
 * dragging the right one changes nothing but the span. The same two sentences vertically, and a
 * corner is simply both at once.
 *
 * **Clamped, never refused**, exactly as `dropAt` clamps a drop that overshoots: a hand that pulls
 * past the grid's edge means «as far as it goes», and an element never becomes thinner than one
 * unit or shorter than one row. Pulling the left edge past the right one therefore leaves a box one
 * unit wide rather than an inverted one, which is what every application does with this gesture.
 *
 * Only the fields that edge owns come back, so `setPlacement` sees an edit and not a whole
 * placement — and the three numbers nobody touched cannot be rewritten by a rounding.
 */
export function resizeTo(placement: Placement, edge: Edge, at: ResizeTarget): PlacementEdit {
  const edit: PlacementEdit = {};
  const { horizontal, vertical } = axes(edge);

  if (horizontal) {
    const last = placement.column + placement.columnSpan - 1;
    if (edge === "left" || edge === "nw" || edge === "sw") {
      const column = Math.max(1, Math.min(at.startColumn, last));
      edit.column = column;
      edit.columnSpan = last - column + 1;
    } else {
      const end = Math.max(placement.column, Math.min(at.endColumn, FINE_COLUMNS));
      edit.columnSpan = end - placement.column + 1;
    }
  }

  if (vertical) {
    const bottom = placement.row + placement.rowSpan - 1;
    if (edge === "top" || edge === "nw" || edge === "ne") {
      const row = Math.max(1, Math.min(at.startRow, bottom));
      edit.row = row;
      edit.rowSpan = bottom - row + 1;
    } else {
      const end = Math.max(placement.row, Math.min(at.endRow, MAX_ROW));
      edit.rowSpan = end - placement.row + 1;
    }
  }

  return edit;
}
