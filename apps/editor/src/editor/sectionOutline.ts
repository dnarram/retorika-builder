import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import { pagesToMoveTo, type RetorikaDocument } from "@retorika/schema";

/**
 * **The sections of every page, as «Páginas» lists them, and where a dragged row lands** (ADR 0087's
 * día 10a amendment, sprint 41), decided without a DOM.
 *
 * Each page unfolds its sections as rows; a row is carried by its grip to a gap — in its own page, which
 * is `moveSection`, or in another, which is `moveSectionToPage` — and the same answers are given to the
 * keyboard by «Subir», «Bajar» and «A otra página». What a row may do is what the verbs accept: the
 * pages it may go to are `pagesToMoveTo`'s, so the cover, the footer and an avance offer none.
 */
export interface OutlineRow {
  readonly sectionId: string;
  /** The owner's own word for it, or the short name of its kind. */
  readonly name: string;
  /** The pages it may be moved to, in the document's order: empty for the three that stay. */
  readonly pages: readonly { readonly id: string; readonly title: string }[];
}

export interface OutlinePage {
  readonly pageId: string;
  readonly title: string;
  readonly rows: readonly OutlineRow[];
}

export function outlineOf(doc: RetorikaDocument): OutlinePage[] {
  return doc.pages.map((page) => ({
    pageId: page.id,
    title: page.title,
    rows: page.sections.map((section) => ({
      sectionId: section.id,
      name: section.menuLabel ?? nameOfKind(section.preset.catalogId),
      pages: pagesToMoveTo(doc, section.id).map((to) => ({ id: to.id, title: to.title })),
    })),
  }));
}

function nameOfKind(catalogId: string): string {
  const key = `section.${catalogId}.name` as keyof typeof catalogEs;
  return catalogEs[key] ?? catalogId;
}

/** A row as measured on screen, in the outline's order. */
export interface RowBox {
  readonly pageId: string;
  readonly sectionId: string;
  readonly top: number;
  readonly bottom: number;
}

/** A gap between rows: `index` counts the rows above it in its page, the carried one included. */
export interface Gap {
  readonly pageId: string;
  readonly index: number;
  /** Where its line is drawn. */
  readonly y: number;
}

/**
 * The gap nearest the hand. Every page offers a gap above each of its rows and one below its last, so
 * a row can be let go at the top or the bottom of any page that is unfolded.
 */
export function gapAt(rows: readonly RowBox[], y: number): Gap | null {
  const gaps: Gap[] = [];
  for (const [at, row] of rows.entries()) {
    const index = rows.slice(0, at).filter((other) => other.pageId === row.pageId).length;
    gaps.push({ pageId: row.pageId, index, y: row.top });
    if (rows[at + 1]?.pageId !== row.pageId) {
      gaps.push({ pageId: row.pageId, index: index + 1, y: row.bottom });
    }
  }
  let best: Gap | null = null;
  for (const gap of gaps) {
    if (!best || Math.abs(gap.y - y) < Math.abs(best.y - y)) best = gap;
  }
  return best;
}

export type SectionDrop =
  | { readonly kind: "within"; readonly toIndex: number }
  | { readonly kind: "page"; readonly pageId: string; readonly index: number };

/**
 * What letting a row go at a gap writes, or `null` for nothing: its own place, or a page it may not
 * go to.
 *
 * **Within its page the carried row is counted out**: the gap under the next row is `from + 2`, and
 * `moveSection` takes the index the section ends at, after it has left — so a gap below it is one
 * less. On another page the gap is the index it arrives at, held above a footer that closes the page,
 * which is where `moveSectionToPage` puts a section when nobody says.
 */
export function dropOf(doc: RetorikaDocument, sectionId: string, gap: Gap): SectionDrop | null {
  const from = doc.pages.find((page) => page.sections.some((s) => s.id === sectionId));
  if (!from) return null;
  if (gap.pageId === from.id) {
    const index = from.sections.findIndex((s) => s.id === sectionId);
    const toIndex = gap.index > index ? gap.index - 1 : gap.index;
    return toIndex === index ? null : { kind: "within", toIndex };
  }
  if (!pagesToMoveTo(doc, sectionId).some((page) => page.id === gap.pageId)) return null;
  const to = doc.pages.find((page) => page.id === gap.pageId);
  if (!to) return null;
  const closes = to.sections.at(-1)?.preset.catalogId === "footer";
  const index = closes ? Math.min(gap.index, to.sections.length - 1) : gap.index;
  return { kind: "page", pageId: gap.pageId, index };
}
