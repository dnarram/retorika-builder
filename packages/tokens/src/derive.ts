import type { FillKey, PaletteOrigin, Theme } from "@retorika/schema";
import {
  AA_NORMAL_TEXT,
  CONTRAST_PAIRS,
  contrastRatio,
  mixHex,
  type PairKey,
  resolveFill,
} from "./contrast.ts";
import { hexToOklch, maxChroma, type Oklch, oklchToHex } from "./oklch.ts";
import type { ColorKey, Palette } from "./palettes.ts";
import { PALETTES } from "./palettes.ts";
import { identifyPalette } from "./restyle.ts";

/**
 * A palette derived from a brand's colour (sprint 38 día 2, ADR 0074 and ADR 0076).
 *
 * **The brand's colour stays exact and changes its role.** It is the fill wherever something is
 * filled — the button, a bar in the primary, the favicon's disc — with the ink on it chosen so it
 * reads; the text role (`color.primary`) is the same colour when it reads on the surface and, when it
 * does not, a sibling of the same hue and chroma moved in lightness the minimum that reads. David's
 * rule of 16 November 2026, over darkening the colour everywhere or turning the page dark: those two
 * stay what the owner can choose («De tu logo, oscura» is the second surface here), never the default.
 *
 * **Every palette this produces clears what every predefined palette clears**, measured the same way:
 * the eight `CONTRAST_PAIRS` at 4.5:1 with the fill pair resolved, and the glass bar's four pairs over
 * black and over white. `derivePalette` asserts it and throws rather than return a palette that does
 * not — a `derive.test.ts` sweep of the whole wheel, both surfaces, is what says it never does.
 *
 * **Pure and deterministic**: no clock, no randomness, whole hex bytes, so the generator stays a pure
 * function of its answers and the fixture `logo-amarillo` is this function's witness byte for byte.
 */

/** The six colours of a palette, and the fill pair when the palette needs one (ADR 0074). */
export type PaletteColors = Record<ColorKey, string> & { [K in FillKey]?: string };

export interface DeriveInput {
  /** The brand's colour: the logo's dominant tint, or the one the owner typed. `#rrggbb`. */
  brand: string;
  /** A second tint of the logo, when it has one that is really a second colour; `null` otherwise. */
  second?: string | null;
  /** The page's surface: light (the default) or dark, the owner's alternative. */
  surface?: "light" | "dark";
}

export interface DerivedPalette {
  colors: PaletteColors;
  /** Which text roles had to move from the colour they came from to be read on the surface. */
  siblings: { primary: boolean; secondary: boolean };
}

/**
 * The surface's share of a fixed bar's colour once scrolled (ADR 0063): the renderer writes it in
 * `header.ts` and cannot import this package, so the number lives twice and `glass.test.ts` holds the
 * two equal. A derived palette is proved on the same glass as a predefined one.
 */
export const GLASS_MIX = 0.88;

/** What a derived surface, ink and muted are made of, per surface: lightness and chroma in OKLCH,
 * the hue being the brand's. Measured against the five predefined palettes: `#FAFAF9` is L 0.985,
 * `#0F172A` L 0.22, `#475569` L 0.47, `#94A3B8` L 0.72. */
const LIGHT = { surface: [0.985, 0.006], ink: [0.22, 0.03], muted: [0.47, 0.03] } as const;
const DARK = { surface: [0.22, 0.03], ink: [0.975, 0.006], muted: [0.72, 0.03] } as const;

/** Below this chroma a brand's colour is a grey, and the tints it lends the surface and the ink are
 * grey too: a tint with a hue nobody can see is a hue picked at random. */
const GREY_CHROMA = 0.02;

/** How far the secondary sits from the primary in lightness when the logo has no second tint. */
const SECONDARY_STEP = 0.1;

/** The accent's hue offset from the brand's when the logo gives none: a near-complement. */
const ACCENT_TURN = 150;

/**
 * The lightness a colour has to be moved to for `ratio` against `against`, by bisection between
 * `from` and `to`, keeping hue and chroma — brought into gamut at every step, so a saturated colour
 * loses chroma rather than lightness on the way. Returns the first hex that clears the ratio, or
 * `undefined` if none between the two does.
 */
function lightnessFor(
  colour: Oklch,
  against: string,
  ratio: number,
  from: number,
  to: number,
): string | undefined {
  const clears = (L: number) => contrastRatio(oklchToHex({ ...colour, L }), against) >= ratio;
  if (!clears(to)) return undefined;
  if (clears(from)) return oklchToHex({ ...colour, L: from });
  let fail = from;
  let pass = to;
  for (let i = 0; i < 30; i += 1) {
    const mid = (fail + pass) / 2;
    if (clears(mid)) pass = mid;
    else fail = mid;
  }
  // Hex rounds; the lightness that cleared may round to one that does not, so the last step walks.
  let hex = oklchToHex({ ...colour, L: pass });
  for (let L = pass; contrastRatio(hex, against) < ratio && L <= to; L += 0.001) {
    hex = oklchToHex({ ...colour, L });
  }
  return hex;
}

/** The colour as text on `surface`: itself if it reads, else its sibling moved towards `ink`'s side. */
function textOn(hex: string, surface: string, dark: boolean): { hex: string; moved: boolean } {
  if (contrastRatio(hex, surface) >= AA_NORMAL_TEXT) return { hex, moved: false };
  const colour = hexToOklch(hex);
  const moved = dark
    ? lightnessFor(colour, surface, AA_NORMAL_TEXT, colour.L, 1)
    : lightnessFor(colour, surface, AA_NORMAL_TEXT, colour.L, 0);
  if (moved === undefined) {
    // Not reachable: lightness 0 and 1 clear 4.5 against any surface this file makes (its surfaces
    // are at L 0.985 and 0.22). Said rather than silently returning the unreadable colour.
    throw new Error(`No lightness of ${hex} reads on ${surface}`);
  }
  return { hex: moved, moved: true };
}

/**
 * The ink drawn on a fill: of the palette's surface and ink, the one with more contrast if it clears
 * AA; otherwise pure black or white, the one with more — one of the two clears 4.585 on any colour.
 */
export function inkOn(fill: string, surface: string, ink: string): string {
  const own = [surface, ink].sort((a, b) => contrastRatio(b, fill) - contrastRatio(a, fill))[0];
  if (own !== undefined && contrastRatio(own, fill) >= AA_NORMAL_TEXT) return own;
  return contrastRatio("#000000", fill) >= contrastRatio("#FFFFFF", fill) ? "#000000" : "#FFFFFF";
}

export function derivePalette(input: DeriveInput): DerivedPalette {
  const dark = input.surface === "dark";
  const brand = hexToOklch(input.brand);
  const tintChroma = (wanted: number) => (brand.C < GREY_CHROMA ? 0 : wanted);
  const tinted = (shape: readonly [number, number]) =>
    oklchToHex({ L: shape[0], C: tintChroma(shape[1]), h: brand.h });

  const shapes = dark ? DARK : LIGHT;
  const surface = tinted(shapes.surface);
  const ink = tinted(shapes.ink);
  // The mid grey reads on the surface by construction at its shape's lightness; moved towards the ink
  // if a tint ever puts it under, so the claim holds for every hue rather than most.
  const mutedShape: Oklch = { L: shapes.muted[0], C: tintChroma(shapes.muted[1]), h: brand.h };
  const muted =
    (dark
      ? lightnessFor(mutedShape, surface, AA_NORMAL_TEXT, mutedShape.L, 1)
      : lightnessFor(mutedShape, surface, AA_NORMAL_TEXT, mutedShape.L, 0)) ??
    oklchToHex(mutedShape);

  const primary = textOn(input.brand, surface, dark);

  const second = input.second ?? null;
  const secondary = second
    ? textOn(second, surface, dark)
    : {
        hex: oklchToHex({
          ...hexToOklch(primary.hex),
          L: Math.max(
            0.05,
            Math.min(0.95, hexToOklch(primary.hex).L + (dark ? 1 : -1) * SECONDARY_STEP),
          ),
        }),
        moved: false,
      };
  // A sibling a tenth away from a primary that reads is further from the surface than the primary,
  // so it reads too; said by measuring rather than trusting, because the gamut can take chroma away.
  const secondaryHex =
    contrastRatio(secondary.hex, surface) >= AA_NORMAL_TEXT
      ? secondary.hex
      : textOn(secondary.hex, surface, dark).hex;

  const accent = second ?? oklchToHex({ ...brand, h: (brand.h + ACCENT_TURN) % 360 });

  const colors: PaletteColors = {
    "color.primary": primary.hex,
    "color.secondary": secondaryHex,
    "color.accent": accent,
    "color.surface": surface,
    "color.ink": ink,
    "color.muted": muted,
  };
  // The fill is the brand's colour, exact, and the pair is written only when it differs from what the
  // theme already says (ADR 0074 §2): a brand that reads as text fills with itself under the surface
  // and needs no pair, like every predefined palette.
  const fill = input.brand;
  const onFill = inkOn(fill, surface, ink);
  if (fill !== primary.hex || onFill !== surface) {
    colors["color.fill"] = fill;
    colors["color.onFill"] = onFill;
  }

  const failing = validateTheme(colors);
  if (failing.length > 0) {
    throw new Error(
      `derivePalette(${JSON.stringify(input)}) made an unreadable palette: ${failing
        .map((f) => `${f.fg} on ${f.bg}${f.under ? ` over ${f.under}` : ""} ${f.ratio.toFixed(2)}`)
        .join(", ")}`,
    );
  }
  return { colors, siblings: { primary: primary.moved, secondary: secondary.moved } };
}

export interface UnreadablePair {
  fg: PairKey;
  bg: PairKey;
  /** For a glass pair, the extreme the glass was mixed over. */
  under?: "#000000" | "#ffffff";
  ratio: number;
}

/**
 * Every pair of this theme that does not clear AA — the eight `CONTRAST_PAIRS` with the fill pair
 * resolved, and the glass bar's ink on surface and surface on ink at `GLASS_MIX` over black and over
 * white, which is what `glass.test.ts` holds every predefined palette to. Empty means readable.
 * The ratios travel with the pairs so a panel can say «Sobre el fondo: 3,1; necesita 4,5».
 */
export function validateTheme(theme: PaletteColors): UnreadablePair[] {
  const colors = resolveFill(theme);
  const out: UnreadablePair[] = [];
  for (const pair of CONTRAST_PAIRS) {
    const ratio = contrastRatio(colors[pair.fg], colors[pair.bg]);
    if (ratio < AA_NORMAL_TEXT) out.push({ fg: pair.fg, bg: pair.bg, ratio });
  }
  for (const [fg, bg] of [
    ["color.ink", "color.surface"],
    ["color.surface", "color.ink"],
  ] as const) {
    for (const under of ["#000000", "#ffffff"] as const) {
      const ratio = contrastRatio(colors[fg], mixHex(colors[bg], under, GLASS_MIX));
      if (ratio < AA_NORMAL_TEXT) out.push({ fg, bg, under, ratio });
    }
  }
  return out;
}

export type LegibleAxis = "lightness" | "hue";

/** How many steps each axis of a colour field has: lightness in hundredths, hue in fives of a degree. */
export const LEGIBLE_STEPS: Record<LegibleAxis, number> = { lightness: 101, hue: 72 };

export interface LegibleSteps {
  axis: LegibleAxis;
  /** The value of each step: lightness 0…1, or hue 0…355. */
  values: number[];
  /** Whether the colour at that step keeps every pair it is part of readable. */
  valid: boolean[];
  /** The step nearest the colour's own value. */
  at: number;
}

/**
 * Which steps of a colour's lightness or hue keep the theme readable, for the colour field's sliders
 * (sprint 38 día 7, David's P6): what the track paints as unreachable and what the arrows skip. Only
 * the pairs this colour is part of are judged — another colour's failure is that slider's, not this
 * one's. Editing the fill judges the fill with its ink recomputed, since the ink is never edited; the
 * accent is part of no pair and every step is valid, honestly.
 */
export function legibleSteps(
  theme: PaletteColors,
  key: ColorKey | "color.fill",
  axis: LegibleAxis,
): LegibleSteps {
  const own = hexToOklch(key === "color.fill" ? resolveFill(theme)["color.fill"] : theme[key]);
  const count = LEGIBLE_STEPS[axis];
  const values = Array.from({ length: count }, (_, i) => (axis === "lightness" ? i / 100 : i * 5));
  const at = axis === "lightness" ? Math.round(own.L * 100) : Math.round(own.h / 5) % 72;
  const valid = values.map((value) => {
    const candidate = oklchToHex(
      axis === "lightness" ? { ...own, L: value } : { ...own, h: value },
    );
    const next: PaletteColors = { ...theme };
    if (key === "color.fill") {
      next["color.fill"] = candidate;
      next["color.onFill"] = inkOn(candidate, theme["color.surface"], theme["color.ink"]);
    } else {
      next[key] = candidate;
    }
    const involved = key === "color.fill" ? ["color.fill", "color.onFill"] : [key];
    return validateTheme(next).every(
      (pair) => !involved.includes(pair.fg) && !involved.includes(pair.bg),
    );
  });
  return { axis, values, valid, at };
}

/** The chroma the colour field may offer at a lightness and hue: what the screen can show. */
export { maxChroma };

export type PaletteLabel =
  | { kind: "palette"; palette: Palette; customised: boolean }
  | { kind: "logo"; customised: boolean }
  | { kind: "own" }
  | { kind: "none" };

/**
 * What the owner is told their colours are, computed and never stored (ADR 0075): the origin says
 * where they came from, the values say whether they still are that. A theme with a `palette` origin
 * whose six colours (and fill pair, which no predefined palette has) are the catalog's is that palette;
 * with any of them moved it is «{nombre}, personalizada». A `logo` origin is «De tu logo», customised
 * only when the logo's own derivation is known and differs. No origin reads as before 1.20.0: the
 * palette the values match exactly, or none.
 */
export function paletteLabel(
  theme: Theme,
  origin: PaletteOrigin | undefined,
  fromLogo?: PaletteColors | null,
): PaletteLabel {
  const keys: (ColorKey | FillKey)[] = [
    "color.primary",
    "color.secondary",
    "color.accent",
    "color.surface",
    "color.ink",
    "color.muted",
    "color.fill",
    "color.onFill",
  ];
  const same = (colors: PaletteColors) => keys.every((key) => theme[key] === colors[key]);
  if (origin?.kind === "palette") {
    const palette = PALETTES.find((candidate) => candidate.id === origin.id);
    if (!palette) return { kind: "none" };
    return { kind: "palette", palette, customised: !same(palette.colors) };
  }
  if (origin?.kind === "logo") {
    return { kind: "logo", customised: fromLogo ? !same(fromLogo) : false };
  }
  if (origin?.kind === "own") return { kind: "own" };
  const matched = identifyPalette(theme);
  return matched ? { kind: "palette", palette: matched, customised: false } : { kind: "none" };
}
