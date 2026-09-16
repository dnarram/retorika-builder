import type { ContentElement, Section } from "./document.ts";
import { flattenElements } from "./invariants.ts";
import type { PresetShape } from "./preset.ts";

/**
 * Escalating a section to a hand-designed layout, and coming back.
 *
 * The advanced dossier calls the return "lo que Wix no tiene": it is one click, it
 * destroys nothing, and it works because a free section is a *datum* rather than a mode
 * — `source: "free"` plus its own layout, instead of a converted document.
 */

/** Escalate: copy the catalog layout into the section so not a pixel moves. */
export function escalate(section: Section, preset: PresetShape): Section {
  if (section.source === "free") return structuredClone(section);
  return {
    ...structuredClone(section),
    source: "free",
    // The copy keeps the element ids, which is what lets every text and photo find its
    // exact slot again on the way back, with no guessing.
    layout: structuredClone(preset.layoutFor(section.preset.variantId)),
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
  const elements = flattenElements(section.content);
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

  const breakpoints = section.layout?.breakpoints;
  const dropsBreakpointAdjustments =
    (breakpoints?.tablet?.length ?? 0) > 0 || (breakpoints?.mobile?.length ?? 0) > 0;

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
