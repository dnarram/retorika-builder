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
  mobilePatchFor,
  mobileSequence,
  moveUpOnMobile,
  parseDocument,
  revertImpact,
  revertPlanFor,
  revertSection,
  setMobilePatch,
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

describe("revertImpact — what the return dialog has to say before it does anything", () => {
  /**
   * The dialog of day 4 exists because `applyRevert` refuses to act on a surplus element with no
   * explicit decision. What it needs from this package is one answer to «is there anything worth
   * stopping the person for», and that answer is a decision about the document model rather than
   * about the layout of a panel — so it lives here and the component only draws it.
   */
  const free = () => escalateSection(documentWith(section()), "sec-demo", preset);

  const withSurplus = () => {
    const target: Section = {
      ...section(),
      content: [...section().content, body("el-extra", "Una segunda entradilla")],
    };
    return escalateSection(documentWith(target), "sec-demo", preset);
  };

  const withMobilePatch = (doc: RetorikaDocument) =>
    parseDocument({
      ...doc,
      pages: doc.pages.map((page, index) =>
        index !== 0
          ? page
          : {
              ...page,
              sections: page.sections.map((candidate) =>
                candidate.id !== "sec-demo" || !candidate.layout
                  ? candidate
                  : {
                      ...candidate,
                      layout: {
                        ...candidate.layout,
                        breakpoints: { mobile: [{ elementId: "el-b", hidden: true }] },
                      },
                    },
              ),
            },
      ),
    });

  it("says nothing about a section the catalog still draws", () => {
    expect(revertImpact(documentWith(section()), "sec-demo", preset)).toBeUndefined();
  });

  it("is lossless right after escalating, because nothing has been moved yet", () => {
    // The whole reason the offer can be accepted without risk, stated as the thing the interface
    // reads: escalate and change your mind, and the return takes away nothing at all.
    const impact = revertImpact(free(), "sec-demo", preset);
    expect(impact).toMatchObject({
      lossless: true,
      dropsPlacements: false,
      dropsBreakpointAdjustments: false,
      surplus: [],
    });
  });

  it("stops being lossless the moment an element is moved", () => {
    const moved = setPlacement(free(), "sec-demo", "el-h", { column: 3, columnSpan: 4 });
    expect(revertImpact(moved, "sec-demo", preset)).toMatchObject({
      lossless: false,
      dropsPlacements: true,
    });
  });

  it("is lossless again once the element is put back where the catalog had it", () => {
    // Compared against what the preset draws *now*, not against a snapshot taken at escalation —
    // so moving something and moving it back costs nothing, which is what a person would expect.
    const there = setPlacement(free(), "sec-demo", "el-h", { column: 3, columnSpan: 4 });
    const back = setPlacement(there, "sec-demo", "el-h", { column: 1, columnSpan: 12 });
    expect(revertImpact(back, "sec-demo", preset)).toMatchObject({
      lossless: true,
      dropsPlacements: false,
    });
  });

  it("reports the mobile adjustments that would disappear", () => {
    // `planRevert` has returned `dropsBreakpointAdjustments` since phase 0 and nothing has ever
    // read it. This is the field the dossier §5 wrote it for: «El diálogo lo advierte, porque si no
    // parece un fallo.»
    const impact = revertImpact(withMobilePatch(free()), "sec-demo", preset);
    expect(impact).toMatchObject({ dropsBreakpointAdjustments: true, lossless: false });
  });

  it("reports the surplus with a reason per element", () => {
    const impact = revertImpact(withSurplus(), "sec-demo", preset);
    expect(impact?.surplus).toEqual([
      { elementId: "el-extra", slot: "intro", reason: 'slot "intro" shows at most 1' },
    ]);
    expect(impact?.lossless).toBe(false);
  });

  it("reports what comes back and to which slot, which is the dialog's other half", () => {
    expect(revertImpact(free(), "sec-demo", preset)?.assignments).toEqual([
      { elementId: "el-h", slot: "headline" },
      { elementId: "el-b", slot: "intro" },
    ]);
  });

  it("reports all three losses at once when all three apply", () => {
    const moved = setPlacement(withSurplus(), "sec-demo", "el-h", { column: 2, columnSpan: 3 });
    const impact = revertImpact(withMobilePatch(moved), "sec-demo", preset);
    expect(impact).toMatchObject({
      dropsPlacements: true,
      dropsBreakpointAdjustments: true,
      lossless: false,
    });
    expect(impact?.surplus).toHaveLength(1);
  });

  it("throws for a section the document does not have, naming it", () => {
    expect(() => revertImpact(free(), "sec-nope", preset)).toThrow(
      /revertImpact: no section "sec-nope"/,
    );
  });
});

describe("rule 7 — the three mobile adjustments", () => {
  /**
   * The verbs behind «Ocultar aquí», «Subir» and «Foto menor», and the order rule the renderer
   * publishes. `mobileSequence` lives here rather than in `packages/renderer` so that the editor's
   * «Subir» and the CSS it produces cannot come to disagree — two implementations of one rule is
   * exactly how the design panel and the canvas fell out of step on day 3.
   */
  const free = () => escalateSection(documentWith(section()), "sec-demo", preset);
  const mobileOf = (doc: RetorikaDocument) =>
    sectionOf(doc, "sec-demo")?.layout?.breakpoints.mobile;
  const sequenceOf = (doc: RetorikaDocument) => {
    const target = sectionOf(doc, "sec-demo");
    if (!target) throw new Error("no section");
    return mobileSequence(target).map((slot) => slot.elementId);
  };

  describe("mobileSequence", () => {
    it("is content order when nothing is patched", () => {
      expect(sequenceOf(free())).toEqual(["el-h", "el-b"]);
    });

    it("numbers every element, not only the patched ones", () => {
      // The correction a browser made at 390px: an unpatched element keeps CSS's default `0`, which
      // is ahead of anything patched to `1`, so the document said one thing and the page another.
      const target = sectionOf(
        setMobilePatch(free(), "sec-demo", "el-b", { order: 1 }),
        "sec-demo",
      );
      if (!target) throw new Error("no section");
      expect(mobileSequence(target)).toEqual([
        { elementId: "el-h", order: 1, patched: false },
        { elementId: "el-b", order: 1, patched: true },
      ]);
    });

    it("settles a tie by document order, the way CSS does — which is why «Subir» is a swap", () => {
      // `el-h` is first in the content and keeps its derived 1; `el-b` is patched to 1 as well. Same
      // number, so the markup decides, and the markup puts the heading first. **So patching an
      // element to one less does not move it up** — it lands beside the element above and loses the
      // tie to it. That is the whole reason `moveUpOnMobile` writes both numbers instead of one.
      expect(sequenceOf(setMobilePatch(free(), "sec-demo", "el-b", { order: 1 }))).toEqual([
        "el-h",
        "el-b",
      ]);
    });
  });

  describe("setMobilePatch", () => {
    it("hides an element on mobile and nowhere else", () => {
      const after = setMobilePatch(free(), "sec-demo", "el-b", { hidden: true });
      expect(mobileOf(after)).toEqual([{ elementId: "el-b", hidden: true }]);
      // The desktop layout is untouched: the element still has its placement and is still visible.
      expect(sectionOf(after, "sec-demo")?.content.find((el) => el.id === "el-b")?.hidden).toBe(
        false,
      );
      expect(sectionOf(after, "sec-demo")?.layout?.placements).toEqual(
        sectionOf(free(), "sec-demo")?.layout?.placements,
      );
    });

    it("narrows an element, and narrows it again", () => {
      const once = setMobilePatch(free(), "sec-demo", "el-b", { columnSpan: 9 });
      const twice = setMobilePatch(once, "sec-demo", "el-b", { columnSpan: 6 });
      expect(mobileOf(twice)).toEqual([{ elementId: "el-b", columnSpan: 6 }]);
    });

    it("merges into an existing patch rather than replacing it", () => {
      const hidden = setMobilePatch(free(), "sec-demo", "el-b", { hidden: true });
      const both = setMobilePatch(hidden, "sec-demo", "el-b", { columnSpan: 6 });
      expect(mobileOf(both)).toEqual([{ elementId: "el-b", hidden: true, columnSpan: 6 }]);
    });

    it("takes an adjustment away when its field is undefined", () => {
      const both = setMobilePatch(free(), "sec-demo", "el-b", { hidden: true, columnSpan: 6 });
      const narrowed = setMobilePatch(both, "sec-demo", "el-b", { hidden: undefined });
      expect(mobileOf(narrowed)).toEqual([{ elementId: "el-b", columnSpan: 6 }]);
    });

    it("drops the patch entirely once it says nothing, rather than leaving an empty one", () => {
      // `{ elementId }` alone is an entry the renderer skips and a reviewer has to wonder about.
      const hidden = setMobilePatch(free(), "sec-demo", "el-b", { hidden: true });
      expect(mobileOf(setMobilePatch(hidden, "sec-demo", "el-b", { hidden: undefined }))).toEqual(
        [],
      );
    });

    it("hands back the identical document when nothing changes", () => {
      const doc = setMobilePatch(free(), "sec-demo", "el-b", { hidden: true });
      expect(setMobilePatch(doc, "sec-demo", "el-b", { hidden: true })).toBe(doc);
    });

    it("refuses a section the catalog draws, and says what to do about it", () => {
      // Patches live inside `layout`, and a catalog section has `layout: null` — there is nowhere to
      // put them. The dossier §5's first entry point, and the offer has to say so beforehand.
      expect(() =>
        setMobilePatch(documentWith(section()), "sec-demo", "el-b", { hidden: true }),
      ).toThrow(/has no layout to patch.*escalateSection/s);
    });

    it("refuses an element the section does not have", () => {
      expect(() => setMobilePatch(free(), "sec-demo", "el-nope", { hidden: true })).toThrow(
        /has no element "el-nope"/,
      );
    });

    it("cannot write a fourth adjustment, because the schema refuses one", () => {
      expect(() =>
        setMobilePatch(free(), "sec-demo", "el-b", { padding: "8px" } as never),
      ).toThrow();
    });
  });

  describe("moveUpOnMobile", () => {
    it("swaps two elements rather than decrementing one", () => {
      // Setting `el-b` to one less would give it the same number as `el-h`, and CSS breaks that tie
      // by document order — which is the order being undone. So both get a number and they trade.
      const after = moveUpOnMobile(free(), "sec-demo", "el-b");
      expect(sequenceOf(after)).toEqual(["el-b", "el-h"]);
      expect(mobileOf(after)).toEqual([
        { elementId: "el-b", order: 1 },
        { elementId: "el-h", order: 2 },
      ]);
    });

    it("is one step, so undoing it once puts both back", () => {
      // Two patches written, one act. The history step is the editor's, but it can only be one if
      // the verb is one.
      const before = free();
      expect(moveUpOnMobile(before, "sec-demo", "el-b")).not.toBe(before);
      expect(sequenceOf(moveUpOnMobile(before, "sec-demo", "el-b"))).toEqual(["el-b", "el-h"]);
    });

    it("hands back the identical document for the element already first", () => {
      const doc = free();
      expect(moveUpOnMobile(doc, "sec-demo", "el-h")).toBe(doc);
    });

    it("moves the same element up twice without leaving a gap", () => {
      const third = setMobilePatch(free(), "sec-demo", "el-b", { order: 2 });
      const up = moveUpOnMobile(third, "sec-demo", "el-b");
      expect(sequenceOf(up)).toEqual(["el-b", "el-h"]);
      expect(moveUpOnMobile(up, "sec-demo", "el-b")).toBe(up);
    });

    it("keeps the other adjustments of both elements", () => {
      const hidden = setMobilePatch(free(), "sec-demo", "el-b", { hidden: true });
      const up = moveUpOnMobile(hidden, "sec-demo", "el-b");
      expect(mobileOf(up)).toEqual([
        { elementId: "el-b", hidden: true, order: 1 },
        { elementId: "el-h", order: 2 },
      ]);
    });

    it("refuses a section the catalog draws", () => {
      expect(() => moveUpOnMobile(documentWith(section()), "sec-demo", "el-b")).toThrow(
        /has no layout to patch/,
      );
    });
  });

  describe("mobilePatchFor", () => {
    it("answers the patch, and undefined when there is none", () => {
      expect(mobilePatchFor(free(), "sec-demo", "el-b")).toBeUndefined();
      const hidden = setMobilePatch(free(), "sec-demo", "el-b", { hidden: true });
      expect(mobilePatchFor(hidden, "sec-demo", "el-b")).toEqual({
        elementId: "el-b",
        hidden: true,
      });
    });

    it("answers undefined for a section or element that is not there", () => {
      expect(mobilePatchFor(free(), "sec-nope", "el-b")).toBeUndefined();
      expect(mobilePatchFor(free(), "sec-demo", "el-nope")).toBeUndefined();
    });
  });
});
