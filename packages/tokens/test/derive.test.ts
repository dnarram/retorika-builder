import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Theme } from "@retorika/schema";
import { TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  AA_NORMAL_TEXT,
  contrastRatio,
  derivePalette,
  hexToOklch,
  inkOn,
  LEGIBLE_STEPS,
  legibleSteps,
  maxChroma,
  mixHex,
  oklchToHex,
  PALETTES,
  type PaletteColors,
  paletteLabel,
  validateTheme,
  withPalette,
} from "../src/index.ts";

/**
 * The engine that derives a palette from a brand's colour (sprint 38 día 2, ADR 0074 and 0076).
 *
 * What it claims, each pinned: the brand's colour is the fill in every case and the text in most;
 * the four that move, move the minimum; every palette it makes clears what every predefined palette
 * clears, over the whole wheel on both surfaces; the same input is the same bytes; and the fixture
 * `logo-amarillo` is what it produces for the postal yellow, byte for byte — David's adjustment 2:
 * the engine is the truth and the fixture its witness.
 */

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "..", "..", "..", "fixtures", "documents", "logo-amarillo.json");

/** A complete theme around six colours, for the readers that want one. */
function themeOf(colors: PaletteColors): Theme {
  return {
    ...(Object.fromEntries(TOKEN_KEYS.map((key) => [key, "1rem"])) as Theme),
    ...colors,
  };
}

/**
 * The twelve logos measured on 16 November 2026 — five real files of the repository and seven
 * discs in real brands' colours — and what the engine makes of each, on the light surface. The
 * plan's table was measured on pure white; the engine's surface carries a hair of the brand's hue
 * (L 0.985, chroma 0.006), and the fuchsia, at 4.60 on white, falls to 4.49 on its own tinted
 * surface and moves — by one unit of red and two of green, which no eye sees. So: **exact as fill
 * 12 of 12, exact as text 7 of 12**, and five palettes carry the fill pair.
 */
const MEASURED: [name: string, brand: string, primary: string, pair: [string, string] | null][] = [
  ["Retorika mark", "#0265FB", "#0265FB", null],
  ["Retorika lockup", "#000B2B", "#000B2B", null],
  ["fixtures/assets/logo.png", "#9A3412", "#9A3412", null],
  ["e2e logo.png", "#2563EB", "#2563EB", null],
  ["postal yellow", "#FFCD00", "#8D7000", ["#FFCD00", "#201A09"]],
  ["orange", "#FF7900", "#BA5700", ["#FF7900", "#26160E"]],
  ["purple", "#7145D6", "#7145D6", null],
  ["fuchsia", "#DB2777", "#D82475", ["#DB2777", "#FFFFFF"]],
  ["red", "#E60000", "#E60000", null],
  ["lime", "#84CC16", "#508100", ["#84CC16", "#161D0E"]],
  ["burgundy", "#6B1D2A", "#6B1D2A", null],
  ["light blue", "#1DA1F2", "#0079BB", ["#1DA1F2", "#0E1C27"]],
];

describe("the twelve logos, pinned", () => {
  it.each(MEASURED)("%s %s: text %s, fill pair %j", (_name, brand, primary, pair) => {
    const { colors, siblings } = derivePalette({ brand });
    expect(colors["color.primary"]).toBe(primary);
    expect(siblings.primary).toBe(primary !== brand);
    if (pair) {
      expect(colors["color.fill"]).toBe(pair[0]);
      expect(colors["color.onFill"]).toBe(pair[1]);
    } else {
      expect(Object.hasOwn(colors, "color.fill")).toBe(false);
      expect(Object.hasOwn(colors, "color.onFill")).toBe(false);
    }
    // The brand's colour is the fill in every case: the pair when written, the primary otherwise.
    expect(colors["color.fill"] ?? colors["color.primary"]).toBe(brand);
    expect(validateTheme(colors)).toEqual([]);
  });

  it("keeps the brand's colour exact as fill in all twelve, and as text in seven", () => {
    const exactText = MEASURED.filter(([, brand, primary]) => brand === primary).length;
    expect(exactText).toBe(7);
    expect(MEASURED.filter(([, , , pair]) => pair !== null).length).toBe(12 - exactText);
  });

  it("moves a text sibling the minimum: one step lighter no longer reads", () => {
    for (const [name, brand, primary] of MEASURED) {
      if (primary === brand) continue;
      const { colors } = derivePalette({ brand });
      const surface = colors["color.surface"];
      expect(contrastRatio(primary, surface), name).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      const sibling = hexToOklch(primary);
      const lighter = oklchToHex({ ...sibling, L: sibling.L + 0.012 });
      expect(contrastRatio(lighter, surface), `${name} one step lighter`).toBeLessThan(
        AA_NORMAL_TEXT,
      );
      // Same hue, within what rounding and the gamut leave of it.
      expect(Math.abs(sibling.h - hexToOklch(brand).h), `${name} hue`).toBeLessThan(6);
    }
  });

  it("on the dark surface keeps the four light brands exact as text, and writes no pair for them", () => {
    for (const brand of ["#FFCD00", "#FF7900", "#84CC16", "#1DA1F2"]) {
      const { colors, siblings } = derivePalette({ brand, surface: "dark" });
      expect(colors["color.primary"], brand).toBe(brand);
      expect(siblings.primary).toBe(false);
      expect(Object.hasOwn(colors, "color.fill"), brand).toBe(false);
      expect(hexToOklch(colors["color.surface"]).L).toBeLessThan(0.3);
      expect(hexToOklch(colors["color.ink"]).L).toBeGreaterThan(0.9);
      expect(validateTheme(colors)).toEqual([]);
    }
    // And a dark brand on the dark surface moves up, filling with itself under the surface's ink.
    const burgundy = derivePalette({ brand: "#6B1D2A", surface: "dark" });
    expect(burgundy.siblings.primary).toBe(true);
    expect(burgundy.colors["color.fill"]).toBe("#6B1D2A");
    // Over a dark fill on the dark surface the ink is the palette's light ink, not its dark surface.
    expect(burgundy.colors["color.onFill"]).toBe(burgundy.colors["color.ink"]);
  });
});

describe("the fixture logo-amarillo is this engine's witness", () => {
  it("carries exactly what derivePalette makes of the postal yellow, byte for byte", () => {
    const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { theme: Record<string, string> };
    const { colors } = derivePalette({ brand: "#FFCD00" });
    const stored = Object.fromEntries(
      Object.entries(fixture.theme).filter(([key]) => key.startsWith("color.")),
    );
    expect(stored).toEqual(colors);
  });
});

describe("every palette it makes clears what every predefined palette clears", () => {
  it("over the whole wheel, at four chromas, on both surfaces, never throws and never fails a pair", () => {
    let derived = 0;
    for (let h = 0; h < 360; h += 10) {
      for (let L = 0.15; L <= 0.951; L += 0.05) {
        for (const chroma of [0.05, 0.12, 0.2, "max"] as const) {
          const C = chroma === "max" ? maxChroma(L, h) : chroma;
          const brand = oklchToHex({ L, C, h });
          for (const surface of ["light", "dark"] as const) {
            const { colors } = derivePalette({ brand, surface });
            expect(validateTheme(colors), `${brand} ${surface}`).toEqual([]);
            expect(colors["color.fill"] ?? colors["color.primary"], `${brand} ${surface}`).toBe(
              brand,
            );
            derived += 1;
          }
        }
      }
    }
    expect(derived).toBe(36 * 17 * 4 * 2);
  });

  it("takes a second tint as the secondary and the accent, readable as text", () => {
    const { colors } = derivePalette({ brand: "#1D4ED8", second: "#FACC15" });
    expect(colors["color.accent"]).toBe("#FACC15");
    expect(
      contrastRatio(colors["color.secondary"], colors["color.surface"]),
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(
      Math.abs(hexToOklch(colors["color.secondary"]).h - hexToOklch("#FACC15").h),
    ).toBeLessThan(6);
    expect(validateTheme(colors)).toEqual([]);
  });

  it("is the same bytes for the same brand, with the pair omitted when it would say nothing new", () => {
    const once = derivePalette({ brand: "#2563EB" });
    expect(derivePalette({ brand: "#2563EB" })).toEqual(once);
    for (const hex of Object.values(once.colors)) expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    // A brand that reads as text fills with itself under the surface: no pair, like a predefined palette.
    expect(Object.hasOwn(once.colors, "color.fill")).toBe(false);
  });

  it("lends a grey brand no hue: its surface, ink and muted are greys", () => {
    const { colors } = derivePalette({ brand: "#555555" });
    for (const key of ["color.surface", "color.ink", "color.muted"] as const) {
      expect(hexToOklch(colors[key]).C, key).toBeLessThan(0.002);
    }
  });
});

describe("inkOn", () => {
  it("writes in the palette's own surface or ink when one reads, else in pure black or white", () => {
    expect(inkOn("#9A3412", "#FAFAF9", "#1C1917")).toBe("#FAFAF9");
    expect(inkOn("#FFCD00", "#FCFAF6", "#201A09")).toBe("#201A09");
    // A mid colour neither tinted extreme clears: pure, the one with more.
    const mid = "#DB2777";
    expect(contrastRatio("#FEF8FA", mid)).toBeLessThan(AA_NORMAL_TEXT);
    expect(inkOn(mid, "#FEF8FA", "#26151A")).toBe("#FFFFFF");
    expect(contrastRatio("#FFFFFF", mid)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});

describe("validateTheme", () => {
  const neutral = PALETTES[0]?.colors;
  if (!neutral) throw new Error("no palettes");

  it("passes every predefined palette and names nothing", () => {
    for (const palette of PALETTES) expect(validateTheme(palette.colors), palette.id).toEqual([]);
  });

  it("names the pair that fails, with its ratio", () => {
    const grey = { ...neutral, "color.muted": "#8A8A8A" };
    const failing = validateTheme(grey);
    expect(failing.map((f) => [f.fg, f.bg])).toEqual([["color.muted", "color.surface"]]);
    expect(failing[0]?.ratio).toBeCloseTo(contrastRatio("#8A8A8A", "#FFFFFF"), 5);
  });

  it("judges the fill pair resolved, so white on a yellow fill fails and black on it passes", () => {
    const white = { ...neutral, "color.fill": "#FFCD00", "color.onFill": "#FFFFFF" };
    expect(validateTheme(white).map((f) => [f.fg, f.bg])).toEqual([["color.onFill", "color.fill"]]);
    const black = { ...neutral, "color.fill": "#FFCD00", "color.onFill": "#000000" };
    expect(validateTheme(black)).toEqual([]);
  });

  it("includes the glass: a dark surface with a grey ink reads flat and fails on the glass over white", () => {
    // Ink on surface flat clears 4.5; the same ink on the surface's glass over white does not, which
    // is the pair glass.test.ts would catch later for a predefined palette and this catches here.
    const dark = {
      ...neutral,
      "color.surface": "#2A2A2A",
      "color.ink": "#9A9A9A",
      "color.primary": "#9ECBFF",
      "color.secondary": "#9ECBFF",
      "color.muted": "#9A9A9A",
    };
    expect(contrastRatio("#9A9A9A", "#2A2A2A")).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(contrastRatio("#9A9A9A", mixHex("#2A2A2A", "#ffffff", 0.88))).toBeLessThan(
      AA_NORMAL_TEXT,
    );
    const failing = validateTheme(dark);
    expect(failing.some((f) => f.fg === "color.ink" && f.under === "#ffffff")).toBe(true);
  });
});

describe("legibleSteps", () => {
  const terracotta = PALETTES.find((p) => p.id === "warm-terracotta")?.colors;
  if (!terracotta) throw new Error("no terracotta");

  it("is an interval closed from above for a text colour on the surface, and from below for the surface", () => {
    const primary = legibleSteps(terracotta, "color.primary", "lightness");
    expect(primary.values).toHaveLength(LEGIBLE_STEPS.lightness);
    const firstInvalid = primary.valid.indexOf(false);
    expect(firstInvalid).toBeGreaterThan(0);
    expect(primary.valid.slice(0, firstInvalid).every(Boolean)).toBe(true);
    expect(primary.valid.slice(firstInvalid).some(Boolean)).toBe(false);
    expect(primary.valid[primary.at]).toBe(true);

    const surface = legibleSteps(terracotta, "color.surface", "lightness");
    const lastInvalid = surface.valid.lastIndexOf(false);
    expect(lastInvalid).toBeGreaterThan(0);
    expect(surface.valid.slice(0, lastInvalid + 1).some(Boolean)).toBe(false);
    expect(surface.valid.slice(lastInvalid + 1).every(Boolean)).toBe(true);
    expect(surface.valid[surface.at]).toBe(true);
  });

  it("judges only the pairs the colour is part of, and finds the accent free", () => {
    const broken = { ...terracotta, "color.muted": "#CCCCCC" };
    const primary = legibleSteps(broken, "color.primary", "lightness");
    expect(primary.valid[primary.at]).toBe(true);
    const accent = legibleSteps(terracotta, "color.accent", "hue");
    expect(accent.values).toHaveLength(LEGIBLE_STEPS.hue);
    expect(accent.valid.every(Boolean)).toBe(true);
  });

  it("walks the fill with its ink recomputed, so every step of a fill is legible by construction", () => {
    const yellow = derivePalette({ brand: "#FFCD00" }).colors;
    const fill = legibleSteps(yellow, "color.fill", "lightness");
    expect(fill.valid.every(Boolean)).toBe(true);
    const hue = legibleSteps(yellow, "color.fill", "hue");
    expect(hue.valid.every(Boolean)).toBe(true);
  });
});

describe("paletteLabel", () => {
  const terracotta = PALETTES.find((p) => p.id === "warm-terracotta");
  if (!terracotta) throw new Error("no terracotta");
  const theme = themeOf(terracotta.colors);

  it("names a chosen palette, and «personalizada» once a value moves", () => {
    expect(paletteLabel(theme, { kind: "palette", id: "warm-terracotta" })).toEqual({
      kind: "palette",
      palette: terracotta,
      customised: false,
    });
    const moved = { ...theme, "color.primary": "#7F1D1D" };
    expect(paletteLabel(moved, { kind: "palette", id: "warm-terracotta" })).toMatchObject({
      kind: "palette",
      customised: true,
    });
    // A fill pair is a customisation too: no predefined palette carries one.
    const filled = { ...theme, "color.fill": "#9A3412", "color.onFill": "#FFFFFF" };
    expect(paletteLabel(filled, { kind: "palette", id: "warm-terracotta" })).toMatchObject({
      customised: true,
    });
  });

  it("says «De tu logo», customised only against the logo's own derivation when known", () => {
    const yellow = derivePalette({ brand: "#FFCD00" }).colors;
    const fromLogo = themeOf(yellow);
    expect(paletteLabel(fromLogo, { kind: "logo" })).toEqual({ kind: "logo", customised: false });
    expect(paletteLabel(fromLogo, { kind: "logo" }, yellow)).toEqual({
      kind: "logo",
      customised: false,
    });
    const moved = { ...fromLogo, "color.muted": "#444444" };
    expect(paletteLabel(moved, { kind: "logo" }, yellow)).toEqual({
      kind: "logo",
      customised: true,
    });
    expect(paletteLabel(moved, { kind: "logo" }, null)).toEqual({
      kind: "logo",
      customised: false,
    });
  });

  it("is the owner's own, and without an origin reads as before: the palette the values match, or none", () => {
    expect(paletteLabel(theme, { kind: "own" })).toEqual({ kind: "own" });
    expect(paletteLabel(theme, undefined)).toEqual({
      kind: "palette",
      palette: terracotta,
      customised: false,
    });
    expect(paletteLabel(withPalette(theme, "neutral"), undefined)).toMatchObject({
      kind: "palette",
      palette: PALETTES[0],
    });
    expect(paletteLabel({ ...theme, "color.ink": "#000001" }, undefined)).toEqual({ kind: "none" });
    expect(paletteLabel(theme, { kind: "palette", id: "retired" })).toEqual({ kind: "none" });
  });
});
