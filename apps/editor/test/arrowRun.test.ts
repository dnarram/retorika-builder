import { describe, expect, it } from "vitest";
import { type ArrowRun, accumulate, gone, moves, RUN_IDLE_MS } from "../src/editor/arrowRun.ts";

/**
 * A run of arrow presses (ADR 0050 §6, sprint 25 día 6), with the clock said out loud.
 *
 * David's condition: «Las pulsaciones seguidas son un solo paso del historial […] se escribe al
 * soltar la tecla (o tras ~300 ms sin pulsar)». The arithmetic is here; the timer is the editor's.
 */

const right = { columns: 1, rows: 0 };
const down = { columns: 0, rows: 1 };

describe("accumulate", () => {
  it("starts a run on the first press", () => {
    expect(accumulate(null, right, 1_000)).toEqual({ columns: 1, rows: 0, at: 1_000 });
  });

  it("adds a press that arrives while the run is alive, on both axes", () => {
    let run: ArrowRun | null = accumulate(null, right, 1_000);
    run = accumulate(run, right, 1_030);
    run = accumulate(run, down, 1_060);
    expect(run).toEqual({ columns: 2, rows: 1, at: 1_060 });
  });

  it("is twenty units after a key held for twenty repeats, and one run", () => {
    // What a held `ArrowRight` produces: a press every thirty milliseconds or so, none of them a
    // pause. The walk asserts the same thing through the document — one step, one movement.
    let run: ArrowRun | null = null;
    for (let press = 0; press < 20; press += 1) run = accumulate(run, right, 1_000 + press * 30);
    expect(run).toEqual({ columns: 20, rows: 0, at: 1_570 });
  });

  it("starts a new run once the hand has paused, which is what makes three presses three steps", () => {
    const first = accumulate(null, right, 1_000);
    const second = accumulate(first, right, 1_000 + RUN_IDLE_MS);
    expect(second).toEqual({ columns: 1, rows: 0, at: 1_300 });
  });

  it("counts a press one millisecond before the pause as still the same run", () => {
    const run = accumulate(accumulate(null, right, 1_000), right, 1_000 + RUN_IDLE_MS - 1);
    expect(run.columns).toBe(2);
  });

  it("starts a new run when the clock goes backwards rather than owing time", () => {
    expect(accumulate(accumulate(null, right, 5_000), right, 4_000)).toEqual({
      columns: 1,
      rows: 0,
      at: 4_000,
    });
  });

  it("keeps the two directions of one axis cancelling, because that is what the hand did", () => {
    // Right then left is a run that moved nothing, and `moves` is what decides whether a step
    // opens at all: pressing a key and taking it back should leave no history behind.
    let run: ArrowRun | null = accumulate(null, right, 1_000);
    run = accumulate(run, { columns: -1, rows: 0 }, 1_020);
    expect(run?.columns).toBe(0);
    expect(moves(run)).toBe(false);
  });
});

describe("gone", () => {
  it("is false while the presses keep coming and true once they stop", () => {
    const run: ArrowRun = { columns: 3, rows: 0, at: 1_000 };
    expect(gone(run, 1_100)).toBe(false);
    expect(gone(run, 1_299)).toBe(false);
    expect(gone(run, 1_000 + RUN_IDLE_MS)).toBe(true);
    expect(gone(run, 9_000)).toBe(true);
  });

  it("is three hundred milliseconds, which is David's own number", () => {
    expect(RUN_IDLE_MS).toBe(300);
  });
});

describe("moves", () => {
  it("is false for nothing and for a run that came back to where it started", () => {
    expect(moves(null)).toBe(false);
    expect(moves({ columns: 0, rows: 0, at: 1 })).toBe(false);
    expect(moves({ columns: 0, rows: -2, at: 1 })).toBe(true);
    expect(moves({ columns: 5, rows: 0, at: 1 })).toBe(true);
  });
});
