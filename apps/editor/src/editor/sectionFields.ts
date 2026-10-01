import { presetFor } from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import {
  findSection,
  type ItemAddress,
  type ListItem,
  listDeadDestinations,
  type PresetSlot,
  type RetorikaDocument,
  type Role,
} from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };

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
 *
 * **A section designed by hand lists the same rows as one drawn by the catalog.** This function used
 * to answer nothing at all unless `source === "catalog"`, which cost nothing while no section could
 * be anything else, and would have emptied the panel the instant somebody accepted «Diseñar a mano»
 * (ADR 0025). `INV_1` says the simple view exposes every content field, and the advanced dossier §2
 * says «es el mismo documento en las dos vistas»; escalating a section changes where its layout
 * lives and nothing about which fields it has. A free section keeps its preset reference, so the
 * rows come out identical.
 *
 * The limit worth naming: an element whose slot the preset does not declare would not be listed. No
 * verb in the product can produce one — a free section's content is whatever the catalog section
 * had — so there is nothing to show yet, and inventing a row labelled with a raw slot id would put
 * an English identifier on a Spanish screen. When the studio can add elements, this is where it is
 * paid for.
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
  /**
   * Present when this row is a slot **of a line** rather than one of the section's own.
   *
   * The line is named by id, for the reason `ItemAddress` gives: a position would be read against a
   * list the owner can reorder and delete from.
   */
  item?: ItemAddress;
  /** What the group holding this row is headed with. Only on an item row, and the same string for
   * every row of one line. */
  lineName?: string;
}

function slotLabel(catalogId: string, slot: string): string {
  const key = `section.${catalogId}.slot.${slot}` as keyof typeof catalogEs;
  return catalogEs[key] ?? slot;
}

/** A line's own slot, named in Spanish by the catalog. Every one of these keys already existed —
 * they were written when a line gained its add and remove controls — so nothing here invents a word
 * for a screen in Spanish, which is what this file's own comment refuses to do. */
function itemSlotLabel(catalogId: string, slot: string): string {
  const key = `section.${catalogId}.item.${slot}` as keyof typeof catalogEs;
  return catalogEs[key] ?? slot;
}

/**
 * What a line's group of rows is headed with.
 *
 * **Its own words first.** A carta of twelve dishes under «Línea 1» … «Línea 12» makes the owner
 * count rows on the page to find the one they meant; under «Ensaladilla» they find it by reading.
 * So the heading is the line's own `heading` slot when that carries text — **derived, never
 * copied**, which is the reason ADR 0029 gives for the description and ADR 0022 for the teaser:
 * there is nothing to keep in step.
 *
 * The fallback is the generic word plus a number, and `gallery` gets the only override. That is
 * exactly the table `editor.line.*` already keeps, and its comment says why: a photograph is not a
 * line, while «Qué hago» and «Opiniones» have shipped through two usability sessions calling theirs
 * one. Changing a word those sessions saw is a product decision rather than a tidy-up, so this does
 * not change any.
 */
function lineHeading(
  catalogId: string,
  itemSlots: readonly PresetSlot[],
  item: ListItem,
  index: number,
): string {
  const headingSlot = itemSlots.find((slot) => slot.role === "heading");
  const named = headingSlot
    ? item.elements.find((element) => element.slot === headingSlot.slot && !element.hidden)
    : undefined;
  const text = named?.value?.kind === "text" ? named.value.text.trim() : "";
  if (text !== "") return text;
  const table = es as Record<string, string | undefined>;
  const word = table[`editor.fields.line.${catalogId}`] ?? es["editor.fields.line"];
  return `${word} ${index + 1}`;
}

export function sectionFields(doc: RetorikaDocument, sectionId: string): FieldRow[] {
  const found = findSection(doc, sectionId);
  if (!found) return [];

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

  // The lines. Every editable slot of every line, which is what `INV_1` asks of a simple view —
  // «exposes every content field» — and what this panel did not do until sprint 12. Reaching a
  // line's slot meant clicking its text on the page, and for an unfilled `0..1` slot there is no
  // text on the page: `SERVICES_ITEM_SLOTS.description` and `PRICES_ITEM_SLOTS.description` were
  // the two that fell through, and they are the only two (every other item slot is `min: 1`, so it
  // exists in a new line and the canvas reaches it). See #133.
  const itemSlots = preset.itemSlots;
  const list = itemSlots
    ? found.section.content.find((element) => element.role === "list")
    : undefined;
  for (const [index, item] of (list?.items ?? []).entries()) {
    if (!itemSlots || !list) break;
    const lineName = lineHeading(catalogId, itemSlots, item, index);
    const address: ItemAddress = { list: list.slot, id: item.id };

    for (const slot of itemSlots) {
      if (!EDITABLE_ROLES.includes(slot.role)) continue;
      const kind = slot.role === "button" || slot.role === "link" ? "link" : "text";
      const existing = item.elements.filter((element) => element.slot === slot.slot);

      // Occurrences are handled rather than assumed away. Every item slot the catalog declares today
      // is `max: 1`, so this loop runs once — but writing it for one would make a preset that ever
      // declares two silently drop the second, and the arithmetic is the same five lines either way.
      const label = (occurrence: number) =>
        occurrence === 0
          ? itemSlotLabel(catalogId, slot.slot)
          : `${itemSlotLabel(catalogId, slot.slot)} ${occurrence + 1}`;

      for (const [occurrence, element] of existing.entries()) {
        const value = element.value;
        const text = element.hidden ? "" : value?.kind === "text" ? value.text : "";
        rows.push({
          slot: slot.slot,
          occurrence,
          role: slot.role,
          label: label(occurrence),
          kind,
          elementId: element.id,
          text,
          ...(kind === "link" ? { href: "" } : {}),
          required: slot.min > 0,
          ...(deadIds.has(element.id) ? { dead: true } : {}),
          item: address,
          lineName,
        });
      }

      // The row that makes the two descriptions reachable: counted against every element rather than
      // the visible ones, so a hidden one is offered back instead of shadowed by a new sibling.
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
          item: address,
          lineName,
        });
      }
    }
  }

  return rows;
}

/** A line's rows, under the heading the panel puts over them. */
export interface FieldLine {
  id: string;
  name: string;
  rows: FieldRow[];
}

/**
 * The rows split into the section's own and one group per line.
 *
 * **Here rather than in the panel**, which is where it would naturally live, for one reason: the
 * panel is a React component and `apps/editor`'s vitest project has no DOM, so nothing would test
 * it. Grouping is where the collision hides — a line's `slot`/`occurrence` pair repeats on every
 * line, so «the second dish's description» and «the first dish's description» are the same key — and
 * an untested grouping is how two inputs come to share one value.
 *
 * Consecutive runs, not a lookup: `sectionFields` emits a line's rows together and in line order, so
 * the order the owner sees matches the order on the page without anything having to sort.
 */
export function groupedFields(rows: readonly FieldRow[]): {
  sectionRows: FieldRow[];
  lines: FieldLine[];
} {
  const sectionRows: FieldRow[] = [];
  const lines: FieldLine[] = [];
  for (const row of rows) {
    if (!row.item) {
      sectionRows.push(row);
      continue;
    }
    const last = lines.at(-1);
    if (last && last.id === row.item.id) last.rows.push(row);
    else lines.push({ id: row.item.id, name: row.lineName ?? "", rows: [row] });
  }
  return { sectionRows, lines };
}

/**
 * What committing one of a row's boxes should actually do (ADR 0027 §4b, and the bug that found it).
 *
 * **The fields panel used to answer this one way for everything, and it destroyed every mark on the
 * field it touched.** Measured on 1 October 2026: the panel built a whole `ContentValue` and sent it
 * through `fillSlot`, which replaces `value` outright — so a bolded word edited from the panel came
 * back unbolded, and, worse, came back unbolded **even when the text had not changed at all**, because
 * blurring an untouched box committed the same rebuilt value. Clicking into a field and clicking away
 * was enough to strip the formatting off it.
 *
 * It is the opposite of the canvas, where `withText` has shifted marks since sprint 10 — the same
 * split `withText`'s own comment warned about: «a mark that survives the canvas but not the fields
 * panel is worse than one that never survived at all».
 *
 * So the three cases are told apart here, as a pure function, because the panel is a React component
 * and this is the part worth having a test on:
 *
 * - **`clear`** — an empty label is an empty field, whatever the destination says.
 * - **`text`** — the element exists and only its words changed. Goes through `setElementText`, which
 *   is the one chokepoint that moves marks with the text under them.
 * - **`fill`** — everything that is not just words: a slot the document does not have yet, and a
 *   link whose destination moved. `fillSlot` writes a whole value because a whole value is what
 *   changed; a destination carries no marks, and a slot being created has none to lose.
 */
export type FieldCommit =
  | { kind: "clear" }
  | { kind: "text"; elementId: string; text: string }
  | { kind: "fill" };

export function fieldCommitFor(row: FieldRow, text: string, href: string): FieldCommit {
  if (text.trim() === "") return { kind: "clear" };
  // No element yet: there is nothing to edit the text of, and no mark to keep.
  if (row.elementId === undefined) return { kind: "fill" };
  // A link whose destination changed is a value change, not a text edit. Compared trimmed, because
  // that is what both paths store.
  if (row.kind === "link" && href.trim() !== (row.href ?? "").trim()) return { kind: "fill" };
  return { kind: "text", elementId: row.elementId, text: text.trim() };
}
