import type { Page, RetorikaDocument } from "./document.ts";
import { withoutActionTo } from "./header.ts";
import { parseDocument } from "./parse.ts";

/**
 * Verbs on the pages of a document — rename, reorder, remove.
 *
 * There is no `addPage`, and that is the decision rather than an omission: [ADR 0022] says a page
 * is born by converting a section, so that no empty page can exist. The verb that creates one lives
 * with the conversion.
 *
 * **The first page is the entry and cannot move.** `packages/publisher` writes it as `index.html`
 * whatever it is slugged, and [ADR 0023] derives the menu from its sections — so swapping which
 * page is first would silently rewrite both the file layout and the navigation of a site somebody
 * has already published. Reordering works on everything after it.
 */

function indexOfPage(doc: RetorikaDocument, pageId: string): number {
  return doc.pages.findIndex((page) => page.id === pageId);
}

function withPages(doc: RetorikaDocument, pages: Page[]): RetorikaDocument {
  return parseDocument({ ...doc, pages });
}

/**
 * A different name for a page — and only the name.
 *
 * **The slug does not follow.** A page's file is named once, when the page is created, and then
 * held still: renaming is something an owner does freely and often, and if the file moved with the
 * name then every link into that page would break on a whim. Nobody sees the slug (ADR 0022), which
 * is exactly what makes it safe to hold still.
 */
export function renamePage(doc: RetorikaDocument, pageId: string, title: string): RetorikaDocument {
  const at = indexOfPage(doc, pageId);
  if (at < 0) throw new Error(`renamePage: no page "${pageId}"`);
  if (doc.pages[at]?.title === title) return doc;
  return withPages(
    doc,
    doc.pages.map((page, index) => (index === at ? { ...page, title } : page)),
  );
}

/**
 * Whether this page appears in the menu (ADR 0043 §3).
 *
 * **Refuses the two pages that have no entry to govern**, the way `movePage` refuses the first
 * page: the entry page is «Inicio», which is not curatable — hiding the way home is a trap rather
 * than a choice — and a page drawn per entry is in no menu at all (ADR 0040 §5). An editor cannot
 * reach either switch, and this is what keeps a document from storing a decision that means
 * nothing.
 *
 * Writes the boolean and never deletes the key: its **presence** is the record that somebody
 * decided, which is what the threshold reads. Returns the same document when nothing would change,
 * so a history built on reference equality opens no step — and note that `undefined !== true`, so
 * stamping the default *is* a change, which is the point.
 */
export function setPageInMenu(
  doc: RetorikaDocument,
  pageId: string,
  inMenu: boolean,
): RetorikaDocument {
  const at = indexOfPage(doc, pageId);
  if (at < 0) throw new Error(`setPageInMenu: no page "${pageId}"`);
  if (at === 0) throw new Error("setPageInMenu: the entry page is «Inicio» and is not in the menu");
  if (doc.pages[at]?.binding)
    throw new Error("setPageInMenu: a page drawn per entry is in no menu");
  if (doc.pages[at]?.inMenu === inMenu) return doc;
  return withPages(
    doc,
    doc.pages.map((page, index) => (index === at ? { ...page, inMenu } : page)),
  );
}

/**
 * A page moved to another position, which is also the order the menu reads in.
 *
 * Refuses to move the first page or to move anything into its place, for the reason at the top of
 * this file. Returns the same document when nothing would change, so a history built on reference
 * equality opens no step.
 */
export function movePage(doc: RetorikaDocument, pageId: string, toIndex: number): RetorikaDocument {
  const from = indexOfPage(doc, pageId);
  if (from < 0) throw new Error(`movePage: no page "${pageId}"`);
  if (from === 0) {
    throw new Error(`movePage: "${pageId}" is the first page, which is the entry and cannot move`);
  }
  if (toIndex < 1 || toIndex >= doc.pages.length) {
    throw new Error(
      `movePage: cannot move to ${toIndex} — the first position belongs to the entry, and there are ${doc.pages.length} pages`,
    );
  }
  if (from === toIndex) return doc;

  const pages = [...doc.pages];
  const [moved] = pages.splice(from, 1);
  if (!moved) throw new Error(`movePage: no page at ${from}`);
  pages.splice(toIndex, 0, moved);
  return withPages(doc, pages);
}

/**
 * A page gone, with everything on it.
 *
 * Real deletion, for the reason ADR 0003 gives about sections: there is no trash inside the
 * document, and the undo history is the safety net rather than a dialog (ADR 0014). What the editor
 * owes the person is the count of what pointed here, said *before* the delete while «Deshacer» is
 * still on screen — `listAnchorsTo` and `listLinksTo` are what it asks.
 *
 * Refuses to delete the first page: a site with no entry has no `index.html`, and `pages` is
 * `min(1)` in the schema anyway.
 */
export function deletePage(doc: RetorikaDocument, pageId: string): RetorikaDocument {
  const at = indexOfPage(doc, pageId);
  if (at < 0) throw new Error(`deletePage: no page "${pageId}"`);
  if (at === 0) {
    throw new Error(`deletePage: "${pageId}" is the first page, which is the site's entry`);
  }
  // The header's button goes with the page, or with any section on it (ADR 0057) — see
  // `deleteSection` for why it cannot be left pointing at what is gone.
  const gone = doc.pages[at];
  const header = withoutActionTo(doc.header, {
    pageIds: new Set([pageId]),
    sectionIds: new Set(gone?.sections.map((section) => section.id) ?? []),
  });
  const { header: _, ...rest } = doc;
  return parseDocument({
    ...rest,
    ...(header === undefined ? {} : { header }),
    pages: doc.pages.filter((_page, index) => index !== at),
  });
}
