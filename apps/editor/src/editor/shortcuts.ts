/**
 * The keyboard's two verbs, and the one rule that makes them safe.
 *
 * **Why this exists: seven places in this repository said the shortcut worked, and it did not.**
 * `Meta+Z`, `Control+Z` and `Meta+Shift+Z` were each pressed against a real change on sprint 9 day 1
 * and none of them did anything, while the «Deshacer» button undid the same change correctly. ADR
 * 0022 wrote «deshacer» as a feature «y no solo como Ctrl+Z», `packages/schema/src/conversion.ts`
 * repeats that sentence, `Editor.tsx` and `PagesPanel.tsx` each explain a behaviour in terms of it,
 * and a test name, a test comment and an e2e comment all name it. The backlog put the choice plainly
 * — write the shortcut, or correct the seven claims — and David chose to write it.
 *
 * The decision shape is a pure function here rather than an `if` at the listener, because **the rule
 * that keeps it safe is the half worth testing** and a listener needs a browser to run.
 */

export type Shortcut = "undo" | "redo";

/** The four modifiers and the key, which is everything the answer depends on. */
export interface KeyPress {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

/**
 * Which verb a press means, or `undefined` for "not ours".
 *
 * | Keys | |
 * |---|---|
 * | `Meta+Z`, `Control+Z` | undo |
 * | `Meta+Shift+Z`, `Control+Shift+Z`, `Control+Y` | redo |
 *
 * **`Control+Y` and not `Meta+Y`**, which is not an omission: `Ctrl+Y` is the Windows redo and the
 * one David named, while `Cmd+Y` means something else on macOS in enough applications that claiming
 * it would be taking a key this editor has no business taking.
 *
 * **Alt disqualifies everything.** No binding here uses it, so a press carrying it is somebody
 * reaching for something else — very often their own system's — and a shortcut that fires on a
 * superset of what it claims is how an editor eats a keystroke that was not for it.
 */
export function shortcutFor(press: KeyPress): Shortcut | undefined {
  if (press.altKey) return undefined;
  if (!press.metaKey && !press.ctrlKey) return undefined;
  const key = press.key.toLowerCase();
  // Ctrl+Y on its own. Shift+Ctrl+Y is nobody's redo, and letting it through would be the same
  // superset mistake the Alt rule exists to refuse.
  if (key === "y") return press.ctrlKey && !press.metaKey && !press.shiftKey ? "redo" : undefined;
  if (key !== "z") return undefined;
  return press.shiftKey ? "redo" : "undo";
}

/** The part of an event target the rule below reads. A plain shape, so the rule is testable in a
 * project with no DOM — the same reason `InputIntent` exists beside `InputEvent`. */
export interface FocusedElement {
  readonly tagName: string;
  readonly isContentEditable: boolean;
}

/**
 * Whether the thing with focus keeps its own undo, and must therefore keep this keystroke.
 *
 * **This is the condition David attached to writing the shortcut at all, and it is not a detail.**
 * Inside a `contentEditable` or an `<input>`, `Meta+Z` is the browser undoing the letters being
 * typed right now. Taking it would mean a person correcting a word loses the sentence instead — and
 * sprint 11 spent itself on making exactly that typing trustworthy. A document-wide undo that
 * reaches into the box somebody is typing in is not a better undo, it is a worse one.
 *
 * `<textarea>` is named although this editor has none today: the rule is about what the element
 * *is*, and a rule that happens to be right because a tag is unused is a rule waiting to be wrong.
 */
export function keepsItsOwnUndo(target: FocusedElement | null | undefined): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA";
}
