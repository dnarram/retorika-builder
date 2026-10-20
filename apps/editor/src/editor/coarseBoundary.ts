import { FINE_PER_COLUMN, type Placement } from "@retorika/schema";

/**
 * **The edge between a document in fine units and a drag that still thinks in twelve columns** —
 * sprint 25 día 1, and the file says so because it is meant to be deleted.
 *
 * ADR 0050 moved a hand-designed section's placements to ninety-six units in one pull request, so
 * that the document, the renderer and the migration land together and a deployed site is never
 * half-converted. The drag (`dragGrid.ts`) and the keyboard still snap to the catalog's twelve
 * columns until día 3 teaches them the fine grid, and until then the two have to meet somewhere.
 * They meet here, in two functions and nowhere else: what goes into `dropAt` and `arrowDrop` is
 * converted down, what comes out is converted up, and the rest of the editor never sees a twelve.
 *
 * **Rows pass through untouched.** A free section's rows are the eight-pixel rows of the fine grid
 * already, the drag reads their resolved heights off `grid-template-rows`, and an arrow moves one
 * of them — the vertical half of «stays where you let go» is here from día 1.
 *
 * `toCoarse` takes the column a unit falls in and the nearest whole number of columns for a span,
 * because nothing in día 1 can produce a unit that is not a multiple of eight (the migration
 * multiplies, `escalate` multiplies, and the two verbs below write what `toFine` produced) — so
 * today it is exact, and the day it stops being exact is the day this file goes.
 */

/** A fine placement, as the twelve-column drag reads it. Rows are rows. */
export function toCoarse(placement: Placement): Placement {
  return {
    ...placement,
    column: Math.floor((placement.column - 1) / FINE_PER_COLUMN) + 1,
    columnSpan: Math.max(1, Math.round(placement.columnSpan / FINE_PER_COLUMN)),
  };
}

/** A twelve-column area, written back in the document's units. Rows are rows. */
export function toFine<T extends { column: number; columnSpan: number }>(area: T): T {
  return {
    ...area,
    column: (area.column - 1) * FINE_PER_COLUMN + 1,
    columnSpan: area.columnSpan * FINE_PER_COLUMN,
  };
}
