import {
  type ContentElement,
  GRID_COLUMNS,
  type PresetShape,
  type PresetSlot,
  type SectionLayout,
} from "@retorika/schema";

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
 * The shape of one card. checkAgainstPreset judges top-level slots only (PresetShape has no
 * way to declare item slots yet), so this is enforced by the catalog's tests and the fixture.
 */
export const SERVICES_ITEM_SLOTS: readonly PresetSlot[] = [
  { slot: "title", role: "heading", min: 1, max: 1 },
  { slot: "description", role: "body", min: 0, max: 1 },
];

export const SERVICES_ITEMS = { min: 2, max: 6 } as const;

/** The three compositions approved by the CEO (docs/tasks/catalog-que-hago.md). */
export const SERVICES_VARIANTS = ["stacked", "side", "split"] as const;
export type ServicesVariant = (typeof SERVICES_VARIANTS)[number];

/** Geometry per slot occurrence, resolved against the section's elements, as in cover.ts. */
interface SlotPlacement {
  slot: string;
  occurrence: number;
  column: number;
  columnSpan: number;
  row: number;
  rowSpan: number;
}

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

  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout {
    if (!isServicesVariant(variantId)) {
      throw new Error(
        `Unknown variant "${variantId}" for section "${SERVICES_ID}". Known: ${SERVICES_VARIANTS.join(", ")}`,
      );
    }

    const bySlot = new Map<string, ContentElement[]>();
    for (const element of elements) {
      const list = bySlot.get(element.slot);
      if (list) list.push(element);
      else bySlot.set(element.slot, [element]);
    }

    const placements = TEMPLATES[variantId]
      .map((entry) => {
        const element = bySlot.get(entry.slot)?.[entry.occurrence];
        if (!element) return undefined;
        return {
          elementId: element.id,
          column: entry.column,
          columnSpan: entry.columnSpan,
          row: entry.row,
          rowSpan: entry.rowSpan,
        };
      })
      .filter((placement) => placement !== undefined);

    return {
      grid: { columns: GRID_COLUMNS },
      placements,
      breakpoints: { tablet: [], mobile: [] },
    };
  },
};
