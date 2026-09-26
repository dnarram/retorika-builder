import {
  checkAgainstPreset,
  flattenElements,
  parseDocument,
  type Section,
  TOKEN_KEYS,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { blankSection, canBeBlank, isPlaceholderText } from "../src/blank.ts";
import { CONTACT_ID } from "../src/contact.ts";
import { COVER_ID } from "../src/cover.ts";
import es from "../src/locales/es.json" with { type: "json" };
import { LOCATION_ID } from "../src/location.ts";
import { CATALOG, presetFor, variantsFor } from "../src/presets.ts";
import { SERVICES_ID, SERVICES_ITEM_SLOTS } from "../src/services.ts";
import { TESTIMONIALS_ID } from "../src/testimonials.ts";

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`]));

function documentWith(section: Section) {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    pages: [{ id: "home", slug: "index", title: "Inicio", sections: [section] }],
    collections: [],
  };
}

/** Every blankable section in every one of its compositions — the pairing the plan's own
 * verification line asks for, rather than one hand-picked example. */
const BLANKABLE = Object.keys(CATALOG).filter((catalogId) => canBeBlank(catalogId));
const EVERY_PAIR = BLANKABLE.flatMap((catalogId) =>
  variantsFor(catalogId).map((variantId) => ({ catalogId, variantId })),
);

describe("canBeBlank", () => {
  it("is true for every section whose required slots are text, an image or a list", () => {
    expect(BLANKABLE).toEqual([COVER_ID, SERVICES_ID, LOCATION_ID, TESTIMONIALS_ID]);
  });

  it("is false for Contacto y reservas, whose required button is a destination", () => {
    expect(canBeBlank(CONTACT_ID)).toBe(false);
  });

  it("throws for a section the catalog does not have, rather than answering false", () => {
    // False would read as "this section cannot be blank", when the truth is that nobody knows
    // what this section is — the same distinction presetFor already refuses to blur.
    expect(() => canBeBlank("seccion-inventada")).toThrow(/Unknown catalog section/);
  });
});

describe("blankSection", () => {
  for (const { catalogId, variantId } of EVERY_PAIR) {
    it(`satisfies its own preset: ${catalogId} / ${variantId}`, () => {
      const section = blankSection(catalogId, variantId, "sec-new");
      expect(checkAgainstPreset(section, presetFor(catalogId))).toEqual([]);
    });

    it(`survives parseDocument: ${catalogId} / ${variantId}`, () => {
      const section = blankSection(catalogId, variantId, "sec-new");
      expect(() => parseDocument(documentWith(section))).not.toThrow();
    });
  }

  it("fills every required slot and leaves every optional one out", () => {
    const section = blankSection(COVER_ID, "image-right", "sec-new");
    // cover requires headline and image; subheadline, body and both actions are optional.
    expect(section.content.map((element) => element.slot)).toEqual(["headline", "image"]);
  });

  it("carries the id it was given, the preset asked for, and no layout of its own", () => {
    const section = blankSection(LOCATION_ID, "split", "sec-location-2");
    expect(section.id).toBe("sec-location-2");
    expect(section.preset).toEqual({ catalogId: LOCATION_ID, variantId: "split" });
    expect(section.source).toBe("catalog");
    expect(section.layout).toBeNull();
  });

  it("never leaves a required text empty, which would publish an empty heading", () => {
    for (const { catalogId, variantId } of EVERY_PAIR) {
      for (const element of flattenElements(
        blankSection(catalogId, variantId, "sec-new").content,
      )) {
        if (element.value?.kind !== "text") continue;
        expect(element.value.text.trim()).not.toBe("");
      }
    }
  });

  it("never hides an element, which would leave a band nobody can click to fill in", () => {
    for (const { catalogId, variantId } of EVERY_PAIR) {
      for (const element of flattenElements(
        blankSection(catalogId, variantId, "sec-new").content,
      )) {
        expect(element.hidden).toBe(false);
      }
    }
  });

  it("keeps element ids unique across the whole section, items included", () => {
    for (const { catalogId, variantId } of EVERY_PAIR) {
      const elements = flattenElements(blankSection(catalogId, variantId, "sec-new").content);
      expect(new Set(elements.map((element) => element.id)).size).toBe(elements.length);
    }
  });

  it("gives a list exactly one item, filling that item's own required slots", () => {
    const section = blankSection(SERVICES_ID, "stacked", "sec-new");
    const list = section.content.find((element) => element.role === "list");
    expect(list?.items).toHaveLength(1);
    const required = SERVICES_ITEM_SLOTS.filter((slot) => slot.min > 0).map((slot) => slot.slot);
    expect(list?.items?.[0]?.elements.map((element) => element.slot)).toEqual(required);
  });

  it("marks every text it invents as a marker, so the editor can warn about it", () => {
    for (const { catalogId, variantId } of EVERY_PAIR) {
      for (const element of flattenElements(
        blankSection(catalogId, variantId, "sec-new").content,
      )) {
        if (element.value?.kind !== "text") continue;
        expect(isPlaceholderText(element.value.text)).toBe(true);
      }
    }
  });

  it("refuses Contacto y reservas rather than inventing a destination for its button", () => {
    expect(() => blankSection(CONTACT_ID, "stacked", "sec-new")).toThrow(
      /no marker can fill honestly/,
    );
  });

  it("refuses a variant the section does not have", () => {
    expect(() => blankSection(COVER_ID, "image-left", "sec-new")).toThrow(/has no variant/);
  });

  it("refuses a section the catalog does not have", () => {
    expect(() => blankSection("seccion-inventada", "stacked", "sec-new")).toThrow(
      /Unknown catalog section/,
    );
  });
});

describe("isPlaceholderText", () => {
  it("recognises a marker from the catalog's own locale", () => {
    expect(isPlaceholderText(es["section.cover.placeholder.headline"])).toBe(true);
  });

  it("ignores surrounding whitespace, which a contentEditable blur trims anyway", () => {
    expect(isPlaceholderText(`  ${es["section.location.placeholder.address"]}  `)).toBe(true);
  });

  it("is false for anything the owner actually wrote", () => {
    expect(isPlaceholderText("Barbería El Corte")).toBe(false);
    expect(isPlaceholderText("")).toBe(false);
  });

  it("is false for the placeholder photo's alt text, which every generated site already has", () => {
    // Counting it would make a freshly generated document warn about marker text before the
    // user has added anything at all — the warning is about text they are expected to replace.
    expect(isPlaceholderText("Marcador de foto: aquí irá tu foto")).toBe(false);
  });
});
