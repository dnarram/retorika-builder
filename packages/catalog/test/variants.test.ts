import type { ContentElement, PresetSlot } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { CATALOG, presetFor, variantsFor } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * What makes changing a section's composition safe: **every variant of a section places every
 * element that section can hold.**
 *
 * This is the property the editor's sixth action button rests on, and it is asserted rather than
 * assumed because the failure it rules out is silent. `resolvePlacements` maps a preset's declared
 * geometry onto the elements a document provides, and an element whose slot occurrence the
 * composition never declares simply gets no placement — `build.ts` still emits it, so nothing is
 * lost, but it carries no `grid-area` and lands wherever CSS auto-placement puts it. On a published
 * page that reads as a rendering fault, not as a choice.
 *
 * Nothing in the type system prevents a composition from placing fewer occurrences than its own
 * preset admits: the geometry tables are hand-written per variant, and a slot forgotten in one of
 * them costs nothing at compile time. This is where that gets caught.
 */

/** A value whose kind suits the role, so the section is one the presets would accept. */
function valueFor(slot: PresetSlot, index: number) {
  switch (slot.role) {
    case "image":
      return { kind: "image" as const, src: `a-${index}.svg`, alt: "Foto" };
    case "button":
    case "link":
      return { kind: "link" as const, text: `Acción ${index}`, href: "#" };
    default:
      return { kind: "text" as const, text: `Texto ${index}` };
  }
}

/** Every slot filled to its maximum — the hardest case for a composition to draw, and the one
 * where a table missing an occurrence shows up. */
function saturate(catalogId: string): ContentElement[] {
  return presetFor(catalogId).slots.flatMap((slot) =>
    Array.from({ length: slot.max ?? 1 }, (_unused, index) => ({
      id: `el-${slot.slot}-${index}`,
      role: slot.role,
      hidden: false,
      slot: slot.slot,
      value: valueFor(slot, index),
    })),
  );
}

/** Only the required slots, once each — a section as it is born. */
function minimal(catalogId: string): ContentElement[] {
  return presetFor(catalogId)
    .slots.filter((slot) => slot.min > 0)
    .map((slot) => ({
      id: `el-${slot.slot}-0`,
      role: slot.role,
      hidden: false,
      slot: slot.slot,
      value: valueFor(slot, 0),
    }));
}

const catalogIds = Object.keys(CATALOG).sort();

describe("every composition can draw everything its section holds", () => {
  it.each(catalogIds)("%s, filled to the maximum", (catalogId) => {
    const elements = saturate(catalogId);
    const preset = presetFor(catalogId);
    for (const variantId of variantsFor(catalogId)) {
      const placed = preset.layoutFor(variantId, elements).placements;
      expect(placed.map((p) => p.elementId).sort(), `${catalogId}/${variantId}`).toEqual(
        elements.map((el) => el.id).sort(),
      );
    }
  });

  it.each(catalogIds)("%s, as it is born", (catalogId) => {
    const elements = minimal(catalogId);
    const preset = presetFor(catalogId);
    for (const variantId of variantsFor(catalogId)) {
      expect(
        preset.layoutFor(variantId, elements).placements,
        `${catalogId}/${variantId}`,
      ).toHaveLength(elements.length);
    }
  });

  it.each(catalogIds)("%s places the same count in every composition", (catalogId) => {
    // The claim restated as the editor sees it: switching composition never changes how much of
    // the section is positioned, only where. Two variants disagreeing here is the defect.
    const elements = saturate(catalogId);
    const preset = presetFor(catalogId);
    const counts = variantsFor(catalogId).map(
      (variantId) => preset.layoutFor(variantId, elements).placements.length,
    );
    expect(new Set(counts).size, `${catalogId}: ${counts.join(", ")}`).toBe(1);
  });
});

describe("what the editor needs in order to offer the choice", () => {
  it("gives every section at least two compositions, or the button would have nothing to do", () => {
    // Not a law of the catalog — a section with one composition is legal — but it is why the
    // editor asks `variantsFor(...).length > 1` before drawing the button rather than assuming.
    for (const catalogId of catalogIds) {
      expect(variantsFor(catalogId).length, catalogId).toBeGreaterThanOrEqual(2);
    }
  });

  it("names every composition in Spanish, since the menu shows names and not ids", () => {
    for (const catalogId of catalogIds) {
      for (const variantId of variantsFor(catalogId)) {
        const key = `section.${catalogId}.variant.${variantId}`;
        expect(es, key).toHaveProperty([key]);
        expect(es[key as keyof typeof es], key).toBeTruthy();
      }
    }
  });

  it("names them by what they look like, not by where the slots sit", () => {
    // «Foto a la derecha» is something an owner can picture before clicking; «image-right» is
    // the id. Spot-checked on the two that are easiest to get wrong.
    expect(es["section.cover.variant.image-background"]).toBe("Foto de fondo");
    expect(es["section.location.variant.split"]).toBe("En dos columnas");
  });
});
