import type { RetorikaDocument } from "./document.ts";
import {
  type Header,
  type HeaderAction,
  type MenuLabelTarget,
  menuLabelIssue,
  UNLABELLED_SECTIONS,
} from "./header.ts";
import { parseDocument } from "./parse.ts";

/**
 * The verbs that write the owner's header (ADR 0057), apart from the shape in `header.ts` for one
 * reason: these end in `parseDocument`, and `parse.ts` reads `document.ts`, which reads the shape.
 * A shape module that imported the parser would close that circle, and a test that happened to
 * enter through `invariants.ts` would meet an uninitialised `headerSchema` — which is exactly how
 * this file was found to be necessary, on the day it was written.
 */

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The header with these keys replaced — shallow, at the top level. A caller that wants to change
 * one field of `look` passes the whole `look`; the objects are three or four keys, and a deep merge
 * would need a rule for «unset this one» that nobody has asked for. Returns the same document when
 * nothing would change, so a history built on reference equality opens no step.
 */
export function setHeader(doc: RetorikaDocument, patch: Partial<Header>): RetorikaDocument {
  const next: Header = { ...(doc.header ?? {}), ...patch };
  for (const key of Object.keys(next) as (keyof Header)[]) {
    if (next[key] === undefined) delete next[key];
  }
  if (same(doc.header ?? {}, next)) return doc;
  // An emptied header drops its key rather than staying as `{}` — the same normalisation
  // `withoutActionTo` makes, so there is one way to spell «nothing decided».
  const { header: _, ...rest } = doc;
  return parseDocument(Object.keys(next).length === 0 ? rest : { ...rest, header: next });
}

/** The action, or `null` to take the button away. Validity of the destination is the invariants'
 * business, which `parseDocument` runs. */
export function setHeaderAction(
  doc: RetorikaDocument,
  action: HeaderAction | null,
): RetorikaDocument {
  return setHeader(doc, { action: action ?? undefined });
}

/**
 * A label of the owner's own for one destination, or `null` (or an empty string) to go back to the
 * derived one. Trims, and refuses outside the bounds with the issue in the error — the editor asks
 * `menuLabelIssue` first and never reaches the throw. Refuses the three kinds of section that lend
 * no entry, so no document stores a word for a place the menu never names.
 */
export function setMenuLabel(
  doc: RetorikaDocument,
  target: MenuLabelTarget,
  label: string | null,
): RetorikaDocument {
  const trimmed = label?.trim() ?? "";
  const next = trimmed === "" ? undefined : trimmed;
  if (next !== undefined) {
    const issue = menuLabelIssue(next);
    if (issue) throw new Error(`setMenuLabel: the label is too ${issue}`);
  }

  if (target.kind === "page") {
    const at = doc.pages.findIndex((page) => page.id === target.pageId);
    if (at < 0) throw new Error(`setMenuLabel: no page "${target.pageId}"`);
    if (doc.pages[at]?.menuLabel === next) return doc;
    return parseDocument({
      ...doc,
      pages: doc.pages.map((page, index) => {
        if (index !== at) return page;
        const { menuLabel: _, ...rest } = page;
        return next === undefined ? rest : { ...rest, menuLabel: next };
      }),
    });
  }

  let found = false;
  const pages = doc.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      if (section.id !== target.sectionId) return section;
      found = true;
      if (UNLABELLED_SECTIONS.has(section.preset.catalogId)) {
        throw new Error(
          `setMenuLabel: a "${section.preset.catalogId}" section lends no menu entry to label`,
        );
      }
      const { menuLabel: _, ...rest } = section;
      return next === undefined ? rest : { ...rest, menuLabel: next };
    }),
  }));
  if (!found) throw new Error(`setMenuLabel: no section "${target.sectionId}"`);
  const before = doc.pages
    .flatMap((page) => page.sections)
    .find((section) => section.id === target.sectionId)?.menuLabel;
  if (before === next) return doc;
  return parseDocument({ ...doc, pages });
}
