import { paletteForLogo } from "./logoPalette.ts";

/**
 * Decoding a logo far enough to read its colours, and no further.
 *
 * Split from `logoPalette.ts` because that module is pure arithmetic over bytes and this one needs
 * a canvas: `vitest.config.ts` gives `apps/editor` a node project with no DOM, so everything worth
 * asserting lives there and the twelve lines that cannot be tested there live here.
 *
 * Nothing is kept. The logo is not stored, not uploaded, and not put in the document — the file is
 * decoded, one palette id comes out, and the bitmap is closed. The site a logo shapes carries the
 * palette, never the logo, which is also why this can run while the owner is still on question 1.
 */

/** The logo is scaled into a square this size before its pixels are read. Small on purpose: the
 * question is which colour dominates, and 64×64 answers it in about four thousand pixels instead
 * of a few million. It also blurs the anti-aliased edge of a shape into the shape, which is what
 * the colour buckets want anyway. */
const SAMPLE_EDGE = 64;

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
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_EDGE;
    canvas.height = SAMPLE_EDGE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    // Stretched to fill rather than letterboxed: a letterbox would add its own transparent or
    // white bars, and those are exactly the pixels `dominantColour` then has to throw away. The
    // aspect ratio is not a colour, so distorting it costs nothing here.
    context.drawImage(bitmap, 0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
    return paletteForLogo(context.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE).data);
  } catch {
    // A tainted canvas cannot be read back. Not reachable for a file the owner picked, which is
    // same-origin by construction — caught because the alternative is a thrown error on question 1.
    return null;
  } finally {
    bitmap.close();
  }
}
