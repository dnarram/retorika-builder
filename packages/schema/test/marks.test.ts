import { describe, expect, it } from "vitest";
import { type RetorikaDocument, SCHEMA_VERSION, type Section } from "../src/document.ts";
import {
  addRun,
  applyMark,
  type MarkRun,
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
    const edit = textEditBetween(DISH, DISH);
    expect(edit).toEqual({ from: 19, to: 19, inserted: 0 });
    const bold: MarkRun[] = [{ from: 0, to: 9, mark: "strong" }];
    expect(shiftMarks(bold, edit)).toEqual(bold);
  });

  it("falls back to the whole string when nothing in it stayed put", () => {
    // Honest rather than clever: two strings do not say that a letter moved.
    expect(textEditBetween("ab", "ba")).toEqual({ from: 0, to: 2, inserted: 2 });
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
