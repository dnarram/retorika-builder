import {
  actionEntry,
  headerDrawn,
  headerSettings,
  pageMenuEntries,
  sectionMenuEntries,
} from "@retorika/renderer";
import type { RetorikaDocument } from "@retorika/schema";

/**
 * What the site's header holds, read for the «Menú» panel (ADR 0057, sprint 30 día 3).
 *
 * **Every answer is the renderer's**, as `menuState.ts` asks it for the same reason: the panel must
 * not describe a header the published page does not have. Which menus are drawn, what their entries
 * are called, which destination is the button — `headerSettings`, `pageMenuEntries`,
 * `sectionMenuEntries` and `actionEntry` decide; this only puts their answers in one object.
 *
 * On día 3 the panel reads this and shows it; on día 4 it gains the controls that change it, and
 * the object grows the counts and sentences they need.
 */
export interface HeaderState {
  /** Whether the site draws a header at all. */
  drawn: boolean;
  /** The pages menu's entries as the visitor reads them, or `null` when it is not drawn. «Inicio»
   * is not among them: it is a way back, drawn only away from home. */
  pages: string[] | null;
  /** The sections menu of the page being edited, or `null` when it is not drawn there. */
  sections: string[] | null;
  /** The button's words, or `null` when there is none. */
  action: string | null;
  /** Whether the business name is shown in the bar. */
  brandName: boolean;
  /** The title of the page being edited, for the sentence that says whose sections these are. */
  pageTitle: string;
}

export function headerStateFor(doc: RetorikaDocument, pageId: string | undefined): HeaderState {
  const page = doc.pages.find((candidate) => candidate.id === pageId) ?? doc.pages[0];
  if (!page) throw new Error("headerStateFor: the document has no pages");
  const settings = headerSettings(doc);
  const action = actionEntry(doc, page);
  // The menus as drawn: the button's destination leaves the menu it would sit in (ADR 0057 §5).
  const pages = pageMenuEntries(doc)
    .filter((entry) => entry.pageId !== action?.pageId)
    .map((entry) => entry.label);
  const sections = sectionMenuEntries(page)
    .filter((entry) => entry.sectionId !== action?.sectionId)
    .map((entry) => entry.label);
  return {
    drawn: headerDrawn(doc),
    pages: settings.pagesShown && pages.length > 0 ? pages : null,
    sections: settings.sectionsShown && sections.length > 0 ? sections : null,
    action: action?.label ?? null,
    brandName: settings.brandName,
    pageTitle: page.title,
  };
}
