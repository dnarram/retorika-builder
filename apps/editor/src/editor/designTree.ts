import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import {
  findSection,
  GRID_COLUMNS,
  mobilePatchFor,
  mobileSequence,
  type Placement,
  type RetorikaDocument,
} from "@retorika/schema";

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

/**
 * Every element of a section, named — one name per element id, numbered within its slot.
 *
 * **Every element, not every placed element.** The tree below lists placements, and the return dialog
 * has to name elements that may have none: a surplus element created after the section was escalated
 * never got one, because `escalate` drew the layout from the elements that existed at the time. Two
 * panels naming the same element differently is the thing this exists to prevent, and the third
 * caller is what made it worth a function rather than a copy.
 */
export function elementLabels(doc: RetorikaDocument, sectionId: string): Map<string, string> {
  const section = findSection(doc, sectionId)?.section;
  if (!section) return new Map();

  const seen = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const element of section.content) {
    const occurrence = seen.get(element.slot) ?? 0;
    seen.set(element.slot, occurrence + 1);
    const base = slotLabel(section.preset.catalogId, element.slot);
    labels.set(element.id, occurrence === 0 ? base : `${base} ${occurrence + 1}`);
  }
  return labels;
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
  const labels = elementLabels(doc, sectionId);

  return layout.placements.flatMap((placement) => {
    const element = byId.get(placement.elementId);
    const label = labels.get(placement.elementId);
    // A placement whose element is not a direct child of the section has no slot of its own to
    // label. `checkInvariants` rejects a placement pointing at nothing at all, so this is the
    // nested case — left out rather than shown as a raw id on a Spanish screen.
    if (!element || label === undefined) return [];
    return [{ elementId: placement.elementId, label, placement, hidden: element.hidden }];
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

/**
 * The three mobile adjustments as the panel needs them — rule 7, mockup 14.
 *
 * The order rule itself lives in `packages/schema` (`mobileSequence`), shared with the renderer so
 * the button and the published CSS cannot drift. What is here is only what the *buttons* need: their
 * pressed state and whether each one can do anything.
 */
export interface MobileControls {
  /** «Ocultar aquí» — pressed when the element is hidden on mobile. A toggle, not a one-way door. */
  hidden: boolean;
  /** «Subir» — disabled for the element already first, because pressing it would change nothing and
   * a control that looks live and does nothing is the dead button in its worst form. */
  canMoveUp: boolean;
  /** «Foto menor» — the span it would step down to, or `undefined` at the narrowest. Twelve is the
   * derivation's own width, so the first press goes to nine rather than eleven: a step of one
   * twelfth is invisible, and three presses covering three quarters, a half and a quarter is the
   * range somebody actually wants for a photograph. */
  narrowerTo: number | undefined;
  /** The span in force on mobile, for the label to say where it is. */
  span: number;
}

/** The widths «Foto menor» steps through, widest first. Not every twelfth: the control is a
 * shortcut, and `setMobilePatch` accepts any span for anyone who needs one by hand. */
export const MOBILE_SPANS = [12, 9, 6, 3] as const;

export function mobileControlsFor(
  doc: RetorikaDocument,
  sectionId: string,
  elementId: string,
): MobileControls | undefined {
  const section = findSection(doc, sectionId)?.section;
  if (!section?.layout) return undefined;
  if (!section.content.some((element) => element.id === elementId)) return undefined;

  const patch = mobilePatchFor(doc, sectionId, elementId);
  const sequence = mobileSequence(section);
  const span = patch?.columnSpan ?? GRID_COLUMNS;
  const at = MOBILE_SPANS.indexOf(span as (typeof MOBILE_SPANS)[number]);

  return {
    hidden: patch?.hidden === true,
    canMoveUp: sequence[0]?.elementId !== elementId,
    // A span the control's own list does not hold — written by hand, or by a future control — steps
    // to the widest entry narrower than it rather than refusing, so the button still means something.
    narrowerTo:
      at === -1 ? MOBILE_SPANS.find((candidate) => candidate < span) : MOBILE_SPANS[at + 1],
    span,
  };
}
