import type { Background } from "./background.ts";
import type { RetorikaDocument } from "./document.ts";
import { parseDocument } from "./parse.ts";

/**
 * Where a background is painted: under the whole site, or under one section (ADR 0081).
 */
export type BackgroundScope = { kind: "site" } | { kind: "section"; sectionId: string };

/**
 * **The one verb that writes a background** (sprint 40 día 5): a picture under the site or under a
 * section, or none. `null` takes it off — the key goes, not an empty record, so a document with no
 * background is the same bytes it was before 1.22.0 and `rewriteImageSources` has nothing to walk.
 *
 * The same rule `setElementStyle` and `setPlacement` keep: **the identical value back is not a
 * change**, and the caller gets the very same document so a history built on reference equality
 * opens no step. Parsed on the way out, so a background the schema refuses — a name that is not a
 * raster file, extremes the wrong way round — never reaches the document.
 */
export function setBackground(
  doc: RetorikaDocument,
  scope: BackgroundScope,
  background: Background | null,
): RetorikaDocument {
  if (scope.kind === "site") {
    if (same(doc.background, background)) return doc;
    const { background: _gone, ...rest } = doc;
    return parseDocument(background === null ? rest : { ...rest, background });
  }
  let found = false;
  const pages = doc.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      if (section.id !== scope.sectionId) return section;
      found = true;
      const { background: _gone, ...rest } = section;
      return background === null ? rest : { ...rest, background };
    }),
  }));
  if (!found) throw new Error(`setBackground: no section "${scope.sectionId}"`);
  const current = doc.pages
    .flatMap((page) => page.sections)
    .find((section) => section.id === scope.sectionId)?.background;
  if (same(current, background)) return doc;
  return parseDocument({ ...doc, pages });
}

function same(current: Background | undefined, next: Background | null): boolean {
  if (next === null) return current === undefined;
  if (current === undefined) return false;
  return JSON.stringify(current) === JSON.stringify(next);
}
