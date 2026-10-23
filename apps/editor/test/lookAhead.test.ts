import { describe, expect, it } from "vitest";
import {
  LOOK_AHEAD_DEADLINE_MS,
  type LookAheadTick,
  lookAheadStep,
} from "../src/editor/lookAhead.ts";

/**
 * The look-ahead's decision, pinned where it was wrong (sprint 18 day 5): after wiring a document
 * it must keep looking, because the document this html produced may not be the one it just wired.
 * Six probed failures said so; see `lookAhead.ts`.
 *
 * The `promote` answer and the `pending` input left with the `swap` route on sprint 27 día 1. The
 * last case below is kept even though a second document can no longer arrive under the patch route:
 * it is the decision the six failures bought, and it costs one property read per frame.
 */
const ready: LookAheadTick = {
  document: true,
  unwired: true,
  parsed: true,
  hasSection: true,
  withinDeadline: true,
};

describe("the canvas look-ahead, one tick at a time", () => {
  it("wires a parsed, unwired live document — and keeps looking", () => {
    expect(lookAheadStep(ready)).toBe("wire");
  });

  it("waits while the document is missing, still loading, already wired, or has no section", () => {
    expect(lookAheadStep({ ...ready, document: false })).toBe("wait");
    expect(lookAheadStep({ ...ready, parsed: false })).toBe("wait");
    expect(lookAheadStep({ ...ready, unwired: false })).toBe("wait");
    expect(lookAheadStep({ ...ready, hasSection: false })).toBe("wait");
  });

  it("stops at the deadline whatever it sees", () => {
    expect(lookAheadStep({ ...ready, withinDeadline: false })).toBe("stop");
    expect(lookAheadStep({ ...ready, unwired: false, withinDeadline: false })).toBe("stop");
  });

  it("the sequence the probe recorded: wire the outgoing document, then the arriving one", () => {
    // First tick: the first document, parsed and unwired, is in the frame — wired, keep looking.
    expect(lookAheadStep(ready)).toBe("wire");
    // Next ticks: the same document, now wired — wait, do not stop.
    expect(lookAheadStep({ ...ready, unwired: false })).toBe("wait");
    // Then a second document replaces it, parsed and unwired — wired too. With «stop after
    // wiring» this tick never ran, and the second document waited for `load`. Kept as the record
    // of the decision; under one document per session there is no second document to find.
    expect(lookAheadStep(ready)).toBe("wire");
  });

  it("looks for two seconds, which is the number the day chose", () => {
    expect(LOOK_AHEAD_DEADLINE_MS).toBe(2_000);
  });
});
