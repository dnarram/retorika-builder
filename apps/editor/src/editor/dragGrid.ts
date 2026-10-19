import { GRID_COLUMNS, type Placement } from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };
import type { Point } from "./barPosition.ts";
import { MAX_ROW } from "./designTree.ts";
import type { KeyPress } from "./shortcuts.ts";

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

/**
 * **The keyboard's half of the drag** (ADR 0049, sprint 24 día 9).
 *
 * A pointer gesture with no keyboard equivalent does not exist for whoever has no pointer — the rule
 * this repository has applied to every handle it ever drew — and WCAG 2.1.1 says the same thing with
 * a number. So with an element chosen, the arrows move it one cell at a time and `Shift` with a
 * sideways arrow widens or narrows it.
 *
 * **This amends [ADR 0047] §1 in one clause and only in one state.** That decision refuses every
 * modifier, Shift included, because «Shift+Arrow is a selection gesture everywhere» — true where
 * there is a caret, and there is none in «chosen». While **writing**, every modifier still goes
 * straight to the browser, untouched.
 *
 * **Vertical only moves; it never resizes.** `Shift+ArrowDown` would be «one row taller», which is a
 * different kind of change — a row's height is its content's — and the panel's own stepper already
 * owns `rowSpan`. Offering half of a pair here would read as the other half being broken.
 */
export type ArrowAction =
  | { readonly kind: "move"; readonly column: number; readonly row: number }
  | { readonly kind: "span"; readonly columns: number }
  | { readonly kind: "none" };

const NO_ARROW: ArrowAction = { kind: "none" };
/** The same word for «the press does nothing», in the vocabulary a drop answers in. */
const NO_DROP = { kind: "none" } as const;

export function arrowAction(press: KeyPress): ArrowAction {
  // Alt, Meta and Control are never ours: `Meta+ArrowDown` is «end of document» everywhere and
  // `Control+ArrowUp` is Mission Control on the machine this is built on (`sectionKeys.ts`).
  if (press.altKey || press.metaKey || press.ctrlKey) return NO_ARROW;
  const column = press.key === "ArrowLeft" ? -1 : press.key === "ArrowRight" ? 1 : 0;
  const row = press.key === "ArrowUp" ? -1 : press.key === "ArrowDown" ? 1 : 0;
  if (press.shiftKey) return column === 0 ? NO_ARROW : { kind: "span", columns: column };
  if (column === 0 && row === 0) return NO_ARROW;
  return { kind: "move", column, row };
}

/**
 * What an arrow press would do, in the same words a drop gets.
 *
 * **One vocabulary for the pointer and the keyboard, and one refusal.** The arrows *on the element*
 * are the drag's equivalent, so a cell another element holds is refused here exactly as it is there
 * (ADR 0048 §4) — otherwise the keyboard would quietly do what the hand is told it may not. The four
 * «Colocación» buttons in the panel stay the way to stack on purpose, which is the same split.
 *
 * `none` is «the press changes nothing»: an element already against the left edge, or already one
 * column wide. Silence is the honest answer there — announcing a position nobody moved to would
 * teach a screen reader's user that the press worked.
 */
export function arrowDrop(args: {
  readonly moving: Placement;
  readonly placements: readonly Placement[];
  readonly action: ArrowAction;
}): Drop | { readonly kind: "none" } {
  const { moving, placements, action } = args;
  if (action.kind === "none") return NO_DROP;

  const target: GridArea =
    action.kind === "move"
      ? {
          column: moving.column + action.column,
          columnSpan: moving.columnSpan,
          row: moving.row + action.row,
          rowSpan: moving.rowSpan,
        }
      : {
          column: moving.column,
          columnSpan: moving.columnSpan + action.columns,
          row: moving.row,
          rowSpan: moving.rowSpan,
        };

  // Rule 4's coupling, the same arithmetic `boundsFor` gives the panel's arrows: a column that
  // still fits the span, a span that still fits from the column, and the interface's own floor on
  // rows. Outside any of them the press is refused rather than clamped — a clamp would answer a
  // deliberate press with a move nobody asked for.
  if (target.column < 1 || target.column + target.columnSpan - 1 > GRID_COLUMNS) return NO_DROP;
  if (target.columnSpan < 1) return NO_DROP;
  if (target.row < 1 || target.row + target.rowSpan - 1 > MAX_ROW) return NO_DROP;

  for (const other of placements) {
    if (other.elementId === moving.elementId) continue;
    if (overlaps(target, other)) return { kind: "refuse", why: "occupied", at: target };
  }
  return { kind: "place", at: target };
}

/**
 * What the editor says out loud when an element moves, **in the parent document's live region**.
 *
 * David's correction while approving the sprint, and it is a defect that would have shipped: every
 * arrow is an edit, every edit replaces the canvas's whole `srcDoc`, so a region inside the frame
 * would be a **freshly created** region on every move — and a screen reader does not announce the
 * contents of a region that has just appeared. The region lives in the editor's own document, which
 * survives the rebuild.
 *
 * Two sentences for two acts: where it went, or how wide it is now. A move that says «ancho 4» every
 * time would bury the number that changed under one that did not.
 */
export function announceText(area: GridArea, kind: "move" | "span"): string {
  const key = kind === "move" ? "editor.canvas.at" : "editor.canvas.width";
  return es[key]
    .replace("{column}", String(area.column))
    .replace("{columns}", String(GRID_COLUMNS))
    .replace("{row}", String(area.row))
    .replace("{span}", String(area.columnSpan));
}

/**
 * **The mobile view is a different question, and rule 7 is why** (ADR 0049).
 *
 * In the mobile view a section is one column — the renderer emits
 * `.rb-section > * { grid-column: 1 / -1 !important; grid-row: auto !important }` — so there is no
 * column to move between and no row to land on. Rule 7 admits exactly three adjustments, «ocultar,
 * reordenar y estrechar», so the same gesture means the one of the three it can mean: **dragging up
 * or down changes the reading order, and sideways does nothing.**
 *
 * This is the question sprint 17 left open when it withdrew the corner handles — «what does a drag
 * mean on a phone» — and the answer is semantics rather than geometry.
 */
export interface MobileRow {
  readonly elementId: string;
  readonly top: number;
  readonly bottom: number;
}

/**
 * Which element to pass to `moveUpOnMobile`, or nothing.
 *
 * **Expressed as «which one moves up» because that is the verb the document has.** `moveUpOnMobile`
 * swaps an element with the one above it, so dragging *down* is the neighbour below moving up — one
 * verb, one history step, and no second function in the schema to keep level with the first.
 *
 * One step per release: the element leaving its own box upwards or downwards is the gesture, and
 * repeating it is how something travels further. Reading the boxes rather than the patch is what
 * makes it agree with what is on screen, whatever `order` the patch has already set.
 */
export function reorderAt(args: {
  readonly rows: readonly MobileRow[];
  readonly moving: string;
  readonly y: number;
}): { readonly kind: "moveUp"; readonly elementId: string } | { readonly kind: "none" } {
  const { rows, moving, y } = args;
  const at = rows.findIndex((row) => row.elementId === moving);
  const mine = rows[at];
  if (at === -1 || !mine) return NO_DROP;
  if (y < mine.top) {
    const above = rows[at - 1];
    return above ? { kind: "moveUp", elementId: moving } : NO_DROP;
  }
  if (y > mine.bottom) {
    const below = rows[at + 1];
    return below ? { kind: "moveUp", elementId: below.elementId } : NO_DROP;
  }
  // Still inside its own box: a sideways drag, or one too short to mean anything.
  return NO_DROP;
}
