import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import { findSection, GRID_COLUMNS, type Placement, type RetorikaDocument } from "@retorika/schema";

/**
 * What the «Diseño» panel lists, and what each stepper is allowed to do — mockup 16's element tree
 * and its `Colocación` family.
 *
 * A separate module for the reason `sectionSearch.ts` and `photoInventory.ts` both give: the
 * editor's vitest project is node with no DOM, so a component cannot be unit-tested here. The
 * arithmetic that decides whether an arrow is disabled is exactly the part that must be, so it
 * lives here and `DesignPanel.tsx` only draws it.
 *
 * **The tree lists placements, not content.** That is a narrower list than the fields panel's and
 * deliberately so: this panel is about where things sit, and only a placed element has a place. A
 * gallery's cards are elements inside a list item, they carry no placement of their own, and they
 * move when the list moves — so they are not rows here. `sectionFields` is still the answer to
 * "what does this section say"; the two panels are about two different questions.
 */

/** Names in Spanish come from the catalog's own locale, the same source the fields panel uses, so
 * the two panels cannot come to call one element two things. */
function slotLabel(catalogId: string, slot: string): string {
  const key = `section.${catalogId}.slot.${slot}` as keyof typeof catalogEs;
  return catalogEs[key] ?? slot;
}

export interface DesignRow {
  elementId: string;
  /** The catalog's Spanish name for the slot, numbered when a slot holds more than one. */
  label: string;
  placement: Placement;
  /** Hidden elements keep their placement (rule 3) and stay in the tree, marked. Moving something
   * that is not on the page is a strange thing to do, but hiding it then losing track of where it
   * would come back is stranger. */
  hidden: boolean;
}

/**
 * The rows, in the order the placements are stored.
 *
 * **Not sorted by row and column**, which was the first instinct and is wrong: the list would then
 * reorder itself under the cursor every time somebody moved an element, and the row they were
 * working on would jump somewhere else mid-edit. Stored order is stable, and `escalate` copies it
 * from the preset, so the initial order is the one the catalog laid out.
 *
 * Empty for a section the catalog still draws — it has no placements — and for one that is not
 * there. Both are "nothing to list", which is what the panel says in words.
 */
export function designRows(doc: RetorikaDocument, sectionId: string): DesignRow[] {
  const section = findSection(doc, sectionId)?.section;
  const layout = section?.layout;
  if (!section || !layout) return [];

  const byId = new Map(section.content.map((element) => [element.id, element]));
  const seen = new Map<string, number>();

  return layout.placements.flatMap((placement) => {
    const element = byId.get(placement.elementId);
    // A placement whose element is not a direct child of the section has no slot of its own to
    // label. `checkInvariants` rejects a placement pointing at nothing at all, so this is the
    // nested case — left out rather than shown as a raw id on a Spanish screen.
    if (!element) return [];
    const occurrence = seen.get(element.slot) ?? 0;
    seen.set(element.slot, occurrence + 1);
    const base = slotLabel(section.preset.catalogId, element.slot);
    return [
      {
        elementId: placement.elementId,
        label: occurrence === 0 ? base : `${base} ${occurrence + 1}`,
        placement,
        hidden: element.hidden,
      },
    ];
  });
}

/**
 * Which row is being laid out, resolving the fallback in **one** place.
 *
 * The panel selects the first row when nothing has been clicked yet, so that opening «Diseño» has
 * something to step rather than an empty family. That fallback used to live inside the panel alone,
 * and the browser walk found what that costs: the canvas outlined whatever the parent's state said,
 * which was `null`, while the steppers acted on the first row. The panel and the page disagreed
 * about which element the numbers belonged to — the worst possible disagreement for a control whose
 * only job is to move a specific thing.
 *
 * `null` only when there is nothing to lay out at all.
 */
export function selectedRowId(
  rows: readonly DesignRow[],
  selectedElementId: string | null,
): string | null {
  const named = rows.find((row) => row.elementId === selectedElementId);
  return named?.elementId ?? rows[0]?.elementId ?? null;
}

/** One stepper's four numbers, and whether each end of it can move. `min`/`max` are what the
 * buttons are disabled by, so an arrow never sends a value the verb would refuse. */
export interface StepperBounds {
  min: number;
  max: number;
}

/**
 * The limits each control has, derived from rule 4 rather than guessed.
 *
 * **The interface prevents the invalid move; it does not repair it.** `setPlacement` refuses a
 * placement that reaches past the twelfth column, and that refusal is a backstop — an arrow that
 * lights up and then throws would be the dead button in its worst form, one that looks like it
 * worked. So the two horizontal limits are coupled, exactly as rule 4 couples them:
 *
 * - **Moving right** stops where the element's current span still fits: `13 - columnSpan`.
 * - **Widening** stops where the element's current column still fits: `13 - column`.
 *
 * Rows have no upper limit in the document model — a grid grows downwards — so the cap here is the
 * interface's own, not the schema's, and it exists only so an arrow held down cannot walk an element
 * a thousand rows off the bottom of a section nobody can scroll to.
 */
export const MAX_ROW = 24;

export function boundsFor(
  placement: Placement,
): Record<keyof Omit<Placement, "elementId">, StepperBounds> {
  return {
    column: { min: 1, max: GRID_COLUMNS - placement.columnSpan + 1 },
    columnSpan: { min: 1, max: GRID_COLUMNS - placement.column + 1 },
    row: { min: 1, max: MAX_ROW },
    rowSpan: { min: 1, max: MAX_ROW - placement.row + 1 },
  };
}

/** The value one press of a stepper would send, clamped to its own bounds so the caller cannot
 * produce one the verb refuses. `undefined` when the press would change nothing, which is how the
 * button knows to be disabled rather than how the reducer finds out afterwards. */
export function stepTo(
  placement: Placement,
  field: keyof Omit<Placement, "elementId">,
  delta: number,
): number | undefined {
  const bounds = boundsFor(placement)[field];
  const next = placement[field] + delta;
  if (next < bounds.min || next > bounds.max) return undefined;
  return next;
}
