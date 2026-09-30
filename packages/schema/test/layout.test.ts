import { describe, expect, it } from "vitest";
import type {
  ContentElement,
  PlacementEdit,
  PresetShape,
  RetorikaDocument,
  Section,
} from "../src/index.ts";
import {
  escalateSection,
  isHandDesigned,
  parseDocument,
  revertPlanFor,
  revertSection,
  setPlacement,
} from "../src/index.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * The document-level half of the escalation and the return (ADR 0025).
 *
 * The engine in `revert.ts` has been tested since phase 0 and called by nothing outside tests.
 * These are the verbs the editor dispatches, so what they have to get right is the part the engine
 * does not do: finding the section, leaving the rest of the document alone, and answering "nothing
 * changed" in a way the history can recognise.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function heading(id: string, text: string): ContentElement {
  return { id, role: "heading", hidden: false, slot: "headline", value: { kind: "text", text } };
}

function body(id: string, text: string): ContentElement {
  return { id, role: "body", hidden: false, slot: "intro", value: { kind: "text", text } };
}

/** A preset of two slots, with a layout that puts the heading over the body. Hand-written rather
 * than imported: `packages/schema` may not import the catalog. */
const preset: PresetShape = {
  catalogId: "demo",
  slots: [
    { slot: "headline", role: "heading", min: 1, max: 1 },
    { slot: "intro", role: "body", min: 0, max: 1 },
  ],
  layoutFor: (_variantId, elements) => ({
    grid: { columns: 12 },
    placements: elements.map((element, index) => ({
      elementId: element.id,
      column: 1,
      columnSpan: 12,
      row: index + 1,
      rowSpan: 1,
    })),
    breakpoints: { tablet: [], mobile: [] },
  }),
};

function section(): Section {
  return {
    id: "sec-demo",
    preset: { catalogId: "demo", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [heading("el-h", "Cortes y barbas"), body("el-b", "Te lo hacemos a tu gusto.")],
  };
}

/** Two sections and two pages, so "leaves the rest alone" is a claim with something to leave. */
function documentWith(target: Section): RetorikaDocument {
  const other: Section = { ...section(), id: "sec-otra", content: [heading("el-o", "Otra")] };
  return parseDocument({
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    collections: [],
    pages: [
      { id: "home", slug: "index", title: "Inicio", sections: [target, other] },
      { id: "page-2", slug: "otra", title: "Otra", sections: [{ ...section(), id: "sec-lejos" }] },
    ],
  });
}

const sectionOf = (doc: RetorikaDocument, id: string) =>
  doc.pages.flatMap((page) => page.sections).find((candidate) => candidate.id === id);

describe("escalateSection", () => {
  it("makes the section free and gives it the layout the catalog was already drawing", () => {
    const after = escalateSection(documentWith(section()), "sec-demo", preset);
    const free = sectionOf(after, "sec-demo");

    expect(free?.source).toBe("free");
    expect(free?.layout).toEqual(preset.layoutFor("stacked", section().content));
  });

  it("moves nothing: every element keeps its id, its slot and its words", () => {
    // The promise the offer makes before anybody accepts it — «no se mueve ni un píxel» — and the
    // reason the return can be lossless later.
    const before = documentWith(section());
    const after = escalateSection(before, "sec-demo", preset);

    expect(sectionOf(after, "sec-demo")?.content).toEqual(sectionOf(before, "sec-demo")?.content);
  });

  it("leaves every other section and page exactly as it found them", () => {
    const before = documentWith(section());
    const after = escalateSection(before, "sec-demo", preset);

    expect(sectionOf(after, "sec-otra")).toEqual(sectionOf(before, "sec-otra"));
    expect(after.pages[1]).toEqual(before.pages[1]);
  });

  it("hands back the identical document for a section that is already free", () => {
    // Not an equal copy: the same object, so the editor's history opens no step for an action
    // that changed nothing. `setVariant` and `renamePage` already answer this way.
    const once = escalateSection(documentWith(section()), "sec-demo", preset);
    expect(escalateSection(once, "sec-demo", preset)).toBe(once);
  });

  it("does not touch the document it was given", () => {
    const before = documentWith(section());
    const snapshot = JSON.stringify(before);
    escalateSection(before, "sec-demo", preset);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("throws for a section the document does not have, naming it", () => {
    expect(() => escalateSection(documentWith(section()), "sec-nope", preset)).toThrow(
      /escalateSection: no section "sec-nope"/,
    );
  });
});

describe("revertSection", () => {
  it("puts the section back under the catalog, with no layout of its own", () => {
    const free = escalateSection(documentWith(section()), "sec-demo", preset);
    const back = revertSection(free, "sec-demo", preset);

    expect(sectionOf(back, "sec-demo")?.source).toBe("catalog");
    expect(sectionOf(back, "sec-demo")?.layout).toBeNull();
  });

  it("round-trips: escalate then revert gives back exactly the document that went in", () => {
    // `INV_3A` reached through the verbs the editor dispatches, rather than through a section
    // built by hand in a test — which is the only way it has ever been exercised until now.
    const before = documentWith(section());
    expect(revertSection(escalateSection(before, "sec-demo", preset), "sec-demo", preset)).toEqual(
      before,
    );
  });

  it("brings every text back to its exact slot, by id and not by guessing", () => {
    const before = documentWith(section());
    const back = revertSection(escalateSection(before, "sec-demo", preset), "sec-demo", preset);
    const content = sectionOf(back, "sec-demo")?.content ?? [];

    expect(content.map((element) => [element.id, element.slot])).toEqual([
      ["el-h", "headline"],
      ["el-b", "intro"],
    ]);
  });

  it("hands back the identical document for a section of the catalog", () => {
    const doc = documentWith(section());
    expect(revertSection(doc, "sec-demo", preset)).toBe(doc);
  });

  it("hides what the preset cannot place rather than throwing, and never deletes it", () => {
    // `applyRevert` refuses an undecided surplus element — correctly, and that is what the day-4
    // dialog will answer. Until it exists this verb supplies the default the interface is already
    // committed to («The interface's default for that decision is "hide"»), so a reducer can never
    // be thrown into. Hiding loses nothing: rule 3 keeps the element and the fields panel lists it.
    const withSurplus: Section = {
      ...section(),
      content: [...section().content, body("el-extra", "Una segunda entradilla")],
    };
    const free = escalateSection(documentWith(withSurplus), "sec-demo", preset);
    const back = revertSection(free, "sec-demo", preset);
    const extra = sectionOf(back, "sec-demo")?.content.find((el) => el.id === "el-extra");

    expect(extra, "the surplus element is still in the document").toBeDefined();
    expect(extra?.hidden).toBe(true);
    expect(extra?.value).toEqual({ kind: "text", text: "Una segunda entradilla" });
  });

  it("deletes a surplus element only when the caller says so", () => {
    const withSurplus: Section = {
      ...section(),
      content: [...section().content, body("el-extra", "Una segunda entradilla")],
    };
    const free = escalateSection(documentWith(withSurplus), "sec-demo", preset);
    const back = revertSection(free, "sec-demo", preset, { "el-extra": "delete" });

    expect(sectionOf(back, "sec-demo")?.content.some((el) => el.id === "el-extra")).toBe(false);
  });

  it("throws for a section the document does not have, naming it", () => {
    expect(() => revertSection(documentWith(section()), "sec-nope", preset)).toThrow(
      /revertSection: no section "sec-nope"/,
    );
  });
});

describe("what the interface asks before it offers either action", () => {
  it("isHandDesigned separates the two states, and answers false for an unknown section", () => {
    const doc = documentWith(section());
    expect(isHandDesigned(doc, "sec-demo")).toBe(false);
    expect(isHandDesigned(escalateSection(doc, "sec-demo", preset), "sec-demo")).toBe(true);
    expect(isHandDesigned(doc, "sec-nope")).toBe(false);
  });

  it("revertPlanFor says nothing about a section of the catalog, rather than an empty plan", () => {
    // `undefined` and "a plan with nothing in it" mean different things, and a caller should not
    // have to tell them apart by counting.
    expect(revertPlanFor(documentWith(section()), "sec-demo", preset)).toBeUndefined();
  });

  it("revertPlanFor reports the surplus the day-4 dialog will have to show", () => {
    const withSurplus: Section = {
      ...section(),
      content: [...section().content, body("el-extra", "Una segunda entradilla")],
    };
    const free = escalateSection(documentWith(withSurplus), "sec-demo", preset);
    const plan = revertPlanFor(free, "sec-demo", preset);

    expect(plan?.surplus.map((item) => item.elementId)).toEqual(["el-extra"]);
    expect(plan?.assignments.map((item) => item.elementId)).toEqual(["el-h", "el-b"]);
  });
});

describe("setPlacement", () => {
  /**
   * Moving and resizing inside the grid — the first verb in this package that edits a placement.
   *
   * Rule 4 is the whole subject: every number here is a column, a span or a row, and the tests that
   * matter most are the ones that **provoke the refusal on purpose**, in the verb rather than in the
   * schema underneath it. `parseDocument` and `checkInvariants` would both catch an overflowing
   * placement eventually; catching it here is what lets the message name the arrow that was pressed.
   */
  const free = () => escalateSection(documentWith(section()), "sec-demo", preset);
  const placementOf = (doc: RetorikaDocument, elementId: string) =>
    sectionOf(doc, "sec-demo")?.layout?.placements.find((p) => p.elementId === elementId);

  it("starts from the layout the catalog was drawing, which is what makes a first move sensible", () => {
    expect(placementOf(free(), "el-h")).toEqual({
      elementId: "el-h",
      column: 1,
      columnSpan: 12,
      row: 1,
      rowSpan: 1,
    });
  });

  it("changes one number and leaves the other three alone", () => {
    // A partial edit, because one press of a stepper is one number. Requiring all four would make
    // every caller restate what it is not changing, which is how the other three drift.
    const after = setPlacement(free(), "sec-demo", "el-h", { columnSpan: 5 });
    expect(placementOf(after, "el-h")).toEqual({
      elementId: "el-h",
      column: 1,
      columnSpan: 5,
      row: 1,
      rowSpan: 1,
    });
  });

  it("moves the element it was given and nothing else in the section", () => {
    const before = free();
    const after = setPlacement(before, "sec-demo", "el-h", { column: 4, columnSpan: 6 });
    expect(placementOf(after, "el-b")).toEqual(placementOf(before, "el-b"));
    expect(sectionOf(after, "sec-demo")?.content).toEqual(sectionOf(before, "sec-demo")?.content);
  });

  it("leaves the other sections and pages untouched", () => {
    const before = free();
    const after = setPlacement(before, "sec-demo", "el-h", { row: 3 });
    expect(sectionOf(after, "sec-otra")).toEqual(sectionOf(before, "sec-otra"));
    expect(after.pages[1]).toEqual(before.pages[1]);
  });

  it("keeps the breakpoint patches, which belong to the layout and not to one placement", () => {
    const withPatch = free();
    const patched = {
      ...withPatch,
      pages: withPatch.pages.map((page, index) =>
        index !== 0
          ? page
          : {
              ...page,
              sections: page.sections.map((s) =>
                s.id !== "sec-demo" || !s.layout
                  ? s
                  : {
                      ...s,
                      layout: {
                        ...s.layout,
                        breakpoints: { mobile: [{ elementId: "el-b", hidden: true }] },
                      },
                    },
              ),
            },
      ),
    };
    const after = setPlacement(patched, "sec-demo", "el-h", { column: 2, columnSpan: 4 });
    expect(sectionOf(after, "sec-demo")?.layout?.breakpoints).toEqual({
      mobile: [{ elementId: "el-b", hidden: true }],
    });
  });

  it("hands back the identical document when the numbers are the ones it already had", () => {
    // What lets a stepper be held down at its limit without filling the undo stack with steps that
    // changed nothing — the same answer `setVariant` and `escalateSection` give.
    const doc = free();
    expect(setPlacement(doc, "sec-demo", "el-h", { column: 1, columnSpan: 12 })).toBe(doc);
    expect(setPlacement(doc, "sec-demo", "el-h", {})).toBe(doc);
  });

  it("does not touch the document it was given", () => {
    const doc = free();
    const snapshot = JSON.stringify(doc);
    setPlacement(doc, "sec-demo", "el-h", { column: 5, columnSpan: 2 });
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  describe("rule 4, refused in the verb and named", () => {
    it("refuses a span that reaches past the twelfth column, saying which column it reached", () => {
      // The provocation the plan asked for: not "the schema would have caught it", but this verb
      // catching it, with the arithmetic in the message.
      expect(() => setPlacement(free(), "sec-demo", "el-h", { column: 10, columnSpan: 4 })).toThrow(
        /column 10 with a span of 4 reaches column 13, past the 12-column grid \(rule 4\)/,
      );
    });

    it("refuses a column outside the grid", () => {
      expect(() => setPlacement(free(), "sec-demo", "el-h", { column: 13 })).toThrow(
        /column 13 is outside the 12-column grid \(rule 4\)/,
      );
    });

    it("accepts the placement that ends exactly on the twelfth column", () => {
      // The boundary in the other direction, because an off-by-one here would silently forbid the
      // full-width element every cover has.
      expect(
        placementOf(setPlacement(free(), "sec-demo", "el-h", { column: 9, columnSpan: 4 }), "el-h"),
      ).toMatchObject({ column: 9, columnSpan: 4 });
    });

    it("refuses zero, negative and fractional values, naming the field", () => {
      const cases: [PlacementEdit, RegExp][] = [
        [{ column: 0 }, /column must be a whole number of at least 1, not 0/],
        [{ columnSpan: 0 }, /columnSpan must be a whole number of at least 1, not 0/],
        [{ row: -1 }, /row must be a whole number of at least 1, not -1/],
        [{ rowSpan: 0 }, /rowSpan must be a whole number of at least 1, not 0/],
        [{ column: 2.5 }, /column must be a whole number of at least 1, not 2.5/],
      ];
      for (const [edit, message] of cases) {
        expect(() => setPlacement(free(), "sec-demo", "el-h", edit), JSON.stringify(edit)).toThrow(
          message,
        );
      }
    });

    it("lets two elements share a cell, which the schema has never forbidden", () => {
      // Overlap stacks in CSS grid and is a real technique. `checkInvariants` rejects the same
      // element being placed twice, not two elements in one place, and this verb does not invent a
      // rule the document model does not have.
      const after = setPlacement(free(), "sec-demo", "el-b", { row: 1 });
      expect(placementOf(after, "el-b")).toMatchObject({ row: 1, column: 1, columnSpan: 12 });
      expect(placementOf(after, "el-h")).toMatchObject({ row: 1 });
    });

    it("accepts a row far below the last one, because rows are not a fixed count", () => {
      expect(
        placementOf(setPlacement(free(), "sec-demo", "el-b", { row: 40 }), "el-b"),
      ).toMatchObject({ row: 40 });
    });
  });

  describe("what it refuses to be asked at all", () => {
    it("throws for a section the document does not have, naming it", () => {
      expect(() => setPlacement(free(), "sec-nope", "el-h", { column: 2 })).toThrow(
        /setPlacement: no section "sec-nope"/,
      );
    });

    it("throws for a section the catalog is still drawing, and says what to do about it", () => {
      // Not a silent no-op: a section of the catalog has no placements of its own, so there is
      // nothing here to change, and the honest answer names the verb that would make it possible.
      expect(() =>
        setPlacement(documentWith(section()), "sec-demo", "el-h", { column: 2 }),
      ).toThrow(/is drawn by the catalog.*escalateSection/s);
    });

    it("throws for an element that has no placement", () => {
      expect(() => setPlacement(free(), "sec-demo", "el-nope", { column: 2 })).toThrow(
        /element "el-nope" has no placement in section "sec-demo"/,
      );
    });
  });
});
