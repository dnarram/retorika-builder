import { describe, expect, it } from "vitest";
import { resolveFill } from "../src/contrast.ts";
import {
  AAA_NORMAL_TEXT,
  contrastRatio,
  derivePalette,
  hexToOklch,
  oklchToHex,
  PALETTES,
  type PaletteColors,
  STARTING_PALETTE_ID,
  validateTheme,
  veilFor,
  withTextMargin,
} from "../src/index.ts";

/**
 * **The texts given margin, the brand's colour kept as the fill** (ADR 0081, sprint 40 día 7): the
 * remedy for a palette whose text barely clears its surface, which leaves no room for any motif.
 */

const TEXT_ROLES = ["color.ink", "color.primary", "color.secondary", "color.muted"] as const;
const MOTIFS = {
  cream: { darkest: "#F2E2C7", lightest: "#E9EFE2" },
  waves: { darkest: "#CF895B", lightest: "#D08A5C" },
  navy: { darkest: "#1A2949", lightest: "#B45309" },
};

/** Every palette there is: the thirteen predefined and the wheel derived on both surfaces. */
function everyPalette(): [string, PaletteColors][] {
  const all: [string, PaletteColors][] = PALETTES.map((palette) => [palette.id, palette.colors]);
  for (let h = 0; h < 360; h += 30) {
    for (const L of [0.3, 0.55, 0.8]) {
      const brand = oklchToHex({ L, C: 0.12, h });
      for (const surface of ["light", "dark"] as const) {
        all.push([`${brand} ${surface}`, derivePalette({ brand, surface }).colors]);
      }
    }
  }
  return all;
}

const neutral = (): PaletteColors => {
  const found = PALETTES.find((palette) => palette.id === STARTING_PALETTE_ID);
  if (!found) throw new Error("no starting palette");
  return found.colors;
};

describe("withTextMargin", () => {
  it("gives the neutral start's texts AAA and keeps Retorika's blue exactly, on every button", () => {
    const before = neutral();
    const after = withTextMargin(before);
    // The blue of the headings and the links: a sibling of the same hue at 7:1.
    expect(after["color.primary"]).toBe("#0054BB");
    expect(after["color.secondary"]).toBe("#0857AC");
    // The fill is the colour the primary was, written on in white: the button does not change.
    expect(after["color.fill"]).toBe("#156FE7");
    expect(after["color.onFill"]).toBe("#FFFFFF");
    // Ink, muted, accent and the surface stay.
    for (const key of ["color.ink", "color.muted", "color.accent", "color.surface"] as const) {
      expect(after[key], key).toBe(before[key]);
    }
  });

  it("frees the motifs the start held back: cream 82 → 0, waves 95 → 54, navy 98 → 78", () => {
    const before = neutral();
    const after = withTextMargin(before);
    const pairs = Object.fromEntries(
      Object.entries(MOTIFS).map(([name, extremes]) => [
        name,
        [veilFor(before, extremes), veilFor(after, extremes)],
      ]),
    );
    expect(pairs).toEqual({ cream: [82, 0], waves: [95, 54], navy: [98, 78] });
  });

  it("on every palette there is: still valid, every text at 7:1, and the fill exactly what it was", () => {
    for (const [name, before] of everyPalette()) {
      const after = withTextMargin(before);
      expect(validateTheme(after), name).toEqual([]);
      for (const key of TEXT_ROLES) {
        expect(
          contrastRatio(after[key], after["color.surface"]),
          `${name} ${key}`,
        ).toBeGreaterThanOrEqual(AAA_NORMAL_TEXT);
      }
      // What a button, a bar and the favicon are drawn in — resolved as the renderer resolves it —
      // is the same colour, written on in the same ink.
      expect(resolveFill(after)["color.fill"], name).toBe(resolveFill(before)["color.fill"]);
      expect(resolveFill(after)["color.onFill"], name).toBe(resolveFill(before)["color.onFill"]);
      expect(after["color.surface"], name).toBe(before["color.surface"]);
    }
  });

  it("moves a text only in lightness: its hue stays, where it has one", () => {
    for (const [name, before] of everyPalette()) {
      const after = withTextMargin(before);
      for (const key of TEXT_ROLES) {
        if (after[key] === before[key]) continue;
        const was = hexToOklch(before[key]);
        const is = hexToOklch(after[key]);
        if (was.C < 0.03 || is.C < 0.03) continue;
        const turn = Math.abs(((is.h - was.h + 540) % 360) - 180);
        expect(turn, `${name} ${key} ${before[key]} → ${after[key]}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("is a fixed point: a theme already at the margin comes back as the same object", () => {
    const deepWine = PALETTES.find((palette) => palette.id === "deep-wine")?.colors;
    if (!deepWine) throw new Error("no deep-wine");
    expect(withTextMargin(deepWine)).toBe(deepWine);
    for (const [name, before] of everyPalette()) {
      const once = withTextMargin(before);
      expect(withTextMargin(once), name).toBe(once);
    }
  });
});
