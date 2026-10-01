import { describe, expect, it } from "vitest";
import { type RetorikaDocument, SCHEMA_VERSION, type Section } from "../src/document.ts";
import { setElementText } from "../src/fields.ts";
import {
  addRun,
  applyMark,
  type MarkRun,
  marksAfterTrim,
  marksFor,
  markTextIssue,
  normaliseMarks,
  rangeHasMark,
  removeMark,
  removeRun,
  shiftMarks,
  type TextEdit,
  textEditBetween,
} from "../src/marks.ts";
import { parseDocument } from "../src/parse.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * ADR 0027, as something a test can fail on.
 *
 * The offsets below are not illustrative. `"Solomillo al whisky"` is nineteen code units and the
 * boundaries matter to the character: `[0,9)` is «Solomillo», `[9,10)` is the space and `[10,19)`
 * is «al whisky». The first draft of ADR 0027 illustrated merging with `[0,9)` and `[10,19)` — the
 * one pair on that list which does **not** merge — so these are spelled out rather than described.
 */

const DISH = "Solomillo al whisky";

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function section(): Section {
  return {
    id: "sec-cover",
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: DISH },
      },
      {
        id: "el-cta",
        role: "button",
        hidden: false,
        slot: "cta",
        value: { kind: "link", text: "Reserva ya", href: "#contacto" },
      },
      {
        id: "el-image",
        role: "image",
        hidden: false,
        slot: "image",
        value: { kind: "image", src: "a.svg", alt: "El plato" },
      },
    ],
  };
}

function document(): RetorikaDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: "doc-1",
    siteName: "Taberna",
    theme,
    collections: [],
    pages: [{ id: "home", slug: "index", title: "Taberna", sections: [section()] }],
  };
}

const at = { sectionId: "sec-cover", elementId: "el-headline" };

/** The same document with one heading carrying this exact text, for the cases where the
 * characters are the subject rather than the structure. */
function documentWithText(text: string): RetorikaDocument {
  return {
    ...document(),
    pages: [
      {
        id: "home",
        slug: "index",
        title: "Taberna",
        sections: [
          {
            ...section(),
            content: [
              {
                id: "el-headline",
                role: "heading",
                hidden: false,
                slot: "headline",
                value: { kind: "text", text },
              },
            ],
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------

describe("the offsets this file rests on", () => {
  it("are what they say they are", () => {
    expect(DISH.length).toBe(19);
    expect(DISH.slice(0, 9)).toBe("Solomillo");
    expect(DISH.slice(9, 10)).toBe(" ");
    expect(DISH.slice(10, 19)).toBe("al whisky");
  });
});

describe("normaliseMarks — touching means touching", () => {
  it("merges two runs of one mark that abut", () => {
    expect(
      normaliseMarks([
        { from: 0, to: 10, mark: "strong" },
        { from: 10, to: 19, mark: "strong" },
      ]),
    ).toEqual([{ from: 0, to: 19, mark: "strong" }]);
  });

  it("merges two runs of one mark that overlap", () => {
    expect(
      normaliseMarks([
        { from: 0, to: 12, mark: "strong" },
        { from: 10, to: 19, mark: "strong" },
      ]),
    ).toEqual([{ from: 0, to: 19, mark: "strong" }]);
  });

  it("does NOT merge two runs of one mark with a single unmarked space between them", () => {
    // The case the ADR's first draft got backwards. `[9,10)` is unmarked, so these do not touch.
    expect(
      normaliseMarks([
        { from: 0, to: 9, mark: "strong" },
        { from: 10, to: 19, mark: "strong" },
      ]),
    ).toEqual([
      { from: 0, to: 9, mark: "strong" },
      { from: 10, to: 19, mark: "strong" },
    ]);
  });

  it("never merges runs of different marks, however they overlap", () => {
    expect(
      normaliseMarks([
        { from: 0, to: 19, mark: "strong" },
        { from: 0, to: 19, mark: "em" },
      ]),
    ).toHaveLength(2);
    expect(
      normaliseMarks([
        { from: 0, to: 10, mark: "strong" },
        { from: 10, to: 19, mark: "em" },
      ]),
    ).toHaveLength(2);
  });

  it("drops a run that covers nothing", () => {
    expect(normaliseMarks([{ from: 4, to: 4, mark: "strong" }])).toEqual([]);
  });

  it("is a normal form: the same set in any order gives byte-identical output", () => {
    const a: MarkRun[] = [
      { from: 10, to: 19, mark: "em" },
      { from: 0, to: 9, mark: "strong" },
      { from: 0, to: 9, mark: "em" },
    ];
    const b = [...a].reverse();
    expect(JSON.stringify(normaliseMarks(a))).toBe(JSON.stringify(normaliseMarks(b)));
  });

  it("sorts by offset, then by the declaration order of the mark", () => {
    expect(
      normaliseMarks([
        { from: 0, to: 5, mark: "em" },
        { from: 0, to: 9, mark: "strong" },
      ]),
    ).toEqual([
      { from: 0, to: 9, mark: "strong" },
      { from: 0, to: 5, mark: "em" },
    ]);
  });

  it("is idempotent", () => {
    const once = normaliseMarks([
      { from: 0, to: 12, mark: "strong" },
      { from: 10, to: 19, mark: "strong" },
      { from: 3, to: 3, mark: "em" },
    ]);
    expect(normaliseMarks(once)).toEqual(once);
  });
});

const insert = (from: number, inserted: number): TextEdit => ({ from, to: from, inserted });

describe("shiftMarks — the five rows of ADR 0027 §3", () => {
  const bold: MarkRun[] = [{ from: 0, to: 9, mark: "strong" }];

  it("grows when the person types inside the run", () => {
    expect(shiftMarks(bold, insert(4, 3))).toEqual([{ from: 0, to: 12, mark: "strong" }]);
  });

  it("continues when the person types right at the end of it", () => {
    expect(shiftMarks(bold, insert(9, 3))).toEqual([{ from: 0, to: 12, mark: "strong" }]);
  });

  it("does not take in what is typed right at the start of it", () => {
    expect(shiftMarks(bold, insert(0, 6))).toEqual([{ from: 6, to: 15, mark: "strong" }]);
  });

  it("shrinks when part of it is deleted", () => {
    expect(shiftMarks(bold, { from: 4, to: 9, inserted: 0 })).toEqual([
      { from: 0, to: 4, mark: "strong" },
    ]);
  });

  it("disappears when all of it is deleted, leaving no empty run behind", () => {
    expect(shiftMarks(bold, { from: 0, to: 9, inserted: 0 })).toEqual([]);
  });

  it("leaves a run alone when the edit is entirely after it", () => {
    expect(shiftMarks(bold, insert(15, 4))).toEqual(bold);
  });

  it("slides a run along when the edit is entirely before it", () => {
    const tail: MarkRun[] = [{ from: 10, to: 19, mark: "strong" }];
    expect(shiftMarks(tail, insert(0, 6))).toEqual([{ from: 16, to: 25, mark: "strong" }]);
  });
});

describe("shiftMarks — the two cases the table does not draw", () => {
  it("typing over a selection extends a run that ended where the selection began", () => {
    // A replacement is a deletion then an insertion at the same point (§4), so the «al final
    // continúa» rule applies to what was typed.
    const bold: MarkRun[] = [{ from: 0, to: 9, mark: "strong" }];
    expect(shiftMarks(bold, { from: 9, to: 19, inserted: 4 })).toEqual([
      { from: 0, to: 13, mark: "strong" },
    ]);
  });

  it("typing over a selection does not extend a run that began where it began", () => {
    const tail: MarkRun[] = [{ from: 10, to: 19, mark: "strong" }];
    expect(shiftMarks(tail, { from: 10, to: 19, inserted: 4 })).toEqual([]);
  });

  it("joins two runs of one mark when the text between them is deleted", () => {
    const two: MarkRun[] = [
      { from: 0, to: 9, mark: "strong" },
      { from: 10, to: 19, mark: "strong" },
    ];
    // Delete the space at [9,10): the two runs now abut and must become one.
    expect(shiftMarks(two, { from: 9, to: 10, inserted: 0 })).toEqual([
      { from: 0, to: 18, mark: "strong" },
    ]);
  });

  it("clips an edit that crosses the boundary of two runs", () => {
    const two: MarkRun[] = [
      { from: 0, to: 9, mark: "strong" },
      { from: 10, to: 19, mark: "em" },
    ];
    // Replace [5,14) — the tail of the first run, the space, and the head of the second.
    //
    // The bold run ends at 9, *inside* what went, so after the deletion it ends exactly at 5 —
    // where the selection began — and the «al final continúa» rule then takes it over the typed
    // character: `[0,6)`, not `[0,5)`. That is what a word processor does when you select from
    // inside a bold word and type, and it falls out of the composition in §4 rather than being a
    // rule of its own. I expected `[0,5)` when writing this test and the implementation was right.
    expect(shiftMarks(two, { from: 5, to: 14, inserted: 1 })).toEqual([
      { from: 0, to: 6, mark: "strong" },
      { from: 6, to: 11, mark: "em" },
    ]);
  });

  it("keeps marks on text an edit did not touch", () => {
    const two: MarkRun[] = [
      { from: 0, to: 9, mark: "strong" },
      { from: 10, to: 19, mark: "strong" },
    ];
    expect(shiftMarks(two, insert(19, 5))).toEqual([
      { from: 0, to: 9, mark: "strong" },
      { from: 10, to: 24, mark: "strong" },
    ]);
  });
});

describe("textEditBetween", () => {
  it("reports an insertion as the point and the length", () => {
    expect(textEditBetween("Solomillo", "Solo ibérico millo")).toEqual({
      from: 4,
      to: 4,
      inserted: 9,
    });
  });

  it("reports a deletion as the range that went", () => {
    expect(textEditBetween("Solomillo al whisky", "Solomillo")).toEqual({
      from: 9,
      to: 19,
      inserted: 0,
    });
  });

  it("reports no change as an empty edit, which shifts nothing", () => {
    // The suffix is scanned first (see the function's own comment), so a wholly unchanged string
    // credits every character to the suffix and reports `{from: 0, to: 0}` rather than
    // `{from: length, to: length}` — both are genuine no-ops for `shiftMarks`, since nothing is
    // removed or inserted either way. The position is not what this test is about.
    const edit = textEditBetween(DISH, DISH);
    expect(edit.inserted).toBe(0);
    expect(edit.to - edit.from).toBe(0);
    const bold: MarkRun[] = [{ from: 0, to: 9, mark: "strong" }];
    expect(shiftMarks(bold, edit)).toEqual(bold);
  });

  it("falls back to the whole string when nothing in it stayed put", () => {
    // Honest rather than clever: two strings do not say that a letter moved.
    expect(textEditBetween("ab", "ba")).toEqual({ from: 0, to: 2, inserted: 2 });
  });

  describe("the boundary ambiguity sprint 10 day 7's walk found", () => {
    // Typing "beber" + " casero" right after a bold "beber" that is itself followed by a space:
    // the inserted text starts with a space, and a space already sat right there. A prefix scanned
    // from the start walks straight through that shared character, reporting the edit one position
    // later than where it actually happened — which put it past the end of the bold run and made
    // "al final continúa" silently stop applying. Caught live, in a real contentEditable, not by
    // any of this file's other cases: none of them had a repeated character sitting at the edit's
    // own boundary.
    const before = "Comer, beber y quedarse un rato";
    const after = "Comer, beber casero y quedarse un rato";

    it("places the edit at the true boundary, not past it", () => {
      // "Comer, beber" is 12 code units; that is where the person's cursor was.
      expect(textEditBetween(before, after)).toEqual({ from: 12, to: 12, inserted: 7 });
    });

    it("lets a run ending exactly there continue, the way ADR 0027 §3 promises", () => {
      const bold: MarkRun[] = [{ from: 7, to: 12, mark: "strong" }];
      const edit = textEditBetween(before, after);
      expect(shiftMarks(bold, edit)).toEqual([{ from: 7, to: 19, mark: "strong" }]);
    });

    it("still round-trips: applying the edit to `before` gives `after`", () => {
      const edit = textEditBetween(before, after);
      const rebuilt =
        before.slice(0, edit.from) +
        after.slice(edit.from, edit.from + edit.inserted) +
        before.slice(edit.to);
      expect(rebuilt).toBe(after);
    });

    it("holds in the mirror case: deleting right after a run end", () => {
      // The same boundary, the other direction: removing " casero" should land the edit back at
      // the run's own end rather than one character into it.
      const edit = textEditBetween(after, before);
      expect(edit).toEqual({ from: 12, to: 19, inserted: 0 });
    });
  });

  it("round-trips: applying the edit to `before` gives `after`", () => {
    const pairs: [string, string][] = [
      ["Solomillo", "Solomillo al whisky"],
      ["Solomillo al whisky", "Solomillo"],
      ["", "algo"],
      ["algo", ""],
      ["acentuación", "acentuación y ñ"],
      ["abc", "axc"],
    ];
    for (const [before, after] of pairs) {
      const edit = textEditBetween(before, after);
      const rebuilt =
        before.slice(0, edit.from) +
        after.slice(edit.from, edit.from + edit.inserted) +
        before.slice(edit.to);
      expect(rebuilt, `${before} -> ${after}`).toBe(after);
    }
  });
});

describe("addRun and removeRun", () => {
  it("marking the same range twice changes nothing the second time", () => {
    const once = addRun([], { from: 0, to: 9 }, "strong");
    expect(addRun(once, { from: 0, to: 9 }, "strong")).toEqual(once);
  });

  it("unmarking the middle of a run splits it in two with a gap", () => {
    const whole: MarkRun[] = [{ from: 0, to: 19, mark: "strong" }];
    expect(removeRun(whole, { from: 9, to: 10 }, "strong")).toEqual([
      { from: 0, to: 9, mark: "strong" },
      { from: 10, to: 19, mark: "strong" },
    ]);
  });

  it("unmarking leaves the other mark alone", () => {
    const both: MarkRun[] = [
      { from: 0, to: 19, mark: "strong" },
      { from: 0, to: 19, mark: "em" },
    ];
    expect(removeRun(both, { from: 0, to: 19 }, "strong")).toEqual([
      { from: 0, to: 19, mark: "em" },
    ]);
  });
});

describe("applyMark and removeMark on a document", () => {
  it("marking two ranges that touch gives one run", () => {
    let doc = applyMark(document(), at, { from: 0, to: 10 }, "strong");
    doc = applyMark(doc, at, { from: 10, to: 19 }, "strong");
    expect(marksFor(doc, at)).toEqual([{ from: 0, to: 19, mark: "strong" }]);
  });

  it("marking two ranges separated by a space gives two runs, in either order", () => {
    // The case David caught on review. Both orders, because a merge that depended on the order
    // somebody marked in is exactly what the normal form exists to prevent.
    let forwards = applyMark(document(), at, { from: 0, to: 9 }, "strong");
    forwards = applyMark(forwards, at, { from: 10, to: 19 }, "strong");

    let backwards = applyMark(document(), at, { from: 10, to: 19 }, "strong");
    backwards = applyMark(backwards, at, { from: 0, to: 9 }, "strong");

    const expected: MarkRun[] = [
      { from: 0, to: 9, mark: "strong" },
      { from: 10, to: 19, mark: "strong" },
    ];
    expect(marksFor(forwards, at)).toEqual(expected);
    expect(marksFor(backwards, at)).toEqual(expected);
    expect(JSON.stringify(forwards)).toBe(JSON.stringify(backwards));
  });

  it("the gap stays open: the space is not swallowed by either run", () => {
    let doc = applyMark(document(), at, { from: 0, to: 9 }, "strong");
    doc = applyMark(doc, at, { from: 10, to: 19 }, "strong");
    const marks = marksFor(doc, at) ?? [];
    expect(marks.some((run) => run.from <= 9 && run.to > 9)).toBe(false);
  });

  it("gives back the identical document when nothing changed", () => {
    const doc = applyMark(document(), at, { from: 0, to: 9 }, "strong");
    expect(applyMark(doc, at, { from: 0, to: 9 }, "strong")).toBe(doc);
  });

  it("an empty selection writes nothing and is not an error", () => {
    const doc = document();
    expect(applyMark(doc, at, { from: 4, to: 4 }, "strong")).toBe(doc);
  });

  it("removing the last mark drops the key rather than leaving an empty array", () => {
    const marked = applyMark(document(), at, { from: 0, to: 9 }, "strong");
    const bare = removeMark(marked, at, { from: 0, to: 9 }, "strong");
    expect(marksFor(bare, at)).toBeUndefined();
    expect(JSON.stringify(bare)).toBe(JSON.stringify(document()));
  });

  it("marks a link's text, which is where ADR 0027 §6 allows them", () => {
    const cta = { sectionId: "sec-cover", elementId: "el-cta" };
    const doc = applyMark(document(), cta, { from: 0, to: 7 }, "em");
    expect(marksFor(doc, cta)).toEqual([{ from: 0, to: 7, mark: "em" }]);
    expect(() => parseDocument(doc)).not.toThrow();
  });

  it("refuses an element with no text to mark", () => {
    const image = { sectionId: "sec-cover", elementId: "el-image" };
    expect(() => applyMark(document(), image, { from: 0, to: 2 }, "strong")).toThrow(
      /carries no text/,
    );
  });

  it("refuses a range outside the text", () => {
    expect(() => applyMark(document(), at, { from: 0, to: 40 }, "strong")).toThrow(
      /outside a text/,
    );
  });

  it("refuses an element that is not there", () => {
    expect(() =>
      applyMark(
        document(),
        { sectionId: "sec-cover", elementId: "nope" },
        { from: 0, to: 1 },
        "em",
      ),
    ).toThrow(/no element/);
  });

  it("produces a document that parses", () => {
    let doc = applyMark(document(), at, { from: 0, to: 9 }, "strong");
    doc = applyMark(doc, at, { from: 0, to: 19 }, "em");
    expect(() => parseDocument(doc)).not.toThrow();
  });
});

describe("rangeHasMark", () => {
  it("is true when one run covers the whole range", () => {
    const marks: MarkRun[] = [{ from: 0, to: 19, mark: "strong" }];
    expect(rangeHasMark(marks, { from: 4, to: 9 }, "strong")).toBe(true);
  });

  it("is false when the range reaches past the run", () => {
    const marks: MarkRun[] = [{ from: 0, to: 9, mark: "strong" }];
    expect(rangeHasMark(marks, { from: 4, to: 12 }, "strong")).toBe(false);
  });

  it("is false for the other mark, and for no marks at all", () => {
    const marks: MarkRun[] = [{ from: 0, to: 19, mark: "strong" }];
    expect(rangeHasMark(marks, { from: 0, to: 9 }, "em")).toBe(false);
    expect(rangeHasMark(undefined, { from: 0, to: 9 }, "strong")).toBe(false);
  });
});

describe("a mark boundary may not cut a surrogate pair in half", () => {
  const withEmoji = "Café 🍷 tinto";

  it("is a real corruption and not a hypothetical one", () => {
    // Measured, not assumed: the renderer escapes each piece and the file is written as UTF-8, so
    // each half is a lone surrogate by then and UTF-8 cannot encode one.
    const cut = 6; // between the two halves of the emoji
    const pieces = [withEmoji.slice(0, cut), withEmoji.slice(cut)];
    const written = pieces.map((piece) => Buffer.from(piece, "utf8").toString("utf8")).join("");
    expect(written).not.toBe(withEmoji);
    expect(written).toContain("�");
  });

  it("is refused by markTextIssue", () => {
    expect(markTextIssue(withEmoji, [{ from: 0, to: 6, mark: "strong" }])).toMatch(/surrogate/);
    expect(markTextIssue(withEmoji, [{ from: 6, to: 13, mark: "strong" }])).toMatch(/surrogate/);
  });

  it("allows a boundary on either side of the whole emoji", () => {
    expect(markTextIssue(withEmoji, [{ from: 0, to: 5, mark: "strong" }])).toBeUndefined();
    expect(markTextIssue(withEmoji, [{ from: 5, to: 7, mark: "strong" }])).toBeUndefined();
  });

  it("is refused by the verb, naming the control that caused it", () => {
    const emoji = documentWithText(withEmoji);
    expect(() => applyMark(emoji, at, { from: 0, to: 6 }, "strong")).toThrow(/surrogate/);
  });
});

describe("the schema refuses what the invariant forbids", () => {
  function withMarks(marks: unknown): unknown {
    const doc = document();
    return {
      ...doc,
      pages: [
        {
          ...doc.pages[0],
          sections: [
            {
              ...section(),
              content: [
                {
                  id: "el-headline",
                  role: "heading",
                  hidden: false,
                  slot: "headline",
                  value: { kind: "text", text: DISH, marks },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  it("accepts two different marks over the same words", () => {
    expect(() =>
      parseDocument(
        withMarks([
          { from: 0, to: 9, mark: "strong" },
          { from: 0, to: 9, mark: "em" },
        ]),
      ),
    ).not.toThrow();
  });

  it("accepts two runs of one mark with unmarked text between them", () => {
    expect(() =>
      parseDocument(
        withMarks([
          { from: 0, to: 9, mark: "strong" },
          { from: 10, to: 19, mark: "strong" },
        ]),
      ),
    ).not.toThrow();
  });

  it("refuses two runs of one mark that abut", () => {
    expect(() =>
      parseDocument(
        withMarks([
          { from: 0, to: 10, mark: "strong" },
          { from: 10, to: 19, mark: "strong" },
        ]),
      ),
    ).toThrow();
  });

  it("refuses two runs of one mark that cross", () => {
    expect(() =>
      parseDocument(
        withMarks([
          { from: 0, to: 12, mark: "strong" },
          { from: 10, to: 19, mark: "strong" },
        ]),
      ),
    ).toThrow();
  });

  it("refuses runs that arrive out of order", () => {
    expect(() =>
      parseDocument(
        withMarks([
          { from: 10, to: 19, mark: "strong" },
          { from: 0, to: 9, mark: "strong" },
        ]),
      ),
    ).toThrow();
  });

  it("refuses a run that covers nothing", () => {
    expect(() => parseDocument(withMarks([{ from: 4, to: 4, mark: "strong" }]))).toThrow();
  });

  it("refuses a run that reaches past the text", () => {
    expect(() => parseDocument(withMarks([{ from: 0, to: 40, mark: "strong" }]))).toThrow();
  });

  it("refuses a third mark", () => {
    expect(() => parseDocument(withMarks([{ from: 0, to: 9, mark: "u" }]))).toThrow();
  });

  it("refuses a non-integer offset", () => {
    expect(() => parseDocument(withMarks([{ from: 0.5, to: 9, mark: "strong" }]))).toThrow();
  });

  it("accepts a document with no marks at all, unchanged", () => {
    expect(() => parseDocument(document())).not.toThrow();
  });
});

describe("a text edit carries its marks with it", () => {
  // `withText` is the one chokepoint every text write in the product goes through —
  // `setElementText`, which the canvas commits click-to-edit through, and `applyTextEdits`, which
  // the fields panel uses. These assert through both, because a mark that survives the canvas and
  // not the fields panel would be worse than one that never survived.
  function bolded(): RetorikaDocument {
    return applyMark(document(), at, { from: 0, to: 9 }, "strong");
  }

  it("slides the mark along when text is typed in front of it", () => {
    const next = setElementText(bolded(), at, `Hoy: ${DISH}`);
    expect(marksFor(next, at)).toEqual([{ from: 5, to: 14, mark: "strong" }]);
  });

  it("grows the mark when text is typed inside it", () => {
    const next = setElementText(bolded(), at, "Solo ibérico millo al whisky");
    expect(marksFor(next, at)).toEqual([{ from: 0, to: 18, mark: "strong" }]);
  });

  it("drops the mark when its text is deleted", () => {
    const next = setElementText(bolded(), at, "al whisky");
    expect(marksFor(next, at)).toBeUndefined();
  });

  it("keeps the mark when the text does not change", () => {
    expect(marksFor(setElementText(bolded(), at, DISH), at)).toEqual([
      { from: 0, to: 9, mark: "strong" },
    ]);
  });

  it("leaves a document that never had marks exactly as it was", () => {
    const plain = document();
    expect(JSON.stringify(setElementText(plain, at, "Otra cosa"))).toBe(
      JSON.stringify(setElementText(plain, at, "Otra cosa")),
    );
    expect(marksFor(setElementText(plain, at, "Otra cosa"), at)).toBeUndefined();
  });

  it("produces a document that still parses after the shift", () => {
    expect(() => parseDocument(setElementText(bolded(), at, "Hoy"))).not.toThrow();
  });
});

describe("ADR 0027 §4b — an edit the caller watched happen beats one it guessed", () => {
  /**
   * The two cases that the amendment exists for, measured before it was written.
   *
   * Both are documents whose text contains the thing that changed **twice**, which is when two
   * strings stop determining an edit. The diff is not mistaken so much as it is guessing: both
   * readings produce the same pair of strings, and it picks one.
   */
  /** `documentWithText` plus the real verb, rather than a hand-built value: a fixture that writes
   * `marks` directly could hold a shape `applyMark` would never produce. */
  const bold = (text: string, from: number, to: number): RetorikaDocument =>
    applyMark(documentWithText(text), at, { from, to }, "strong");

  it("the measured insertion: typing at the end must not grow a mark at the start", () => {
    // "aXY" with "a" bold. The person types "XY" at offset 3. The diff reads the edit as starting at
    // offset 1, because the typed "XY" repeats the "XY" already there — so the bold's `to`, which
    // sits exactly at 1, grows by the §4 rule and swallows two characters nobody marked.
    const doc = bold("aXY", 0, 1);

    expect(marksFor(setElementText(doc, at, "aXYXY"), at)).toEqual([
      { from: 0, to: 3, mark: "strong" },
    ]);

    expect(
      marksFor(setElementText(doc, at, "aXYXY", [{ from: 0, to: 1, mark: "strong" }]), at),
    ).toEqual([{ from: 0, to: 1, mark: "strong" }]);
  });

  it("the measured deletion: a mark whose own word was never touched must survive", () => {
    // The worse of the two, because the mark is destroyed rather than stretched. Bold on the first
    // «pan»; the person deletes the SECOND «pan y », offsets 6 to 12. The diff blames the first.
    const doc = bold("pan y pan y aceite", 0, 3);

    expect(marksFor(setElementText(doc, at, "pan y aceite"), at)).toBeUndefined();

    expect(
      marksFor(setElementText(doc, at, "pan y aceite", [{ from: 0, to: 3, mark: "strong" }]), at),
    ).toEqual([{ from: 0, to: 3, mark: "strong" }]);
  });

  it("normalises what it is given, so two callers meaning the same publish the same bytes", () => {
    const doc = documentWithText("pan y aceite");
    // Out of order, and two runs of one mark that touch. INV_5 and the golden corpus both rest on
    // this coming out as one sorted, merged list however the caller happened to build it.
    const next = setElementText(doc, at, "pan y aceite", [
      { from: 6, to: 12, mark: "strong" },
      { from: 0, to: 6, mark: "strong" },
    ]);
    expect(marksFor(next, at)).toEqual([{ from: 0, to: 12, mark: "strong" }]);
    expect(() => parseDocument(next)).not.toThrow();
  });

  it("drops the key entirely when the anchored marks are empty", () => {
    // An absent `marks` and an empty one have to publish the same bytes, which is why `withText`
    // rebuilds the value without the key rather than setting it to undefined.
    const doc = bold("pan", 0, 3);
    const next = setElementText(doc, at, "pan", []);
    expect(marksFor(next, at)).toBeUndefined();
    expect(JSON.stringify(next)).not.toContain("marks");
  });

  it("refuses anchored marks that do not fit the text, rather than storing them", () => {
    // The tripwire. The caller reconciles its offsets before calling, so this firing means that
    // reconciliation has a bug — and a mark reaching past the end would publish over nothing.
    const doc = documentWithText("pan");
    expect(() => setElementText(doc, at, "pan", [{ from: 0, to: 9, mark: "strong" }])).toThrow(
      /past the end of a text of 3 code units/,
    );
  });

  it("refuses an anchored boundary that cuts a surrogate pair in half", () => {
    // ADR 0027 §2b, which the diff path gets for free by construction and this path has to check:
    // the renderer escapes each piece separately, so half a pair publishes as a replacement mark.
    const doc = documentWithText("Café 🍷 tinto");
    expect(() =>
      setElementText(doc, at, "Café 🍷 tinto", [{ from: 0, to: 6, mark: "strong" }]),
    ).toThrow(/surrogate pair/);
  });

  it("still throws on an address that matches nothing, marks or no marks", () => {
    const doc = documentWithText("pan");
    const nowhere = { sectionId: at.sectionId, elementId: "el-nope" };
    expect(() => setElementText(doc, nowhere, "pan", [])).toThrow(/no element "el-nope"/);
  });
});

describe("marksAfterTrim — the editor's trim is two deletions, not a diff", () => {
  const strong = (from: number, to: number): MarkRun => ({ from, to, mark: "strong" });

  it("a space typed after a bold word does not stay inside the bold", () => {
    // §4 grows a run whose `to` sits at the insertion point, so "pan" bold [0,3) becomes [0,4) the
    // moment a space is typed at 3 — and the commit stores "pan", three code units.
    expect(marksAfterTrim("pan ", [strong(0, 4)])).toEqual([strong(0, 3)]);
  });

  it("a space typed before a bold word brings the run back to zero", () => {
    expect(marksAfterTrim(" pan", [strong(1, 4)])).toEqual([strong(0, 3)]);
  });

  it("handles whitespace at both ends at once, which a diff cannot", () => {
    // `textEditBetween("  pan ", "pan")` finds no common prefix and no common suffix, so it reports
    // the whole string replaced and every run on it dies. This is the case that proves the two are
    // not interchangeable.
    expect(marksAfterTrim("  pan y aceite ", [strong(2, 5)])).toEqual([strong(0, 3)]);
    expect(shiftMarks([strong(2, 5)], textEditBetween("  pan y aceite ", "pan y aceite"))).toEqual(
      [],
    );
  });

  it("handles the renderer's own pretty-printing, which is the shape this really arrives in", () => {
    expect(marksAfterTrim("\n      pan y aceite\n    ", [strong(7, 10)])).toEqual([strong(0, 3)]);
  });

  it("drops a run that was entirely whitespace instead of keeping an empty one", () => {
    expect(marksAfterTrim("pan  ", [strong(3, 5)])).toEqual([]);
  });

  it("leaves the marks alone when there is nothing to trim", () => {
    expect(marksAfterTrim("pan y aceite", [strong(0, 3)])).toEqual([strong(0, 3)]);
  });

  it("never produces a run outside the trimmed text", () => {
    for (const raw of ["pan ", " pan", "  pan  ", "\n  pan y aceite \n", "pan", "   "]) {
      for (let from = 0; from < raw.length; from += 1) {
        for (let to = from + 1; to <= raw.length; to += 1) {
          for (const run of marksAfterTrim(raw, [strong(from, to)])) {
            expect(run.from, `${JSON.stringify(raw)} [${from},${to})`).toBeGreaterThanOrEqual(0);
            expect(run.to, `${JSON.stringify(raw)} [${from},${to})`).toBeLessThanOrEqual(
              raw.trim().length,
            );
            expect(run.to).toBeGreaterThan(run.from);
          }
        }
      }
    }
  });
});
