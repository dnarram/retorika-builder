import {
  BACKGROUND_MAX_EDGE,
  contrastRatio,
  type Extremes,
  relativeLuminance,
  type Theme,
  type VeilColours,
  veilFor,
} from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };

/**
 * **A background with motifs, before it is the document's** (ADR 0081, sprint 40 día 6): what the
 * editor measures of a picture the owner brought, and what it tells them about it. Pure, so it is
 * asserted in Node; the canvas that decodes the bytes is `photos.ts`'s `prepareBackground`.
 */

/** Below this alpha a pixel is not really there — the logo's rule (`logoPalette.ts`). */
const MIN_ALPHA = 128;

/** A tile of the background is shown in the panel at its own size, up to this many px. */
export const PREVIEW_TILE_MAX = 160;

/** Over this many bytes the picture is kept and the panel says what it costs. */
export const BACKGROUND_WARN_BYTES = 300 * 1024;

/** Over this many it is refused: the bucket's `file_size_limit` and the download route's cap, the
 * same number as `downloadGate.ts`'s `MAX_PHOTO_BYTES` — a test holds the two equal, because a
 * background that could be kept and not downloaded would be a save that lied. */
export const BACKGROUND_MAX_BYTES = 2 * 1024 * 1024;

const LINEAR = Array.from({ length: 256 }, (_, channel) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

const hexOf = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/**
 * **The darkest and the lightest visible pixel, read from every pixel there is** — David's
 * adjustment 2: «los extremos se miden a la resolución guardada, no en la muestra de 64×64.
 * Reducir a 64 px promedia los trazos finos». A motif of 1 px black lines on white, sampled at 64×64,
 * would read as a grey and a white, and the veil derived from a grey would leave the lines under the
 * words. So this is handed the pixels of the picture **as it was saved** — re-decoded from the
 * encoded bytes, so a JPEG's ringing is inside the measure — and reads them all: one pass, no
 * allocation per pixel, the WCAG luminance from a 256-entry table.
 *
 * `null` for a picture with nothing visible in it, which `prepareBackground` refuses.
 */
export function backgroundExtremes(pixels: Uint8ClampedArray): Extremes | null {
  let darkest = Number.POSITIVE_INFINITY;
  let lightest = Number.NEGATIVE_INFINITY;
  let dark = 0;
  let light = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < MIN_ALPHA) continue;
    const luminance =
      0.2126 * (LINEAR[pixels[i] ?? 0] ?? 0) +
      0.7152 * (LINEAR[pixels[i + 1] ?? 0] ?? 0) +
      0.0722 * (LINEAR[pixels[i + 2] ?? 0] ?? 0);
    if (luminance < darkest) {
      darkest = luminance;
      dark = i;
    }
    if (luminance > lightest) {
      lightest = luminance;
      light = i;
    }
  }
  if (darkest === Number.POSITIVE_INFINITY) return null;
  return {
    darkest: hexOf(pixels[dark] ?? 0, pixels[dark + 1] ?? 0, pixels[dark + 2] ?? 0),
    lightest: hexOf(pixels[light] ?? 0, pixels[light + 1] ?? 0, pixels[light + 2] ?? 0),
  };
}

/** **PNG where the picture has transparency, JPEG where it has none** (David's answer): a Canva
 * pattern on a transparent ground keeps its ground; a photograph used as a motif is a photograph. */
export function backgroundTypeFor(pixels: Uint8ClampedArray): "image/png" | "image/jpeg" {
  for (let i = 3; i < pixels.length; i += 4) {
    if ((pixels[i] ?? 255) < 255) return "image/png";
  }
  return "image/jpeg";
}

/** The `src` a background is kept and published under: minted anew for every upload, like the
 * logo's (ADR 0059 §3), so no cache can show the old picture under the new document. */
export function backgroundSrcFor(id: string, type: "image/png" | "image/jpeg"): string {
  return `bg-${id}.${type === "image/png" ? "png" : "jpg"}`;
}

/** The colours `veilFor` reads, from a theme. */
export function veilColoursOf(theme: Theme): VeilColours {
  return {
    "color.surface": theme["color.surface"],
    "color.ink": theme["color.ink"],
    "color.primary": theme["color.primary"],
    "color.secondary": theme["color.secondary"],
    "color.muted": theme["color.muted"],
  };
}

/**
 * **From this veil up, the panel says why the motif shows so little** — David's condition: «nadie
 * debe subir un fondo y no entender por qué apenas se ve». Seventy hundredths: the motif then shows
 * at 30 % or less. Measured on sprint 40 día 6 with three motifs under the thirteen palettes (ADR
 * 0081's note): a pale one needs 0 under seven of them and 75–85 under five; a medium one 49–96; navy
 * lines 58–98.
 */
export const VEIL_NOTE_AT = 70;

/** A page whose surface is lighter than this is a light page. */
const LIGHT_PAGE = 0.5;

/** Under this contrast with the page, a motif's extreme is «suave» — close to the page's own tone. */
const SOFT = 1.5;

export type VeilReason = "dark" | "light" | "margin";

/**
 * **Why the veil is as high as it is**, said truthfully — measured, there are two causes, and the
 * sentence David gave as his example names only one. On a light page, a motif with very dark parts;
 * on a dark page, one with very light parts: «dark» and «light». But under a palette whose text
 * colours barely clear AA on the plain surface — the neutral start's primary is 4.71:1 — even a soft
 * cream motif needs 82 %: that is the colours' margin, not the motif, and telling the owner to soften
 * a motif that is already soft would send them round in a circle. `null` under the threshold.
 */
export function veilReason(theme: Theme, extremes: Extremes): VeilReason | null {
  const colours = veilColoursOf(theme);
  if (veilFor(colours, extremes) < VEIL_NOTE_AT) return null;
  const surface = colours["color.surface"];
  const lightPage = relativeLuminance(surface) > LIGHT_PAGE;
  const far = lightPage ? extremes.darkest : extremes.lightest;
  if (contrastRatio(far, surface) < SOFT) return "margin";
  return lightPage ? "dark" : "light";
}

/** The sentence for a reason, from the locale file. */
export function veilNoteText(reason: VeilReason): string {
  return es[`editor.background.note.${reason}` as keyof typeof es];
}

/** The pixels `prepareBackground` may keep, a side. The schema's own bound. */
export { BACKGROUND_MAX_EDGE };
