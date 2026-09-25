import type { ContentElement, PresetShape, PresetSlot, SectionLayout } from "@retorika/schema";
import { resolvePlacements, type SlotPlacement, unknownVariant } from "./layout.ts";

/**
 * Qué hago — "Servicios o productos en tarjetas" (concept dossier §9).
 *
 * The cards are the items of one `list` element. The list is a single element in its slot;
 * each item carries its own title and description, and the renderer draws every list the
 * same way, so nothing here is specific to how cards look.
 */

export const SERVICES_ID = "services";

export const SERVICES_SLOTS: readonly PresetSlot[] = [
  { slot: "headline", role: "heading", min: 1, max: 1 },
  { slot: "intro", role: "body", min: 0, max: 1 },
  { slot: "services", role: "list", min: 1, max: 1 },
];

/**
 * The shape of one card, and since day 6 the preset's own `itemSlots`. checkAgainstPreset still
 * judges top-level slots only — a card is in a slot of the list, not of the section — so this
 * remains enforced by the catalog's tests and the fixture. Declaring it on the preset is what
 * lets `blankSection` build a card without knowing that this particular section has cards.
 */
export const SERVICES_ITEM_SLOTS: readonly PresetSlot[] = [
  { slot: "title", role: "heading", min: 1, max: 1 },
  { slot: "description", role: "body", min: 0, max: 1 },
];

/**
 * One card is a legitimate answer and is drawn full width already; none means the section is
 * not generated at all, which is the questionnaire's business rather than the catalog's
 * (ADR 0013).
 */
export const SERVICES_ITEMS = { min: 1, max: 6 } as const;

/** The three compositions approved by the CEO (docs/tasks/catalog-que-hago.md). */
export const SERVICES_VARIANTS = ["stacked", "side", "split"] as const;
export type ServicesVariant = (typeof SERVICES_VARIANTS)[number];

/**
 * Pure placements: a composition only decides where the title, the intro and the list sit.
 * The cards inside the list flow by the stylesheet's generic list rule.
 */
const TEMPLATES: Record<ServicesVariant, readonly SlotPlacement[]> = {
  // A — "Tarjetas debajo": title and intro on top, the cards full width underneath.
  stacked: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 1, columnSpan: 8, row: 2, rowSpan: 1 },
    { slot: "services", occurrence: 0, column: 1, columnSpan: 12, row: 3, rowSpan: 1 },
  ],
  // B — "Título a un lado": title and intro in a column on the left, the cards on the right.
  side: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 4, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 1, columnSpan: 4, row: 2, rowSpan: 1 },
    { slot: "services", occurrence: 0, column: 5, columnSpan: 8, row: 1, rowSpan: 2 },
  ],
  // C — "Título e introducción en una fila": both in row 1, the cards full width underneath.
  split: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 5, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 6, columnSpan: 7, row: 1, rowSpan: 1 },
    { slot: "services", occurrence: 0, column: 1, columnSpan: 12, row: 2, rowSpan: 1 },
  ],
};

function isServicesVariant(variantId: string): variantId is ServicesVariant {
  return (SERVICES_VARIANTS as readonly string[]).includes(variantId);
}

export const servicesPreset: PresetShape = {
  catalogId: SERVICES_ID,
  slots: SERVICES_SLOTS,
  itemSlots: SERVICES_ITEM_SLOTS,

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isServicesVariant(variantId)) {
      throw unknownVariant(SERVICES_ID, variantId, SERVICES_VARIANTS);
    }
    return resolvePlacements(TEMPLATES[variantId], elements);
  },
};
