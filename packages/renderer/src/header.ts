import {
  HEADER_PARTS,
  type Header,
  type HeaderAction,
  type HeaderBackground,
  type HeaderLayout,
  type HeaderLogo,
  type HeaderPart,
  hrefForPage,
  type Page,
  type PagesPosition,
  type RetorikaDocument,
  type SectionsOnMobile,
  type SectionsPosition,
} from "@retorika/schema";
import { safeUrl } from "./escape.ts";
import es from "./locales/es.json" with { type: "json" };
import {
  hasMenu,
  pageLabel,
  pageMenuEntries,
  type SectionEntry,
  sectionLabel,
  sectionMenuEntries,
} from "./menu.ts";
import { element, type RenderNode } from "./nodes.ts";
import { styleDeclarations } from "./styleCss.ts";

/**
 * The header: what sits above `<main>` on every page, drawn from the owner's `header` and the two
 * menus `menu.ts` derives (ADR 0057).
 *
 * **One render path, and the defaults are what the page looked like before the object existed.**
 * A document with no `header` draws the strip ADR 0043 drew — two menus or none, by the threshold —
 * so the published sites that exist keep their navigation. What the owner writes replaces a default,
 * never adds a second way of drawing the same thing.
 *
 * The shape, at every width:
 *
 * ```
 * <a class="rb-skip" href="#rb-main">Saltar al contenido</a>      the first Tab stop (WCAG 2.4.1)
 * <header class="rb-header" data-layout="…" data-sections="…" data-bg="…" …>
 *   <a class="rb-brand" href="./index.html">[logo] Name</a>        a <span> on the home page
 *   <div class="rb-nav-wide"> <nav Páginas> <nav Secciones> </div>  wide screens
 *   <a class="rb-nav-action" href="…">Reservar</a>                 the one button, every width
 *   <details class="rb-nav-fold"><summary>Ir a…</summary> <nav Secciones> </details>   «Ir a…»
 *   <details class="rb-nav-narrow"><summary>Menú</summary> <nav Páginas> </details>   phones
 *   <nav class="rb-nav rb-nav-row" aria-label="Secciones">…</nav>  a row of its own, or the phone's
 *   <div class="rb-rail" data-side="left|right">[brand] <nav …> [<nav …>] [button]</div>   0–2 rails
 * </header>
 * ```
 *
 * **Each menu has its place, and the rail is one mechanism for both** (ADR 0060, sprint 31). A menu
 * placed `left` or `right` gets a copy in a rail — a fixed column the height of the window, beside
 * the content, `<main>` and the bar keeping its width free — and **the bar keeps every copy it had**,
 * because the bar is where a rail falls: below 1024 px every rail does, and between 1024 and 1247 the
 * sections' rail does when the two menus sit on opposite sides. Which copy is seen at a width is
 * `display: none`, the one way to take a landmark out of the accessibility tree. With the pages in a
 * rail the owner may send the brand and the button there too (`brandWithPages`); a bar left with
 * nothing to draw on a wide screen collapses to nothing (`data-bar="none"`). The sections have one
 * place more, **«Ir a…»** (`fold`, sprint 31 día 3): a disclosure fixed under the bar on a wide
 * screen, and a word beside «Menú» on a phone, whichever of the two the owner chose it for.
 *
 * **The pages menu folds, the sections menu does not.** On a phone the pages go behind a `<summary>`
 * — a disclosure every browser exposes as a button with its expanded state, and the only one that
 * costs no script (ADR 0023, ADR 0016). The sections of the page you are reading are a horizontal
 * row under the bar, or nothing, as the owner chooses: a list of places on *this* page is what a
 * visitor scrolls along, not what they open a menu for. ADR 0043 put both inside one `<details>`;
 * that is the clause this amends, and the row is why one disclosure still holds everything that
 * folds.
 *
 * **The skip link is the first thing in the body**, visible only when it has focus. With a brand,
 * two menus and a button, a keyboard visitor would otherwise Tab through up to ten links on every
 * page before the first word of the site. Emitted only when a header is drawn: it is that header
 * the link exists to skip.
 *
 * **The look is data attributes the stylesheet reads** (sprint 30 día 2): the background scheme,
 * the alignment, the gap, the size, uppercase, underline on hover, fixed. Every value is a token,
 * every text/background pair is one `packages/tokens/test/contrast.test.ts` proves over the
 * palettes, and the one pair it cannot prove — a transparent bar over a photograph — is the download
 * review's business (día 6), not a refusal here.
 */

export interface HeaderSettings {
  pagesShown: boolean;
  sectionsShown: boolean;
  pagesPosition: PagesPosition;
  sectionsPosition: SectionsPosition;
  sectionsMobile: SectionsOnMobile;
  brandWithPages: boolean;
  layout: HeaderLayout;
  brandName: boolean;
  logo: HeaderLogo | undefined;
  action: HeaderAction | undefined;
  sticky: boolean;
  hairline: boolean;
  background: HeaderBackground;
  align: "start" | "center" | "end";
  gap: "sm" | "md" | "lg";
  uppercase: boolean;
  hoverUnderline: boolean;
  size: "body" | "small";
}

/**
 * The owner's header with every gap filled by the default — and **the default of `shown` is the
 * derived answer**, which is how a document nobody curated publishes what it always did. Written
 * once, here, so the editor's «Menú» panel (which reads this) and the published page cannot disagree
 * about what a missing key means. The default alignment follows the layout: a brand on the left
 * sends the links to the far side; a centred or stacked bar centres them.
 */
export function headerSettings(doc: RetorikaDocument): HeaderSettings {
  const header: Header = doc.header ?? {};
  const derived = hasMenu(doc);
  const layout = header.layout ?? "brand-left";
  return {
    pagesShown: header.pages?.shown ?? derived,
    sectionsShown: header.sections?.shown ?? derived,
    pagesPosition: header.pages?.position ?? "bar",
    sectionsPosition: header.sections?.position ?? "bar",
    sectionsMobile: header.sections?.mobile ?? "row",
    brandWithPages: header.brandWithPages ?? false,
    layout,
    brandName: header.brand?.name ?? false,
    logo: header.brand?.logo,
    action: header.action,
    sticky: header.sticky ?? false,
    hairline: header.hairline ?? true,
    background: header.look?.background ?? "surface",
    align: header.look?.align ?? (layout === "brand-left" ? "end" : "center"),
    gap: header.look?.gap ?? "md",
    uppercase: header.look?.uppercase ?? false,
    hoverUnderline: header.look?.hoverUnderline ?? false,
    size: header.look?.size ?? "body",
  };
}

/** The file the publisher gives the first page, whatever that page is slugged
 * (`packages/publisher/src/site.ts`). Written out rather than imported: everything in this package
 * travels to the client's site and the dependency allowlist admits two packages. */
const ENTRY_FILE = "./index.html";

/**
 * **The rail's width, and the two widths under which rails fall into the bar** (ADR 0060). Exported
 * because the editor's «Menú» panel says, from the canvas's own layout width, whether the column is
 * seen there — and a sentence about what the owner sees must read the numbers that draw it.
 *
 * 240 px, under the plan's ceiling of 256: at 1024 px a window then keeps 784 for the content, over
 * the 768 the overflow suite already proves. Two rails on opposite sides need 1248 for the same 768
 * between them, so under it the sections' rail falls first; under 1024 every rail does.
 */
export const RAIL_WIDTH = 240;
export const RAIL_FOLD_WIDTH = 1024;
export const TWO_RAILS_FOLD_WIDTH = 1248;

/**
 * **The glass** (ADR 0063, sprint 32 día 1): a fixed bar, once the page has scrolled, keeps this much
 * of its own colour and lets the rest of the page show through, blurred. The number is a claim about
 * contrast, and `packages/renderer/test/glass.test.ts` is what makes it one: every word the bar writes
 * on a glass background clears AA over the two extremes of what can lie under it — black and white —
 * in every palette. Measured before it was written: ink on `surface` at 0.88 is 7.08 at its lowest
 * (forest-emerald over black), `surface` on `ink` 6.72 (forest-emerald over white). **`color.primary`
 * is written on no glass**: on `surface` it measured 3.57 at 0.88 and still 4.32 at 0.96 (neutral over
 * black), so the surface scheme writes its brand and entries in `color.ink` and keeps the primary for
 * the indicator and the button, which are not words over glass. The two coloured schemes `primary`
 * and `secondary` condense without glass for the same reason, read the other way round: their words
 * are `surface`, and `surface` on `primary` at 0.88 over white is 3.88.
 */
export const GLASS_MIX = 0.88;
/** The backgrounds that turn to glass once scrolled, with the one colour each writes its words in.
 * `transparent` is `surface`'s glass: scrolled, a transparent bar is a surface bar. */
export const GLASS_BACKGROUNDS: Readonly<Record<"surface" | "ink", "ink" | "surface">> = {
  surface: "ink",
  ink: "surface",
};
/** The one hairline of the bar, the rail, the panels: a tenth of the ink over whatever is behind it,
 * so it is a line on every scheme and on glass without a colour of its own to prove. */
const HAIRLINE = "1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)";
/** The strip's navs — the wide bar's two and the row — as against a rail's, a disclosure's or a
 * sheet's copies, which mark their current entry another way. */
const STRIP_NAV = ":is(.rb-nav-wide, .rb-header) > .rb-nav";

/** The href that reaches `page` from wherever the visitor is: the entry file for the first page. */
function hrefTo(doc: RetorikaDocument, page: Page): string {
  return page.id === doc.pages[0]?.id ? ENTRY_FILE : hrefForPage(page);
}

export interface ActionEntry {
  label: string;
  href: string;
  /** Which destination the button took, so the menus leave it out: one destination, one place. */
  sectionId?: string;
  pageId?: string;
}

/**
 * The button, as a link from the page being drawn: a local anchor when its section is on this page,
 * a link into the page that holds it otherwise. Its words are exactly the words its menu entry
 * would have had — no verb is invented here (ADR 0043 §3 still stands on that), and the generator
 * is the one that writes «Reservar» as the destination's own label where a sector has the word.
 *
 * Returns `undefined` for a destination the document does not hold, which `parseDocument` refuses
 * anyway: the renderer never draws a dead button rather than drawing `#`.
 */
export function actionEntry(doc: RetorikaDocument, current: Page): ActionEntry | undefined {
  const action = doc.header?.action;
  if (!action) return undefined;
  if (action.kind === "page") {
    const page = doc.pages.find((candidate) => candidate.id === action.pageId);
    if (!page || page.binding) return undefined;
    return { label: pageLabel(page), href: hrefTo(doc, page), pageId: page.id };
  }
  for (const page of doc.pages) {
    const section = page.sections.find((candidate) => candidate.id === action.sectionId);
    if (!section) continue;
    const anchor = `#${section.id}`;
    return {
      label: sectionLabel(section),
      href: page.id === current.id ? anchor : `${hrefTo(doc, page)}${anchor}`,
      sectionId: section.id,
    };
  }
  return undefined;
}

/**
 * Whether this site draws a header at all — **one answer for the whole site**, like `hasMenu`, so
 * the stylesheet (which is per document) and the markup (which is per page) agree, and so a header
 * does not appear on one page and vanish on the next. True when there is a brand or a button to
 * show, or a menu that is both shown and non-empty somewhere on the site.
 */
export function headerDrawn(doc: RetorikaDocument): boolean {
  const settings = headerSettings(doc);
  if (settings.brandName || settings.logo || settings.action) return true;
  if (settings.pagesShown && pageMenuEntries(doc).length > 0) return true;
  if (settings.sectionsShown && doc.pages.some((page) => sectionMenuEntries(page).length > 0)) {
    return true;
  }
  return false;
}

/** Whether the phone shows the sections as a row under the bar: the row is drawn and not hidden
 * there. Read by the stylesheet through `data-phone-row`, so a fixed bar can let go on a phone where
 * the row would make it taller than the bound (see `headerMobileCss`) — and exported for the
 * editor's «Menú» panel, whose «Se queda arriba al bajar» has to say so (sprint 30 día 4). */
export function headerPhoneRow(
  doc: RetorikaDocument,
  settings: HeaderSettings = headerSettings(doc),
): boolean {
  return (
    settings.sectionsShown &&
    settings.sectionsMobile === "row" &&
    doc.pages.some((page) => sectionMenuEntries(page).length > 0)
  );
}

function navNode(
  label: string,
  part: HeaderPart,
  links: RenderNode[],
  extraClass = "",
): RenderNode {
  return element(
    "nav",
    {
      class: extraClass === "" ? "rb-nav" : `rb-nav ${extraClass}`,
      "aria-label": label,
      "data-part": part,
    },
    links,
  );
}

/** What the way back to the first page is called: the owner's own word, or «Inicio». Exported for
 * the «Menú» panel, whose «Se lee como…» shows it as the word an empty box goes back to. */
export function homeMenuLabel(home: Pick<Page, "menuLabel">): string {
  return home.menuLabel ?? es["nav.home"];
}

function pagesLinks(
  doc: RetorikaDocument,
  current: Page,
  taken: ActionEntry | undefined,
): RenderNode[] {
  const home = doc.pages[0];
  const onHome = home?.id === current.id;
  // **«Inicio», and only when the visitor is not already there.** Without it a home page whose
  // every section has been converted offers, from one of those pages, a strip of other pages and
  // no way back. On the home page it is left out rather than pointed at `./index.html`, because a
  // link that reloads the page you are on is worse than no link. Its words are the first page's
  // own label when the owner wrote one.
  const inicio = onHome || !home ? [] : [element("a", { href: ENTRY_FILE }, [homeMenuLabel(home)])];
  return [
    ...inicio,
    ...pageMenuEntries(doc)
      .filter((entry) => entry.pageId !== taken?.pageId)
      .map((entry) =>
        element(
          "a",
          {
            href: `./${entry.slug}.html`,
            // `aria-current="page"` and not `aria-current="true"`: the entry names the page the
            // visitor is on, which is exactly what the `page` token is for. It belongs here and
            // nowhere else — every anchor in the sections menu points at the page you are on.
            ...(entry.pageId === current.id ? { "aria-current": "page" } : {}),
          },
          [entry.label],
        ),
      ),
  ];
}

function sectionsLinks(current: Page, taken: ActionEntry | undefined): RenderNode[] {
  return sectionMenuEntries(current)
    .filter((entry: SectionEntry) => entry.sectionId !== taken?.sectionId)
    .map((entry) => element("a", { href: `#${entry.sectionId}` }, [entry.label]));
}

/**
 * The brand: the business name, its logo, or both, linking home — a `<span>` on the home page
 * itself, where a link to the page you are reading is worse than none (the rule «Inicio» follows).
 *
 * **The logo's `alt` is derived, never stored** (David's adjustment 5): the business name when the
 * name is not written beside it, and empty when it is — a screen reader then hears the name once,
 * as the link's text, rather than «Taberna Taberna».
 *
 * **Its size, as attributes, so nothing moves when it arrives.** A logo that carries the size it was
 * kept at (sprint 30 día 7) writes both: the stylesheet still draws it 40px tall with `width: auto`,
 * and the browser takes the ratio from the two attributes before a byte of the image is there — so
 * the business name beside it is laid out where it will stay. One kept before the size was stored
 * writes only `height="40"`, as on día 5: the bar has its height before the image arrives, and the
 * name moves sideways once, when it does (Lighthouse's `unsized-images`, CLS 0.023 measured).
 */
function brandNode(
  doc: RetorikaDocument,
  current: Page,
  settings: HeaderSettings,
): RenderNode | undefined {
  if (!settings.brandName && !settings.logo) return undefined;
  const children: RenderNode[] = [];
  if (settings.logo) {
    children.push(
      element("img", {
        class: "rb-logo",
        // Through `safeUrl` like every `src` and `href` the page writes: the schema already
        // refuses anything but a raster file name here, and the renderer does not rely on it.
        src: safeUrl(settings.logo.src),
        alt: settings.brandName ? "" : doc.siteName,
        ...(settings.logo.width === undefined || settings.logo.height === undefined
          ? { height: "40" }
          : { width: String(settings.logo.width), height: String(settings.logo.height) }),
      }),
    );
  }
  if (settings.brandName) {
    children.push(element("span", { class: "rb-brand-name" }, [doc.siteName]));
  }
  const onHome = doc.pages[0]?.id === current.id;
  const attributes = { class: "rb-brand", "data-part": "brand" };
  return onHome
    ? element("span", attributes, children)
    : element("a", { ...attributes, href: ENTRY_FILE }, children);
}

/** The data attributes the stylesheet reads the look from. Booleans are present-or-absent, enums
 * carry their value; `hairline` is written only when it is off, since on is the default. */
function lookAttributes(doc: RetorikaDocument, settings: HeaderSettings): Record<string, string> {
  return {
    "data-layout": settings.layout,
    "data-pages": settings.pagesPosition,
    "data-sections": settings.sectionsPosition,
    "data-bg": settings.background,
    "data-align": settings.align,
    "data-gap": settings.gap,
    "data-size": settings.size,
    ...(settings.uppercase ? { "data-uppercase": "" } : {}),
    ...(settings.hoverUnderline ? { "data-hover": "" } : {}),
    ...(settings.sticky ? { "data-sticky": "" } : {}),
    ...(settings.hairline ? {} : { "data-hairline": "none" }),
    ...(headerPhoneRow(doc, settings) ? { "data-phone-row": "" } : {}),
  };
}

/**
 * The header of one page, and the skip link before it — or nothing, when the site draws no header
 * (`headerDrawn`) or this page has nothing to put in one.
 */
export function headerNodes(doc: RetorikaDocument, current: Page): RenderNode[] {
  if (!headerDrawn(doc)) return [];
  const settings = headerSettings(doc);
  const action = actionEntry(doc, current);
  const pages = settings.pagesShown ? pagesLinks(doc, current, action) : [];
  const sections = settings.sectionsShown ? sectionsLinks(current, action) : [];
  const brand = brandNode(doc, current, settings);
  if (!brand && !action && pages.length === 0 && sections.length === 0) return [];

  // Which rail holds what, on this page: a menu with no entries here has no rail here either.
  const pagesSide: "left" | "right" | null =
    settings.pagesPosition === "bar" || pages.length === 0 ? null : settings.pagesPosition;
  const sectionsSide: "left" | "right" | null =
    (settings.sectionsPosition === "left" || settings.sectionsPosition === "right") &&
    sections.length > 0
      ? settings.sectionsPosition
      : null;
  // The brand and the button go with the pages only where the pages are drawn in a rail (David's
  // condition): with the pages menu off or in the bar, the brand stays where it was.
  const brandGoes =
    settings.brandWithPages && pagesSide !== null && (brand !== undefined || action !== undefined);
  const buttonNode = (entry: ActionEntry) =>
    element("a", { class: "rb-nav-action", "data-part": "action", href: entry.href }, [
      entry.label,
    ]);

  const children: RenderNode[] = [];
  if (brand) children.push(brand);

  // The wide bar: the pages, and the sections when their place is the bar or a rail — a rail's
  // copy here is where it falls on a narrower screen. Left out entirely when it would hold nothing:
  // an empty strip is not navigation, and nothing is announced for it. A row of their own and the
  // disclosure are places of their own at every wide width, so neither leaves a copy here.
  const wide: RenderNode[] = [];
  if (pages.length > 0) wide.push(navNode(es["nav.pages"], "pagesLinks", pages));
  if (
    sections.length > 0 &&
    settings.sectionsPosition !== "row" &&
    settings.sectionsPosition !== "fold"
  ) {
    wide.push(navNode(es["nav.sections"], "sectionsLinks", sections));
  }
  if (wide.length > 0) children.push(element("div", { class: "rb-nav-wide" }, wide));

  if (action) children.push(buttonNode(action));

  // **«Ir a…»** (ADR 0060, sprint 31 día 3): the sections behind a `<summary>`, one element for both
  // of its places. On a wide screen it is the sections' place when the owner chose `fold`, fixed
  // under the bar; on a phone it is the sections' place when the owner chose `fold` there, in the bar
  // beside «Menú». `data-mobile` is what the stylesheet reads for the phone, as on the row. After the
  // button and before «Menú», so the keyboard meets it where the eye does on both: under the button
  // on a wide screen, and left of «Menú» on a phone, which keeps the edge of the screen for the menu.
  const foldWide = settings.sectionsPosition === "fold" && sections.length > 0;
  if (sections.length > 0 && (foldWide || settings.sectionsMobile === "fold")) {
    children.push(
      element("details", { class: "rb-nav-fold", "data-mobile": settings.sectionsMobile }, [
        element("summary", {}, [es["nav.goTo"]]),
        navNode(es["nav.sections"], "sectionsLinks", sectionsLinks(current, action)),
      ]),
    );
  }

  // The phone's disclosure holds the pages alone. A `<details>` and never a checkbox (ADR 0016), and
  // never an empty one: with no pages there is nothing to fold, and the row below is the whole menu.
  if (pages.length > 0) {
    children.push(
      element("details", { class: "rb-nav-narrow" }, [
        element("summary", {}, [es["nav.menu"]]),
        navNode(es["nav.pages"], "pagesLinks", pagesLinks(doc, current, action)),
      ]),
    );
  }

  // The sections as a row of their own: at every width when that is their place, and on the phone
  // when the owner kept them there. `data-mobile` is what the stylesheet reads to hide the row below
  // 720px; the wide copy inside the bar is hidden there regardless.
  const rowAtAllWidths = settings.sectionsPosition === "row";
  const rowOnPhone = settings.sectionsMobile === "row";
  if (sections.length > 0 && (rowAtAllWidths || rowOnPhone)) {
    const row = navNode(
      es["nav.sections"],
      "sectionsLinks",
      sectionsLinks(current, action),
      "rb-nav-row",
    );
    row.attributes["data-mobile"] = settings.sectionsMobile;
    children.push(row);
  }

  // **The rails, after the bar and before `<main>`**: a keyboard reaches the skip link, the bar, the
  // rails and then the page — the order the eye reads a page with a column at its side, and the
  // reason a rail on the right still comes before the content in the document. Fresh nodes, as the
  // phone's disclosure takes: a copy is its own element, never a second parent for the same one.
  const rails: ("left" | "right")[] = [];
  for (const side of ["left", "right"] as const) {
    const held: RenderNode[] = [];
    if (brandGoes && pagesSide === side) {
      const ownBrand = brandNode(doc, current, settings);
      if (ownBrand) held.push(ownBrand);
    }
    if (pagesSide === side) {
      held.push(navNode(es["nav.pages"], "pagesLinks", pagesLinks(doc, current, action)));
    }
    if (sectionsSide === side) {
      held.push(navNode(es["nav.sections"], "sectionsLinks", sectionsLinks(current, action)));
    }
    if (brandGoes && pagesSide === side && action) held.push(buttonNode(action));
    if (held.length === 0) continue;
    rails.push(side);
    children.push(element("div", { class: "rb-rail", "data-side": side }, held));
  }

  // **A bar with nothing left to draw on a wide screen collapses** (David's condition): every menu
  // here is in a rail or in the disclosure, and the brand and the button went with the pages or were
  // never there. It is still the element that holds the rails and the disclosure — one banner for
  // the site's navigation, the copies it falls back to — but at the widths where they stand it is no
  // height at all.
  const barEmpty =
    (rails.length > 0 || foldWide) &&
    (brand === undefined || brandGoes) &&
    (action === undefined || brandGoes) &&
    (pages.length === 0 || pagesSide !== null) &&
    (sections.length === 0 || sectionsSide !== null || foldWide);

  return [
    element("a", { class: "rb-skip", href: "#rb-main" }, [es["nav.skip"]]),
    element(
      "header",
      {
        class: "rb-header",
        ...lookAttributes(doc, settings),
        ...(rails.length > 0 ? { "data-rails": rails.join(" ") } : {}),
        ...(brandGoes ? { "data-brand": "pages" } : {}),
        ...(barEmpty ? { "data-bar": "none" } : {}),
      },
      children,
    ),
  ];
}

/**
 * **Where this page's menus stand on a wide screen**, as the header itself says it: the rails that
 * hold something here, and whether the bar has anything left to draw (ADR 0060). Read off the very
 * header `headerNodes` draws — its `data-rails` and `data-bar` — so the «Menú» panel's sentences about
 * a column cannot describe a page the published one is not (sprint 31 día 5).
 */
export function headerPlaces(
  doc: RetorikaDocument,
  current: Page,
): { rails: ("left" | "right")[]; barEmpty: boolean } {
  const header = headerNodes(doc, current).find((node) => node.tag === "header");
  const rails = (header?.attributes["data-rails"] ?? "")
    .split(" ")
    .filter((side): side is "left" | "right" => side === "left" || side === "right");
  return { rails, barEmpty: header?.attributes["data-bar"] === "none" };
}

/** The parts' selectors for rule 6, each weighing at least (0,3,0) so an owner's exact value wins
 * over every scheme rule above it — which weighs (0,3,1) at most and comes earlier, so a tie is
 * won here too. The bar is the element itself; a nav part is its links; brand and button are the
 * one element each. */
const PART_SELECTOR: Record<HeaderPart, string> = {
  bar: ".rb-header[data-layout][data-bg]",
  brand: ".rb-header[data-layout] [data-part=brand]",
  pagesLinks: ".rb-header[data-layout] [data-part=pagesLinks] a[href]",
  sectionsLinks: ".rb-header[data-layout] [data-part=sectionsLinks] a[href]",
  action: ".rb-header[data-layout] [data-part=action]",
};

/**
 * Rule 6 for the header's parts: the same five properties an element takes, each a reference or a
 * marked exception, as rules at the end of the header's stylesheet. **The bar reads `color` as its
 * background**: a bar has no text of its own, and its one colour is the one behind the words. Parts
 * in `HEADER_PARTS` order and declarations in `STYLE_PROPERTIES` order, so the same document is the
 * same bytes (INV_5).
 */
function headerStyleCss(doc: RetorikaDocument): string[] {
  const style = doc.header?.style;
  if (!style) return [];
  // **The rail is the bar's** (ADR 0060): one colour behind the words, wherever the words stand —
  // and only for a document that has a rail, so a saved site without one keeps its exact bytes.
  const selectorOf = (part: HeaderPart) =>
    part === "bar" && usesRail(headerSettings(doc))
      ? `${PART_SELECTOR.bar}, ${PART_SELECTOR.bar} .rb-rail`
      : PART_SELECTOR[part];
  const rules: string[] = [];
  for (const part of HEADER_PARTS) {
    const own = style[part];
    if (!own) continue;
    const declarations = styleDeclarations(
      own,
      `header.${part}`,
      part === "bar" ? { color: "background" } : {},
    );
    if (declarations.length > 0) {
      rules.push(`${selectorOf(part)} { ${declarations.join("; ")}; }`);
    }
  }
  return rules.length === 0 ? [] : ["/* rule 6: the header's own style */", ...rules];
}

/**
 * The header's stylesheet, emitted only for a site that draws one (`headerDrawn`): the eighteen
 * one-page corpus sites with no menu carry none of it, where they used to carry the strip's rules
 * for a strip they never drew.
 *
 * Every value is a token. `color.primary` on `color.surface` is the one pair every palette is proved
 * against (`packages/tokens/test/contrast.test.ts`), and the three coloured schemes write their
 * entries in `color.surface` — the pairs added to that proof on sprint 30 día 2, with the measured
 * minimums beside them. Entries are not styled as links — they are a strip of navigation — and the
 * current page is marked by a rule under it rather than by hue alone.
 */
export function headerCss(doc: RetorikaDocument, target: "html" | "dom"): string[] {
  if (!headerDrawn(doc)) return [];
  return [
    // The skip link: off-screen until it has focus, and then the first thing on the page. `top`
    // rather than a clip, so the one transition it makes is the one a sighted keyboard user sees.
    ".rb-skip { position: absolute; left: var(--space-md); top: -100px; z-index: 3;",
    "  padding: var(--space-sm) var(--space-md); background: var(--color-surface);",
    "  color: var(--color-primary); font-family: var(--font-heading); font-size: var(--size-body);",
    "  border-radius: var(--radius-sm); text-decoration: underline; }",
    ".rb-skip:focus-visible { top: var(--space-md); }",
    // **The bar's height, twice** (ADR 0063, David's adjustment 7). `--rb-bar-h` is what the
    // stylesheet can estimate — the padding and the taller of the logo and a line of text — and it
    // never changes: the cover under a transparent bar makes its room with it, so a bar that condenses
    // once scrolled does not pull the headline up 16 px. `--rb-header-h` starts as the same estimate
    // and the script refines it with `offsetHeight` where it runs: it is for the anchors, which should
    // land under the bar as it is now, and for «Ir a…», which hangs from it.
    "html { --rb-bar-h: calc(2 * var(--space-md) + max(40px, 1.5 * var(--size-body)));",
    "  --rb-header-h: var(--rb-bar-h); }",
    // **The motor's own numbers**, not the document's (rule 6 reads the owner's choices, not what the
    // renderer knows): one curve and two durations, read by every transition of the bar. Outside the
    // media block because they are numbers, not movement; what moves is below.
    "html { --rb-ease: cubic-bezier(0.2, 0, 0, 1); --rb-fast: 200ms; --rb-base: 400ms; }",
    // **Motion, and only for somebody who has not asked their system for less** (David's point 7 on
    // sprint 30, and his third condition on sprint 31): the smooth scroll; the rule under an entry
    // fading; the indicator sliding from the entry that was current to the one that is; the button
    // lifting; the bar condensing. Every `transition` and `animation` of the header lives in a block
    // like this one — the rail's and the disclosure's in their own, emitted with them — and
    // `header.test.ts` walks the sheet to hold it.
    "@media (prefers-reduced-motion: no-preference) {",
    "  html { scroll-behavior: smooth; }",
    "  .rb-nav a { transition: text-decoration-color var(--rb-fast) var(--rb-ease); }",
    "  .rb-nav::after { transition: left var(--rb-fast) var(--rb-ease), width var(--rb-fast) var(--rb-ease); }",
    "  .rb-nav-action { transition: transform var(--rb-fast) var(--rb-ease), box-shadow var(--rb-fast) var(--rb-ease); }",
    "  .rb-header[data-sticky] { transition: padding var(--rb-fast) var(--rb-ease), margin var(--rb-fast) var(--rb-ease),",
    "    background-color var(--rb-fast) var(--rb-ease), box-shadow var(--rb-fast) var(--rb-ease); }",
    "}",
    // The bar. One flex row that wraps: brand, the wide strip pushed to the far side, the button,
    // and — on its own line when it has one — the sections row. A hairline under it, so it reads
    // as a bar rather than as the page's top padding: a tenth of the ink (ADR 0063), where it used
    // to be the full `color.muted` of `.rb-item`, which read as a ruled line. Decorative, so the text
    // contrast minimum does not apply to it. `position: relative` is for the phone's open menu, which
    // hangs under the whole bar (below).
    //
    // **`line-height` is a number, never `normal`** (sprint 30 día 7, measured). `normal` takes each
    // font's own ascent and descent, so a line of the bar was 18px in the fallback letter and 21px in
    // EB Garamond: when the site's letter arrived, the bar grew 87 → 90px and pushed the whole page
    // down — the 0.023 of Lighthouse's CLS on the fixed-header subject, which día 5 read as the logo's.
    // A unitless factor makes every line `size × 1.3` in whichever letter is drawing it, so the bar
    // has its final height before the letter arrives. 1.3 is EB Garamond's own `normal`, the corpus's
    // heading letter, so the bar keeps the height it had once loaded.
    ".rb-header { position: relative; display: flex; flex-wrap: wrap; align-items: center;",
    "  gap: var(--space-md) var(--space-xl); padding: var(--space-md) var(--space-xl);",
    `  background: var(--color-surface); border-bottom: ${HAIRLINE}; line-height: 1.3; }`,
    ".rb-header[data-hairline=none] { border-bottom: 0; }",
    // The brand never breaks the bar's height: one line, cut with an ellipsis before it wraps
    // (David's adjustment 3, measured with «Taberna Santo Domingo» and a logo at 320px). `min-width:
    // 0` is what lets a flex item shrink below its text; without it the ellipsis never happens.
    // **In ink, not in the primary** (ADR 0063): the primary is written on no glass, measured above.
    ".rb-brand { display: flex; align-items: center; gap: var(--space-sm); min-width: 0;",
    "  max-width: 100%; color: var(--color-ink); font-family: var(--font-heading);",
    "  font-size: var(--size-body); font-weight: 700; text-decoration: none; }",
    ".rb-brand-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".rb-logo { height: 40px; width: auto; flex: none; }",
    ".rb-nav-wide { display: flex; flex-wrap: wrap; gap: var(--space-xl); margin-left: auto; }",
    // `position: relative` is the indicator's containing block (below). The two groups are told
    // apart by the gap between them and by their accessible names; the ruled line that used to
    // stand between them went with ADR 0063.
    ".rb-nav { position: relative; display: flex; flex-wrap: wrap; gap: var(--space-md); }",
    // **The entries** (ADR 0063): the site's reading letter, in ink, and nothing under them at rest —
    // the rule under every entry is there in no colour, so a colour is what a transition can move
    // (sprint 31 día 3). The current entry is marked under it in the primary, twice over: by the
    // indicator where the browser can anchor one, by the rule's colour where it cannot. `padding`
    // gives the indicator its room without moving the words.
    ".rb-nav a { color: var(--color-ink); font-family: var(--font-body); font-size: var(--size-body);",
    "  padding: var(--space-xs) 0; text-decoration: underline transparent; text-underline-offset: 6px;",
    "  text-decoration-thickness: 2px; }",
    ".rb-nav a[aria-current] { text-decoration-color: var(--color-primary); }",
    // **The indicator**: one rule under the current entry of each strip, that slides to the next
    // when the current one changes — the page you are on, or the section in view once the script
    // marks it. Drawn by the `nav`'s own `::after`, placed by CSS anchor positioning on whichever
    // entry is current: no element, no key for the canvas, no write for the script. A browser
    // without anchors (`@supports`) keeps the rule's colour above and never reads this block. Only
    // the strip's navs anchor: a rail marks its entry by its edge, a sheet by its edge too (día 4),
    // and two anchors of one name in two visible copies would place the rule under the wrong one.
    // Hidden the moment no entry is current, so an empty strip draws no stray line.
    //
    // **For the published page only, never for the canvas** (`target`): measured and bisected in the
    // editor on sprint 32 día 1, the mere presence of `anchor()`, `anchor-size()` and
    // `position-anchor` in the sheet — in rules that matched nothing — broke Chromium's scroll
    // anchoring across a re-layout of the frame: closing a panel moved the section being edited
    // 29 px; the same `::after` without the anchor functions, 0. The canvas carries no script, so
    // nothing there marks the section in view for the rule to slide to, and the rule's own colour
    // above draws the same pixels at rest: the sliding rule lives where the script that moves it
    // does. The one other thing the two targets differ in is that script (ADR 0058 §4).
    ...(target === "html"
      ? [
          "@supports (anchor-name: --rb-x) {",
          `  ${STRIP_NAV} a[aria-current] { text-decoration-color: transparent; }`,
          `  ${STRIP_NAV}[data-part=pagesLinks] a[aria-current] { anchor-name: --rb-current-pages; }`,
          `  ${STRIP_NAV}[data-part=sectionsLinks] a[aria-current] { anchor-name: --rb-current-sections; }`,
          `  ${STRIP_NAV}::after { content: ""; position: absolute; bottom: 0; height: 2px; border-radius: 1px;`,
          "    background: var(--color-primary); left: anchor(left); width: anchor-size(width);",
          "    pointer-events: none; }",
          `  ${STRIP_NAV}[data-part=pagesLinks]::after { position-anchor: --rb-current-pages; }`,
          `  ${STRIP_NAV}[data-part=sectionsLinks]::after { position-anchor: --rb-current-sections; }`,
          `  ${STRIP_NAV}:not(:has(a[aria-current]))::after { display: none; }`,
          "}",
        ]
      : []),
    // The button: a pill in the primary, the site's one idea of a button (`[role=button]` takes the
    // same shape on día 3). Lifts a pixel under a pointer that can hover. Pushed to the far side when
    // nothing else is there. `rb-nav-action` and not `rb-action`: the editor's canvas chrome already
    // names its verbs `.rb-action`, inside the same frame this stylesheet lives in, and the first
    // name restyled every verb of the toolbar — measured by the sprint 20 walk.
    ".rb-nav-action { display: inline-block; padding: var(--space-sm) var(--space-lg);",
    "  background: var(--color-primary); color: var(--color-surface); font-family: var(--font-heading);",
    "  font-size: var(--size-body); font-weight: 700; border-radius: 999px; text-decoration: none;",
    "  white-space: nowrap; }",
    "@media (hover: hover) {",
    "  .rb-nav-action:hover { transform: translateY(-1px); box-shadow: 0 8px 24px -16px var(--color-ink); }",
    "}",
    ".rb-brand + .rb-nav-action, .rb-header > .rb-nav-action:first-child { margin-left: auto; }",
    // «Menú»: a word, not a disclosure triangle — the browser's own marker goes, in both the places
    // browsers draw it.
    ".rb-nav-narrow { padding: 0; }",
    ".rb-nav-narrow > summary { color: var(--color-ink); font-family: var(--font-heading);",
    "  font-size: var(--size-body); cursor: pointer; list-style: none; }",
    ".rb-nav-narrow > summary::-webkit-details-marker { display: none; }",
    // The phone's open menu is a panel under the whole bar, not a list inside the «Menú» word's
    // own box. **Measured before it was written this way**: a `<details>` that is a flex item is as
    // wide as its summary (87px at 320px), Chromium lays its closed contents out all the same, and a
    // long page title ran 6px past the right edge of a 320px screen while invisible — which the
    // overflow suite counts, and rightly, since the moment it opens the overflow is real. Spanning
    // the header's width puts every entry inside the screen, open or closed.
    // `flex-wrap: nowrap` undoes the strip's `wrap`: a column that may wrap sizes its one line to
    // the longest entry rather than to the screen, and a long page title ran 26px past 320 that way.
    ".rb-nav-narrow .rb-nav { position: absolute; left: 0; right: 0; top: 100%; z-index: 2;",
    "  flex-direction: column; flex-wrap: nowrap; gap: var(--space-sm);",
    "  padding: var(--space-md) var(--space-lg);",
    `  background: var(--color-surface); border-bottom: ${HAIRLINE}; }`,
    // The sections row: a full line of its own under the bar. Shown at every width when the owner
    // gave the sections their own row; otherwise it is the phone's copy and hidden here.
    ".rb-nav-row { flex-basis: 100%; }",
    ".rb-header:not([data-sections=row]) .rb-nav-row { display: none; }",
    // Three layouts. Centred puts everything on one centred line; stacked gives the brand a line
    // of its own and centres the rest under it.
    ".rb-header[data-layout=centered] { justify-content: center; }",
    ".rb-header[data-layout=centered] .rb-nav-wide,",
    ".rb-header[data-layout=centered] .rb-nav-action { margin-left: 0; }",
    ".rb-header[data-layout=stacked] { justify-content: center; }",
    ".rb-header[data-layout=stacked] .rb-brand { flex-basis: 100%; justify-content: center; }",
    ".rb-header[data-layout=stacked] .rb-nav-wide,",
    ".rb-header[data-layout=stacked] .rb-nav-action { margin-left: 0; }",
    ".rb-header[data-layout=stacked] .rb-nav-row { justify-content: center; }",
    // **The look** (sprint 30 día 2), each option a data attribute and each value a token. Where the
    // links sit, after the layout so an explicit alignment wins over the layout's own.
    ".rb-header[data-align=start] .rb-nav-wide { margin-left: 0; margin-right: auto; }",
    ".rb-header[data-align=center] .rb-nav-wide { margin-left: auto; margin-right: auto; }",
    ".rb-header[data-align=end] .rb-nav-wide { margin-left: auto; margin-right: 0; }",
    ".rb-header[data-align=start] .rb-nav-row { justify-content: flex-start; }",
    ".rb-header[data-align=center] .rb-nav-row { justify-content: center; }",
    ".rb-header[data-align=end] .rb-nav-row { justify-content: flex-end; }",
    ".rb-header[data-gap=sm] .rb-nav { gap: var(--space-sm); }",
    ".rb-header[data-gap=lg] .rb-nav { gap: var(--space-lg); }",
    ".rb-header[data-size=small] :is(.rb-brand, .rb-nav a, .rb-nav-action, .rb-nav-narrow > summary) {",
    "  font-size: calc(var(--size-body) * 0.875); }",
    ".rb-header[data-uppercase] :is(.rb-nav a, .rb-nav-action, .rb-nav-narrow > summary) {",
    "  text-transform: uppercase; letter-spacing: 0.06em; }",
    // Underline on hover is a decoration the owner asks for, never a colour change of the words: a
    // rule under the entry in half the primary, and the keyboard gets the same line the pointer gets.
    ".rb-header[data-hover] .rb-nav a:hover, .rb-header[data-hover] .rb-nav a:focus-visible {",
    "  text-decoration-color: color-mix(in srgb, var(--color-primary) 50%, transparent); }",
    // **The schemes.** Four opaque backgrounds and one transparent. On a coloured bar the entries,
    // the brand and the «Menú» word are `color.surface` (proved: surface on primary 4.71, on
    // secondary 5.47, on ink 9.28, the lowest palette each), the hairline goes — the bar already
    // contrasts with the page — the indicator and the rule under the current entry are `surface`
    // too, and the button inverts to `surface` with `primary` words, since a `primary` button on a
    // `primary` bar is no button (and 1.77 against `ink`).
    ".rb-header[data-bg=primary] { background: var(--color-primary); border-bottom: 0; }",
    ".rb-header[data-bg=secondary] { background: var(--color-secondary); border-bottom: 0; }",
    ".rb-header[data-bg=ink] { background: var(--color-ink); border-bottom: 0; }",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink])",
    "  :is(.rb-brand, .rb-nav a, .rb-nav-narrow > summary) { color: var(--color-surface); }",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink]) .rb-nav a[aria-current] {",
    "  text-decoration-color: var(--color-surface); }",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink]) .rb-nav::after {",
    "  background: var(--color-surface); }",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink])[data-hover] .rb-nav a:hover,",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink])[data-hover] .rb-nav a:focus-visible {",
    "  text-decoration-color: color-mix(in srgb, var(--color-surface) 50%, transparent); }",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink]) .rb-nav-action {",
    "  background: var(--color-surface); color: var(--color-primary); }",
    // The phone's open menu keeps the bar's colours, since it hangs from the bar.
    ".rb-header[data-bg=primary] .rb-nav-narrow .rb-nav { background: var(--color-primary); }",
    ".rb-header[data-bg=secondary] .rb-nav-narrow .rb-nav { background: var(--color-secondary); }",
    ".rb-header[data-bg=ink] .rb-nav-narrow .rb-nav { background: var(--color-ink); }",
    // **Transparent lies over the cover** (David's adjustment 1a): the bar is taken out of the flow
    // and the first section opens room under it — the bar's **estimated** height on top of its own
    // padding, never the measured one (adjustment 7 of sprint 32): the measure drops when the bar
    // condenses, and room that followed it would pull the headline up by the difference.
    ".rb-header[data-bg=transparent] { position: absolute; left: 0; right: 0; top: 0; z-index: 2;",
    "  background: transparent; border-bottom: 0; }",
    ".rb-header[data-bg=transparent] + main > .rb-section:first-child {",
    "  padding-top: calc(var(--space-xl) + var(--rb-bar-h)); }",
    // **Fixed** («se queda arriba al bajar», David's point 8): sticky, over the content, and every
    // section makes room for it when an anchor lands. Once the page has scrolled, which only the
    // script can know, the bar **condenses** — its padding to `space.sm` — and grows a shadow.
    // **Its outer box does not change** (David's adjustment 1 of sprint 32): the bar is sticky, so its
    // box is still in the flow, and a bar 16 px shorter would have pulled the whole page up 16 px on
    // the first scroll — visible, and CLS in the field that a lab run never sees because it never
    // scrolls. The margin under it takes exactly what the padding gave up, the two transitioned
    // together; `offsetHeight`, which has no margin in it, still drops, so `--rb-header-h` and the
    // anchors follow the bar as it is.
    ".rb-header[data-sticky] { position: sticky; top: 0; z-index: 2; }",
    ".rb-header[data-sticky] ~ main [data-section] { scroll-margin-top: var(--rb-header-h); }",
    `.rb-header[data-sticky][data-scrolled] { box-shadow: 0 1px 0 color-mix(in srgb, var(--color-ink) 10%, transparent),`,
    "  0 8px 24px -16px var(--color-ink); }",
    "@media (min-width: 721px) {",
    "  .rb-header[data-sticky][data-scrolled] { padding-block: var(--space-sm);",
    "    margin-bottom: calc(2 * (var(--space-md) - var(--space-sm))); }",
    "}",
    // **Transparent and fixed do not meet without the script** (David's adjustment 1b): a
    // transparent bar fixed over text is unreadable. Without the script's mark the bar stays
    // absolute and scrolls away with the cover; with it, it is fixed, and once the page has scrolled
    // it takes the `surface` scheme — background (glass, above, where it can be), hairline and all.
    ".rb-header[data-sticky][data-bg=transparent] { position: absolute; }",
    "html[data-rb-js] .rb-header[data-sticky][data-bg=transparent] { position: fixed; }",
    ".rb-header[data-sticky][data-bg=transparent][data-scrolled] { background: var(--color-surface);",
    `  border-bottom: ${HAIRLINE}; }`,
    // **The glass** (ADR 0063; `GLASS_MIX`, proved in `glass.test.ts`): a scrolled bar on the
    // `surface` or `ink` scheme keeps 88 % of its colour and blurs what passes under it. Only where
    // the browser can blur; elsewhere the bar stays the opaque colour above. A transparent bar once
    // scrolled is a surface bar, so it takes the surface's glass. The two coloured schemes are not
    // here: `surface` on `primary` at 0.88 does not clear AA, measured in `GLASS_MIX`'s note.
    "@supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {",
    "  .rb-header[data-sticky][data-scrolled]:is([data-bg=surface], [data-bg=transparent]) {",
    `    background: color-mix(in srgb, var(--color-surface) ${Math.round(GLASS_MIX * 100)}%, transparent);`,
    "    -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }",
    "  .rb-header[data-sticky][data-scrolled][data-bg=ink] {",
    `    background: color-mix(in srgb, var(--color-ink) ${Math.round(GLASS_MIX * 100)}%, transparent);`,
    "    -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }",
    "}",
    ...railCss(doc),
    ...foldCss(doc),
    ...headerStyleCss(doc),
    "",
  ];
}

/** Whether this document places a menu in a rail at all — the stylesheet's rail block travels only
 * then, so no site that does not use a column carries a byte of it. */
function usesRail(settings: HeaderSettings): boolean {
  return (
    settings.pagesPosition !== "bar" ||
    settings.sectionsPosition === "left" ||
    settings.sectionsPosition === "right"
  );
}

/** Whether this document puts the sections behind «Ir a…» at any width — the disclosure's block
 * travels only then, like the rail's. */
function usesFold(settings: HeaderSettings): boolean {
  return settings.sectionsPosition === "fold" || settings.sectionsMobile === "fold";
}

/**
 * The rules that collapse a bar with nothing left to draw (`data-bar="none"`), for the widths where
 * what it gave away stands elsewhere. `[data-layout]` is for weight, to win over the fixed
 * transparent bar's own scheme. **`--rb-header-h` is zero on the header itself**, so what hangs from
 * the bar's height inside it — the disclosure's `top` — reads the height the bar really has even
 * where no script measures it, as in the editor's canvas; what lies outside it gets its own zero.
 */
function collapseBar(header: string): string[] {
  return [
    `  ${header} { --rb-header-h: 0px; padding: 0; margin-bottom: 0; border-bottom: 0; background: transparent; box-shadow: none; }`,
    `  ${header}[data-sticky] ~ main [data-section] { scroll-margin-top: 0; }`,
    `  ${header}[data-bg=transparent] + main > .rb-section:first-child { padding-top: var(--space-xl); }`,
  ];
}

/**
 * **The rail** (ADR 0060): one column, fixed beside the content, the same for both menus. Hidden by
 * default and shown from `RAIL_FOLD_WIDTH` up, so under it — tablets, phones — no rail exists for
 * anybody and the bar's copies are the menu; between `RAIL_FOLD_WIDTH` and `TWO_RAILS_FOLD_WIDTH` the
 * sections' rail of a two-rail page falls into the bar as well.
 *
 * - **`overflow: hidden auto` and not `auto`**: one non-visible axis turns the other `auto`, and a box
 *   that scrolls sideways exempts what is inside it from the overflow walk (`insideScroller`). A rail
 *   scrolls down when its entries outgrow the window, and never across.
 * - **The bar's scheme**, background and words, because a rail is the bar standing up: a
 *   `transparent` bar's rail is `surface`, since nothing lies under a column to show through.
 * - **`<main>` and the bar both keep the rail's width free**, so a full-height column never covers
 *   the brand or the first section. The rails are fixed, so the header's own margin does not move
 *   them.
 * - **z-index 2**, under the skip link's 3: the first Tab stop is drawn over a rail on the left.
 */
function railCss(doc: RetorikaDocument): string[] {
  const settings = headerSettings(doc);
  if (!usesRail(settings)) return [];
  const wide = `@media (min-width: ${RAIL_FOLD_WIDTH}px)`;
  const between = `@media (min-width: ${RAIL_FOLD_WIDTH}px) and (max-width: ${TWO_RAILS_FOLD_WIDTH - 1}px)`;
  const both = `@media (min-width: ${TWO_RAILS_FOLD_WIDTH}px)`;
  // The bar collapses where every rail it relies on stands: from 1024 with one rail, from 1248 with
  // two (`collapseBar`).
  return [
    "/* the rail (ADR 0060) */",
    `.rb-rail { display: none; position: fixed; top: 0; bottom: 0; z-index: 2; box-sizing: border-box;`,
    `  width: ${RAIL_WIDTH}px; flex-direction: column; align-items: flex-start; gap: var(--space-lg);`,
    "  padding: var(--space-xl) var(--space-lg); overflow: hidden auto;",
    "  background: var(--color-surface); line-height: 1.3; }",
    `.rb-rail[data-side=left] { left: 0; border-right: ${HAIRLINE}; }`,
    `.rb-rail[data-side=right] { right: 0; border-left: ${HAIRLINE}; }`,
    ".rb-rail > .rb-nav { flex-direction: column; flex-wrap: nowrap; }",
    // Stacked, the two menus are told apart by a rule above the second, not beside it.
    ".rb-rail > .rb-nav + .rb-nav { align-self: stretch; padding-left: 0; border-left: 0;",
    `  padding-top: var(--space-lg); border-top: ${HAIRLINE}; }`,
    ".rb-rail > .rb-nav-action { margin-left: 0; }",
    ".rb-header[data-hairline=none] .rb-rail,",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink]) .rb-rail {",
    "  border-left: 0; border-right: 0; }",
    ".rb-header[data-bg=primary] .rb-rail { background: var(--color-primary); }",
    ".rb-header[data-bg=secondary] .rb-rail { background: var(--color-secondary); }",
    ".rb-header[data-bg=ink] .rb-rail { background: var(--color-ink); }",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink]) .rb-rail > .rb-nav + .rb-nav {",
    "  border-top-color: color-mix(in srgb, var(--color-surface) 20%, transparent); }",
    // **In a column the current entry is marked by a bar at its edge**, not by the rule under it: a
    // list read down is scanned along its edge. Every entry keeps the bar's room, in no colour, so
    // nothing moves when the mark arrives — and the negative margin keeps the words in line with the
    // brand and the button above and below them.
    // The tint behind the current entry (ADR 0063) is an eighth of the entry's own colour over the
    // rail — ink's on a surface rail, surface's on a coloured one — so it reads on every scheme.
    ".rb-rail .rb-nav a { padding: var(--space-xs) var(--space-sm); margin-left: calc(-1 * var(--space-sm));",
    "  border-radius: 0 var(--radius-sm) var(--radius-sm) 0; box-shadow: inset 3px 0 0 transparent; }",
    ".rb-rail .rb-nav a[aria-current] { text-decoration-color: transparent;",
    "  box-shadow: inset 3px 0 0 currentColor;",
    "  background: color-mix(in srgb, currentColor 12%, transparent); }",
    "@media (prefers-reduced-motion: no-preference) {",
    "  .rb-rail .rb-nav a { transition: text-decoration-color var(--rb-fast) var(--rb-ease),",
    "    box-shadow var(--rb-fast) var(--rb-ease), background-color var(--rb-fast) var(--rb-ease); }",
    "}",
    `${wide} {`,
    "  .rb-rail { display: flex; }",
    // The bar's copy of whatever stands in a rail, and the brand and button that went with the pages.
    "  .rb-header[data-pages=left] .rb-nav-wide > [data-part=pagesLinks],",
    "  .rb-header[data-pages=right] .rb-nav-wide > [data-part=pagesLinks],",
    "  .rb-header[data-sections=left] .rb-nav-wide > [data-part=sectionsLinks],",
    "  .rb-header[data-sections=right] .rb-nav-wide > [data-part=sectionsLinks],",
    "  .rb-header[data-brand=pages] > .rb-brand, .rb-header[data-brand=pages] > .rb-nav-action {",
    "    display: none; }",
    // With the pages' copy hidden, the sections are the first thing in the strip: `+` still
    // matches a hidden sibling, and the rule that tells the two menus apart drew a line beside
    // nothing (seen in Chromium at 1100 px on sprint 31 día 2, before this line).
    "  .rb-header[data-pages=left] .rb-nav-wide > .rb-nav + .rb-nav,",
    "  .rb-header[data-pages=right] .rb-nav-wide > .rb-nav + .rb-nav { padding-left: 0; border-left: 0; }",
    `  .rb-header[data-rails~=left], .rb-header[data-rails~=left] ~ main { margin-left: ${RAIL_WIDTH}px; }`,
    `  .rb-header[data-rails~=right], .rb-header[data-rails~=right] ~ main { margin-right: ${RAIL_WIDTH}px; }`,
    ...collapseBar('.rb-header[data-layout][data-bar=none]:not([data-rails="left right"])'),
    "}",
    // Two rails, too narrow for both: the sections' rail falls into the bar, and its side's margin
    // with it.
    `${between} {`,
    '  .rb-header[data-rails="left right"][data-sections=left] > .rb-rail[data-side=left],',
    '  .rb-header[data-rails="left right"][data-sections=right] > .rb-rail[data-side=right] {',
    "    display: none; }",
    '  .rb-header[data-rails="left right"] .rb-nav-wide > [data-part=sectionsLinks] { display: flex; }',
    '  .rb-header[data-rails="left right"][data-sections=left],',
    '  .rb-header[data-rails="left right"][data-sections=left] ~ main { margin-left: 0; }',
    '  .rb-header[data-rails="left right"][data-sections=right],',
    '  .rb-header[data-rails="left right"][data-sections=right] ~ main { margin-right: 0; }',
    "}",
    `${both} {`,
    ...collapseBar('.rb-header[data-layout][data-bar=none][data-rails="left right"]'),
    "}",
  ];
}

/**
 * **«Ir a…»** (ADR 0060, sprint 31 día 3): the sections behind one `<summary>`, in two places. Hidden
 * by default, like the rail, and shown where the owner put it.
 *
 * - **On a wide screen** (`data-sections=fold`, from 721 px) it floats, fixed, at the far side of the
 *   page — **under the bar, always**: its distance from the top is the bar's height *plus* a space
 *   (David's adjustment 2 and his erratum, with the sign written out). A fixed bar stays above it at
 *   every scroll; a bar in the flow is above it at the top of the page and scrolls away from it after.
 *   A bare `top: var(--space-md)` would have drawn it inside the bar at the top of the page, over the
 *   button. `header.browser.test.ts` measures the empty intersection and the sum.
 * - **On a phone** (`data-mobile=fold`, to 720 px) it is a word in the bar beside «Menú», and its open
 *   panel hangs under the whole bar as «Menú»'s does: one line, not the second row ADR 0043 refused.
 * - **The side** is the header's `data-rails`, never a measurement (adjustment 3): with the sections
 *   in the disclosure the only rail is the pages', so the disclosure takes the side that rail leaves
 *   free — the right unless the rail is there.
 * - **Its open panel is bounded by the window** and scrolls inside itself, down and never across, for
 *   the reason the rail does: a sideways scroller exempts its entries from the overflow walk.
 * - **The bar's scheme**, as the phone's «Menú» panel takes it — background and words, and `surface`
 *   for a transparent bar, since what floats over the page has nothing under it to show through.
 */
function foldCss(doc: RetorikaDocument): string[] {
  const settings = headerSettings(doc);
  if (!usesFold(settings)) return [];
  const coloured = ":is([data-bg=primary], [data-bg=secondary], [data-bg=ink])";
  const placed = ".rb-header[data-sections=fold] .rb-nav-fold";
  return [
    "/* «Ir a…» (ADR 0060) */",
    ".rb-nav-fold { display: none; padding: 0; }",
    ".rb-nav-fold > summary { color: var(--color-ink); font-family: var(--font-heading);",
    "  font-size: var(--size-body); cursor: pointer; list-style: none; }",
    ".rb-nav-fold > summary::-webkit-details-marker { display: none; }",
    ".rb-nav-fold > .rb-nav { position: absolute; left: 0; right: 0; top: 100%; z-index: 2;",
    "  flex-direction: column; flex-wrap: nowrap; gap: var(--space-sm);",
    "  padding: var(--space-md) var(--space-lg);",
    `  background: var(--color-surface); border-bottom: ${HAIRLINE}; }`,
    ".rb-header[data-size=small] .rb-nav-fold > summary { font-size: calc(var(--size-body) * 0.875); }",
    ".rb-header[data-uppercase] .rb-nav-fold > summary { text-transform: uppercase; letter-spacing: 0.06em; }",
    `.rb-header${coloured} .rb-nav-fold > summary { color: var(--color-surface); }`,
    ".rb-header[data-bg=primary] .rb-nav-fold > :is(summary, .rb-nav) { background: var(--color-primary); }",
    ".rb-header[data-bg=secondary] .rb-nav-fold > :is(summary, .rb-nav) { background: var(--color-secondary); }",
    ".rb-header[data-bg=ink] .rb-nav-fold > :is(summary, .rb-nav) { background: var(--color-ink); }",
    // Its panel comes in: from 4 px above, out of nothing — one `animation` on the element, filled
    // backwards (sprint 22's two traps: two animations on one box fight, and an unfilled one flashes
    // its end state for a frame).
    "@keyframes rb-fold-in { from { opacity: 0; transform: translateY(-4px); } }",
    "@media (prefers-reduced-motion: no-preference) {",
    "  .rb-nav-fold[open] > .rb-nav { animation: rb-fold-in var(--rb-base) var(--rb-ease) backwards; }",
    "}",
    "@media (min-width: 721px) {",
    `  ${placed} { display: block; position: fixed; z-index: 2;`,
    "    top: calc(var(--rb-header-h) + var(--space-md)); right: var(--space-md); }",
    `  ${placed} > summary { padding: var(--space-sm) var(--space-lg); background: var(--color-surface);`,
    `    border: ${HAIRLINE}; border-radius: 999px;`,
    "    box-shadow: 0 8px 24px -16px var(--color-ink); }",
    // `width: max-content` because an absolute box sizes to its containing block, which here is the
    // `<details>` — as wide as «Ir a…» — and every entry would wrap to that. Bounded by the window,
    // the summary above it and a space below.
    `  ${placed} > .rb-nav { left: auto; right: 0; top: calc(100% + var(--space-xs));`,
    "    box-sizing: border-box; width: max-content; min-width: 100%;",
    "    max-width: min(320px, calc(100vw - 2 * var(--space-md)));",
    "    max-height: calc(100vh - var(--rb-header-h) - 4 * var(--space-md) - 1.5 * var(--size-body));",
    `    overflow: hidden auto; border: ${HAIRLINE}; border-radius: var(--radius-lg);`,
    "    box-shadow: 0 8px 24px -16px var(--color-ink); }",
    `  .rb-header${coloured} .rb-nav-fold > :is(summary, .rb-nav) { border: 0; }`,
    // Nothing left in the bar but the disclosure, and no rail: the bar is no height from here.
    ...collapseBar(".rb-header[data-layout][data-bar=none]:not([data-rails])"),
    "}",
    ...(usesRail(settings)
      ? [
          `@media (min-width: ${RAIL_FOLD_WIDTH}px) {`,
          `  .rb-header[data-sections=fold][data-rails=right] .rb-nav-fold { right: auto; left: var(--space-md); }`,
          `  .rb-header[data-sections=fold][data-rails=right] .rb-nav-fold > .rb-nav { right: auto; left: 0; }`,
          "}",
        ]
      : []),
    "@media (max-width: 720px) {",
    // **The bar's words close up when «Ir a…» joins them.** Measured at 320 px with «Taberna Santo
    // Domingo», its logo, «Contacto», «Ir a…» and «Menú»: at the phone's usual 16 px between them the
    // brand had 21 px left and its 40 px logo ran 3 px over the button. At 8 px it has 45: the logo
    // whole and the name cut to nothing, which is what the ellipsis is for.
    "  .rb-header:has(> .rb-nav-fold[data-mobile=fold]) { column-gap: var(--space-sm); }",
    "  .rb-header[data-sections] .rb-nav-fold[data-mobile=fold] { display: block; }",
    "  .rb-nav-fold[data-mobile=fold] { margin-left: auto; }",
    // A hidden sibling still matches `+` (sprint 31 día 2), so the rule names the one that is drawn.
    "  .rb-nav-action + .rb-nav-fold[data-mobile=fold],",
    "  .rb-nav-fold[data-mobile=fold] + .rb-nav-narrow { margin-left: 0; }",
    "}",
  ];
}

/**
 * The header below 720px, in its own `@media` block and not in the shared one — the shared block is
 * the mobile layout of every site this product has ever published and `mobile.test.ts` pins its
 * text (see `build.ts`). `display: none` and not `visibility` or a clip: only `display: none` takes
 * an element out of the accessibility tree, and the whole point of emitting two copies is that a
 * screen reader is never told about a navigation landmark it cannot reach.
 *
 * On a phone the bar is one line — brand, button, «Menú» — and the sections are a row that scrolls
 * sideways under it, or nothing. The bar's padding tightens to `space.sm`, which with a 40px logo
 * bounds it to 72px: under 15% of the 568px the overflow suite measures at. **A fixed bar lets go on
 * a phone that shows the row** (`data-phone-row`): bar and row together pass the bound, and a
 * sticky element cannot stick by halves.
 */
export function headerMobileCss(doc: RetorikaDocument): string[] {
  if (!headerDrawn(doc)) return [];
  return [
    ".rb-nav-narrow { display: none; }",
    "@media (max-width: 720px) {",
    "  html { --rb-bar-h: calc(2 * var(--space-sm) + max(40px, 1.5 * var(--size-body))); }",
    "  .rb-header { gap: var(--space-sm) var(--space-md); padding: var(--space-sm) var(--space-lg); }",
    // The brand takes what the button and «Menú» leave and no more: a flex basis of zero means it
    // never asks the line to wrap, and `min-width: 0` (set above) lets the ellipsis do its work.
    // Measured at 320px with «Taberna Santo Domingo» and a logo: one line, 56px, where a brand at
    // its natural width wrapped the bar onto two lines and 107px.
    "  .rb-brand { flex: 1 1 0; }",
    "  .rb-nav-wide { display: none; }",
    "  .rb-nav-narrow { display: block; margin-left: auto; }",
    "  .rb-nav-action + .rb-nav-narrow { margin-left: 0; }",
    // `[data-sections]` is here for weight and not for its value: the rule above that hides the
    // row on a wide screen names `:not([data-sections=row])` and weighs (0,3,0), and a plain
    // `.rb-header .rb-nav-row` (0,2,0) lost to it at every width — found in the browser, where the
    // phone's row was simply not there. The hidden case below weighs the same and comes later.
    // `justify-content: flex-start` whatever the owner's alignment: in a box that scrolls sideways,
    // entries packed to the end overflow at the *start*, where no scroll can reach them — measured
    // by `header.browser.test.ts`, whose row stopped scrolling the day alignment arrived.
    "  .rb-header[data-sections] .rb-nav-row { display: flex; flex-wrap: nowrap; overflow-x: auto;",
    "    justify-content: flex-start; padding-bottom: var(--space-xs); }",
    "  .rb-header .rb-nav-row a { white-space: nowrap; }",
    // Hidden when the owner chose nothing for the phone — and when they chose «Ir a…» (sprint 32
    // día 1): a row that stands at every width still carries the phone's choice, and with both drawn
    // the sections were announced twice at 320.
    "  .rb-header[data-sections] .rb-nav-row:is([data-mobile=hidden], [data-mobile=fold]) { display: none; }",
    "  .rb-header[data-layout=stacked] .rb-brand { flex-basis: 0; }",
    "  .rb-header[data-sticky][data-phone-row] { position: static; }",
    "  .rb-header[data-sticky][data-phone-row] ~ main [data-section] { scroll-margin-top: 0; }",
    "}",
    "",
  ];
}
