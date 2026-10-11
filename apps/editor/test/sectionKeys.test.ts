import { describe, expect, it } from "vitest";
import {
  placeAfterRebuild,
  popupKeyAction,
  rovingTabIndex,
  sectionKeyAction,
} from "../src/editor/sectionKeys.ts";

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

const five = { count: 5, at: 2 };

describe("moving between sections", () => {
  it("goes down and up one at a time", () => {
    expect(sectionKeyAction(bare("ArrowDown"), five)).toEqual({
      kind: "focus",
      index: 3,
    });
    expect(sectionKeyAction(bare("ArrowUp"), five)).toEqual({ kind: "focus", index: 1 });
  });

  it("stops at the ends instead of wrapping", () => {
    // A page's sections are read top to bottom, so «down» at the bottom must not answer «back to
    // the top» — least of all for somebody who cannot see that it happened.
    expect(sectionKeyAction(bare("ArrowDown"), { count: 5, at: 4 })).toEqual({
      kind: "focus",
      index: 4,
    });
    expect(sectionKeyAction(bare("ArrowUp"), { count: 5, at: 0 })).toEqual({
      kind: "focus",
      index: 0,
    });
  });

  it("does nothing at all when the canvas is not what has focus", () => {
    /**
     * **`at: -1` means «something else has focus», and it used to mean «enter the canvas».** The
     * first version answered `ArrowDown` from `-1` by focusing the first section, which read as a
     * convenience and was really a way of taking a keystroke from whoever had it: on a document
     * body an arrow scrolls the page. Tab is how the canvas is entered, which is the entire job of
     * the roving `tabindex`.
     *
     * This is also what makes «writing wins» and «a button owns Enter» one rule instead of three:
     * if a paragraph or a verb has focus, the canvas is not focused, so nothing here fires.
     */
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
      expect(sectionKeyAction(bare(key), { count: 5, at: -1 }), key).toEqual({ kind: "ignore" });
    }
  });

  it("does nothing in a canvas with no sections", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
      expect(sectionKeyAction(bare(key), { count: 0, at: -1 })).toEqual({
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
    expect(sectionKeyAction(bare("ArrowUp"), { count: 3, at: 9 })).toEqual({
      kind: "focus",
      index: 1,
    });
    expect(sectionKeyAction(bare("ArrowDown"), { count: 3, at: 9 })).toEqual({
      kind: "focus",
      index: 2,
    });
    // And never an index the caller cannot use.
    for (const key of ["ArrowUp", "ArrowDown"]) {
      const action = sectionKeyAction(bare(key), { count: 3, at: 50 });
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
    expect(sectionKeyAction(bare("Enter"), five)).toEqual({ kind: "choose" });
    expect(sectionKeyAction(bare("Escape"), five)).toEqual({ kind: "release" });
  });

  it("has nothing to choose or release when the canvas is not focused", () => {
    expect(sectionKeyAction(bare("Enter"), { count: 5, at: -1 })).toEqual({ kind: "ignore" });
    expect(sectionKeyAction(bare("Escape"), { count: 5, at: -1 })).toEqual({ kind: "ignore" });
  });
});

describe("writing wins, and so does a button — the same rule", () => {
  /**
   * **One rule does both jobs, and the day it took two is recorded in `sectionKeys.ts`.** A verb is
   * a `<button>` inside the section and text is a `contentEditable` inside the section; in both
   * cases the section itself is not what has focus, so `at` is `-1` and nothing here fires.
   *
   * The first version asked a separate question — «is the focused thing a text box» — and answered
   * it correctly while missing the buttons entirely, so `Enter` on «bajar» was taken as «choose
   * this section» and the verb could not be pressed. These cases are the shape of both failures.
   */
  it("leaves the press alone whenever something inside the section has it", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape", " "]) {
      expect(sectionKeyAction(bare(key), { count: 5, at: -1 }), key).toEqual({ kind: "ignore" });
    }
  });

  it("acts only when a section itself has it", () => {
    expect(sectionKeyAction(bare("ArrowDown"), { count: 5, at: 2 })).toEqual({
      kind: "focus",
      index: 3,
    });
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
          sectionKeyAction({ ...bare(key), [modifier]: true }, five),
          `${modifier}+${key}`,
        ).toEqual({ kind: "ignore" });
      }
    }
  });

  it("ignores keys that are nobody's business here", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "Tab", "a", " ", "Home", "PageDown"]) {
      expect(sectionKeyAction(bare(key), five), key).toEqual({ kind: "ignore" });
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

describe("where the keyboard lands after a verb rebuilt the document", () => {
  /**
   * One rule, checked against each of the five verbs it has to serve. The table in
   * `placeAfterRebuild`'s own comment is the specification; these are the same rows as assertions,
   * because a table in a comment cannot fail.
   */

  it("follows a section that moved up", () => {
    // Five sections, the keyboard on the third, moved up: it is now the second.
    expect(placeAfterRebuild({ idIndex: 1, wasAt: 2, count: 5 })).toBe(1);
  });

  it("follows a section that moved down", () => {
    expect(placeAfterRebuild({ idIndex: 3, wasAt: 2, count: 5 })).toBe(3);
  });

  it("stays on the original after a duplicate, with the copy below it", () => {
    // Six sections now; the original kept its index and the copy went in after it.
    expect(placeAfterRebuild({ idIndex: 2, wasAt: 2, count: 6 })).toBe(2);
  });

  it("takes the teaser's place after «convertir en página»", () => {
    // The section left this page and `sectionToPage` put an avance at the same index, so the id is
    // gone and the count is unchanged.
    expect(placeAfterRebuild({ idIndex: -1, wasAt: 2, count: 5 })).toBe(2);
  });

  it("steps to the section that moved up into the gap after a delete", () => {
    expect(placeAfterRebuild({ idIndex: -1, wasAt: 2, count: 4 })).toBe(2);
  });

  it("steps back to the new last when the deleted one was last", () => {
    // Five became four, and index 4 no longer exists.
    expect(placeAfterRebuild({ idIndex: -1, wasAt: 4, count: 4 })).toBe(3);
  });

  it("has nowhere to go when the only section was deleted", () => {
    expect(placeAfterRebuild({ idIndex: -1, wasAt: 0, count: 0 })).toBe(null);
  });

  it("never answers an index the caller cannot use", () => {
    // The guard against the whole class of failure this exists to prevent: an out-of-range index
    // means `sections[index]` is undefined, nothing is focused, and focus falls to the body — which
    // is «el foco acaba al principio de la página», the one outcome day 4 is about.
    for (const count of [1, 2, 5]) {
      for (const wasAt of [-1, 0, 1, 4, 99]) {
        for (const idIndex of [-1, 0, 1, 4, 99]) {
          const place = placeAfterRebuild({ idIndex, wasAt, count });
          expect(place, `idIndex ${idIndex}, wasAt ${wasAt}, count ${count}`).not.toBe(null);
          if (place !== null) {
            expect(place).toBeGreaterThanOrEqual(0);
            expect(place).toBeLessThan(count);
          }
        }
      }
    }
  });

  it("answers null only for an empty page, whatever else it is told", () => {
    for (const wasAt of [-1, 0, 3]) {
      for (const idIndex of [-1, 0, 3]) {
        expect(placeAfterRebuild({ idIndex, wasAt, count: 0 })).toBe(null);
      }
    }
  });
});

describe("the canvas's popups — the composition menu and the hand-design offer", () => {
  it("moves between the choices with the arrows", () => {
    expect(popupKeyAction(bare("ArrowDown"), { count: 3, at: 0 })).toEqual({
      kind: "focus",
      index: 1,
    });
    expect(popupKeyAction(bare("ArrowUp"), { count: 3, at: 1 })).toEqual({
      kind: "focus",
      index: 0,
    });
  });

  it("wraps at both ends, unlike the sections", () => {
    /**
     * The contrast is the argument, and both halves are tested so neither can drift into the
     * other: a page is a document with a top and a bottom, a popup is a ring of alternatives.
     */
    expect(popupKeyAction(bare("ArrowDown"), { count: 3, at: 2 })).toEqual({
      kind: "focus",
      index: 0,
    });
    expect(popupKeyAction(bare("ArrowUp"), { count: 3, at: 0 })).toEqual({
      kind: "focus",
      index: 2,
    });
    // And the sections still do not, which is the other half of the same decision.
    expect(sectionKeyAction(bare("ArrowDown"), { count: 3, at: 2 })).toEqual({
      kind: "focus",
      index: 2,
    });
  });

  it("enters at either end from a popup nothing has focused yet", () => {
    expect(popupKeyAction(bare("ArrowDown"), { count: 3, at: -1 })).toEqual({
      kind: "focus",
      index: 0,
    });
    expect(popupKeyAction(bare("ArrowUp"), { count: 3, at: -1 })).toEqual({
      kind: "focus",
      index: 2,
    });
  });

  it("closes on Escape, wherever focus is inside it", () => {
    // Including a popup with nothing focusable in it at all, which is why the Escape branch comes
    // before the count check: a popup somebody cannot leave is worse than one with no choices.
    for (const at of [-1, 0, 2]) {
      expect(popupKeyAction(bare("Escape"), { count: 3, at })).toEqual({ kind: "close" });
    }
    expect(popupKeyAction(bare("Escape"), { count: 0, at: -1 })).toEqual({ kind: "close" });
  });

  it("leaves Tab alone, which is the answer to what Escape means in a menu that is not modal", () => {
    // Removing the popup from under a Tab would strand the focus Tab was computing. These are not
    // modal: they are on screen, a click outside closes them, and Escape closes them by keyboard.
    expect(popupKeyAction(bare("Tab"), { count: 3, at: 1 })).toEqual({ kind: "ignore" });
  });

  it("refuses every modifier, Escape included", () => {
    // `Meta+Escape` and `Alt+Escape` are system gestures on the machine this is built on, and a
    // popup that closed on them would be acting on a press that never reached it in spirit.
    for (const modifier of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      for (const key of ["ArrowDown", "ArrowUp", "Escape"]) {
        expect(
          popupKeyAction({ ...bare(key), [modifier]: true }, { count: 3, at: 1 }),
          `${modifier}+${key}`,
        ).toEqual({ kind: "ignore" });
      }
    }
  });

  it("ignores keys that are nobody's business in a popup", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "a", "Home", "PageDown"]) {
      expect(popupKeyAction(bare(key), { count: 3, at: 1 }), key).toEqual({ kind: "ignore" });
    }
  });

  it("never answers an index the caller cannot use", () => {
    for (const count of [1, 2, 5]) {
      for (const at of [-1, 0, 1, 4]) {
        for (const key of ["ArrowDown", "ArrowUp"]) {
          const action = popupKeyAction(bare(key), { count, at });
          if (action.kind === "focus") {
            expect(action.index, `${key} count ${count} at ${at}`).toBeGreaterThanOrEqual(0);
            expect(action.index).toBeLessThan(count);
          }
        }
      }
    }
  });
});
