import { GRID_COLUMNS, type Placement, type RetorikaDocument } from "./document.ts";
import { parseDocument } from "./parse.ts";
import type { PresetShape } from "./preset.ts";
import {
  applyRevert,
  escalate,
  planRevert,
  type RevertPlan,
  type SurplusDecision,
} from "./revert.ts";
import { findSection } from "./sections.ts";

/**
 * A section's layout, changed from the document down — the verbs the editor dispatches.
 *
 * `revert.ts` holds the engine and works on one `Section`: `escalate`, `planRevert`, `applyRevert`.
 * The editor's history works on whole documents, so the two need joining, and the join lives here
 * rather than in `revert.ts` on purpose. That file is what `INV_2`, `INV_3A` and `INV_3B` rest on;
 * it is better left exactly as it is while something new grows beside it.
 *
 * **The preset arrives as an argument and is never looked up.** The dependency arrow runs catalog →
 * schema, so this package cannot ask what a `cover` is. `sectionToPage(doc, sectionId, makeTeaser)`
 * is the same division, made for the same reason.
 */

/** The preset a caller must hand in, and the error every verb here throws for a section that is
 * not in the document, so the message names the id rather than a path into a parsed object. */
function sectionOrThrow(doc: RetorikaDocument, sectionId: string, verb: string) {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`${verb}: no section "${sectionId}"`);
  return found;
}

/** The document with one section's changed copy in place of the old one. */
function withSection(
  doc: RetorikaDocument,
  pageId: string,
  sectionId: string,
  next: RetorikaDocument["pages"][number]["sections"][number],
): RetorikaDocument {
  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) =>
      page.id !== pageId
        ? page
        : {
            ...page,
            sections: page.sections.map((section) => (section.id === sectionId ? next : section)),
          },
    ),
  });
}

/**
 * A section starts being designed by hand — the advanced dossier §5's «escalada».
 *
 * **Nothing moves.** `escalate` copies the layout the catalog was already drawing into the section
 * itself, so the page looks identical the instant after. That is what lets the offer be accepted
 * without risk, and it is the whole reason the return can be lossless: «Al escalar se guarda una
 * versión y se copia la maquetación del catálogo, así que no se mueve ni un píxel.»
 *
 * A section that is already free comes back unchanged — the same document, not a copy — so the
 * editor's history opens no step for an action that changed nothing. `setVariant` and `renamePage`
 * already answer that way for the same reason.
 */
export function escalateSection(
  doc: RetorikaDocument,
  sectionId: string,
  preset: PresetShape,
): RetorikaDocument {
  const found = sectionOrThrow(doc, sectionId, "escalateSection");
  if (found.section.source === "free") return doc;
  return withSection(doc, found.page.id, sectionId, escalate(found.section, preset));
}

/**
 * A hand-designed section goes back to the catalog's layout — «lo que Wix no tiene».
 *
 * Every text and photo returns to its exact slot, because the copy `escalate` made kept the element
 * ids and `applyRevert` puts each one back by id rather than by guessing.
 *
 * **What does not fit is hidden, never deleted, unless the caller says otherwise.** `applyRevert`
 * refuses to run when an element the preset cannot place arrives with no decision, which is correct
 * and is what the day-4 dialog exists to answer. Until that dialog exists this verb supplies the
 * default the interface is committed to anyway — `docs/document-rules.md`: «The interface's default
 * for that decision is "hide"» — so the verb can never throw into the middle of a reducer. Hiding
 * loses nothing: rule 3 keeps the element and the fields panel still lists it.
 *
 * A section that is already of the catalog comes back unchanged, for the same reason as above.
 */
export function revertSection(
  doc: RetorikaDocument,
  sectionId: string,
  preset: PresetShape,
  decisions: Readonly<Record<string, SurplusDecision>> = {},
): RetorikaDocument {
  const found = sectionOrThrow(doc, sectionId, "revertSection");
  if (found.section.source !== "free") return doc;

  const plan = planRevert(found.section, preset);
  const decided: Record<string, SurplusDecision> = {};
  for (const item of plan.surplus) decided[item.elementId] = decisions[item.elementId] ?? "hide";

  return withSection(doc, found.page.id, sectionId, applyRevert(found.section, preset, decided));
}

/** What reverting this section would do, for an interface that wants to say so before doing it.
 * A section of the catalog has nothing to plan, which is `undefined` rather than an empty plan —
 * the two mean different things and the caller should not have to tell them apart by counting. */
export function revertPlanFor(doc: RetorikaDocument, sectionId: string, preset: PresetShape) {
  const found = sectionOrThrow(doc, sectionId, "revertPlanFor");
  if (found.section.source !== "free") return undefined;
  return planRevert(found.section, preset);
}

/** Whether this section is drawn by hand rather than by the catalog — what the badge asks, and
 * what decides which of the two actions the section header offers. */
export function isHandDesigned(doc: RetorikaDocument, sectionId: string): boolean {
  return findSection(doc, sectionId)?.section.source === "free";
}

/** What the return would cost, which is what the dialog of day 4 has to say before doing it. */
export interface RevertImpact extends RevertPlan {
  /**
   * Whether the layout being dropped is one somebody actually changed.
   *
   * `escalate` copies the preset's own layout in, so a section escalated and left alone has a layout
   * identical to the one the catalog would draw: dropping it costs nothing and is invisible. Once an
   * element has been moved, dropping it throws away work. **Losing the layout is correct either way**
   * — rule 1 puts it in the layout object and `document-rules.md` says so — but only one of the two
   * is worth stopping a person to mention.
   */
  dropsPlacements: boolean;
  /** True when the return would take away nothing anybody would miss. The interface uses this to
   * decide whether to ask at all: «Volver es un clic, no destruye nada» is the promise, and a
   * confirmation over nothing destroyed would be friction defending against itself. */
  lossless: boolean;
}

/**
 * Everything the return dialog needs, in one answer.
 *
 * One function rather than three the component composes, because "is there anything worth saying"
 * is a decision about the document model and not about layout of a panel — and a component that
 * re-derived it would be free to derive it differently.
 *
 * `undefined` for a section of the catalog: there is no return to plan. The same distinction
 * `revertPlanFor` makes, for the same reason.
 */
export function revertImpact(
  doc: RetorikaDocument,
  sectionId: string,
  preset: PresetShape,
): RevertImpact | undefined {
  const found = sectionOrThrow(doc, sectionId, "revertImpact");
  const { section } = found;
  if (section.source !== "free") return undefined;

  const plan = planRevert(section, preset);
  // Compared against the layout the catalog would draw for this variant *and these elements*, not
  // against the one `escalate` copied in at the time: an element hidden or filled since then changes
  // what the preset draws, and a placement that still matches the new drawing has not been moved.
  const drawn = preset.layoutFor(section.preset.variantId, section.content);
  const dropsPlacements =
    JSON.stringify(section.layout?.placements) !== JSON.stringify(drawn.placements);

  return {
    ...plan,
    dropsPlacements,
    lossless: plan.surplus.length === 0 && !plan.dropsBreakpointAdjustments && !dropsPlacements,
  };
}

/** The part of a placement a caller may change. `elementId` is which placement, not what it says. */
export type PlacementEdit = Partial<Omit<Placement, "elementId">>;

/**
 * One element moved or resized inside its section's grid — what the professional came for.
 *
 * **Rule 4 is not amended, it is the reason this can exist at all**: «la colocación libre siempre
 * ocurre dentro de la rejilla de la sección, nunca sobre coordenadas absolutas» (advanced dossier
 * §6). Columns, spans and rows, and no `x` or `y` anywhere.
 *
 * **It refuses before `parseDocument`, and the message says which rule and which numbers.**
 * `checkInvariants` already rejects a placement that overflows the twelve columns, and `parseDocument`
 * already rejects a column outside 1..12 — so there is a net underneath either way. The net is not
 * enough on its own: it would report «column 11 + span 4 overflows» against a path into a parsed
 * object, at the end of a stack that started with somebody pressing an arrow. The caller that
 * pressed the arrow is the one that needs to hear why.
 *
 * A partial edit, because that is how the control works: one press changes the column, or the span,
 * or the row, never all of them. Anything left out keeps the value it had.
 *
 * **Two elements may end up in the same cell, and that is allowed.** CSS grid stacks them, the
 * schema has never forbidden it, and `checkInvariants` only rejects the *same* element being placed
 * twice. Overlapping deliberately is a real technique; refusing it here would be this package
 * deciding a question of taste it has no way to judge.
 */
export function setPlacement(
  doc: RetorikaDocument,
  sectionId: string,
  elementId: string,
  edit: PlacementEdit,
): RetorikaDocument {
  const found = sectionOrThrow(doc, sectionId, "setPlacement");
  const layout = found.section.layout;
  if (layout === null) {
    throw new Error(
      `setPlacement: section "${sectionId}" is drawn by the catalog, so its placements belong to ` +
        "the preset rather than to the document. Design it by hand first (escalateSection).",
    );
  }

  const current = layout.placements.find((placement) => placement.elementId === elementId);
  if (!current) {
    throw new Error(
      `setPlacement: element "${elementId}" has no placement in section "${sectionId}". Only a ` +
        "placed element can be moved; a list's own lines move with the list.",
    );
  }

  const next: Placement = { ...current, ...edit };

  // Named one at a time rather than as one "invalid placement", because the control that sent this
  // is a stepper on a single number and the useful answer is which number it was.
  for (const [field, value] of [
    ["column", next.column],
    ["columnSpan", next.columnSpan],
    ["row", next.row],
    ["rowSpan", next.rowSpan],
  ] as const) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`setPlacement: ${field} must be a whole number of at least 1, not ${value}`);
    }
  }
  if (next.column > GRID_COLUMNS) {
    throw new Error(
      `setPlacement: column ${next.column} is outside the ${GRID_COLUMNS}-column grid (rule 4)`,
    );
  }
  if (next.column + next.columnSpan - 1 > GRID_COLUMNS) {
    throw new Error(
      `setPlacement: column ${next.column} with a span of ${next.columnSpan} reaches column ` +
        `${next.column + next.columnSpan - 1}, past the ${GRID_COLUMNS}-column grid (rule 4)`,
    );
  }

  // The same numbers back are not a change, so the history opens no step — the answer every verb
  // here gives, and what lets the control be held down at its limit without filling the undo stack.
  if (
    next.column === current.column &&
    next.columnSpan === current.columnSpan &&
    next.row === current.row &&
    next.rowSpan === current.rowSpan
  ) {
    return doc;
  }

  return withSection(doc, found.page.id, sectionId, {
    ...found.section,
    layout: {
      ...layout,
      placements: layout.placements.map((placement) =>
        placement.elementId === elementId ? next : placement,
      ),
    },
  });
}
