import { COVER_ID, FOOTER_ID, TEASER_ID } from "@retorika/catalog";
import type { Page, RetorikaDocument } from "@retorika/schema";
import es from "./locales/es.json" with { type: "json" };
import { element, type RenderNode } from "./nodes.ts";

/**
 * The menu that writes itself — the concept dossier §6, and [ADR 0023].
 *
 * > «El menú se escribe solo. Refleja las secciones de la portada y las páginas que existan. El
 * > usuario nunca ve ni escribe una dirección web.»
 *
 * It is derived at render time and never appears in the document: no role, no slot, nothing to
 * keep in step. That is not a convenience — a written menu is the same words repeated on every
 * page, and the day a page is renamed it is wrong on all of them at once. A person who never sees
 * a URL cannot be asked to maintain a list of them.
 *
 * The one thing to hold on to while reading this file: **the entries are a property of the site,
 * computed once from the home page, and only the hrefs depend on which page is being drawn.** That
 * is what makes the menu identical everywhere, which is what a menu is for.
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
 */
export const MENU_MIN_ENTRIES = 3;

export type MenuEntry =
  | { kind: "anchor"; label: string; sectionId: string }
  | { kind: "page"; label: string; slug: string; pageId: string };

/** The heading a section is called by in the menu, or undefined when it has none to lend. */
function headingOf(page: Page["sections"][number]): string | undefined {
  const heading = page.content.find(
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
 * Every entry the menu holds, in the home page's own order.
 *
 * The rule that makes converting a section invisible to a visitor: **an avance contributes the
 * entry of the page it points at, in the place the converted section used to occupy.** So the entry
 * that said `#nuestra-carta` becomes `./nuestra-carta.html` and stays exactly where it was in the
 * strip. Nothing moves, nothing disappears, and the visitor arrives at the same content.
 *
 * The cover contributes nothing — it is the top of the page, which is where a visitor already is —
 * and neither does the footer, which is chrome. A section with no visible heading contributes
 * nothing either: there is no honest word to call it by, and inventing one is the thing this whole
 * file exists to avoid.
 */
export function menuEntries(doc: RetorikaDocument): MenuEntry[] {
  const home = doc.pages[0];
  if (!home) return [];

  const entries: MenuEntry[] = [];
  const pointedAt = new Set<string>();

  for (const section of home.sections) {
    const catalogId = section.preset.catalogId;
    if (catalogId === COVER_ID || catalogId === FOOTER_ID) continue;

    if (catalogId === TEASER_ID) {
      const destination = destinationOf(doc, section);
      // A teaser whose page is gone contributes nothing rather than a broken entry. The link
      // itself is already dead, `listDeadDestinations` catches it and the download is refused.
      if (!destination) continue;
      pointedAt.add(destination.id);
      entries.push({
        kind: "page",
        label: destination.title,
        slug: destination.slug,
        pageId: destination.id,
      });
      continue;
    }

    const label = headingOf(section);
    if (label) entries.push({ kind: "anchor", label, sectionId: section.id });
  }

  // Pages nothing points at, appended. An owner may delete an avance and keep its page (ADR 0022),
  // and a page with no way in is worse than one at the end of the strip.
  for (const page of doc.pages.slice(1)) {
    if (pointedAt.has(page.id)) continue;
    entries.push({ kind: "page", label: page.title, slug: page.slug, pageId: page.id });
  }

  return entries;
}

/** Whether this document has enough structure to be worth a menu at all. */
export function hasMenu(doc: RetorikaDocument): boolean {
  return menuEntries(doc).length >= MENU_MIN_ENTRIES;
}

/**
 * One entry's href, which is the only part of the menu that depends on which page is being drawn.
 *
 * An anchor to a home-page section has to leave the page it is written on when that page is not the
 * home page — `#sec-contact` would resolve to nothing on `nuestra-carta.html`, and on a static file
 * with no error state a fragment that resolves to nothing is indistinguishable from a broken site.
 */
function hrefFor(entry: MenuEntry, onHome: boolean): string {
  if (entry.kind === "page") return `./${entry.slug}.html`;
  return onHome ? `#${entry.sectionId}` : `${ENTRY_FILE}#${entry.sectionId}`;
}

function linkNodes(doc: RetorikaDocument, current: Page): RenderNode[] {
  const home = doc.pages[0];
  const onHome = home?.id === current.id;

  // **«Inicio», and only when the visitor is not already there.** ADR 0023 describes the set of
  // entries and says nothing about what the menu looks like from another page; this is what makes
  // it work there. Without it a home page whose every section has been converted offers, from one
  // of those pages, a strip of other pages and no way back — reachable only by the browser's back
  // button, which is not navigation the site provides. On the home page it is left out rather than
  // pointed at `./index.html`, because a link that reloads the page you are on is worse than no
  // link. Mockup 08 draws «Inicio» on a home page too; that divergence is in `REVIEW.md`.
  const homeEntry: RenderNode[] = onHome
    ? []
    : [element("a", { href: ENTRY_FILE }, [es["nav.home"]])];

  return [
    ...homeEntry,
    ...menuEntries(doc).map((entry) => {
      const attributes: Record<string, string> = { href: hrefFor(entry, onHome) };
      // `aria-current="page"` and not `aria-current="true"`: the entry names the page the visitor
      // is on, which is exactly what the `page` token is for.
      if (entry.kind === "page" && entry.pageId === current.id) attributes["aria-current"] = "page";
      return element("a", attributes, [entry.label]);
    }),
  ];
}

/**
 * The menu as markup: **two versions, one of which the stylesheet hides at any given width.**
 *
 * The approved fallback, taken deliberately. A single `<details>` kept open on wide screens depends
 * on `::details-content`, which our Chromium 153 does support — measured, not assumed — but which
 * shipped in Chrome 131, Safari 18.4 and Firefox 139, all of them 2024-25. This markup is not for
 * our browser: it goes in a ZIP, onto somebody's hosting, and is read by whatever the client's own
 * customers happen to run. On an older Safari the whole menu would sit collapsed behind a click on
 * a desktop, which is a real degradation of the published site.
 *
 * So a plain `<nav>` for wide screens and a `<details>` for narrow ones, alternated by a media
 * query with `display: none` — which takes the one that does not apply **out of the accessibility
 * tree** rather than leaving two menus announced. The a11y matrix asserts exactly one navigation
 * landmark at each width; that is the check that separates "two menus alternated" from "two menus
 * announced".
 *
 * The `<input type="checkbox">` toggle is not an option: ADR 0016 left the `field` role unused
 * precisely so that no orphan `<input>` reaches a published page, and this would put one there by
 * the back door. `<details>` is the only semantic disclosure that costs no JavaScript.
 */
export function menuNodes(doc: RetorikaDocument, current: Page): RenderNode[] {
  if (!hasMenu(doc)) return [];
  const links = linkNodes(doc, current);
  return [
    element("nav", { class: "rb-nav rb-nav-wide", "aria-label": es["nav.label"] }, links),
    element("details", { class: "rb-nav-narrow" }, [
      element("summary", {}, [es["nav.menu"]]),
      element("nav", { class: "rb-nav", "aria-label": es["nav.label"] }, linkNodes(doc, current)),
    ]),
  ];
}
