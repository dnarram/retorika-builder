import { describe, expect, it } from "vitest";
import {
  applyRevert,
  type ContentElement,
  escalate,
  type PresetShape,
  planRevert,
  type Section,
  sectionSchema,
} from "../src/index.ts";

/**
 * A list travels whole through escalate and revert.
 *
 * A list is one element in its slot; its items live inside it. Before this change, escalate
 * and planRevert walked `flattenElements(section.content)`, so every element inside an item
 * reached the slot matching and came out as surplus ("the preset declares no slot 'title'"),
 * and reverting a section with a list demanded a decision for every card.
 *
 * The preset is declared here rather than taken from @retorika/catalog: the schema package
 * does not depend on the catalog, and a two-slot preset is all revert needs.
 */

/** Every call to layoutFor records the ids it was given, so the test can see what escalate passes. */
const received: string[][] = [];

const listPreset: PresetShape = {
  catalogId: "list-fixture",
  slots: [
    { slot: "headline", role: "heading", min: 1, max: 1 },
    { slot: "services", role: "list", min: 1, max: 1 },
  ],
  layoutFor(_variantId, elements) {
    received.push(elements.map((element) => element.id));
    return {
      grid: { columns: 12 },
      placements: elements.map((element, i) => ({
        elementId: element.id,
        column: 1,
        columnSpan: 12,
        row: i + 1,
        rowSpan: 1,
      })),
      breakpoints: { tablet: [], mobile: [] },
    };
  },
};

function card(prefix: string, n: number) {
  return {
    id: `${prefix}-item-${n}`,
    elements: [
      {
        id: `${prefix}-card-${n}-title`,
        role: "heading",
        hidden: false,
        slot: "title",
        value: { kind: "text", text: `Servicio ${n}` },
      },
      {
        id: `${prefix}-card-${n}-description`,
        role: "body",
        hidden: false,
        slot: "description",
        value: { kind: "text", text: `Descripción del servicio ${n}` },
      },
    ],
  };
}

function list(id: string, prefix: string, cards: number) {
  return {
    id,
    role: "list",
    hidden: false,
    slot: "services",
    items: Array.from({ length: cards }, (_, i) => card(prefix, i + 1)),
  };
}

const headline = {
  id: "el-headline",
  role: "heading",
  hidden: false,
  slot: "headline",
  value: { kind: "text", text: "Qué hacemos" },
};

/** Parsed, not cast: a test section that is not a valid section would test nothing. */
function section(content: unknown[]): Section {
  return sectionSchema.parse({
    id: "sec-services",
    preset: { catalogId: "list-fixture", variantId: "stacked" },
    source: "catalog",
    content,
    layout: null,
  });
}

const withOneList = section([headline, list("list-services", "a", 3)]);
const itemElementIds = (s: Section) =>
  s.content.flatMap((el) => (el.items ?? []).flatMap((item) => item.elements.map((e) => e.id)));

describe("revert with a list", () => {
  it("escalate then revert gives back the identical section", () => {
    expect(applyRevert(escalate(withOneList, listPreset), listPreset)).toEqual(withOneList);
  });

  it("never reports an element inside an item as surplus; the list lands in its slot", () => {
    const plan = planRevert(escalate(withOneList, listPreset), listPreset);
    expect(plan.surplus).toEqual([]);
    expect(plan.assignments).toEqual([
      { elementId: "el-headline", slot: "headline" },
      { elementId: "list-services", slot: "services" },
    ]);
    const mentioned = [...plan.assignments, ...plan.surplus].map((entry) => entry.elementId);
    for (const id of itemElementIds(withOneList)) expect(mentioned).not.toContain(id);
  });

  it("reports a surplus list once, with its items inside it, and applies the decision to the whole list", () => {
    const twoLists = section([headline, list("list-services", "a", 3), list("list-extra", "b", 2)]);
    const escalated = escalate(twoLists, listPreset);

    const plan = planRevert(escalated, listPreset);
    expect(plan.surplus.map((entry) => entry.elementId)).toEqual(["list-extra"]);

    const hidden = applyRevert(escalated, listPreset, { "list-extra": "hide" });
    const extra = hidden.content.find((el) => el.id === "list-extra");
    expect(extra?.hidden).toBe(true);
    // Hiding the list hides it as a unit: its items are carried unchanged, not hidden one by one.
    expect(extra?.items).toEqual(twoLists.content.find((el) => el.id === "list-extra")?.items);

    const deleted = applyRevert(escalated, listPreset, { "list-extra": "delete" });
    expect(deleted.content.map((el) => el.id)).toEqual(["el-headline", "list-services"]);
  });

  it("gives layoutFor only the top-level elements when escalating", () => {
    received.length = 0;
    escalate(withOneList, listPreset);
    expect(received).toEqual([["el-headline", "list-services"]]);
  });

  it("keeps a content edit made inside an item while the section was free", () => {
    const escalated = escalate(withOneList, listPreset);
    const edited: Section = {
      ...escalated,
      content: escalated.content.map(
        (el): ContentElement =>
          el.id !== "list-services"
            ? el
            : {
                ...el,
                items: (el.items ?? []).map((item, i) =>
                  i !== 0
                    ? item
                    : {
                        ...item,
                        elements: item.elements.map((e) =>
                          e.slot === "title"
                            ? { ...e, value: { kind: "text", text: "Corte y barba" } }
                            : e,
                        ),
                      },
                ),
              },
      ),
    };

    const back = applyRevert(edited, listPreset);
    const firstTitle = back.content
      .find((el) => el.id === "list-services")
      ?.items?.[0]?.elements.find((e) => e.slot === "title")?.value;
    expect(firstTitle).toEqual({ kind: "text", text: "Corte y barba" });
  });
});
