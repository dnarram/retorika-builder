import type { Theme } from "@retorika/schema";
import { PALETTES } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  BACKGROUND_MAX_BYTES,
  backgroundExtremes,
  backgroundSrcFor,
  backgroundTypeFor,
  VEIL_NOTE_AT,
  veilNoteText,
  veilReason,
} from "../src/editor/backgroundMotif.ts";
import { MAX_PHOTO_BYTES } from "../src/editor/downloadGate.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * What the editor measures of a background before it is the document's (ADR 0081, sprint 40 día 6):
 * its extremes at the saved resolution, PNG or JPEG by its transparency, its name, and why its veil
 * is as high as it is.
 */

/** An RGBA image `width`×`height`, every pixel `fill`, then `paint` over it. */
function image(
  width: number,
  height: number,
  fill: [number, number, number, number],
  paint?: (x: number, y: number) => [number, number, number, number] | undefined,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = paint?.(x, y) ?? fill;
      data.set(px, (y * width + x) * 4);
    }
  }
  return data;
}

/** A box filter to `edge`×`edge`, what a canvas does to a picture drawn smaller: the average. */
function reduced(data: Uint8ClampedArray, size: number, edge: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(edge * edge * 4);
  const step = size / edge;
  for (let y = 0; y < edge; y += 1) {
    for (let x = 0; x < edge; x += 1) {
      const sum = [0, 0, 0, 0];
      for (let dy = 0; dy < step; dy += 1) {
        for (let dx = 0; dx < step; dx += 1) {
          const i = ((y * step + dy) * size + (x * step + dx)) * 4;
          for (let c = 0; c < 4; c += 1) sum[c] = (sum[c] ?? 0) + (data[i + c] ?? 0);
        }
      }
      out.set(
        sum.map((v) => Math.round(v / (step * step))),
        (y * edge + x) * 4,
      );
    }
  }
  return out;
}

const WHITE: [number, number, number, number] = [255, 255, 255, 255];
const BLACK: [number, number, number, number] = [0, 0, 0, 255];

describe("backgroundExtremes", () => {
  /**
   * **David's adjustment 2, as a test**: «un motivo de líneas negras de 1 px sobre blanco: los
   * extremos son negro y blanco». Read at the saved resolution, they are; the same motif reduced to
   * 64×64 — what the logo's sampling reads — has no black pixel left, only a grey, and a veil derived
   * from that grey would leave the lines unreadable under the words. The second half is the case
   * that must not pass, named.
   */
  it("reads 1 px black lines on white as black and white at the saved resolution — and a sample would not", () => {
    const size = 256;
    const lines = image(size, size, WHITE, (x) => (x % 8 === 0 ? BLACK : undefined));
    expect(backgroundExtremes(lines)).toEqual({ darkest: "#000000", lightest: "#FFFFFF" });
    const sample = backgroundExtremes(reduced(lines, size, 64));
    expect(sample?.darkest).not.toBe("#000000");
    expect(sample?.darkest).toBe("#BFBFBF");
  });

  it("ignores what is not really there: pixels under half alpha", () => {
    const motif = image(16, 16, [0, 0, 0, 0], (x, y) =>
      x === 3 && y === 3 ? [180, 83, 9, 255] : x === 9 ? [10, 10, 10, 100] : undefined,
    );
    expect(backgroundExtremes(motif)).toEqual({ darkest: "#B45309", lightest: "#B45309" });
  });

  it("is null for a picture with nothing visible in it", () => {
    expect(backgroundExtremes(image(8, 8, [0, 0, 0, 0]))).toBeNull();
  });
});

describe("backgroundTypeFor and backgroundSrcFor", () => {
  it("keeps a transparent ground as PNG and a picture without one as JPEG", () => {
    expect(backgroundTypeFor(image(4, 4, WHITE, (x) => (x === 0 ? [0, 0, 0, 0] : undefined)))).toBe(
      "image/png",
    );
    expect(backgroundTypeFor(image(4, 4, WHITE))).toBe("image/jpeg");
  });

  it("names the file by the minted id and the type, nothing of the owner's", () => {
    expect(backgroundSrcFor("0a1b2c3d", "image/png")).toBe("bg-0a1b2c3d.png");
    expect(backgroundSrcFor("0a1b2c3d", "image/jpeg")).toBe("bg-0a1b2c3d.jpg");
  });

  it("refuses at the same weight the bucket and the download refuse at", () => {
    expect(BACKGROUND_MAX_BYTES).toBe(MAX_PHOTO_BYTES);
  });
});

describe("veilReason — why the veil is as high as it is", () => {
  const palette = (id: string): Theme => {
    const found = PALETTES.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`no palette ${id}`);
    return found.colors as unknown as Theme;
  };

  it("says nothing under the threshold", () => {
    // A soft cream motif under the terracotta palette needs no veil at all (measured: 0).
    expect(
      veilReason(palette("warm-terracotta"), { darkest: "#F2E2C7", lightest: "#E9EFE2" }),
    ).toBeNull();
  });

  it("names the dark parts of a motif on a light page", () => {
    // Navy lines and terracotta dots, the corpus's motif: 98 under the neutral palette.
    expect(veilReason(palette("neutral"), { darkest: "#1A2949", lightest: "#B45309" })).toBe(
      "dark",
    );
  });

  it("names the light parts of a motif on a dark page", () => {
    expect(veilReason(palette("dark-slate"), { darkest: "#F2E2C7", lightest: "#E9EFE2" })).toBe(
      "light",
    );
  });

  it("names the colours' margin when the motif is already soft — it would be false to ask for a softer one", () => {
    // The same cream motif needs 82 under the neutral start, whose primary is 4.71:1 on white.
    expect(veilReason(palette("neutral"), { darkest: "#F2E2C7", lightest: "#E9EFE2" })).toBe(
      "margin",
    );
  });

  it("has a sentence for each reason, in the locale file, and the threshold is the one measured", () => {
    for (const reason of ["dark", "light", "margin"] as const) {
      expect(veilNoteText(reason)).toBe(es[`editor.background.note.${reason}`]);
    }
    expect(VEIL_NOTE_AT).toBe(70);
  });
});
