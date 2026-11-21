import type { Page } from "@playwright/test";

/**
 * **The editor's own sampling, run in Chromium** (sprint 40 día 3): what `logoImage.ts` does to a
 * logo before `dominantColours` reads it — `createImageBitmap`, drawn **stretched** into a 64×64
 * canvas, `getImageData` — so a sample taken here is byte for byte what the questionnaire reads.
 *
 * Measured to matter: the same Retorika wordmark read through `sharp`'s resize came out `#000B2B`,
 * and through Chromium's canvas `#011736`. A test fed by another decoder would be asserting another
 * decoder. Used by `scripts/logo-samples.ts`, which writes the committed `.rgba` samples, and by the
 * local-only brand test (`brand/`), which reads files that never enter the repository.
 */
export const SAMPLE_EDGE = 64;

export async function sampleInChromium(page: Page, png: Uint8Array): Promise<Uint8ClampedArray> {
  const b64 = Buffer.from(png).toString("base64");
  const data = await page.evaluate(
    async ({ b64, edge }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = document.createElement("canvas");
      canvas.width = edge;
      canvas.height = edge;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("sampleInChromium: no 2d context");
      context.drawImage(bitmap, 0, 0, edge, edge);
      bitmap.close();
      return Array.from(context.getImageData(0, 0, edge, edge).data);
    },
    { b64, edge: SAMPLE_EDGE },
  );
  return new Uint8ClampedArray(data);
}
