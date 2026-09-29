import type { ContentElement, PresetShape, PresetSlot, SectionLayout } from "@retorika/schema";
import { resolvePlacements, type SlotPlacement, unknownVariant } from "./layout.ts";

/**
 * Equipo — «Quién soy / El equipo», the ninth and last section of the concept dossier's catalogue.
 *
 * The one section on this list backed by no session and no owner's own words. Both usability
 * sessions asked for other things — hostelería's tone (ADR 0009), bolder text (ADR 0024), the
 * photos that were never chosen (day 1) — and neither owner mentioned putting a face to the
 * business. It is scheduled here because it closes the catalogue the dossier §9 lists, not because
 * evidence asked for it, and that is worth saying rather than dressing up as a finding: see
 * `docs/tasks/backlog.md`.
 *
 * **Never generated, exactly like Opiniones.** None of the five questions can ask who works here —
 * a name and a face belong to the people themselves, not to the five answers a business gives
 * about what it does. So this section only ever arrives through "Añadir sección aquí", from an
 * owner who has photographs of real people to put in it.
 *
 * **A solo owner and a shop with staff are the same shape**, one card versus several: "Quién soy"
 * and "El equipo" are not two sections, they are the same list with a different count in it —
 * exactly the reading `blankItem`/`addItem` already give every other list section.
 */

export const TEAM_ID = "team";

export const TEAM_SLOTS: readonly PresetSlot[] = [
  { slot: "headline", role: "heading", min: 1, max: 1 },
  { slot: "intro", role: "body", min: 0, max: 1 },
  { slot: "members", role: "list", min: 1, max: 1 },
];

/**
 * One person: their photo, their name, and what they do here.
 *
 * All three required, for the same reason `gallery.ts`'s caption is: a list item's optional slot
 * cannot be reached from this editor at all (the fields panel is explicit that "a list holds items
 * rather than a value"), so `min: 0` here would declare a field in the preset that nobody could
 * ever put a word into. Required in the structure, so a new card is born with somewhere to write;
 * optional on the page, because an empty text renders nothing (`build.ts`).
 *
 * `job` rather than `role`: this file already uses `role` for the four document roles a slot can
 * carry (`heading`, `body`, `image`, `list`), and a slot literally named `role` holding a `body`
 * would read as if it meant that. What it means is what the person does here — "Dueña", "Fisio",
 * "Encargado" — and `job` says that without colliding with the word the rest of this catalog
 * already uses for something else.
 *
 * The photograph comes first, exactly as `GALLERY_ITEM_SLOTS` orders itself, so the card reads
 * face, then name, then job — a business card's own order.
 */
export const TEAM_ITEM_SLOTS: readonly PresetSlot[] = [
  { slot: "photo", role: "image", min: 1, max: 1 },
  { slot: "name", role: "heading", min: 1, max: 1 },
  { slot: "job", role: "body", min: 1, max: 1 },
];

/**
 * Six, the same bound "Qué hago" and "Opiniones" already draw (ADR 0013's own argument): a card
 * grid reads as a roster up to six faces and as a wall of photographs past it, and a business this
 * product serves — a shop, a clinic, a workshop — is the kind with a handful of people in it
 * rather than dozens.
 */
export const TEAM_MEMBERS = { min: 1, max: 6 } as const;

export const TEAM_VARIANTS = ["stacked", "side"] as const;
export type TeamVariant = (typeof TEAM_VARIANTS)[number];

/**
 * The same two geometries every other list section proves. A composition decides where the title,
 * the introduction and the roster sit; the generic card grid draws the people inside it.
 */
const TEMPLATES: Record<TeamVariant, readonly SlotPlacement[]> = {
  // Title and introduction on top, the roster full width underneath.
  stacked: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 1, columnSpan: 8, row: 2, rowSpan: 1 },
    { slot: "members", occurrence: 0, column: 1, columnSpan: 12, row: 3, rowSpan: 1 },
  ],
  // Title and introduction in a column on the left, the roster on the right.
  side: [
    { slot: "headline", occurrence: 0, column: 1, columnSpan: 4, row: 1, rowSpan: 1 },
    { slot: "intro", occurrence: 0, column: 1, columnSpan: 4, row: 2, rowSpan: 1 },
    { slot: "members", occurrence: 0, column: 5, columnSpan: 8, row: 1, rowSpan: 2 },
  ],
};

function isTeamVariant(variantId: string): variantId is TeamVariant {
  return (TEAM_VARIANTS as readonly string[]).includes(variantId);
}

export const teamPreset: PresetShape = {
  catalogId: TEAM_ID,
  slots: TEAM_SLOTS,
  itemRange: TEAM_MEMBERS,
  itemSlots: TEAM_ITEM_SLOTS,

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isTeamVariant(variantId)) throw unknownVariant(TEAM_ID, variantId, TEAM_VARIANTS);
    return resolvePlacements(TEMPLATES[variantId], elements);
  },
};
