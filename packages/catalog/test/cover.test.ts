import { checkAgainstPreset, parseDocument, type Section, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { COVER_SLOTS, COVER_VARIANTS, coverPreset } from "../src/cover.ts";
import { presetFor, SEARCH_ALIASES } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`]));

function section(content: Section["content"], variantId = "image-right"): Section {
  return {
    id: "section-cover",
    preset: { catalogId: "cover", variantId },
    source: "catalog",
    content,
    layout: null,
  };
}

const headline = {
  id: "el-headline",
  role: "heading" as const,
  hidden: false,
  slot: "headline",
  value: { kind: "text" as const, text: "Tu perro, como nuevo" },
};
const image = {
  id: "el-image",
  role: "image" as const,
  hidden: false,
  slot: "image",
  value: { kind: "image" as const, src: "./photo.jpg", alt: "Perro recién peinado" },
};

describe("the Portada preset", () => {
  it("declares a slot for every role it admits, with cardinality", () => {
    expect(COVER_SLOTS.map((slot) => slot.slot)).toEqual([
      "headline",
      "subheadline",
      "body",
      "image",
      "primaryAction",
      "secondaryAction",
    ]);
    // The dossier's promise: "la promesa del negocio, una foto grande y el botón
    // principal". The headline and the photo are required; everything else is optional.
    expect(COVER_SLOTS.filter((slot) => slot.min > 0).map((slot) => slot.slot)).toEqual([
      "headline",
      "image",
    ]);
  });

  it("accepts a minimal section: a headline and a photo", () => {
    expect(checkAgainstPreset(section([headline, image]), coverPreset)).toEqual([]);
  });

  it("reports a missing required slot rather than tolerating it", () => {
    const violations = checkAgainstPreset(section([headline]), coverPreset);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toMatch(/at least 1/);
  });

  it("accepts a required element that is hidden — hiding is allowed, removing is not", () => {
    const hidden = { ...image, hidden: true };
    expect(checkAgainstPreset(section([headline, hidden]), coverPreset)).toEqual([]);
  });

  it("rejects an element whose role does not match its slot", () => {
    const wrong = { ...image, role: "body" as const };
    const violations = checkAgainstPreset(section([headline, wrong]), coverPreset);
    expect(violations.some((v) => v.rule === 2)).toBe(true);
  });
});

describe("variants", () => {
  it.each(COVER_VARIANTS)("%s places every element the document provides", (variantId) => {
    const layout = coverPreset.layoutFor(variantId, [headline, image]);
    expect(layout.placements.map((p) => p.elementId).sort()).toEqual(["el-headline", "el-image"]);
  });

  it.each(COVER_VARIANTS)("%s keeps every placement inside the twelve columns", (variantId) => {
    const elements = [
      headline,
      image,
      { ...headline, id: "el-sub", role: "subheading" as const, slot: "subheadline" },
      { ...headline, id: "el-body", role: "body" as const, slot: "body" },
      { ...headline, id: "el-cta", role: "button" as const, slot: "primaryAction" },
      { ...headline, id: "el-link-0", role: "link" as const, slot: "secondaryAction" },
      { ...headline, id: "el-link-1", role: "link" as const, slot: "secondaryAction" },
    ];
    for (const placement of coverPreset.layoutFor(variantId, elements).placements) {
      expect(placement.column + placement.columnSpan - 1).toBeLessThanOrEqual(12);
    }
  });

  it("changes composition rather than only colour", () => {
    const elements = [headline, image];
    const a = coverPreset.layoutFor("image-right", elements).placements;
    const b = coverPreset.layoutFor("image-background", elements).placements;
    expect(a).not.toEqual(b);
  });

  it("refuses an unknown variant instead of falling back to a default", () => {
    expect(() => coverPreset.layoutFor("does-not-exist", [headline, image])).toThrow(
      /Unknown variant/,
    );
  });

  it("hands out a fresh layout each time, so one section cannot mutate the catalog", () => {
    const first = coverPreset.layoutFor("image-right", [headline, image]);
    first.placements.length = 0;
    expect(coverPreset.layoutFor("image-right", [headline, image]).placements.length).toBe(2);
  });
});

describe("a document built on the preset", () => {
  it("passes the document rules end to end", () => {
    const doc = {
      schemaVersion: "1.0.0",
      id: "doc-1",
      siteName: "Peluquería Canina Lúa",
      theme,
      pages: [
        { id: "home", slug: "index", title: "Inicio", sections: [section([headline, image])] },
      ],
      collections: [],
    };
    expect(() => parseDocument(doc)).not.toThrow();
  });
});

describe("the catalog", () => {
  it("refuses an unknown section rather than rendering an empty box", () => {
    expect(() => presetFor("opiniones")).toThrow(/Unknown catalog section/);
  });

  it("finds Portada from the word a designer would type", () => {
    expect(SEARCH_ALIASES["cover"]).toContain("hero");
  });

  it("finds Portada from the words a shop owner would type", () => {
    expect(SEARCH_ALIASES["cover"]).toEqual(expect.arrayContaining(["portada", "inicio"]));
  });
});

describe("interface language", () => {
  it("keeps every visible string in the Spanish locale file", () => {
    expect(es["section.cover.name"]).toBe("Portada");
    for (const slot of COVER_SLOTS) {
      expect(es).toHaveProperty(`section.cover.slot.${slot.slot}`);
    }
    for (const variant of COVER_VARIANTS) {
      expect(es).toHaveProperty(`section.cover.variant.${variant}`);
    }
  });
});
