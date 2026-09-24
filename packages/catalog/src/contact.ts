import type { ContentElement, PresetShape, PresetSlot, SectionLayout } from "@retorika/schema";
import { resolvePlacements, type SlotPlacement, unknownVariant } from "./layout.ts";

/**
 * Contacto y reservas — the section question 5 of the questionnaire fills (ADR 0010).
 *
 * Links, not a form (ADR 0016): `tel:`, WhatsApp and `mailto:` work from a file on a disk, cost
 * nothing and depend on nobody, which a form cannot do on a static site. The dossier's §9 says
 * "Formulario, teléfono y WhatsApp"; that ADR amends it.
 *
 * `primaryAction` is 1..1 because a contact section with nothing to contact is furniture. If
 * question 5 is skipped there is no action and the section is not generated at all.
 */

export const CONTACT_ID = "contact";

export const CONTACT_SLOTS: readonly PresetSlot[] = [
  { slot: "headline", role: "heading", min: 1, max: 1 },
  { slot: "body", role: "body", min: 0, max: 1 },
  { slot: "primaryAction", role: "button", min: 1, max: 1 },
  { slot: "secondaryAction", role: "link", min: 0, max: 3 },
];

export const CONTACT_VARIANTS = ["stacked", "side"] as const;
export type ContactVariant = (typeof CONTACT_VARIANTS)[number];

/**
 * Three secondary links is the maximum because the questionnaire collects at most a phone, a
 * WhatsApp number and an email; both compositions therefore place three occurrences.
 */
const TEMPLATES: Record<ContactVariant, readonly SlotPlacement[]> = {
  // The invitation, then the ways to answer it, in reading order.
  stacked: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
    { slot: "body", occurrence: 0, column: 1, columnSpan: 8, row: 2, rowSpan: 1 },
    { slot: "primaryAction", occurrence: 0, column: 1, columnSpan: 3, row: 3, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 0, column: 4, columnSpan: 3, row: 3, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 1, column: 7, columnSpan: 3, row: 3, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 2, column: 10, columnSpan: 3, row: 3, rowSpan: 1 },
  ],
  // The text on one side and the actions stacked on the other.
  side: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 7, row: 1, rowSpan: 1 },
    { slot: "body", occurrence: 0, column: 1, columnSpan: 7, row: 2, rowSpan: 1 },
    { slot: "primaryAction", occurrence: 0, column: 8, columnSpan: 5, row: 1, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 0, column: 8, columnSpan: 5, row: 2, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 1, column: 8, columnSpan: 5, row: 3, rowSpan: 1 },
    { slot: "secondaryAction", occurrence: 2, column: 8, columnSpan: 5, row: 4, rowSpan: 1 },
  ],
};

function isContactVariant(variantId: string): variantId is ContactVariant {
  return (CONTACT_VARIANTS as readonly string[]).includes(variantId);
}

export const contactPreset: PresetShape = {
  catalogId: CONTACT_ID,
  slots: CONTACT_SLOTS,

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isContactVariant(variantId)) {
      throw unknownVariant(CONTACT_ID, variantId, CONTACT_VARIANTS);
    }
    return resolvePlacements(TEMPLATES[variantId], elements);
  },
};
