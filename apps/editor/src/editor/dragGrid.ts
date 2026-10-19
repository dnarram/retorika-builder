import { GRID_COLUMNS, type Placement } from "@retorika/schema";
import type { Point } from "./barPosition.ts";
import { MAX_ROW } from "./designTree.ts";

/**
 * **Where a dragged element lands, and whether it is allowed to** — decided without a DOM
 * (ADR 0048, sprint 24 día 8).
 *
 * **Rule 4 is not amended, and this drag is the reason it does not need to be.** An element is let
 * go anywhere and lands in the nearest of the section's twelve columns and the nearest of its rows:
 * «la colocación libre siempre ocurre dentro de la rejilla de la sección, nunca sobre coordenadas
 * absolutas» (advanced dossier §6). Nothing here produces an `x` or a `y` for the document — it
 * produces a column and a row, which is all `setPlacement` will accept.
 *
 * **The columns are arithmetic and the rows are measured.** `.rb-section` is
 * `grid-template-columns: repeat(12, 1fr)` with `gap: var(--space-md)`, so a column's width is the
 * same everywhere and can be computed. Its **rows are implicit and sized by their content**, so
 * there is no row height to compute: `grid-template-rows` resolves to the used pixel heights in the
 * browser, and that list is what arrives here. A module that assumed uniform rows would snap an
 * element to the wrong one on every section whose first row is a headline and whose second is a
 * photograph — which is most of them.
 *
 * The judgement is a pure function and the wiring is in `Editor.tsx`, the split `barPosition.ts`
 * and `twoStates.ts` already use.
 */

/** The part of a placement that is geometry: no element id, because overlap is about rectangles. */
export type GridArea = Pick<Placement, "column" | "columnSpan" | "row" | "rowSpan">;

export interface GridMetrics {
  /** The section's content box, in the frame's own coordinates. */
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly columnGap: number;
  readonly rowGap: number;
  /**
   * The used height of each of the grid's rows, in order, as `grid-template-rows` resolves it.
   *
   * Empty is a real state — a section with nothing placed — and then the first row is the only
   * target there is.
   */
  readonly rows: readonly number[];
}

export interface Cell {
  readonly column: number;
  readonly row: number;
}

/** One column's width, from the section's own box: the gaps come out first. */
export function columnWidth(metrics: GridMetrics): number {
  const gaps = metrics.columnGap * (GRID_COLUMNS - 1);
  return Math.max(0, (metrics.width - gaps) / GRID_COLUMNS);
}

/** Where each row starts, measured from the grid's top, plus one past the last row. */
function rowEdges(metrics: GridMetrics): number[] {
  const edges = [0];
  let at = 0;
  for (const height of metrics.rows) {
    at += height + metrics.rowGap;
    edges.push(at);
  }
  return edges;
}

/**
 * The cell a point falls in — **the nearest one, which is what «imán» means.**
 *
 * Nearest and not «the band the point is inside», and that is the decision rather than the easier
 * arithmetic: David chose «arrastrar con imán a la rejilla», and a magnet pulls to the closest
 * line, so an element let go in the right half of a column's band snaps to the next one. Flooring
 * instead would mean an element that never moves as far right as the hand put it, which reads as
 * the drag resisting.
 *
 * **A point past the last row is the row after it**, which is how a section grows (`dropAt` is what
 * decides whether it may).
 */
export function cellAt(at: Point, metrics: GridMetrics): Cell {
  const width = columnWidth(metrics);
  const step = width + metrics.columnGap;
  const column = step > 0 ? Math.round((at.x - metrics.left) / step) + 1 : 1;

  const edges = rowEdges(metrics);
  const y = at.y - metrics.top;
  let row = 1;
  let best = Number.POSITIVE_INFINITY;
  for (const [index, edge] of edges.entries()) {
    const distance = Math.abs(y - edge);
    if (distance < best) {
      best = distance;
      row = index + 1;
    }
  }

  return {
    column: Math.min(Math.max(column, 1), GRID_COLUMNS),
    row: Math.min(Math.max(row, 1), MAX_ROW),
  };
}

/**
 * The pixel rectangle of a grid area, for the ghost that shows where the element would land.
 *
 * A row the grid does not have yet — the one a section would grow by — is drawn with the height of
 * the last row it does have, because there is nothing else to go on and a ghost of no height would
 * be a ghost nobody can see. 64px when the section is empty, which is about one line of body text.
 */
export function rectOf(
  area: GridArea,
  metrics: GridMetrics,
): { left: number; top: number; width: number; height: number } {
  const width = columnWidth(metrics);
  const step = width + metrics.columnGap;
  const edges = rowEdges(metrics);
  const spare = metrics.rows.at(-1) ?? 64;

  const top =
    edges[area.row - 1] ??
    (edges.at(-1) ?? 0) + (area.row - 1 - metrics.rows.length) * (spare + metrics.rowGap);
  let height = 0;
  for (let index = 0; index < area.rowSpan; index += 1) {
    height += (metrics.rows[area.row - 1 + index] ?? spare) + metrics.rowGap;
  }

  return {
    left: metrics.left + (area.column - 1) * step,
    top: metrics.top + top,
    width: width * area.columnSpan + metrics.columnGap * (area.columnSpan - 1),
    height: Math.max(0, height - metrics.rowGap),
  };
}

/**
 * Whether two grid areas share any cell.
 *
 * **The whole rectangle on both sides** — column, span, row, span — which is David's own definition,
 * given exactly because a looser one would have made the ordinary move impossible: «Moverlo una
 * columna a la derecha solapa sus propias celdas y no debe rechazarse.» That case is handled by
 * leaving the dragged element out of the comparison (`dropAt`), not by weakening this.
 */
export function overlaps(a: GridArea, b: GridArea): boolean {
  return (
    a.column < b.column + b.columnSpan &&
    b.column < a.column + a.columnSpan &&
    a.row < b.row + b.rowSpan &&
    b.row < a.row + a.rowSpan
  );
}

/**
 * What letting go here would do.
 *
 * - `place` — the element goes to this column and row, keeping both of its spans.
 * - `refuse` — nothing moves, and `why` is what the ghost says instead of leaving somebody to guess:
 *   `occupied` for a cell another element already holds, `rows` for a drop past the interface's own
 *   floor of the section.
 */
export type Drop =
  | { readonly kind: "place"; readonly at: GridArea }
  | { readonly kind: "refuse"; readonly why: "occupied" | "rows"; readonly at: GridArea };

/**
 * **Refuse and return, which is David's decision and is stricter than the document.**
 *
 * `setPlacement`'s own note says two elements may end up in the same cell and that it is allowed —
 * CSS grid stacks them and overlapping on purpose is a real technique. So this is an **interface**
 * rule: a drag is a gesture about position, and a gesture that silently stacks two things is a
 * gesture whose result nobody can see. Stacking on purpose stays available, through the four
 * «Colocación» buttons, which are also what gives this drag its single-pointer alternative
 * (WCAG 2.5.7).
 *
 * The dragged element is excluded **here**, by id, rather than left to the caller: the one case that
 * has to work — moving something one column right, where the new rectangle overlaps the old — is the
 * case a forgotten exclusion breaks, and it is the commonest drag there is.
 */
export function dropAt(args: {
  readonly metrics: GridMetrics;
  /** Where the element's top-left corner has been dragged to, in frame coordinates. */
  readonly at: Point;
  readonly moving: Placement;
  /** Every placement in the section, the dragged one included; it is excluded by id. */
  readonly placements: readonly Placement[];
}): Drop {
  const { metrics, at, moving, placements } = args;
  const cell = cellAt(at, metrics);

  // Rule 4's own coupling, the same one `boundsFor` applies to the arrows: an element keeps its
  // span, so how far right it may start is what still fits inside the twelve columns. Clamped
  // rather than refused — a hand that overshoots the right edge means «as far right as it goes».
  const column = Math.min(cell.column, GRID_COLUMNS - moving.columnSpan + 1);
  const target: GridArea = {
    column: Math.max(1, column),
    columnSpan: moving.columnSpan,
    row: cell.row,
    rowSpan: moving.rowSpan,
  };

  // Rows have no limit in the document model — a grid grows downwards — so this is the interface's
  // own floor (`MAX_ROW`), and past it the honest answer is no rather than a clamp that would put
  // the element somewhere nobody asked for.
  if (target.row + target.rowSpan - 1 > MAX_ROW) {
    return { kind: "refuse", why: "rows", at: target };
  }

  for (const other of placements) {
    if (other.elementId === moving.elementId) continue;
    if (overlaps(target, other)) return { kind: "refuse", why: "occupied", at: target };
  }

  return { kind: "place", at: target };
}
