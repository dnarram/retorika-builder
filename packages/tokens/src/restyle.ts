import { type Theme, TOKEN_KEYS } from "@retorika/schema";
import { type ColorKey, PALETTES, type Palette } from "./palettes.ts";
import type { RadiusKey, Scale, SizeKey, SpaceKey } from "./scales.ts";
import { SCALES } from "./scales.ts";
import { type FontKey, TYPE_PAIRS, type TypePair } from "./typography.ts";

/**
 * Editing a theme that already exists, which is what the Estilo panel does — as opposed to
 * `buildTheme`, which assembles one from nothing.
 *
 * The difference matters more than it looks. `buildTheme({paletteId, typePairId})` would work
 * for a palette change too, and it would **silently reset the scale**: sizes, spaces and radii
 * would snap back to `DEFAULT_SCALE_ID` whatever the document was carrying. **Sprint 9 is when
 * that stopped being a hypothetical** — until it there was one scale, so the reset could only ever
 * write back the values it overwrote. There are three now, and `withScale` joins the other two
 * verbs here for the same reason they exist: replacing only the keys the choice is about cannot
 * have that problem, and it composes — change the palette, then the typeface, then the scale, and
 * all three survive.
 *
 * All three return a complete theme by construction: nineteen keys in, the same nineteen out, with
 * a subset given new values.
 */

/** The colour keys of the namespace, derived rather than listed again. */
const COLOR_KEYS: readonly ColorKey[] = TOKEN_KEYS.filter((key): key is ColorKey =>
  key.startsWith("color."),
);

const FONT_KEYS: readonly FontKey[] = TOKEN_KEYS.filter((key): key is FontKey =>
  key.startsWith("font."),
);

const SIZE_KEYS: readonly SizeKey[] = TOKEN_KEYS.filter((key): key is SizeKey =>
  key.startsWith("size."),
);

const SPACE_KEYS: readonly SpaceKey[] = TOKEN_KEYS.filter((key): key is SpaceKey =>
  key.startsWith("space."),
);

const RADIUS_KEYS: readonly RadiusKey[] = TOKEN_KEYS.filter((key): key is RadiusKey =>
  key.startsWith("radius."),
);

/**
 * The five colours a palette actually paints with, in the order a swatch row reads best: the two
 * strong ones, the mid grey, then the page and the text.
 *
 * **`color.accent` is deliberately not here, and that is a claim about the code rather than a
 * preference.** No rule the renderer emits references `var(--color-accent)` — every palette
 * declares it, the theme block emits it as a custom property because a theme is total, and
 * nothing consumes it. It is also the one colour whose contrast is asserted nowhere: the five
 * pairs in `contrast.test.ts` are ink, primary, secondary and muted against surface, plus
 * surface against primary. Accent appears in none of them, and it would fail one — in
 * `classic-blue` it is 3.19:1 on surface, under AA.
 *
 * So showing it as a swatch would be advertising a colour that appears nowhere on the page and
 * carries no guarantee. Mockup 13 draws five circles per palette; this is five, honestly.
 */
export const RENDERED_COLOR_KEYS: readonly ColorKey[] = [
  "color.primary",
  "color.secondary",
  "color.muted",
  "color.surface",
  "color.ink",
];

function paletteById(paletteId: string): Palette {
  const palette = PALETTES.find((p) => p.id === paletteId);
  if (!palette) {
    throw new Error(
      `Unknown paletteId "${paletteId}". Known: ${PALETTES.map((p) => p.id).join(", ")}`,
    );
  }
  return palette;
}

function typePairById(typePairId: string): TypePair {
  const typePair = TYPE_PAIRS.find((t) => t.id === typePairId);
  if (!typePair) {
    throw new Error(
      `Unknown typePairId "${typePairId}". Known: ${TYPE_PAIRS.map((t) => t.id).join(", ")}`,
    );
  }
  return typePair;
}

function scaleById(scaleId: string): Scale {
  const scale = SCALES.find((s) => s.id === scaleId);
  if (!scale) {
    throw new Error(`Unknown scaleId "${scaleId}". Known: ${SCALES.map((s) => s.id).join(", ")}`);
  }
  return scale;
}

/** The same theme with this palette's six colours in place of its own. */
export function withPalette(theme: Theme, paletteId: string): Theme {
  return { ...theme, ...paletteById(paletteId).colors };
}

/** The same theme with this pair's two typefaces in place of its own. */
export function withTypePair(theme: Theme, typePairId: string): Theme {
  return { ...theme, ...typePairById(typePairId).fonts };
}

/**
 * The same theme with this scale's eleven sizes, spaces and radii in place of its own.
 *
 * Eleven and not three: «el sistema» is the whole set, which is the point of the dossier §6's
 * «Escala tipográfica, espaciados, radios y sombras **como sistema**». Changing the type sizes
 * without the spacing that surrounds them is how a page ends up with big headings in small boxes.
 */
export function withScale(theme: Theme, scaleId: string): Theme {
  const scale = scaleById(scaleId);
  return { ...theme, ...scale.sizes, ...scale.spaces, ...scale.radii };
}

/**
 * Which palette produced this theme's colours, or `undefined` if none did.
 *
 * A theme keeps values, not identities: `buildTheme` flattens a palette into nineteen strings and
 * leaves no record of where they came from, and `themeSchema` is a total `z.strictObject`, so
 * adding a `paletteId` would be a schema change and a migration to store something the values
 * already determine. So the panel asks this instead, and it is deterministic: an exact match on
 * every colour key or no match at all.
 *
 * **All six colours are compared, `color.accent` included**, even though nothing renders it. The
 * question here is "did this palette write these values", and a match on five of six would answer
 * yes about a theme this palette did not produce.
 *
 * `undefined` is a real answer and not a failure. Everything the generator produces comes from
 * `themeFor(sector)`, so a freshly made site always matches; a document restored from a browser
 * whose palette values have since changed, or one assembled by hand, need not. The panel shows
 * nothing selected and says so, rather than highlighting a palette the site is not using.
 */
export function identifyPalette(theme: Theme): Palette | undefined {
  return PALETTES.find((palette) => COLOR_KEYS.every((key) => theme[key] === palette.colors[key]));
}

/** Which type pair produced this theme's two font stacks, or `undefined` if none did. */
export function identifyTypePair(theme: Theme): TypePair | undefined {
  return TYPE_PAIRS.find((pair) => FONT_KEYS.every((key) => theme[key] === pair.fonts[key]));
}

/**
 * Which scale produced this theme's eleven sizes, spaces and radii, or `undefined` if none did.
 *
 * All eleven are compared, for the reason `identifyPalette` gives about its sixth colour: the
 * question is "did this scale write these values", and a match on ten of eleven answers yes about
 * a scale this theme did not come from. It matters more here than there, because the three scales
 * differ in every one of the eleven — a partial match means somebody has been editing values by
 * hand, which is exactly the state the panel must show as "ninguna" rather than guess at.
 */
export function identifyScale(theme: Theme): Scale | undefined {
  return SCALES.find(
    (scale) =>
      SIZE_KEYS.every((key) => theme[key] === scale.sizes[key]) &&
      SPACE_KEYS.every((key) => theme[key] === scale.spaces[key]) &&
      RADIUS_KEYS.every((key) => theme[key] === scale.radii[key]),
  );
}
