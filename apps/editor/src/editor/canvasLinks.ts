import type { RetorikaDocument } from "@retorika/schema";

/**
 * What a click on a link inside the canvas means — decided from the document, never by letting
 * the frame navigate.
 *
 * The preview is a canvas and not a browsable site: `wireLinks` cancels every anchor's default
 * action, and this is the one decision it makes afterwards. Three answers:
 *
 * - **`page`** — a menu entry or an avance, `./<slug>.html` naming a page of the document. The
 *   editor moves the canvas to that page, which is navigation the owner means and the tabs do too.
 * - **`entry`** — `./<slug>.html` naming an entry's file (ADR 0040 §5). The card's own title link
 *   never gets here: `wireEditing` unwraps it before the title is editable, by David's adjustment
 *   to the sprint 19 plan — the click is for editing, and an anchor inside a contentEditable
 *   broke the caret when measured. What does get here is a link the owner typed by hand to a
 *   ficha, and that moves the canvas to the page drawn per entry, showing that entry — the same
 *   thing a menu entry does for a page.
 * - **`none`** — anything else: an external href, a `#` the owner typed, a dead link. Nothing.
 */
export type CanvasLinkTarget =
  | { kind: "page"; pageId: string }
  | { kind: "entry"; pageId: string; entryId: string }
  | { kind: "none" };

const INTERNAL_PAGE = /^\.\/([^#]+)\.html(?:#.*)?$/;

export function canvasLinkTarget(doc: RetorikaDocument, href: string): CanvasLinkTarget {
  const slug = INTERNAL_PAGE.exec(href.trim())?.[1];
  if (slug === undefined) return { kind: "none" };
  const page = doc.pages.find((candidate) => candidate.slug === slug);
  // A page drawn per entry is never reached by its own slug — no file is ever written under it.
  if (page && !page.binding) return { kind: "page", pageId: page.id };
  for (const candidate of doc.pages) {
    const binding = candidate.binding;
    if (!binding) continue;
    const collection = doc.collections.find((c) => c.id === binding.collectionId);
    const entry = collection?.entries.find((e) => e.slug === slug);
    if (entry) return { kind: "entry", pageId: candidate.id, entryId: entry.id };
  }
  return { kind: "none" };
}
