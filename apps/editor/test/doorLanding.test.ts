import { FINE_COLUMNS, ROW_STEP_PX } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { doorLanding, fineTracksFor } from "../src/editor/doorLanding.ts";

// The generated cover at 1280: 1184 px of content and the default scale's 16 px gutter, which is
// a unit of (1184 − 176) / 96 = 10.5 px.
const WIDTH = 1184;
const GAP = 16;
const UNIT = (WIDTH - 11 * GAP) / 96;
/** The left edge of unit `column`, through the gutters before it. */
const edgeOf = (column: number) => (column - 1) * UNIT + Math.floor((column - 1) / 8) * GAP;

describe("fineTracksFor", () => {
  it("lays out ninety-six units and eleven gutters that add up to the content width", () => {
    const tracks = fineTracksFor(WIDTH, GAP);
    expect(tracks).toHaveLength(107);
    expect(tracks.reduce((total, track) => total + track, 0)).toBeCloseTo(WIDTH, 6);
    // Every ninth track is a gutter, the sixteen pixels the catalog's columns keep between them.
    expect(tracks[8]).toBe(GAP);
    expect(tracks[17]).toBe(GAP);
    expect(tracks[105]).toBeCloseTo(UNIT, 6);
    expect(tracks.filter((track) => track === GAP)).toHaveLength(11);
  });

  it("refuses what is not a width and a gap", () => {
    expect(() => fineTracksFor(Number.NaN, GAP)).toThrow(/fineTracksFor/);
    expect(() => fineTracksFor(WIDTH, -1)).toThrow(/fineTracksFor/);
  });
});

describe("doorLanding", () => {
  it("lands a move in the nearest unit and the nearest row, keeping both spans", () => {
    const rect = { left: edgeOf(1), top: 0, right: 200, bottom: 50 };
    expect(doorLanding({ contentWidth: WIDTH, gap: GAP, rect, kind: "move" })).toEqual({
      column: 1,
      row: 1,
    });
    // One catalog column to the right — eight units and a gutter — and five rows down.
    const moved = {
      left: edgeOf(9),
      top: 5 * ROW_STEP_PX,
      right: edgeOf(9) + 200,
      bottom: 5 * ROW_STEP_PX + 50,
    };
    expect(doorLanding({ contentWidth: WIDTH, gap: GAP, rect: moved, kind: "move" })).toEqual({
      column: 9,
      row: 6,
    });
  });

  it("rounds to the nearest line, not the band the point is in (ADR 0048 §1's magnet)", () => {
    // Four pixels past unit 9's edge is still unit 9; seven past it — of a 10.5 unit — is unit 10.
    const near = { left: edgeOf(9) + 4, top: 3, right: 300, bottom: 50 };
    expect(doorLanding({ contentWidth: WIDTH, gap: GAP, rect: near, kind: "move" })).toEqual({
      column: 9,
      row: 1,
    });
    const past = { left: edgeOf(9) + 7, top: 5, right: 300, bottom: 50 };
    expect(doorLanding({ contentWidth: WIDTH, gap: GAP, rect: past, kind: "move" })).toEqual({
      column: 10,
      row: 2,
    });
  });

  it("reads all four lines for a box, the right edge against units' ends", () => {
    // Units 9 to 24 exactly: the right edge is the end of unit 24, which is the start of the
    // gutter after it — and nine rows of eight pixels from row 3.
    const rect = {
      left: edgeOf(9),
      top: 2 * ROW_STEP_PX,
      right: edgeOf(24) + UNIT,
      bottom: 11 * ROW_STEP_PX,
    };
    expect(doorLanding({ contentWidth: WIDTH, gap: GAP, rect, kind: "box" })).toEqual({
      column: 9,
      columnSpan: 16,
      row: 3,
      rowSpan: 9,
    });
  });

  it("clamps at the grid's edges and never inverts a box", () => {
    const wide = { left: -40, top: -20, right: WIDTH + 40, bottom: 4 };
    expect(doorLanding({ contentWidth: WIDTH, gap: GAP, rect: wide, kind: "box" })).toEqual({
      column: 1,
      columnSpan: FINE_COLUMNS,
      row: 1,
      rowSpan: 1,
    });
    // A box narrower than a unit is one unit, never zero.
    const thin = { left: edgeOf(5), top: 0, right: edgeOf(5) + 1, bottom: 1 };
    expect(doorLanding({ contentWidth: WIDTH, gap: GAP, rect: thin, kind: "box" })).toMatchObject({
      column: 5,
      columnSpan: 1,
      rowSpan: 1,
    });
  });
});
