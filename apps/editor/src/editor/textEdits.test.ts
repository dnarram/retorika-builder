import { describe, expect, it } from "vitest";
import { type InputIntent, insertedLengthFor, offsetFor, textFrameOf } from "./textEdits.ts";

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

describe("insertedLengthFor", () => {
  it("takes a keystroke's length from its data", () => {
    expect(insertedLengthFor(intent("insertText", { data: "a" }))).toBe(1);
    expect(insertedLengthFor(intent("insertText", { data: "pan y aceite" }))).toBe(12);
  });

  it("takes a replacement's length from its data, which is the autocorrect case", () => {
    // The one most likely to move a mark unnoticed: the range is a whole word somewhere the person
    // is not looking.
    expect(insertedLengthFor(intent("insertReplacementText", { data: "solomillo" }))).toBe(9);
  });

  it("counts an inserted astral character as the two code units the document stores", () => {
    expect(insertedLengthFor(intent("insertText", { data: "🍷" }))).toBe(2);
  });

  it("takes a paste's length from the plain text, never from the markup", () => {
    expect(insertedLengthFor(intent("insertFromPaste", { pastedText: "vino tinto" }))).toBe(10);
  });

  it("answers zero for every kind of deletion", () => {
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
      expect(insertedLengthFor(intent(type)), type).toBe(0);
    }
  });

  it("leaves composition unmapped, so an IME falls back to the diff", () => {
    expect(insertedLengthFor(intent("insertCompositionText", { data: "ñ" }))).toBeUndefined();
  });

  it("leaves the browser's own undo unmapped", () => {
    expect(insertedLengthFor(intent("historyUndo"))).toBeUndefined();
    expect(insertedLengthFor(intent("historyRedo"))).toBeUndefined();
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
      expect(insertedLengthFor(intent(type)), type).toBeUndefined();
    }
  });

  it("falls back rather than guessing when a mapped type arrives with no data", () => {
    // `data` is null on some engines for types that normally carry it; zero would be a wrong
    // answer, and a wrong length is exactly a silent shift.
    expect(insertedLengthFor(intent("insertText"))).toBeUndefined();
    expect(insertedLengthFor(intent("insertReplacementText"))).toBeUndefined();
    expect(insertedLengthFor(intent("insertFromPaste"))).toBeUndefined();
  });

  it("treats an empty string as zero inserted, which is not the same as unmapped", () => {
    expect(insertedLengthFor(intent("insertText", { data: "" }))).toBe(0);
    expect(insertedLengthFor(intent("insertFromPaste", { pastedText: "" }))).toBe(0);
  });
});
