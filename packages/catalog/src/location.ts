import type { ContentElement, PresetShape, PresetSlot, SectionLayout } from "@retorika/schema";
import { resolvePlacements, type SlotPlacement, unknownVariant } from "./layout.ts";

/**
 * Horario y ubicación — "Mapa, dirección y horas de apertura" (concept dossier §9).
 *
 * What question 4 of the questionnaire fills (ADR 0010): the address, the opening hours if the
 * owner wants to give them, and the map. A business with no premises skips the question and
 * gets no section.
 */

export const LOCATION_ID = "location";

export const LOCATION_SLOTS: readonly PresetSlot[] = [
  { slot: "headline", role: "heading", min: 1, max: 1 },
  { slot: "address", role: "body", min: 1, max: 1 },
  { slot: "hours", role: "body", min: 0, max: 1 },
  { slot: "map", role: "map", min: 0, max: 1 },
];

export const LOCATION_VARIANTS = ["stacked", "split"] as const;
export type LocationVariant = (typeof LOCATION_VARIANTS)[number];

/**
 * Pure placements, like every other preset: what changes between the two is where the four
 * slots sit, never what they are.
 *
 * The map is a link until ADR 0004's other half exists — a static image needs tiles from a
 * provider, with a licence — so neither composition reserves a picture's worth of space for it.
 */
const TEMPLATES: Record<LocationVariant, readonly SlotPlacement[]> = {
  // Everything in one column: the plainest reading order, and the one that survives a long
  // address without help.
  stacked: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
    { slot: "address", occurrence: 0, column: 1, columnSpan: 8, row: 2, rowSpan: 1 },
    { slot: "hours", occurrence: 0, column: 1, columnSpan: 8, row: 3, rowSpan: 1 },
    { slot: "map", occurrence: 0, column: 1, columnSpan: 8, row: 4, rowSpan: 1 },
  ],
  // Two columns: where you are on the left, when you are open on the right.
  split: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 6, row: 1, rowSpan: 1 },
    { slot: "address", occurrence: 0, column: 1, columnSpan: 6, row: 2, rowSpan: 1 },
    { slot: "hours", occurrence: 0, column: 7, columnSpan: 6, row: 2, rowSpan: 1 },
    { slot: "map", occurrence: 0, column: 7, columnSpan: 6, row: 3, rowSpan: 1 },
  ],
};

function isLocationVariant(variantId: string): variantId is LocationVariant {
  return (LOCATION_VARIANTS as readonly string[]).includes(variantId);
}

export const locationPreset: PresetShape = {
  catalogId: LOCATION_ID,
  slots: LOCATION_SLOTS,

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isLocationVariant(variantId)) {
      throw unknownVariant(LOCATION_ID, variantId, LOCATION_VARIANTS);
    }
    return resolvePlacements(TEMPLATES[variantId], elements);
  },
};
