import { COVER_ID, FOOTER_ID, TEASER_ID } from "@retorika/catalog";
import type { Page, RetorikaDocument } from "@retorika/schema";
import { h1SectionIds } from "./headings.ts";
import es from "./locales/es.json" with { type: "json" };
import { element, type RenderNode } from "./nodes.ts";

/**
 * The menu that writes itself — the concept dossier §6, [ADR 0023], and since sprint 23
 * [ADR 0043], which split it in two.
 *
 * > «El menú se escribe solo. Refleja las secciones de la portada y las páginas que existan. El
 * > usuario nunca ve ni escribe una dirección web.»
 *
 * It is derived at render time and never appears in the document: no role, no slot, nothing to
 * keep in step. That is not a convenience — a written menu is the same words repeated on every
 * page, and the day a page is renamed it is wrong on all of them at once. A person who never sees
 * a URL cannot be asked to maintain a list of them.
 *
 * ## Two menus since ADR 0043, and what that changed
 *
 * **The pages of the site, and the sections of the page you are on.** Until sprint 23 both lived
 * in one strip, which is what the dossier's sentence describes; David chose the split on 16
 * October 2026 with the costs written in front of him, and the ADR records them. The two shapes
 * the split is worth understanding by:
 *
 * - **The pages menu is a property of the document**, identical on every page — which is what a
 *   menu is for — with «Inicio» first when the visitor is somewhere else.
 * - **The sections menu is a property of the page being drawn.** It used to be the *home* page's
 *   sections wherever you were, which is why an anchor had to be written `./index.html#sec-x` away
 *   from home. Every anchor is now local, and that rewriting is gone from the published output.
 *
 * **For a site with one page nothing changes for the visitor**: there is nowhere to navigate
 * between, so no pages menu is drawn and the sections menu is the strip that was always there.
 */

/** The file the publisher gives the first page, whatever that page is slugged
 * (`packages/publisher/src/site.ts`). Written out rather than imported: everything in this package
 * travels to the client's site and the dependency allowlist admits two packages. */
const ENTRY_FILE = "./index.html";

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
 * has two and two — both would publish three pages with no way between them. Counting what a
 * visitor could be offered keeps the answer identical to what it was before the split for every
 * document, which is why eighteen goldens hold still.
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

/** The heading a section is called by in the menu, or undefined when it has none to lend. */
function headingOf(section: Page["sections"][number]): string | undefined {
  const heading = section.content.find(
    (el) =>
      !el.hidden &&
      el.role === "heading" &&
      el.value?.kind === "text" &&
      el.value.text.trim() !== "",
  );
  return heading?.value?.kind === "text" ? heading.value.text.trim() : undefined;
}

/** The page an avance points at, by the slug in its link. */
function destinationOf(doc: RetorikaDocument, section: Page["sections"][number]): Page | undefined {
  const link = section.content.find((el) => !el.hidden && el.value?.kind === "link");
  const href = link?.value?.kind === "link" ? link.value.href.trim() : "";
  const slug = /^\.\/([^#]+)\.html(?:#.*)?$/.exec(href)?.[1];
  return slug === undefined ? undefined : doc.pages.find((page) => page.slug === slug);
}

/**
 * Every page the menu offers, in the order the home page gives them.
 *
 * **An avance still decides where its page sits.** It no longer holds the converted section's slot
 * in one combined strip — that is what the split gave up, and ADR 0043 says so — but the pages a
 * conversion made keep the relative order of their avances on the home page, and the pages nothing
 * points at are still appended. The first page is not here: it is «Inicio», added by `navsFor`
 * and only where it leads somewhere.
 *
 * A page drawn once per entry contributes nothing (ADR 0040 §5): up to twelve files in a menu
 * whose threshold is three would be the flood ADR 0033 named, and the cards' own titles are the
 * way in.
 */
export function pageMenuEntries(doc: RetorikaDocument): PageEntry[] {
  const home = doc.pages[0];
  if (!home) return [];

  const entries: PageEntry[] = [];
  const pointedAt = new Set<string>();

  for (const section of home.sections) {
    if (section.preset.catalogId !== TEASER_ID) continue;
    const destination = destinationOf(doc, section);
    // A teaser whose page is gone contributes nothing rather than a broken entry. The link itself
    // is already dead, `listDeadDestinations` catches it and the download is refused.
    if (!destination || destination.binding) continue;
    // **The owner took this page out of the menu** (ADR 0043 §3) — and the avance that pointed at
    // it stays exactly where it is, with its words and its link. That is the whole shape of the
    // decision: the page is still published, still reachable from the section that announces it,
    // and merely absent from the strip. Skipped before `pointedAt` is marked, so a later avance
    // to the same page is skipped by this same line rather than by the duplicate guard.
    if (destination.inMenu === false) continue;
    // **Marked before anything else, so two avances to one page cannot publish the same words
    // twice** — the duplicate-link problem ADR 0022 already solved for «Ver más» — and so the
    // append loop below never re-adds a page an avance has already placed.
    if (pointedAt.has(destination.id)) continue;
    pointedAt.add(destination.id);
    entries.push({
      label: destination.title,
      slug: destination.slug,
      pageId: destination.id,
    });
  }

  // Pages nothing points at, appended. An owner may delete an avance and keep its page (ADR 0022),
  // and a page with no way in is worse than one at the end of the strip.
  for (const page of doc.pages.slice(1)) {
    if (pointedAt.has(page.id) || page.binding || page.inMenu === false) continue;
    entries.push({ label: page.title, slug: page.slug, pageId: page.id });
  }

  return entries;
}

/**
 * Every section of **this page** the menu offers, in the page's own order.
 *
 * Four kinds of section lend nothing, and each for its own reason:
 *
 * - **The section carrying the page's `<h1>`** — the top of the page, which is where a visitor
 *   already is. On a home page that is the cover; on a converted page it is whatever was
 *   converted, which is why the rule asks `headings.ts` rather than asking for a cover. Without
 *   it, a one-section converted page would publish a strip holding one link whose words are its
 *   own headline and whose destination is the top of the page you are reading.
 * - **The footer**, which is chrome.
 * - **An avance**, whose words are borrowed from a page that is already in the other menu. Listing
 *   it here would put the same words in two landmarks, two clicks apart, for one destination.
 * - **A section with no visible heading**: there is no honest word to call it by, and inventing
 *   one is the thing this whole file exists to avoid.
 * - **A section the owner took out** — `inMenu: false` (ADR 0043 §3). It is the only one of the
 *   four that is a decision rather than a rule, and it changes the menu and nothing else: the
 *   section keeps its place on the page, its heading and its id, so an anchor written at it still
 *   lands.
 */
export function sectionMenuEntries(page: Page): SectionEntry[] {
  const h1Ids = h1SectionIds(page);
  const entries: SectionEntry[] = [];

  for (const section of page.sections) {
    const catalogId = section.preset.catalogId;
    if (section.inMenu === false) continue;
    if (catalogId === FOOTER_ID || catalogId === TEASER_ID) continue;
    if (h1Ids.has(section.id) || catalogId === COVER_ID) continue;
    const label = headingOf(section);
    if (label) entries.push({ label, sectionId: section.id });
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
 * Whether this document has enough structure to be worth a menu at all.
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

/** The two menus of one page, as `<nav>` nodes — empty ones left out rather than announced. */
function navsFor(doc: RetorikaDocument, current: Page): RenderNode[] {
  const home = doc.pages[0];
  const onHome = home?.id === current.id;

  // **«Inicio», and only when the visitor is not already there.** Without it a home page whose
  // every section has been converted offers, from one of those pages, a strip of other pages and
  // no way back — reachable only by the browser's back button, which is not navigation the site
  // provides. On the home page it is left out rather than pointed at `./index.html`, because a
  // link that reloads the page you are on is worse than no link. Mockup 08 draws «Inicio» on a
  // home page too; that divergence is in `REVIEW.md`.
  const pages: RenderNode[] = [
    ...(onHome ? [] : [element("a", { href: ENTRY_FILE }, [es["nav.home"]])]),
    ...pageMenuEntries(doc).map((entry) =>
      element(
        "a",
        {
          href: `./${entry.slug}.html`,
          // `aria-current="page"` and not `aria-current="true"`: the entry names the page the
          // visitor is on, which is exactly what the `page` token is for. It belongs here and
          // nowhere else — every anchor in the sections menu points at the page you are on, so
          // marking them would mark all of them and say nothing.
          ...(entry.pageId === current.id ? { "aria-current": "page" } : {}),
        },
        [entry.label],
      ),
    ),
  ];

  const sections = sectionMenuEntries(current).map((entry) =>
    element("a", { href: `#${entry.sectionId}` }, [entry.label]),
  );

  // **An empty strip is left out rather than announced** — ADR 0043 §5's first bound, which David
  // added on approving the sprint. A landmark announced as «navigation» to somebody who cannot see
  // it, holding nothing, is worse than no landmark.
  //
  // That is also the pages menu's floor of two visible pages, and it needs no arithmetic of its
  // own. On the home page the strip is exactly the visible pages *other than* home, so a site with
  // one visible page leaves it empty and nothing is drawn. Away from home «Inicio» is always in it,
  // and «Inicio» leads somewhere the visitor is not — which is how a page drawn per entry, and a
  // page the owner took out of the menu, keep their way back. The one strip the floor forbids, a
  // single link to the page you are already standing on, cannot be built at all: it would need the
  // home page to appear among its own entries.
  return [
    ...(pages.length > 0
      ? [element("nav", { class: "rb-nav", "aria-label": es["nav.pages"] }, pages)]
      : []),
    ...(sections.length > 0
      ? [element("nav", { class: "rb-nav", "aria-label": es["nav.sections"] }, sections)]
      : []),
  ];
}

/**
 * The menus as markup: **two versions, one of which the stylesheet hides at any given width.**
 *
 * The approved fallback, taken deliberately. A single `<details>` kept open on wide screens depends
 * on `::details-content`, which our Chromium 153 does support — measured, not assumed — but which
 * shipped in Chrome 131, Safari 18.4 and Firefox 139, all of them 2024-25. This markup is not for
 * our browser: it goes in a ZIP, onto somebody's hosting, and is read by whatever the client's own
 * customers happen to run. On an older Safari the whole menu would sit collapsed behind a click on
 * a desktop, which is a real degradation of the published site.
 *
 * So a plain strip for wide screens and a `<details>` for narrow ones, alternated by a media query
 * with `display: none` — which takes the one that does not apply **out of the accessibility tree**
 * rather than leaving two menus announced.
 *
 * **Since ADR 0043 `rb-nav-wide` names a box holding both menus rather than the menu itself, and
 * the narrow version keeps exactly one disclosure.** Two `<details>` stacked would put two rows of
 * chrome above the content on a 390px phone before a word of the site appears; one holds both
 * lists, which is also what somebody opening a menu expects to find.
 *
 * The `<input type="checkbox">` toggle is not an option: ADR 0016 left the `field` role unused
 * precisely so that no orphan `<input>` reaches a published page, and this would put one there by
 * the back door. `<details>` is the only semantic disclosure that costs no JavaScript.
 */
export function menuNodes(doc: RetorikaDocument, current: Page): RenderNode[] {
  if (!hasMenu(doc)) return [];
  const wide = navsFor(doc, current);
  if (wide.length === 0) return [];
  return [
    element("div", { class: "rb-nav-wide" }, wide),
    element("details", { class: "rb-nav-narrow" }, [
      element("summary", {}, [es["nav.menu"]]),
      ...navsFor(doc, current),
    ]),
  ];
}
