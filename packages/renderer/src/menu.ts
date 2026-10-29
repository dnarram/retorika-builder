import { COVER_ID, FOOTER_ID, menuLabelOf, TEASER_ID } from "@retorika/catalog";
import type { Page, RetorikaDocument } from "@retorika/schema";
import { h1SectionIds } from "./headings.ts";

/**
 * The two menus, as lists of destinations — the concept dossier §6, [ADR 0023], [ADR 0043] which
 * split it in two, and since sprint 30 [ADR 0057], which made the header the owner's.
 *
 * > «El menú se escribe solo. Refleja las secciones de la portada y las páginas que existan. El
 * > usuario nunca ve ni escribe una dirección web.»
 *
 * **What is still derived, and what the owner now decides.** The destinations are still read off
 * the document at render time: a page is an entry because it exists, a section because it is on the
 * page being drawn. The owner decides three things about them, and all three are stored as data the
 * document already has a place for — never a URL: whether a destination appears (`inMenu`, ADR 0043),
 * what it is called (`menuLabel`, on top of a derived name), and the order of the pages, which is
 * the order of the pages themselves.
 *
 * **The derived name of a section is the short name of its kind, never its heading** — David's
 * decision of 28 October 2026. A heading is a sentence written for the top of a block and read in
 * context; a menu entry is the name of a place, read in a strip of five. «Te esperamos» is a fine
 * heading and a bad entry; «Contacto» is the entry. The catalog holds the word for each kind, so a
 * section with no heading at all now lends an entry too, where ADR 0043 had to leave it out for
 * want of a word.
 *
 * This file decides the lists. `header.ts` decides how they are drawn.
 */

/**
 * Three, and it is a product judgement rather than a technical one (ADR 0023).
 *
 * Fewer than three is not navigation, it is two links above a page that already scrolls. The number
 * was deliberately not decided by the fact that a lower one moves more of the golden corpus: a test
 * corpus is a record of what the renderer does, never a reason for it to do it.
 *
 * **It counts both menus together, and that is ADR 0043's arithmetic rather than a convenience.**
 * Three *per menu* is a rule no real site survives: the only multi-page fixture in the corpus has
 * two pages and one headed section, and a site built by converting two sections of a generated one
 * has two and two — both would publish three pages with no way between them.
 *
 * **Since ADR 0057 it is the default and not the law**: an owner who writes `header.pages.shown` or
 * `header.sections.shown` has answered the question the threshold was guessing at, and the guess
 * steps aside for that menu — see `headerSettings` in `header.ts`.
 */
export const MENU_MIN_ENTRIES = 3;

export interface PageEntry {
  label: string;
  slug: string;
  pageId: string;
}

export interface SectionEntry {
  label: string;
  sectionId: string;
}

/** What the menu calls a page: the owner's own word, or the page's title. */
export function pageLabel(page: Pick<Page, "title" | "menuLabel">): string {
  return page.menuLabel ?? page.title;
}

/** What the menu calls a section: the owner's own word, or the short name of its kind. Throws for
 * a kind that lends no entry, which no caller here ever asks about. */
export function sectionLabel(
  section: Pick<Page["sections"][number], "preset" | "menuLabel">,
): string {
  return section.menuLabel ?? menuLabelOf(section.preset.catalogId);
}

/**
 * Every page the menu offers, **in the order of the pages themselves** (ADR 0057, David's decision
 * of 28 October 2026).
 *
 * ADR 0043 ordered them by the home page's avances, so that converting two sections kept the order
 * of the places they had been. That left «Páginas» with a «Subir» and «Bajar» that moved the tabs
 * and not the menu — two orders for one list, and the one the owner could touch was the one the
 * visitor never saw. Now what the owner sees in the panel is what the site publishes, and an avance
 * is a link on the home page like any other.
 *
 * The first page is not here: it is «Inicio», added by `header.ts` and only where it leads somewhere.
 * A page drawn once per entry contributes nothing (ADR 0040 §5): up to twelve files in a menu whose
 * threshold is three would be the flood ADR 0033 named, and the cards' own titles are the way in.
 * A page the owner took out (`inMenu: false`, ADR 0043 §3) is still published and still reachable
 * from whatever links to it, and merely absent from the strip.
 */
export function pageMenuEntries(doc: RetorikaDocument): PageEntry[] {
  return doc.pages
    .slice(1)
    .filter((page) => !page.binding && page.inMenu !== false)
    .map((page) => ({ label: pageLabel(page), slug: page.slug, pageId: page.id }));
}

/**
 * Every section of **this page** the menu offers, in the page's own order.
 *
 * Four kinds of section lend nothing, and each for its own reason:
 *
 * - **The section carrying the page's `<h1>`** — the top of the page, which is where a visitor
 *   already is. On a home page that is the cover; on a converted page it is whatever was
 *   converted, which is why the rule asks `headings.ts` rather than asking for a cover.
 * - **The footer**, which is chrome.
 * - **An avance**, whose words are borrowed from a page that is already in the other menu. Listing
 *   it here would put the same words in two landmarks, two clicks apart, for one destination.
 * - **A section the owner took out** — `inMenu: false` (ADR 0043 §3). It is the only one of the
 *   four that is a decision rather than a rule, and it changes the menu and nothing else: the
 *   section keeps its place on the page, its heading and its id, so an anchor written at it still
 *   lands.
 *
 * A section with no heading used to be a fifth, for want of a word to call it by; since ADR 0057
 * the word is its kind's, and it lends an entry like any other.
 */
export function sectionMenuEntries(page: Page): SectionEntry[] {
  const h1Ids = h1SectionIds(page);
  const entries: SectionEntry[] = [];

  for (const section of page.sections) {
    const catalogId = section.preset.catalogId;
    if (section.inMenu === false) continue;
    if (catalogId === FOOTER_ID || catalogId === TEASER_ID) continue;
    if (h1Ids.has(section.id) || catalogId === COVER_ID) continue;
    entries.push({ label: sectionLabel(section), sectionId: section.id });
  }

  return entries;
}

/**
 * Whether anybody has decided what this menu shows — **read from the presence of `inMenu`, not
 * from its value** (ADR 0043 §5).
 *
 * `inMenu: true` is therefore not the same fact as no `inMenu` at all, which is the distinction
 * the whole threshold waiver rests on. Absence is «nobody has looked at this»; `true` is «I looked
 * and I want it». So a switch turned off and turned back on leaves the document curated, and the
 * threshold stays out of the way. That is the smaller of the two surprises available here: the
 * alternative is a menu that disappears the moment somebody undoes their own decision, which they
 * would read as the editor losing their work rather than as a rule reasserting itself.
 *
 * **Asked of the whole site, not of one page.** Whether a menu is drawn is one answer for the
 * whole site — `hasMenu` is counted on the home page precisely so it cannot differ page to page —
 * so the permission to draw a small one has to be site-wide too. An owner who pruned the menu
 * while standing on page three has decided about *the menu*, and there is only one of those.
 */
export function menuIsCurated(doc: RetorikaDocument): boolean {
  return doc.pages.some(
    (page) =>
      page.inMenu !== undefined || page.sections.some((section) => section.inMenu !== undefined),
  );
}

/**
 * Whether this document has enough structure to be worth a menu at all — **the derived answer**,
 * which `header.ts` uses for each menu whose `shown` the owner has not written.
 *
 * **Counted on the home page, so the answer is the same on every page of the site**: a menu that
 * appears on one page and not on another is not a menu. See `MENU_MIN_ENTRIES` for why the two
 * menus are counted together rather than separately.
 *
 * Three questions in order, and the order is the decision (ADR 0043 §4 and §5):
 *
 * 1. **No destinations, no menu** — whatever anybody decided. A landmark announced as «navigation»
 *    to somebody who cannot see it, holding nothing, is worse than no landmark at all. This is
 *    David's own clause, added when the sprint was approved.
 * 2. **Curated, so the threshold steps aside**: one destination is enough. It is their site, they
 *    can count, and the count is in front of them in the editor while they decide. A refusal here
 *    would be the product overruling somebody about their own navigation.
 * 3. **Otherwise the threshold**, unchanged since ADR 0023 — which is what keeps every document
 *    nobody has curated answering exactly what it answered before this field existed.
 */
export function hasMenu(doc: RetorikaDocument): boolean {
  const home = doc.pages[0];
  if (!home) return false;
  const destinations = pageMenuEntries(doc).length + sectionMenuEntries(home).length;
  if (destinations === 0) return false;
  if (menuIsCurated(doc)) return true;
  return destinations >= MENU_MIN_ENTRIES;
}
