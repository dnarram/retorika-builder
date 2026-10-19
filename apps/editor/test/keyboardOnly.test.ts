import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **The keyboard-only walk really is keyboard-only, checked at the source.**
 *
 * Sprint 17's acceptance is «monta una web, la edita, le da estilo y descarga el ZIP sin tocar el
 * trackpad», and the walk that demonstrates it is in `e2e/critical-flows.e2e.test.ts` between two
 * markers. A walk like that is only worth anything if it is true, and nothing in Playwright stops
 * somebody adding a `.click()` to it the day it goes red: the walk would still pass, still be
 * called «sin ratón», and prove nothing at all.
 *
 * So the claim is a test rather than a comment. It runs in the plain `pnpm test` — no browser, no
 * server — which also means it fails in seconds rather than after a four-minute suite.
 *
 * **`fill`, `check` and `selectOption` are forbidden alongside the pointer calls**, and that is
 * the part worth explaining. None of them is a mouse. All three skip the focus the walk exists to
 * prove: `fill` puts text in a field without the Tab that reached it, `check` ticks a radio without
 * the arrow that moved to it. A walk that used them would be keyboard-only in the sense that it
 * touched no mouse, and worthless in the sense that matters.
 */

const WALK = fileURLToPath(new URL("../e2e/critical-flows.e2e.test.ts", import.meta.url));
const START = "// --- RECORRIDO SIN RATÓN: INICIO ---";
const END = "// --- RECORRIDO SIN RATÓN: FIN ---";

/** Pointer gestures, and the three shortcuts that bypass focus without being pointer gestures. */
const FORBIDDEN = [
  ".click(",
  ".dblclick(",
  ".hover(",
  ".tap(",
  ".dragTo(",
  ".selectOption(",
  ".setChecked(",
  ".check(",
  ".uncheck(",
  ".fill(",
  ".setInputFiles(",
  "mouse.",
  "touchscreen.",
];

const source = readFileSync(WALK, "utf8");

/**
 * Every marked region, in order — **plural since sprint 24 día 10**.
 *
 * There was one walk and one pair of markers, and the first version of this file asserted that each
 * marker appeared exactly once. That was the right guard for one walk and the wrong shape for two:
 * the keyboard half of the drag (ADR 0049) is its own journey — tools on, a section designed by
 * hand, an element moved cell by cell — and bolting it onto the end of the first walk would have
 * shifted every Tab count that walk has measured since sprint 17.
 *
 * So the rule becomes «every marked region», and the vacuity guard moves with it: the markers must
 * pair up, there must be at least two of them, and each region is checked on its own.
 */
function regions(): string[] {
  const found: string[] = [];
  let at = 0;
  for (;;) {
    const start = source.indexOf(START, at);
    if (start === -1) break;
    const end = source.indexOf(END, start);
    expect(end, "a start marker with no end marker after it").toBeGreaterThan(start);
    found.push(source.slice(start, end));
    at = end + END.length;
  }
  return found;
}

describe("the keyboard-only walks use no pointer", () => {
  it("has its markers in pairs, so no check below can be vacuous", () => {
    // The failure this guards against is the one that makes every assertion below pass for free: a
    // renamed marker, a deleted walk, or a start with no end.
    const starts = source.split(START).length - 1;
    const ends = source.split(END).length - 1;
    expect(starts, "start markers").toBe(ends);
    expect(
      starts,
      "there are two keyboard-only walks since sprint 24 día 10",
    ).toBeGreaterThanOrEqual(2);
    expect(regions()).toHaveLength(starts);
  });

  it("holds walks of a reasonable size between them", () => {
    // A block that shrank to nothing would satisfy every «contains no pointer» check below while
    // demonstrating nothing. The number is a floor and not a measurement: anything under forty
    // lines means a walk has been gutted rather than edited.
    for (const [index, block] of regions().entries()) {
      expect(block.split("\n").length, `the walk in region ${index + 1}`).toBeGreaterThan(40);
    }
  });

  it.each(FORBIDDEN)("does not use %s", (call) => {
    for (const [index, block] of regions().entries()) {
      expect(
        block.includes(call),
        `keyboard-only walk ${index + 1} uses ${call}. Sprint 17's acceptance is that the whole ` +
          "journey runs without a trackpad, and a pointer call — or a fill, a check or a " +
          "selectOption, which skip the focus the walk exists to prove — makes that claim false " +
          "while leaving it green.",
      ).toBe(false);
    }
  });

  it("does press keys, so these are keyboard walks and not merely mouseless ones", () => {
    for (const [index, block] of regions().entries()) {
      expect(block, `no key is pressed at all in region ${index + 1}`).toContain("keyboard.press(");
    }
    // Typing belongs to the first journey, which fills the questionnaire; the second one moves an
    // element that is already there, so it presses and never types.
    expect(regions()[0], "nothing is typed at all").toContain("keyboard.type(");
  });
});
