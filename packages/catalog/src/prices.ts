import type { ContentElement, PresetShape, PresetSlot, SectionLayout } from "@retorika/schema";
import { resolvePlacements, type SlotPlacement, unknownVariant } from "./layout.ts";

/**
 * Precios — what things cost.
 *
 * The seventh catalog section, and the one both usability sessions asked for without being
 * prompted: «le falta una sección para mostrar los platos estrella o poner la carta del
 * restaurante» (Taberna, 25 Sep) and «una sección para mostrar mis platos, la carta, etc.»
 * (Conchi, 27 Sep). Neither of them said the word "precios", and that is the interesting part —
 * [issue #51](https://github.com/dnarram/retorika-builder/issues/51) is about the name rather
 * than the section.
 *
 * **It is called "Precios" and a restaurant's carta is one of these.** The concept dossier's
 * nine include «Precios — Tarifas o planes», and a carta is a list of named things with a price
 * and an optional description, which is the same shape. The dossier also settles what to do
 * about a word an owner would type that is not the section's name, and it is not renaming: «El
 * buscador del catálogo entiende lo que el usuario escribiría de verdad: si busca "hero"
 * encuentra Portada». So `carta`, `menú` and `platos` find this section (`search.ts`), and the
 * heading on the published page is a different thing from the name in the menu — for hostelería
 * the text bank makes it «Nuestra carta».
 *
 * **A carta of three courses is three of these sections**, each with its own heading, built by
 * duplicating. Nothing in the document model groups list items, and adding grouping to hold a
 * menu together would be a bigger change than the sections it would replace.
 */

export const PRICES_ID = "prices";

export const PRICES_SLOTS: readonly PresetSlot[] = [
  { slot: "headline", role: "heading", min: 1, max: 1 },
  { slot: "intro", role: "body", min: 0, max: 1 },
  { slot: "lines", role: "list", min: 1, max: 1 },
];

/**
 * One line: what it is, what it costs, and optionally a word about it.
 *
 * **The price is free text**, because a carta that says «según mercado» is a real carta and a
 * tariff list with «desde 12 €» on one row is a real tariff list. A number would also have to
 * carry a currency, a format and a decision about tax that this product has no standing to make
 * — `docs/design/billing-questions.md` is about *our* invoice and says nothing about a client's
 * prices.
 *
 * **And it is optional on the page while being required in the structure**, which is not a
 * contradiction and is the same argument `testimonials.ts` makes for an opinion's author: the
 * minimum is what stops the place to put a price from disappearing. A line with no price is one
 * whose price the owner emptied, and since an empty text renders nothing (`build.ts`), it leaves
 * no trace on the published page. Were it `min: 0` it would not exist in a new line at all, and
 * nothing in this editor could reach it — the fields panel is explicit that "a list holds items
 * rather than a value", so a list item's slots are not among the rows it offers.
 *
 * `description` is `0..1` and therefore absent from a new line, which is exactly the state
 * `SERVICES_ITEM_SLOTS` has had since sprint 1. That gap is real and is named in the backlog
 * rather than widened here: a carta line reads perfectly as a name and a price.
 *
 * `name` is the `heading`, exactly as a service's name and an opinion's author are: the list
 * drawing is generic — `.rb-item` is a flex column drawing an h3 in ink over each p in muted —
 * so this section needs no change to how a list is drawn, which is the whole promise of writing
 * that drawing once.
 */
export const PRICES_ITEM_SLOTS: readonly PresetSlot[] = [
  { slot: "name", role: "heading", min: 1, max: 1 },
  { slot: "description", role: "body", min: 0, max: 1 },
  { slot: "price", role: "body", min: 1, max: 1 },
];

/**
 * Twelve, where "Qué hago" stops at six (ADR 0013).
 *
 * Six fits «los platos estrella»; it does not fit a course. Twelve holds an entrantes list or a
 * hairdresser's whole tariff, and a full carta is three or four of these sections rather than
 * one very long one — which is also how a printed carta is laid out.
 */
export const PRICES_LINES = { min: 1, max: 12 } as const;

export const PRICES_VARIANTS = ["stacked", "side"] as const;
export type PricesVariant = (typeof PRICES_VARIANTS)[number];

/**
 * The same two geometries "Qué hago" and "Opiniones" already prove: a composition decides where
 * the title, the introduction and the list sit, and the lines inside flow by the generic rule.
 */
const TEMPLATES: Record<PricesVariant, readonly SlotPlacement[]> = {
  // Title and introduction on top, the lines full width underneath.
  stacked: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 1, columnSpan: 8, row: 2, rowSpan: 1 },
    { slot: "lines", occurrence: 0, column: 1, columnSpan: 12, row: 3, rowSpan: 1 },
  ],
  // Title and introduction in a column on the left, the lines on the right.
  side: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 4, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 1, columnSpan: 4, row: 2, rowSpan: 1 },
    { slot: "lines", occurrence: 0, column: 5, columnSpan: 8, row: 1, rowSpan: 2 },
  ],
};

function isPricesVariant(variantId: string): variantId is PricesVariant {
  return (PRICES_VARIANTS as readonly string[]).includes(variantId);
}

export const pricesPreset: PresetShape = {
  catalogId: PRICES_ID,
  slots: PRICES_SLOTS,
  itemRange: PRICES_LINES,
  itemSlots: PRICES_ITEM_SLOTS,

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isPricesVariant(variantId)) throw unknownVariant(PRICES_ID, variantId, PRICES_VARIANTS);
    return resolvePlacements(TEMPLATES[variantId], elements);
  },
};
