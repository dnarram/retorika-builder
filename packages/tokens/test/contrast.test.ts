import { describe, expect, it } from "vitest";
import { contrastRatio, PALETTES, relativeLuminance } from "../src/index.ts";

describe("contrast", () => {
  const PAIRS = [
    { fg: "color.ink", bg: "color.surface", label: "color.ink / color.surface" },
    { fg: "color.primary", bg: "color.surface", label: "color.primary / color.surface" },
    { fg: "color.secondary", bg: "color.surface", label: "color.secondary / color.surface" },
    { fg: "color.muted", bg: "color.surface", label: "color.muted / color.surface" },
    { fg: "color.surface", bg: "color.primary", label: "color.surface / color.primary" },
  ] as const;

  for (const palette of PALETTES) {
    describe(`palette "${palette.id}"`, () => {
      for (const pair of PAIRS) {
        it(`meets AA contrast threshold (>= 4.5:1) for ${pair.label}`, () => {
          const fgColor = palette.colors[pair.fg];
          const bgColor = palette.colors[pair.bg];
          const ratio = contrastRatio(fgColor, bgColor);

          expect(
            ratio,
            `Palette "${palette.id}" pair "${pair.label}" (${pair.fg}: ${fgColor}, ${pair.bg}: ${bgColor}) measured contrast ratio ${ratio.toFixed(2)}:1, expected >= 4.5:1`,
          ).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }

  describe("relativeLuminance validation", () => {
    it("throws on invalid color strings", () => {
      expect(() => relativeLuminance("red")).toThrow();
      expect(() => relativeLuminance("#ff")).toThrow();
      expect(() => relativeLuminance("")).toThrow();
    });
  });
});
