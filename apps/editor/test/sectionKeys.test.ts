import { describe, expect, it } from "vitest";
import { rovingTabIndex, sectionKeyAction } from "../src/editor/sectionKeys.ts";

/**
 * The canvas's keyboard rules, which are the half that can be wrong in a way no walk would notice.
 *
 * A keyboard walk proves the arrows reach the sections. It says nothing about an arrow pressed
 * mid-word, or `Meta+ArrowDown`, or `ArrowUp` from a frame nothing has focused yet — and those are
 * where a keyboard route stops being one and starts eating other people's keystrokes.
 */

const bare = (key: string) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
});

const plainDiv = { tagName: "DIV", isContentEditable: false };
const whileTyping = { tagName: "P", isContentEditable: true };
const inAField = { tagName: "INPUT", isContentEditable: false };

const five = { count: 5, at: 2 };

describe("moving between sections", () => {
  it("goes down and up one at a time", () => {
    expect(sectionKeyAction(bare("ArrowDown"), plainDiv, five)).toEqual({
      kind: "focus",
      index: 3,
    });
    expect(sectionKeyAction(bare("ArrowUp"), plainDiv, five)).toEqual({ kind: "focus", index: 1 });
  });

  it("stops at the ends instead of wrapping", () => {
    // A page's sections are read top to bottom, so «down» at the bottom must not answer «back to
    // the top» — least of all for somebody who cannot see that it happened.
    expect(sectionKeyAction(bare("ArrowDown"), plainDiv, { count: 5, at: 4 })).toEqual({
      kind: "focus",
      index: 4,
    });
    expect(sectionKeyAction(bare("ArrowUp"), plainDiv, { count: 5, at: 0 })).toEqual({
      kind: "focus",
      index: 0,
    });
  });

  it("enters at the top going down, and at the bottom going up", () => {
    // `at: -1` is a real state: a frame rebuilt by an edit has no focus in it.
    expect(sectionKeyAction(bare("ArrowDown"), plainDiv, { count: 5, at: -1 })).toEqual({
      kind: "focus",
      index: 0,
    });
    expect(sectionKeyAction(bare("ArrowUp"), plainDiv, { count: 5, at: -1 })).toEqual({
      kind: "focus",
      index: 4,
    });
  });

  it("does nothing in a canvas with no sections", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
      expect(sectionKeyAction(bare(key), plainDiv, { count: 0, at: -1 })).toEqual({
        kind: "ignore",
      });
    }
  });

  it("copes with a place outside the list, which a rebuilt frame can produce", () => {
    /**
     * A section was deleted and the remembered index is now past the end. The place is clamped to
     * the last section and **then** moved — so up from a stale `9` in a list of three lands on the
     * middle one, and down stays at the bottom.
     *
     * Found by this test failing: the first version clamped only the lower bound, so up from `9`
     * answered `8` and the caller would have focused nothing at all. Writing the case out is what
     * produced the question of which of the two clamps was right.
     */
    expect(sectionKeyAction(bare("ArrowUp"), plainDiv, { count: 3, at: 9 })).toEqual({
      kind: "focus",
      index: 1,
    });
    expect(sectionKeyAction(bare("ArrowDown"), plainDiv, { count: 3, at: 9 })).toEqual({
      kind: "focus",
      index: 2,
    });
    // And never an index the caller cannot use.
    for (const key of ["ArrowUp", "ArrowDown"]) {
      const action = sectionKeyAction(bare(key), plainDiv, { count: 3, at: 50 });
      expect(action.kind).toBe("focus");
      if (action.kind === "focus") {
        expect(action.index, key).toBeGreaterThanOrEqual(0);
        expect(action.index, key).toBeLessThan(3);
      }
    }
  });
});

describe("choosing and letting go", () => {
  it("chooses on Enter and releases on Escape", () => {
    expect(sectionKeyAction(bare("Enter"), plainDiv, five)).toEqual({ kind: "choose" });
    expect(sectionKeyAction(bare("Escape"), plainDiv, five)).toEqual({ kind: "release" });
  });

  it("has nothing to choose or release when no section holds the keyboard", () => {
    expect(sectionKeyAction(bare("Enter"), plainDiv, { count: 5, at: -1 })).toEqual({
      kind: "ignore",
    });
    expect(sectionKeyAction(bare("Escape"), plainDiv, { count: 5, at: -1 })).toEqual({
      kind: "ignore",
    });
  });
});

describe("writing wins", () => {
  it("leaves every key alone inside a contentEditable", () => {
    // An arrow moves the caret, Enter makes a paragraph, Escape ends the edit. Sprint 11 spent
    // itself on making this typing trustworthy and this is what keeps it.
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
      expect(sectionKeyAction(bare(key), whileTyping, five), key).toEqual({ kind: "ignore" });
    }
  });

  it("leaves every key alone inside a field", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
      expect(sectionKeyAction(bare(key), inAField, five), key).toEqual({ kind: "ignore" });
    }
  });

  it("acts when nothing is focused at all, which is a frame just rebuilt", () => {
    expect(sectionKeyAction(bare("ArrowDown"), null, five)).toEqual({ kind: "focus", index: 3 });
  });
});

describe("only a bare press", () => {
  it("refuses every modifier, including Shift", () => {
    /**
     * `Meta+ArrowDown` is «end of document» in every text context there is, `Control+ArrowUp` is
     * Mission Control on the machine this is built on, and `Shift+Arrow` is a selection gesture
     * everywhere. Firing on a superset of what a shortcut claims is how an editor eats a keystroke
     * that was not for it.
     */
    for (const modifier of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
        expect(
          sectionKeyAction({ ...bare(key), [modifier]: true }, plainDiv, five),
          `${modifier}+${key}`,
        ).toEqual({ kind: "ignore" });
      }
    }
  });

  it("ignores keys that are nobody's business here", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "Tab", "a", " ", "Home", "PageDown"]) {
      expect(sectionKeyAction(bare(key), plainDiv, five), key).toEqual({ kind: "ignore" });
    }
  });
});

describe("the roving tabindex", () => {
  it("makes the canvas one Tab stop, not one per section", () => {
    expect(rovingTabIndex(5, 2)).toEqual([-1, -1, 0, -1, -1]);
  });

  it("puts the door on the first section when nothing holds the keyboard", () => {
    // Without this, Tab would never reach the canvas at all — every section would be `-1`.
    expect(rovingTabIndex(5, -1)).toEqual([0, -1, -1, -1, -1]);
    expect(rovingTabIndex(5, 7)).toEqual([0, -1, -1, -1, -1]);
  });

  it("has exactly one zero, whatever it is given", () => {
    for (const at of [-3, -1, 0, 1, 4, 5, 99]) {
      const zeros = rovingTabIndex(5, at).filter((value) => value === 0);
      expect(zeros, `at ${at}`).toHaveLength(1);
    }
  });

  it("is empty for an empty canvas", () => {
    expect(rovingTabIndex(0, -1)).toEqual([]);
  });
});
