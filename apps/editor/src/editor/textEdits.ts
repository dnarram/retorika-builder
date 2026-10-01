/**
 * Turning what the browser is about to do to a text into the edit the document understands
 * (ADR 0027 §4b).
 *
 * **Why this exists at all.** `textEditBetween` derives an edit from the text before and after,
 * and two strings do not determine an edit: when what was typed or deleted also appears beside
 * where it happened, several edits produce the same pair, and the diff has to pick one. Measured on
 * 1 October 2026 against the shipped functions, it picks wrong in both directions — `"aXY"` with
 * `XY` typed at the end grows a bold `[0,1)` to `[0,3)` over characters nobody marked, and
 * `"pan y pan y aceite"` with the *second* `pan y ` deleted destroys a bold on the first `pan` whose
 * own word was never touched. Silent, and it corrupts the owner's document.
 *
 * `beforeinput` fires with the range the browser is about to replace and the kind of edit it is,
 * which is the same information measured instead of inferred. This module holds the two pieces of
 * that translation that are **pure**, so they are tested without a browser: the UTF-16 arithmetic
 * that the frame's text and the document's text do not share, and the table of input types. The DOM
 * plumbing around them lives at its one call site in `Editor.tsx`.
 */

/**
 * An element's text as the frame holds it, next to what the document holds.
 *
 * **They are not the same string, and the difference is load-bearing.** The html target
 * pretty-prints, so an unmarked heading arrives in the DOM as `"\n      Taberna del Puerto\n    "` —
 * the words wrapped in the file's own indentation. `wireEditing` has committed `textContent.trim()`
 * since sprint 2, so every offset measured off the raw node is as many characters too far right as
 * the element happens to be indented. The toolbar found this the hard way in sprint 10 day 5, where
 * a mark landed six characters off on the first press.
 *
 * Kept as one value rather than two loose numbers because both consumers need both halves, and
 * because `indent` on its own is meaningless without the string it was measured from.
 */
export interface TextFrame {
  /** What the document stores, and what every offset below counts into. */
  readonly text: string;
  /** How many code units of pretty-printing sit before it in the DOM. */
  readonly indent: number;
}

export function textFrameOf(raw: string): TextFrame {
  return { text: raw.trim(), indent: raw.length - raw.trimStart().length };
}

/**
 * A span measured from the element's start in the DOM, as an offset into the document's text.
 *
 * `spanFromStart` is what a `Range` from the element's start to the point in question reports as
 * `toString().length` — never `anchorOffset`, because a marked text is several nodes and an offset
 * inside a `<strong>` says nothing about where that word sits in the sentence the document stores.
 *
 * **The clamp is the other half of the correction.** A selection that runs past the last word
 * reaches into the trailing indentation, and an offset the document has no character for would be
 * refused by `applyMark` — correctly, and far too late to be useful.
 */
export function offsetFor(frame: TextFrame, spanFromStart: number): number {
  return Math.max(0, Math.min(spanFromStart - frame.indent, frame.text.length));
}

/**
 * What `beforeinput` tells us, reduced to the three fields that decide the answer.
 *
 * A plain shape rather than `InputEvent` so the table below is testable in the editor's own test
 * project, which runs with no DOM at all (`vitest.config.ts`: `environment: "node"`).
 */
export interface InputIntent {
  readonly inputType: string;
  /** `event.data`. */
  readonly data: string | null;
  /** `event.dataTransfer?.getData("text/plain")`, which is the only flavour this editor accepts. */
  readonly pastedText: string | null;
}

/**
 * How many code units the edit puts in, or `undefined` for "this one is not mapped — fall back".
 *
 * **The whole table is written down, and the default is the fallback.** An input type that reached
 * the wrong branch would shift a mark silently, which is the failure this mechanism exists to stop,
 * so arriving at `undefined` has to be what happens to everything not named. ADR 0027 §4b carries
 * the table in prose; this is it in code, and the two are meant to be read together.
 *
 * - `insertText` — the ordinary keystroke.
 * - `insertReplacementText` — **the dangerous one.** Desktop spellcheck and mobile autocorrect
 *   replace a word that is already written, so the range is not the cursor, is several characters
 *   wide, and is often somewhere the person is not looking.
 * - `insertFromPaste` — the length of the *plain text*, which is also what the caller forces in.
 * - every `delete…` — zero: the range is the entire answer.
 * - `insertCompositionText` (IME, where the browser reports provisional edits whose composed result
 *   is not a function of any one of them), `historyUndo`/`historyRedo` (the browser's undo stack is
 *   not the document's), and anything unforeseen — **deliberately unmapped**.
 *
 * `String.length` is UTF-16 code units, which is exactly the unit ADR 0027 §2 fixed for offsets. No
 * conversion, and no place for one to be forgotten.
 */
export function insertedLengthFor(intent: InputIntent): number | undefined {
  switch (intent.inputType) {
    case "insertText":
    case "insertReplacementText":
      return intent.data === null ? undefined : intent.data.length;
    case "insertFromPaste":
      return intent.pastedText === null ? undefined : intent.pastedText.length;
    default:
      // Nine `delete…` types in the specification, and they all answer the same thing. Matched by
      // prefix rather than listed, because a tenth would mean the same and listing them invites a
      // list that is one short.
      return intent.inputType.startsWith("delete") ? 0 : undefined;
  }
}
