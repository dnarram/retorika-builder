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

describe("the keyboard-only walk uses no pointer", () => {
  it("has its markers, exactly once each, so the check cannot be vacuous", () => {
    // The failure this guards against is the one that makes every assertion below pass for free: a
    // renamed marker, a deleted walk, or a second copy of either marker.
    expect(source.split(START).length - 1, "the start marker").toBe(1);
    expect(source.split(END).length - 1, "the end marker").toBe(1);
    expect(source.indexOf(START)).toBeLessThan(source.indexOf(END));
  });

  it("holds a walk of a reasonable size between them", () => {
    // A block that shrank to nothing would satisfy every «contains no pointer» check below while
    // demonstrating nothing. The number is a floor and not a measurement: the walk is some two
    // hundred lines, and anything under forty means it has been gutted rather than edited.
    const block = source.slice(source.indexOf(START), source.indexOf(END));
    expect(block.split("\n").length, "the walk between the markers").toBeGreaterThan(40);
  });

  it.each(FORBIDDEN)("does not use %s", (call) => {
    const block = source.slice(source.indexOf(START), source.indexOf(END));
    expect(
      block.includes(call),
      `the keyboard-only walk uses ${call}. Sprint 17's acceptance is that the whole journey runs ` +
        "without a trackpad, and a pointer call — or a fill, a check or a selectOption, which skip " +
        "the focus the walk exists to prove — makes that claim false while leaving it green.",
    ).toBe(false);
  });

  it("does press keys, so it is a keyboard walk and not merely a mouseless one", () => {
    const block = source.slice(source.indexOf(START), source.indexOf(END));
    expect(block, "no key is pressed at all").toContain("keyboard.press(");
    expect(block, "nothing is typed at all").toContain("keyboard.type(");
  });
});
