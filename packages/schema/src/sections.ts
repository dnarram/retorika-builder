import type { Page, RetorikaDocument, Section } from "./document.ts";
import { parseDocument } from "./parse.ts";

/**
 * Structural mutations on a document — add, remove, move, duplicate a section — as opposed to
 * `fields.ts`, which only ever replaces a value already there. Deliberately kept apart: the
 * comment on `applyTextEdits` promises it "cannot add, remove or move an element", and that
 * promise only stays true if verbs that do exactly that live somewhere else.
 *
 * Every function here is pure (document in, document out) and ends by handing its result to
 * `parseDocument`, the same validation gate everything that writes a document in this
 * repository goes through — never assumed safe just because the change was structural.
 */

export function findSection(
  doc: RetorikaDocument,
  sectionId: string,
): { page: Page; section: Section } | undefined {
  for (const page of doc.pages) {
    const section = page.sections.find((candidate) => candidate.id === sectionId);
    if (section) return { page, section };
  }
  return undefined;
}

/**
 * Real deletion, not a hide: ADR 0003 settled that there is no trash inside the document, and
 * ADR 0014 settled that this runs immediately, with no confirmation — the undo history the
 * editor already keeps (day 2) is the safety net, not a dialog. Throws on an unknown id rather
 * than doing nothing: every id the editor sends came from a section it just showed the user,
 * so a miss is a bug, and silently doing nothing would look like a delete that did not work.
 */
export function deleteSection(doc: RetorikaDocument, sectionId: string): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`deleteSection: no section "${sectionId}"`);

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) =>
      page.id === found.page.id
        ? { ...page, sections: page.sections.filter((section) => section.id !== sectionId) }
        : page,
    ),
  });
}
