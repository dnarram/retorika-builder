import { hexToOklch, PALETTES } from "@retorika/tokens";

/**
 * The colours of a logo, read from its pixels — and which predefined palette they resemble.
 *
 * **What it used to be, and why it changed.** Since sprint 6 this module picked a palette: the logo's
 * dominant colour was compared with the palettes' primaries and the nearest within ΔE 40 became
 * the site's palette, or the site started neutral. David, 16 November 2026: «los colores del logo SON
 * los colores de marca del usuario, y la web generada tiene que llevarlos siempre que haya un logo».
 * So from sprint 38 día 3 (ADR 0076) this reads the logo's tints (`dominantColours`) and
 * `@retorika/tokens`' `derivePalette` builds the site's palette from them, every pair proved;
 * `nearestPalette` stays as information only.
 *
 * **Pure, and it runs in the browser.** The analysis happens during the questionnaire and what
 * travels onward is two hex strings, saved as one more answer — never the logo itself. The generator
 * stays a pure function of its arguments: no clock, no randomness, no file read. `INV_5`, the golden
 * corpus and «mismas respuestas, misma web» all rest on that.
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
 * white gives no colour**, and the site starts neutral. That is the honest answer — there is no
 * colour in it to take — and question 1 says so.
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
 * **40, measured twice.** It was chosen in sprint 6 against the four palettes then, when it decided
 * the site's palette, from a table where the convincing matches stopped at 32.5 and the stretches
 * started at 52.4 — a real gap. Since sprint 38 día 3 (ADR 0076) it decides nothing: it only gates
 * «Se parece a «{nombre}»», information beside the logo's own colours. **Measured again on sprint 38
 * día 4 against the twelve palettes a logo can resemble** (all but the neutral start):
 *
 * | logo | nearest | ΔE |
 * | --- | --- | --- |
 * | sky blue `#38BDF8` | dark-slate | 0.0 |
 * | purple `#7C3AED` | lavender | 6.2 |
 * | pale yellow `#FDE047` | midnight-gold | 9.1 |
 * | blue `#2563EB` | classic-blue | 9.2 |
 * | green `#059669` | forest-emerald | 13.7 |
 * | yellow `#EAB308` | midnight-gold | 15.1 |
 * | rust `#B45309` | warm-terracotta | 16.8 |
 * | teal `#0D9488` | forest-emerald | 17.1 |
 * | red `#DC2626` | coral-sand | 23.7 |
 * | pink `#DB2777` | coral-sand | 26.5 |
 * | orange `#EA580C` | warm-terracotta | 32.5 |
 * | lime `#84CC16` | olive-sand | 39.0 |
 * | Vodafone red `#E60000` | coral-sand | 39.7 |
 * | — threshold — | | **40** |
 * | postal orange `#FF7900` | warm-terracotta | 43.1 |
 *
 * **The gap narrowed and that is said, not hidden**: from 32.5–52.4 to 39.7–43.1, because eight more
 * palettes leave fewer colours far from all of them. It is kept at 40 because the sentence it gates is
 * information, and every row under it is a resemblance a person would grant — purple to lavender,
 * yellow to gold, lime to olive.
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

/** A bucket of near-identical pixels: how many, and their channel sums, for the average. */
interface Bucket {
  key: number;
  count: number;
  r: number;
  g: number;
  b: number;
}

/** The pixels worth counting, grouped into buckets of 32 levels per channel, most populous first
 * and ties on the lower key — never on `Map` order, which follows the order pixels happen to come. */
function buckets(pixels: Uint8ClampedArray): Bucket[] {
  const counts = new Map<number, Bucket>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const r = pixels[i] ?? 0;
    const g = pixels[i + 1] ?? 0;
    const b = pixels[i + 2] ?? 0;
    const alpha = pixels[i + 3] ?? 0;

    if (alpha < MIN_ALPHA) continue;
    if (r >= NEAR_WHITE && g >= NEAR_WHITE && b >= NEAR_WHITE) continue;
    if (r <= NEAR_BLACK && g <= NEAR_BLACK && b <= NEAR_BLACK) continue;

    const key =
      (Math.floor(r / BUCKET) << 10) | (Math.floor(g / BUCKET) << 5) | Math.floor(b / BUCKET);
    const bucket = counts.get(key) ?? { key, count: 0, r: 0, g: 0, b: 0 };
    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    counts.set(key, bucket);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.key - b.key);
}

function averageOf(bucket: Bucket): Rgb {
  return {
    r: Math.round(bucket.r / bucket.count),
    g: Math.round(bucket.g / bucket.count),
    b: Math.round(bucket.b / bucket.count),
  };
}

/**
 * **The second tint is read by families of hue, not by buckets** (sprint 40 día 3, David's answer to
 * encargo 1).
 *
 * Until today it was the most populous 8-level bucket that held at least a tenth of the counted pixels
 * and stood ΔE 20 from the first. That works for a flat logo and loses the second ink of any logo with
 * a texture, a gradient or a thin stroke: the ink is split across dozens of buckets and none of them
 * reaches a tenth. Measured on David's own logo (navy letters and an orange line, 20 November 2026):
 * the orange was **29.5 % of the counted pixels, in 35 buckets, the largest 8.2 %** — and the site came
 * out navy and brown, the accent turned 150° from the navy. On his flat export, 30.1 % in 46 buckets,
 * the largest 7.0 %. Extraction, not threshold: no share would have kept the orange without also
 * keeping stray pixels.
 *
 * So the pixels with a visible colour (`FAMILY_CHROMA` in OKLCH) are grouped by hue in bands of
 * `FAMILY_BAND` degrees; the band of the first colour and its two neighbours are its own — its fringe,
 * its shading — and the most populous other band holding `SECOND_FAMILY_SHARE` of the counted pixels
 * is the second ink, when its colour stands `SECOND_DISTANCE` from the first. A first colour with no
 * visible hue (a grey) has no band of its own, and every band may be the second.
 *
 * **Its colour is not a mean** (David's condition): it is the most populous bucket inside the family —
 * the flat colour of the stroke — when that bucket holds `FAMILY_BUCKET_MIN` of the family; only a
 * family spread so evenly that no bucket does (a gradient) is read as its mean. The two DNR files: the
 * bucket holds 23–28 % of the orange family and reads `#944C23` in both, at 64, 128, 256 px and at full
 * resolution. Retorika's own mark: its pink holds 16–17 % in its largest bucket and is read as its mean.
 * The table is pinned in `test/logoPalette.test.ts`; the real DNR files are measured only locally
 * (`RETORIKA_BRAND_LOGOS`), never committed.
 */
const SECOND_DISTANCE = 20;
/** At least this share of the counted pixels: Retorika's mark's pink is 9.9 %, its wordmark's 3.3 %
 * (no second tint, the letters dwarf the mark), DNR's orange 29.5–30.1 %. Five sits in the gap. */
const SECOND_FAMILY_SHARE = 0.05;
/** Below this OKLCH chroma a pixel is a grey to the eye, and its hue is noise. */
const FAMILY_CHROMA = 0.04;
/** The width of a hue family, in degrees. */
const FAMILY_BAND = 30;
/** The share of its family a bucket needs to be the family's colour rather than its mean. */
const FAMILY_BUCKET_MIN = 0.2;

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
  return dominantColours(pixels)[0] ?? null;
}

/** The hue band a bucket's colour belongs to, or `null` for a grey (no visible hue). */
function bandOf(colour: Rgb): number | null {
  const { C, h } = hexToOklch(toHex(colour));
  if (C < FAMILY_CHROMA) return null;
  return Math.floor((((h % 360) + 360) % 360) / FAMILY_BAND);
}

const BANDS = 360 / FAMILY_BAND;

/** Whether two bands are the same or neighbours, round the circle. */
function nearBand(a: number, b: number): boolean {
  const apart = Math.abs(a - b) % BANDS;
  return Math.min(apart, BANDS - apart) <= 1;
}

/**
 * The second ink, read by families of hue (see `SECOND_FAMILY_SHARE`): the most populous family other
 * than the first colour's, coloured by its most populous bucket or, spread evenly, by its mean.
 *
 * Grouped by bucket rather than by pixel, so a family's members are buckets that each carry their own
 * hue — the bucket's average — which keeps this a pass over a few hundred buckets rather than four
 * thousand colour conversions. Ties on count fall to the lower band, then to the lower bucket key,
 * never to `Map` order.
 */
function secondInk(sorted: readonly Bucket[], counted: number, firstColour: Rgb): Rgb | null {
  const firstBand = bandOf(firstColour);
  const families = new Map<number, Bucket[]>();
  for (const bucket of sorted) {
    const band = bandOf(averageOf(bucket));
    if (band === null) continue;
    if (firstBand !== null && nearBand(band, firstBand)) continue;
    const family = families.get(band) ?? [];
    family.push(bucket);
    families.set(band, family);
  }
  const ranked = [...families.entries()]
    .map(([band, members]) => ({
      band,
      members,
      count: members.reduce((sum, bucket) => sum + bucket.count, 0),
    }))
    .sort((a, b) => b.count - a.count || a.band - b.band);
  for (const family of ranked) {
    if (family.count < counted * SECOND_FAMILY_SHARE) return null;
    // `sorted` is most populous first, so the family's members are too.
    const top = family.members[0];
    if (!top) continue;
    const colour =
      top.count >= family.count * FAMILY_BUCKET_MIN
        ? averageOf(top)
        : averageOf(
            family.members.reduce(
              (sum, bucket) => ({
                key: sum.key,
                count: sum.count + bucket.count,
                r: sum.r + bucket.r,
                g: sum.g + bucket.g,
                b: sum.b + bucket.b,
              }),
              { key: 0, count: 0, r: 0, g: 0, b: 0 },
            ),
          );
    if (colourDistance(colour, firstColour) >= SECOND_DISTANCE) return colour;
  }
  return null;
}

/**
 * The image's tints, most present first: the dominant colour — the most populous bucket, unchanged —
 * and a second one when the logo really has one, read by families of hue (`secondInk`) — the
 * secondary and the accent of a derived palette (ADR 0076). One entry for a logo of one colour, none
 * for a logo with no colour in it.
 */
export function dominantColours(pixels: Uint8ClampedArray): Rgb[] {
  const sorted = buckets(pixels);
  const first = sorted[0];
  if (!first) return [];
  const counted = sorted.reduce((sum, bucket) => sum + bucket.count, 0);
  const firstColour = averageOf(first);
  const second = secondInk(sorted, counted, firstColour);
  return second ? [firstColour, second] : [firstColour];
}

/** `{r, g, b}` as `#RRGGBB`, the way every palette in `@retorika/tokens` is written. */
export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
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
 * **Information, never a choice** (sprint 38 día 3, ADR 0076). Until then this decided the site's
 * palette: a logo within `MAX_DISTANCE` of a predefined primary got that palette, and one further away
 * got the neutral start — the defect David named, «los colores del logo SON los colores de marca».
 * The site now carries the logo's own colours (`derivePalette`), and this only says which predefined
 * palette they resemble, for «Se parece a «{nombre}»» in question 1 and in «Estilo». `null` is a real
 * answer: no palette is near, and nothing is said.
 */
export function nearestPalette(colour: Rgb): PaletteMatch | null {
  let best: PaletteMatch | null = null;
  // The neutral start is not a colour a logo chooses (ADR 0041): a blue logo lands on
  // `classic-blue`, never on the palette whose blue is Retorika's.
  for (const palette of PALETTES.filter((candidate) => !candidate.starting)) {
    const distance = colourDistance(colour, parseHex(palette.colors["color.primary"]));
    // Strictly nearer, so a tie keeps the earlier palette and the answer does not depend on the
    // order `PALETTES` happens to be written in changing under it.
    if (!best || distance < best.distance) best = { paletteId: palette.id, distance };
  }
  if (!best || best.distance > MAX_DISTANCE) return null;
  return best;
}

/**
 * How light these pixels are on average: the WCAG relative luminance of each visible pixel,
 * weighted by its alpha, from 0 (black) to 1 (white) — or `null` when nothing is visible at all.
 *
 * **Weighted by alpha rather than cut at `MIN_ALPHA`**, unlike `dominantColour`: the question there
 * is which *hue* the brand has, and a translucent fringe would vote for a colour it only half has;
 * the question here is how the mark reads against the bar behind it, and a half-transparent pixel
 * shows half of itself. The transparent field of a PNG logo counts for nothing, which is right —
 * on the bar it is the bar.
 *
 * It is a mean, and a mean is a blunt instrument: a logo of black letters and a white shape
 * averages to grey, which reads against anything. That is why `styleReview.ts` compares it against
 * the 3:1 of WCAG 1.4.11 (graphics) and not the 4.5:1 of text, and warns rather than blocks.
 */
export function meanLuminance(pixels: Uint8ClampedArray): number | null {
  let weighted = 0;
  let weight = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const alpha = (pixels[i + 3] ?? 0) / 255;
    if (alpha === 0) continue;
    const luminance =
      0.2126 * toLinear(pixels[i] ?? 0) +
      0.7152 * toLinear(pixels[i + 1] ?? 0) +
      0.0722 * toLinear(pixels[i + 2] ?? 0);
    weighted += luminance * alpha;
    weight += alpha;
  }
  return weight === 0 ? null : weighted / weight;
}
