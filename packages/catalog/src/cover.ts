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

export const COVER_VARIANTS = ["image-right", "image-left", "image-background"] as const;
export type CoverVariant = (typeof COVER_VARIANTS)[number];

/**
 * Three compositions, not three colour schemes. The dossier's promise that the generated
 * options "cambian de composición, no solo de color" starts here.
 *
 * All three place the same slots on the same twelve-column grid and differ only in where, so
 * the markup is identical and only the geometry changes.
 *
 * **There were two, and that left the promise half-kept.** `generateVariants` offers three cards
 * and there were only two covers to give them, so `v1` and `v3` both got `image-right`: the
 * biggest, topmost thing on two of the three previews was identical, and they differed only in a
 * services layout further down the card — often below the fold of the preview. David reported it
 * as «dos de las opciones son muy similares o incluso idénticas» on 5 October 2026, and he was
 * describing a set that was one member short rather than a layout gone wrong.
 *
 * `image-left` is the mirror of `image-right` and deliberately nothing more inventive than that:
 * the same slots, the same markup, the same CSS, the photograph on the other side. A composition
 * nobody has to be taught, which is what the third member of this set needed to be — the point is
 * that the three choices read as three at a glance, not that the new one is clever.
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
  // The mirror: photograph on the left, words on the right.
  "image-left": [
    { slot: "image", occurrence: 0, column: 1, columnSpan: 6, row: 1, rowSpan: 4 },
    { slot: "headline", occurrence: 0, column: 7, columnSpan: 6, row: 1, rowSpan: 1 },
    { slot: "subheadline", occurrence: 0, column: 7, columnSpan: 6, row: 2, rowSpan: 1 },
    { slot: "body", occurrence: 0, column: 7, columnSpan: 6, row: 3, rowSpan: 1 },
    { slot: "primaryAction", occurrence: 0, column: 7, columnSpan: 3, row: 4, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 0, column: 10, columnSpan: 3, row: 4, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 1, column: 7, columnSpan: 3, row: 5, rowSpan: 1 },
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
