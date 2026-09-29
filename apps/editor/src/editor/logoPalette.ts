import { PALETTES } from "@retorika/tokens";

/**
 * The palette a logo chooses, or nothing.
 *
 * The questionnaire has promised «De sus colores sacamos los de toda la web» since the first
 * sprint, and `packages/generator/src/theme.ts` has said in its own comment that the logo «is
 * captured by the questionnaire but never analysed». This is the day those two sentences stop
 * contradicting each other.
 *
 * **It chooses among the four palettes that already exist, and never invents one.** The same
 * reasoning that rejected an exact colour picker: a palette whose contrast has not been tested is
 * not something this product publishes, and `packages/tokens/src/contrast.ts` tests these four.
 * So a logo can pick, never mix.
 *
 * **Pure, and it runs in the browser.** The analysis happens during the questionnaire and what
 * travels onward is the *chosen palette id*, saved as one more answer — never the logo, never a
 * colour. The generator receives a string and stays what it has always been: a pure function of
 * its arguments, no clock, no randomness, no file read. `INV_5`, the golden corpus and «mismas
 * respuestas, misma web» all rest on that, and none of them move because of this.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Below this alpha a pixel is not really there. A logo is very often a PNG on transparency, and
 * the transparent field is the majority of its pixels — counting them would make every such logo
 * choose whatever the browser left underneath.
 */
const MIN_ALPHA = 128;

/**
 * Near-white and near-black are thrown away before anything is counted.
 *
 * They are almost always the background or the lettering rather than the brand's colour: a logo on
 * a white card, a black wordmark, the dark outline around a shape. Keeping them would mean most
 * logos resolve to "white" or "black", neither of which is a palette, and a grey average of a
 * whole image is the classic way to turn every brand into the same mud.
 *
 * Their consequence is deliberate and worth naming: **a logo that is genuinely only black and
 * white chooses nothing**, and the sector's palette stands. That is the honest answer — there is no
 * colour in it to take.
 */
const NEAR_WHITE = 240;
const NEAR_BLACK = 32;

/**
 * How far a logo's colour may sit from a palette's own and still be called that palette, as a
 * CIE76 ΔE in Lab.
 *
 * ΔE is roughly "how different two colours look", normalised so that about 2.3 is the smallest
 * difference a person can see at all. This number is far larger than that on purpose: the question
 * is not «is this the same colour» but «is this recognisably the same family», because what the
 * owner gets is a whole site in that palette, not a swatch held up beside their logo.
 *
 * **40, and it was measured rather than chosen.** Every distance below was computed against the
 * four palettes' primaries before the number was picked:
 *
 * | logo | nearest | ΔE |
 * | --- | --- | --- |
 * | sky blue `#38BDF8` | dark-slate | 0.0 |
 * | blue `#2563EB` | classic-blue | 9.2 |
 * | green `#059669` | forest-emerald | 13.7 |
 * | rust `#B45309` | warm-terracotta | 16.8 |
 * | teal `#0D9488` | forest-emerald | 17.1 |
 * | purple `#7C3AED` | classic-blue | 28.7 |
 * | red `#DC2626` | warm-terracotta | 28.7 |
 * | orange `#EA580C` | warm-terracotta | 32.5 |
 * | — threshold — | | **40** |
 * | pink `#DB2777` | warm-terracotta | 52.4 |
 * | yellow `#EAB308` | warm-terracotta | 62.8 |
 * | pale yellow `#FDE047` | warm-terracotta | 77.5 |
 *
 * The convincing matches stop at 32.5 and the stretches start at 52.4, so 40 sits in a real gap
 * rather than in the middle of a crowd. That is what makes it a number instead of a taste.
 *
 * **The purple case did not come out the way it was expected to, and the threshold was not bent to
 * make it.** It was set to check that a purple logo and a yellow one both fall outside; yellow
 * does, and purple does not — it lands on classic-blue at exactly the distance red lands on
 * warm-terracotta, which is a match nobody would argue with. Putting purple outside would mean a
 * threshold under 28.7, which would throw out red and orange too. Purple is near blue, and the
 * measurement says so.
 *
 * `test/logoPalette.test.ts` pins every row of that table, so moving this number has to be a
 * decision rather than a drift.
 */
const MAX_DISTANCE = 40;

/** How coarsely pixels are grouped before the most populous group wins: 32 levels per channel.
 * Fine enough to keep two different brand colours apart, coarse enough that the anti-aliased
 * fringe of a shape counts as the shape rather than as dozens of distinct near-misses. */
const BUCKET = 8;

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB to CIELAB, through XYZ under D65 — the standard chain, written out because it is four
 * lines and a dependency that ships colour maths would be a dependency to review. */
function toLab({ r, g, b }: Rgb): [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = (lr * 0.2126 + lg * 0.7152 + lb * 0.0722) / 1.0;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;

  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76: the straight distance between two colours in Lab. Enough for "same family or not",
 * which is the only question asked here; ΔE2000 buys precision this decision cannot use. */
export function colourDistance(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

export function parseHex(hex: string): Rgb {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/**
 * The one colour that best stands for an image, or `null` when it has none worth taking.
 *
 * Most populous bucket rather than average: averaging a two-colour logo gives a colour that is in
 * neither of them, and averaging any logo at all tends towards grey. The winning bucket's own
 * pixels are then averaged, so the answer is a real colour from the image rather than the corner
 * of a cube.
 *
 * `pixels` is RGBA, four bytes per pixel — exactly what a canvas `getImageData` returns, so the
 * caller does nothing but decode and hand it over.
 */
export function dominantColour(pixels: Uint8ClampedArray): Rgb | null {
  const counts = new Map<number, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const alpha = pixels[i + 3] ?? 0;

    if (alpha < MIN_ALPHA) continue;
    if (r >= NEAR_WHITE && g >= NEAR_WHITE && b >= NEAR_WHITE) continue;
    if (r <= NEAR_BLACK && g <= NEAR_BLACK && b <= NEAR_BLACK) continue;

    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const bucket = counts.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    counts.set(key, bucket);
  }

  let best: { count: number; r: number; g: number; b: number } | undefined;
  let bestKey = Number.POSITIVE_INFINITY;
  for (const [key, bucket] of counts) {
    // Ties break on the lower key, so the answer never depends on `Map` insertion order — which
    // depends on the order pixels happen to appear in. Same reason the renderer sorts its output.
    if (!best || bucket.count > best.count || (bucket.count === best.count && key < bestKey)) {
      best = bucket;
      bestKey = key;
    }
  }
  if (!best) return null;

  return {
    r: Math.round(best.r / best.count),
    g: Math.round(best.g / best.count),
    b: Math.round(best.b / best.count),
  };
}

export interface PaletteMatch {
  paletteId: string;
  /** The ΔE between the logo's colour and that palette's own primary, for tests and for anyone
   * wondering how close "close" was. */
  distance: number;
}

/**
 * The palette nearest a colour, or `null` when none is near enough.
 *
 * Compared against each palette's `color.primary` and nothing else: that is the colour a generated
 * site is actually full of — the headings, the button, the rules — so it is the one an owner would
 * hold their logo up against. Matching on the accent instead would pick a palette by a colour that
 * appears three times on the page.
 *
 * `null` is a real answer, not a failure. ADR 0010 already says «sin logo, la paleta por defecto
 * del sector», and a logo whose colour no palette shares is the same situation arriving by a
 * different road — the sector decides, and nothing tells the owner their logo chose it.
 */
export function nearestPalette(colour: Rgb): PaletteMatch | null {
  let best: PaletteMatch | null = null;
  for (const palette of PALETTES) {
    const distance = colourDistance(colour, parseHex(palette.colors["color.primary"]));
    // Strictly nearer, so a tie keeps the earlier palette and the answer does not depend on the
    // order `PALETTES` happens to be written in changing under it.
    if (!best || distance < best.distance) best = { paletteId: palette.id, distance };
  }
  if (!best || best.distance > MAX_DISTANCE) return null;
  return best;
}

/**
 * A logo's pixels to the palette id it chooses, or `null` for "let the sector decide".
 *
 * The whole feature in one function, so the questionnaire does nothing but decode an image and
 * store a string.
 */
export function paletteForLogo(pixels: Uint8ClampedArray): string | null {
  const colour = dominantColour(pixels);
  if (!colour) return null;
  return nearestPalette(colour)?.paletteId ?? null;
}
