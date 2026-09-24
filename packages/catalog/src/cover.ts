import type { ContentElement, PresetShape, PresetSlot, SectionLayout } from "@retorika/schema";
import { resolvePlacements, type SlotPlacement, unknownVariant } from "./layout.ts";

/**
 * Portada — "La promesa del negocio, una foto grande y el botón principal."
 *
 * Sections are named by what they do rather than by a technical name, which is why the
 * catalog id is `cover` and the visible name lives in the locale file. The search
 * aliases are what let someone typing "hero" find it anyway (concept dossier §9).
 */

export const COVER_ID = "cover";

/**
 * The slots, with the cardinality that makes reverting predictable: the advanced
 * dossier §5 requires each catalog section to declare how many elements of each role it
 * admits, so what does not fit is known in advance rather than discovered afterwards.
 */
export const COVER_SLOTS: readonly PresetSlot[] = [
  { slot: "headline", role: "heading", min: 1, max: 1 },
  { slot: "subheadline", role: "subheading", min: 0, max: 1 },
  { slot: "body", role: "body", min: 0, max: 1 },
  { slot: "image", role: "image", min: 1, max: 1 },
  { slot: "primaryAction", role: "button", min: 0, max: 1 },
  { slot: "secondaryAction", role: "link", min: 0, max: 2 },
];

export const COVER_VARIANTS = ["image-right", "image-background"] as const;
export type CoverVariant = (typeof COVER_VARIANTS)[number];

/**
 * Two compositions, not two colour schemes. The dossier's promise that the generated
 * options "cambian de composición, no solo de color" starts here.
 *
 * Both place the same slots on the same twelve-column grid and differ only in where, so
 * the markup is identical and only the geometry changes.
 */
const TEMPLATES: Record<CoverVariant, readonly SlotPlacement[]> = {
  "image-right": [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 6, row: 1, rowSpan: 1 },
    { slot: "subheadline", occurrence: 0, column: 1, columnSpan: 6, row: 2, rowSpan: 1 },
    { slot: "body", occurrence: 0, column: 1, columnSpan: 6, row: 3, rowSpan: 1 },
    { slot: "primaryAction", occurrence: 0, column: 1, columnSpan: 3, row: 4, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 0, column: 4, columnSpan: 3, row: 4, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 1, column: 1, columnSpan: 3, row: 5, rowSpan: 1 },
    { slot: "image", occurrence: 0, column: 7, columnSpan: 6, row: 1, rowSpan: 4 },
  ],
  "image-background": [
    { slot: "image", occurrence: 0, column: 1, columnSpan: 12, row: 1, rowSpan: 5 },
    { slot: "headline", occurrence: 0, column: 2, columnSpan: 8, row: 2, rowSpan: 1 },
    { slot: "subheadline", occurrence: 0, column: 2, columnSpan: 8, row: 3, rowSpan: 1 },
    { slot: "body", occurrence: 0, column: 2, columnSpan: 8, row: 4, rowSpan: 1 },
    { slot: "primaryAction", occurrence: 0, column: 2, columnSpan: 3, row: 5, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 0, column: 5, columnSpan: 3, row: 5, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 1, column: 8, columnSpan: 3, row: 5, rowSpan: 1 },
  ],
};

function isCoverVariant(variantId: string): variantId is CoverVariant {
  return (COVER_VARIANTS as readonly string[]).includes(variantId);
}

export const coverPreset: PresetShape = {
  catalogId: COVER_ID,
  slots: COVER_SLOTS,

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isCoverVariant(variantId)) throw unknownVariant(COVER_ID, variantId, COVER_VARIANTS);
    return resolvePlacements(TEMPLATES[variantId], elements);
  },
};
