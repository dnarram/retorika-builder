import {
  FINE_COLUMNS,
  FINE_PER_COLUMN,
  fineTrack,
  GRID_COLUMNS,
  type Placement,
  ROW_STEP_PX,
} from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };
import type { Point } from "./barPosition.ts";
import { MAX_ROW } from "./designTree.ts";
import type { KeyPress } from "./shortcuts.ts";

/**
 * **Where a dragged element lands — the unit nearest to where the hand let go** (ADR 0050, sprint
 * 25 día 3), decided without a DOM.
 *
 * David's whole request for this sprint was that an element «se quede en la posición donde se
 * deja». Sprint 24 snapped it to the nearest of twelve columns, which is a jump of 75–100 px where
 * somebody drags: the gesture read as the page resisting the hand. The grid is ninety-six units and
 * eight-pixel rows now, so the nearest unit is within four or five pixels of the pointer — under
 * what anybody notices, which is what makes «se queda donde se suelta» true rather than a promise.
 *
 * **Both axes are read off the resolved tracks, not computed from a width.** `getComputedStyle`
 * resolves `grid-template-columns` to 107 used pixel widths and `grid-template-rows` to the rows the
 * grid actually has, implicit ones included — so this module measures what the browser did instead
 * of re-deriving it. For the rows that is David's own correction while approving the sprint: with
 * `minmax(8px, auto)` a row holding a text taller than its span **grows**, so `y / 8` is not the row
 * it looks like and anything that assumed it would snap an element to the wrong one in every
 * migrated document. For the columns it is what keeps the gutters exactly where `fineGrid.ts` put
 * them, since the track list is walked through `fineTrack` rather than through a copy of its rule.
 *
 * **Nothing here produces an `x` or a `y` for the document** — it produces a unit and a row, which
 * is all `setPlacement` accepts. Rule 4 stands, finer.
 *
 * The judgement is a pure function and the wiring is in `Editor.tsx`, the split `barPosition.ts`
 * and `twoStates.ts` already use.
 */

/** The part of a placement that is geometry: no element id, because a cell is about rectangles. */
export type GridArea = Pick<Placement, "column" | "columnSpan" | "row" | "rowSpan">;

export interface GridMetrics {
  /** The section's content box, in the frame's own coordinates. */
  readonly left: number;
  readonly top: number;
  /**
   * The used width of every column track, in order, as `grid-template-columns` resolves it: for a
   * hand-designed section the 107 of the fine grid — ninety-six units and the eleven gutters.
   */
  readonly columns: readonly number[];
  /**
   * The used height of every row the grid has, in order, as `grid-template-rows` resolves it.
   *
   * Empty is a real state — a section with nothing placed — and then the first row is the only
   * target there is. Past the last one the section grows, and a point below them all is as many
   * `ROW_STEP_PX` rows further down as it is pixels.
   */
  readonly rows: readonly number[];
}

export interface Cell {
  readonly column: number;
  readonly row: number;
}

/** Where each track starts, measured from the grid's own origin, plus one past the last. */
function edges(tracks: readonly number[]): number[] {
  const out = [0];
  let at = 0;
  for (const size of tracks) {
    at += size;
    out.push(at);
  }
  return out;
}

/**
 * The fine unit whose left edge is nearest to `x` — **nearest, which is what «se queda donde se
 * suelta» means at this size**: an element let go in the middle of a unit goes to the nearer of its
 * two edges, and with a unit of 7–10 px that is never more than five pixels from the hand.
 *
 * A point over a gutter falls to the nearer of the units either side of it, because a placement
 * cannot start on a gutter — the document never names one (`fineGrid.ts`).
 */
export function fineColumnAt(x: number, metrics: GridMetrics): number {
  return nearestUnit(x, metrics, "start");
}

/**
 * The unit whose **right** edge is nearest to `x` — what a right-hand border aims at.
 *
 * **Not the same question as `fineColumnAt`, and the difference is a gutter.** The right edge of
 * unit 8 and the left edge of unit 9 are sixteen pixels apart, and an element may end at the first
 * or begin at the second; asking «which unit starts nearest» about a right border is what made a
 * resize of two catalog columns come out one unit short — 63 units where the hand had asked for 64,
 * measured in Chromium before this function existed.
 */
export function fineLastColumnAt(x: number, metrics: GridMetrics): number {
  return nearestUnit(x, metrics, "end");
}

/** The unit whose start or end line is nearest, which is the one walk both readings share. */
function nearestUnit(x: number, metrics: GridMetrics, side: "start" | "end"): number {
  const offsets = edges(metrics.columns);
  const local = x - metrics.left;
  let best = 1;
  let distance = Number.POSITIVE_INFINITY;
  for (let column = 1; column <= FINE_COLUMNS; column += 1) {
    // Through `fineTrack`, so the gutters' pattern lives in one place and this cannot disagree
    // with what the renderer emitted: the unit's own track starts at `fineTrack(column) - 1` and
    // ends where the next track begins.
    const offset = offsets[fineTrack(column) - (side === "start" ? 1 : 0)];
    if (offset === undefined) break;
    const to = Math.abs(local - offset);
    if (to < distance) {
      distance = to;
      best = column;
    }
  }
  return best;
}

/**
 * The row whose top edge is nearest to `y`, **by walking the resolved rows** (David's adjustment 1).
 *
 * Past the last row the grid grows downwards in steps of `ROW_STEP_PX`, so a point below everything
 * is extrapolated rather than clamped: that is how a section gets taller, and `dropAt` is what
 * decides whether it may.
 */
export function rowAt(y: number, metrics: GridMetrics): number {
  return nearestRow(y, metrics, "start");
}

/**
 * The row whose **bottom** edge is nearest to `y` — what a bottom border aims at.
 *
 * The same distinction `fineLastColumnAt` makes, and here it is not a gutter but an off-by-one: the
 * bottom of row 7 is the top of row 8, so a bottom border that asked «which row starts nearest»
 * would answer 8 and grow the element by a row nobody pulled it over.
 */
export function lastRowAt(y: number, metrics: GridMetrics): number {
  return nearestRow(y, metrics, "end");
}

function nearestRow(y: number, metrics: GridMetrics, side: "start" | "end"): number {
  const offsets = edges(metrics.rows);
  const local = y - metrics.top;
  const last = offsets.at(-1) ?? 0;
  // Past the last row the grid grows downwards in steps of `ROW_STEP_PX`, so a point below
  // everything is extrapolated rather than clamped: that is how a section gets taller, and `dropAt`
  // (or `resizeTo`) is what decides whether it may.
  if (local > last) {
    const grown = metrics.rows.length + Math.round((local - last) / ROW_STEP_PX);
    return Math.min(MAX_ROW, Math.max(1, side === "start" ? grown + 1 : grown));
  }
  let best = 1;
  let distance = Number.POSITIVE_INFINITY;
  // A start line exists for the row **after** the last one — that is how a section grows, and the
  // drag depends on it; an end line does not, because there is no row there to end in.
  const upTo = metrics.rows.length + (side === "start" ? 1 : 0);
  for (let row = 1; row <= upTo; row += 1) {
    const offset = offsets[row - (side === "start" ? 1 : 0)];
    if (offset === undefined) break;
    const to = Math.abs(local - offset);
    if (to < distance) {
      distance = to;
      best = row;
    }
  }
  return Math.min(MAX_ROW, Math.max(1, best));
}

/** The cell a point falls in: the nearest unit and the nearest row. */
export function cellAt(at: Point, metrics: GridMetrics): Cell {
  return { column: fineColumnAt(at.x, metrics), row: rowAt(at.y, metrics) };
}

/**
 * Whether two grid areas share any cell.
 *
 * **Not a refusal any more** (ADR 0050, amending ADR 0048 §4): overlapping is allowed, as it is in
 * Canva and Word, and the stacking order is the document's own. Kept because the download review
 * asks a related question — two *texts* on top of each other are illegible and worth a warning,
 * which día 5 builds in `packages/schema` where the document can be asked.
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
 * - `place` — the element goes to this unit and row, keeping both of its spans.
 * - `refuse` — nothing moves, and `why` says which floor was hit. **Only one reason is left**:
 *   `rows`, the interface's own floor on how far down a section may grow. «Occupied» is gone with
 *   the refusal it belonged to.
 */
export type Drop =
  | { readonly kind: "place"; readonly at: GridArea }
  | { readonly kind: "refuse"; readonly why: "rows"; readonly at: GridArea };

/**
 * **It stays where it is let go, and overlapping is allowed** (ADR 0050 §6, amending ADR 0048 §4).
 *
 * Sprint 24 refused a drop onto a cell another element held and put the element back. With a unit
 * of nine pixels almost any drop touches something, so the rule that protected the gesture became
 * the thing that made it impossible — and the document has always allowed two elements in one cell,
 * because CSS grid stacks them and overlapping on purpose is a real technique. David decided it:
 * the later element in the document paints on top, and there is no «bring to front» this sprint.
 *
 * `at` is the element's **top-left corner**, not the pointer: the hand keeps hold of the element
 * where it took it, which is what `barPosition`'s own drag learned and what any hand expects of
 * something it has picked up.
 */
export function dropAt(args: {
  readonly metrics: GridMetrics;
  readonly at: Point;
  readonly moving: Placement;
}): Drop {
  const { metrics, at, moving } = args;
  const cell = cellAt(at, metrics);

  // Rule 4's own coupling, the same one `boundsFor` applies to the panel's arrows: an element keeps
  // its span, so how far right it may start is what still fits inside the ninety-six units. Clamped
  // rather than refused — a hand that overshoots the right edge means «as far right as it goes».
  const target: GridArea = {
    column: Math.max(1, Math.min(cell.column, FINE_COLUMNS - moving.columnSpan + 1)),
    columnSpan: moving.columnSpan,
    row: cell.row,
    rowSpan: moving.rowSpan,
  };

  // Rows have no limit in the document model — a grid grows downwards — so this is the interface's
  // own floor (`MAX_ROW`, four hundred rows of eight pixels), and past it the honest answer is no
  // rather than a clamp that would put the element somewhere nobody asked for.
  if (target.row + target.rowSpan - 1 > MAX_ROW) {
    return { kind: "refuse", why: "rows", at: target };
  }
  return { kind: "place", at: target };
}

/**
 * **The keyboard's half of the drag** (ADR 0049, sprint 24 día 9).
 *
 * A pointer gesture with no keyboard equivalent does not exist for whoever has no pointer — the rule
 * this repository has applied to every handle it ever drew — and WCAG 2.1.1 says the same thing with
 * a number. So with an element chosen, the arrows move it and `Shift` with a sideways arrow widens
 * or narrows it.
 *
 * **One press is one catalog column of eight units, until día 6 makes it one unit with `Shift` for
 * eight.** A press worth a ninety-sixth of the section would be a control nobody could use to cross
 * one, and día 6 is where the accumulated run and the announcement in pixels arrive together — the
 * two halves of David's own condition. Today's model change is the pointer's, and it travels alone.
 *
 * **Vertical only moves; it never resizes.** `Shift+ArrowDown` would be «one row taller», which is a
 * different kind of change — a row's height is its content's — and the panel's own stepper already
 * owns `rowSpan`. Offering half of a pair here would read as the other half being broken.
 */
export const ARROW_UNITS = FINE_PER_COLUMN;

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
 * **One vocabulary for the pointer and the keyboard, and now one permission too**: the pointer may
 * drop an element on top of another, so the arrows may walk one there. The refusal that is left is
 * the same for both — the floor on rows — and `none` is «the press changes nothing»: an element
 * already against the left edge, or already one unit wide. Silence is the honest answer there;
 * announcing a position nobody moved to would teach a screen reader's user that the press worked.
 */
export function arrowDrop(args: {
  readonly moving: Placement;
  readonly action: ArrowAction;
}): Drop | { readonly kind: "none" } {
  const { moving, action } = args;
  if (action.kind === "none") return NO_DROP;

  const target: GridArea =
    action.kind === "move"
      ? {
          column: moving.column + action.column * ARROW_UNITS,
          columnSpan: moving.columnSpan,
          row: moving.row + action.row,
          rowSpan: moving.rowSpan,
        }
      : {
          column: moving.column,
          columnSpan: moving.columnSpan + action.columns * ARROW_UNITS,
          row: moving.row,
          rowSpan: moving.rowSpan,
        };

  // Rule 4's coupling, the same arithmetic `boundsFor` gives the panel's arrows: a unit that still
  // fits the span, a span that still fits from the unit, and the interface's own floor on rows.
  // Outside any of them the press is refused rather than clamped — a clamp would answer a
  // deliberate press with a move nobody asked for.
  if (target.column < 1 || target.column + target.columnSpan - 1 > FINE_COLUMNS) return NO_DROP;
  if (target.columnSpan < 1) return NO_DROP;
  if (target.row < 1 || target.row + target.rowSpan - 1 > MAX_ROW) return NO_DROP;

  return { kind: "place", at: target };
}

/**
 * What the editor says out loud when an element moves, **in the parent document's live region**.
 *
 * David's correction while approving sprint 24, and it is a defect that would have shipped: every
 * arrow is an edit, every edit replaces the canvas's whole `srcDoc`, so a region inside the frame
 * would be a **freshly created** region on every move — and a screen reader does not announce the
 * contents of a region that has just appeared. The region lives in the editor's own document, which
 * survives the rebuild.
 *
 * **In catalog columns, because that is what one press moves** (`ARROW_UNITS`). Saying «columna 25
 * de 96» would be arithmetically true and useless: nobody counts in ninety-sixths, and a press
 * lands exactly on a twelfth. Día 6 replaces the whole sentence with pixels, which is what David
 * asked for once the arrows move by one unit.
 *
 * Two sentences for two acts: where it went, or how wide it is now. A move that said «ancho 4»
 * every time would bury the number that changed under one that did not.
 */
export function announceText(area: GridArea, kind: "move" | "span"): string {
  const key = kind === "move" ? "editor.canvas.at" : "editor.canvas.width";
  return es[key]
    .replace("{column}", String(Math.floor((area.column - 1) / FINE_PER_COLUMN) + 1))
    .replace("{columns}", String(GRID_COLUMNS))
    .replace("{row}", String(area.row))
    .replace("{span}", String(Math.round(area.columnSpan / FINE_PER_COLUMN)));
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
