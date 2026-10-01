import { describe, expect, it } from "vitest";
import { type KeyPress, keepsItsOwnUndo, shortcutFor } from "../src/editor/shortcuts.ts";

const press = (key: string, mods: Partial<KeyPress> = {}): KeyPress => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe("shortcutFor", () => {
  it("undoes on Meta+Z and on Control+Z", () => {
    expect(shortcutFor(press("z", { metaKey: true }))).toBe("undo");
    expect(shortcutFor(press("z", { ctrlKey: true }))).toBe("undo");
  });

  it("redoes on the two shifted forms and on Control+Y", () => {
    expect(shortcutFor(press("z", { metaKey: true, shiftKey: true }))).toBe("redo");
    expect(shortcutFor(press("z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(shortcutFor(press("y", { ctrlKey: true }))).toBe("redo");
  });

  it("reads the key whatever case the engine reports it in", () => {
    // Shift+Z arrives as "Z" on every engine, which is the case that matters: the redo binding is
    // a shifted one, so matching "z" literally would make it the only binding that never fires.
    expect(shortcutFor(press("Z", { metaKey: true, shiftKey: true }))).toBe("redo");
    expect(shortcutFor(press("Y", { ctrlKey: true }))).toBe("redo");
  });

  it("does not claim Meta+Y, which means something else on macOS", () => {
    expect(shortcutFor(press("y", { metaKey: true }))).toBeUndefined();
  });

  it("does not claim Shift+Control+Y, which is nobody's redo", () => {
    expect(shortcutFor(press("y", { ctrlKey: true, shiftKey: true }))).toBeUndefined();
  });

  it("ignores a press with no modifier, so typing a z is just a z", () => {
    expect(shortcutFor(press("z"))).toBeUndefined();
    expect(shortcutFor(press("y"))).toBeUndefined();
  });

  it("ignores anything carrying Alt", () => {
    // A shortcut that fires on a superset of what it claims is how an editor eats a keystroke that
    // was meant for the system underneath it.
    expect(shortcutFor(press("z", { metaKey: true, altKey: true }))).toBeUndefined();
    expect(
      shortcutFor(press("z", { ctrlKey: true, shiftKey: true, altKey: true })),
    ).toBeUndefined();
  });

  it("ignores every other key, modifier or not", () => {
    for (const key of ["a", "s", "Enter", "Escape", "ArrowLeft", "Backspace"]) {
      expect(shortcutFor(press(key, { metaKey: true })), key).toBeUndefined();
    }
  });
});

describe("keepsItsOwnUndo", () => {
  const el = (tagName: string, isContentEditable = false) => ({ tagName, isContentEditable });

  it("leaves the keystroke to a text being edited on the canvas", () => {
    // The condition David attached to writing the shortcut at all: inside a contentEditable, Meta+Z
    // is the browser undoing the letters being typed right now, and taking it would mean somebody
    // correcting a word loses the sentence instead.
    expect(keepsItsOwnUndo(el("H1", true))).toBe(true);
    expect(keepsItsOwnUndo(el("P", true))).toBe(true);
  });

  it("leaves it to an input and a textarea", () => {
    expect(keepsItsOwnUndo(el("INPUT"))).toBe(true);
    expect(keepsItsOwnUndo(el("TEXTAREA"))).toBe(true);
  });

  it("reads the tag name whatever case it arrives in", () => {
    // `tagName` is upper case in HTML documents and lower case in XML ones, and this listener runs
    // against two documents rather than one.
    expect(keepsItsOwnUndo(el("input"))).toBe(true);
    expect(keepsItsOwnUndo(el("textarea"))).toBe(true);
  });

  it("takes the keystroke everywhere else", () => {
    expect(keepsItsOwnUndo(el("BODY"))).toBe(false);
    expect(keepsItsOwnUndo(el("BUTTON"))).toBe(false);
    expect(keepsItsOwnUndo(el("H1"))).toBe(false);
    expect(keepsItsOwnUndo(el("DIV"))).toBe(false);
  });

  it("takes it when there is no target at all", () => {
    expect(keepsItsOwnUndo(null)).toBe(false);
    expect(keepsItsOwnUndo(undefined)).toBe(false);
  });
});
