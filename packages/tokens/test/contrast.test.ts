import { describe, expect, it } from "vitest";
import {
  AA_NORMAL_TEXT,
  CONTRAST_PAIRS,
  contrastRatio,
  PALETTES,
  provedOn,
  relativeLuminance,
} from "../src/index.ts";

describe("contrast", () => {
  // The list moved into `src/contrast.ts` on sprint 9 day 4, when the floating toolbar became its
  // second reader. It was a local const here for as long as this test was the only one who cared;
  // the moment a screen started deciding what to offer from it, two copies would have meant a
  // toolbar offering a pair nobody had measured.
  const PAIRS = CONTRAST_PAIRS.map((pair) => ({ ...pair, label: `${pair.fg} / ${pair.bg}` }));

  for (const palette of PALETTES) {
    describe(`palette "${palette.id}"`, () => {
      for (const pair of PAIRS) {
        it(`meets AA contrast threshold (>= 4.5:1) for ${pair.label}`, () => {
          const fgColor = palette.colors[pair.fg];
          const bgColor = palette.colors[pair.bg];
          const ratio = contrastRatio(fgColor, bgColor);

          expect(
            ratio,
            `Palette "${palette.id}" pair "${pair.label}" (${pair.fg}: ${fgColor}, ${pair.bg}: ${bgColor}) measured contrast ratio ${ratio.toFixed(2)}:1, expected >= ${AA_NORMAL_TEXT}:1`,
          ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
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

/**
 * What the list is, once something other than this file reads it.
 *
 * The toolbar's rule is «offer a role only where its pair against this element's background is
 * proved», so the value of `CONTRAST_PAIRS` is entirely in what it leaves out. These are the
 * absences, asserted rather than assumed.
 */
describe("CONTRAST_PAIRS as the toolbar's source of truth", () => {
  it("does not contain surface on surface, which is invisible text", () => {
    // 1:1, and a perfectly legal `{ref: "color.surface"}` in the schema. The whole reason the
    // toolbar computes its list instead of showing five swatches everywhere.
    expect(CONTRAST_PAIRS).not.toContainEqual({ fg: "color.surface", bg: "color.surface" });
    for (const palette of PALETTES) {
      const ratio = contrastRatio(palette.colors["color.surface"], palette.colors["color.surface"]);
      expect(ratio, palette.id).toBe(1);
    }
  });

  it("names color.accent in no pair, in either position", () => {
    for (const pair of CONTRAST_PAIRS) {
      expect(pair.fg).not.toBe("color.accent");
      expect(pair.bg).not.toBe("color.accent");
    }
  });

  it("answers four foregrounds on surface and one on primary", () => {
    // The two backgrounds the renderer actually paints: `[role=button]` sits on color.primary
    // (`build.ts`), and everything else sits on color.surface — including text over a photograph,
    // because `panelArea` puts a color.surface panel under it for exactly this reason.
    expect(provedOn("color.surface")).toEqual([
      "color.ink",
      "color.primary",
      "color.secondary",
      "color.muted",
    ]);
    expect(provedOn("color.primary")).toEqual(["color.surface"]);
  });

  it("answers nothing for a background no pair has been measured against", () => {
    // Empty is the honest answer, and the toolbar draws no swatches rather than five unmeasured
    // ones. `color.muted` is a real token and a plausible future background; nobody has proved a
    // text colour on it.
    expect(provedOn("color.muted")).toEqual([]);
    expect(provedOn("color.accent")).toEqual([]);
  });
});
