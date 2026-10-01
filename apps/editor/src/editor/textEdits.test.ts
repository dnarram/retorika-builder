import { describe, expect, it } from "vitest";
import {
  type InputIntent,
  insertedTextFor,
  liveFrameOf,
  offsetFor,
  textFrameOf,
} from "./textEdits.ts";

const intent = (inputType: string, rest: Partial<InputIntent> = {}): InputIntent => ({
  inputType,
  data: null,
  pastedText: null,
  ...rest,
});

describe("textFrameOf", () => {
  it("separates the document's text from the frame's pretty-printing", () => {
    const frame = textFrameOf("\n      Taberna del Puerto\n    ");
    expect(frame.text).toBe("Taberna del Puerto");
    expect(frame.indent).toBe(7);
  });

  it("reports no indent for a string the renderer did not wrap", () => {
    expect(textFrameOf("Taberna del Puerto")).toEqual({
      text: "Taberna del Puerto",
      indent: 0,
    });
  });

  it("counts the indent in code units, not in characters", () => {
    // Not something the renderer emits, but the arithmetic must not assume one unit per character
    // anywhere, because ADR 0027 §2 fixed offsets as UTF-16 code units.
    expect(textFrameOf("🍷x").indent).toBe(0);
    expect(textFrameOf(" 🍷x").indent).toBe(1);
  });
});

describe("the non-breaking spaces contentEditable invents", () => {
  // Measured in Chromium on 1 October 2026: deleting «millo» out of «Solomillo al whisky» leaves the
  // neighbouring space as U+00A0. It reached the document, the autosave and the owner's ZIP — and it
  // also made the diff read one character deleted and a different one inserted, which grew a bold on
  // «Solomillo» over the new space instead of shrinking it to «Solo».
  it("are read as the ordinary spaces the person actually typed", () => {
    expect(textFrameOf("Solo\u00A0al whisky").text).toBe("Solo al whisky");
    expect(liveFrameOf("Solo\u00A0al whisky").text).toBe("Solo al whisky");
  });

  it("never reach the text the document would store", () => {
    expect(textFrameOf("\n      pan\u00A0y\u00A0aceite\n    ").text).not.toContain("\u00A0");
  });

  it("do not disturb the indent, which is measured after the substitution", () => {
    expect(textFrameOf("\n      pan\u00A0y aceite\n    ")).toEqual({
      text: "pan y aceite",
      indent: 7,
    });
  });

  it("stop the diff from reading a space becoming U+00A0 as an edit", () => {
    // The two strings the editor compares on blur. Normalised, they are equal, so nothing commits
    // and no mark moves; raw, they differ by two characters in the middle of the sentence.
    const browser = "Solo\u00A0al whisky";
    const document_ = "Solo al whisky";
    expect(browser).not.toBe(document_);
    expect(textFrameOf(browser).text).toBe(document_);
  });
});

describe("liveFrameOf", () => {
  it("drops the leading indentation and keeps the trailing whitespace", () => {
    expect(liveFrameOf("\n      Taberna\n    ")).toEqual({ text: "Taberna\n    ", indent: 7 });
  });

  it("agrees with textFrameOf on the indent, which is the half they share", () => {
    for (const raw of ["\n   pan ", "pan", "  ", "", " \n pan y aceite \n "]) {
      expect(liveFrameOf(raw).indent, raw).toBe(textFrameOf(raw).indent);
    }
  });

  it("is what keeps an offset stable while somebody types at the end", () => {
    // The whole reason the two frames exist. Someone has typed a space after "pan", so the DOM holds
    // "pan " and the caret is at offset 4. The document's text is still "pan", length 3 — so
    // textFrameOf clamps the next edit to 3, and every offset from there is one short, which lands
    // the mark over the wrong letters. liveFrameOf keeps room for the character that is really there.
    const raw = "pan ";
    expect(offsetFor(textFrameOf(raw), 4)).toBe(3); // the clamp that loses the position
    expect(offsetFor(liveFrameOf(raw), 4)).toBe(4); // where the caret actually is
  });

  it("still refuses an offset past the end of what the element holds", () => {
    expect(offsetFor(liveFrameOf("pan "), 99)).toBe(4);
  });

  it("is empty when the element holds only whitespace, never a negative length", () => {
    expect(liveFrameOf("   ")).toEqual({ text: "", indent: 3 });
  });
});

describe("offsetFor", () => {
  const frame = textFrameOf("\n      Taberna del Puerto\n    ");

  it("subtracts the indentation the DOM range walked through", () => {
    // A range from the element's start to just before "del" reports 7 + 8 code units.
    expect(offsetFor(frame, 15)).toBe(8);
  });

  it("puts the element's own start at zero", () => {
    expect(offsetFor(frame, 7)).toBe(0);
  });

  it("clamps a point inside the leading indentation to zero", () => {
    // Without this, a selection that begins in the pretty-printing would hand `applyMark` a
    // negative offset.
    expect(offsetFor(frame, 2)).toBe(0);
  });

  it("clamps a point inside the trailing indentation to the end of the text", () => {
    // A drag that runs past the last word selects into the newline after it. The document has no
    // character there, so the furthest honest answer is the end.
    expect(offsetFor(frame, 29)).toBe(18);
    expect(offsetFor(frame, 500)).toBe(18);
  });
});

describe("insertedTextFor", () => {
  it("gives a keystroke's own text", () => {
    expect(insertedTextFor(intent("insertText", { data: "a" }))).toBe("a");
    expect(insertedTextFor(intent("insertText", { data: "pan y aceite" }))).toBe("pan y aceite");
  });

  it("gives a replacement's text, which is the autocorrect case", () => {
    // The one most likely to move a mark unnoticed: the range is a whole word somewhere the person
    // is not looking.
    expect(insertedTextFor(intent("insertReplacementText", { data: "solomillo" }))).toBe(
      "solomillo",
    );
  });

  it("measures an astral character as the two code units the document stores", () => {
    // The text is returned, so the length the caller uses is `.length` — UTF-16 code units, which is
    // the unit ADR 0027 §2 fixed. This asserts the unit, not the string.
    expect(insertedTextFor(intent("insertText", { data: "🍷" }))?.length).toBe(2);
  });

  it("gives a paste's plain text, never its markup", () => {
    expect(insertedTextFor(intent("insertFromPaste", { pastedText: "vino tinto" }))).toBe(
      "vino tinto",
    );
  });

  it("gives the empty string for every kind of deletion", () => {
    for (const type of [
      "deleteContentBackward",
      "deleteContentForward",
      "deleteContent",
      "deleteWordBackward",
      "deleteWordForward",
      "deleteSoftLineBackward",
      "deleteSoftLineForward",
      "deleteHardLineBackward",
      "deleteHardLineForward",
      "deleteByCut",
      "deleteByDrag",
    ]) {
      expect(insertedTextFor(intent(type)), type).toBe("");
    }
  });

  it("leaves composition unmapped, so an IME falls back to the diff", () => {
    expect(insertedTextFor(intent("insertCompositionText", { data: "ñ" }))).toBeUndefined();
  });

  it("leaves the browser's own undo unmapped", () => {
    expect(insertedTextFor(intent("historyUndo"))).toBeUndefined();
    expect(insertedTextFor(intent("historyRedo"))).toBeUndefined();
  });

  it("leaves everything it has not been told about unmapped", () => {
    // The default has to be the fallback: a type that reached the wrong branch would shift a mark
    // with no error and nothing on screen, which is the failure §4b exists to stop.
    for (const type of [
      "insertFromDrop",
      "insertFromPasteAsQuotation",
      "insertFromYank",
      "insertTranspose",
      "insertLink",
      "insertOrderedList",
      "formatBold",
      "insertLineBreak",
      "insertParagraph",
      "somethingAFutureBrowserInvents",
    ]) {
      expect(insertedTextFor(intent(type)), type).toBeUndefined();
    }
  });

  it("falls back rather than guessing when a mapped type arrives with no data", () => {
    // `data` is null on some engines for types that normally carry it; treating that as "inserted
    // nothing" would be a wrong length, and a wrong length is exactly a silent shift.
    expect(insertedTextFor(intent("insertText"))).toBeUndefined();
    expect(insertedTextFor(intent("insertReplacementText"))).toBeUndefined();
    expect(insertedTextFor(intent("insertFromPaste"))).toBeUndefined();
  });

  it("treats an empty string as inserting nothing, which is not the same as unmapped", () => {
    expect(insertedTextFor(intent("insertText", { data: "" }))).toBe("");
    expect(insertedTextFor(intent("insertFromPaste", { pastedText: "" }))).toBe("");
  });
});
