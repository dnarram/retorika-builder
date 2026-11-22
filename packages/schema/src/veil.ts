import { AA_NORMAL_TEXT, contrastRatio, mixHex } from "./colour.ts";

/**
 * **The veil a motif needs so the words over it still read** (ADR 0081, sprint 40 día 5).
 *
 * A background with motifs is painted under a section or under the whole site, and nothing in a
 * palette can prove text against a picture — which is why the cover's text over a photograph has sat
 * on a panel of `color.surface` since sprint 1 (`panelArea`). A motif is lighter than a photograph
 * and the owner wants it seen, so instead of a solid panel it gets a **veil**: `color.surface` at an
 * opacity, over the whole picture, under every word.
 *
 * **The opacity is derived, never stored, and never guessed.** The editor reads the motif's darkest
 * and lightest pixels once, at the saved resolution (David's adjustment 2: a 64×64 sample averages a
 * thin black line into a grey), and the document keeps those two colours. This function then finds
 * the least opacity at which **every text colour of the surface** — ink, primary, secondary, muted —
 * clears AA over the surface mixed at that opacity with either extreme: the arithmetic the glass bar
 * has been proved by since sprint 32 (`mixHex` over black and over white), with the motif's own
 * extremes in place of black and white. Changing the palette changes the answer, because the renderer
 * asks again when it draws. A pale motif needs little veil and shows through; a motif with black and
 * white in it needs most of one, and the panel says so in plain words (día 6).
 *
 * In whole hundredths, the first that clears, so the stylesheet is the same bytes for the same
 * document (`INV_5`). At 100 the mix is the surface itself and every pair is a palette's own proof —
 * so a theme `validateTheme` accepts always has an answer; a theme it does not is answered 100 and
 * refused elsewhere.
 */

/** The colours written over the surface, which is what a veil has to keep readable. */
export const VEIL_TEXT_KEYS = [
  "color.ink",
  "color.primary",
  "color.secondary",
  "color.muted",
] as const;

export type VeilColours = Record<(typeof VEIL_TEXT_KEYS)[number] | "color.surface", string>;

/** A motif's darkest and lightest visible pixels, as `#rrggbb`. */
export interface Extremes {
  darkest: string;
  lightest: string;
}

/** The least opacity of `color.surface`, 0–100, under which every text colour reads over both
 * extremes. */
export function veilFor(colours: VeilColours, extremes: Extremes): number {
  const surface = colours["color.surface"];
  for (let alpha = 0; alpha <= 100; alpha += 1) {
    const clears = [extremes.darkest, extremes.lightest].every((under) => {
      const behind = mixHex(surface, under, alpha / 100);
      return VEIL_TEXT_KEYS.every((key) => contrastRatio(colours[key], behind) >= AA_NORMAL_TEXT);
    });
    if (clears) return alpha;
  }
  return 100;
}
