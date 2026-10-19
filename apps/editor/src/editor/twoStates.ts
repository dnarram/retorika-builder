import type { ElementAddress } from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };
import type { KeyPress } from "./shortcuts.ts";

/**
 * **Chosen, or writing** — the two states a text in the canvas can be in, decided without a DOM
 * (sprint 24 día 7).
 *
 * Until today every `[data-id]` in the canvas was `contentEditable` from the moment the frame was
 * wired, which made one gesture mean two things. A click placed a caret, and a drag selected text —
 * so there was no gesture left for «move this», and the 3 px threshold that would tell a drag from a
 * selection does not exist: **selecting text by dragging passes 3 px too** (David, reviewing the
 * sprint 24 plan). The answer is not a better threshold, it is two explicit states:
 *
 * | | Entered by | A drag | The arrows | Left by |
 * |---|---|---|---|---|
 * | **chosen** | one click, or Tab | will move the element (día 8) | will move it a cell (día 8) | Esc, or choosing another |
 * | **writing** | a second click, a double click, or Intro | selects text | move the caret | Esc, or Intro |
 *
 * `Shift` with an arrow belongs to **writing**, where it extends the selection, and never moves the
 * element: every modifier is refused here for the reason `sectionKeyAction` refuses it — a shortcut
 * that fires on a superset of what it claims is how an editor eats a keystroke that was not for it.
 *
 * **The judgement is a pure function and the wiring is in `Editor.tsx`**, the split `sectionKeys.ts`
 * and `shortcuts.ts` already use: the rules are the half worth testing and a listener needs a
 * browser.
 */

/** What a text in the canvas is doing. `idle` is every other text on the page. */
export type TextState = "idle" | "chosen" | "writing";

/**
 * What a bare key press means to the text that has the keyboard.
 *
 * - `write` — turn `contentEditable` on and put the caret in it.
 * - `commit` — end the edit and keep it, which is what `Intro` has meant since sprint 11.
 * - `revert` — end the edit and put the original words back, which is what `Escape` has meant.
 * - `release` — stop being chosen, and give the keyboard back to the section.
 * - `ignore` — not ours. The press reaches whatever it was for, including the caret and the
 *   selection, and including every arrow until día 8 gives them a meaning here.
 */
export type TextKeyAction =
  | { kind: "write" }
  | { kind: "commit" }
  | { kind: "revert" }
  | { kind: "release" }
  | { kind: "ignore" };

const IGNORED: TextKeyAction = { kind: "ignore" };

export function textKeyAction(press: KeyPress, state: TextState): TextKeyAction {
  if (state === "idle") return IGNORED;
  // Any modifier disqualifies everything, Shift included: `Shift+Arrow` is a selection gesture
  // everywhere and `Meta+Z` is the browser's own undo inside a `contentEditable` (`shortcuts.ts`).
  if (press.altKey || press.metaKey || press.ctrlKey || press.shiftKey) return IGNORED;
  if (state === "writing") {
    if (press.key === "Enter") return { kind: "commit" };
    if (press.key === "Escape") return { kind: "revert" };
    return IGNORED;
  }
  if (press.key === "Enter") return { kind: "write" };
  if (press.key === "Escape") return { kind: "release" };
  return IGNORED;
}

/**
 * What a click on a text means, given which text is chosen right now.
 *
 * **A second click on the text already chosen starts writing**, and that is a mitigation David asked
 * for while approving the sprint rather than a flourish: the two states cost the main audience — a
 * pyme with no tutorials — one click more than before, and somebody who does not know there are two
 * states arrives at writing anyway with two clicks of any speed. The browser's own double click
 * produces exactly this sequence, so the fast gesture needs no separate handler.
 */
export function clickAction(chosen: ElementAddress | null, at: ElementAddress): "choose" | "write" {
  const same = chosen?.sectionId === at.sectionId && chosen?.elementId === at.elementId;
  return same ? "write" : "choose";
}

/**
 * The line the canvas shows while a text is chosen, in the section's own chrome.
 *
 * **It names both gestures**, which is a small widening of the words David gave — «una indicación
 * visible del tipo "Doble clic para escribir"». A keyboard reaches this state too, and a hint that
 * named only the pointer would be the mirror of the handle this repository already refuses: an
 * instruction that does not exist for somebody without a mouse.
 */
export function chosenHintText(): string {
  return es["editor.canvas.chosenHint"];
}
