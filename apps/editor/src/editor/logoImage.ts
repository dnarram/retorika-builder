import type { LogoColours } from "@retorika/generator";
import { dominantColours, meanLuminance, toHex } from "./logoPalette.ts";

/**
 * Decoding a logo far enough to read its colours, and no further.
 *
 * Split from `logoPalette.ts` because that module is pure arithmetic over bytes and this one needs
 * a canvas: `vitest.config.ts` gives `apps/editor` a node project with no DOM, so everything worth
 * asserting lives there and the dozen lines that cannot be tested there live here.
 *
 * Two questions are asked of the same 64×64 sample: which colours the logo has (question 1 and a
 * logo uploaded later, sprint 38 día 3, ADR 0076), and how light the logo is on average (ADR 0059,
 * David's adjustment 4 of the sprint 30 plan) — the number the «Menú» panel and the download review
 * compare with the bar the logo sits on. The colours travel as an answer; the luminance lives in the
 * editor's session beside the photographs' object URLs, recomputed from the bytes whenever a site
 * opens.
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
 * How light the logo is, as the mean WCAG relative luminance of its visible pixels (0 black, 1
 * white), or `null` for a file the browser cannot decode or a logo that is wholly transparent.
 * `meanLuminance` holds the arithmetic and its test; this is the canvas in front of it.
 */
export async function logoLuminanceOf(source: Blob): Promise<number | null> {
  const pixels = await samplePixels(source);
  return pixels === null ? null : meanLuminance(pixels);
}

/**
 * The logo's tints as hex, for the palette the site derives from them (sprint 38 día 2, ADR 0076) —
 * or `null` for a logo with no colour in it (a black wordmark on white) and for a file the browser
 * cannot decode. The same 64×64 sample the other two questions read; `dominantColours` holds the
 * arithmetic and its test, and this is the canvas in front of it.
 */
export async function logoColoursOf(source: Blob): Promise<LogoColours | null> {
  const pixels = await samplePixels(source);
  if (pixels === null) return null;
  const [brand, second] = dominantColours(pixels);
  if (!brand) return null;
  return { brand: toHex(brand), second: second ? toHex(second) : null };
}
