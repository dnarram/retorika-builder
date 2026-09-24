import { type ContentElement, checkAgainstPreset, type Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { presetFor, SEARCH_ALIASES } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };
import { LOCATION_SLOTS, LOCATION_VARIANTS, locationPreset } from "../src/location.ts";

const headline: ContentElement = {
  id: "el-headline",
  role: "heading",
  hidden: false,
  slot: "headline",
  value: { kind: "text", text: "Dónde estamos" },
};
const address: ContentElement = {
  id: "el-address",
  role: "body",
  hidden: false,
  slot: "address",
  value: { kind: "text", text: "Calle Espinel 24, Ronda (Málaga)." },
};
const hours: ContentElement = {
  id: "el-hours",
  role: "body",
  hidden: false,
  slot: "hours",
  value: { kind: "text", text: "De martes a sábado, de 10:00 a 20:00." },
};
const map: ContentElement = {
  id: "el-map",
  role: "map",
  hidden: false,
  slot: "map",
  value: { kind: "map", label: "Ver en el mapa", latitude: 36.7419, longitude: -5.1673 },
};

function section(content: ContentElement[], variantId = "stacked"): Section {
  return {
    id: "sec-location",
    preset: { catalogId: "location", variantId },
    source: "catalog",
    content,
    layout: null,
  };
}

describe("the Horario y ubicación preset", () => {
  it("declares its slots with cardinality: a title and an address, the rest optional", () => {
    expect(LOCATION_SLOTS).toEqual([
      { slot: "headline", role: "heading", min: 1, max: 1 },
      { slot: "address", role: "body", min: 1, max: 1 },
      { slot: "hours", role: "body", min: 0, max: 1 },
      { slot: "map", role: "map", min: 0, max: 1 },
    ]);
  });

  it("is registered in the catalog", () => {
    expect(presetFor("location")).toBe(locationPreset);
  });

  it("accepts a section with everything the questionnaire can give it", () => {
    expect(checkAgainstPreset(section([headline, address, hours, map]), locationPreset)).toEqual(
      [],
    );
  });

  it("accepts a section with no hours: the questionnaire does not insist on them", () => {
    expect(checkAgainstPreset(section([headline, address, map]), locationPreset)).toEqual([]);
  });

  it("reports a missing address rather than publishing a section that says nowhere", () => {
    const violations = checkAgainstPreset(section([headline, map]), locationPreset);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.path).toBe("section#sec-location.slot:address");
  });
});

describe("compositions", () => {
  it("are the two the dossier asks for, at least", () => {
    expect(LOCATION_VARIANTS).toEqual(["stacked", "split"]);
  });

  it.each(LOCATION_VARIANTS)("%s places every element the document provides", (variantId) => {
    const layout = locationPreset.layoutFor(variantId, [headline, address, hours, map]);
    expect(layout.placements.map((p) => p.elementId).sort()).toEqual([
      "el-address",
      "el-headline",
      "el-hours",
      "el-map",
    ]);
  });

  it.each(LOCATION_VARIANTS)("%s leaves an absent optional slot unplaced", (variantId) => {
    const layout = locationPreset.layoutFor(variantId, [headline, address]);
    expect(layout.placements.map((p) => p.elementId).sort()).toEqual(["el-address", "el-headline"]);
  });

  it.each(LOCATION_VARIANTS)("%s keeps every placement inside the twelve columns", (variantId) => {
    for (const placement of locationPreset.layoutFor(variantId, [headline, address, hours, map])
      .placements) {
      expect(placement.column + placement.columnSpan - 1).toBeLessThanOrEqual(12);
    }
  });

  it("differ in geometry", () => {
    const elements = [headline, address, hours, map];
    expect(locationPreset.layoutFor("stacked", elements).placements).not.toEqual(
      locationPreset.layoutFor("split", elements).placements,
    );
  });

  it("refuse an unknown variant instead of falling back to a default", () => {
    expect(() => locationPreset.layoutFor("image-right", [headline, address])).toThrow(
      /Unknown variant/,
    );
  });
});

describe("search", () => {
  it("finds it from the words a shop owner would type", () => {
    expect(SEARCH_ALIASES["location"]).toEqual(
      expect.arrayContaining(["horario", "dónde estamos", "cómo llegar", "mapa"]),
    );
  });
});

describe("interface language", () => {
  it("keeps every visible string in the Spanish locale file", () => {
    expect(es["section.location.name"]).toBe("Horario y ubicación");
    for (const slot of LOCATION_SLOTS) {
      expect(es).toHaveProperty([`section.location.slot.${slot.slot}`]);
    }
    for (const variant of LOCATION_VARIANTS) {
      expect(es).toHaveProperty([`section.location.variant.${variant}`]);
    }
  });
});
