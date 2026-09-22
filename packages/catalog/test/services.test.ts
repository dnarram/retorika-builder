import { type ContentElement, checkAgainstPreset, type Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { presetFor, SEARCH_ALIASES } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };
import {
  SERVICES_ITEM_SLOTS,
  SERVICES_ITEMS,
  SERVICES_SLOTS,
  SERVICES_VARIANTS,
  servicesPreset,
} from "../src/services.ts";

const headline: ContentElement = {
  id: "el-headline",
  role: "heading",
  hidden: false,
  slot: "headline",
  value: { kind: "text", text: "Qué hacemos" },
};
const intro: ContentElement = {
  id: "el-intro",
  role: "body",
  hidden: false,
  slot: "intro",
  value: { kind: "text", text: "Cortes, arreglos de barba y color." },
};

function card(n: number): { id: string; elements: ContentElement[] } {
  return {
    id: `item-${n}`,
    elements: [
      {
        id: `el-card-${n}-title`,
        role: "heading",
        hidden: false,
        slot: "title",
        value: { kind: "text", text: `Servicio ${n}` },
      },
      {
        id: `el-card-${n}-description`,
        role: "body",
        hidden: false,
        slot: "description",
        value: { kind: "text", text: `Descripción ${n}` },
      },
    ],
  };
}

const list: ContentElement = {
  id: "el-services",
  role: "list",
  hidden: false,
  slot: "services",
  items: [1, 2, 3, 4].map(card),
};

function section(content: ContentElement[], variantId = "stacked"): Section {
  return {
    id: "sec-services",
    preset: { catalogId: "services", variantId },
    source: "catalog",
    content,
    layout: null,
  };
}

describe("the Qué hago preset", () => {
  it("declares its slots with cardinality: a title, an optional intro, and one list", () => {
    expect(SERVICES_SLOTS).toEqual([
      { slot: "headline", role: "heading", min: 1, max: 1 },
      { slot: "intro", role: "body", min: 0, max: 1 },
      { slot: "services", role: "list", min: 1, max: 1 },
    ]);
  });

  it("declares the shape of a card: a title and an optional description", () => {
    expect(SERVICES_ITEM_SLOTS).toEqual([
      { slot: "title", role: "heading", min: 1, max: 1 },
      { slot: "description", role: "body", min: 0, max: 1 },
    ]);
    expect(SERVICES_ITEMS).toEqual({ min: 2, max: 6 });
  });

  it("is registered in the catalog", () => {
    expect(presetFor("services")).toBe(servicesPreset);
  });

  it("accepts a section with a title, an intro and a list of cards", () => {
    expect(checkAgainstPreset(section([headline, intro, list]), servicesPreset)).toEqual([]);
  });

  it("reports a missing list rather than tolerating it", () => {
    const violations = checkAgainstPreset(section([headline, intro]), servicesPreset);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.path).toBe("section#sec-services.slot:services");
  });
});

describe("compositions", () => {
  it("are the three approved by the CEO", () => {
    expect(SERVICES_VARIANTS).toEqual(["stacked", "side", "split"]);
  });

  it.each(SERVICES_VARIANTS)("%s places every element the document provides", (variantId) => {
    const layout = servicesPreset.layoutFor(variantId, [headline, intro, list]);
    expect(layout.placements.map((p) => p.elementId).sort()).toEqual([
      "el-headline",
      "el-intro",
      "el-services",
    ]);
  });

  it.each(SERVICES_VARIANTS)("%s keeps every placement inside the twelve columns", (variantId) => {
    for (const placement of servicesPreset.layoutFor(variantId, [headline, intro, list])
      .placements) {
      expect(placement.column + placement.columnSpan - 1).toBeLessThanOrEqual(12);
    }
  });

  it("differ in geometry, pairwise", () => {
    const layouts = SERVICES_VARIANTS.map(
      (variantId) => servicesPreset.layoutFor(variantId, [headline, intro, list]).placements,
    );
    for (let i = 0; i < layouts.length; i += 1) {
      for (let j = i + 1; j < layouts.length; j += 1) {
        expect(layouts[i], `${SERVICES_VARIANTS[i]} vs ${SERVICES_VARIANTS[j]}`).not.toEqual(
          layouts[j],
        );
      }
    }
  });

  it("place the list only, never the elements inside its items", () => {
    const ids = servicesPreset
      .layoutFor("stacked", [headline, intro, list])
      .placements.map((p) => p.elementId);
    expect(ids.some((id) => id.startsWith("el-card-"))).toBe(false);
  });

  it("refuse an unknown variant instead of falling back to a default", () => {
    expect(() => servicesPreset.layoutFor("image-right", [headline, list])).toThrow(
      /Unknown variant/,
    );
  });
});

describe("search", () => {
  it("finds Qué hago from the words a shop owner would type", () => {
    expect(SEARCH_ALIASES["services"]).toEqual(
      expect.arrayContaining(["qué hago", "servicios", "productos", "tarjetas", "carta"]),
    );
  });
});

describe("interface language", () => {
  it("keeps every visible string in the Spanish locale file", () => {
    expect(es["section.services.name"]).toBe("Qué hago");
    for (const slot of SERVICES_SLOTS) {
      expect(es).toHaveProperty([`section.services.slot.${slot.slot}`]);
    }
    for (const slot of SERVICES_ITEM_SLOTS) {
      expect(es).toHaveProperty([`section.services.item.${slot.slot}`]);
    }
    for (const variant of SERVICES_VARIANTS) {
      expect(es).toHaveProperty([`section.services.variant.${variant}`]);
    }
  });
});
