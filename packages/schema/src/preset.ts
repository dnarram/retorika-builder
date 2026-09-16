import type { ContentElement, Section, SectionLayout } from "./document.ts";
import { flattenElements, type Violation } from "./invariants.ts";
import type { Role } from "./roles.ts";

/**
 * The structural shape of a catalog preset.
 *
 * Declared here as a plain interface rather than imported from @retorika/catalog so the
 * dependency arrow stays one-way: catalog depends on schema, never the reverse.
 */
export interface PresetSlot {
  slot: string;
  role: Role;
  min: number;
  max: number;
}

export interface PresetShape {
  catalogId: string;
  slots: readonly PresetSlot[];
  /**
   * The preset's layout for a variant, resolved against the section's own elements.
   *
   * It takes the elements because a placement references an element *id* (rule 1) and a
   * preset cannot know the ids of a document it has never seen. So the catalog declares
   * the geometry per slot, and this resolves each slot to the actual element filling it.
   * That resolution is also what makes the return from a hand-designed layout lossless:
   * the ids line up on the way back with no guessing.
   */
  layoutFor(variantId: string, elements: readonly ContentElement[]): SectionLayout;
}

/**
 * Rule 3, made checkable: **hidden elements count as present.**
 *
 * A 1..1 slot whose element is hidden is valid; that same slot with the element absent
 * is a violation. That asymmetry is the whole rule — the client can put their phone
 * number out of sight, but nothing may take away the place where they change it.
 *
 * Minimum and maximum therefore count different things, and they have to:
 *
 * - **min counts every element, hidden included.** The minimum exists so the place to
 *   edit cannot disappear, and a hidden element still provides it.
 * - **max counts only visible elements.** The maximum is about how many the preset's
 *   layout can show. Counting hidden ones against it would make `applyRevert` with the
 *   decision "hide" produce a section that violates its own preset — which is exactly
 *   the case the dossier requires to work, since surplus content from a free section is
 *   parked hidden rather than deleted.
 *
 * Any other reading makes the two requirements unsatisfiable at once.
 */
export function checkAgainstPreset(section: Section, preset: PresetShape): Violation[] {
  const violations: Violation[] = [];
  const elements = flattenElements(section.content);

  for (const slot of preset.slots) {
    const filling = elements.filter((element) => element.slot === slot.slot);
    const visible = filling.filter((element) => !element.hidden);

    if (filling.length < slot.min) {
      violations.push({
        rule: 3,
        path: `section#${section.id}.slot:${slot.slot}`,
        message: `slot requires at least ${slot.min} element(s) but has ${filling.length}; hiding is allowed, removing is not`,
      });
    }
    if (visible.length > slot.max) {
      violations.push({
        rule: 3,
        path: `section#${section.id}.slot:${slot.slot}`,
        message: `slot shows at most ${slot.max} element(s) but ${visible.length} are visible`,
      });
    }

    for (const element of filling) {
      if (element.role !== slot.role) {
        violations.push({
          rule: 2,
          path: `section#${section.id}.slot:${slot.slot}#${element.id}`,
          message: `slot expects role "${slot.role}" but the element carries "${element.role}"`,
        });
      }
    }
  }

  const known = new Set(preset.slots.map((slot) => slot.slot));
  for (const element of elements) {
    if (!known.has(element.slot)) {
      violations.push({
        rule: 2,
        path: `section#${section.id}#${element.id}`,
        message: `element fills slot "${element.slot}", which the preset does not declare`,
      });
    }
  }

  return violations;
}
