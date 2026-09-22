import { describe, expect, it } from "vitest";
import {
  type ContentElement,
  checkAgainstPreset,
  type PresetShape,
  type Section,
} from "../src/index.ts";

/**
 * checkAgainstPreset judges a list as one element in its slot.
 *
 * A preset declares top-level slots; the elements inside a list's items belong to the list,
 * not to the section. Before this change the check walked `flattenElements(section.content)`,
 * so every visible card title and description was reported as filling a slot the preset does
 * not declare — the same defect step 1 of the "Qué hago" task fixed in revert.ts.
 *
 * The preset is declared here rather than taken from @retorika/catalog: the schema package
 * does not depend on the catalog.
 */

const listPreset: PresetShape = {
  catalogId: "list-fixture",
  slots: [
    { slot: "headline", role: "heading", min: 1, max: 1 },
    { slot: "services", role: "list", min: 1, max: 1 },
  ],
  layoutFor() {
    return { grid: { columns: 12 }, placements: [], breakpoints: { tablet: [], mobile: [] } };
  },
};

const headline: ContentElement = {
  id: "el-headline",
  role: "heading",
  hidden: false,
  slot: "headline",
  value: { kind: "text", text: "Qué hacemos" },
};

function list(id: string, hidden = false): ContentElement {
  return {
    id,
    role: "list",
    hidden,
    slot: "services",
    items: [1, 2].map((n) => ({
      id: `${id}-item-${n}`,
      elements: [
        {
          id: `${id}-title-${n}`,
          role: "heading",
          hidden: false,
          slot: "title",
          value: { kind: "text", text: `Servicio ${n}` },
        },
        {
          id: `${id}-description-${n}`,
          role: "body",
          hidden: false,
          slot: "description",
          value: { kind: "text", text: `Descripción ${n}` },
        },
      ],
    })),
  };
}

function section(content: ContentElement[]): Section {
  return {
    id: "sec-services",
    preset: { catalogId: "list-fixture", variantId: "any" },
    source: "catalog",
    content,
    layout: null,
  };
}

describe("checkAgainstPreset with lists", () => {
  it("does not judge the elements inside a list's items against the section's slots", () => {
    expect(checkAgainstPreset(section([headline, list("el-list")]), listPreset)).toEqual([]);
  });

  it("counts a hidden list as present in its 1..1 slot", () => {
    expect(checkAgainstPreset(section([headline, list("el-list", true)]), listPreset)).toEqual([]);
  });

  it("reports a second visible list once, not item by item", () => {
    const violations = checkAgainstPreset(
      section([headline, list("el-list"), list("el-list-2")]),
      listPreset,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.path).toBe("section#sec-services.slot:services");
    expect(violations[0]?.message).toMatch(/at most 1/);
  });
});
