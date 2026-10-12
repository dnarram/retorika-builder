import { describe, expect, it } from "vitest";
import {
  LOOK_AHEAD_DEADLINE_MS,
  type LookAheadTick,
  lookAheadStep,
} from "../src/editor/lookAhead.ts";

/**
 * The look-ahead's decision, pinned where it was wrong (sprint 18 day 5): after wiring a live
 * document it must keep looking, because the document this `html` produced may not be the one it
 * just wired. Six probed failures said so; see `lookAhead.ts`.
 */
const ready: LookAheadTick = {
  document: true,
  unwired: true,
  parsed: true,
  hasSection: true,
  pending: false,
  withinDeadline: true,
};

describe("the canvas look-ahead, one tick at a time", () => {
  it("wires a parsed, unwired live document — and keeps looking", () => {
    expect(lookAheadStep(ready)).toBe("wire");
  });

  it("promotes a parsed, unwired buffered document, and stops: the swap restarts the walk", () => {
    expect(lookAheadStep({ ...ready, pending: true })).toBe("promote");
  });

  it("waits while the document is missing, still loading, already wired, or has no section", () => {
    expect(lookAheadStep({ ...ready, document: false })).toBe("wait");
    expect(lookAheadStep({ ...ready, parsed: false })).toBe("wait");
    expect(lookAheadStep({ ...ready, unwired: false })).toBe("wait");
    expect(lookAheadStep({ ...ready, hasSection: false })).toBe("wait");
  });

  it("stops at the deadline whatever it sees, except a promotion", () => {
    expect(lookAheadStep({ ...ready, withinDeadline: false })).toBe("stop");
    expect(lookAheadStep({ ...ready, unwired: false, withinDeadline: false })).toBe("stop");
    expect(lookAheadStep({ ...ready, pending: true, withinDeadline: false })).toBe("promote");
  });

  it("the sequence the probe recorded: wire the outgoing document, then the arriving one", () => {
    // First tick: the first document, parsed and unwired, is in the frame — wired, keep looking.
    expect(lookAheadStep(ready)).toBe("wire");
    // Next ticks: the same document, now wired — wait, do not stop.
    expect(lookAheadStep({ ...ready, unwired: false })).toBe("wait");
    // Then the second document replaces it, parsed and unwired — wired too. With «stop after
    // wiring» this tick never ran, and the second document waited for `load`.
    expect(lookAheadStep(ready)).toBe("wire");
  });

  it("looks for two seconds, which is the number the day chose", () => {
    expect(LOOK_AHEAD_DEADLINE_MS).toBe(2_000);
  });
});
