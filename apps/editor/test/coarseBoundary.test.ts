import { FINE_COLUMNS, FINE_PER_COLUMN, GRID_COLUMNS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { toCoarse, toFine } from "../src/editor/coarseBoundary.ts";

/**
 * The edge between the fine grid the document holds and the twelve columns the drag still snaps to
 * (sprint 25 día 1, ADR 0050). Two functions, tested as the round trip they have to be until día 3
 * deletes them.
 */

const place = (column: number, columnSpan: number, row = 3, rowSpan = 2) => ({
  elementId: "el",
  column,
  columnSpan,
  row,
  rowSpan,
});

describe("toFine", () => {
  it("writes a catalog column as the first of its eight units and a span as eight per column", () => {
    expect(toFine(place(1, 6))).toMatchObject({ column: 1, columnSpan: 48 });
    expect(toFine(place(4, 6))).toMatchObject({ column: 25, columnSpan: 48 });
    expect(toFine(place(12, 1))).toMatchObject({ column: 89, columnSpan: 8 });
  });

  it("leaves the rows and the id alone: a free section's rows are already the fine grid's", () => {
    expect(toFine(place(2, 2, 7, 5))).toEqual({
      elementId: "el",
      column: 9,
      columnSpan: 16,
      row: 7,
      rowSpan: 5,
    });
  });
});

describe("toCoarse", () => {
  it("is the inverse of toFine for every catalog placement", () => {
    for (let column = 1; column <= GRID_COLUMNS; column += 1) {
      for (let span = 1; column + span - 1 <= GRID_COLUMNS; span += 1) {
        expect(toCoarse(toFine(place(column, span))), `${column}/${span}`).toEqual(
          place(column, span),
        );
      }
    }
  });

  it("takes the column a unit the drag cannot produce yet falls in, never below one", () => {
    // Three units into column 6 is still column 6, and so is its last unit; six and a half
    // columns wide rounds to seven.
    expect(toCoarse(place(48, 8))).toMatchObject({ column: 6, columnSpan: 1 });
    expect(toCoarse(place(44, 52))).toMatchObject({ column: 6, columnSpan: 7 });
    expect(toCoarse(place(1, 3))).toMatchObject({ column: 1, columnSpan: 1 });
    expect(toCoarse(place(FINE_COLUMNS, 1))).toMatchObject({ column: 12, columnSpan: 1 });
  });

  it("never lets a round trip reach past the last unit", () => {
    const back = toFine(toCoarse(place(FINE_COLUMNS - FINE_PER_COLUMN + 1, FINE_PER_COLUMN)));
    expect(back.column + back.columnSpan - 1).toBe(FINE_COLUMNS);
  });
});
