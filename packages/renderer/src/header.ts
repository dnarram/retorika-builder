import {
  HEADER_PARTS,
  type Header,
  type HeaderAction,
  type HeaderBackground,
  type HeaderLayout,
  type HeaderPart,
  hrefForPage,
  type Page,
  type RetorikaDocument,
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
 *   <details class="rb-nav-narrow"><summary>Menú</summary> <nav Páginas> </details>   phones
 *   <nav class="rb-nav rb-nav-row" aria-label="Secciones">…</nav>  a row of its own, or the phone's
 * </header>
 * ```
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
  sectionsRow: "shared" | "own";
  sectionsMobile: "row" | "hidden";
  layout: HeaderLayout;
  brandName: boolean;
  logo: { src: string } | undefined;
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
    sectionsRow: header.sections?.row ?? "shared",
    sectionsMobile: header.sections?.mobile ?? "row",
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
 * as the link's text, rather than «Taberna Taberna». `height` is written as an attribute as well as
 * in the stylesheet, so the bar has its height before the image arrives and nothing jumps.
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
        height: "40",
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
    "data-sections": settings.sectionsRow,
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

  const children: RenderNode[] = [];
  if (brand) children.push(brand);

  // The wide bar: the pages, and the sections when they share it. Left out entirely when it would
  // hold nothing — an empty strip is not navigation, and nothing is announced for it.
  const wide: RenderNode[] = [];
  if (pages.length > 0) wide.push(navNode(es["nav.pages"], "pagesLinks", pages));
  if (sections.length > 0 && settings.sectionsRow === "shared") {
    wide.push(navNode(es["nav.sections"], "sectionsLinks", sections));
  }
  if (wide.length > 0) children.push(element("div", { class: "rb-nav-wide" }, wide));

  if (action) {
    children.push(
      element("a", { class: "rb-nav-action", "data-part": "action", href: action.href }, [
        action.label,
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

  // The sections as a row of their own: at every width when the owner gave them one, and on the
  // phone when they share the bar and the owner kept them. `data-mobile` is what the stylesheet
  // reads to hide the row below 720px; the wide copy inside the bar is hidden there regardless.
  const rowAtAllWidths = settings.sectionsRow === "own";
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

  return [
    element("a", { class: "rb-skip", href: "#rb-main" }, [es["nav.skip"]]),
    element("header", { class: "rb-header", ...lookAttributes(doc, settings) }, children),
  ];
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
      rules.push(`${PART_SELECTOR[part]} { ${declarations.join("; ")}; }`);
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
export function headerCss(doc: RetorikaDocument): string[] {
  if (!headerDrawn(doc)) return [];
  return [
    // The skip link: off-screen until it has focus, and then the first thing on the page. `top`
    // rather than a clip, so the one transition it makes is the one a sighted keyboard user sees.
    ".rb-skip { position: absolute; left: var(--space-md); top: -100px; z-index: 3;",
    "  padding: var(--space-sm) var(--space-md); background: var(--color-surface);",
    "  color: var(--color-primary); font-family: var(--font-heading); font-size: var(--size-body);",
    "  border-radius: var(--radius-sm); text-decoration: underline; }",
    ".rb-skip:focus-visible { top: var(--space-md); }",
    // The bar's height as the stylesheet can estimate it — its padding and the taller of the logo
    // and a line of text — for the anchors to land under a fixed bar and for the cover to make
    // room under a transparent one. The script refines it with `offsetHeight` where it runs.
    "html { --rb-header-h: calc(2 * var(--space-md) + max(40px, 1.5 * var(--size-body))); }",
    // Smooth, and only for somebody who has not asked their system for less motion (David's point 7).
    "@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }",
    // The bar. One flex row that wraps: brand, the wide strip pushed to the far side, the button,
    // and — on its own line when it has one — the sections row. A hairline under it, so it reads
    // as a bar rather than as the page's top padding — the same `color.muted` rule `.rb-item`
    // separates cards with. Decorative, so the text contrast minimum does not apply to it.
    // `position: relative` is for the phone's open menu, which hangs under the whole bar (below).
    ".rb-header { position: relative; display: flex; flex-wrap: wrap; align-items: center;",
    "  gap: var(--space-md) var(--space-xl); padding: var(--space-md) var(--space-xl);",
    "  background: var(--color-surface); border-bottom: 1px solid var(--color-muted); }",
    ".rb-header[data-hairline=none] { border-bottom: 0; }",
    // The brand never breaks the bar's height: one line, cut with an ellipsis before it wraps
    // (David's adjustment 3, measured with «Taberna Santo Domingo» and a logo at 320px). `min-width:
    // 0` is what lets a flex item shrink below its text; without it the ellipsis never happens.
    ".rb-brand { display: flex; align-items: center; gap: var(--space-sm); min-width: 0;",
    "  max-width: 100%; color: var(--color-primary); font-family: var(--font-heading);",
    "  font-size: var(--size-body); font-weight: 700; text-decoration: none; }",
    ".rb-brand-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".rb-logo { height: 40px; width: auto; flex: none; }",
    ".rb-nav-wide { display: flex; flex-wrap: wrap; gap: var(--space-xl); margin-left: auto; }",
    ".rb-nav { display: flex; flex-wrap: wrap; gap: var(--space-md); }",
    // What tells the two groups apart for an eye: the accessible name does it for a screen reader,
    // and this does it without adding a word of copy to every published page.
    ".rb-nav + .rb-nav { padding-left: var(--space-xl); border-left: 1px solid var(--color-muted); }",
    ".rb-nav a { color: var(--color-primary); font-family: var(--font-heading);",
    "  font-size: var(--size-body); text-decoration: none; }",
    // Not colour alone: the entry for the page you are on carries a rule under it as well, and so
    // does the entry of the section in view once the script marks it (`aria-current="location"`).
    ".rb-nav a[aria-current] { text-decoration: underline; text-underline-offset: 6px;",
    "  text-decoration-thickness: 2px; }",
    // The button: the same look as a section's own button (`[role=button]`), so one site has one
    // idea of a button. Pushed to the far side when nothing else is there. `rb-nav-action` and not
    // `rb-action`: the editor's canvas chrome already names its verbs `.rb-action`, inside the same
    // frame this stylesheet lives in, and the first name restyled every verb of the toolbar —
    // measured by the sprint 20 walk, which found a verb at 36px where the scale says otherwise.
    ".rb-nav-action { display: inline-block; padding: var(--space-sm) var(--space-md);",
    "  background: var(--color-primary); color: var(--color-surface); font-family: var(--font-heading);",
    "  font-size: var(--size-body); border-radius: var(--radius-sm); text-decoration: none;",
    "  white-space: nowrap; }",
    ".rb-brand + .rb-nav-action, .rb-header > .rb-nav-action:first-child { margin-left: auto; }",
    ".rb-nav-narrow { padding: 0; }",
    ".rb-nav-narrow > summary { color: var(--color-primary); font-family: var(--font-heading);",
    "  font-size: var(--size-body); cursor: pointer; }",
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
    "  background: var(--color-surface); border-bottom: 1px solid var(--color-muted); }",
    // The sections row: a full line of its own under the bar. Shown at every width when the owner
    // gave the sections their own row; otherwise it is the phone's copy and hidden here.
    ".rb-nav-row { flex-basis: 100%; }",
    ".rb-header[data-sections=shared] .rb-nav-row { display: none; }",
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
    // Underline on hover is a decoration the owner asks for, never a colour: the entry keeps its
    // hue, and the keyboard gets the same line the pointer gets.
    ".rb-header[data-hover] .rb-nav a:hover, .rb-header[data-hover] .rb-nav a:focus-visible {",
    "  text-decoration: underline; text-underline-offset: 6px; }",
    // **The schemes.** Four opaque backgrounds and one transparent. On a coloured bar the entries,
    // the brand and the «Menú» word are `color.surface` (proved: surface on primary 4.71, on
    // secondary 5.47, on ink 9.28, the lowest palette each), the hairline goes — the bar already
    // contrasts with the page — and the button inverts to `surface` with `primary` words, since a
    // `primary` button on a `primary` bar is no button (and 1.77 against `ink`).
    ".rb-header[data-bg=primary] { background: var(--color-primary); border-bottom: 0; }",
    ".rb-header[data-bg=secondary] { background: var(--color-secondary); border-bottom: 0; }",
    ".rb-header[data-bg=ink] { background: var(--color-ink); border-bottom: 0; }",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink])",
    "  :is(.rb-brand, .rb-nav a, .rb-nav-narrow > summary) { color: var(--color-surface); }",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink]) .rb-nav + .rb-nav {",
    "  border-left-color: var(--color-surface); }",
    ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink]) .rb-nav-action {",
    "  background: var(--color-surface); color: var(--color-primary); }",
    // The phone's open menu keeps the bar's colours, since it hangs from the bar.
    ".rb-header[data-bg=primary] .rb-nav-narrow .rb-nav { background: var(--color-primary); }",
    ".rb-header[data-bg=secondary] .rb-nav-narrow .rb-nav { background: var(--color-secondary); }",
    ".rb-header[data-bg=ink] .rb-nav-narrow .rb-nav { background: var(--color-ink); }",
    // **Transparent lies over the cover** (David's adjustment 1a): the bar is taken out of the flow
    // and the first section opens room under it, the bar's estimated height on top of its own
    // padding, so the headline is never under the links.
    ".rb-header[data-bg=transparent] { position: absolute; left: 0; right: 0; top: 0; z-index: 2;",
    "  background: transparent; border-bottom: 0; }",
    ".rb-header[data-bg=transparent] + main > .rb-section:first-child {",
    "  padding-top: calc(var(--space-xl) + var(--rb-header-h)); }",
    // **Fixed** («se queda arriba al bajar», David's point 8): sticky, over the content, and every
    // section makes room for it when an anchor lands. A shadow once the page has scrolled, which
    // only the script can know — two layers, both from the palette.
    ".rb-header[data-sticky] { position: sticky; top: 0; z-index: 2; }",
    ".rb-header[data-sticky] ~ main [data-section] { scroll-margin-top: var(--rb-header-h); }",
    ".rb-header[data-sticky][data-scrolled] { box-shadow: 0 1px 0 var(--color-muted),",
    "  0 8px 24px -16px var(--color-ink); }",
    // **Transparent and fixed do not meet without the script** (David's adjustment 1b): a
    // transparent bar fixed over text is unreadable. Without the script's mark the bar stays
    // absolute and scrolls away with the cover; with it, it is fixed, and once the page has scrolled
    // it takes the `surface` scheme — background, hairline and all.
    ".rb-header[data-sticky][data-bg=transparent] { position: absolute; }",
    "html[data-rb-js] .rb-header[data-sticky][data-bg=transparent] { position: fixed; }",
    ".rb-header[data-sticky][data-bg=transparent][data-scrolled] { background: var(--color-surface);",
    "  border-bottom: 1px solid var(--color-muted); }",
    ...headerStyleCss(doc),
    "",
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
    "  html { --rb-header-h: calc(2 * var(--space-sm) + max(40px, 1.5 * var(--size-body))); }",
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
    // row on a wide screen names `[data-sections=shared]` and weighs (0,3,0), and a plain
    // `.rb-header .rb-nav-row` (0,2,0) lost to it at every width — found in the browser, where the
    // phone's row was simply not there. The hidden case below weighs the same and comes later.
    // `justify-content: flex-start` whatever the owner's alignment: in a box that scrolls sideways,
    // entries packed to the end overflow at the *start*, where no scroll can reach them — measured
    // by `header.browser.test.ts`, whose row stopped scrolling the day alignment arrived.
    "  .rb-header[data-sections] .rb-nav-row { display: flex; flex-wrap: nowrap; overflow-x: auto;",
    "    justify-content: flex-start; padding-bottom: var(--space-xs); }",
    "  .rb-header .rb-nav-row a { white-space: nowrap; }",
    "  .rb-header[data-sections] .rb-nav-row[data-mobile=hidden] { display: none; }",
    "  .rb-header[data-layout=stacked] .rb-brand { flex-basis: 0; }",
    "  .rb-header[data-sticky][data-phone-row] { position: static; }",
    "  .rb-header[data-sticky][data-phone-row] ~ main [data-section] { scroll-margin-top: 0; }",
    "}",
    "",
  ];
}
