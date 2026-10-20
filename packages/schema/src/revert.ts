import { type ContentElement, FINE_COLUMNS, type Section } from "./document.ts";
import { coarseToFine, type MeasuredBox, measuredToFine } from "./fineGrid.ts";
import type { PresetShape } from "./preset.ts";

/**
 * Escalating a section to a hand-designed layout, and coming back.
 *
 * The advanced dossier calls the return "lo que Wix no tiene": it is one click, it
 * destroys nothing, and it works because a free section is a *datum* rather than a mode
 * — `source: "free"` plus its own layout, instead of a converted document.
 */

/**
 * Escalate: copy the catalog layout into the section so not a pixel moves.
 *
 * **Written in the fine grid's units** (ADR 0050): the catalog draws on twelve columns and content
 * rows, a free section is ninety-six units and eight-pixel rows. Sideways the conversion is exact
 * either way. The vertical has two sources, and which one is used is decided **per element**:
 *
 * - **A measured box wins** (sprint 25 día 2). The caller that has the section on screen passes
 *   what each element's box actually was, and `measuredToFine` turns it into the rows it really
 *   occupied — so the page the instant after is the page the instant before, to within four pixels,
 *   including where the catalog had centred something in a row taller than itself.
 * - **The theme's rhythm is the fallback**, element by element: `gapRows` empty rows stand for one
 *   `space.md` gap between two catalog rows (`gapRowsFor`). It answers for an element nothing could
 *   measure — a hidden one, which rule 3 keeps in the document and the renderer draws nowhere — and
 *   for a caller with no page at all, which is migration 0013 and every test that has no browser.
 *
 * Mixing the two in one section is deliberate rather than tolerated: an element that is not drawn
 * has no box to read, and the rhythm is the best that can be said about where it would have been.
 */
export function escalate(
  section: Section,
  preset: PresetShape,
  gapRows: number,
  boxes?: readonly MeasuredBox[],
): Section {
  if (section.source === "free") return structuredClone(section);
  const drawn = preset.layoutFor(section.preset.variantId, section.content);
  const measured = new Map((boxes ?? []).map((box) => [box.elementId, box]));
  return {
    ...structuredClone(section),
    source: "free",
    // The copy keeps the element ids, which is what lets every text and photo find its
    // exact slot again on the way back, with no guessing. Only top-level elements have a
    // slot on the section grid: a list is placed as one element and its items flow inside it.
    layout: {
      grid: { columns: FINE_COLUMNS },
      placements: drawn.placements.map((placement) => {
        const box = measured.get(placement.elementId);
        return box ? measuredToFine(placement, box) : coarseToFine(placement, gapRows);
      }),
      breakpoints: drawn.breakpoints,
    },
  };
}

export type SurplusDecision = "hide" | "delete";

export interface RevertPlan {
  /** Elements that land back in a declared slot, by element id. */
  assignments: { elementId: string; slot: string }[];
  /**
   * Elements the preset has nowhere to put. Nothing happens to these without an
   * explicit decision — see `applyRevert`.
   */
  surplus: { elementId: string; slot: string; reason: string }[];
  /** True when reverting drops per-breakpoint adjustments, which the dialog must say. */
  dropsBreakpointAdjustments: boolean;
}

/**
 * Work out what reverting would do, without doing it.
 *
 * Splitting the plan from the application is what lets the interface show both versions
 * and what does not fit *before* applying anything, which is the dossier's promise.
 */
export function planRevert(section: Section, preset: PresetShape): RevertPlan {
  // Top-level elements only. A list is one element in its slot and its items travel inside
  // it: walking into them would report every card as surplus, since the preset declares
  // slots for the section, not for the inside of an item.
  const elements = section.content;
  const assignments: RevertPlan["assignments"] = [];
  const surplus: RevertPlan["surplus"] = [];

  const remaining = new Map(preset.slots.map((slot) => [slot.slot, slot]));
  const visibleTaken = new Map<string, number>();

  for (const element of elements) {
    const slot = remaining.get(element.slot);
    if (!slot) {
      surplus.push({
        elementId: element.id,
        slot: element.slot,
        reason: `the preset declares no slot "${element.slot}"`,
      });
      continue;
    }
    if (element.role !== slot.role) {
      surplus.push({
        elementId: element.id,
        slot: element.slot,
        reason: `slot "${slot.slot}" expects role "${slot.role}" but the element carries "${element.role}"`,
      });
      continue;
    }

    const taken = visibleTaken.get(slot.slot) ?? 0;
    if (!element.hidden && taken >= slot.max) {
      surplus.push({
        elementId: element.id,
        slot: element.slot,
        reason: `slot "${slot.slot}" shows at most ${slot.max}`,
      });
      continue;
    }
    if (!element.hidden) visibleTaken.set(slot.slot, taken + 1);
    assignments.push({ elementId: element.id, slot: element.slot });
  }

  // One bucket since 1.4.0 (ADR 0030). This read `tablet` as well until then, which was always a
  // disjunction with one reachable half: nothing could write a tablet patch and the renderer threw
  // on one.
  const dropsBreakpointAdjustments = (section.layout?.breakpoints?.mobile?.length ?? 0) > 0;

  return { assignments, surplus, dropsBreakpointAdjustments };
}

export class RevertDecisionRequiredError extends Error {
  readonly undecided: readonly string[];

  constructor(undecided: readonly string[]) {
    super(
      `Reverting would affect ${undecided.length} element(s) the preset cannot place, and each needs an explicit decision: ${undecided.join(", ")}`,
    );
    this.name = "RevertDecisionRequiredError";
    this.undecided = undecided;
  }
}

function applyDecisions(
  elements: readonly ContentElement[],
  decisions: Readonly<Record<string, SurplusDecision>>,
): ContentElement[] {
  const out: ContentElement[] = [];
  for (const element of elements) {
    const decision = decisions[element.id];
    if (decision === "delete") continue;

    const next: ContentElement = { ...element };
    if (decision === "hide") next.hidden = true;
    if (element.items) {
      next.items = element.items.map((item) => ({
        id: item.id,
        elements: applyDecisions(item.elements, decisions),
      }));
    }
    out.push(next);
  }
  return out;
}

/**
 * Revert to the catalog preset.
 *
 * **Throws** if any surplus element arrives without an explicit decision. This is the
 * guarantee that "nada se borra en silencio" lives in the shape of the API rather than
 * in a dialog: a dialog can be dismissed or rebuilt wrongly in a future screen, a
 * required argument cannot. The interface's default for the decision is "hide".
 *
 * Losing the section's own layout and its breakpoint patches is correct by rule 1 —
 * layout never owns content — and `planRevert` reports it so the dialog can warn.
 */
export function applyRevert(
  section: Section,
  preset: PresetShape,
  decisions: Readonly<Record<string, SurplusDecision>> = {},
): Section {
  const plan = planRevert(section, preset);

  const undecided = plan.surplus
    .filter((item) => decisions[item.elementId] === undefined)
    .map((item) => item.elementId);
  if (undecided.length > 0) throw new RevertDecisionRequiredError(undecided);

  return {
    ...structuredClone(section),
    source: "catalog",
    layout: null,
    content: applyDecisions(section.content, decisions),
  };
}
