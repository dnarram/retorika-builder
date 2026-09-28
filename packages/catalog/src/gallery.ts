import type { ContentElement, PresetShape, PresetSlot, SectionLayout } from "@retorika/schema";
import { resolvePlacements, type SlotPlacement, unknownVariant } from "./layout.ts";

/**
 * Fotos de trabajos — the shop window.
 *
 * The eighth of the concept dossier's nine sections, listed there as «Fotos de trabajos — Galería,
 * o antes y después», and the second thing Taberna asked for on 25 September: «le falta una sección
 * para mostrar **los platos estrella** o poner la carta del restaurante». Sprint 4 built the second
 * half of that sentence and this is the first half. They are not the same section and reading them
 * as one was the mistake worth avoiding: a carta is a list of names and prices, and «los platos
 * estrella» is a handful of photographs of the best of them.
 *
 * **Nothing new was needed to build it.** A list is drawn once, generically, for every section that
 * has one (`build.ts`); `blankItem` and `addItem` arrived in sprint 4 to put a line in one; and the
 * photo upload of sprint 3 addresses an image by `(sectionId, elementId)`, which reaches an image
 * inside a list item without knowing that is where it is. The one thing this section adds to the
 * renderer is a single rule about how a photograph is cropped, for the same reason `.rb-prices`
 * needed one: the generic card grid is right about everything except one detail.
 *
 * **«Antes y después» is served by this section rather than by a second one.** Two items captioned
 * «Antes» and «Después» sit side by side in the grid and read exactly as the dossier's phrase
 * describes. A dedicated paired layout — one item holding two photographs — would need an item slot
 * admitting two occurrences and a control for adding the second, and nothing in this editor can
 * reach inside a list item to add an occurrence. That is a real gap, named rather than half-built.
 */

export const GALLERY_ID = "gallery";

export const GALLERY_SLOTS: readonly PresetSlot[] = [
  { slot: "headline", role: "heading", min: 1, max: 1 },
  { slot: "intro", role: "body", min: 0, max: 1 },
  { slot: "photos", role: "list", min: 1, max: 1 },
];

/**
 * One photograph and the words under it.
 *
 * **The caption is a `body` and not a `heading`**, which is the one place this section departs from
 * every other list in the catalog — a service's name, an opinion's author and a carta line's dish
 * are all `heading`. A caption heads nothing: it names the picture above it. Marked up as a heading,
 * twelve captions would put twelve entries in a screen reader's heading list, each announcing a
 * section of the page that does not exist — which is precisely the correction issue #19 made for the
 * cover's tagline, and the same reasoning applies with more force here, because a gallery has more
 * captions than a page has sections. `.rb-item p` is `color.muted` on `color.surface`, a pair
 * `packages/tokens/test/contrast.test.ts` already proves for all four palettes.
 *
 * **It is `1..1` for the reason `prices.ts` makes its price `1..1`**: required in the structure so
 * that a new photograph is born with somewhere to type, optional on the page because an empty text
 * renders nothing (`build.ts`). Nothing in this editor can reach a list item's optional slot — the
 * fields panel is explicit that "a list holds items rather than a value" — so `min: 0` would mean a
 * caption that exists in the preset and can never be written. The cost is honest and visible: a
 * gallery added and never touched publishes «Escribe aquí de qué es esta foto» under each photo, and
 * the editor's marker count says so.
 *
 * The photograph comes first so that the card reads picture, then words. `blankSection` walks these
 * in order and `.rb-item` is a flex column, so the declaration order is the reading order.
 */
export const GALLERY_ITEM_SLOTS: readonly PresetSlot[] = [
  { slot: "photo", role: "image", min: 1, max: 1 },
  { slot: "caption", role: "body", min: 1, max: 1 },
];

/**
 * Eight, where "Qué hago" stops at six (ADR 0013) and a carta at twelve.
 *
 * The dossier's own words are the bound: «los platos estrella» is a shop window and not an
 * inventory, which is ADR 0013's argument for six. Eight rather than six because «antes y después»
 * is half of what this section is for, and a before-and-after gallery counts in pairs — four pairs
 * is a showcase, three is a sample.
 *
 * Twelve, the carta's number, would be wrong here for a reason a carta does not have: a carta line
 * is a few words and a gallery item is a photograph. Twelve photographs are the first document that
 * could approach `MAX_BODY_BYTES` on the download route, and the item cap is the honest place to
 * keep that from happening rather than a 413 at the moment someone presses Descargar.
 */
export const GALLERY_PHOTOS = { min: 1, max: 8 } as const;

export const GALLERY_VARIANTS = ["stacked", "side"] as const;
export type GalleryVariant = (typeof GALLERY_VARIANTS)[number];

/**
 * The same two geometries "Qué hago", "Opiniones" and "Precios" already prove. A composition
 * decides where the title, the introduction and the grid of photographs sit; how the photographs
 * flow inside it is the generic list rule's business.
 */
const TEMPLATES: Record<GalleryVariant, readonly SlotPlacement[]> = {
  // Title and introduction on top, the photographs full width underneath.
  stacked: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 1, columnSpan: 8, row: 2, rowSpan: 1 },
    { slot: "photos", occurrence: 0, column: 1, columnSpan: 12, row: 3, rowSpan: 1 },
  ],
  // Title and introduction in a column on the left, the photographs on the right.
  side: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 4, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 1, columnSpan: 4, row: 2, rowSpan: 1 },
    { slot: "photos", occurrence: 0, column: 5, columnSpan: 8, row: 1, rowSpan: 2 },
  ],
};

function isGalleryVariant(variantId: string): variantId is GalleryVariant {
  return (GALLERY_VARIANTS as readonly string[]).includes(variantId);
}

export const galleryPreset: PresetShape = {
  catalogId: GALLERY_ID,
  slots: GALLERY_SLOTS,
  itemRange: GALLERY_PHOTOS,
  itemSlots: GALLERY_ITEM_SLOTS,

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isGalleryVariant(variantId)) throw unknownVariant(GALLERY_ID, variantId, GALLERY_VARIANTS);
    return resolvePlacements(TEMPLATES[variantId], elements);
  },
};
