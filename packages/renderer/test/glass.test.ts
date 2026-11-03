import { AA_NORMAL_TEXT, contrastRatio, mixHex, PALETTES } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { GLASS_BACKGROUNDS, GLASS_MIX } from "../src/index.ts";

/**
 * **The glass is a claim about contrast, and this is what makes it one** (ADR 0063, sprint 32 día 1).
 *
 * A scrolled bar on a glass scheme keeps `GLASS_MIX` of its colour and shows the page through the rest,
 * blurred. Axe cannot measure words over that — it reports a contrast it could not compute, which the
 * accessibility suite counts as red — so the proof is arithmetic, over the two extremes of whatever can
 * scroll under the bar: pure black and pure white. Every word the bar writes on a glass background
 * clears AA over both, in every palette. Sabotaged before it was trusted: `GLASS_MIX` at 0.6 turns it
 * red.
 *
 * And the absence, asserted: `color.primary` on a surface glass does **not** clear AA at this mix in
 * every palette, which is why the surface scheme writes its brand and its entries in ink and keeps the
 * primary for the indicator and the button (not words over glass).
 */
describe("the glass bar clears AA over black and over white, in every palette", () => {
  const extremes = ["#000000", "#ffffff"] as const;

  for (const palette of PALETTES) {
    for (const [background, word] of Object.entries(GLASS_BACKGROUNDS) as [
      keyof typeof GLASS_BACKGROUNDS,
      "ink" | "surface",
    ][]) {
      for (const under of extremes) {
        it(`${palette.id}: color.${word} on color.${background} at ${GLASS_MIX} over ${under}`, () => {
          const glass = mixHex(palette.colors[`color.${background}`], under, GLASS_MIX);
          const ratio = contrastRatio(palette.colors[`color.${word}`], glass);
          expect(ratio, `${ratio.toFixed(2)}:1 on ${glass}`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
        });
      }
    }
  }

  it("is the mix the stylesheet writes, and the two schemes it names", () => {
    expect(GLASS_MIX).toBe(0.88);
    expect(GLASS_BACKGROUNDS).toEqual({ surface: "ink", ink: "surface" });
  });

  it("would not hold the primary as a word on a surface glass, which is why no surface bar writes one", () => {
    const failing = PALETTES.filter((palette) =>
      extremes.some(
        (under) =>
          contrastRatio(
            palette.colors["color.primary"],
            mixHex(palette.colors["color.surface"], under, GLASS_MIX),
          ) < AA_NORMAL_TEXT,
      ),
    ).map((p) => p.id);
    expect(failing).toContain("neutral");
    expect(failing).toContain("forest-emerald");
  });

  it("mixes per channel: 88 % of white over black is #e0e0e0, and a short hex is read", () => {
    expect(mixHex("#ffffff", "#000000", 0.88)).toBe("#e0e0e0");
    expect(mixHex("#fff", "#000", 0.5)).toBe("#808080");
    expect(() => mixHex("white", "#000", 0.5)).toThrow();
  });
});
