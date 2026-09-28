import type {
  ContentElement,
  PresetShape,
  PresetSlot,
  Section,
  SectionLayout,
} from "@retorika/schema";
import { resolvePlacements, type SlotPlacement, unknownVariant } from "./layout.ts";

/**
 * Avance — what is left where a section used to be, once that section became a page.
 *
 * The concept dossier §6: «Cualquier sección puede convertirse en página. La aplicación mueve el
 * contenido, deja **un resumen con un enlace** en la página de inicio y crea la página nueva.»
 * This is that summary, and it is the smallest section in the catalog on purpose.
 *
 * **It stores one thing: the link.** Not the title it shows, not the line underneath — those are
 * read from the destination page *at render time* (`build.ts`). That is the whole design, and the
 * alternative was rejected before it was built: a teaser that copied the words would be two copies
 * of one text, drifting apart the first time the owner edited the page it came from, with nothing
 * in the document model to keep them together. Nothing to synchronise, because nothing is
 * duplicated. The only thing written down is the label on the link, which is the owner's to change.
 *
 * **It is the first section whose content is partly derived**, which is a real widening of what a
 * section can be. Until now only the `rb-panel` was drawn without being in the document, and that
 * is decoration with no text in it. The rule this keeps is rule 1: the layout holds references
 * only, and what the renderer reads from elsewhere it reads through the link's `href` — a
 * destination the document really does contain.
 *
 * **It is never added by hand.** `blankSection` refuses it, exactly as it refuses «Contacto y
 * reservas», and for the same reason: its required slot is a destination, and no marker can fill a
 * destination honestly. A teaser exists only because `sectionToPage` made one, which is also the
 * only moment anything knows where it should point. `Variants.tsx` therefore leaves it out of the
 * "Añadir sección aquí" menu, and it has no search aliases: a section the menu cannot offer must
 * not be findable in a search that only feeds that menu.
 */

export const TEASER_ID = "teaser";

/**
 * One slot, and it is a `link`.
 *
 * `role: "link"` rather than `"button"`: this is navigation inside the site, not the call to
 * action the business is asking for. The stylesheet draws it underlined in `color.primary`, a
 * pairing `packages/tokens/test/contrast.test.ts` proves for all four palettes, and it will not
 * compete with the cover's real button on the same page.
 */
export const TEASER_SLOTS: readonly PresetSlot[] = [{ slot: "link", role: "link", min: 1, max: 1 }];

/**
 * One composition, where every other section in the catalog has two or three.
 *
 * That is legal and deliberate. A composition exists so the owner can choose how a section looks;
 * an avance is derived chrome standing in for a page, and three of them on one home page should
 * look like three of the same thing rather than like three different decisions. `compositionsFor`
 * in the editor already returns nothing when a section has fewer than two, so no dead button is
 * drawn for it — this is the case that rule was written against, arriving.
 */
export const TEASER_VARIANTS = ["stacked"] as const;
export type TeaserVariant = (typeof TEASER_VARIANTS)[number];

/** The link sits under the derived title and line, which the renderer emits before it. */
const TEMPLATES: Record<TeaserVariant, readonly SlotPlacement[]> = {
  stacked: [{ slot: "link", occurrence: 0, column: 1, columnSpan: 12, row: 3, rowSpan: 1 }],
};

function isTeaserVariant(variantId: string): variantId is TeaserVariant {
  return (TEASER_VARIANTS as readonly string[]).includes(variantId);
}

export const teaserPreset: PresetShape = {
  catalogId: TEASER_ID,
  slots: TEASER_SLOTS,

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isTeaserVariant(variantId)) throw unknownVariant(TEASER_ID, variantId, TEASER_VARIANTS);
    return resolvePlacements(TEMPLATES[variantId], elements);
  },
};

/**
 * The avance that stands in for a page, built where the converted section used to be.
 *
 * Lives here rather than in `packages/schema` for the reason `insertSection` gives about every
 * other section: what a valid one is made of is the catalog's business, and the dependency arrow
 * runs catalog → schema and never back. `sectionToPage` takes this as a factory.
 *
 * `label` is the only writing in it, and it is neutral on purpose. «Ver más», never «Ver
 * {titular} completo»: a Spanish sentence with a heading dropped into it breaks on the gender of
 * half the headings anybody would write — «Ver Nuestra carta completo» is wrong, and so is every
 * template that tries. What tells three identical «Ver más» links apart is the accessible suffix
 * the renderer adds, which sidesteps agreement entirely by using a colon.
 */
export function teaserSection(sectionId: string, href: string, label: string): Section {
  return {
    id: sectionId,
    preset: { catalogId: TEASER_ID, variantId: TEASER_VARIANTS[0] },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-link",
        role: "link",
        hidden: false,
        slot: "link",
        value: { kind: "link", text: label, href },
      },
    ],
  };
}
