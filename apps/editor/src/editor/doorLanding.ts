import { FINE_COLUMNS, FINE_PER_COLUMN, type PlacementEdit } from "@retorika/schema";
import { fineColumnAt, fineLastColumnAt, type GridMetrics, lastRowAt, rowAt } from "./dragGrid.ts";

/**
 * **Where a gesture begun in a section the catalog draws lands once the section is the hand's**
 * (sprint 41 día 3, David's option B for the door: «nada se mueve sin tu sí»), decided without a DOM.
 *
 * A drag or a pull in a catalog section asks before changing anything (ADR 0048 §7); until today
 * the question was asked the moment the hand moved and nothing followed the hand. Now the element
 * follows, the question is asked on release, and on «Diseñar a mano» the section is escalated **and**
 * the element lands where the hand left it — in one step. The landing cannot be read off the page:
 * the fine grid's tracks exist only once the section has been escalated, which is the same step.
 * So they are computed here from what the catalog section already knows — its content width and
 * the theme's gutter — exactly as the renderer will lay them out (`fineTemplateColumns`: eight
 * units of `minmax(0, 1fr)`, a gutter of `space.md`, eight more, and so on), and the rows from
 * ADR 0050 §3's eight-pixel step, which a freshly escalated section measures by construction.
 *
 * Everything is the frame's pixels in, relative to the section's content box, and document units
 * out: rule 4 is untouched here as everywhere.
 */

/** The 107 column tracks a hand-designed section of this width will resolve to: ninety-six units
 * and the eleven gutters between the catalog's columns, in order. */
export function fineTracksFor(contentWidth: number, gap: number): number[] {
  if (!Number.isFinite(contentWidth) || !Number.isFinite(gap) || gap < 0) {
    throw new Error(`fineTracksFor: a width and a gap in pixels, not ${contentWidth} and ${gap}`);
  }
  const gutters = FINE_COLUMNS / FINE_PER_COLUMN - 1;
  const unit = Math.max(0, (contentWidth - gutters * gap) / FINE_COLUMNS);
  const tracks: number[] = [];
  for (let column = 1; column <= FINE_COLUMNS; column += 1) {
    tracks.push(unit);
    if (column % FINE_PER_COLUMN === 0 && column < FINE_COLUMNS) tracks.push(gap);
  }
  return tracks;
}

/** A box in the frame's pixels, relative to the section's content box. */
export interface DoorRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/**
 * The placement the hand asked for.
 *
 * `move` keeps both spans — a drag moves, it never resizes (ADR 0050 día 3) — and lands the box's
 * top-left corner in the nearest unit and the nearest row, the readings `dropAt` makes on a live
 * grid. `box` takes all four lines: the left edge aims at the unit whose start is nearest and the
 * right one at the unit whose end is nearest, the two readings a side's pull makes (`resizeTo`),
 * and the rows the same way. Both clamp at the grid's edges, never refusing, as every gesture on
 * this grid does.
 */
export function doorLanding(args: {
  readonly contentWidth: number;
  readonly gap: number;
  readonly rect: DoorRect;
  readonly kind: "move" | "box";
}): PlacementEdit {
  const { rect, kind } = args;
  // No rows: a section nobody has escalated yet has no resolved rows to read, and past the last
  // one `rowAt` extrapolates in eight-pixel steps — which is the whole grid here.
  const metrics: GridMetrics = {
    left: 0,
    top: 0,
    columns: fineTracksFor(args.contentWidth, args.gap),
    rows: [],
  };
  const column = fineColumnAt(rect.left, metrics);
  const row = rowAt(rect.top, metrics);
  if (kind === "move") return { column, row };
  const endColumn = Math.max(column, fineLastColumnAt(rect.right, metrics));
  const endRow = Math.max(row, lastRowAt(rect.bottom, metrics));
  return { column, columnSpan: endColumn - column + 1, row, rowSpan: endRow - row + 1 };
}
