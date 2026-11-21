import { describe, expect, it } from "vitest";
import { AA_NORMAL_TEXT, contrastRatio, mixHex } from "../src/contrast.ts";
import { derivePalette, GLASS_MIX, veilFor } from "../src/index.ts";
import { oklchToHex } from "../src/oklch.ts";
import { PALETTES } from "../src/palettes.ts";

/**
 * **The veil a motif needs, proved over every palette** (ADR 0081, sprint 40 día 5). The arithmetic
 * is the schema's (`veilFor`, the glass bar's `mixHex` over the motif's extremes); what this holds is
 * that every palette this package ships, and every one `derivePalette` makes, has an answer for the
 * worst motif there is — black and white in one picture — and that the fixed bar's glass still reads
 * over the veiled motif (David's adjustment 3 approving the sprint).
 */

const WORST = { darkest: "#000000", lightest: "#FFFFFF" };

describe("veilFor over the palettes", () => {
  it("has an answer for black and white under every predefined palette, and it clears", () => {
    for (const palette of PALETTES) {
      const alpha = veilFor(palette.colors, WORST);
      expect(alpha, palette.id).toBeLessThanOrEqual(100);
      for (const under of [WORST.darkest, WORST.lightest]) {
        const behind = mixHex(palette.colors["color.surface"], under, alpha / 100);
        for (const key of [
          "color.ink",
          "color.primary",
          "color.secondary",
          "color.muted",
        ] as const) {
          expect(
            contrastRatio(palette.colors[key], behind),
            `${palette.id} ${key} over ${under}`,
          ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        }
      }
    }
  });

  it("has one for every palette the wheel derives, on both surfaces", () => {
    for (let h = 0; h < 360; h += 30) {
      for (const L of [0.3, 0.55, 0.8]) {
        const brand = oklchToHex({ L, C: 0.12, h });
        for (const surface of ["light", "dark"] as const) {
          const { colors } = derivePalette({ brand, surface });
          const alpha = veilFor(colors, WORST);
          expect(alpha, `${brand} ${surface}`).toBeLessThanOrEqual(100);
          expect(alpha, `${brand} ${surface}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("keeps the fixed bar's glass readable over the veiled motif, in both schemes", () => {
    // What lies under a glass bar over a veiled motif is the veil's own composite; the glass is the
    // bar's colour at GLASS_MIX over that. Four pairs, as `validateTheme` holds for black and white.
    for (const palette of PALETTES) {
      const alpha = veilFor(palette.colors, WORST);
      for (const under of [WORST.darkest, WORST.lightest]) {
        const veiled = mixHex(palette.colors["color.surface"], under, alpha / 100);
        const surfaceGlass = mixHex(palette.colors["color.surface"], veiled, GLASS_MIX);
        const inkGlass = mixHex(palette.colors["color.ink"], veiled, GLASS_MIX);
        expect(
          contrastRatio(palette.colors["color.ink"], surfaceGlass),
          `${palette.id} surface bar`,
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        expect(
          contrastRatio(palette.colors["color.surface"], inkGlass),
          `${palette.id} ink bar`,
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    }
  });
});
