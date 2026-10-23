/**
 * What the canvas's look-ahead does on one tick — the decision alone, with no frame in it.
 *
 * Sprint 18 day 5. The `e2e` suite's intermittent since sprint 7 was read off the editor's own
 * probe in six failing runs, and every account said the same thing: the bank's photographs landed
 * a few milliseconds behind the first document's `html`, which replaced `srcDoc` **before that
 * document had been wired** — its look-ahead was cancelled by the re-run. The look-ahead for the
 * second `html` then found the *first* document still in the frame, parsed and unwired, wired it,
 * and stopped. The second document arrived unwired and stayed so until `load`, 65 ms later on a
 * quiet machine and 1.5 s with the fonts held; a press in that window was lost.
 *
 * The decision that was wrong is «stop after wiring». A wiring proves a document was there, not
 * that it was the document this `html` produced; the one on its way can still be on its way. So a
 * tick that wires a live document **keeps looking** until the deadline, and a later document is
 * wired the moment it is parsed — which costs one property read per frame for the rest of the
 * deadline and nothing else, because `wireOnce` wires a document at most once by identity and mark.
 *
 * **One target since sprint 27 día 1.** There was a third answer, `promote`, for the buffered frame
 * of a chrome swap: a document ready in the frame nobody could see was handed the canvas, and that
 * moved the buffer state, which restarted the look-ahead, so stopping there was right. With `swap`
 * retired there is one frame and one document, and the tick has nothing to promote.
 */

export interface LookAheadTick {
  /** Is there a document in the target frame at all. */
  document: boolean;
  /** Is it a document the chrome is not yet attached to. */
  unwired: boolean;
  /**
   * `readyState !== "loading"`: every section exists.
   *
   * **Parsed, not merely started.** `readyState` leaves `"loading"` at the frame's own
   * `DOMContentLoaded`, which is exactly the moment every section exists and still long before
   * `load` waits out the font requests — so this closes the window the look-ahead was written for
   * without opening a worse one. Without it the test was «has it got a section yet», and a
   * streaming document has its first section long before its last: the chrome was then attached
   * to a partial page, gaps for the sections parsed so far and none for the rest. Measured on
   * 5 October 2026 with the fonts held 1.5 s and the CPU throttled 20×, counting `.rb-gap` against
   * `[data-section]` on a five-section page: 1 run in 6 wired a partial document on `main`, and
   * 3 in 4 once the canvas started resizing itself on mount — which is how CI found it.
   */
  parsed: boolean;
  /** Has it at least one `[data-section]`. */
  hasSection: boolean;
  /** Is the deadline still ahead. */
  withinDeadline: boolean;
}

export type LookAheadStep = "wire" | "wait" | "stop";

/**
 * `stop` ends the loop; `wire` and `wait` schedule another tick. `wire` means the document is ready
 * and unwired: attach the chrome **and keep looking**, because a second document could still be on
 * its way — which it no longer can be under the patch route, and the rule is kept because its cost
 * is one property read per frame.
 */
export function lookAheadStep(tick: LookAheadTick): LookAheadStep {
  const ready = tick.document && tick.unwired && tick.parsed && tick.hasSection;
  if (ready) return tick.withinDeadline ? "wire" : "stop";
  return tick.withinDeadline ? "wait" : "stop";
}

/**
 * How long the look-ahead keeps looking. Two seconds since sprint 18 day 5, from one: a second
 * document could follow the first by any amount a loaded machine chose, and the cost of an idle
 * tick is one property read. Since sprint 27 día 1 the walk runs once, at mount, so this is how
 * long the editor will wait for its only document to be parsed before giving up on beating `load`.
 */
export const LOOK_AHEAD_DEADLINE_MS = 2_000;
