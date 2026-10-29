import type { RetorikaDocument } from "@retorika/schema";

/**
 * What a click on a link inside the canvas means — decided from the document, never by letting
 * the frame navigate.
 *
 * The preview is a canvas and not a browsable site: `wireLinks` cancels every anchor's default
 * action, and this is the one decision it makes afterwards. Four answers:
 *
 * - **`page`** — a menu entry or an avance, `./<slug>.html` naming a page of the document. The
 *   editor moves the canvas to that page, which is navigation the owner means and the tabs do too.
 *   `./index.html` is the first page whatever its slug, because that is the file the publisher
 *   writes it as — the brand links there (ADR 0057).
 * - **`section`** — a fragment naming a section: `#sec-x` on the page being drawn, or
 *   `./<slug>.html#sec-x` on another (sprint 30 día 3). The editor moves to that page if it has to,
 *   brings the section to the top of the frame and chooses it — what the header's sections menu and
 *   its button do for a visitor, done for the owner. **`wireLinks` acts on a same-page fragment only
 *   from the header**: an owner's own `#sec-x` button inside a section is clicked to edit its words,
 *   and stealing that click to scroll away would be the editor overruling the hand.
 * - **`entry`** — `./<slug>.html` naming an entry's file (ADR 0040 §5). The card's own title link
 *   never gets here: `wireEditing` unwraps it before the title is editable, by David's adjustment
 *   to the sprint 19 plan — the click is for editing, and an anchor inside a contentEditable
 *   broke the caret when measured. What does get here is a link the owner typed by hand to a
 *   ficha, and that moves the canvas to the page drawn per entry, showing that entry — the same
 *   thing a menu entry does for a page.
 * - **`none`** — anything else: an external href, a `#` the owner typed, a fragment that names no
 *   section, a dead link. Nothing.
 */
export type CanvasLinkTarget =
  | { kind: "page"; pageId: string }
  | { kind: "section"; pageId: string; sectionId: string }
  | { kind: "entry"; pageId: string; entryId: string }
  | { kind: "none" };

const INTERNAL_PAGE = /^\.\/([^#]+)\.html(?:#(.*))?$/;

/** The page holding this section when it is `pageId`, or `none`. */
function sectionOn(doc: RetorikaDocument, pageId: string, sectionId: string): CanvasLinkTarget {
  const page = doc.pages.find((candidate) => candidate.id === pageId);
  return page?.sections.some((section) => section.id === sectionId)
    ? { kind: "section", pageId, sectionId }
    : { kind: "none" };
}

/**
 * `currentPageId` is the page the canvas is drawing, which a bare `#sec-x` is relative to — the
 * renderer writes a section's anchor local to its own page (ADR 0043 §1). Unset means the first.
 */
export function canvasLinkTarget(
  doc: RetorikaDocument,
  href: string,
  currentPageId?: string,
): CanvasLinkTarget {
  const trimmed = href.trim();
  const current = currentPageId ?? doc.pages[0]?.id;

  if (trimmed.startsWith("#")) {
    const sectionId = trimmed.slice(1);
    return current === undefined || sectionId === ""
      ? { kind: "none" }
      : sectionOn(doc, current, sectionId);
  }

  const match = INTERNAL_PAGE.exec(trimmed);
  const slug = match?.[1];
  if (slug === undefined) return { kind: "none" };
  const fragment = match?.[2];

  // `./index.html` is the entry, whatever the first page is slugged: the publisher writes it there.
  const page =
    slug === "index" ? doc.pages[0] : doc.pages.find((candidate) => candidate.slug === slug);
  // A page drawn per entry is never reached by its own slug — no file is ever written under it.
  if (page && !page.binding) {
    if (fragment !== undefined && fragment !== "") {
      const section = sectionOn(doc, page.id, fragment);
      if (section.kind === "section") return section;
    }
    return { kind: "page", pageId: page.id };
  }
  for (const candidate of doc.pages) {
    const binding = candidate.binding;
    if (!binding) continue;
    const collection = doc.collections.find((c) => c.id === binding.collectionId);
    const entry = collection?.entries.find((e) => e.slug === slug);
    if (entry) return { kind: "entry", pageId: candidate.id, entryId: entry.id };
  }
  return { kind: "none" };
}
