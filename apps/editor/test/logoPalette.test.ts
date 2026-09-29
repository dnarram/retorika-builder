import { PALETTES } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  colourDistance,
  dominantColour,
  nearestPalette,
  paletteForLogo,
  parseHex,
  type Rgb,
} from "../src/editor/logoPalette.ts";

/**
 * The colours a logo chooses, and the threshold that decides when it chooses nothing.
 *
 * The questionnaire has promised «De sus colores sacamos los de toda la web» since sprint 1 and
 * `theme.ts` said in its own comment that the logo was never analysed. This is the arithmetic that
 * closes the gap — all of it pure, so all of it testable in a project with no DOM, which is the
 * whole reason the canvas lives in `logoImage.ts` instead.
 */

/** A solid block of one colour, as RGBA — what a canvas hands back for a flat logo. */
function solid(hex: string, pixels = 64, alpha = 255): Uint8ClampedArray {
  const { r, g, b } = parseHex(hex);
  const data = new Uint8ClampedArray(pixels * 4);
  for (let i = 0; i < pixels; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = alpha;
  }
  return data;
}

/** Two colours in one image, the first taking `firstCount` of `total` pixels. */
function mixed(firstHex: string, firstCount: number, secondHex: string, total: number) {
  const first = solid(firstHex, firstCount);
  const second = solid(secondHex, total - firstCount);
  const data = new Uint8ClampedArray(total * 4);
  data.set(first, 0);
  data.set(second, first.length);
  return data;
}

describe("dominantColour", () => {
  it("reads a flat logo as its own colour", () => {
    expect(dominantColour(solid("#2563EB"))).toEqual(parseHex("#2563EB"));
  });

  it("takes the most common colour, not the average of them", () => {
    // The whole reason this buckets instead of averaging: the mean of blue and red is a muddy
    // purple that is in neither, and doing that to every two-colour logo would make most brands
    // resolve to the same nothing.
    const mostlyBlue = mixed("#2563EB", 48, "#DC2626", 64);
    expect(dominantColour(mostlyBlue)).toEqual(parseHex("#2563EB"));
    const mostlyRed = mixed("#DC2626", 48, "#2563EB", 64);
    expect(dominantColour(mostlyRed)).toEqual(parseHex("#DC2626"));
  });

  it("ignores transparent pixels, which is most of a logo on transparency", () => {
    // The transparent majority is **a strong colour**, not zeroes. An all-zero field is
    // transparent *and* black, so the near-black rule alone would have thrown it away and this
    // would have passed with the alpha check deleted — which is exactly what it did in its first
    // version, found by deleting it. Here, red wins on count and loses on alpha.
    const invisibleRed = solid("#DC2626", 56, 0);
    const visibleGreen = solid("#059669", 8, 255);
    const onTransparency = new Uint8ClampedArray(64 * 4);
    onTransparency.set(invisibleRed, 0);
    onTransparency.set(visibleGreen, invisibleRed.length);
    expect(dominantColour(onTransparency)).toEqual(parseHex("#059669"));
  });

  it("ignores a half-transparent pixel too, not only a fully invisible one", () => {
    const barelyThere = solid("#DC2626", 56, 100);
    const solidGreen = solid("#059669", 8, 255);
    const logo = new Uint8ClampedArray(64 * 4);
    logo.set(barelyThere, 0);
    logo.set(solidGreen, barelyThere.length);
    expect(dominantColour(logo)).toEqual(parseHex("#059669"));
  });

  it("ignores near-white, which is the card a logo sits on", () => {
    expect(dominantColour(mixed("#FFFFFF", 56, "#9A3412", 64))).toEqual(parseHex("#9A3412"));
  });

  it("ignores near-black, which is usually the lettering or an outline", () => {
    expect(dominantColour(mixed("#000000", 56, "#047857", 64))).toEqual(parseHex("#047857"));
  });

  it("finds nothing in a logo that is only black and white — and that is the honest answer", () => {
    // A black wordmark on white has no colour to take. The sector's palette stands, and nothing
    // claims the logo chose it.
    expect(dominantColour(mixed("#FFFFFF", 32, "#101010", 64))).toBeNull();
  });

  it("finds nothing in a fully transparent image", () => {
    expect(dominantColour(new Uint8ClampedArray(64 * 4))).toBeNull();
  });

  it("gives the same answer for the same pixels, every time", () => {
    // No clock and no randomness: ties break on the bucket key rather than on `Map` order, so this
    // cannot start depending on which pixel happened to come first.
    const logo = mixed("#2563EB", 32, "#DC2626", 64);
    expect(dominantColour(logo)).toEqual(dominantColour(logo));
  });
});

describe("the measured table the threshold was set from", () => {
  /**
   * Every row of the table in `logoPalette.ts`'s own comment, asserted. If a palette's primary
   * changes, or the threshold moves, this is what says so — the number was measured, and it stays
   * measured.
   */
  const measured: [string, string, number][] = [
    ["#38BDF8", "dark-slate", 0.0],
    ["#2563EB", "classic-blue", 9.2],
    ["#059669", "forest-emerald", 13.7],
    ["#B45309", "warm-terracotta", 16.8],
    ["#0D9488", "forest-emerald", 17.1],
    ["#7C3AED", "classic-blue", 28.7],
    ["#DC2626", "warm-terracotta", 28.7],
    ["#EA580C", "warm-terracotta", 32.5],
    ["#DB2777", "warm-terracotta", 52.4],
    ["#EAB308", "warm-terracotta", 62.8],
    ["#FDE047", "warm-terracotta", 77.5],
  ];

  it.each(measured)("%s is nearest %s at ΔE %s", (hex, paletteId, distance) => {
    const colour = parseHex(hex);
    const nearest = PALETTES.map((palette) => ({
      id: palette.id,
      d: colourDistance(colour, parseHex(palette.colors["color.primary"])),
    })).sort((a, b) => a.d - b.d)[0];
    expect(nearest?.id).toBe(paletteId);
    expect(nearest?.d).toBeCloseTo(distance, 1);
  });

  it("has a real gap where the threshold sits: nothing between 32.5 and 52.4", () => {
    // This is what makes 40 a number rather than a taste. If a palette's primary ever moves into
    // that gap, the threshold stops being defensible and this fails rather than drifting.
    const distances = measured.map(([, , d]) => d);
    expect(distances.filter((d) => d > 32.5 && d < 52.4)).toEqual([]);
  });
});

describe("nearestPalette", () => {
  it("matches a blue logo to «Azul confianza»", () => {
    expect(nearestPalette(parseHex("#2563EB"))?.paletteId).toBe("classic-blue");
  });

  it("matches a rust logo to «Terracota cálida»", () => {
    expect(nearestPalette(parseHex("#B45309"))?.paletteId).toBe("warm-terracotta");
  });

  it("matches a green logo to «Verde natural»", () => {
    expect(nearestPalette(parseHex("#059669"))?.paletteId).toBe("forest-emerald");
  });

  it("refuses a yellow logo — the case the CEO asked to be checked", () => {
    // Nothing in the four palettes is yellow, and at ΔE 62.8 the nearest is not close enough to
    // tell an owner their logo chose it.
    expect(nearestPalette(parseHex("#EAB308"))).toBeNull();
  });

  it("accepts a purple logo as blue — the other case, and it did not come out as expected", () => {
    // Purple was expected to fall outside alongside yellow. It does not: at ΔE 28.7 it is exactly
    // as close to classic-blue as red is to warm-terracotta, which is a match nobody would argue
    // with. Putting it outside would need a threshold under 28.7, which would throw out red and
    // orange too. The threshold was not bent to match the expectation.
    expect(nearestPalette(parseHex("#7C3AED"))?.paletteId).toBe("classic-blue");
  });

  it("refuses a pink logo, which is the nearest thing to the line on the wrong side", () => {
    expect(nearestPalette(parseHex("#DB2777"))).toBeNull();
  });

  it("gives back how close it was, so «close» is never just a claim", () => {
    expect(nearestPalette(parseHex("#2563EB"))?.distance).toBeCloseTo(9.2, 1);
  });

  it("matches every palette's own primary to itself, at zero", () => {
    // The strongest form of the rule: a logo in exactly a palette's colour must choose that
    // palette, and no threshold or tie-break can get in the way of it.
    for (const palette of PALETTES) {
      const match = nearestPalette(parseHex(palette.colors["color.primary"]));
      expect(match?.paletteId, palette.id).toBe(palette.id);
      expect(match?.distance).toBeCloseTo(0, 5);
    }
  });
});

describe("paletteForLogo, the two halves together", () => {
  it("turns a green logo's pixels into «Verde natural»", () => {
    expect(paletteForLogo(solid("#059669"))).toBe("forest-emerald");
  });

  it("answers null for a yellow logo, for a black-and-white one, and for an empty one", () => {
    // Three different reasons, one answer on purpose: the sector's palette stands and nothing
    // tells the owner their logo chose it.
    expect(paletteForLogo(solid("#EAB308"))).toBeNull();
    expect(paletteForLogo(mixed("#FFFFFF", 32, "#101010", 64))).toBeNull();
    expect(paletteForLogo(new Uint8ClampedArray(64 * 4))).toBeNull();
  });

  it("ignores a transparent field around a coloured mark, even a brightly coloured field", () => {
    const invisibleBlue = solid("#2563EB", 236, 0);
    const visibleRust = solid("#9A3412", 20, 255);
    const logo = new Uint8ClampedArray(256 * 4);
    logo.set(invisibleBlue, 0);
    logo.set(visibleRust, invisibleBlue.length);
    expect(paletteForLogo(logo)).toBe("warm-terracotta");
  });
});

describe("colourDistance", () => {
  it("is zero for a colour against itself", () => {
    expect(colourDistance(parseHex("#2563EB"), parseHex("#2563EB"))).toBe(0);
  });

  it("is symmetric", () => {
    const a: Rgb = parseHex("#2563EB");
    const b: Rgb = parseHex("#EAB308");
    expect(colourDistance(a, b)).toBeCloseTo(colourDistance(b, a), 10);
  });

  it("ranks a near miss below a different hue", () => {
    const blue = parseHex("#2563EB");
    expect(colourDistance(blue, parseHex("#1D4ED8"))).toBeLessThan(
      colourDistance(blue, parseHex("#EAB308")),
    );
  });
});
