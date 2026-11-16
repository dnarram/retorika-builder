/**
 * sRGB ↔ OKLCH, written out (sprint 38 día 2).
 *
 * The engine that derives a palette from a brand's colour moves one thing at a time — the lightness
 * of a colour until it reads, the hue of a tint, the chroma until a colour fits the screen — and it
 * needs a space where those three are separate axes and roughly perceptual. OKLCH is that space:
 * `L` is lightness (0 black, 1 white), `C` chroma (0 grey, ~0.37 the most saturated sRGB can show),
 * `h` hue in degrees. The maths is Björn Ottosson's (2020), four matrix products and a cube root
 * each way, and it is here rather than in a dependency for the reason `logoPalette.ts` gave for its
 * Lab: a colour library that ships is a dependency to review, and this is forty lines.
 *
 * **Everything here is deterministic and lands on whole hex bytes**: the same input is the same
 * `#rrggbb`, which is what the fixtures, the goldens and «mismas respuestas, misma web» rest on.
 */

export interface Oklch {
  /** 0 (black) to 1 (white). */
  L: number;
  /** 0 (grey) upwards; sRGB cannot show much past 0.37. */
  C: number;
  /** Degrees, 0 to 360. */
  h: number;
}

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

/** `#rrggbb` or `#rgb` to three bytes. Throws on anything else: a colour that is not one is a bug. */
export function hexToRgb(hex: string): [number, number, number] {
  const match = HEX.exec(hex);
  if (!match?.[1]) throw new Error(`Not a hex colour: ${JSON.stringify(hex)}`);
  const full = match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** Three bytes to `#RRGGBB`, upper case, as every palette in this package is written. */
export function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
}

function toLinear(byte: number): number {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(c: number): number {
  const clamped = Math.max(0, Math.min(1, c));
  return 255 * (clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055);
}

/** The colour's lightness, chroma and hue. */
export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = hexToRgb(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { L, C: Math.hypot(a, bb), h };
}

/** Linear sRGB of an OKLCH colour, unclamped, so a caller can tell whether it fits the screen. */
function toLinearRgb({ L, C, h }: Oklch): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const bb = C * Math.sin(rad);
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * Float noise only: the matrices round-trip a real `#rrggbb` to within 1e-9. It is not a visual
 * tolerance, and must not be — near black every channel is tiny, and a tolerance of a thousandth
 * there would call a chroma of 0.1 «in gamut» at L 0.02, where the screen can show none at all.
 */
const GAMUT_TOLERANCE = 1e-6;

/** Whether an OKLCH colour can be shown in sRGB without clipping a channel. */
export function inGamut(colour: Oklch): boolean {
  return toLinearRgb(colour).every((c) => c >= -GAMUT_TOLERANCE && c <= 1 + GAMUT_TOLERANCE);
}

/**
 * The same lightness and hue with the chroma reduced, by bisection, until the colour fits the
 * screen — the standard way to bring an OKLCH colour into sRGB without moving its lightness, which
 * is the one axis the contrast arithmetic depends on. A colour already in gamut comes back as is.
 */
export function toGamut(colour: Oklch): Oklch {
  if (inGamut(colour)) return colour;
  let low = 0;
  let high = colour.C;
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (inGamut({ ...colour, C: mid })) low = mid;
    else high = mid;
  }
  return { ...colour, C: low };
}

/** The most chroma this lightness and hue can carry on screen, by bisection. */
export function maxChroma(L: number, h: number): number {
  return toGamut({ L, C: 0.5, h }).C;
}

/** An OKLCH colour as `#RRGGBB`, brought into gamut first. */
export function oklchToHex(colour: Oklch): string {
  const [r, g, b] = toLinearRgb(toGamut(colour));
  return rgbToHex([fromLinear(r), fromLinear(g), fromLinear(b)]);
}
