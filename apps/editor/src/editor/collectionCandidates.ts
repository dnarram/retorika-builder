import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import { collectionFromList, findSection, type RetorikaDocument } from "@retorika/schema";

/**
 * **What «Listas» may offer to turn into a list, asked by trying it** (sprint 40 día 1).
 *
 * The panel drew «Hacer una lista con las tarjetas de «X»» for every section holding a list that was
 * not bound and had at least one card — and nothing looked at what the cards carried. The verb,
 * `collectionFromList`, refuses a card with a photograph (a list entry holds words and the emphasis
 * over them, and whether it may hold a photograph is a decision ADR 0033 did not take). Nothing caught
 * the refusal, so a Galería or an Equipo answered the press with «Algo ha fallado» — the dead button
 * that looked alive, which ADR 0025 §5 refused by name: below what can be done the control is
 * **absent**, not disabled. A restaurant is born with a Galería (ADR 0039), so that was the owner's
 * first day.
 *
 * **Pure, and it asks the verb rather than restating its conditions**: `canBind` has kept its own
 * answer honest since sprint 14 by calling `bindList` inside a try, so that the panel's offer and the
 * verb's refusal are two renderings of one fact rather than two rules that agree today. This does the
 * same for the other offer. The verb builds a collection and parses the document, which is a few
 * milliseconds per candidate section and happens only while «Listas» is drawn.
 */

export interface CollectionCandidate {
  sectionId: string;
  slot: string;
  /** The catalog's Spanish name for the section — what the new list is called unless renamed. */
  suggestedName: string;
}

/** A list this section has that is **not** bound — the subject of «Hacer una lista». */
export function looseListOf(doc: RetorikaDocument, sectionId: string): string | undefined {
  const found = findSection(doc, sectionId);
  if (!found) return undefined;
  return found.section.content.find(
    (element) => element.role === "list" && !element.binding && (element.items ?? []).length > 0,
  )?.slot;
}

/** The catalog's Spanish name for a section, or its id for one the catalog does not name. */
export function sectionDisplayName(doc: RetorikaDocument, sectionId: string): string {
  const found = findSection(doc, sectionId);
  if (!found) return sectionId;
  const key = `section.${found.section.preset.catalogId}.name` as keyof typeof catalogEs;
  return catalogEs[key] ?? sectionId;
}

/**
 * Every section whose cards the verb would actually turn into a list, in page and reading order.
 * A section the verb refuses — a bound list, no cards, a card with a photograph — is simply not
 * here, and the panel draws nothing for it.
 */
export function collectionCandidates(doc: RetorikaDocument): CollectionCandidate[] {
  return doc.pages.flatMap((page) =>
    page.sections.flatMap((section): CollectionCandidate[] => {
      const slot = looseListOf(doc, section.id);
      if (slot === undefined) return [];
      const suggestedName = sectionDisplayName(doc, section.id);
      try {
        collectionFromList(doc, section.id, slot, suggestedName);
      } catch {
        return [];
      }
      return [{ sectionId: section.id, slot, suggestedName }];
    }),
  );
}
