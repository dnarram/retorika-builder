import type { ContentElement, PresetShape, PresetSlot, SectionLayout } from "@retorika/schema";
import { resolvePlacements, type SlotPlacement, unknownVariant } from "./layout.ts";

/**
 * Pie de página — who this site belongs to.
 *
 * The sixth catalog section, and the first that carries the owner's own identifying details:
 * their name, their tax number, where they are registered, an address to write to. ADR 0019
 * decides the shape of that, and the shape is the decision — **offered, never required.**
 *
 * Which is why only `businessName` is 1..1, and it comes from question 1, the one answer the
 * questionnaire insists on. Everything else starts absent and is filled through the editor's
 * field panel, or not at all. An owner who leaves them empty gets a warning in the editor and a
 * ZIP that downloads perfectly.
 *
 * **No slot here holds a link, deliberately.** A footer says who you are; the contact section is
 * where a visitor acts. It is also what makes "warns and never blocks" true rather than nearly
 * true — the download refuses for exactly one thing, a destination that goes nowhere, and a
 * section with no destinations in it has nothing to refuse.
 */

export const FOOTER_ID = "footer";

export const FOOTER_SLOTS: readonly PresetSlot[] = [
  { slot: "businessName", role: "body", min: 1, max: 1 },
  { slot: "owner", role: "body", min: 0, max: 1 },
  { slot: "taxId", role: "body", min: 0, max: 1 },
  { slot: "address", role: "body", min: 0, max: 1 },
  { slot: "email", role: "body", min: 0, max: 1 },
];

/** The four that ADR 0019 is about: what a business website conventionally says about its owner,
 * and what the editor warns about when every one of them is empty. `businessName` is not among
 * them — it is always there, and warning about it would be warning about question 1. */
export const FOOTER_IDENTITY_SLOTS: readonly string[] = ["owner", "taxId", "address", "email"];

export const FOOTER_VARIANTS = ["stacked", "inline"] as const;
export type FooterVariant = (typeof FOOTER_VARIANTS)[number];

/**
 * Two compositions, and both keep the details together as a block rather than spreading them
 * across the page: they are read as one statement or not at all.
 */
const TEMPLATES: Record<FooterVariant, readonly SlotPlacement[]> = {
  // The name on its own line, the details under it. The plainest, and the one that survives a
  // long registered address without help.
  stacked: [
    { slot: "businessName", occurrence: 0, column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
    { slot: "owner", occurrence: 0, column: 1, columnSpan: 12, row: 2, rowSpan: 1 },
    { slot: "taxId", occurrence: 0, column: 1, columnSpan: 12, row: 3, rowSpan: 1 },
    { slot: "address", occurrence: 0, column: 1, columnSpan: 12, row: 4, rowSpan: 1 },
    { slot: "email", occurrence: 0, column: 1, columnSpan: 12, row: 5, rowSpan: 1 },
  ],
  // The name on the left, the details on the right.
  inline: [
    { slot: "businessName", occurrence: 0, column: 1, columnSpan: 5, row: 1, rowSpan: 1 },
    { slot: "owner", occurrence: 0, column: 6, columnSpan: 7, row: 1, rowSpan: 1 },
    { slot: "taxId", occurrence: 0, column: 6, columnSpan: 7, row: 2, rowSpan: 1 },
    { slot: "address", occurrence: 0, column: 6, columnSpan: 7, row: 3, rowSpan: 1 },
    { slot: "email", occurrence: 0, column: 6, columnSpan: 7, row: 4, rowSpan: 1 },
  ],
};

function isFooterVariant(variantId: string): variantId is FooterVariant {
  return (FOOTER_VARIANTS as readonly string[]).includes(variantId);
}

export const footerPreset: PresetShape = {
  catalogId: FOOTER_ID,
  slots: FOOTER_SLOTS,

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isFooterVariant(variantId)) throw unknownVariant(FOOTER_ID, variantId, FOOTER_VARIANTS);
    return resolvePlacements(TEMPLATES[variantId], elements);
  },
};
