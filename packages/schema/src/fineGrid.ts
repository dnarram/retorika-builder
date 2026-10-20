import {
  FINE_COLUMNS,
  FINE_PER_COLUMN,
  GRID_COLUMNS,
  type Placement,
  ROW_STEP_PX,
} from "./document.ts";

/**
 * **A hand-designed section is a fine grid, and the document never sees a gutter** (ADR 0050).
 *
 * The catalog draws on twelve columns with a gap between each pair, and a free section keeps that
 * geometry to the pixel: the same twelve bands and the same eleven gutters. What changes is the
 * unit a placement is written in — **ninety-six units**, eight to a catalog column — so that an
 * element let go by hand lands within 7–10 px of where the hand left it, which is below what a
 * person notices (the step was measured, not assumed: 9.3 px at 1440 with the panel shut, 7.0 with
 * it open; the table is in the ADR).
 *
 * **The gutters are tracks, not a `gap`.** A `gap` between ninety-six tracks would be ninety-five
 * gutters, and the catalog's sections would stop lining up with the free ones beside them. So the
 * published stylesheet declares **107 tracks** — eight content units, a gutter, eight more, a
 * gutter … — with `column-gap: 0`, and a placement's `column` has to be translated to a track
 * before it is written as `grid-column`. That translation lives here, in one function, because the
 * renderer, the editor's drag and the walks that read `grid-column` back must all agree on it; two
 * copies of this arithmetic is how an element would sit in one place in the editor and another on
 * the published page.
 *
 * Rows are the other axis and the simpler one: a free section's rows are **steps of `ROW_STEP_PX`**
 * (`grid-auto-rows: minmax(8px, auto)`), so `row` and `rowSpan` need no translation at all — a row
 * is a row. A row with more content than its span grows, and what is below it moves down; nothing
 * is ever clipped.
 *
 * **Rule 4 is not amended by any of this.** A placement is still a column, a span and a row on the
 * section's grid, and nothing here produces an `x` or a `y`. The grid got finer; it did not go away.
 */

/** The number of tracks a unit's group holds: its eight units and the gutter after them. */
const GROUP = FINE_PER_COLUMN + 1;

/** Every track of a free section, in order: content units and gutters. */
export const FINE_TRACKS = FINE_COLUMNS + (GRID_COLUMNS - 1);

/** A column outside 1..96 is a programming error, not a document to be lenient with. */
function assertFineColumn(column: number, what: string): void {
  if (!Number.isInteger(column) || column < 1 || column > FINE_COLUMNS) {
    throw new Error(`${what}: fine column ${column} is outside 1..${FINE_COLUMNS}`);
  }
}

/**
 * The CSS grid line a fine column starts on.
 *
 * Unit `f` sits after `f − 1` units and after one gutter for every full group of eight before it.
 * Columns 1..8 are tracks 1..8, track 9 is the first gutter, column 9 is track 10, and so on.
 */
export function fineTrack(column: number): number {
  assertFineColumn(column, "fineTrack");
  return column - 1 + Math.floor((column - 1) / FINE_PER_COLUMN) + 1;
}

/**
 * How many tracks a span covers, **gutters included**: a span that crosses from one group of eight
 * into the next takes the gutter between them with it, which is what makes a six-column catalog
 * element and its escalated copy of forty-eight units the same width.
 */
export function fineTrackSpan(column: number, columnSpan: number): number {
  assertFineColumn(column, "fineTrackSpan");
  const last = column + columnSpan - 1;
  assertFineColumn(last, "fineTrackSpan");
  return fineTrack(last) - fineTrack(column) + 1;
}

/**
 * The fine column a track belongs to — the inverse of `fineTrack`, for whatever reads
 * `grid-column` back off a page (the walks do). **A gutter track has no column**, and asking for
 * one is an error rather than a rounded guess: a placement never starts or ends on a gutter.
 */
export function fineColumnOf(track: number): number {
  if (!Number.isInteger(track) || track < 1 || track > FINE_TRACKS) {
    throw new Error(`fineColumnOf: track ${track} is outside 1..${FINE_TRACKS}`);
  }
  const group = Math.floor((track - 1) / GROUP);
  const offset = (track - 1) % GROUP;
  if (offset === FINE_PER_COLUMN) {
    throw new Error(
      `fineColumnOf: track ${track} is a gutter, which no placement starts or ends on`,
    );
  }
  return group * FINE_PER_COLUMN + offset + 1;
}

/** The fine span a track span covers — the inverse of `fineTrackSpan`, with the gutters taken
 * back out. */
export function fineSpanOf(track: number, trackSpan: number): number {
  return fineColumnOf(track + trackSpan - 1) - fineColumnOf(track) + 1;
}

/**
 * The `grid-template-columns` of a free section: the 107 tracks, written once in the stylesheet.
 *
 * `minmax(0, 1fr)` and not `1fr`, which is `minmax(auto, 1fr)`: a long word or a photograph with an
 * intrinsic width would inflate every unit it crosses, the other ninety-five would shrink to pay for
 * it, and the arithmetic above would stop describing the page. With a floor of zero the units stay
 * equal whatever is in them, and overflow is handled where it already is — `overflow-wrap` on text,
 * `width: 100%` on images.
 *
 * `repeat()` cannot nest, so the eleven groups are one `repeat` and the last eight units follow it.
 */
export function fineTemplateColumns(): string {
  const units = Array.from({ length: FINE_PER_COLUMN }, () => "minmax(0, 1fr)").join(" ");
  return `repeat(${GRID_COLUMNS - 1}, ${units} var(--space-md)) ${units}`;
}

/**
 * How many empty rows of `ROW_STEP_PX` stand in for one theme gap between two catalog rows.
 *
 * The catalog's rows are content-sized with `gap: var(--space-md)` between them; a free section's
 * are eight-pixel steps with no row gap at all. So a catalog layout converted to the fine grid puts
 * `gapRows` empty rows between every two of its rows, and the page keeps the same vertical rhythm:
 * exactly in the default scale (16 px → 2 rows), and within 4 px in the compact one (12 px → 2 rows,
 * which is 16) and the generous one (24 px → 3 rows, exactly). The ADR says so.
 *
 * Only a pixel length is accepted: the theme has stored `space.*` in pixels since schema 1.6.0
 * (migration 0007), and anything else here is a document this package does not know how to read.
 */
export function gapRowsFor(spaceMd: unknown): number {
  const match = typeof spaceMd === "string" ? /^(\d+(?:\.\d+)?)px$/.exec(spaceMd.trim()) : null;
  if (!match) {
    throw new Error(
      `gapRowsFor: the theme's space.md must be a pixel length, not ${JSON.stringify(spaceMd)}`,
    );
  }
  return Math.max(0, Math.round(Number.parseFloat(match[1] ?? "0") / ROW_STEP_PX));
}

/**
 * A catalog placement — twelve columns, content rows — written in the fine grid's units.
 *
 * **Horizontally exact**: column `c` becomes unit `(c − 1) · 8 + 1` and a span of `s` becomes
 * `s · 8`, which the track arithmetic above turns back into the same pixels. **Vertically a
 * rhythm, not a measurement**: row `r` becomes `(r − 1) · (1 + gapRows) + 1`, so each catalog row
 * is followed by the empty rows that stand for its gap, and a span of `rs` rows covers its rows and
 * the gaps between them. The content rows still grow to their content, so a text is where it was;
 * what this cannot reproduce is a photograph taller than the texts beside it, whose extra height a
 * content-sized grid spreads over the rows it spans — the editor measures the real boxes instead
 * when it escalates a section, and the migration, which has no page to measure, accepts the
 * difference and the ADR names it.
 */
export function coarseToFine(placement: Placement, gapRows: number): Placement {
  if (!Number.isInteger(gapRows) || gapRows < 0) {
    throw new Error(`coarseToFine: gapRows must be a whole number of at least 0, not ${gapRows}`);
  }
  const rhythm = 1 + gapRows;
  return {
    elementId: placement.elementId,
    column: (placement.column - 1) * FINE_PER_COLUMN + 1,
    columnSpan: placement.columnSpan * FINE_PER_COLUMN,
    row: (placement.row - 1) * rhythm + 1,
    rowSpan: placement.rowSpan * rhythm - gapRows,
  };
}
