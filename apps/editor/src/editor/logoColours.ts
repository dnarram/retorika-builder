import type { LogoColours } from "@retorika/generator";
import type { RetorikaDocument, Theme } from "@retorika/schema";
import {
  derivePalette,
  PALETTES,
  type PaletteColors,
  STARTING_PALETTE_ID,
  withoutFill,
} from "@retorika/tokens";

/**
 * **The logo's colours in the editor** (sprint 38 día 3, ADR 0076): when a logo uploaded after the
 * site was generated repaints it, when it only offers itself, and what «De tu logo» in «Estilo» writes.
 *
 * Pure, so the rule is asserted rather than walked: the document and the colours go in, a decision
 * comes out. The canvas that reads the colours from the bytes is `logoImage.ts`; the arithmetic that
 * builds a palette from them is `@retorika/tokens`' `derivePalette`.
 */

const COLOUR_KEYS = [
  "color.primary",
  "color.secondary",
  "color.accent",
  "color.surface",
  "color.ink",
  "color.muted",
  "color.fill",
  "color.onFill",
] as const;

const NEUTRAL = PALETTES.find((palette) => palette.id === STARTING_PALETTE_ID)?.colors;

/**
 * **The untouched start** (David's adjustment 1 approving the plan): no origin recorded **and** the
 * neutral palette's colours, exactly, with no fill of their own. The generator writes no origin for a
 * site without a logo (ADR 0075 §2), and «Neutra» chosen in «Estilo» writes `{kind: "palette", id:
 * "neutral"}` — so a site whose owner chose the neutral palette on purpose is not this, whatever its
 * colours. A site saved before 1.20.0 with «Neutra» chosen by hand has no origin and reads as untouched:
 * the known limit ADR 0075 writes down.
 */
export function isUntouchedStart(doc: RetorikaDocument): boolean {
  if (doc.palette !== undefined || !NEUTRAL) return false;
  return COLOUR_KEYS.every((key) => doc.theme[key] === (NEUTRAL as PaletteColors)[key]);
}

/** The two palettes a logo's colours make: on the light surface (the default) and on the dark one,
 * the owner's alternative («De tu logo, oscura»). */
export interface LogoPalettes {
  light: PaletteColors;
  dark: PaletteColors;
  /** Whether the light palette writes its text in a darker sibling of the brand's colour. */
  darkerForText: boolean;
}

export function logoPalettesFor(colours: LogoColours): LogoPalettes {
  const light = derivePalette({ brand: colours.brand, second: colours.second });
  const dark = derivePalette({ brand: colours.brand, second: colours.second, surface: "dark" });
  return { light: light.colors, dark: dark.colors, darkerForText: light.siblings.primary };
}

/** The theme with these colours in place of its own: the six, and the fill pair when the palette has
 * one — and no left-over pair of a palette before it when it has none. Fonts and scale stay. */
export function withLogoColours(theme: Theme, colors: PaletteColors): Theme {
  return { ...withoutFill(theme), ...colors } as Theme;
}

/** Whether the theme's colours are exactly this palette's, the fill pair included. */
export function sameColours(theme: Theme, colors: PaletteColors): boolean {
  return COLOUR_KEYS.every((key) => theme[key] === colors[key]);
}

/**
 * **The offer, derived from the document** (sprint 38 día 3): the help line says once, in its quiet
 * voice and with a cross, that the logo's colours are in «Estilo» — for a site that has a logo whose
 * colours were read, and does not wear them: an owner who chose a palette before uploading their logo,
 * and every site saved before today with a logo and the colours of a palette it was matched to. Never
 * once the owner took them, and never again in this browser once the cross or «De tu logo» answered it.
 */
export function logoOfferFor(
  doc: RetorikaDocument,
  colours: LogoColours | null,
  dismissed: boolean,
): boolean {
  if (dismissed || colours === null) return false;
  if (doc.header?.brand?.logo === undefined) return false;
  if (doc.palette?.kind === "logo") return false;
  const { light, dark } = logoPalettesFor(colours);
  return !sameColours(doc.theme, light) && !sameColours(doc.theme, dark);
}

const OFFER_STORAGE = "retorika.logoOffer.v1";

/** Whether the offer was answered in this browser. A browser that refuses to keep the answer simply
 * offers again next time: one sentence, the honest consequence of being refused (the rail's offer's
 * rule, sprint 37 día 6). */
export function loadLogoOfferDismissed(): boolean {
  try {
    return globalThis.localStorage.getItem(OFFER_STORAGE) === "1";
  } catch {
    return false;
  }
}

export function saveLogoOfferDismissed(): boolean {
  try {
    globalThis.localStorage.setItem(OFFER_STORAGE, "1");
    return true;
  } catch {
    return false;
  }
}
