import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hexToOklch, PALETTES } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  colourDistance,
  dominantColour,
  dominantColours,
  meanLuminance,
  nearestPalette,
  parseHex,
  type Rgb,
  toHex,
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

/**
 * A logo's second tint (sprint 38 día 2): the secondary and the accent of a derived palette, when
 * the logo really has one — since sprint 40 día 3 a family of hue holding at least a twentieth of the
 * counted pixels, outside the first colour's band and its neighbours, and at least ΔE 20 from it.
 */
describe("dominantColours", () => {
  it("reads one tint from a flat logo and two from a two-colour one, most present first", () => {
    expect(dominantColours(solid("#2563EB"))).toEqual([parseHex("#2563EB")]);
    expect(dominantColours(mixed("#2563EB", 48, "#DC2626", 64))).toEqual([
      parseHex("#2563EB"),
      parseHex("#DC2626"),
    ]);
    expect(dominantColours(mixed("#DC2626", 48, "#2563EB", 64))).toEqual([
      parseHex("#DC2626"),
      parseHex("#2563EB"),
    ]);
  });

  it("does not count a second colour under a twentieth of the pixels, and counts one at it", () => {
    // A tenth until sprint 40 día 3, when the second ink came to be read by families of hue: the
    // share is the family's, and five per cent sits between Retorika's wordmark (3.3 %, no second
    // tint) and its mark (9.9 %, the pink). Exactly a twentieth counts.
    expect(dominantColours(mixed("#2563EB", 96, "#DC2626", 100))).toEqual([parseHex("#2563EB")]);
    expect(dominantColours(mixed("#2563EB", 95, "#DC2626", 100))).toEqual([
      parseHex("#2563EB"),
      parseHex("#DC2626"),
    ]);
  });

  it("does not count the first colour's own fringe as a second colour", () => {
    // Two buckets apart by a few units: the anti-aliased edge of a shape, not a colour of its own.
    const fringe = mixed("#2563EB", 40, "#2F6AEE", 64);
    expect(colourDistance(parseHex("#2563EB"), parseHex("#2F6AEE"))).toBeLessThan(20);
    expect(dominantColours(fringe)).toEqual([parseHex("#2563EB")]);
  });

  it("skips a near second to reach a real one further down", () => {
    const three = new Uint8ClampedArray(100 * 4);
    three.set(solid("#2563EB", 50), 0);
    three.set(solid("#2F6AEE", 30), 50 * 4);
    three.set(solid("#DC2626", 20), 80 * 4);
    expect(dominantColours(three)).toEqual([parseHex("#2563EB"), parseHex("#DC2626")]);
  });

  it("gives nothing for a logo with no colour in it, and the same answer every time", () => {
    expect(dominantColours(solid("#FFFFFF"))).toEqual([]);
    const logo = mixed("#2563EB", 32, "#DC2626", 64);
    expect(dominantColours(logo)).toEqual(dominantColours(logo));
  });

  it("leaves the first colour where it was: the most populous bucket", () => {
    // Sprint 40 día 3 changed the second ink only. A site «De tu logo» keeps its brand colour.
    expect(dominantColours(mixed("#162642", 70, "#944C23", 100))[0]).toEqual(parseHex("#162642"));
  });

  it("writes a tint as the upper-case hex the palettes are written in", () => {
    expect(toHex({ r: 37, g: 99, b: 235 })).toBe("#2563EB");
    expect(toHex({ r: 0, g: 11, b: 43 })).toBe("#000B2B");
  });
});

/**
 * **The second ink, read by families of hue** (sprint 40 día 3, encargo 1). The defect: David's logo
 * carried its orange in 30 % of the counted pixels, split across 35 buckets of which the largest held
 * 8.2 %, and the rule of one bucket at a tenth lost it.
 */
describe("the second ink, by families of hue", () => {
  /** Pixels in order: each pair a colour and how many of it. */
  function made(parts: readonly [string, number][]): Uint8ClampedArray {
    const total = parts.reduce((sum, [, count]) => sum + count, 0);
    const data = new Uint8ClampedArray(total * 4);
    let at = 0;
    for (const [hex, count] of parts) {
      data.set(solid(hex, count), at);
      at += count * 4;
    }
    return data;
  }

  /** Twelve oranges in twelve different 8-level buckets, all in the hue band of `#944C23`
   * (38.7°–58.6°, computed and written down rather than trusted). */
  const ORANGES = [
    "#8C4423",
    "#8C4C23",
    "#8C5423",
    "#944423",
    "#944C23",
    "#945423",
    "#9C4423",
    "#9C4C23",
    "#9C5423",
    "#A44423",
    "#A44C23",
    "#A45423",
  ] as const;

  it("finds an ink no bucket of which reaches a tenth, the defect David reported", () => {
    // 300 navy and 120 orange spread evenly over twelve buckets: each 2.4 % of the counted pixels,
    // the family 28.6 % — the shape measured on his logo.
    const pixels = made([["#162642", 300], ...ORANGES.map((hex): [string, number] => [hex, 10])]);
    const [brand, second] = dominantColours(pixels);
    expect(brand).toEqual(parseHex("#162642"));
    expect(second, "the orange is lost").toBeDefined();
    const hue = second ? hexToOklch(toHex(second)).h : Number.NaN;
    expect(hue).toBeGreaterThan(38);
    expect(hue).toBeLessThan(59);
  });

  it("takes the family's most populous bucket when it holds a fifth of the family, and the mean when none does", () => {
    // David's condition: the flat colour of the stroke, not a mean. 21 of 100 → the bucket.
    const others = ORANGES.filter((hex) => hex !== "#944C23");
    const spread = (total: number): [string, number][] =>
      others.map((hex, index) => [
        hex,
        Math.floor(total / others.length) + (index < total % others.length ? 1 : 0),
      ]);
    const at21 = made([["#162642", 300], ["#944C23", 21], ...spread(79)]);
    expect(dominantColours(at21)[1]).toEqual(parseHex("#944C23"));
    // 19 of 100 → the mean of the whole family, which is not the bucket's colour.
    const family19: [string, number][] = [["#944C23", 19], ...spread(81)];
    const at19 = made([["#162642", 300], ...family19]);
    const mean = (() => {
      const total = family19.reduce((sum, [, count]) => sum + count, 0);
      const sum = family19.reduce(
        (acc, [hex, count]) => {
          const { r, g, b } = parseHex(hex);
          return { r: acc.r + r * count, g: acc.g + g * count, b: acc.b + b * count };
        },
        { r: 0, g: 0, b: 0 },
      );
      return {
        r: Math.round(sum.r / total),
        g: Math.round(sum.g / total),
        b: Math.round(sum.b / total),
      };
    })();
    expect(dominantColours(at19)[1]).toEqual(mean);
    expect(mean).not.toEqual(parseHex("#944C23"));
  });

  it("never takes the first colour's own band or its neighbours as the second", () => {
    // A blue brand with a cyan beside it (215°, the band next to the blue's 263°): the cyan is the
    // blue's shading, not a second ink — Retorika's own mark has exactly this, and its second ink is
    // the pink further round. With nothing else, there is no second tint.
    expect(
      dominantColours(
        made([
          ["#2563EB", 60],
          ["#06B6D4", 40],
        ]),
      ),
    ).toEqual([parseHex("#2563EB")]);
    expect(
      dominantColours(
        made([
          ["#2563EB", 60],
          ["#06B6D4", 30],
          ["#DC2626", 10],
        ]),
      ),
    ).toEqual([parseHex("#2563EB"), parseHex("#DC2626")]);
  });

  it("lets any band be the second for a grey first colour, which has no hue of its own", () => {
    expect(
      dominantColours(
        made([
          ["#666666", 90],
          ["#F26B1D", 10],
        ]),
      ),
    ).toEqual([parseHex("#666666"), parseHex("#F26B1D")]);
  });

  it("gives the same answer every time, whatever order the pixels come in", () => {
    const pixels = made([["#162642", 300], ...ORANGES.map((hex): [string, number] => [hex, 10])]);
    const reversed = made([
      ...[...ORANGES].reverse().map((hex): [string, number] => [hex, 10]),
      ["#162642", 300],
    ]);
    expect(dominantColours(reversed)).toEqual(dominantColours(pixels));
  });
});

/**
 * **The table measured on real logos**, from 64×64 samples the editor's own sampling took in Chromium
 * (`pnpm logo:samples`, `test/chromiumSample.ts`). Only files that are in this repository; David's
 * DNR logos are measured by the local brand test and never committed (his adjustment 5).
 * `logo-dos-tintas.png` is their stand-in: drawn for the purpose, with their structure measured — an
 * orange 30.8 % of the counted pixels in 44 buckets, the largest 7.7 % of the total — so the rule of
 * one bucket at a tenth loses it as it lost his.
 */
describe("the table measured on the repository's logos", () => {
  const sample = (name: string) =>
    new Uint8ClampedArray(
      readFileSync(join(import.meta.dirname, "fixtures", "logo-samples", `${name}.rgba`)),
    );
  const near = (colour: Rgb | undefined, hex: string) =>
    colour === undefined ? Number.POSITIVE_INFINITY : colourDistance(colour, parseHex(hex));

  it("reads the two-ink stand-in as navy and its orange's own flat colour", () => {
    const [brand, second] = dominantColours(sample("dos-tintas"));
    expect(near(brand, "#162642")).toBeLessThanOrEqual(5);
    expect(near(second, "#944C23")).toBeLessThanOrEqual(5);
  });

  it("gives Retorika's mark its pink, read as the family's mean, and its wordmark no second tint", () => {
    const [blue, pink] = dominantColours(sample("retorika-mark"));
    expect(near(blue, "#0165FB")).toBeLessThanOrEqual(5);
    expect(pink).toEqual(parseHex("#F12D66"));
    expect(dominantColours(sample("retorika-wordmark"))).toHaveLength(1);
  });

  it("leaves every flat logo of the repository with its one colour, and the white one with none", () => {
    expect(dominantColours(sample("corpus-rust"))).toEqual([parseHex("#9A3412")]);
    expect(dominantColours(sample("e2e-blue"))).toEqual([parseHex("#2563EB")]);
    expect(dominantColours(sample("e2e-yellow"))).toEqual([parseHex("#FFCD00")]);
    expect(dominantColours(sample("e2e-white"))).toEqual([]);
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
    ["#7C3AED", "lavender", 6.2],
    ["#FDE047", "midnight-gold", 9.1],
    ["#2563EB", "classic-blue", 9.2],
    ["#059669", "forest-emerald", 13.7],
    ["#EAB308", "midnight-gold", 15.1],
    ["#B45309", "warm-terracotta", 16.8],
    ["#0D9488", "forest-emerald", 17.1],
    ["#DC2626", "coral-sand", 23.7],
    ["#DB2777", "coral-sand", 26.5],
    ["#EA580C", "warm-terracotta", 32.5],
    ["#84CC16", "olive-sand", 39.0],
    ["#E60000", "coral-sand", 39.7],
    ["#FF7900", "warm-terracotta", 43.1],
  ];

  it.each(measured)("%s is nearest %s at ΔE %s", (hex, paletteId, distance) => {
    const colour = parseHex(hex);
    // The starting palette is left out, as `nearestPalette` leaves it out (ADR 0041).
    const nearest = PALETTES.filter((palette) => !palette.starting)
      .map((palette) => ({
        id: palette.id,
        d: colourDistance(colour, parseHex(palette.colors["color.primary"])),
      }))
      .sort((a, b) => a.d - b.d)[0];
    expect(nearest?.id).toBe(paletteId);
    expect(nearest?.d).toBeCloseTo(distance, 1);
  });

  it("puts the threshold between the farthest resemblance and the nearest refusal, 39.7 and 43.1", () => {
    // Narrower than sprint 6's 32.5–52.4, said in `logoPalette.ts`: eight more palettes leave fewer
    // colours far from all of them, and the sentence it gates is information, not a choice.
    const distances = measured.map(([, , d]) => d);
    expect(Math.max(...distances.filter((d) => d <= 40))).toBe(39.7);
    expect(Math.min(...distances.filter((d) => d > 40))).toBe(43.1);
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

  // Sprint 38 día 4: with thirteen palettes the cases sprint 6 asked about came out differently, and
  // the sentence they gate is information now (ADR 0076). Yellow resembles «Medianoche y oro», purple
  // resembles «Lavanda» rather than blue, pink resembles «Coral y arena»; a postal orange resembles
  // nothing near enough to say.
  it("names the resemblances the new palettes brought, and still refuses a postal orange", () => {
    expect(nearestPalette(parseHex("#EAB308"))?.paletteId).toBe("midnight-gold");
    expect(nearestPalette(parseHex("#7C3AED"))?.paletteId).toBe("lavender");
    expect(nearestPalette(parseHex("#DB2777"))?.paletteId).toBe("coral-sand");
    expect(nearestPalette(parseHex("#FF7900"))).toBeNull();
  });

  it("gives back how close it was, so «close» is never just a claim", () => {
    expect(nearestPalette(parseHex("#2563EB"))?.distance).toBeCloseTo(9.2, 1);
  });

  it("matches every palette's own primary to itself, at zero — except the neutral start", () => {
    // The strongest form of the rule: a logo in exactly a palette's colour must choose that
    // palette, and no threshold or tie-break can get in the way of it. The neutral start is the
    // one exception (ADR 0041): it is not a colour a logo chooses, so its own blue lands on the
    // nearest palette of colour instead.
    for (const palette of PALETTES) {
      const match = nearestPalette(parseHex(palette.colors["color.primary"]));
      if (palette.starting) {
        expect(match?.paletteId, palette.id).toBe("classic-blue");
        continue;
      }
      expect(match?.paletteId, palette.id).toBe(palette.id);
      expect(match?.distance).toBeCloseTo(0, 5);
    }
  });
});

describe("dominantColour over a transparent field", () => {
  it("ignores a transparent field around a coloured mark, even a brightly coloured field", () => {
    const invisibleBlue = solid("#2563EB", 236, 0);
    const visibleRust = solid("#9A3412", 20, 255);
    const logo = new Uint8ClampedArray(256 * 4);
    logo.set(invisibleBlue, 0);
    logo.set(visibleRust, invisibleBlue.length);
    expect(dominantColour(logo)).toEqual(parseHex("#9A3412"));
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

describe("the neutral start is not a colour a logo chooses (ADR 0041)", () => {
  it("sends a logo in Retorika's own blue to classic-blue, never to the neutral palette", () => {
    expect(nearestPalette(parseHex("#156FE7"))?.paletteId).toBe("classic-blue");
  });
});

describe("meanLuminance (ADR 0059)", () => {
  it("reads white as 1, black as 0, and a mid grey as WCAG does", () => {
    expect(meanLuminance(solid("#FFFFFF"))).toBeCloseTo(1, 5);
    expect(meanLuminance(solid("#000000"))).toBeCloseTo(0, 5);
    // #808080 is 0.2159 in WCAG's own tables — linear, not the 0.5 a naive average would give.
    expect(meanLuminance(solid("#808080"))).toBeCloseTo(0.2159, 3);
  });

  it("is null for a wholly transparent image: nothing is visible, so nothing is light or dark", () => {
    expect(meanLuminance(solid("#FFFFFF", 64, 0))).toBeNull();
    expect(meanLuminance(new Uint8ClampedArray())).toBeNull();
  });

  it("weighs a pixel by its alpha, so a transparent ground counts for nothing", () => {
    // A white mark on a transparent field reads as white, however small the mark: on the bar, the
    // field is the bar. Half the pixels opaque white, half transparent black.
    const data = new Uint8ClampedArray(8 * 4);
    for (let i = 0; i < 8; i += 1) {
      const white = i < 4;
      data.set([white ? 255 : 0, white ? 255 : 0, white ? 255 : 0, white ? 255 : 0], i * 4);
    }
    expect(meanLuminance(data)).toBeCloseTo(1, 5);
    // And a half-transparent black pixel beside an opaque white one pulls the mean down by a third,
    // not a half: it shows half of itself.
    const mixed = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 128]);
    expect(meanLuminance(mixed)).toBeCloseTo(255 / (255 + 128), 3);
  });
});
