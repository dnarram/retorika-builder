"use client";

import type { LogoColours } from "@retorika/generator";
import type { OwnFont, PaletteOrigin, Theme } from "@retorika/schema";
import {
  derivePalette,
  type FontKey,
  identifyScale,
  identifyTypePair,
  PALETTES,
  type PaletteColors,
  paletteLabel,
  relativeLuminance,
  SCALES,
  TYPE_PAIRS,
} from "@retorika/tokens";
import tokensEs from "@retorika/tokens/locales/es" with { type: "json" };
import {
  Fragment,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { BrandField, ColourField } from "../editor/ColourField.tsx";
import { EDITABLE_KEYS, type EditableKey } from "../editor/colourField.ts";
import {
  familiesHelpText,
  familyRowFor,
  galleryFaceCss,
  ownFaceCss,
  typePairNoteText,
} from "../editor/letterGallery.ts";
import { type LogoPalettes, sameColours } from "../editor/logoColours.ts";
import { nearestPalette, parseHex } from "../editor/logoPalette.ts";
import {
  Face,
  Note,
  PanelHeader,
  PanelSection,
  type Previewer,
  panelFrame,
  pressBox,
  pressLabel,
} from "../editor/panelKit.tsx";
import es from "../locales/es.json" with { type: "json" };

/**
 * "El estilo de toda la web" — mockup 13, reconciled with what the code can honestly offer.
 *
 * Thirteen palettes since sprint 38 día 4 (the logo's two before them when there is a logo, and «Tu
 * paleta» after them since día 6), and three typefaces. **The typefaces and the measures are radio
 * groups**: real `<input type="radio">` inside the `<label>`, visually hidden, which is the pattern the
 * mockup itself draws and the one that gets keyboard arrows, grouping and the announced choice for
 * free. **The palettes are cards** (sprint 38 día 6, David's P7): a `radiogroup` of buttons, two to a
 * row, each a stripe of the five colours the page paints with and the palette's name — because
 * sixteen rows of 56 px are 900 px of panel, and because the arrows must **move** and not choose: a
 * native radio chooses on every arrow, which here is a step of history per key. See `PaletteGrid`.
 *
 * **Three deliberate divergences from the mockup, each recorded in `docs/design/REVIEW.md`:**
 *
 * - **No "Avanzado: colores exactos y tamaños".** The mockup's last row opens a free colour
 *   picker. It is not implemented and not planned: `REVIEW.md` already ruled that "a palette that
 *   is not contrast-tested cannot ship", and the protocol puts it more strongly still — a palette
 *   with bad contrast cannot even be declared. A picker is a machine for producing exactly that.
 *   It is the same warn-or-block line the rest of the product draws, applied to colour.
 * - **The three pairs are named by character, and the gallery under them by font.** The mockup
 *   labels its three rows `Inter`, `Poppins` and `Source Serif`; ours are «Editorial y serena» and
 *   the rest, because issue #9 found that a label saying "Inter" promised a font that might never
 *   arrive, while "Moderna y neutra" is true whichever font resolves. **ADR 0046 removed that
 *   reason for eight families by sending their faces**, so the group below the pairs names them
 *   outright — and its specimens are drawn in the very file the ZIP will carry, served by the
 *   editor's own `fonts/[file]` route. The pairs' own `Aa` is still rendered in the stack, so what
 *   it shows is what the owner will get, fallback included.
 * - **Five swatches, but not the mockup's five.** Ours are the five colours the stylesheet
 *   actually paints with; `color.accent` is left out because no rule reads it and its contrast is
 *   asserted nowhere. See `stripeOf`.
 *
 * **A third group, `MEDIDAS`, appears only with the design tools on** (sprint 9). That is the
 * advanced dossier §4's own line: apagado the panel offers «Paletas y parejas tipográficas»,
 * encendido it «Añade el sistema y tipografías propias». **Both halves are delivered since sprint 24
 * día 6**: «tipografías propias» waited for issue #9 — a font the visitor may never receive is a
 * promise this product does not make — and the gallery answers it by sending the file rather than by
 * hoping. It is offered to everybody and not gated behind the design tools, for the reason the
 * floating toolbar's two references are not: choosing a letter is the owner's own branding, not a
 * professional's tool (advanced dossier §4, «Apagado»).
 *
 * **The dossier's word is «el sistema» and the legend says «MEDIDAS».** Not a divergence from an
 * approved screen — mockup 13 draws no such group at all, and mockup 17, which does, labels it
 * exactly this — so it is not in the list above and there is nothing for `REVIEW.md` to record.
 * It is a copy choice, for the same reason the typefaces are named by character and never by
 * font: «el sistema» is what the document calls the thing and «medidas» is what the owner sees
 * change. The help line under the legend says which three — el tamaño del texto, el aire entre
 * las cosas y las esquinas.
 *
 * Nothing here holds an **answer**. Which palette is ticked is *deduced* from the document's own
 * theme and its origin, because a theme keeps values and not identities — see `paletteCards` and
 * `paletteLabel`. That is why the tick cannot go stale: there is no second copy of the answer to
 * drift. The only state in this file is the cards' own (sprint 38 día 6): which card holds the
 * keyboard's place, and whether the owner folded the chosen card's swatches — neither of which is
 * about the site. The letter chooser is a dialog (`FontChooserDialog`), opened by the two rows below
 * the pairs, and which half it is open for is `Editor.tsx`'s to remember.
 */

export interface StylePanelProps {
  /** The site's background with motifs, drawn after the letter (ADR 0081). */
  background?: ReactNode;
  theme: Theme;
  /** The fonts the owner brought and the object URLs of their faces, so a row whose half is set in
   * one names it and draws it (sprint 29 día 5). */
  fonts: readonly OwnFont[];
  fontUrls: ReadonlyMap<string, string>;
  onPickPalette: (paletteId: string) => void;
  /**
   * The two palettes the logo's colours make, light and dark (sprint 38 día 3, ADR 0076), and the
   * colours they came from — `null` without a logo, or for one with no colour in it. Offered first,
   * because a logo's colours are the brand's; the predefined palettes are for whoever brought none.
   */
  logoPalettes: LogoPalettes | null;
  logoColours: LogoColours | null;
  onPickLogoPalette?: (colors: PaletteColors) => void;
  /**
   * Where the theme's colours came from (ADR 0075), so the chosen card can say «{nombre},
   * personalizada» and offer «Volver a la original» once a colour has moved (día 7). Absent for a
   * site saved before 1.20.0, which is read by its values as before.
   */
  origin?: PaletteOrigin | undefined;
  /**
   * What paints the canvas with a palette under the mouse before it is pressed (día 6, David's P7):
   * `themePreviewer`, writing the colour variables on the canvas's root as chrome. Only the mouse
   * previews — a finger that touches a card has pressed it, and the keyboard's arrows move the focus
   * and nothing else.
   */
  previewer?: Previewer<PaletteColors> | undefined;
  /**
   * One colour of the chosen palette moved in its field (sprint 38 día 7, ADR 0077): a drag released,
   * the wheel or the hex accepted, «Ajustar» — one step each — or the palette «Tu paleta» derives from
   * one colour. `origin` is the card's, so a palette moved is still that palette, «personalizada».
   */
  onSetColours?: ((colors: PaletteColors, origin: PaletteOrigin) => void) | undefined;
  /** One press of a run of arrows in a field, and the run's end: one step for the whole run. */
  onAdjustColours?:
    | ((colors: PaletteColors, origin: PaletteOrigin, field: string) => void)
    | undefined;
  onSettleColours?: (() => void) | undefined;
  onPickTypePair: (typePairId: string) => void;
  /**
   * Open the letter chooser for one of the two font tokens (ADR 0046, sprint 29 día 1).
   *
   * The choice itself is made in the dialog, which `Editor.tsx` mounts in the shell's `overlay`;
   * this panel only says which half the owner pressed «Cambiar» on. Separate halves because they
   * are separate choices: headings and text are chosen one at a time, so an owner can put Figtree
   * over Spectral without the product deciding the other half for them.
   */
  onOpenChooser: (key: FontKey) => void;
  onPickScale: (scaleId: string) => void;
  /**
   * Whether the design tools are on for the person looking — nothing about the site.
   *
   * It gates the `SISTEMA` group and nothing else, and it gates it by **not rendering it**: a
   * disabled fieldset would tell somebody who is not a professional that there is a door they
   * cannot open, which is the opposite of what the switch is for (ADR 0025). The same rule the
   * `Diseño` rail item already follows.
   */
  designTools: boolean;
  onClose: () => void;
}

function nameOf(nameKey: string): string {
  return tokensEs[nameKey as keyof typeof tokensEs] ?? nameKey;
}

/**
 * The two choices the gallery offers, and the legend each one carries (ADR 0046).
 *
 * Headings first, because that is the order a visitor reads them in, and two and not three: there is
 * no `font.accent`, decided in sprint 24 — a third slot would be a new key in a `strictObject` that
 * demands all of them, so a migration, a version bump and nineteen goldens moving, plus a third
 * family in the ZIP of whoever used it.
 */
const FAMILY_CHOICES: readonly {
  key: FontKey;
  labelKey: "editor.style.familyRow.heading" | "editor.style.familyRow.body";
  changeKey: "editor.style.changeHeading" | "editor.style.changeBody";
}[] = [
  {
    key: "font.heading",
    labelKey: "editor.style.familyRow.heading",
    changeKey: "editor.style.changeHeading",
  },
  {
    key: "font.body",
    labelKey: "editor.style.familyRow.body",
    changeKey: "editor.style.changeBody",
  },
];

export function StylePanel({
  theme,
  fonts,
  fontUrls,
  onPickPalette,
  logoPalettes,
  logoColours,
  onPickLogoPalette,
  origin,
  previewer,
  onSetColours,
  onAdjustColours,
  onSettleColours,
  onPickTypePair,
  onOpenChooser,
  onPickScale,
  designTools,
  onClose,
  background,
}: StylePanelProps) {
  const headingId = useId();
  const typeGroup = useId();
  const scaleGroup = useId();
  const cards = paletteCards({
    theme,
    origin,
    logoPalettes,
    logoColours,
    onPickPalette,
    onPickLogoPalette,
  });
  const currentType = identifyTypePair(theme);
  const currentScale = identifyScale(theme);
  const familyRows = FAMILY_CHOICES.map((choice) => ({
    ...choice,
    ...familyRowFor(theme, choice.key, fonts),
  }));

  return (
    <aside
      aria-labelledby={headingId}
      // In the flow to the right of the canvas, not fixed over it, which is how mockup 13 draws
      // it: the preview narrows and stays fully visible while the choice is being made. The
      // fields panel is fixed instead, because that one docks over a card that can itself be
      // 400px wide in the mobile view.
      className={panelFrame}
    >
      <PanelHeader
        id={headingId}
        title={es["editor.style.title"]}
        help={es["editor.style.help"]}
        close={{ label: es["editor.style.close"], onClick: onClose }}
      />

      <PanelSection legend={es["editor.style.colors"]}>
        {cards.selectedId === undefined ? (
          // Not an error and not a blank space to wonder about: the honest state for a theme no
          // palette produced, which a restored document or a hand-edited one can be. Pressing any
          // card resolves it.
          <Note>{es["editor.style.noPalette"]}</Note>
        ) : null}
        <PaletteGrid
          cards={cards}
          previewer={previewer}
          edit={
            onSetColours && onAdjustColours && onSettleColours
              ? { set: onSetColours, adjust: onAdjustColours, settle: onSettleColours }
              : undefined
          }
        />
      </PanelSection>

      <PanelSection legend={es["editor.style.typography"]}>
        {currentType === undefined ? <Note>{typePairNoteText(theme, fonts)}</Note> : null}
        {TYPE_PAIRS.map((pair) => {
          const selected = currentType?.id === pair.id;
          return (
            <label key={pair.id} className={pressLabel}>
              <input
                type="radio"
                name={typeGroup}
                checked={selected}
                onChange={() => onPickTypePair(pair.id)}
                className="absolute h-px w-px opacity-0"
              />
              <Face chosen={selected} className="flex h-14 items-center gap-3.5 px-4">
                {/* The specimen is drawn in the pair's own heading stack, so it shows the font that
                  will actually resolve on this machine — which is the whole reason the label next
                  to it does not name one (issue #9). */}
                <span
                  aria-hidden="true"
                  className="w-8 shrink-0 text-center text-[22px] leading-none text-ui-ink"
                  style={{ fontFamily: pair.fonts["font.heading"] }}
                >
                  {es["editor.style.specimen"]}
                </span>
                <span
                  className={
                    "text-[15px] " +
                    (selected ? "font-semibold text-ui-ink" : "font-medium text-ui-ink")
                  }
                >
                  {nameOf(pair.nameKey)}
                </span>
              </Face>
            </label>
          );
        })}
      </PanelSection>

      {/**
       * The two halves of the letter (ADR 0046, sprint 29 día 1): what the headings and the text are
       * set in today, each drawn in that very letter, and a «Cambiar» that opens the chooser for
       * that half. **Two rows whatever the gallery holds** — eight families today, forty from día 3 —
       * which is the point: the panel's height stopped depending on the number of families the day
       * the list left it.
       *
       * It is offered to everybody and not gated: the design tools gate `MEDIDAS` and nothing else
       * here, because a letter is the owner's own branding and not a professional's tool.
       */}
      <div className="flex flex-col gap-[9px]">
        {/* Declared for the one or two faces the rows draw, and only those: a declared face is a
            download the moment text is laid out in it, so this sheet names what is on screen and
            nothing «just in case». */}
        <style>
          {`${galleryFaceCss(familyRows.flatMap((row) => (row.family ? [row.family] : [])))}\n${ownFaceCss(
            familyRows.flatMap((row) => (row.own ? [row.own] : [])),
            fontUrls,
          )}`}
        </style>
        {/* Not `panelRow` on these: that one lights its edge on hover because it is a thing you
            press, and a row here is not — the button inside it is. */}
        {familyRows.map((row) => (
          <div
            key={row.key}
            className="flex h-14 items-center gap-3.5 rounded-ui border border-ui-border bg-ui-surface px-4"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[11px] font-bold tracking-[0.09em] text-ui-muted">
                {es[row.labelKey]}
              </span>
              {/* Drawn in the letter the row is about: the shipped face when a family is named, the
                  theme's own stack when a pair's system letter is — so what the row shows is what
                  that machine gives, which is the rule since issue #9. */}
              <span
                className="truncate text-[16px] leading-tight text-ui-ink"
                style={{ fontFamily: row.stack }}
              >
                {row.text}
              </span>
            </span>
            <button
              type="button"
              aria-label={es[row.changeKey]}
              onClick={() => onOpenChooser(row.key)}
              className="ui-interactive h-8 shrink-0 cursor-pointer rounded-ui-sm border border-ui-border bg-ui-surface px-3 text-[13px] font-semibold text-ui-ink hover:border-ui-border-strong"
            >
              {es["editor.style.change"]}
            </button>
          </div>
        ))}
        <Note>{familiesHelpText()}</Note>
      </div>

      {/* The site's background with motifs (ADR 0081, sprint 40 día 6), drawn by `BackgroundBlock`:
          for everybody, like the letter — it is the owner's own branding, not a professional's tool. */}
      {background}

      {designTools ? (
        <PanelSection legend={es["editor.style.system"]}>
          {/* The one group of the three that needs saying out loud what it changes: a palette and a
              typeface announce themselves in their own swatches, and "medidas" does not. */}
          <Note className="mb-1">{es["editor.style.systemHelp"]}</Note>
          {currentScale === undefined ? <Note>{es["editor.style.noScale"]}</Note> : null}
          {SCALES.map((scale) => {
            const selected = currentScale?.id === scale.id;
            return (
              <label key={scale.id} className={pressLabel}>
                <input
                  type="radio"
                  name={scaleGroup}
                  checked={selected}
                  onChange={() => onPickScale(scale.id)}
                  className="absolute h-px w-px opacity-0"
                />
                <Face chosen={selected} className="flex h-14 items-center gap-3.5 px-4">
                  {/* Drawn from the scale's own eleven values, for the same reason the `Aa` above is
                    drawn in the pair's own font stack: what the specimen shows *is* what the site
                    will get. The corner is this scale's `radius.md` and the gap its `space.xs`,
                    both used literally; only the bar's height is scaled, and by `calc()` rather
                    than by parsing the string, so a value in `rem` and one in `px` both work
                    without this file knowing which it was given. */}
                  <span
                    aria-hidden="true"
                    className="flex w-10 shrink-0 flex-col justify-center border border-ui-border bg-white px-1.5"
                    style={{
                      height: 38,
                      borderRadius: scale.radii["radius.md"],
                      gap: scale.spaces["space.xs"],
                    }}
                  >
                    <span
                      style={{
                        height: `calc(${scale.sizes["size.heading"]} * 0.28)`,
                        borderRadius: 1,
                        background: "#334155",
                      }}
                    />
                    <span style={{ height: 2, borderRadius: 1, background: "#CBD5E1" }} />
                  </span>
                  <span
                    className={
                      "text-[15px] " +
                      (selected ? "font-semibold text-ui-ink" : "font-medium text-ui-ink")
                    }
                  >
                    {nameOf(scale.nameKey)}
                  </span>
                </Face>
              </label>
            );
          })}
        </PanelSection>
      ) : null}
    </aside>
  );
}

/*
 * ---------------------------------------------------------------------------------------------
 * The palettes as cards (sprint 38 día 6, decision 10 of the sprint's plan).
 * ---------------------------------------------------------------------------------------------
 */

const LOGO_LIGHT = "logo-light";
const LOGO_DARK = "logo-dark";
const OWN_ID = "own";

const CARD_COLOUR_KEYS = [
  "color.primary",
  "color.secondary",
  "color.accent",
  "color.surface",
  "color.ink",
  "color.muted",
  "color.fill",
  "color.onFill",
] as const;

/** The five colours a card's stripe paints, in the order the page meets them: the fill first when
 * the palette has one — the brand's own colour, exact, where a palette without shows its primary. */
export function stripeOf(colors: PaletteColors): string[] {
  return [
    colors["color.fill"] ?? colors["color.primary"],
    colors["color.secondary"],
    colors["color.muted"],
    colors["color.surface"],
    colors["color.ink"],
  ];
}

/** The roles a card's swatches name, in reading order: the fill pair only when the palette has one. */
const SWATCH_ROLES = [
  ["color.fill", "editor.style.role.fill"],
  ["color.onFill", "editor.style.role.onFill"],
  ["color.primary", "editor.style.role.primary"],
  ["color.secondary", "editor.style.role.secondary"],
  ["color.muted", "editor.style.role.muted"],
  ["color.surface", "editor.style.role.surface"],
  ["color.ink", "editor.style.role.ink"],
] as const;

export interface PaletteCard {
  id: string;
  name: string;
  /** The colours the card stands for; `null` for «Tu paleta» before the owner has given it any. */
  colors: PaletteColors | null;
  selected: boolean;
  /** Chosen and then moved by hand: «{nombre}, personalizada», with «Volver a la original». */
  customised: boolean;
  /** A short line under the name, read as the card's description and never as its name. */
  aside?: string;
  /** What a colour moved on this card writes as the theme's origin (ADR 0075). */
  origin: PaletteOrigin;
  pick?: () => void;
  restore?: () => void;
}

export interface PaletteCards {
  cards: PaletteCard[];
  /** The card the site wears, or `undefined` for colours no card stands for. */
  selectedId: string | undefined;
  /** The sentence under the logo's two cards, when the light one writes its text in a darker tone. */
  note: string | undefined;
}

/**
 * **Which card the site wears is computed, never stored** (ADR 0075): the origin says where the
 * colours came from and the values say whether they still are that. With an origin the chosen card is
 * the origin's, «personalizada» when any colour moved; without one the card whose values the theme
 * holds exactly, the logo's two included, or none. «Tu paleta» is last and stands for the owner's own
 * colours once the origin is `own`; before that it is a card with no colours, which opens its one
 * swatch («Elige un color», alive on día 7) and chooses nothing.
 */
export function paletteCards({
  theme,
  origin,
  logoPalettes,
  logoColours,
  onPickPalette,
  onPickLogoPalette,
}: {
  theme: Theme;
  origin: PaletteOrigin | undefined;
  logoPalettes: LogoPalettes | null;
  logoColours: LogoColours | null;
  onPickPalette: (paletteId: string) => void;
  onPickLogoPalette?: ((colors: PaletteColors) => void) | undefined;
}): PaletteCards {
  const label = paletteLabel(theme, origin, logoPalettes?.light ?? null);
  let selectedId: string | undefined;
  let customised = false;
  if (label.kind === "logo") {
    if (logoPalettes) {
      customised =
        !sameColours(theme, logoPalettes.light) && !sameColours(theme, logoPalettes.dark);
      // Moved by hand, the origin says «logo» and not which of the two: the dark one is the one whose
      // ground is dark, which a colour field cannot turn light without breaking every pair on it.
      const dark = customised
        ? relativeLuminance(theme["color.surface"]) < 0.5
        : sameColours(theme, logoPalettes.dark);
      selectedId = dark ? LOGO_DARK : LOGO_LIGHT;
    }
  } else if (label.kind === "palette") {
    selectedId = label.palette.id;
    customised = label.customised;
  } else if (label.kind === "own") {
    selectedId = OWN_ID;
  } else if (logoPalettes) {
    // No origin and no predefined palette: a site that wears its logo's colours from before the
    // origin existed is still wearing them.
    if (sameColours(theme, logoPalettes.light)) selectedId = LOGO_LIGHT;
    else if (sameColours(theme, logoPalettes.dark)) selectedId = LOGO_DARK;
  }
  // «Se parece a» is information about a predefined palette, never a choice of one (ADR 0076).
  const near = logoColours ? nearestPalette(parseHex(logoColours.brand)) : null;
  const nearName = near
    ? PALETTES.find((palette) => palette.id === near.paletteId)?.nameKey
    : undefined;
  const looksLike = nearName
    ? es["editor.style.looksLike"].replace("{palette}", nameOf(nearName))
    : undefined;
  // The colours the site wears: what the chosen card shows and what its fields move — the catalog's
  // own colours only for the cards the site does not wear, or a palette moved by hand would show the
  // colours it no longer has.
  const worn = Object.fromEntries(
    CARD_COLOUR_KEYS.flatMap((key) => (theme[key] === undefined ? [] : [[key, theme[key]]])),
  ) as PaletteColors;
  const own: PaletteColors | null = selectedId === OWN_ID ? worn : null;
  const logoCards: PaletteCard[] =
    logoPalettes && onPickLogoPalette
      ? [
          {
            id: LOGO_LIGHT,
            name: es["editor.style.fromLogo"],
            colors: selectedId === LOGO_LIGHT ? worn : logoPalettes.light,
            origin: { kind: "logo" },
            selected: selectedId === LOGO_LIGHT,
            customised: selectedId === LOGO_LIGHT && customised,
            ...(looksLike ? { aside: looksLike } : {}),
            pick: () => onPickLogoPalette(logoPalettes.light),
            restore: () => onPickLogoPalette(logoPalettes.light),
          },
          {
            id: LOGO_DARK,
            name: es["editor.style.fromLogoDark"],
            colors: selectedId === LOGO_DARK ? worn : logoPalettes.dark,
            origin: { kind: "logo" },
            selected: selectedId === LOGO_DARK,
            customised: selectedId === LOGO_DARK && customised,
            pick: () => onPickLogoPalette(logoPalettes.dark),
            restore: () => onPickLogoPalette(logoPalettes.dark),
          },
        ]
      : [];
  return {
    cards: [
      ...logoCards,
      ...PALETTES.map((palette) => ({
        id: palette.id,
        name: nameOf(palette.nameKey),
        colors: selectedId === palette.id ? worn : (palette.colors as PaletteColors),
        origin: { kind: "palette", id: palette.id } as PaletteOrigin,
        selected: selectedId === palette.id,
        customised: selectedId === palette.id && customised,
        pick: () => onPickPalette(palette.id),
        restore: () => onPickPalette(palette.id),
      })),
      {
        id: OWN_ID,
        name: es["editor.style.own"],
        colors: own,
        origin: { kind: "own" },
        selected: selectedId === OWN_ID,
        customised: false,
      },
    ],
    selectedId,
    note:
      logoCards.length > 0 && logoPalettes?.darkerForText
        ? es["editor.style.darkerForText"]
        : undefined,
  };
}

/**
 * **A `radiogroup` of buttons, two to a row** (decision 10). Not `<input type="radio">`: in a native
 * group the arrows *choose*, which here would write the document on every key. Here the arrows and
 * Home/End move the focus (one Tab stop for the group, the roving `tabindex` on the card that holds
 * it), Enter or Space choose a card and open its swatches under its row, and Enter on the chosen card
 * folds them or opens them again. **Under the mouse a card paints the canvas before it is pressed**
 * (`previewer`); leaving puts the colours back, pressing keeps them for the patch — unless the card
 * is the one the site already wears, whose press changes nothing and brings no patch.
 *
 * The chosen card's swatches open **under its row**, which is why they are rendered after the row's
 * last card and span both columns: a block after the chosen card alone would push its row-mate down a
 * row and leave a hole. One open at a time; the height is never animated, the rows arrive.
 */
interface ColourEdits {
  set: (colors: PaletteColors, origin: PaletteOrigin) => void;
  adjust: (colors: PaletteColors, origin: PaletteOrigin, field: string) => void;
  settle: () => void;
}

function PaletteGrid({
  cards: { cards, selectedId, note },
  previewer,
  edit,
}: {
  cards: PaletteCards;
  previewer: Previewer<PaletteColors> | undefined;
  edit: ColourEdits | undefined;
}) {
  const grid = useRef<HTMLDivElement>(null);
  // The card last focused, so Tab comes back to it; the chosen one until then.
  const [holderId, setHolderId] = useState<string | null>(null);
  // A fold the owner asked for, remembered only for the card they asked it of: the chosen card is
  // open unless they folded it, «Tu paleta» without colours is closed unless they opened it.
  const [fold, setFold] = useState<{ id: string; open: boolean } | null>(null);
  const openId =
    fold && (fold.id === selectedId || fold.id === OWN_ID)
      ? fold.open
        ? fold.id
        : null
      : (selectedId ?? null);
  const holder =
    holderId !== null && cards.some((card) => card.id === holderId)
      ? holderId
      : (selectedId ?? cards[0]?.id);
  const openIndex = cards.findIndex((card) => card.id === openId);
  const rowEnd = openIndex < 0 ? -1 : Math.min(openIndex | 1, cards.length - 1);
  const open = openIndex < 0 ? undefined : cards[openIndex];

  const press = (card: PaletteCard) => {
    if (card.selected || !card.pick) {
      // Nothing to write: a press on the chosen card, or on «Tu paleta» before it has colours, folds
      // or opens its swatches — and brings no patch, so the preview is put back here.
      previewer?.end("restore");
      setFold({ id: card.id, open: openId !== card.id });
      return;
    }
    previewer?.end("keep");
    setFold(null);
    card.pick();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(
      grid.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]') ?? [],
    );
    const at = buttons.indexOf(
      event.currentTarget.ownerDocument.activeElement as HTMLButtonElement,
    );
    if (at < 0) return;
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 2,
      ArrowUp: -2,
    };
    const step = steps[event.key];
    const to =
      step !== undefined
        ? Math.min(Math.max(at + step, 0), buttons.length - 1)
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : undefined;
    if (to === undefined) return;
    event.preventDefault();
    buttons[to]?.focus();
  };

  return (
    <div
      ref={grid}
      role="radiogroup"
      aria-label={es["editor.style.palettes"]}
      onKeyDown={onKeyDown}
      className="grid grid-cols-2 gap-2"
    >
      {cards.map((card, index) => (
        <Fragment key={card.id}>
          <PaletteCardButton
            card={card}
            holder={card.id === holder}
            onPress={() => press(card)}
            onFocus={() => setHolderId(card.id)}
            onHover={
              previewer && card.colors
                ? (on) => {
                    if (on && card.colors) previewer.show(card.colors);
                    else previewer.end("restore");
                  }
                : undefined
            }
          />
          {index === 1 && note ? <Note className="col-span-2">{note}</Note> : null}
          {index === rowEnd && open ? (
            <Swatches card={open} previewer={previewer} edit={edit} />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

function PaletteCardButton({
  card,
  holder,
  onPress,
  onFocus,
  onHover,
}: {
  card: PaletteCard;
  holder: boolean;
  onPress: () => void;
  onFocus: () => void;
  onHover: ((on: boolean) => void) | undefined;
}) {
  const asideId = useId();
  // Whether this card is the one previewing: the preview starts on the first move of the mouse over
  // it, and a move after that is the same preview.
  const previewing = useRef(false);
  return (
    // biome-ignore lint/a11y/useSemanticElements: not an <input type="radio">, on purpose (decision 10 of sprint 38): in a native group every arrow chooses, and here a choice is a step of history — the arrows move the focus and Enter chooses
    <button
      type="button"
      role="radio"
      aria-checked={card.selected}
      tabIndex={holder ? 0 : -1}
      // The name a screen reader hears is the label ADR 0075 computes — «Vino tinto, personalizada» —
      // written out: computed from the content it came out as «Vino tinto , personalizada», a space
      // for each block the card stacks, measured in Chromium on día 7.
      aria-label={card.customised ? `${card.name}, ${es["editor.style.customised"]}` : card.name}
      data-palette={card.id}
      {...(card.aside ? { "aria-describedby": asideId } : {})}
      onClick={onPress}
      onFocus={onFocus}
      {...(onHover
        ? {
            // **A move, not an entry** (sprint 38 día 7). A card can arrive under a mouse that has not
            // moved — «Volver a la original» goes, the cards below rise, and «Oliva y arena» lands
            // under the pointer — and the browser says so with an entry and no move. Measured: the
            // site turned olive after a press on a button that is not a card. Something moving that no
            // hand asked for, so the preview waits for the hand.
            onPointerMove: (event: PointerEvent) => {
              if (event.pointerType !== "mouse" || previewing.current) return;
              previewing.current = true;
              onHover(true);
            },
            onPointerLeave: (event: PointerEvent) => {
              if (event.pointerType !== "mouse" || !previewing.current) return;
              previewing.current = false;
              onHover(false);
            },
          }
        : {})}
      className={pressBox}
    >
      <Face chosen={card.selected} className="flex min-h-[72px] flex-col items-stretch gap-2 p-3">
        {card.colors ? (
          <span
            aria-hidden="true"
            className="flex h-6 overflow-hidden rounded-ui-sm border border-black/10"
          >
            {stripeOf(card.colors).map((colour, index) => (
              <span
                // The stripe never reorders, so a block's place is its identity.
                // biome-ignore lint/suspicious/noArrayIndexKey: see above
                key={index}
                className="flex-1"
                style={{ background: colour }}
              />
            ))}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="h-6 rounded-ui-sm border border-ui-border-strong border-dashed bg-ui-surface"
          />
        )}
        <span className="text-[13px] font-semibold leading-tight text-ui-ink">{card.name}</span>
        {card.customised ? (
          <span className="text-[11px] leading-tight text-ui-muted">
            {es["editor.style.customised"]}
          </span>
        ) : null}
        {card.aside ? (
          // Hidden from the name and read as the description: «De tu logo» stays «De tu logo».
          <span id={asideId} aria-hidden="true" className="text-[11px] leading-tight text-ui-muted">
            {card.aside}
          </span>
        ) : null}
      </Face>
    </button>
  );
}

/**
 * The chosen card's colours, one swatch per role the page paints with, **in reading** on día 6 — the
 * dot, the role's name and the hex; «Cambiar» arrives on día 7 with the colour field. «Tu paleta»
 * before it has colours shows its one swatch, the brand's colour, with nothing to read yet.
 */
function Swatches({
  card,
  previewer,
  edit,
}: {
  card: PaletteCard;
  previewer: Previewer<PaletteColors> | undefined;
  edit: ColourEdits | undefined;
}) {
  // One field open at a time, as one card is.
  const [openKey, setOpenKey] = useState<EditableKey | null>(null);
  const colors = card.colors;
  // The chosen card's colours can be moved; nothing else's, since nothing the site wears would move.
  const editable = Boolean(edit && colors && card.selected);
  const rows = colors
    ? SWATCH_ROLES.flatMap(([key, roleKey]) => {
        const colour = colors[key];
        return colour === undefined ? [] : [{ key, role: es[roleKey], colour }];
      })
    : [];
  return (
    <fieldset
      aria-label={es["editor.style.coloursOf"].replace("{palette}", card.name)}
      data-testid="palette-swatches"
      className="col-span-2 m-0 flex min-w-0 flex-col gap-2 rounded-ui border border-ui-border bg-ui-bg p-3"
    >
      {/* Not `data-ui-rows`: that queue is the panel's own on opening (sprint 36 día 5), and a block
          that appears because a card was pressed waits for nothing — measured by the rows guard,
          which found the swatches' five rows interleaved with the panel's when both open together. */}
      {colors ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rows.map((row) => {
            const key = row.key as EditableKey;
            const canEdit = editable && EDITABLE_KEYS.includes(key);
            const fieldId = `${card.id}-${row.key}`;
            return (
              <li key={row.key} className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5 text-[12px] leading-snug">
                  <span
                    aria-hidden="true"
                    className="h-[17px] w-[17px] shrink-0 rounded-full border border-black/10"
                    style={{ background: row.colour }}
                  />
                  <span className="flex-1 font-semibold text-ui-ink">{row.role}</span>
                  <code className="font-mono text-ui-muted">{row.colour}</code>
                  {canEdit ? (
                    <button
                      type="button"
                      aria-expanded={openKey === key}
                      aria-controls={fieldId}
                      aria-label={es["editor.style.field.changeLabel"].replace("{role}", row.role)}
                      onClick={() => setOpenKey(openKey === key ? null : key)}
                      className="ui-interactive h-7 shrink-0 cursor-pointer rounded-ui-sm border border-ui-border bg-ui-surface px-2.5 text-[12px] font-semibold text-ui-ink hover:border-ui-border-strong"
                    >
                      {es["editor.style.field.change"]}
                    </button>
                  ) : null}
                </div>
                {row.key === "color.onFill" && editable ? (
                  <Note className="pl-[27px]">{es["editor.style.field.onFillNote"]}</Note>
                ) : null}
                {canEdit && openKey === key && edit && colors ? (
                  <div
                    id={fieldId}
                    className="rounded-ui-sm border border-ui-border bg-ui-surface p-3"
                  >
                    <ColourField
                      colors={colors}
                      colourKey={key}
                      role={row.role}
                      previewer={previewer}
                      onCommit={(next) => edit.set(next, card.origin)}
                      onAdjust={(next, field) => edit.adjust(next, card.origin, field)}
                      onSettle={edit.settle}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        // «Tu paleta» before it has colours: the brand's colour, and the rest derived from it.
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 text-[12px] leading-snug">
            <span
              aria-hidden="true"
              className="h-[17px] w-[17px] shrink-0 rounded-full border border-ui-border-strong border-dashed bg-ui-surface"
            />
            <span className="flex-1 font-semibold text-ui-ink">
              {es["editor.style.role.brand"]}
            </span>
            <span className="text-ui-muted">{es["editor.style.ownEmpty"]}</span>
          </div>
          {edit ? (
            <BrandField
              onAccept={(brand) => edit.set(derivePalette({ brand }).colors, card.origin)}
            />
          ) : null}
        </div>
      )}
      {card.customised && card.restore ? (
        <button
          type="button"
          onClick={card.restore}
          className="ui-interactive h-8 cursor-pointer self-start rounded-ui-sm border border-ui-border bg-ui-surface px-3 text-[13px] font-semibold text-ui-ink hover:border-ui-border-strong"
        >
          {es["editor.style.restore"]}
        </button>
      ) : null}
    </fieldset>
  );
}
