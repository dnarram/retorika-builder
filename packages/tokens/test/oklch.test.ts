import { describe, expect, it } from "vitest";
import {
  hexToOklch,
  hexToRgb,
  inGamut,
  maxChroma,
  oklchToHex,
  PALETTES,
  rgbToHex,
  toGamut,
} from "../src/index.ts";

/**
 * The colour space the engine moves in (sprint 38 día 2): round trips to the byte, the known
 * landmarks of OKLCH, and a gamut clip that keeps lightness and hue and gives up chroma only.
 */
describe("sRGB ↔ OKLCH", () => {
  it("round-trips every colour of every palette to the same bytes", () => {
    for (const palette of PALETTES) {
      for (const hex of Object.values(palette.colors)) {
        expect(oklchToHex(hexToOklch(hex)), `${palette.id} ${hex}`).toBe(hex.toUpperCase());
      }
    }
  });

  it("round-trips the whole cube at a coarse step, to the byte", () => {
    for (let r = 0; r < 256; r += 51) {
      for (let g = 0; g < 256; g += 51) {
        for (let b = 0; b < 256; b += 51) {
          const hex = rgbToHex([r, g, b]);
          expect(oklchToHex(hexToOklch(hex)), hex).toBe(hex);
        }
      }
    }
  });

  it("knows its landmarks: white is lightness 1, black 0, a pure red sits near hue 29°", () => {
    expect(hexToOklch("#FFFFFF").L).toBeCloseTo(1, 3);
    expect(hexToOklch("#000000").L).toBeCloseTo(0, 3);
    expect(hexToOklch("#808080").C).toBeLessThan(0.001);
    const red = hexToOklch("#FF0000");
    expect(red.h).toBeGreaterThan(28);
    expect(red.h).toBeLessThan(30);
    expect(red.C).toBeGreaterThan(0.25);
  });

  it("reads a short hex and refuses what is not a colour", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#1D4ED8")).toEqual([29, 78, 216]);
    expect(() => hexToRgb("red")).toThrow(/Not a hex colour/);
    expect(() => hexToRgb("#12")).toThrow(/Not a hex colour/);
  });

  it("brings a colour into gamut by chroma alone, keeping lightness and hue", () => {
    const loud = { L: 0.7, C: 0.4, h: 140 };
    expect(inGamut(loud)).toBe(false);
    const fitted = toGamut(loud);
    expect(inGamut(fitted)).toBe(true);
    expect(fitted.L).toBe(loud.L);
    expect(fitted.h).toBe(loud.h);
    expect(fitted.C).toBeLessThan(loud.C);
    expect(fitted.C).toBeGreaterThan(0);
    // Already in gamut: untouched.
    const quiet = { L: 0.5, C: 0.05, h: 140 };
    expect(toGamut(quiet)).toBe(quiet);
  });

  it("finds the most chroma a lightness and hue can show, and it is the clip's answer", () => {
    const most = maxChroma(0.7, 140);
    expect(inGamut({ L: 0.7, C: most, h: 140 })).toBe(true);
    expect(inGamut({ L: 0.7, C: most + 0.01, h: 140 })).toBe(false);
    // Near black and near white almost nothing fits.
    expect(maxChroma(0.02, 140)).toBeLessThan(0.02);
    expect(maxChroma(0.99, 140)).toBeLessThan(0.02);
  });

  it("is deterministic and writes upper-case bytes", () => {
    const colour = { L: 0.6234, C: 0.1512, h: 211.7 };
    expect(oklchToHex(colour)).toBe(oklchToHex({ ...colour }));
    expect(oklchToHex(colour)).toMatch(/^#[0-9A-F]{6}$/);
  });
});
