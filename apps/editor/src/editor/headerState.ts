import { COVER_ID, FOOTER_ID, TEASER_ID } from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import {
  actionEntry,
  BAR_MEASURE,
  GLASS_BACKGROUNDS,
  headerDrawn,
  headerPhoneRow,
  headerPlaces,
  headerSettings,
  headerWidths,
  homeMenuLabel,
  logoDrawnPx,
  MENU_MIN_ENTRIES,
  pageLabel,
  pageMenuEntries,
  RAIL_FOLD_WIDTH,
  sectionLabel,
  sectionMenuEntries,
  TWO_RAILS_FOLD_WIDTH,
} from "@retorika/renderer";
import type {
  BrandNameSize,
  Header,
  HeaderAction,
  HeaderBackground,
  HeaderLayout,
  HeaderLogo,
  HeaderPart,
  LogoSize,
  Page,
  PagesPosition,
  RetorikaDocument,
  SectionsOnMobile,
  SectionsPosition,
  StyleProperty,
} from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };
import { DESKTOP_LAYOUT_WIDTH, PHONE_BREAKPOINT } from "./overflowCheck.ts";
import { headerBarBackground } from "./styleReview.ts";

/**
 * What the site's header holds, read for the «Menú» panel (ADR 0057, sprint 30 días 3–4).
 *
 * **Every answer is the renderer's**, as `menuState.ts` asks it for the same reason: the panel must
 * not describe a header the published page does not have. Which menus are drawn, what their entries
 * are called, which destination is the button, whether a fixed bar lets go on a phone —
 * `headerSettings`, `pageMenuEntries`, `sectionMenuEntries`, `actionEntry` and `headerPhoneRow`
 * decide; this only puts their answers in one object, with the sentences the panel owes beside them.
 *
 * What it adds of its own is classification, never a rule: *why* a section lends no entry is read
 * off its kind only after the renderer has said that it lends none.
 */

/** A menu's switch: the owner's `shown` absent («Automático»), `true` or `false`. */
export type MenuMode = "auto" | "always" | "never";

export interface MenuBlock {
  mode: MenuMode;
  /** Entries a visitor reads in it on the page being edited — «Inicio» and the button's
   * destination not among them. */
  count: number;
  /** Whether it is drawn on the page being edited. */
  drawn: boolean;
}

/** One page, as the pages menu sees it. */
export interface PageRow {
  pageId: string;
  title: string;
  /** What an empty «Se lee como…» reads: the page's title, or «Inicio» for the first page. */
  derived: string;
  /** The owner's own word, if any. */
  own: string | undefined;
  /** The switch's state, or `null` for a page that has no switch — and then `reason` says why. */
  inMenu: boolean | null;
  reason: "home" | "perEntry" | undefined;
  /** It is the button's destination, so the menu leaves it out while the button stands. */
  inButton: boolean;
}

/** One section of the page being edited, as the sections menu sees it. */
export interface SectionRow {
  sectionId: string;
  /** The catalog's name for its kind, which is how «Secciones» lists it too. */
  name: string;
  /** The short name an empty «Se lee como…» reads, or `undefined` when it lends no entry. */
  derived: string | undefined;
  own: string | undefined;
  inMenu: boolean | null;
  /** Why it lends no entry: it is the cover, it opens a page that is not home (its `<h1>`), it is
   * the footer, or it is an avance. */
  reason: "cover" | "opens" | "footer" | "teaser" | undefined;
  inButton: boolean;
}

/** One destination the button can take. */
export interface ActionChoice {
  key: string;
  action: HeaderAction;
  label: string;
  /** A page or a section — drawn under their own captions, because an entry's words do not say
   * which it is: «Carta» is a page on one site and a section on the next. */
  kind: HeaderAction["kind"];
  /** The page it is on, for a section of another page — the button chosen elsewhere. */
  where: string | undefined;
}

/**
 * **The brand's size and place as the renderer reads them** (ADR 0069 and 0070, sprint 35 día 5):
 * every absence filled by the renderer's own default (`headerSettings`), and the logo's height in
 * the pixels the stylesheet draws it at (`logoDrawnPx`), so the panel's sentence is the page's.
 */
export interface BrandState {
  /** A name or a logo is drawn — the place is offered only then. */
  shown: boolean;
  logoSize: LogoSize;
  nameSize: BrandNameSize;
  place: "start" | "center" | "end";
  /** The logo's drawn height, on a wide screen and on a phone (ADR 0069 §3). */
  logoPx: number;
  logoPhonePx: number;
  /** The logo is wider than tall, by its stored size: a large one may be drawn smaller on a phone,
   * whole, rather than deform the line (ADR 0069 §3). `false` for a logo kept without its size. */
  logoWide: boolean;
  /** From the pages' column width up, the brand goes into the column with the pages, and its place
   * here is the bar's of the narrower screens (ADR 0070, «What is preserved»). */
  inRail: boolean;
}

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
  /** The logo's file name, when the header shows one (ADR 0059). */
  logoSrc: string | undefined;
  brand: BrandState;
  /** The colour the bar is painted, for the swatch the logo is shown on in the panel. */
  barBackground: string;
  /** The title of the page being edited, for the sentence that says whose sections these are. */
  pageTitle: string;
  pagesMenu: MenuBlock;
  sectionsMenu: MenuBlock;
  pageRows: PageRow[];
  sectionRows: SectionRow[];
  actionChoices: ActionChoice[];
  /** The key of the chosen destination among `actionChoices`, or `null` for «Ninguno». */
  actionKey: string | null;
  /** Whether the button's destination would otherwise be an entry of a menu that is shown — which
   * is what makes «sale del menú» true rather than merely plausible. */
  actionLeavesMenu: boolean;
  layout: HeaderLayout;
  sticky: boolean;
  /** «Muestra cuánto se ha leído» (ADR 0068): the line at the foot of a fixed bar. */
  progress: boolean;
  hairline: boolean;
  sectionsMobile: SectionsOnMobile;
  /** A fixed bar lets go on a phone, because the sections' row is under it there (día 2). */
  phoneRow: boolean;
  /** The bar lies transparent over the cover (ADR 0057 §look; chosen on día 6). */
  transparent: boolean;
  /**
   * **What a fixed bar turns into once the page has scrolled** (ADR 0063, sprint 32 día 5): glass on
   * the schemes the renderer makes glass of (`GLASS_BACKGROUNDS`, `transparent` being a surface bar
   * once scrolled) when no exact colour of the owner's paints the bar; otherwise a solid bar with a
   * shadow — the coloured schemes, and an owner's exact colour, which the renderer keeps opaque.
   * Read from the renderer's own list so the panel's sentence cannot promise a glass the page does
   * not draw.
   */
  scrolledLook: "glass" | "solid";
  /** Where the sections menu sits (ADR 0060, sprint 31), chosen in the panel's «Dónde va». */
  sectionsPosition: SectionsPosition;
  /** Where the pages menu sits, and whether the brand and the button go with it into a rail. */
  pagesPosition: PagesPosition;
  brandWithPages: boolean;
  /** «La marca y el botón van con el menú de páginas» is offered (David's condition on planning
   * sprint 31): only where it does something — the pages menu drawn on this page and standing in a
   * column, and a brand or a button to send there. In the bar the renderer ignores it, and a box that
   * changes nothing when ticked is the panel promising what the page does not do. */
  brandWithPagesOffered: boolean;
  /** The columns this page draws, and whether the bar has nothing left on a wide screen — the
   * renderer's own answer (`headerPlaces`). */
  rails: ("left" | "right")[];
  barEmpty: boolean;
  /** The window width under which each menu's column folds into the bar: the pages' from 1024, the
   * sections' from 1248 when the pages stand in the other column (ADR 0060 §3). */
  pagesFoldWidth: number;
  sectionsFoldWidth: number;
  /** The widest canvas the header's phone layout reaches (sprint 34 día 1): the renderer's
   * `headerWidths`, which writes the `@media` it is read from. */
  phoneWidth: number | "always";
  /** What the panel says when the bar folds past the phone (sprint 34 día 4), or `undefined`. */
  fold: FoldWarning | undefined;
  /** The look as the renderer reads it, every gap filled by its default (día 6). */
  look: HeaderLook;
  /** The parts this page draws, in `HEADER_PARTS` order — the ones the exact controls are offered
   * for, since a colour on a part nobody sees is a decision about nothing. */
  parts: HeaderPart[];
}

type LookKeys = NonNullable<Header["look"]>;
export type HeaderLook = { [K in keyof LookKeys]-?: Exclude<LookKeys[K], undefined> };

function modeOf(shown: boolean | undefined): MenuMode {
  if (shown === undefined) return "auto";
  return shown ? "always" : "never";
}

const actionKeyOf = (action: HeaderAction): string =>
  action.kind === "page" ? `page:${action.pageId}` : `section:${action.sectionId}`;

/** The page with every section in the menu, so the renderer answers which ones *could* be: a
 * section the owner took out still needs its switch, which is the only way to put it back — the
 * same question `menuLabelFor` asks for «Campos». */
function allIn(page: Page): Page {
  return { ...page, sections: page.sections.map((section) => ({ ...section, inMenu: true })) };
}

function sectionName(catalogId: string, fallback: string): string {
  const key = `section.${catalogId}.name` as keyof typeof catalogEs;
  return catalogEs[key] ?? fallback;
}

export function headerStateFor(doc: RetorikaDocument, pageId: string | undefined): HeaderState {
  const page = doc.pages.find((candidate) => candidate.id === pageId) ?? doc.pages[0];
  const home = doc.pages[0];
  if (!page || !home) throw new Error("headerStateFor: the document has no pages");
  const settings = headerSettings(doc);
  const action = actionEntry(doc, page);
  // The menus as drawn: the button's destination leaves the menu it would sit in (ADR 0057 §5).
  const pageEntries = pageMenuEntries(doc);
  const sectionEntries = sectionMenuEntries(page);
  const pages = pageEntries
    .filter((entry) => entry.pageId !== action?.pageId)
    .map((entry) => entry.label);
  const sections = sectionEntries
    .filter((entry) => entry.sectionId !== action?.sectionId)
    .map((entry) => entry.label);
  const pagesDrawn = settings.pagesShown && pages.length > 0;
  const sectionsDrawn = settings.sectionsShown && sections.length > 0;

  const chosen = doc.header?.action;
  const eligible = new Set(sectionMenuEntries(allIn(page)).map((entry) => entry.sectionId));

  const pageRows: PageRow[] = doc.pages.map((candidate, index) => {
    const isHome = index === 0;
    const perEntry = !isHome && candidate.binding !== undefined;
    return {
      pageId: candidate.id,
      title: candidate.title,
      derived: isHome ? homeMenuLabel({}) : candidate.title,
      own: candidate.menuLabel,
      inMenu: isHome || perEntry ? null : candidate.inMenu !== false,
      reason: isHome ? "home" : perEntry ? "perEntry" : undefined,
      inButton: chosen?.kind === "page" && chosen.pageId === candidate.id,
    };
  });

  const sectionRows: SectionRow[] = page.sections.map((section) => {
    const lends = eligible.has(section.id);
    const catalogId = section.preset.catalogId;
    return {
      sectionId: section.id,
      name: sectionName(catalogId, section.id),
      derived: lends ? sectionLabel({ preset: section.preset }) : undefined,
      own: section.menuLabel,
      inMenu: lends ? section.inMenu !== false : null,
      reason: lends
        ? undefined
        : catalogId === COVER_ID
          ? "cover"
          : catalogId === FOOTER_ID
            ? "footer"
            : catalogId === TEASER_ID
              ? "teaser"
              : "opens",
      inButton: chosen?.kind === "section" && chosen.sectionId === section.id,
    };
  });

  const actionChoices: ActionChoice[] = [
    ...doc.pages
      .slice(1)
      .filter((candidate) => candidate.binding === undefined)
      .map((candidate) => ({
        key: `page:${candidate.id}`,
        action: { kind: "page", pageId: candidate.id } as const,
        label: pageLabel(candidate),
        kind: "page" as const,
        where: undefined,
      })),
    ...page.sections
      .filter((section) => eligible.has(section.id))
      .map((section) => ({
        key: `section:${section.id}`,
        action: { kind: "section", sectionId: section.id } as const,
        label: sectionLabel(section),
        kind: "section" as const,
        where: undefined,
      })),
  ];
  // A button chosen on another page is still the button here: listed, with the page it is on, so
  // the group shows what is chosen rather than a «Ninguno» that is not true.
  if (chosen && !actionChoices.some((choice) => choice.key === actionKeyOf(chosen))) {
    for (const other of doc.pages) {
      const section =
        chosen.kind === "section"
          ? other.sections.find((candidate) => candidate.id === chosen.sectionId)
          : undefined;
      if (!section) continue;
      actionChoices.push({
        key: actionKeyOf(chosen),
        action: chosen,
        label: sectionLabel(section),
        kind: "section",
        where: other.title,
      });
    }
  }

  const places = headerPlaces(doc, page);
  const widths = headerWidths(doc);

  const actionLeavesMenu =
    chosen?.kind === "page"
      ? settings.pagesShown && pageEntries.some((entry) => entry.pageId === chosen.pageId)
      : chosen?.kind === "section"
        ? settings.sectionsShown &&
          doc.pages.some((other) =>
            sectionMenuEntries(other).some((entry) => entry.sectionId === chosen.sectionId),
          )
        : false;

  return {
    drawn: headerDrawn(doc),
    pages: pagesDrawn ? pages : null,
    sections: sectionsDrawn ? sections : null,
    action: action?.label ?? null,
    brandName: settings.brandName,
    logoSrc: settings.logo?.src,
    brand: {
      shown: settings.brandName || settings.logo !== undefined,
      logoSize: settings.logoSize,
      nameSize: settings.nameSize,
      place: settings.brandPlace,
      logoPx: logoDrawnPx(settings.logoSize, false, doc.theme),
      logoPhonePx: logoDrawnPx(settings.logoSize, true, doc.theme),
      logoWide:
        settings.logo?.width !== undefined &&
        settings.logo.height !== undefined &&
        settings.logo.width > settings.logo.height,
      inRail:
        settings.brandWithPages &&
        pagesDrawn &&
        settings.pagesPosition !== "bar" &&
        (settings.brandName || settings.logo !== undefined),
    },
    barBackground: headerBarBackground(doc),
    pageTitle: page.title,
    pagesMenu: { mode: modeOf(doc.header?.pages?.shown), count: pages.length, drawn: pagesDrawn },
    sectionsMenu: {
      mode: modeOf(doc.header?.sections?.shown),
      count: sections.length,
      drawn: sectionsDrawn,
    },
    pageRows,
    sectionRows,
    actionChoices,
    actionKey: chosen ? actionKeyOf(chosen) : null,
    actionLeavesMenu,
    layout: settings.layout,
    sticky: settings.sticky,
    progress: settings.progress,
    hairline: settings.hairline,
    sectionsMobile: settings.sectionsMobile,
    phoneRow: headerPhoneRow(doc, settings),
    transparent: settings.background === "transparent",
    scrolledLook:
      headerExact(doc, "bar", "color") === undefined &&
      Object.hasOwn(
        GLASS_BACKGROUNDS,
        settings.background === "transparent" ? "surface" : settings.background,
      )
        ? "glass"
        : "solid",
    sectionsPosition: settings.sectionsPosition,
    pagesPosition: settings.pagesPosition,
    brandWithPages: settings.brandWithPages,
    brandWithPagesOffered:
      pagesDrawn &&
      settings.pagesPosition !== "bar" &&
      (settings.brandName || settings.logo !== undefined || action !== undefined),
    rails: places.rails,
    barEmpty: places.barEmpty,
    pagesFoldWidth: widths.rails === "none" ? Number.POSITIVE_INFINITY : widths.rails,
    sectionsFoldWidth:
      widths.rails === "none"
        ? Number.POSITIVE_INFINITY
        : places.rails.length === 2
          ? Math.max(TWO_RAILS_FOLD_WIDTH, widths.rails)
          : widths.rails,
    phoneWidth: widths.phone,
    fold: foldWarning(doc),
    look: {
      background: settings.background,
      align: settings.align,
      gap: settings.gap,
      uppercase: settings.uppercase,
      hoverUnderline: settings.hoverUnderline,
      size: settings.size,
    },
    parts: [
      "bar",
      ...(settings.brandName || settings.logo !== undefined ? (["brand"] as const) : []),
      ...(pagesDrawn ? (["pagesLinks"] as const) : []),
      ...(sectionsDrawn ? (["sectionsLinks"] as const) : []),
      ...(action ? (["action"] as const) : []),
    ],
  };
}

/**
 * **The longest button the phone's bar holds**, in characters (sprint 33 día 6, David's decision on
 * the menu audit's finding 2). At 320 px the bar has the brand, the button and «Menú» on one line,
 * and a button of thirteen letters left the brand nothing or sent «Menú» to a second line; the bar
 * was tightened that day, and the line past which the owner is told is this one.
 */
export const PHONE_BUTTON_MAX = 12;

/**
 * The button's words when they are more than the phone's bar holds, or `undefined`. Read by the
 * «Menú» panel, under the destination's «Se lee como…», and by the download review, as a warning
 * and never a block (the site is not broken: «Menú» is on a second line). Counted in characters as
 * the owner types them, the way `menuLabelIssue` counts.
 */
export function phoneButtonTooLong(doc: RetorikaDocument): string | undefined {
  const first = doc.pages[0];
  const label = first === undefined ? undefined : actionEntry(doc, first)?.label;
  return label !== undefined && label.length > PHONE_BUTTON_MAX ? label : undefined;
}

/**
 * The sentence under a menu's switch: what that switch is doing to this page right now.
 *
 * **«Automático» says the number it is drawn with, or that it is not drawn yet and why** — the
 * threshold read off the renderer, as `menuNoteText` reads it. «Siempre» with nothing to show says
 * so: the renderer emits no empty landmark whatever the owner chose (ADR 0057), and a «Siempre»
 * beside a strip that is not there would be the interface promising what the page does not do.
 * Singular keys of their own, for the reason `sectionsLeftText` gives.
 */
export function menuStatusText(block: MenuBlock, menu: "pages" | "sections"): string {
  if (block.mode === "never") return es["editor.menuPanel.statusNever"];
  if (block.count === 0) {
    return menu === "pages"
      ? es["editor.menuPanel.statusEmptyPages"]
      : es["editor.menuPanel.statusEmptySections"];
  }
  const n = String(block.count);
  if (block.mode === "always") {
    return block.count === 1
      ? es["editor.menuPanel.statusAlwaysOne"]
      : es["editor.menuPanel.statusAlways"].replace("{n}", n);
  }
  if (!block.drawn) {
    return es["editor.menuPanel.statusAutoNotYet"].replace("{min}", String(MENU_MIN_ENTRIES));
  }
  return block.count === 1
    ? es["editor.menuPanel.statusAutoOne"]
    : es["editor.menuPanel.statusAuto"].replace("{n}", n);
}

/**
 * The header with one menu's switch set — `shown` written for «Siempre» and «Nunca», taken away for
 * «Automático», and the menu's object dropped when nothing is left in it, so «Automático» chosen
 * again reads exactly like a document nobody touched rather than one holding `pages: {}`.
 */
export function menuModePatch(
  doc: RetorikaDocument,
  menu: "pages" | "sections",
  mode: MenuMode,
): Partial<Header> {
  const { shown: _, ...rest } = doc.header?.[menu] ?? {};
  const next = mode === "auto" ? rest : { ...rest, shown: mode === "always" };
  return { [menu]: Object.keys(next).length === 0 ? undefined : next };
}

/** A brand with nothing left in it drops its key, so a header nobody decided reads as none. */
function brandOrNothing(next: NonNullable<Header["brand"]>): Partial<Header> {
  return { brand: Object.keys(next).length === 0 ? undefined : next };
}

/**
 * The header with the brand's name switched, keeping the logo: `name` is written only when on —
 * **and off takes the name's size with it, in the same patch** (ADR 0069 §2): the schema refuses a
 * size for a name nobody sees, and one patch is one step of history, so «Deshacer» brings both back.
 */
export function brandNamePatch(doc: RetorikaDocument, name: boolean): Partial<Header> {
  const { name: _, nameSize, ...rest } = doc.header?.brand ?? {};
  return brandOrNothing(name ? { ...rest, name: true, ...(nameSize ? { nameSize } : {}) } : rest);
}

/**
 * The brand with a new logo, **keeping its size** (ADR 0069): the size lives on the brand and not on
 * the logo, because a new file replaces the whole `logo` object, and an owner who chose «Grande»
 * and changes the file has not changed their mind about the size.
 */
export function logoPatch(doc: RetorikaDocument, logo: HeaderLogo): Partial<Header> {
  return { brand: { ...(doc.header?.brand ?? {}), logo } };
}

/** «Quitar»: the logo goes, **and its size with it** (ADR 0069 §2) — the state nobody can see is a
 * state nobody can save. The name and its size stay. */
export function logoRemovedPatch(doc: RetorikaDocument): Partial<Header> {
  const { logo: _, logoSize: _size, ...rest } = doc.header?.brand ?? {};
  return brandOrNothing(rest);
}

/** The logo's size chosen; «Normal», the size every logo drew before the word, drops the key. */
export function logoSizePatch(doc: RetorikaDocument, size: LogoSize): Partial<Header> {
  const { logoSize: _, ...rest } = doc.header?.brand ?? {};
  return brandOrNothing(size === "md" ? rest : { ...rest, logoSize: size });
}

/** The name's size chosen; «Normal», the reading size, drops the key. */
export function nameSizePatch(doc: RetorikaDocument, size: BrandNameSize): Partial<Header> {
  const { nameSize: _, ...rest } = doc.header?.brand ?? {};
  return brandOrNothing(size === "body" ? rest : { ...rest, nameSize: size });
}

/**
 * The brand's place chosen (ADR 0070). **Written even when it is the layout's own place**, as a
 * chosen alignment is (`lookPatch`): absent means «the layout's», which is the start on one line and
 * the centre when stacked — so «Al principio» pressed on a one-line bar and left absent would move
 * to the centre the day the owner stacks the bar, the panel undoing a choice.
 */
export function brandPlacePatch(
  doc: RetorikaDocument,
  place: "start" | "center" | "end",
): Partial<Header> {
  return { brand: { ...(doc.header?.brand ?? {}), place } };
}

/** The header with the sections' place on a phone chosen — the row, nothing, or «Ir a…» beside
 * «Menú» — keeping the rest of `sections`. */
export function sectionsMobilePatch(
  doc: RetorikaDocument,
  mobile: SectionsOnMobile,
): Partial<Header> {
  return { sections: { ...(doc.header?.sections ?? {}), mobile } };
}

/**
 * The header with a menu's place chosen, keeping the rest of that menu's object — `setHeader` is
 * shallow at the top level, so `{ sections: { position } }` alone would drop `shown` and `mobile`.
 * **Back to the bar drops the key** rather than writing `"bar"`: absent is the bar (ADR 0060), and a
 * place chosen and then undone leaves the document as it was. A menu object left with nothing in it
 * goes with it.
 */
function placed<T extends "pages" | "sections">(
  doc: RetorikaDocument,
  menu: T,
  position: string,
): Partial<Header> {
  const { position: _, ...rest } = (doc.header?.[menu] ?? {}) as Record<string, unknown>;
  const next = position === "bar" ? rest : { ...rest, position };
  return { [menu]: Object.keys(next).length === 0 ? undefined : next } as Partial<Header>;
}

/** The header with the sections menu's place chosen (sprint 31). */
export function sectionsPositionPatch(
  doc: RetorikaDocument,
  position: SectionsPosition,
): Partial<Header> {
  return placed(doc, "sections", position);
}

/** The header with the pages menu's place chosen (sprint 31). */
export function pagesPositionPatch(
  doc: RetorikaDocument,
  position: PagesPosition,
): Partial<Header> {
  return placed(doc, "pages", position);
}

/** «La marca y el botón van con el menú de páginas» on or off; off drops the key. */
/**
 * «Se queda arriba al bajar» on or off — **and off takes the line of how much has been read with it,
 * in the same patch** (ADR 0068, David's condition a): the line lives on a fixed bar, the schema
 * refuses it alone, and a key the panel no longer offers must not stay behind where nobody can see
 * it. One patch is one step of history, so «Deshacer» brings both back together.
 */
export function stickyPatch(sticky: boolean): Partial<Header> {
  return sticky ? { sticky } : { sticky, progress: undefined };
}

/** «Muestra cuánto se ha leído» on or off; off drops the key (ADR 0068). */
export function progressPatch(on: boolean): Partial<Header> {
  return { progress: on ? true : undefined };
}

export function brandWithPagesPatch(on: boolean): Partial<Header> {
  return { brandWithPages: on ? true : undefined };
}

/**
 * **What the canvas shows of a column, said from the width it lays the page out at** (David's
 * adjustment 1 on approving sprint 31). «En el lienzo se ve siempre» is true at 1280 and a lie in the
 * zone under the legibility floor, where the canvas lays out narrower (ADR 0061) and a column folds
 * there as it does in a visitor's window. So the sentence reads the same `layoutWidth` the canvas's
 * «Vista a N px» reads, and the same widths the stylesheet's `@media` are written with:
 *
 * - at 1280, the column is seen in every window from its width, and always in the canvas;
 * - under 1280 and still at or over its width, the canvas says how wide, and that it is seen;
 * - under its width, that it folds, and what brings it back — a wider window, or the panel closed;
 * - in the phone view, that there is no column there.
 *
 * **And since sprint 34 día 4, past the canvas and never** (ADR 0067): a bar whose words fold it past
 * 1279 stands its column from wider than the canvas ever lays out, so neither «se ve siempre» nor «amplía
 * la ventana» is true — the note says the column is seen from that width and not in the canvas; and a
 * bar that never fits has no column at any width (`foldWidth` infinite), which is said as such.
 */
export function columnNote(
  foldWidth: number,
  layoutWidth: number,
  device: "desktop" | "mobile",
): string {
  if (!Number.isFinite(foldWidth)) return es["editor.menuPanel.notes.columnNever"];
  const width = String(foldWidth);
  if (device === "mobile")
    return es["editor.menuPanel.notes.columnPhone"].replace("{width}", width);
  if (foldWidth > DESKTOP_LAYOUT_WIDTH) {
    return es["editor.menuPanel.notes.columnBeyondCanvas"]
      .replace("{width}", width)
      .replace("{canvas}", String(DESKTOP_LAYOUT_WIDTH));
  }
  if (layoutWidth >= DESKTOP_LAYOUT_WIDTH) {
    return es["editor.menuPanel.notes.column"]
      .replace("{width}", width)
      .replace("{canvas}", String(DESKTOP_LAYOUT_WIDTH));
  }
  const n = String(Math.round(layoutWidth));
  return (
    layoutWidth >= foldWidth
      ? es["editor.menuPanel.notes.columnHere"]
      : es["editor.menuPanel.notes.columnFolded"]
  ).replace("{n}", n);
}

/**
 * **What a bar whose words do not fit one line is, by weight** (sprint 34 día 4; ADR 0067; David's
 * decision 2 of sprint 34 and his adjustment 2 approving it). Under 1024 the fold is a tablet's
 * («Menú» on tablets and narrow windows), and **only the panel says it** (David, día 4: a third of
 * freshly generated sites fold there, at 805, by the labels the generator writes — «el aviso se calla;
 * el dato se escribe», in the backlog); from 1024 **the desktop site carries the phone's menu** —
 * «Menú» and its full-height sheet, no column — and the download review says it, before the long
 * button (`LoudFold`). `over` is the characters to cut so the line fits at 1248 (0 when it does
 * up to there) or, for a bar that never fits, the page's measure; and **«por muy poco»** is David's
 * condition of día 3 — under 5 % past the measure the line is a label away from fitting on a wide
 * screen, and «a ningún ancho» alone would leave the owner not knowing why the desktop site has the
 * phone's menu. `undefined` where the bar is the phone's only on a phone.
 */
/**
 * `brandFrom`, since sprint 35 día 5: where the bar would fit on one line **with the brand at its
 * «Normal» sizes**, when the owner chose a larger logo or name and that is part of why the bar folds
 * — measured by the same renderer on the same document with the two sizes taken out, and written
 * only when it is narrower, so the review never blames a size that changed nothing.
 */
type BrandFrom = { brandFrom?: number };
export type FoldWarning =
  | ({ weight: "tablet"; width: number } & BrandFrom)
  | ({ weight: "desktop"; width: number; over: number } & BrandFrom)
  | ({ weight: "always"; over: number; nearly: boolean } & BrandFrom);
/** The fold the download review says: from 1024, or never fitting. */
export type LoudFold = Exclude<FoldWarning, { weight: "tablet" }>;

/** How far past the measure a line that never fits may be and still be «por muy poco». */
export const NEARLY_PAST_THE_MEASURE = 0.05;

export function foldWarning(doc: RetorikaDocument): FoldWarning | undefined {
  const widths = headerWidths(doc);
  const brand = brandFrom(doc, widths.phone);
  if (widths.phone === "always") {
    return {
      weight: "always",
      over: widths.over,
      nearly: widths.beyond < NEARLY_PAST_THE_MEASURE * BAR_MEASURE,
      ...brand,
    };
  }
  if (widths.phone <= PHONE_BREAKPOINT) return undefined;
  if (widths.phone < RAIL_FOLD_WIDTH) return { weight: "tablet", width: widths.phone, ...brand };
  return { weight: "desktop", width: widths.phone, over: widths.over, ...brand };
}

/** The width the bar would fit from with the brand at «Normal», when that is narrower (`BrandFrom`). */
function brandFrom(doc: RetorikaDocument, phone: number | "always"): BrandFrom {
  const sized = doc.header?.brand;
  if (sized?.logoSize === undefined && sized?.nameSize === undefined) return {};
  const { logoSize: _, nameSize: _name, ...plain } = sized;
  const without = headerWidths({ ...doc, header: { ...doc.header, brand: plain } }).phone;
  if (without === "always" || (phone !== "always" && without >= phone)) return {};
  return { brandFrom: Math.max(without, PHONE_BREAKPOINT) + 1 };
}

/** What the brand's size has to do with the fold, said after the fold's own reason, or `""`. */
function brandFromText(fold: FoldWarning): string {
  if (fold.brandFrom === undefined) return "";
  return ` ${
    fold.brandFrom <= PHONE_BREAKPOINT + 1
      ? es["editor.menuPanel.notes.foldsBrandFits"]
      : es["editor.menuPanel.notes.foldsBrandFrom"].replace("{width}", String(fold.brandFrom))
  }`;
}

/** `es` with `{n}` filled, from its singular key when there is one character. */
function counted(one: keyof typeof es, many: keyof typeof es, n: number): string {
  return n === 1 ? es[one] : es[many].replace("{n}", String(n));
}

/** The fold said in the «Menú» panel, under «Dónde va»: by its weight, with the count when there
 * is one. */
export function foldNoteText(fold: FoldWarning): string {
  return foldNoteOwn(fold) + brandFromText(fold);
}

function foldNoteOwn(fold: FoldWarning): string {
  if (fold.weight === "tablet") {
    return es["editor.menuPanel.notes.foldsTablet"].replace("{width}", String(fold.width));
  }
  if (fold.weight === "desktop") {
    return es["editor.menuPanel.notes.foldsDesktop"].replace("{width}", String(fold.width));
  }
  return fold.nearly
    ? counted(
        "editor.menuPanel.notes.foldsNearlyOne",
        "editor.menuPanel.notes.foldsNearly",
        fold.over,
      )
    : counted(
        "editor.menuPanel.notes.foldsAlwaysOne",
        "editor.menuPanel.notes.foldsAlways",
        fold.over,
      );
}

/** The fold said in the download review: the row (what the visitor sees) and the reason (why, how
 * much, and what to do). */
export function foldReviewText(fold: LoudFold): { row: string; why: string } {
  if (fold.weight === "always") {
    return {
      row: es["editor.download.fold.row.always"],
      why:
        (fold.nearly
          ? counted(
              "editor.download.fold.whyNearlyOne",
              "editor.download.fold.whyNearly",
              fold.over,
            )
          : counted(
              "editor.download.fold.whyAlwaysOne",
              "editor.download.fold.whyAlways",
              fold.over,
            )) + brandFromText(fold),
    };
  }
  const width = String(fold.width);
  const row = es["editor.download.fold.row.desktop"].replace("{width}", width);
  const why =
    fold.over === 0
      ? es["editor.download.fold.why"]
      : counted("editor.download.fold.whyOverOne", "editor.download.fold.whyOver", fold.over);
  return {
    row,
    why:
      why.replace("{width}", width).replace("{from}", String(TWO_RAILS_FOLD_WIDTH)) +
      brandFromText(fold),
  };
}

/**
 * **What the canvas shows of a folded bar** (sprint 34 día 4): where the canvas lays the page out at
 * or under the fold — a 1024 window with the panel open lays it out at 887 (ADR 0061), many sites'
 * bar folds past that — the owner edits «Menú» where the published site at 1280 shows the strip, and
 * the panel says so, with the width from which it is seen whole. `null` where the canvas shows the
 * strip, in the phone view (where «Menú» is the point), and for a bar that never fits (its own note
 * says so).
 */
export function foldedCanvasNote(
  fold: FoldWarning | undefined,
  layoutWidth: number,
  device: "desktop" | "mobile",
): string | null {
  if (fold === undefined || fold.weight === "always" || device === "mobile") return null;
  if (layoutWidth > fold.width) return null;
  return es["editor.menuPanel.notes.foldedCanvas"].replace("{width}", String(fold.width + 1));
}

/** «En el móvil», and the fixed bar's notes on the phone, with the widths they really cover: up to
 * the fold when it is past the phone, at every width when the bar never fits. */
export function phoneSpan<K extends "sectionsMobile" | "stickyPhone" | "stickyPhoneRow">(
  key: K,
  phoneWidth: number | "always",
): string {
  if (phoneWidth === "always") return es[`editor.menuPanel.${key}Always`];
  if (phoneWidth <= PHONE_BREAKPOINT) return es[`editor.menuPanel.${key}`];
  return es[`editor.menuPanel.${key}UpTo`].replace("{width}", String(phoneWidth));
}

/** Under a column card in «Dónde va», where the fold keeps that column away (sprint 34 día 4; David's
 * adjustment 2): from 1024 up the column stands from just above the fold — `columnWidth`, that
 * column's own, which two opposite columns may push to 1248 — and a bar that never fits has no
 * column at all. `null` under 1024, where the column stands where it always did. */
export function columnCardNote(fold: FoldWarning | undefined, columnWidth: number): string | null {
  if (fold === undefined || fold.weight === "tablet") return null;
  if (fold.weight === "always") return es["editor.menuPanel.position.columnNever"];
  return es["editor.menuPanel.position.columnFrom"].replace("{width}", String(columnWidth));
}

/**
 * The header with part of its look changed, keeping the rest — `setHeader` is shallow at the top
 * level, so the whole `look` goes in. A switch turned off drops its key rather than writing `false`,
 * and a look with nothing left in it drops its own, so turning «En mayúsculas» on and off again
 * leaves the document as it was. A chosen alignment, gap or size is kept even when it equals the
 * default: the owner pressed it, and an alignment that silently followed the next layout change
 * would be the panel undoing a choice.
 */
export function lookPatch(
  doc: RetorikaDocument,
  change: Partial<NonNullable<Header["look"]>>,
): Partial<Header> {
  const next: Record<string, unknown> = { ...(doc.header?.look ?? {}), ...change };
  for (const key of Object.keys(next)) {
    if (next[key] === false || next[key] === undefined) delete next[key];
  }
  return { look: Object.keys(next).length === 0 ? undefined : next };
}

/**
 * What each background scheme paints, as the panel's swatches draw it: the bar's colour and the
 * colour its words take, in this site's palette. **The renderer's pairs**, written once more because
 * they live in CSS (`headerCss`) and a swatch needs hex; `headerState.test.ts` reads the renderer's
 * stylesheet and fails if the two disagree. A transparent bar shows the page's own surface through
 * it, which is what the swatch can honestly show — over a photograph nobody can say.
 */
export const SCHEME_TOKENS: Record<
  HeaderBackground,
  {
    bar: "color.surface" | "color.primary" | "color.secondary" | "color.ink";
    text: "color.ink" | "color.surface";
  }
> = {
  // Ink on the surface schemes since ADR 0063 (sprint 32 día 1): the primary is written on no glass,
  // and a scrolled surface bar is glass.
  surface: { bar: "color.surface", text: "color.ink" },
  primary: { bar: "color.primary", text: "color.surface" },
  secondary: { bar: "color.secondary", text: "color.surface" },
  ink: { bar: "color.ink", text: "color.surface" },
  transparent: { bar: "color.surface", text: "color.ink" },
};

export function schemeSwatch(
  doc: RetorikaDocument,
  background: HeaderBackground,
): { bar: string; text: string } {
  const tokens = SCHEME_TOKENS[background];
  return { bar: doc.theme[tokens.bar], text: doc.theme[tokens.text] };
}

/** The exact value the owner wrote for one part, or `undefined` when it follows the system. */
export function headerExact(
  doc: RetorikaDocument,
  part: HeaderPart,
  property: StyleProperty,
): string | undefined {
  const value = doc.header?.style?.[part]?.[property];
  return value !== undefined && "exact" in value ? value.exact : undefined;
}

/**
 * The colour a part is painted **right now**, for the `<input type="color">` to start from — the
 * exact one if the owner wrote it, otherwise the scheme's. An input with nothing assigned shows
 * black, a colour the page does not have (the toolbar's lesson, sprint 9). The bar's colour is its
 * background; the button's words sit on the button, which inverts on a coloured bar.
 */
export function headerColorInForce(doc: RetorikaDocument, part: HeaderPart): string {
  const exact = headerExact(doc, part, "color");
  if (exact !== undefined) return exact;
  const background = doc.header?.look?.background ?? "surface";
  const tokens = SCHEME_TOKENS[background];
  if (part === "bar") return doc.theme[tokens.bar];
  if (part === "action") {
    return doc.theme[tokens.text === "color.surface" ? "color.primary" : "color.surface"];
  }
  return doc.theme[tokens.text];
}

/**
 * The header with one part's property set to an exact value — rule 6's marked exception — or, with
 * `undefined`, back to the system; with no property at all, the whole part back to the system in
 * one step. A part with nothing left drops its key, and a `style` with no part left drops its own,
 * so «Volver al sistema» leaves the document exactly as it was before.
 */
export function headerStylePatch(
  doc: RetorikaDocument,
  part: HeaderPart,
  property: StyleProperty | undefined,
  exact: string | undefined,
): Partial<Header> {
  const style = { ...(doc.header?.style ?? {}) };
  const own: Record<string, unknown> = property === undefined ? {} : { ...(style[part] ?? {}) };
  if (property === undefined) {
    // Every exact value of the part goes; a reference, which nothing here writes, would stay.
    for (const [key, value] of Object.entries(style[part] ?? {})) {
      if (value !== undefined && !("exact" in value)) own[key] = value;
    }
  } else if (exact === undefined) delete own[property];
  else own[property] = { exact, exception: true };
  if (Object.keys(own).length === 0) delete style[part];
  else (style as Record<string, unknown>)[part] = own;
  return { style: Object.keys(style).length === 0 ? undefined : style };
}
