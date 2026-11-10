import {
  type BrandNameSize,
  HEADER_PARTS,
  type Header,
  type HeaderAction,
  type HeaderBackground,
  type HeaderLayout,
  type HeaderLogo,
  type HeaderPart,
  hrefForPage,
  type LogoSize,
  type Page,
  type PagesPosition,
  type RetorikaDocument,
  type SectionsOnMobile,
  type SectionsPosition,
  tokenPx,
} from "@retorika/schema";
import { safeUrl } from "./escape.ts";
import {
  BAR_EXCESS,
  BAR_EXCESS_DIGITS,
  FALLBACK_ADVANCES,
  GLYPH_ADVANCES,
  GLYPHS,
  KERNING_MARGINS,
} from "./glyphAdvances.ts";
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
  /** The logo's drawn size and the name's, in the owner's words (ADR 0069); `md` and `body` are
   * what every bar drew before the words existed. */
  logoSize: LogoSize;
  nameSize: BrandNameSize;
  /** Where the brand sits in its line (ADR 0070): the layout's own place when the owner chose
   * none — the start, or the centre of the brand's own line when stacked — derived here beside
   * `align`'s default, so the panel and the page read the absence the same way. */
  brandPlace: "start" | "center" | "end";
  action: HeaderAction | undefined;
  sticky: boolean;
  /** The line of how much has been read (ADR 0068): only ever on a fixed bar. */
  progress: boolean;
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
    logoSize: header.brand?.logoSize ?? "md",
    nameSize: header.brand?.nameSize ?? "body",
    brandPlace: header.brand?.place ?? (layout === "stacked" ? "center" : "start"),
    action: header.action,
    sticky: header.sticky ?? false,
    progress: header.sticky === true && header.progress === true,
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
 * **The header's own widths, per document** (sprint 34 días 1 and 2): the widest screen its phone
 * layout reaches, and the narrowest one a rail stands on. They were two literals — 720 in five
 * `@media` blocks, 1024 in the rails' — that every check and every sentence of the editor assumed.
 * Since día 2 (ADR 0067) **the phone width is the document's**: the widest screen at which the bar's
 * one line would not hold its words, estimated from what the bar holds (`stripEstimate`), and 720
 * where every line fits from 721 up. A rail stands from just above it, never under 1024. **A bar
 * whose words do not fit even the page's measure (1200 px) is the phone's at every width**: `phone`
 * is then the named value `"always"` — the phone block is emitted with no `@media` at all, no rail is
 * emitted — and `rails` is `"none"`, so that whoever reads this (the checks, `zonesFor`, the panel)
 * tells it apart with no arithmetic (David's first adjustment approving sprint 34).
 *
 * Two rails on opposite sides still stand from `TWO_RAILS_FOLD_WIDTH` or from the rails' width,
 * whichever is later; the sections' phone breakpoint — the shared block of `build.ts` — is not the
 * header's and does not move.
 */
export type HeaderWidths =
  | {
      /** The widest screen the header's phone layout reaches. */
      phone: number;
      /** The narrowest screen a rail stands on. */
      rails: number;
      /** How many characters over the line the widest bar is at 1247 px (0 when it fits there):
       * what the download review says to cut (sprint 34 día 4). */
      over: number;
    }
  | {
      phone: "always";
      rails: "none";
      /** How many characters over the page's measure the widest bar is: what it takes for the line
       * to fit on a wide screen at all. */
      over: number;
      /** How many px the widest bar's estimate passes the measure by — what tells «por muy poco»
       * from «a ningún ancho» in the download review (David's condition of sprint 34 día 3: under
       * 5 % of the measure, the line might well fit, and the owner is told how little it takes). */
      beyond: number;
    };

/** Whether `width` is a phone width for this header, and whether a rail stands at it. */
export function phoneAt(widths: Pick<HeaderWidths, "phone">, width: number): boolean {
  return widths.phone === "always" || width <= widths.phone;
}
export function railsAt(widths: Pick<HeaderWidths, "rails">, width: number): boolean {
  return widths.rails !== "none" && width >= widths.rails;
}
/** The width two rails on opposite sides stand from: 1248, or the rails' own if later. */
function twoRailsFrom(widths: HeaderWidths): number {
  return widths.rails === "none"
    ? Number.POSITIVE_INFINITY
    : Math.max(TWO_RAILS_FOLD_WIDTH, widths.rails);
}

/**
 * **The three heights the logo is drawn at** (ADR 0069, sprint 35 día 4), by the owner's word:
 * `md` is the 40 px every logo drew before the word existed. The one place the numbers live: the
 * stylesheet, the `<img>`'s own `height`, the bar's estimate and the fold's all read them here, and
 * the editor's «Menú» panel says them from here too.
 */
export const LOGO_HEIGHTS: Record<LogoSize, number> = { sm: 28, md: 40, lg: 56 };
/**
 * The phone's bar is never taller than this (sprint 30's bound, under 15 % of a 568 px screen):
 * what the audit's check 3 and the browser tests hold it to, and what the large logo is cut to fit
 * under on a phone (`logoHeightCss`).
 */
export const PHONE_BAR_MAX = 72;
/**
 * The logo's height as the stylesheet writes it. **On a phone the large one derives, by the token**
 * (rule 7): `min(56px, calc(71px - 2 * var(--space-sm)))` is 56 at the compact scale, 55 at the
 * default and 47 at the generous — the most the bar can give a logo and stay under `PHONE_BAR_MAX`
 * with its padding and its hairline, worked out from the same `space.sm` the bar pads with rather
 * than written as a table. The bar's estimate uses this same expression, so `--rb-bar-h` is the
 * drawn bar to the pixel.
 */
export function logoHeightCss(size: LogoSize, phone: boolean): string {
  if (phone && size === "lg")
    return `min(56px, calc(${PHONE_BAR_MAX - 1}px - 2 * var(--space-sm)))`;
  return `${LOGO_HEIGHTS[size]}px`;
}
/**
 * **The same height in pixels, for the sentence that says it** (sprint 35 día 5): the «Menú» panel
 * tells the owner how tall the logo is drawn, on a phone too, and reads it here rather than from a
 * table of its own — `logoHeightCss` evaluated against the theme's `space.sm`, so the number in the
 * sentence is the number the stylesheet draws.
 */
export function logoDrawnPx(
  size: LogoSize,
  phone: boolean,
  theme: RetorikaDocument["theme"],
): number {
  if (phone && size === "lg") {
    return Math.min(LOGO_HEIGHTS.lg, PHONE_BAR_MAX - 1 - 2 * tokenPx(theme["space.sm"]));
  }
  return LOGO_HEIGHTS[size];
}

/**
 * The name's font size as the stylesheet writes it: the reading size (scaled 0.875 by the bar's
 * «small», as the `data-size` rule does), the subheading's, or the heading's — **which on a phone
 * is the subheading's** (rule 7): the generous scale's heading is 48 px, and 48 × 1.3 of line and
 * the bar's padding is 87, over the phone's 72. The estimate and the fold use this same token.
 */
export function brandSizeToken(settings: HeaderSettings, phone: boolean): string {
  if (settings.nameSize === "body") {
    return settings.size === "small" ? "0.875 * var(--size-body)" : "var(--size-body)";
  }
  if (settings.nameSize === "heading" && !phone) return "var(--size-heading)";
  return "var(--size-subheading)";
}

/** A logo stored without its size (before 1.16.0) is counted this many times as wide as its 40 px. */
export const UNSIZED_LOGO_ASPECT = 4;
/** The lane a classic scroll bar takes, which a `@media` width counts and the bar's padding does
 * not: 15 px on Windows, on Linux and in CI. */
export const SCROLLBAR_LANE = 15;
/** The page's measure, `--rb-measure` in `build.ts`: the widest the bar's content box gets. */
export const BAR_MEASURE = 1200;
const MEASURE = BAR_MEASURE;

/** Where each glyph's digit sits in a row of `BAR_EXCESS`. */
const GLYPH_INDEX = new Map(GLYPHS.map((glyph, i) => [glyph, i]));

/**
 * **A label's width is the sum of its glyphs' advances** (`glyphAdvances.ts`, David's decision of
 * sprint 34 día 2) in the first family of the stack, at the weight, plus the bar's letter-spacing in
 * capitals (0.06 em a character) and a margin for kerning, which the advances leave out. A glyph the
 * table did not measure counts as the widest the family has: an estimate may run long, never short.
 *
 * **The kerning margin is measured, per case** (`KERNING_MARGINS`, David's decision of día 3): 3 % in
 * lower case, 1.5 % in capitals, or the widest kerning any machine measured if that is wider. In
 * capitals kerning gives back next to nothing and the 3 % was all slack — enough to carry Hepta Slab
 * at the generous scale past the measure, and a bar that fits from 1 318 px to «Menú» at every width.
 * A family the product does not ship has no kerning measured, and keeps the lower case's, the wider.
 *
 * **A shipped face at a size the bar takes adds what the widest machine measured** (`BAR_EXCESS`,
 * David's decision of sprint 34 día 3): at 13.125 px Linux draws Poppins at least 3.5 % wider than
 * macOS — a hinted glyph is a whole pixel there — and the fold estimated from macOS alone let that
 * bar break 2 px past it on CI. **Every other glyph is rounded up to the pixel**: a fallback one, since
 * the system letters it stands for are hinted on Linux (sprint 34 día 2, CI's first run: a `system-ui`
 * bar 1–2 px past the whole margin), and a shipped one at a size nobody measured, for the same reason.
 */
function labelPx(
  label: string,
  stack: string,
  weight: 400 | 700,
  upper: boolean,
  size: number,
): number {
  const family = (stack.split(",")[0] ?? "").trim().replace(/^['"]|['"]$/g, "");
  const shipped = GLYPH_ADVANCES[family];
  const advances = (shipped ?? FALLBACK_ADVANCES)[weight];
  const widest = Math.max(...Object.values(advances));
  const excess = shipped
    ? BAR_EXCESS[family]?.[weight]?.[String(Math.round(size * 1000) / 1000)]
    : undefined;
  const over = (glyph: string): number => {
    if (excess === undefined) return 0;
    const at = GLYPH_INDEX.get(glyph);
    const digits = at === undefined ? [...excess] : [excess[at] ?? ""];
    const n = Math.max(...digits.map((d) => BAR_EXCESS_DIGITS.indexOf(d)));
    if (n < 0) throw new Error(`labelPx: no excess for «${glyph}» in ${family} ${weight} ${size}`);
    return n / 16;
  };
  const glyphs = [...(upper ? label.toUpperCase() : label)];
  const sum = glyphs.reduce((total, glyph) => {
    const px = (advances[glyph] ?? widest) * size;
    return total + (excess === undefined ? Math.ceil(px) : px + over(glyph));
  }, 0);
  const margin = shipped && upper ? KERNING_MARGINS.upper : KERNING_MARGINS.lower;
  return sum * margin + (upper ? 0.06 * size * glyphs.length : 0);
}

/** The text of a node, its own and its children's. */
function textOf(node: RenderNode | string): string {
  return typeof node === "string" ? node : node.children.map(textOf).join("");
}
function hasClass(node: RenderNode | string, name: string): node is RenderNode {
  return typeof node !== "string" && (node.attributes["class"] ?? "").split(" ").includes(name);
}

/**
 * **The widths the bar's line needs, per page** (sprint 34 día 2, ADR 0067): read off the very
 * nodes `headerNodes` draws for that page — so «Inicio» away from home, the button's destination
 * left out of the menus, and each page's own sections count exactly as they are drawn — and summed
 * with the stylesheet's own gaps: an entry is its characters by the family's measured advance at the
 * bar's size, a nav its entries and `space.md` between them (or the owner's gap), the strip its navs
 * and `space.xl`, the brand its logo (40 px by its aspect) and `space.sm` and its name in the heading
 * face at 700, the button its words at 700 and `space.lg` each side, and the line the items that are
 * present with `space.xl` between them. Three lines per page, one per band of the rails: with none
 * standing, with the pages' alone (two opposite rails under 1248), with every one — because a rail
 * takes its menu out of the strip, and the brand and the button with it when they go with the pages.
 * A collapsed bar (`data-bar=none`) needs nothing in the bands where it collapses. The sections' row,
 * where this page draws one at every width, is a line of its own that has to fit too.
 */
interface BarLines {
  /** With no rail standing, with the pages' rail alone, with every rail. */
  none: number;
  pagesRail: number;
  all: number;
  /** Whether the page draws two rails on opposite sides (the second from 1248). */
  twoRails: boolean;
  /** Whether a rail stands on this page at all. */
  anyRail: boolean;
}

function barLines(doc: RetorikaDocument, settings: HeaderSettings, page: Page): BarLines | null {
  const header = headerNodes(doc, page).find((node) => node.tag === "header");
  if (!header) return null;
  const px = (key: keyof RetorikaDocument["theme"]) => tokenPx(doc.theme[key]);
  const size = px("size.body") * (settings.size === "small" ? 0.875 : 1);
  const heading = doc.theme["font.heading"];
  const body = doc.theme["font.body"];
  const text = (label: string, stack: string, weight: 400 | 700, upper: boolean) =>
    labelPx(label, stack, weight, upper, size);
  const xl = px("space.xl");
  const navGap = px(`space.${settings.gap}`);

  const rails = (header.attributes["data-rails"] ?? "").split(" ").filter((s) => s !== "");
  const twoRails = rails.length === 2;
  const collapsed = header.attributes["data-bar"] === "none";
  const brandGoes = header.attributes["data-brand"] === "pages";
  const pagesSide = settings.pagesPosition;
  const sectionsSide = settings.sectionsPosition;

  const brandNode = header.children.find((c) => hasClass(c, "rb-brand"));
  let brand = 0;
  if (brandNode && typeof brandNode !== "string") {
    const logo = brandNode.children.find((c) => hasClass(c, "rb-logo"));
    const name = brandNode.children.find((c) => hasClass(c, "rb-brand-name"));
    if (logo && typeof logo !== "string") {
      const w = Number(logo.attributes["width"]);
      const h = Number(logo.attributes["height"]);
      const drawn = LOGO_HEIGHTS[settings.logoSize];
      brand +=
        w > 0 && h > 0 && logo.attributes["width"] ? (drawn * w) / h : drawn * UNSIZED_LOGO_ASPECT;
    }
    // The name at its own size (ADR 0069): the bar's, scaled by «small», or the token it was given,
    // which «small» does not scale again — as the stylesheet writes it.
    const nameSize =
      settings.nameSize === "body" ? size : px(`size.${settings.nameSize}` as "size.heading");
    if (name) {
      brand += (logo ? px("space.sm") : 0) + labelPx(textOf(name), heading, 700, false, nameSize);
    }
  }
  const action = header.children.find((c) => hasClass(c, "rb-nav-action"));
  const button =
    action === undefined
      ? 0
      : text(textOf(action), heading, 700, settings.uppercase) + 2 * px("space.lg");
  const navWidth = (nav: RenderNode): number => {
    const links = nav.children.filter(
      (c): c is RenderNode => typeof c !== "string" && c.tag === "a",
    );
    return (
      links.reduce((sum, a) => sum + text(textOf(a), body, 400, settings.uppercase), 0) +
      Math.max(0, links.length - 1) * navGap
    );
  };
  const wide = header.children.find((c) => hasClass(c, "rb-nav-wide"));
  // The strip's menus, and the pages' menu standing bare before the brand (ADR 0070's «en medio»):
  // an item of the line of its own, as the strip is.
  const navs =
    wide && typeof wide !== "string"
      ? wide.children.filter((c): c is RenderNode => typeof c !== "string" && c.tag === "nav")
      : [];
  const bare = header.children.find(
    (c): c is RenderNode => hasClass(c, "rb-nav") && !hasClass(c, "rb-nav-row"),
  );
  const row = header.children.find((c) => hasClass(c, "rb-nav-row"));
  const rowWidth =
    row && typeof row !== "string" && settings.sectionsPosition === "row" ? navWidth(row) : 0;

  const line = (standing: readonly string[]): number => {
    const pagesStand = pagesSide !== "bar" && standing.includes(pagesSide);
    const sectionsStand =
      (sectionsSide === "left" || sectionsSide === "right") && standing.includes(sectionsSide);
    if (collapsed && (twoRails ? standing.length === 2 : standing.length > 0)) return 0;
    const standsHere = (nav: RenderNode) => {
      const part = nav.attributes["data-part"];
      return part === "pagesLinks" ? !pagesStand : part === "sectionsLinks" ? !sectionsStand : true;
    };
    const shown = navs.filter(standsHere);
    const strip =
      wide === undefined
        ? null
        : shown.reduce((sum, nav) => sum + navWidth(nav), 0) + Math.max(0, shown.length - 1) * xl;
    const bareWidth = bare !== undefined && standsHere(bare) ? navWidth(bare) : null;
    const gone = brandGoes && pagesStand;
    const items = [
      ...(bareWidth === null ? [] : [bareWidth]),
      ...(settings.layout === "stacked" || gone || brand === 0 ? [] : [brand]),
      ...(strip === null ? [] : [strip]),
      ...(gone || button === 0 ? [] : [button]),
    ];
    const bar = items.reduce((a, b) => a + b, 0) + Math.max(0, items.length - 1) * xl;
    return Math.max(bar, rowWidth);
  };
  const pagesRailOnly = twoRails ? rails.filter((side) => side === pagesSide) : rails;
  return {
    none: line([]),
    pagesRail: line(pagesRailOnly),
    all: line(rails),
    twoRails,
    anyRail: rails.length > 0,
  };
}

/**
 * The widest viewport at which a line of `need` px does not fit, with `railsPx` of rails standing:
 * the content box is `min(1200, viewport − scrollbar − rails − 2 × space.xl)`. `Infinity` when the
 * line is wider than the measure, which no viewport can hold.
 */
function lastFailing(need: number, railsPx: number, xl: number): number {
  if (need > MEASURE) return Number.POSITIVE_INFINITY;
  return Math.ceil(need + SCROLLBAR_LANE + railsPx + 2 * xl) - 1;
}

export function headerWidths(doc: RetorikaDocument): HeaderWidths {
  if (!headerDrawn(doc)) return { phone: 720, rails: RAIL_FOLD_WIDTH, over: 0 };
  const settings = headerSettings(doc);
  const xl = tokenPx(doc.theme["space.xl"]);
  const lines = doc.pages
    .map((page) => barLines(doc, settings, page))
    .filter((l): l is BarLines => l !== null);
  // 1. With no rail standing: from 721 up to where a rail stands — never past 1023 on a page that
  //    draws a rail, since from 1024 the rail takes its menu out of the strip whatever the strip's
  //    copy would have needed below it (the bar's copy is where a rail falls, ADR 0060 §3). On a
  //    page with no rail this band has no end, and a line wider than the measure never fits.
  let phone = 720;
  let always = false;
  for (const l of lines) {
    const fail = lastFailing(l.none, 0, xl);
    if (!l.anyRail) {
      if (fail === Number.POSITIVE_INFINITY) always = true;
      else phone = Math.max(phone, fail);
    } else {
      phone = Math.max(phone, Math.min(fail, RAIL_FOLD_WIDTH - 1));
    }
  }
  // 2. With the pages' rail alone, between the rails' width and 1247 (only two opposite rails have
  //    a band of their own there); with every rail, from 1248 or the rails' width. A band that
  //    fails pushes the fold up, and the rails with it: the header is the phone's up to the fold
  //    and the wide one from just above, never the other way round.
  for (const l of lines) {
    if (!l.anyRail || always) continue;
    if (l.twoRails) {
      const from = Math.max(RAIL_FOLD_WIDTH, phone + 1);
      if (from <= TWO_RAILS_FOLD_WIDTH - 1) {
        const fail = Math.min(lastFailing(l.pagesRail, RAIL_WIDTH, xl), TWO_RAILS_FOLD_WIDTH - 1);
        if (fail >= from) phone = Math.max(phone, fail);
      }
    }
    const from = Math.max(l.twoRails ? TWO_RAILS_FOLD_WIDTH : RAIL_FOLD_WIDTH, phone + 1);
    const fail = lastFailing(l.all, RAIL_WIDTH * (l.twoRails ? 2 : 1), xl);
    if (fail === Number.POSITIVE_INFINITY) always = true;
    else if (fail >= from) phone = Math.max(phone, fail);
  }
  if (always) {
    // The line that never fits: a page with no rail at its one line, a page with rails at its line
    // with every rail standing — the band that has no end.
    const beyond = Math.max(...lines.map((l) => (l.anyRail ? l.all : l.none) - MEASURE));
    return {
      phone: "always",
      rails: "none",
      over: Math.ceil(beyond / OVER_CHARACTER_PX),
      beyond,
    };
  }
  return { phone, rails: Math.max(RAIL_FOLD_WIDTH, phone + 1), over: over(lines, xl, phone) };
}

/** Characters over the line at 1247 — the widest bar of the site against what 1247 px hold with
 * its rails standing — at the entries' advance; 0 when it fits there. A bar that never fits counts
 * against the measure instead (`headerWidths`). */
function over(lines: BarLines[], xl: number, phone: number): number {
  if (phone <= 1247) return 0;
  let worst = 0;
  for (const l of lines) {
    const railsPx = RAIL_WIDTH * (l.anyRail ? (l.twoRails ? 2 : 1) : 0);
    const have = Math.min(MEASURE, 1248 - SCROLLBAR_LANE - railsPx - 2 * xl);
    worst = Math.max(worst, l.all - have);
  }
  return worst <= 0 ? 0 : Math.ceil(worst / OVER_CHARACTER_PX);
}
/** A character of the download review's count: a lowercase letter's mean advance in the fallback
 * face at 16 px. */
const OVER_CHARACTER_PX =
  (16 *
    [..."abcdefghijklmnopqrstuvwxyz"].reduce((t, g) => t + (FALLBACK_ADVANCES[400][g] ?? 0), 0)) /
  26;

/** The `@media` line up to the header's phone width, and the one from just above it — `null`
 * where there is no such width: a phone block with no line is written bare, an above block not at
 * all. */
function upTo(widths: HeaderWidths): string | null {
  return widths.phone === "always" ? null : `@media (max-width: ${widths.phone}px)`;
}
function above(widths: HeaderWidths): string | null {
  return widths.phone === "always" ? null : `@media (min-width: ${widths.phone + 1}px)`;
}
/** The phone's rules: inside their `@media`, or bare where the header is the phone's at every
 * width. The wide rules: inside theirs, or not at all. */
function toPhone(widths: HeaderWidths, rules: string[]): string[] {
  const media = upTo(widths);
  return media === null ? rules : [`${media} {`, ...rules, "}"];
}
function fromAbove(widths: HeaderWidths, rules: string[]): string[] {
  const media = above(widths);
  return media === null ? [] : [`${media} {`, ...rules, "}"];
}

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
        // A logo kept without its size says only how tall it is drawn — the chosen height, so the
        // attribute and the stylesheet agree (ADR 0069); one with its size says the file's pixels,
        // which is what gives the browser its ratio before the bytes.
        ...(settings.logo.width === undefined || settings.logo.height === undefined
          ? { height: String(LOGO_HEIGHTS[settings.logoSize]) }
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
    ...(settings.progress ? { "data-progress": "" } : {}),
    ...(settings.hairline ? {} : { "data-hairline": "none" }),
    ...(headerPhoneRow(doc, settings) ? { "data-phone-row": "" } : {}),
    // **The brand's size and place** (ADR 0069, 0070), only when they are the owner's word and not
    // the default: a saved site's markup stays byte for byte what it was. Not `data-brand`, which
    // already means «went with the pages».
    ...(settings.logoSize !== "md" ? { "data-logo-size": settings.logoSize } : {}),
    ...(settings.nameSize !== "body" ? { "data-name-size": settings.nameSize } : {}),
    ...(doc.header?.brand?.place !== undefined ? { "data-brand-place": settings.brandPlace } : {}),
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
  // **«En medio» on a one-line bar is between the pages and the rest** (ADR 0070): the pages' menu
  // comes out of the strip and stands before the brand, in the document as on the screen, so the
  // order the eye reads — pages, brand, sections, button — is the order a keyboard walks. A true
  // centring would need a wrapper around the sections and the button that the DOM does not have;
  // the ADR names it as what it does not decide. On a phone the bare menu is hidden like the strip,
  // and the brand is first again: `center` derives to `start` there.
  const pagesBeforeBrand =
    brand !== undefined &&
    settings.brandPlace === "center" &&
    settings.layout !== "stacked" &&
    pages.length > 0;
  if (pagesBeforeBrand) children.push(navNode(es["nav.pages"], "pagesLinks", pages));
  if (brand) children.push(brand);

  // The wide bar: the pages, and the sections when their place is the bar or a rail — a rail's
  // copy here is where it falls on a narrower screen. Left out entirely when it would hold nothing:
  // an empty strip is not navigation, and nothing is announced for it. A row of their own and the
  // disclosure are places of their own at every wide width, so neither leaves a copy here.
  const wide: RenderNode[] = [];
  if (pages.length > 0 && !pagesBeforeBrand)
    wide.push(navNode(es["nav.pages"], "pagesLinks", pages));
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
        // The word, and a chevron that turns when the panel opens — drawn, not a character, so no
        // letter of the site decides its shape; hidden from the tree, because the word says it all.
        element("summary", {}, [
          es["nav.goTo"],
          element("span", { class: "rb-chevron", "aria-hidden": "true" }, []),
        ]),
        navNode(es["nav.sections"], "sectionsLinks", sectionsLinks(current, action)),
      ]),
    );
  }

  // The phone's disclosure holds the pages alone. A `<details>` and never a checkbox (ADR 0016), and
  // never an empty one: with no pages there is nothing to fold, and the row below is the whole menu.
  if (pages.length > 0) {
    children.push(
      element("details", { class: "rb-nav-narrow" }, [
        // **The icon and the word, and the word changes** (sprint 32 día 4): two bars that turn into
        // an X, and «Menú» that becomes «Cerrar» while the sheet is open. The word stays because the
        // people this product is for do not all read an icon alone; both words are rendered and the
        // stylesheet shows the one that applies, so the summary's name is the word on screen.
        element("summary", {}, [
          element("span", { class: "rb-burger", "aria-hidden": "true" }, []),
          element("span", { class: "rb-when-closed" }, [es["nav.menu"]]),
          element("span", { class: "rb-when-open" }, [es["nav.close"]]),
        ]),
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
  // **And the bar's exact colour holds once scrolled** (sprint 32 día 5, measured): the glass of ADR
  // 0063 weighs (0,4,0) and replaced an owner's exact bar colour with the surface's glass the moment
  // the page scrolled — words the owner set in white on their dark red then sat on near-white. The
  // scrolled selector weighs the same and comes after the glass, so it wins; the colour stays opaque,
  // because the glass's proof covers the palette's colours and not an owner's.
  const selectorOf = (part: HeaderPart) =>
    part !== "bar"
      ? PART_SELECTOR[part]
      : usesRail(headerSettings(doc))
        ? `${PART_SELECTOR.bar}, ${PART_SELECTOR.bar}[data-scrolled], ${PART_SELECTOR.bar} .rb-rail`
        : `${PART_SELECTOR.bar}, ${PART_SELECTOR.bar}[data-scrolled]`;
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
 * **The brand's size and place** (ADR 0069 and 0070, sprint 35 día 4), each option an attribute
 * the header carries only when it is the owner's word (`lookAttributes`), and **the rules always
 * in the sheet, in both targets**: the editor's «Menú» panel previews a word by writing the attribute
 * on the canvas's bar before the document has it (David's adjustment 3), so the canvas needs the
 * rules for words its document does not carry yet. A saved site's bar matches none of them and
 * draws exactly what it drew.
 *
 * The name's size goes on `.rb-brand`, where the owner's exact size is written too
 * (`PART_SELECTOR.brand`): after the bar's «small», which it is not scaled by again, and before
 * `headerStyleCss`, so the exact size still wins by order, as it always has.
 *
 * The place, in the brand's own line when stacked; on a one-line bar, `end` puts the brand after the
 * strip and the button with the free space before it, and `center` — the pages' menu drawn bare
 * before the brand (`headerNodes`) — halves the free space either side of it. Under either the
 * strip's `align` is inert: the links keep to the start, and the panel says so.
 */
function brandCss(): string[] {
  const oneLine = ".rb-header:not([data-layout=stacked])";
  return [
    `.rb-header[data-logo-size=sm] .rb-logo { height: ${LOGO_HEIGHTS.sm}px; }`,
    `.rb-header[data-logo-size=lg] .rb-logo { height: ${LOGO_HEIGHTS.lg}px; }`,
    ".rb-header[data-name-size=subheading] .rb-brand { font-size: var(--size-subheading); }",
    ".rb-header[data-name-size=heading] .rb-brand { font-size: var(--size-heading); }",
    ".rb-header[data-layout=stacked][data-brand-place=start] .rb-brand { justify-content: flex-start; }",
    ".rb-header[data-layout=stacked][data-brand-place=end] .rb-brand { justify-content: flex-end; }",
    `${oneLine}[data-brand-place=end] > .rb-brand { order: 3; margin-left: auto; }`,
    `${oneLine}[data-brand-place=center] > .rb-brand { margin-inline: auto; }`,
    `${oneLine}:is([data-brand-place=end], [data-brand-place=center]) > :is(.rb-nav-wide, .rb-nav-action) {`,
    "  margin-left: 0; margin-right: 0; }",
  ];
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
  const widths = headerWidths(doc);
  const settings = headerSettings(doc);
  return [
    // The skip link: off-screen until it has focus, and then the first thing on the page. `top`
    // rather than a clip, so the one transition it makes is the one a sighted keyboard user sees.
    ".rb-skip { position: absolute; left: var(--space-md); top: -100px; z-index: 3;",
    "  padding: var(--space-sm) var(--space-md); background: var(--color-surface);",
    "  color: var(--color-primary); font-family: var(--font-heading); font-size: var(--size-body);",
    "  border-radius: var(--radius-sm); text-decoration: underline; }",
    ".rb-skip:focus-visible { top: var(--space-md); }",
    // **The bar's height, twice** (ADR 0063, David's adjustment 7). `--rb-bar-h` is what the
    // stylesheet can estimate — its lines, summed by `barEstimate` from what the renderer knows the
    // bar holds — and it never changes with the scroll: the cover under a transparent bar makes its
    // room with it, so a bar that condenses once scrolled does not pull the headline up 16 px.
    // `--rb-header-h` starts as the same estimate and the script refines it with `offsetHeight` where
    // it runs: it is for the anchors, which should land under the bar as it is now, and for «Ir a…»,
    // which hangs from it.
    ...barHeightCss(doc, widths),
    // The motor's own numbers (`--rb-ease`, `--rb-fast`, `--rb-base`) are written for every site in
    // `build.ts` since día 2: the page's own motion reads them too.
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
    "  .rb-burger::before, .rb-burger::after { transition: transform var(--rb-fast) var(--rb-ease); }",
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
    // **`z-index: 1`**: the header is above the page wherever they meet, as its own stacking context
    // (sprint 32 día 2). Named for the page transition (ADR 0062 §3), a bar in the flow became a
    // stacking context anyway, and «Ir a…»'s `z-index: 2` — fixed, inside the header — was then
    // ranked inside the header's context and painted under a section's paragraph rising with its
    // own transform: Playwright found the paragraph intercepting the click. A sticky or transparent
    // bar already had its `z-index: 2`; this gives the flow bar the same standing.
    // **The bar has the page's measure** (ADR 0064): its brand lines up with the sections' words at
    // every width. A percentage of padding is a percentage of the containing block, which for the bar
    // is the `<body>` and not the `<main>` a rail narrows, so the rails' widths are taken out
    // (`--rb-rail-l`, `--rb-rail-r`, written where the rails' margins are).
    ".rb-header { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center;",
    "  gap: var(--space-md) var(--space-xl); padding: var(--space-md)",
    "    max(var(--space-xl), calc((100% - var(--rb-rail-l, 0px) - var(--rb-rail-r, 0px) - var(--rb-measure)) / 2));",
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
    ".rb-nav-narrow > summary { display: inline-flex; align-items: center; gap: var(--space-sm);",
    "  color: var(--color-ink); font-family: var(--font-heading);",
    "  font-size: var(--size-body); cursor: pointer; list-style: none; }",
    ".rb-nav-narrow > summary::-webkit-details-marker { display: none; }",
    // «Menú» closed, «Cerrar» open: `display: none` takes the other word out of the summary's name.
    ".rb-nav-narrow > summary > .rb-when-open, .rb-nav-narrow[open] > summary > .rb-when-closed {",
    "  display: none; }",
    ".rb-nav-narrow[open] > summary > .rb-when-open { display: inline; }",
    // Two bars of the summary's own colour, 18 px wide and 10 apart, that cross into an X when open.
    ".rb-burger { position: relative; flex: none; width: 18px; height: 12px; }",
    '.rb-burger::before, .rb-burger::after { content: ""; position: absolute; left: 0; right: 0;',
    "  height: 2px; border-radius: 1px; background: currentColor; }",
    ".rb-burger::before { top: 0; }",
    ".rb-burger::after { bottom: 0; }",
    ".rb-nav-narrow[open] .rb-burger::before { transform: translateY(5px) rotate(45deg); }",
    ".rb-nav-narrow[open] .rb-burger::after { transform: translateY(-5px) rotate(-45deg); }",
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
    ...brandCss(),
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
    ...fromAbove(widths, [
      "  .rb-header[data-sticky][data-scrolled] { padding-block: var(--space-sm);",
      "    margin-bottom: calc(2 * (var(--space-md) - var(--space-sm))); }",
    ]),
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
    ...progressCss(settings, widths, target),
    ...railCss(doc, widths),
    ...foldCss(doc, widths),
    ...headerStyleCss(doc),
    "",
  ];
}

/**
 * The widths at which the bar holds different things (ADR 0060): a phone; a tablet, where every rail
 * has fallen into the bar; 1024 to 1247, where the sections' rail falls when the two menus stand on
 * opposite sides; and from 1248, where every rail stands.
 */
type Band = "phone" | "tablet" | "between" | "wide";

/**
 * **The bar's height as the stylesheet can know it** (sprint 33 día 6, David's decision on the menu
 * audit): the sum of the bar's lines, each as tall as the tallest thing on it — a logo is 40 px, a
 * button a line of text and its padding, an entry a line and less padding, the brand's name a line —
 * with the gap between lines, the padding, and the hairline where one is drawn. **One line**, or
 * **two when the brand has a line of its own** (`stacked`) and something is left for the second, and
 * **the sections' row under them** where this page draws one (`row`, read by `:has` in
 * `barHeightCss`: a page with no section to list has no row).
 *
 * It used to be the padding and `max(40px, 1.5 × size.body)` for every bar: a line. The audit found a
 * transparent bar, stacked with its row, 150.4 px tall over a cover that made room for 72 — the row
 * across the cover's first words at every wide width —, and «Ir a…» hung in the canvas over a
 * stacked bar's second line. `header.browser.test.ts` holds every form to the bar the browser
 * measures, in the three engines: never more than a pixel short, never more than 16 over.
 *
 * **What it cannot know is a line that wraps because its words do not fit** — four menus and a long
 * button at 768: no stylesheet measures a line's words. That is the script's measure, published,
 * and the estimate where none runs.
 */
function barEstimate(
  doc: RetorikaDocument,
  settings: HeaderSettings,
  band: Band,
  row: boolean,
  everything = false,
): string {
  const phone = band === "phone";
  const space = phone ? "var(--space-sm)" : "var(--space-md)";
  const size = settings.size === "small" ? "0.875 * var(--size-body)" : "var(--size-body)";
  const text = `1.3 * ${size}`;
  const entry = `2 * var(--space-xs) + ${text}`;
  const button = `2 * var(--space-sm) + ${text}`;

  const pagesShown = settings.pagesShown && pageMenuEntries(doc).length > 0;
  const sectionsShown =
    settings.sectionsShown && doc.pages.some((page) => sectionMenuEntries(page).length > 0);
  const first = doc.pages[0];
  const action = first !== undefined && actionEntry(doc, first) !== undefined;
  const railsStand = !everything && (band === "between" || band === "wide");
  const pagesInRail = pagesShown && settings.pagesPosition !== "bar" && railsStand;
  const sectionsSide =
    settings.sectionsPosition === "left" || settings.sectionsPosition === "right";
  const opposite = pagesInRail && settings.pagesPosition !== settings.sectionsPosition;
  const sectionsInRail =
    railsStand && sectionsSide && (band === "wide" || (band === "between" && !opposite));
  const brandGoes = settings.brandWithPages && pagesInRail;

  const logo = settings.logo !== undefined && !brandGoes;
  const name = settings.brandName && !brandGoes;
  const buttonHere = action && !brandGoes;
  // The brand's own heights (ADR 0069): the logo at its word, and the name at its token where that
  // is not the bar's reading size — at the reading size its line is `text` below, as it always was.
  const logoHeight = logoHeightCss(settings.logoSize, phone);
  const nameLine = settings.nameSize === "body" ? null : `1.3 * ${brandSizeToken(settings, phone)}`;
  // The wide strip is drawn whenever a menu has a copy in it, **even where every copy is hidden**
  // because its rail stands: an empty flex item still takes a line of its own, and its gap, when the
  // brand has the first line to itself (measured: 16 px a stacked bar did not account for).
  const stripHere =
    !phone &&
    (pagesShown || (sectionsShown && (settings.sectionsPosition === "bar" || sectionsSide)));
  const entriesHere = phone
    ? false
    : (pagesShown && !pagesInRail) ||
      (sectionsShown &&
        (settings.sectionsPosition === "bar" ||
          (sectionsSide && !sectionsInRail) ||
          (everything && settings.sectionsPosition === "fold")));
  // **A bar left with nothing to draw collapses** (`collapseBar`) and makes no room of its own; what
  // still reads the estimate there — the editor's strip for a menu dropped back into the bar — reads
  // the bar that menu would come back to: everything the owner placed elsewhere, in it.
  const brandless = brandGoes || (!settings.logo && !settings.brandName && !action);
  if (!phone && !everything && !entriesHere && brandless) {
    return barEstimate(doc, settings, "tablet", row, true);
  }
  // On a phone the menus are «Menú» and «Ir a…», a word each and no padding. «Menú» is an inline
  // box inside its `<details>`, so its line is never shorter than the line of the `<details>`' own
  // letter — the page's, 1rem, which no size of the bar's makes smaller (measured: 2.6 px short at
  // the small size before this).
  const menuWord = phone && pagesShown ? `1.3 * max(1rem, ${size})` : null;
  const foldWord = phone && sectionsShown && settings.sectionsMobile === "fold" ? text : null;
  // The tallest words of the line that is not the brand's: a button is taller than an entry, an
  // entry than a word with no padding.
  const words = buttonHere ? button : entriesHere ? entry : (menuWord ?? foldWord);
  const restHere = buttonHere || stripHere || menuWord !== null || foldWord !== null;

  // Each line is a logo, if it holds one, against the tallest of its words — `0px` for a line that
  // is there and holds nothing visible.
  const lines: string[][] = [];
  if (settings.layout === "stacked" && !phone && (logo || name) && restHere) {
    lines.push([...(logo ? [logoHeight] : []), ...(name ? [nameLine ?? text] : [])]);
    lines.push([words ?? "0px"]);
  } else if (logo || name || restHere) {
    const ownName = name && nameLine !== null;
    const tallest = words ?? (name && !ownName ? text : null);
    lines.push([
      ...(logo ? [logoHeight] : []),
      ...(ownName ? [nameLine] : []),
      ...(tallest !== null ? [tallest] : logo || ownName ? [] : ["0px"]),
    ]);
  }
  // A phone's row keeps a little room under its entries for the scrollbar it may draw (below).
  if (row) lines.push([phone ? `3 * var(--space-xs) + ${text}` : entry]);

  const heights = lines.map((items) =>
    items.length === 1 ? items[0] : `max(${items.join(", ")})`,
  );
  const hairline = settings.hairline && settings.background !== "transparent" ? " + 1px" : "";
  const sum = heights.length === 0 ? "" : ` + ${heights.join(` + ${space} + `)}`;
  return `calc(2 * ${space}${sum}${hairline})`;
}

/**
 * `--rb-bar-h` for every width a wide screen can be, and `--rb-header-h` from it: one declaration on
 * the root where the bar is the same from 721 px up, one more per band where a rail takes something
 * out of it. **The row is a second declaration under `:has`**, read off the page itself: the
 * stylesheet is the site's, and a page whose sections lend no entry draws no row. The phone's own
 * pair is `headerMobileCss`'s.
 */
function barHeightCss(doc: RetorikaDocument, widths: HeaderWidths): string[] {
  const settings = headerSettings(doc);
  // The phone's at every width: its own estimate is the root's, and there is no band.
  if (widths.phone === "always") {
    return [
      `html { --rb-bar-h: ${barEstimate(doc, settings, "phone", false)};`,
      "  --rb-header-h: var(--rb-bar-h); }",
    ];
  }
  const rowSelector = "html:has(.rb-header[data-sections=row] > .rb-nav-row)";
  const hasRow = settings.sectionsPosition === "row";
  const both = twoRailsFrom(widths);
  // A band the header's widths leave empty is no band.
  const bands = (
    [
      { band: "tablet", min: widths.phone + 1, max: widths.rails - 1 },
      { band: "between", min: widths.rails, max: both - 1 },
      { band: "wide", min: both, max: undefined },
    ] as const
  ).filter(({ min, max }) => max === undefined || min <= max);
  // Neighbouring bands that hold the same bar are one range.
  const ranges: { min: number; max: number | undefined; bar: string; row: string }[] = [];
  for (const { band, min, max } of bands) {
    const bar = barEstimate(doc, settings, band, false);
    const row = barEstimate(doc, settings, band, true);
    const last = ranges.at(-1);
    if (last && last.bar === bar && last.row === row) last.max = max;
    else ranges.push({ min, max, bar, row });
  }
  return ranges.flatMap(({ min, max, bar, row }, i) => {
    const rowRule = hasRow ? [`${i === 0 ? "" : "  "}${rowSelector} { --rb-bar-h: ${row}; }`] : [];
    if (i === 0) {
      return [
        `html { --rb-bar-h: ${bar};`,
        "  --rb-header-h: var(--rb-bar-h); }",
        ...(hasRow ? fromAbove(widths, [`  ${rowRule[0]}`]) : []),
      ];
    }
    const media =
      max === undefined
        ? `@media (min-width: ${min}px)`
        : `@media (min-width: ${min}px) and (max-width: ${max}px)`;
    return [`${media} {`, `  html { --rb-bar-h: ${bar}; }`, ...rowRule, "}"];
  });
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
function collapseBar(header: string, progress: boolean): string[] {
  return [
    `  ${header} { --rb-header-h: 0px; padding: 0; margin-bottom: 0; border-bottom: 0; background: transparent; box-shadow: none; }`,
    `  ${header}[data-sticky] ~ main [data-section] { scroll-margin-top: 0; }`,
    `  ${header}[data-bg=transparent] + main > .rb-section:first-child { padding-top: var(--space-xl); }`,
    // No line under a bar of no height (ADR 0068): it would lie across the top of the page.
    ...(progress ? [`  ${header}::after { display: none; }`] : []),
  ];
}

/**
 * **The line of how much has been read** (ADR 0068, sprint 34 día 6; David's decision 5 and his
 * adjustment 3 approving the sprint): two pixels at the foot of a fixed bar, growing from the left as
 * the page is read — a `transform: scaleX()` driven by the root's scroll, so nothing is laid out and
 * nothing moves (no CLS), and no script: the published page's one script is the header's, and this
 * asks nothing of it.
 *
 * - **`scroll(root)`, written out**, never `scroll()`: the nearest scroller is the root today, and the
 *   day an ancestor of the bar had `overflow` the line would stand still with nothing turning red
 *   (David's adjustment 3; `engines.browser.test.ts` reads the computed value).
 * - **Only for somebody who has not asked for less movement**, and only where the browser has scroll
 *   timelines (`@supports`): elsewhere no line at all — the line is empty before its animation, so an
 *   engine that cannot drive it shows nothing rather than a full bar.
 * - **In the primary over `surface` and the transparent bar, in `surface` over the coloured ones**,
 *   as the indicator under the current entry is.
 * - **Inside the bar, never under it** (David's condition c): absolute at its foot, so the phone's bar
 *   keeps its 72 px. **Decorative**: a pseudo-element with no text is in no accessibility tree — no
 *   landmark, no `progressbar` with a value.
 * - **Not where the fixed bar lets go** — over the sections' row on a phone, the bar is in the flow and
 *   a line of how far it has scrolled would be drawn under something that scrolled away — **nor where
 *   the bar collapses to nothing** (`collapseBar`).
 * - **For the published page only** (`target`): the canvas carries no `animation-timeline`, the lesson
 *   of sprint 32 día 1 on functions that break the canvas by their mere presence, and the canvas is
 *   still anyway (ADR 0051 §3). The panel says the canvas does not show it.
 */
function progressCss(
  settings: HeaderSettings,
  widths: HeaderWidths,
  target: "html" | "dom",
): string[] {
  if (target !== "html" || !settings.progress) return [];
  return [
    "@media (prefers-reduced-motion: no-preference) {",
    "  @supports (animation-timeline: scroll(root)) {",
    '    .rb-header[data-sticky][data-progress]::after { content: ""; position: absolute; left: 0; right: 0;',
    "      bottom: 0; height: 2px; background: var(--color-primary); transform: scaleX(0);",
    "      transform-origin: left; pointer-events: none; animation: rb-progress auto linear both;",
    "      animation-timeline: scroll(root); }",
    "    .rb-header[data-progress]:is([data-bg=primary], [data-bg=secondary], [data-bg=ink])::after {",
    "      background: var(--color-surface); }",
    "    @keyframes rb-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }",
    // The phone's block, nested: its own `@media` and brace indented to sit inside this one.
    ...toPhone(widths, [
      "      .rb-header[data-progress][data-phone-row]::after { display: none; }",
    ]).map((line) => (line.startsWith("@media") || line === "}" ? `    ${line}` : line)),
    "  }",
    "}",
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
function railCss(doc: RetorikaDocument, widths: HeaderWidths): string[] {
  const settings = headerSettings(doc);
  // No rail travels where none ever stands (ADR 0067): a bar that is the phone's at every width.
  if (!usesRail(settings) || widths.rails === "none") return [];
  const twoFrom = twoRailsFrom(widths);
  const wide = `@media (min-width: ${widths.rails}px)`;
  const betweenBand = widths.rails <= twoFrom - 1;
  const between = `@media (min-width: ${widths.rails}px) and (max-width: ${twoFrom - 1}px)`;
  const both = `@media (min-width: ${twoFrom}px)`;
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
    "  .rb-header[data-pages=left] > .rb-nav[data-part=pagesLinks],",
    "  .rb-header[data-pages=right] > .rb-nav[data-part=pagesLinks],",
    "  .rb-header[data-sections=left] .rb-nav-wide > [data-part=sectionsLinks],",
    "  .rb-header[data-sections=right] .rb-nav-wide > [data-part=sectionsLinks],",
    "  .rb-header[data-brand=pages] > .rb-brand, .rb-header[data-brand=pages] > .rb-nav-action {",
    "    display: none; }",
    // With the pages' copy hidden, the sections are the first thing in the strip: `+` still
    // matches a hidden sibling, and the rule that tells the two menus apart drew a line beside
    // nothing (seen in Chromium at 1100 px on sprint 31 día 2, before this line).
    "  .rb-header[data-pages=left] .rb-nav-wide > .rb-nav + .rb-nav,",
    "  .rb-header[data-pages=right] .rb-nav-wide > .rb-nav + .rb-nav { padding-left: 0; border-left: 0; }",
    `  .rb-header[data-rails~=left], .rb-header[data-rails~=left] ~ main { margin-left: ${RAIL_WIDTH}px;`,
    `    --rb-rail-l: ${RAIL_WIDTH}px; }`,
    `  .rb-header[data-rails~=right], .rb-header[data-rails~=right] ~ main { margin-right: ${RAIL_WIDTH}px;`,
    `    --rb-rail-r: ${RAIL_WIDTH}px; }`,
    ...collapseBar(
      '.rb-header[data-layout][data-bar=none]:not([data-rails="left right"])',
      settings.progress,
    ),
    "}",
    // Two rails, too narrow for both: the sections' rail falls into the bar, and its side's margin
    // with it.
    ...(betweenBand ? [`${between} {`] : []),
    ...(betweenBand
      ? [
          '  .rb-header[data-rails="left right"][data-sections=left] > .rb-rail[data-side=left],',
          '  .rb-header[data-rails="left right"][data-sections=right] > .rb-rail[data-side=right] {',
          "    display: none; }",
          '  .rb-header[data-rails="left right"] .rb-nav-wide > [data-part=sectionsLinks] { display: flex; }',
          '  .rb-header[data-rails="left right"][data-sections=left],',
          '  .rb-header[data-rails="left right"][data-sections=left] ~ main { margin-left: 0; --rb-rail-l: 0px; }',
          '  .rb-header[data-rails="left right"][data-sections=right],',
          '  .rb-header[data-rails="left right"][data-sections=right] ~ main { margin-right: 0; --rb-rail-r: 0px; }',
          "}",
        ]
      : []),
    `${both} {`,
    ...collapseBar(
      '.rb-header[data-layout][data-bar=none][data-rails="left right"]',
      settings.progress,
    ),
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
function foldCss(doc: RetorikaDocument, widths: HeaderWidths): string[] {
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
    // The chevron, on a wide screen only: in the phone's bar every pixel is the brand's (below).
    ".rb-chevron { display: none; }",
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
    "  .rb-chevron { transition: transform var(--rb-fast) var(--rb-ease); }",
    "}",
    ...fromAbove(widths, [
      `  ${placed} { display: block; position: fixed; z-index: 2;`,
      "    top: calc(var(--rb-header-h) + var(--space-md)); right: var(--space-md); }",
      `  ${placed} > summary { padding: var(--space-sm) var(--space-lg); background: var(--color-surface);`,
      `    border: ${HAIRLINE}; border-radius: 999px;`,
      "    box-shadow: 0 8px 24px -16px var(--color-ink); }",
      `  ${placed} > summary { display: inline-flex; align-items: center; gap: var(--space-sm); }`,
      "  .rb-chevron { display: inline-block; width: 6px; height: 6px; margin-top: -3px;",
      "    border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(45deg); }",
      "  .rb-nav-fold[open] .rb-chevron { margin-top: 3px; transform: rotate(-135deg); }",
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
      ...collapseBar(".rb-header[data-layout][data-bar=none]:not([data-rails])", settings.progress),
    ]),
    ...(usesRail(settings) && widths.rails !== "none"
      ? [
          `@media (min-width: ${widths.rails}px) {`,
          `  .rb-header[data-sections=fold][data-rails=right] .rb-nav-fold { right: auto; left: var(--space-md); }`,
          `  .rb-header[data-sections=fold][data-rails=right] .rb-nav-fold > .rb-nav { right: auto; left: 0; }`,
          "}",
        ]
      : []),
    ...toPhone(widths, [
      // The bar's words are close-set on every phone since sprint 33 día 6 (`headerMobileCss`); they
      // closed up first here, when «Ir a…» joined them — measured at 320 px with «Taberna Santo
      // Domingo», its logo, «Contacto», «Ir a…» and «Menú»: at 16 px between them the brand had 21 px
      // left and its 40 px logo ran 3 px over the button; at 8 px it has 45.
      "  .rb-header[data-sections] .rb-nav-fold[data-mobile=fold] { display: block; }",
      "  .rb-nav-fold[data-mobile=fold] { margin-left: auto; }",
      // A hidden sibling still matches `+` (sprint 31 día 2), so the rule names the one that is drawn.
      "  .rb-nav-action + .rb-nav-fold[data-mobile=fold],",
      "  .rb-nav-fold[data-mobile=fold] + .rb-nav-narrow { margin-left: 0; }",
      // With «Ir a…» beside it, «Menú» keeps its word and loses its bars: the 26 px they take are the
      // brand's logo at 320 (measured on sprint 31 día 3 with 45 px left for a 40 px logo).
      "  .rb-header:has(> .rb-nav-fold[data-mobile=fold]) .rb-burger { display: none; }",
      ...phoneSheet(".rb-nav-fold[data-mobile=fold]"),
    ]),
  ];
}

/**
 * **A disclosure on a phone is a sheet** (sprint 32 día 4): its panel fills the screen under the bar,
 * its entries are set large in the heading letter, the current one is marked by its edge and a tint as
 * in a rail, and they come in one after another when it opens. And **what the sheet covers stops
 * existing** while it is open (David's adjustment 4): `visibility: hidden` on `<main>` takes the page
 * out of the order of Tab and out of the accessibility tree, so the keyboard cannot wander behind the
 * sheet to a link nobody can see, and the page no longer shows scrolling behind it. `:has` is
 * Baseline since 2023; where it is missing the page simply stays visible behind, as before. The
 * footer is a section inside `<main>`, so `<main>` is all of it.
 *
 * **And the page holds still under it** (sprint 33 día 1, ADR 0065): `overflow: hidden` on the root
 * while it is open, which is the viewport's. Measured before, in Chromium and WebKit at 390 × 844: a
 * sheet whose entries fit does not scroll, so a wheel of 2000 px over it carried the page 2000 px —
 * and with a bar in the flow the sheet with it, leaving a blank page as long as the content, `<main>`
 * hidden. Only the visitor's scroll is held: a script's, and «Ir a…»'s anchors, still move the page.
 * The sheet itself still scrolls inside when its entries outgrow it. No script, no fifth write.
 *
 * For «Menú» (`headerMobileCss`) and for «Ir a…» on a phone (`foldCss`): two callers of one shape,
 * written once so that the two sheets cannot drift apart. Rules to be placed inside the phone's
 * `@media`; the stagger nests its own motion query inside it.
 */
function phoneSheet(disclosure: string): string[] {
  const panel = `${disclosure} > .rb-nav`;
  return [
    // **Its height is a share of the bar it hangs from** (sprint 33 día 3, the menu audit's findings 3
    // and 5): an absolute box's `top: 100%` and its `height`'s `100%` are both of its containing
    // block, the header's padding box, so the sheet ends at the header's top plus the screen — the
    // screen's foot, where the bar stands when anyone can press «Menú» — whatever the bar measures.
    // It was `100dvh - var(--rb-header-h)`, and that variable is never quite the bar: the script's
    // measure is rounded and counts the hairline the sheet starts above (1.2–1.4 px short), and where
    // no script runs — the canvas — it is the estimate of one line, 26–67 px short of a bar on two
    // lines or with the row under it, the last entries below the screen and out of reach.
    `  ${panel} { box-sizing: border-box; height: calc(100dvh - 100%);`,
    "    overflow: hidden auto; gap: var(--space-md); padding: var(--space-xl) var(--space-lg);",
    "    border-bottom: 0; }",
    `  ${panel} a { font-family: var(--font-heading); font-size: var(--size-subheading);`,
    "    padding: var(--space-xs) var(--space-sm); margin-left: calc(-1 * var(--space-sm));",
    "    border-radius: 0 var(--radius-sm) var(--radius-sm) 0; box-shadow: inset 3px 0 0 transparent; }",
    `  ${panel} a[aria-current] { text-decoration-color: transparent;`,
    "    box-shadow: inset 3px 0 0 currentColor;",
    "    background: color-mix(in srgb, currentColor 12%, transparent); }",
    `  body:has(${disclosure}[open]) main { visibility: hidden; }`,
    `  html:has(${disclosure}[open]) { overflow: hidden; }`,
    // One after another: 40 ms apart, capped at the seventh as the editor's own reveal is, the delay
    // riding a custom property so the shorthand does not reset it (sprint 32 día 2's lesson).
    "  @media (prefers-reduced-motion: no-preference) {",
    `    ${disclosure}[open] > .rb-nav > a { animation: rb-rise var(--rb-base) var(--rb-ease) backwards;`,
    "      animation-delay: calc(var(--rb-i, 0) * 40ms); }",
    ...[2, 3, 4, 5, 6].map(
      (n) => `    ${disclosure}[open] > .rb-nav > a:nth-child(${n}) { --rb-i: ${n - 1}; }`,
    ),
    `    ${disclosure}[open] > .rb-nav > a:nth-child(n + 7) { --rb-i: 6; }`,
    "  }",
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
  const settings = headerSettings(doc);
  return [
    ".rb-nav-narrow { display: none; }",
    ...toPhone(headerWidths(doc), [
      // The phone's estimate (`barEstimate`): one line, and the row under it on a page that draws one.
      `  html { --rb-bar-h: ${barEstimate(doc, settings, "phone", false)}; }`,
      ...(headerPhoneRow(doc, settings)
        ? [
            "  html:has(.rb-header > .rb-nav-row[data-mobile=row]) {",
            `    --rb-bar-h: ${barEstimate(doc, settings, "phone", true)}; }`,
          ]
        : []),
      // **The page keeps its width when a sheet locks it** (ADR 0065, David's condition): in a narrow
      // window with a scrollbar drawn, `overflow: hidden` takes the scrollbar away and the content
      // widened by its 15 px the moment a sheet opened. On a phone the scrollbar overlays and this is
      // nothing. Once, here, for both sheets: «Ir a…»'s block only exists where a header is drawn.
      "  html { scrollbar-gutter: stable; }",
      // **The phone's bar is close-set** (sprint 33 día 6, David's decision on the audit's finding 2):
      // `space.sm` between its words, where it was `space.md`, and the button's sides at `space.md`,
      // where they were `space.lg`. Measured at 320 with the teaser: «Dónde estamos» sent «Menú» to a
      // second line (the bar 82 px, over its 72); close-set, it holds the line. A longer button is said
      // in the editor's «Menú» panel and in the download review, past `PHONE_BUTTON_MAX` letters.
      "  .rb-header { gap: var(--space-sm); padding: var(--space-sm) var(--space-lg); }",
      "  .rb-nav-action { padding-inline: var(--space-md); }",
      // The brand takes what the button and «Menú» leave and no more: a flex basis of zero means it
      // never asks the line to wrap, and `min-width: 0` (set above) lets the ellipsis do its work.
      // Measured at 320px with «Taberna Santo Domingo» and a logo: one line, 56px, where a brand at
      // its natural width wrapped the bar onto two lines and 107px.
      "  .rb-brand { flex: 1 1 0; }",
      "  .rb-nav-wide { display: none; }",
      // The pages' menu standing bare before the brand (ADR 0070's «en medio») is the strip's copy
      // on a phone and hidden with it; the brand is first again, which is «center» deriving to
      // «start» here — between a button and «Menú» at 320 a centred brand is off-centre by their
      // widths and reads as a mistake.
      "  .rb-header > .rb-nav[data-part=pagesLinks] { display: none; }",
      // **The brand's size and place on a phone** (ADR 0069, 0070; rule 7): the large logo at what
      // the bar can give it under 72 px, and shown whole rather than deforming the line — a 4 : 1
      // mark at 55 px is 220 px beside a button, «Ir a…» and «Menú»; the heading-sized name at the
      // subheading's; the brand at the end with «Menú» first.
      `  .rb-header[data-logo-size=lg] .rb-logo { height: ${logoHeightCss("lg", true)};`,
      "    max-width: 100%; object-fit: contain; object-position: left; }",
      "  .rb-header[data-name-size=heading] .rb-brand { font-size: var(--size-subheading); }",
      "  .rb-header[data-brand-place=end] > .rb-brand { order: 2; justify-content: flex-end; }",
      "  .rb-header[data-brand-place=end] > .rb-nav-narrow { margin-left: 0; }",
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
      // **It lets go into the flow, not out of every box** (sprint 33 día 3, the menu audit's findings 1
      // and 4): `relative`, a bar in the flow's own position. It was `static`, which took from the
      // sheet the box its `top: 100%` and its height are shares of: «Menú» opened at the screen's foot,
      // below it, over a page `<main>` hid. A transparent bar lets go as a transparent one does, over
      // the cover and away with it; `html` and `[data-layout]` weigh it over the script's `fixed`
      // (0,4,1), which kept it fixed over the row.
      "  .rb-header[data-sticky][data-phone-row] { position: relative; }",
      "  html .rb-header[data-layout][data-sticky][data-phone-row][data-bg=transparent] { position: absolute; }",
      "  .rb-header[data-sticky][data-phone-row] ~ main [data-section] { scroll-margin-top: 0; }",
      ...phoneSheet(".rb-nav-narrow"),
    ]),
    "",
  ];
}
