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

/**
 * A section id not already used anywhere in the document, deterministic and derived from
 * `base` — no clock, no random suffix, so two builds of the same sequence of edits produce the
 * same ids and the golden corpus stays meaningful. `base` is normally the id being duplicated
 * from, already taken by definition, so this always looks past it: `sec-cover` first tries
 * `sec-cover-2`, and duplicating that tries `sec-cover-3` rather than `sec-cover-2-2` — the
 * existing `-2` is stripped before counting up, so duplicating a duplicate does not nest.
 */
export function mintSectionId(doc: RetorikaDocument, base: string): string {
  const used = new Set(doc.pages.flatMap((page) => page.sections.map((section) => section.id)));
  const root = base.replace(/-\d+$/, "");
  if (!used.has(root)) return root;
  let suffix = 2;
  while (used.has(`${root}-${suffix}`)) suffix += 1;
  return `${root}-${suffix}`;
}

/**
 * A copy of a section, right after the original on the same page, with a freshly minted id.
 *
 * Everything else about the clone — every element id, every layout placement, every
 * breakpoint patch — is copied verbatim, deliberately. Element ids are unique only *within* a
 * section (`checkSection` in invariants.ts), so keeping them means the clone's own layout
 * (which references those same ids in its placements) stays valid without rewriting a single
 * one; re-minting them would mean rebuilding the layout too, for no benefit the user would ever
 * see. What must not collide is the one id that is unique document-wide: the section's own.
 */
export function duplicateSection(doc: RetorikaDocument, sectionId: string): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`duplicateSection: no section "${sectionId}"`);
  const clone: Section = { ...found.section, id: mintSectionId(doc, sectionId) };

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== found.page.id) return page;
      const index = page.sections.findIndex((section) => section.id === sectionId);
      const sections = [...page.sections];
      sections.splice(index + 1, 0, clone);
      return { ...page, sections };
    }),
  });
}

/**
 * A section moved to `toIndex` on its own page, the rest kept in their relative order.
 * `toIndex` is clamped to the page's bounds rather than rejected: a caller building this from
 * "move up" / "move down" on the section nearest an edge can just decrement or increment past
 * the end without special-casing it, and clamping is exactly what should happen there.
 */
export function moveSection(
  doc: RetorikaDocument,
  sectionId: string,
  toIndex: number,
): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`moveSection: no section "${sectionId}"`);

  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== found.page.id) return page;
      const sections = [...page.sections];
      const fromIndex = sections.findIndex((section) => section.id === sectionId);
      const [moved] = sections.splice(fromIndex, 1);
      if (!moved) throw new Error(`moveSection: no section "${sectionId}"`);
      const clamped = Math.max(0, Math.min(toIndex, sections.length));
      sections.splice(clamped, 0, moved);
      return { ...page, sections };
    }),
  });
}

/**
 * A section placed at `toIndex` on a given page, the rest shifted down.
 *
 * The section arrives fully built — the catalog's `blankSection` or the generator's own
 * `contactSectionFor` makes it — because what a valid empty section of a given kind looks like
 * is the catalog's business, and this package must not depend on it (the dependency arrow runs
 * catalog → schema, never back). All that is enforced here is what only the document can know:
 * that the page exists and that the id is free. `mintSectionId` is how a caller gets a free one.
 *
 * `toIndex` is clamped, like `moveSection`: a caller inserting "after the last section" can pass
 * `sections.length` or anything beyond it without special-casing the end.
 */
export function insertSection(
  doc: RetorikaDocument,
  pageId: string,
  toIndex: number,
  section: Section,
): RetorikaDocument {
  const page = doc.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`insertSection: no page "${pageId}"`);
  if (findSection(doc, section.id)) {
    throw new Error(`insertSection: section id "${section.id}" is already taken`);
  }

  return parseDocument({
    ...doc,
    pages: doc.pages.map((candidate) => {
      if (candidate.id !== pageId) return candidate;
      const sections = [...candidate.sections];
      sections.splice(Math.max(0, Math.min(toIndex, sections.length)), 0, section);
      return { ...candidate, sections };
    }),
  });
}
