import {
  type BreakpointPatch,
  GRID_COLUMNS,
  type Placement,
  type RetorikaDocument,
  type Section,
} from "./document.ts";
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

// ---------------------------------------------------------------------------
// Rule 7 — the three mobile adjustments
// ---------------------------------------------------------------------------

/**
 * Where each of a section's elements sits on mobile, and what number says so.
 *
 * **One rule, two readers.** `packages/renderer` emits these numbers as CSS `order` and the editor
 * needs the same answer to decide what «Subir» does and when it stops — and two implementations of
 * one rule is how the panel and the canvas came to disagree about the selected element on day 3.
 * So it lives here, where document semantics belong, and both import it.
 *
 * The rule, in one sentence: **a patch's `order` is a position among the section's elements, and an
 * element nobody numbered keeps its own place in content order, one-based.** That was not the first
 * version — emitting `order` only where a patch named one put an unpatched body ahead of a headline
 * patched to 1, because CSS's default is 0. A real browser at 390px is what found it.
 *
 * Ties are possible and settled the way CSS settles them: by document order. Deterministic, so
 * `INV_5` and the golden corpus still hold.
 */
export interface MobileSlot {
  elementId: string;
  /** The number published as `order`, whether it came from a patch or from content order. */
  order: number;
  /** Whether that number was written by a patch rather than derived. */
  patched: boolean;
}

export function mobileSequence(section: Section): MobileSlot[] {
  const patches = new Map(
    (section.layout?.breakpoints?.mobile ?? []).map((patch) => [patch.elementId, patch]),
  );
  /**
   * The derived position of an element nobody numbered — **the automatic derivation's order, not
   * content order**, and that distinction is a defect a browser walk caught on day 6.
   *
   * The derivation puts the photograph first: the shared stylesheet says
   * `.rb-section > img { order: -1 }`, which is the approved option A. Numbering from content order
   * instead meant that pressing «Foto menor» — a width, nothing to do with sequence — emitted base
   * numbers for every element and **moved the photograph from first to fourth**. Somebody asked for a
   * smaller photo and the whole section reordered itself.
   *
   * Rule 7 says mobile is a patch over the automatic derivation. So the base has to *be* the
   * derivation, and then a patch that says nothing about order changes nothing about order.
   */
  const derived = [
    ...section.content.filter((element) => element.role === "image"),
    ...section.content.filter((element) => element.role !== "image"),
  ].map((element) => element.id);

  return (
    section.content
      .map((element, index) => {
        const order = patches.get(element.id)?.order;
        return {
          elementId: element.id,
          order: order ?? derived.indexOf(element.id) + 1,
          patched: order !== undefined,
          index,
        };
      })
      // The comparison CSS itself makes: by `order`, then by position in the markup.
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map(({ elementId, order, patched }) => ({ elementId, order, patched }))
  );
}

/** The patch an element carries on mobile, if it carries one. */
export function mobilePatchFor(
  doc: RetorikaDocument,
  sectionId: string,
  elementId: string,
): BreakpointPatch | undefined {
  return findSection(doc, sectionId)?.section.layout?.breakpoints?.mobile?.find(
    (patch) => patch.elementId === elementId,
  );
}

/** The three fields a caller may set, and `undefined` to take one away again. */
export type MobilePatchEdit = Partial<Omit<BreakpointPatch, "elementId">>;

/** The section's mobile patches with one element's merged in, dropping a patch left saying nothing.
 * A patch of no properties is not a patch, and leaving `{ elementId }` behind would publish an
 * entry the renderer has to skip and a reviewer has to wonder about. */
function withPatch(section: Section, elementId: string, edit: MobilePatchEdit): BreakpointPatch[] {
  const current = section.layout?.breakpoints?.mobile ?? [];
  const existing = current.find((patch) => patch.elementId === elementId);
  const merged: BreakpointPatch = { ...existing, ...edit, elementId };
  for (const key of ["hidden", "order", "columnSpan"] as const) {
    if (merged[key] === undefined) delete merged[key];
  }

  const rest = current.filter((patch) => patch.elementId !== elementId);
  if (Object.keys(merged).length === 1) return rest;
  // Appended rather than inserted in place when new, so the stored order is the order the
  // adjustments were made — which is what the renderer walks and the golden corpus records.
  return existing
    ? current.map((patch) => (patch.elementId === elementId ? merged : patch))
    : [...rest, merged];
}

/** The section, with a new set of mobile patches. Refuses a section the catalog draws, because
 * patches live inside `layout` and a catalog section has `layout: null` — there is nowhere to put
 * them. That is not a workaround: it is the dossier §5's first entry point, and the offer to design
 * the section by hand has to say so before anybody accepts. */
function withMobilePatches(
  doc: RetorikaDocument,
  sectionId: string,
  verb: string,
  next: (section: Section) => BreakpointPatch[],
): RetorikaDocument {
  const found = sectionOrThrow(doc, sectionId, verb);
  const layout = found.section.layout;
  if (!layout) {
    throw new Error(
      `${verb}: section "${sectionId}" is drawn by the catalog, so it has no layout to patch. ` +
        "Design it by hand first (escalateSection).",
    );
  }

  const patches = next(found.section);
  const current = layout.breakpoints.mobile ?? [];
  if (JSON.stringify(patches) === JSON.stringify(current)) return doc;

  return withSection(doc, found.page.id, sectionId, {
    ...found.section,
    layout: { ...layout, breakpoints: { ...layout.breakpoints, mobile: patches } },
  });
}

/**
 * «Ocultar aquí» and «Foto menor» — the first and third adjustments of rule 7.
 *
 * `undefined` for a field takes that adjustment away, which is how a control turns itself off. An
 * element whose patch ends up empty loses the patch entirely.
 *
 * There is no fourth adjustment and there cannot be: `breakpointPatchSchema` is a strict object of
 * exactly these three, so `parseDocument` refuses anything else. That is what stops the mobile view
 * from quietly growing into the second design rule 7 exists to prevent.
 */
export function setMobilePatch(
  doc: RetorikaDocument,
  sectionId: string,
  elementId: string,
  edit: MobilePatchEdit,
): RetorikaDocument {
  const found = sectionOrThrow(doc, sectionId, "setMobilePatch");
  if (!found.section.content.some((element) => element.id === elementId)) {
    throw new Error(`setMobilePatch: section "${sectionId}" has no element "${elementId}"`);
  }
  return withMobilePatches(doc, sectionId, "setMobilePatch", (section) =>
    withPatch(section, elementId, edit),
  );
}

/**
 * «Subir» — the second adjustment, as a swap rather than a decrement.
 *
 * Setting this element's order to one less would not move it: the element above would then share the
 * number, and CSS breaks that tie by document order — which is exactly the order being undone. So
 * both elements get an explicit number, and they trade places. One history step, because trading
 * places is one act.
 *
 * The same document back when the element is already first, so the control can be pressed at the top
 * of the list without opening a step that changed nothing.
 */
export function moveUpOnMobile(
  doc: RetorikaDocument,
  sectionId: string,
  elementId: string,
): RetorikaDocument {
  return withMobilePatches(doc, sectionId, "moveUpOnMobile", (section) => {
    const sequence = mobileSequence(section);
    const at = sequence.findIndex((slot) => slot.elementId === elementId);
    if (at === -1) {
      throw new Error(`moveUpOnMobile: section "${sectionId}" has no element "${elementId}"`);
    }
    const above = sequence[at - 1];
    const mine = sequence[at];
    if (!above || !mine) return section.layout?.breakpoints?.mobile ?? [];

    const layout = section.layout;
    if (!layout) return [];

    const first = withPatch(section, mine.elementId, { order: above.order });
    // Applied to a section already carrying the first change, so the second does not overwrite it.
    return withPatch(
      { ...section, layout: { ...layout, breakpoints: { ...layout.breakpoints, mobile: first } } },
      above.elementId,
      { order: mine.order },
    );
  });
}
