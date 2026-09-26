import { presetFor } from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import {
  findSection,
  listDeadDestinations,
  type RetorikaDocument,
  type Role,
} from "@retorika/schema";

/**
 * A section's fields, as the panel lists them: one row per slot the preset declares, named in
 * Spanish by the catalog's own locale.
 *
 * The rows come from the **preset**, not from the document, and that is the whole point. An
 * optional slot nobody filled does not exist in the document, so it renders as nothing, so
 * click-to-edit cannot reach it — there is no text on the page to click. The preset is the only
 * thing that knows the slot was ever available.
 *
 * An empty row and a hidden element are the same thing here, deliberately. To the person looking
 * at the page there is no difference between "this field has no value" and "this field is not
 * shown", so the panel offers one idea instead of two: type to put it on the page, clear it to
 * take it off. Document rule 3 is honoured underneath — clearing hides, it never removes.
 */

/** The roles the panel can honestly edit with a text box. An image has its own affordance (click
 * the photo, ADR 0018); a list holds items rather than a value; and a map wants coordinates,
 * which is ADR 0004's other half and does not exist. Offering an empty box for any of those
 * would be a field that cannot be filled. */
const EDITABLE_ROLES: readonly Role[] = ["heading", "subheading", "body", "button", "link"];

export interface FieldRow {
  slot: string;
  occurrence: number;
  role: Role;
  /** The catalog's Spanish name for the slot, numbered when a slot holds more than one. */
  label: string;
  /** A link carries a destination as well as a label; everything else is one box. */
  kind: "text" | "link";
  /** The element's id, when it exists. Absent for a slot the document does not have yet. */
  elementId?: string;
  text: string;
  href?: string;
  required: boolean;
  /** This link's destination goes nowhere, by the same rule `/api/download` refuses on. */
  dead?: boolean;
}

function slotLabel(catalogId: string, slot: string): string {
  const key = `section.${catalogId}.slot.${slot}` as keyof typeof catalogEs;
  return catalogEs[key] ?? slot;
}

export function sectionFields(doc: RetorikaDocument, sectionId: string): FieldRow[] {
  const found = findSection(doc, sectionId);
  if (!found) return [];
  if (found.section.source !== "catalog") return [];

  let preset: ReturnType<typeof presetFor>;
  try {
    preset = presetFor(found.section.preset.catalogId);
  } catch {
    // A section whose catalog id nothing recognises has no shape to list. The document is
    // already invalid by then and `/api/download` says so; the panel just stays empty.
    return [];
  }

  const deadIds = new Set(
    listDeadDestinations(doc)
      .filter((entry) => entry.sectionId === sectionId)
      .map((entry) => entry.elementId),
  );
  const catalogId = found.section.preset.catalogId;
  const rows: FieldRow[] = [];

  for (const slot of preset.slots) {
    if (!EDITABLE_ROLES.includes(slot.role)) continue;
    const kind = slot.role === "button" || slot.role === "link" ? "link" : "text";
    const existing = found.section.content.filter((element) => element.slot === slot.slot);

    const label = (occurrence: number) =>
      occurrence === 0
        ? slotLabel(catalogId, slot.slot)
        : `${slotLabel(catalogId, slot.slot)} ${occurrence + 1}`;

    for (const [occurrence, element] of existing.entries()) {
      const value = element.value;
      // A hidden element reads as an empty field: same idea, one control.
      const text = element.hidden
        ? ""
        : value?.kind === "link"
          ? value.text
          : value?.kind === "text"
            ? value.text
            : "";
      const href = element.hidden ? "" : value?.kind === "link" ? value.href : undefined;
      rows.push({
        slot: slot.slot,
        occurrence,
        role: slot.role,
        label: label(occurrence),
        kind,
        elementId: element.id,
        text,
        ...(kind === "link" ? { href: href ?? "" } : {}),
        required: slot.min > 0,
        ...(deadIds.has(element.id) ? { dead: true } : {}),
      });
    }

    // One more empty row while the preset would still take another. Counted against every
    // element rather than the visible ones, so a hidden one is offered back rather than
    // shadowed by a new sibling nobody asked for.
    if (existing.length < slot.max) {
      rows.push({
        slot: slot.slot,
        occurrence: existing.length,
        role: slot.role,
        label: label(existing.length),
        kind,
        text: "",
        ...(kind === "link" ? { href: "" } : {}),
        required: slot.min > existing.length,
      });
    }
  }

  return rows;
}
