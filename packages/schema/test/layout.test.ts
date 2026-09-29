import { describe, expect, it } from "vitest";
import type { ContentElement, PresetShape, RetorikaDocument, Section } from "../src/index.ts";
import {
  escalateSection,
  isHandDesigned,
  parseDocument,
  revertPlanFor,
  revertSection,
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
