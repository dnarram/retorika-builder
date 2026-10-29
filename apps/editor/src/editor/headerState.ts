import { COVER_ID, FOOTER_ID, TEASER_ID } from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import {
  actionEntry,
  headerDrawn,
  headerPhoneRow,
  headerSettings,
  homeMenuLabel,
  MENU_MIN_ENTRIES,
  pageLabel,
  pageMenuEntries,
  sectionLabel,
  sectionMenuEntries,
} from "@retorika/renderer";
import type {
  Header,
  HeaderAction,
  HeaderBackground,
  HeaderLayout,
  HeaderPart,
  Page,
  RetorikaDocument,
  StyleProperty,
} from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };
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
  hairline: boolean;
  sectionsMobile: "row" | "hidden";
  /** A fixed bar lets go on a phone, because the sections' row is under it there (día 2). */
  phoneRow: boolean;
  /** The bar lies transparent over the cover (ADR 0057 §look; chosen on día 6). */
  transparent: boolean;
  /** Whether the sections take a row of their own under the bar at every width (día 6). */
  sectionsRow: "shared" | "own";
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
    hairline: settings.hairline,
    sectionsMobile: settings.sectionsMobile,
    phoneRow: headerPhoneRow(doc, settings),
    transparent: settings.background === "transparent",
    sectionsRow: settings.sectionsRow,
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

/**
 * The header with the brand's name switched, keeping the logo: `name` is written only when on, and
 * a brand with nothing left in it drops its key, so a header nobody decided reads as none.
 */
export function brandNamePatch(doc: RetorikaDocument, name: boolean): Partial<Header> {
  const { name: _, ...rest } = doc.header?.brand ?? {};
  const next = name ? { ...rest, name: true } : rest;
  return { brand: Object.keys(next).length === 0 ? undefined : next };
}

/** The header with the sections' phone row chosen, keeping the rest of `sections`. */
export function sectionsMobilePatch(
  doc: RetorikaDocument,
  mobile: "row" | "hidden",
): Partial<Header> {
  return { sections: { ...(doc.header?.sections ?? {}), mobile } };
}

/** The header with the sections' row chosen at every width, keeping the rest of `sections`. */
export function sectionsRowPatch(doc: RetorikaDocument, row: "shared" | "own"): Partial<Header> {
  return { sections: { ...(doc.header?.sections ?? {}), row } };
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
    text: "color.primary" | "color.surface";
  }
> = {
  surface: { bar: "color.surface", text: "color.primary" },
  primary: { bar: "color.primary", text: "color.surface" },
  secondary: { bar: "color.secondary", text: "color.surface" },
  ink: { bar: "color.ink", text: "color.surface" },
  transparent: { bar: "color.surface", text: "color.primary" },
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
    return doc.theme[tokens.text === "color.primary" ? "color.surface" : "color.primary"];
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
