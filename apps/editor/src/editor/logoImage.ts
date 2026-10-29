import { meanLuminance, paletteForLogo } from "./logoPalette.ts";

/**
 * Decoding a logo far enough to read its colours, and no further.
 *
 * Split from `logoPalette.ts` because that module is pure arithmetic over bytes and this one needs
 * a canvas: `vitest.config.ts` gives `apps/editor` a node project with no DOM, so everything worth
 * asserting lives there and the dozen lines that cannot be tested there live here.
 *
 * Two questions are asked of the same 64×64 sample: which palette the logo's colour chooses
 * (question 1, since sprint 6), and how light the logo is on average (ADR 0059, David's adjustment
 * 4 of the sprint 30 plan) — the number the «Menú» panel and the download review compare with the
 * bar the logo sits on, so a white mark on a light bar is said before it is published. Neither
 * number is stored: the palette id travels as an answer, and the luminance lives in the editor's
 * session beside the photographs' object URLs, recomputed from the bytes whenever a site opens.
 */

/** The logo is scaled into a square this size before its pixels are read. Small on purpose: the
 * question is which colour dominates, and 64×64 answers it in about four thousand pixels instead
 * of a few million. It also blurs the anti-aliased edge of a shape into the shape, which is what
 * the colour buckets want anyway. */
const SAMPLE_EDGE = 64;

/**
 * The logo's pixels at `SAMPLE_EDGE` square, or `null` for a file the browser cannot decode or a
 * canvas it cannot read back.
 *
 * Stretched to fill rather than letterboxed: a letterbox would add its own transparent or white
 * bars, and those are exactly the pixels `dominantColour` then has to throw away, and the ones
 * that would drag the mean luminance towards the bars. The aspect ratio is not a colour.
 */
async function samplePixels(source: Blob): Promise<Uint8ClampedArray | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_EDGE;
    canvas.height = SAMPLE_EDGE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
    return context.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE).data;
  } catch {
    // A tainted canvas cannot be read back. Not reachable for a file the owner picked, which is
    // same-origin by construction — caught because the alternative is a thrown error on question 1.
    return null;
  } finally {
    bitmap.close();
  }
}

/**
 * The palette a logo file chooses, or `null` — for a logo with no colour in it (a black wordmark
 * on white), for one whose colour no palette is near, and for a file the browser cannot decode.
 *
 * All three answer the same way on purpose: the sector's palette stands, and nothing tells the
 * owner their logo chose it. An undecodable file is not worth an error of its own here — the logo
 * is optional, question 1 continues either way, and a message about a corrupt PNG at the moment
 * someone is typing their business name would be an interruption in exchange for nothing.
 */
export async function paletteFromLogoFile(file: File): Promise<string | null> {
  const pixels = await samplePixels(file);
  return pixels === null ? null : paletteForLogo(pixels);
}

/**
 * How light the logo is, as the mean WCAG relative luminance of its visible pixels (0 black, 1
 * white), or `null` for a file the browser cannot decode or a logo that is wholly transparent.
 * `meanLuminance` holds the arithmetic and its test; this is the canvas in front of it.
 */
export async function logoLuminanceOf(source: Blob): Promise<number | null> {
  const pixels = await samplePixels(source);
  return pixels === null ? null : meanLuminance(pixels);
}
