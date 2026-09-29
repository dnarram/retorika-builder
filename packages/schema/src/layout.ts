import type { RetorikaDocument } from "./document.ts";
import { parseDocument } from "./parse.ts";
import type { PresetShape } from "./preset.ts";
import { applyRevert, escalate, planRevert, type SurplusDecision } from "./revert.ts";
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
