import { type ContentElement, checkAgainstPreset, type Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { blankSection } from "../src/blank.ts";
import { presetFor, SEARCH_ALIASES } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };
import {
  TESTIMONIALS_ID,
  TESTIMONIALS_ITEM_SLOTS,
  TESTIMONIALS_SLOTS,
  TESTIMONIALS_VARIANTS,
  testimonialsPreset,
} from "../src/testimonials.ts";

const headline: ContentElement = {
  id: "el-headline",
  role: "heading",
  hidden: false,
  slot: "headline",
  value: { kind: "text", text: "Lo que dicen de nosotros" },
};
const intro: ContentElement = {
  id: "el-intro",
  role: "body",
  hidden: false,
  slot: "intro",
  value: { kind: "text", text: "Opiniones de clientes de los últimos meses." },
};

function opinion(n: number): { id: string; elements: ContentElement[] } {
  return {
    id: `item-${n}`,
    elements: [
      {
        id: `el-opinion-${n}-author`,
        role: "heading",
        hidden: false,
        slot: "author",
        value: { kind: "text", text: `Cliente ${n}` },
      },
      {
        id: `el-opinion-${n}-quote`,
        role: "body",
        hidden: false,
        slot: "quote",
        value: { kind: "text", text: `Opinión ${n}` },
      },
    ],
  };
}

const list: ContentElement = {
  id: "el-opinions",
  role: "list",
  hidden: false,
  slot: "opinions",
  items: [opinion(1), opinion(2)],
};

function section(content: ContentElement[], variantId = "stacked"): Section {
  return {
    id: "sec-testimonials",
    preset: { catalogId: TESTIMONIALS_ID, variantId },
    source: "catalog",
    content,
    layout: null,
  };
}

describe("the Opiniones preset", () => {
  it("declares its slots with cardinality: a title, an optional intro, and one list", () => {
    expect(TESTIMONIALS_SLOTS).toEqual([
      { slot: "headline", role: "heading", min: 1, max: 1 },
      { slot: "intro", role: "body", min: 0, max: 1 },
      { slot: "opinions", role: "list", min: 1, max: 1 },
    ]);
  });

  it("declares the shape of one opinion: who said it and what they said, both required", () => {
    // `author` is required on purpose: an unattributed quote is not a testimonial, it is a
    // sentence the business wrote about itself. An owner whose customer does not want to be
    // named hides the element — rule 3 allows hiding and forbids removing.
    expect(TESTIMONIALS_ITEM_SLOTS).toEqual([
      { slot: "author", role: "heading", min: 1, max: 1 },
      { slot: "quote", role: "body", min: 1, max: 1 },
    ]);
  });

  it("is registered in the catalog", () => {
    expect(presetFor(TESTIMONIALS_ID)).toBe(testimonialsPreset);
  });

  it("accepts a section with a title, an intro and a list of opinions", () => {
    expect(checkAgainstPreset(section([headline, intro, list]), testimonialsPreset)).toEqual([]);
  });

  it("accepts a section with no intro, which is optional", () => {
    expect(checkAgainstPreset(section([headline, list]), testimonialsPreset)).toEqual([]);
  });

  it("reports a missing list rather than tolerating it", () => {
    const violations = checkAgainstPreset(section([headline]), testimonialsPreset);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toMatch(/at least 1/);
  });

  it("counts a hidden author towards the minimum, so an anonymous quote stays valid", () => {
    const anonymous: ContentElement = {
      ...list,
      items: [
        {
          id: "item-1",
          elements: opinion(1).elements.map((element) =>
            element.slot === "author" ? { ...element, hidden: true } : element,
          ),
        },
      ],
    };
    // checkAgainstPreset judges top-level slots, so this asserts the section stays whole; the
    // item's own rule is the one TESTIMONIALS_ITEM_SLOTS declares and this fixture honours.
    expect(checkAgainstPreset(section([headline, anonymous]), testimonialsPreset)).toEqual([]);
  });
});

describe("compositions", () => {
  it("are the two this section ships with", () => {
    expect(TESTIMONIALS_VARIANTS).toEqual(["stacked", "side"]);
  });

  it.each(TESTIMONIALS_VARIANTS)("%s places every element the document provides", (variantId) => {
    const layout = testimonialsPreset.layoutFor(variantId, [headline, intro, list]);
    expect(layout.placements.map((p) => p.elementId).sort()).toEqual([
      "el-headline",
      "el-intro",
      "el-opinions",
    ]);
  });

  it.each(TESTIMONIALS_VARIANTS)("%s keeps every placement inside the twelve columns", (id) => {
    for (const placement of testimonialsPreset.layoutFor(id, [headline, intro, list]).placements) {
      expect(placement.column + placement.columnSpan - 1).toBeLessThanOrEqual(12);
    }
  });

  it("differ in geometry", () => {
    const [first, second] = TESTIMONIALS_VARIANTS.map(
      (variantId) => testimonialsPreset.layoutFor(variantId, [headline, intro, list]).placements,
    );
    expect(first).not.toEqual(second);
  });

  it("place the list only, never the elements inside its items", () => {
    const ids = testimonialsPreset
      .layoutFor("stacked", [headline, intro, list])
      .placements.map((p) => p.elementId);
    expect(ids.some((id) => id.startsWith("el-opinion-"))).toBe(false);
  });

  it("refuse an unknown variant instead of falling back to a default", () => {
    expect(() => testimonialsPreset.layoutFor("split", [headline, list])).toThrow(
      /Unknown variant/,
    );
  });
});

describe("added, never generated", () => {
  it("can be born blank, which is the only way it ever appears", () => {
    // No question of the five can ask for a review — a review is not the owner's to write — so
    // the generator never produces this section and the pill is its only door in.
    const blank = blankSection(TESTIMONIALS_ID, "stacked", "sec-new");
    expect(checkAgainstPreset(blank, testimonialsPreset)).toEqual([]);
  });

  it("is born with one opinion, carrying both of an opinion's required slots", () => {
    const blank = blankSection(TESTIMONIALS_ID, "stacked", "sec-new");
    const opinions = blank.content.find((element) => element.role === "list");
    expect(opinions?.items).toHaveLength(1);
    expect(opinions?.items?.[0]?.elements.map((element) => element.slot)).toEqual([
      "author",
      "quote",
    ]);
  });

  it("never invents a quote a customer might plausibly have said", () => {
    // The point of the whole section. A marker reading "Me atendieron fenomenal" would, on a
    // site downloaded and published unedited, be a fabricated review on a real business's page.
    // Every marker here is an instruction addressed to the owner, and says so.
    for (const key of ["item.author", "item.quote", "headline"] as const) {
      const text = es[`section.testimonials.placeholder.${key}` as keyof typeof es];
      expect(text).toMatch(/^Escribe aquí /);
    }
  });
});

describe("search", () => {
  it("finds Opiniones from the words a business owner would type", () => {
    expect(SEARCH_ALIASES["testimonials"]).toEqual(
      expect.arrayContaining(["opiniones", "reseñas", "testimonios", "valoraciones"]),
    );
  });
});

describe("interface language", () => {
  it("keeps every visible string in the Spanish locale file", () => {
    expect(es["section.testimonials.name"]).toBe("Opiniones");
    expect(es["section.testimonials.description"]).toBeTruthy();
    for (const slot of TESTIMONIALS_SLOTS) {
      expect(es).toHaveProperty([`section.testimonials.slot.${slot.slot}`]);
    }
    for (const slot of TESTIMONIALS_ITEM_SLOTS) {
      expect(es).toHaveProperty([`section.testimonials.item.${slot.slot}`]);
    }
    for (const variant of TESTIMONIALS_VARIANTS) {
      expect(es).toHaveProperty([`section.testimonials.variant.${variant}`]);
    }
  });
});
