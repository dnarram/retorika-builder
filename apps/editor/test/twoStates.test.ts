import { describe, expect, it } from "vitest";
import type { KeyPress } from "../src/editor/shortcuts.ts";
import { chosenHintText, clickAction, textKeyAction } from "../src/editor/twoStates.ts";

/**
 * The two states of a text in the canvas, and the keys that move between them (sprint 24 día 7).
 *
 * What is held here is the judgement: which press means what, and when a click writes instead of
 * choosing. The wiring — `contentEditable` on and off, the outline, the hint — is in `Editor.tsx`
 * and is walked in the browser.
 */

const press = (key: string, modifiers: Partial<KeyPress> = {}): KeyPress => ({
  key,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("textKeyAction", () => {
  it("writes on Intro when a text is chosen, and commits on Intro when it is being written in", () => {
    // The same key, two meanings, and that is the whole point of having two states: before today
    // there was one, so Intro could only ever mean «commit».
    expect(textKeyAction(press("Enter"), "chosen")).toEqual({ kind: "write" });
    expect(textKeyAction(press("Enter"), "writing")).toEqual({ kind: "commit" });
  });

  it("gives Escape the two meanings the states need", () => {
    // Writing: put the original words back, which is what Escape has done since sprint 11. Chosen:
    // stop being chosen, so the keyboard goes back to the section.
    expect(textKeyAction(press("Escape"), "writing")).toEqual({ kind: "revert" });
    expect(textKeyAction(press("Escape"), "chosen")).toEqual({ kind: "release" });
  });

  it("takes nothing at all from a text that is neither", () => {
    for (const key of ["Enter", "Escape", "ArrowDown", "a"]) {
      expect(textKeyAction(press(key), "idle"), key).toEqual({ kind: "ignore" });
    }
  });

  it("leaves every arrow alone, in both states, until día 8 gives them a meaning", () => {
    // In writing they move the caret. In chosen they will move the element a cell at a time — and
    // until that exists, taking them would be taking a keystroke to do nothing with it.
    for (const state of ["chosen", "writing"] as const) {
      for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
        expect(textKeyAction(press(key), state), `${key} while ${state}`).toEqual({
          kind: "ignore",
        });
      }
    }
  });

  it("refuses every modifier, Shift included", () => {
    // `Shift+Arrow` extends a selection everywhere, and `Shift+Intro` is not this editor's gesture.
    // The rule `sectionKeyAction` applies to the canvas, applied to the text inside it.
    for (const modifier of ["altKey", "metaKey", "ctrlKey", "shiftKey"] as const) {
      for (const state of ["chosen", "writing"] as const) {
        expect(
          textKeyAction(press("Enter", { [modifier]: true }), state),
          `${modifier} while ${state}`,
        ).toEqual({ kind: "ignore" });
        expect(
          textKeyAction(press("Escape", { [modifier]: true }), state),
          `${modifier} while ${state}`,
        ).toEqual({ kind: "ignore" });
      }
    }
  });

  it("takes no other key, so typing is never intercepted", () => {
    for (const key of ["a", "ñ", "Tab", "Backspace", " ", "F2"]) {
      expect(textKeyAction(press(key), "writing"), key).toEqual({ kind: "ignore" });
    }
  });
});

describe("clickAction", () => {
  const at = { sectionId: "sec-cover", elementId: "el-headline" };

  it("chooses a text nothing had chosen", () => {
    expect(clickAction(null, at)).toBe("choose");
  });

  it("writes on a second click on the text already chosen, whatever its speed", () => {
    // David's mitigation: two clicks of any speed reach writing, so somebody who does not know
    // there are two states is not stopped by them. The browser's own double click is this same
    // sequence, which is why the fast gesture needs no handler of its own.
    expect(clickAction(at, at)).toBe("write");
  });

  it("chooses when the click lands on a different text, in either half of the address", () => {
    expect(clickAction({ sectionId: "sec-cover", elementId: "el-subtitle" }, at)).toBe("choose");
    // The same element id in another section is a different text — which is exactly why the
    // address has two halves (`data-section` plus `data-id`).
    expect(clickAction({ sectionId: "sec-services", elementId: "el-headline" }, at)).toBe("choose");
  });
});

describe("chosenHintText", () => {
  it("names both gestures, because a keyboard reaches this state too", () => {
    expect(chosenHintText()).toBe("Doble clic o Intro para escribir");
  });
});
