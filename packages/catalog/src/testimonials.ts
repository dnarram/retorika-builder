import type { ContentElement, PresetShape, PresetSlot, SectionLayout } from "@retorika/schema";
import { resolvePlacements, type SlotPlacement, unknownVariant } from "./layout.ts";

/**
 * Opiniones — what customers said, in their own words.
 *
 * The first catalog section the questionnaire does not fill. The five questions ask what the
 * business is called, what it does, what it offers, where it is and what a visitor should do —
 * none of them can ask for a review, because a review is not the owner's to write. So this
 * section is never generated: it exists to be *added*, from the "Añadir sección aquí" pill, by
 * an owner who has real quotes to paste in.
 *
 * That is also why every marker text here is phrased as an instruction and none of them is a
 * sentence a customer might plausibly have said. A marker that read "Me atendieron fenomenal"
 * would, on a site downloaded and published unedited, be a fabricated review on a real
 * business's page — which is a different and much worse thing than an unfinished heading.
 */

export const TESTIMONIALS_ID = "testimonials";

export const TESTIMONIALS_SLOTS: readonly PresetSlot[] = [
  { slot: "headline", role: "heading", min: 1, max: 1 },
  { slot: "intro", role: "body", min: 0, max: 1 },
  { slot: "opinions", role: "list", min: 1, max: 1 },
];

/**
 * One opinion: who said it, and what they said.
 *
 * Both required, and `author` deliberately so. An unattributed quote is not a testimonial — it
 * is a sentence the business wrote about itself — and the minimum is what stops the place to
 * put the name from disappearing. An owner with a quote whose author does not want to be named
 * hides that element instead (document rule 3: hiding is allowed, removing is not), which
 * `checkAgainstPreset` counts towards the minimum and the renderer then leaves off the page.
 *
 * `author` is the `heading` because it is the card's title, exactly as a service's name is: the
 * list drawing is generic (`.rb-item` draws an h3 in ink over a p in muted), so this section
 * needs no renderer change at all — which is the whole promise of writing that drawing once.
 */
export const TESTIMONIALS_ITEM_SLOTS: readonly PresetSlot[] = [
  { slot: "author", role: "heading", min: 1, max: 1 },
  { slot: "quote", role: "body", min: 1, max: 1 },
];

export const TESTIMONIALS_VARIANTS = ["stacked", "side"] as const;
export type TestimonialsVariant = (typeof TESTIMONIALS_VARIANTS)[number];

/**
 * The same two geometries "Qué hago" already proves, for the same reason: a composition decides
 * where the title, the introduction and the list sit, and the cards inside flow by the generic
 * list rule.
 */
const TEMPLATES: Record<TestimonialsVariant, readonly SlotPlacement[]> = {
  // Title and introduction on top, the opinions full width underneath.
  stacked: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 1, columnSpan: 8, row: 2, rowSpan: 1 },
    { slot: "opinions", occurrence: 0, column: 1, columnSpan: 12, row: 3, rowSpan: 1 },
  ],
  // Title and introduction in a column on the left, the opinions on the right.
  side: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 4, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 1, columnSpan: 4, row: 2, rowSpan: 1 },
    { slot: "opinions", occurrence: 0, column: 5, columnSpan: 8, row: 1, rowSpan: 2 },
  ],
};

function isTestimonialsVariant(variantId: string): variantId is TestimonialsVariant {
  return (TESTIMONIALS_VARIANTS as readonly string[]).includes(variantId);
}

export const testimonialsPreset: PresetShape = {
  catalogId: TESTIMONIALS_ID,
  slots: TESTIMONIALS_SLOTS,
  itemSlots: TESTIMONIALS_ITEM_SLOTS,

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isTestimonialsVariant(variantId)) {
      throw unknownVariant(TESTIMONIALS_ID, variantId, TESTIMONIALS_VARIANTS);
    }
    return resolvePlacements(TEMPLATES[variantId], elements);
  },
};
