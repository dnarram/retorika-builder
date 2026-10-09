import { describe, expect, it } from "vitest";
import { initialFocusIndex, tabDecision } from "../src/editor/focusTrap.ts";

/**
 * The trap's arithmetic, which is the half that can be wrong in a way no walk would notice.
 *
 * A keyboard walk through a dialog proves Tab reaches the buttons. It says nothing about Shift+Tab
 * off the first element, or Tab from a dialog with nothing focusable in it, or Tab after a click on
 * the backdrop took focus out — and those are the three cases where a trap stops being one.
 */

describe("tabDecision", () => {
  it("leaves the ordinary step to the browser", () => {
    // Between two elements inside the dialog there is nothing to decide, and the browser's own
    // notion of what is focusable is wider than any selector we would write.
    expect(tabDecision({ count: 3, current: 1, shiftKey: false })).toEqual({ kind: "browser" });
    expect(tabDecision({ count: 3, current: 1, shiftKey: true })).toEqual({ kind: "browser" });
  });

  it("wraps forward off the last element", () => {
    expect(tabDecision({ count: 3, current: 2, shiftKey: false })).toEqual({
      kind: "move",
      index: 0,
    });
  });

  it("wraps backward off the first element", () => {
    expect(tabDecision({ count: 3, current: 0, shiftKey: true })).toEqual({
      kind: "move",
      index: 2,
    });
  });

  it("does not wrap forward off the first, or backward off the last", () => {
    // The mirror of the two above. Without this a trap that wrapped on every press would pass them
    // both while making Tab useless.
    expect(tabDecision({ count: 3, current: 0, shiftKey: false })).toEqual({ kind: "browser" });
    expect(tabDecision({ count: 3, current: 2, shiftKey: true })).toEqual({ kind: "browser" });
  });

  it("pulls focus back in when it is outside, in the direction it was going", () => {
    expect(tabDecision({ count: 3, current: -1, shiftKey: false })).toEqual({
      kind: "move",
      index: 0,
    });
    expect(tabDecision({ count: 3, current: -1, shiftKey: true })).toEqual({
      kind: "move",
      index: 2,
    });
  });

  it("refuses to leave a dialog that has nothing to focus", () => {
    // The browser's next stop is the page the dialog has told a screen reader is unavailable, so
    // the only honest answer is to go nowhere.
    expect(tabDecision({ count: 0, current: -1, shiftKey: false })).toEqual({ kind: "stay" });
    expect(tabDecision({ count: 0, current: -1, shiftKey: true })).toEqual({ kind: "stay" });
  });

  it("wraps a single focusable element onto itself", () => {
    // Both edges are the same element, so both directions move to it. The alternative — treating
    // one element as "nothing to wrap to" — would let Tab out of the commonest alert dialog there
    // is, the one with a single «Entendido».
    expect(tabDecision({ count: 1, current: 0, shiftKey: false })).toEqual({
      kind: "move",
      index: 0,
    });
    expect(tabDecision({ count: 1, current: 0, shiftKey: true })).toEqual({
      kind: "move",
      index: 0,
    });
  });
});

describe("initialFocusIndex", () => {
  it("takes the first element when the dialog asked for nothing", () => {
    expect(initialFocusIndex({ count: 3, preferred: -1 })).toBe(0);
  });

  it("honours what the dialog asked for", () => {
    // The case `AccountPage`'s comment described and the code did not do.
    expect(initialFocusIndex({ count: 3, preferred: 1 })).toBe(1);
  });

  it("falls back to the first when the asked-for element is not focusable now", () => {
    // A dialog can ask for a button that its own state has disabled — «Descargar igualmente»
    // appears only on the warning branch. Asking for something absent must not mean focusing
    // nothing, which would leave focus on the opener outside a dialog claiming to be modal.
    expect(initialFocusIndex({ count: 2, preferred: 7 })).toBe(0);
  });

  it("says «the container» when there is nothing to focus", () => {
    expect(initialFocusIndex({ count: 0, preferred: -1 })).toBe(null);
    expect(initialFocusIndex({ count: 0, preferred: 2 })).toBe(null);
  });
});
