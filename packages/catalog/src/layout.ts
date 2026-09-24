import { type ContentElement, GRID_COLUMNS, type SectionLayout } from "@retorika/schema";

/**
 * Turning a preset's declared geometry into a section's layout.
 *
 * Every preset does the same two things: it declares where each slot sits on the twelve-column
 * grid, and then resolves those entries against the elements a document actually provides,
 * because a placement references an element *id* (rule 1) and a preset has never seen the
 * document it will be applied to.
 *
 * Extracted at the third and fourth use, not the second, as CLAUDE.md asks.
 */

/** Geometry declared per slot occurrence, not per element id. */
export interface SlotPlacement {
  slot: string;
  /** Which element within the slot, for slots that admit more than one. */
  occurrence: number;
  column: number;
  columnSpan: number;
  row: number;
  rowSpan: number;
}

/**
 * The layout for one variant, resolved against the section's own elements.
 *
 * A slot the document does not fill simply gets no placement: optional slots are the common
 * case, so this is ordinary rather than exceptional. A fresh object is returned every call, so
 * one section cannot mutate the catalog.
 */
export function resolvePlacements(
  entries: readonly SlotPlacement[],
  elements: readonly ContentElement[],
): SectionLayout {
  const bySlot = new Map<string, ContentElement[]>();
  for (const element of elements) {
    const list = bySlot.get(element.slot);
    if (list) list.push(element);
    else bySlot.set(element.slot, [element]);
  }

  const placements = entries
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
}

/**
 * Explicit rather than silently falling back: a document naming a variant we do not have is a
 * real problem, and a quiet default would publish the wrong layout.
 */
export function unknownVariant(
  catalogId: string,
  variantId: string,
  known: readonly string[],
): Error {
  return new Error(
    `Unknown variant "${variantId}" for section "${catalogId}". Known: ${known.join(", ")}`,
  );
}
