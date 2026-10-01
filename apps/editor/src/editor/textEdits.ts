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

/**
 * An element's text as the editor is willing to believe it, with `contentEditable`'s own invention
 * taken back out.
 *
 * **The browser writes characters nobody typed.** Measured on 1 October 2026, in Chromium: delete
 * `millo` out of `Solomillo al whisky` and the space that ends up beside the edit comes back as
 * **U+00A0**, a non-breaking space. Nothing asked for it — it is how `contentEditable` stops a
 * trailing space from collapsing when it renders — and it did two kinds of damage at once:
 *
 * 1. **It reached the document and the published page.** The editor committed `textContent` as it
 *    found it, so `Solo al whisky` is what got stored, autosaved and would have been written
 *    into the owner's ZIP, in a product whose whole premise is that the file is the deliverable.
 * 2. **It made the diff mis-read the edit.** A space becoming a non-breaking space is, to two
 *    strings, one character deleted and a different one inserted — so the common suffix broke early,
 *    `textEditBetween` reported the edit as `[4,10)` with one character inserted, and a bold on
 *    `Solomillo` grew over the new space instead of shrinking to `Solo`. The visible symptom was a
 *    mark in the wrong place; the cause was a character the editor should never have accepted.
 *
 * So every read of an element's text goes through here. It is the mirror of `withText` on the way
 * in: one place where the DOM's idea of the text becomes the document's.
 *
 * **A real non-breaking space the owner pasted is normalised too**, which is a deliberate loss. The
 * editor offers no way to type one, the renderer has no use for one, and `trim()` already treats it
 * as whitespace — so keeping some and not others would mean the document's spaces depend on which
 * browser did the editing.
 */
/**
 * A regular expression rather than `replaceAll` on a string escape, which is not a style choice.
 *
 * Biome's formatter rewrites a `"\u00A0"` **string** escape into the literal character, so this
 * function's body became `replaceAll(" ", " ")` — two spaces that look identical, one of them
 * invisible. The next person to read that sees a no-op, deletes it, and the published page quietly
 * gets its non-breaking spaces back. A regex literal's escape survives formatting, so the intent
 * stays legible to a reader and to a reviewer.
 */
const NBSP = /\u00A0/g;

function asTyped(raw: string): string {
  return raw.replace(NBSP, " ");
}

export function textFrameOf(raw: string): TextFrame {
  const text = asTyped(raw);
  return { text: text.trim(), indent: text.length - text.trimStart().length };
}

/**
 * The same element in the coordinates an **edit in progress** has to use: leading indentation gone,
 * trailing whitespace kept.
 *
 * **Why the two differ, which took measuring to see.** `textFrameOf` describes what the document
 * stores, and that is right for the toolbar: a mark is applied to the trimmed text. It is wrong
 * while somebody is typing, because `trim()` moves under them. Type a space after `pan` and the
 * trimmed text is still `"pan"`, length 3 — so the next keystroke, really at offset 4, clamps to 3,
 * and from there every offset in the session is one short. The mark ends up over the wrong letters
 * by exactly the number of trailing spaces the person happened to type.
 *
 * Keeping the trailing whitespace makes the coordinate system stable for as long as the person is
 * editing, and the commit reconciles it with the trimmed text in one step (`marksAfterTrim`).
 * Leading indentation still comes off, because the document's offset zero is its first real
 * character and the marks read at focus are already in that frame.
 */
export function liveFrameOf(raw: string): TextFrame {
  const text = asTyped(raw);
  return { text: text.trimStart(), indent: text.length - text.trimStart().length };
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
 * The text the edit puts in, or `undefined` for "this one is not mapped — fall back".
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
 * **The text and not just its length**, so that the caller can keep the string its captured marks
 * believe in and check it against the DOM after every edit. A length alone would make that check
 * impossible, and without it a single mis-mapped edit is undetectable until a mark publishes over
 * the wrong words. `String.length` is UTF-16 code units, which is exactly the unit ADR 0027 §2 fixed
 * for offsets — so the length the caller needs is `.length` on this, with no conversion anywhere.
 */
export function insertedTextFor(intent: InputIntent): string | undefined {
  switch (intent.inputType) {
    case "insertText":
    case "insertReplacementText":
      return intent.data ?? undefined;
    case "insertFromPaste":
      return intent.pastedText ?? undefined;
    default:
      // Nine `delete…` types in the specification, and they all answer the same thing. Matched by
      // prefix rather than listed, because a tenth would mean the same and listing them invites a
      // list that is one short.
      return intent.inputType.startsWith("delete") ? "" : undefined;
  }
}
