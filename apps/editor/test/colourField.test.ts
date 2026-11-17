import {
  buildTheme,
  contrastRatio,
  PALETTES,
  type PaletteColors,
  validateTheme,
} from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  colourOf,
  EDITABLE_KEYS,
  type EditableKey,
  legibleExtremes,
  nearestValid,
  nextValid,
  parseTypedHex,
  reachable,
  stepsFor,
  unreadableFor,
  unreadableSentence,
  withColour,
  zonesOf,
} from "../src/editor/colourField.ts";

/**
 * **The colour field's arithmetic** (sprint 38 día 7, David's P6: «lo inválido no nace»). Every step a
 * slider can stand on keeps the theme readable — judged here by `validateTheme` itself, with the glass
 * bar's pairs, independently of `legibleSteps` — and every step it cannot is painted, with a sentence.
 */
const wine = buildTheme({ paletteId: "deep-wine", typePairId: "modern-sans" }) as PaletteColors;
const yellow: PaletteColors = {
  ...(buildTheme({ paletteId: "neutral", typePairId: "modern-sans" }) as PaletteColors),
  "color.primary": "#8D7000",
  "color.fill": "#FFCD00",
  "color.onFill": "#201A09",
};

/** Whether a colour at a key leaves every pair it is part of readable, glass included. */
const readable = (colors: PaletteColors, key: EditableKey, hex: string) =>
  unreadableFor(colors, key, hex).length === 0;

describe("the steps a slider can stand on", () => {
  for (const palette of PALETTES) {
    const colors = palette.colors as PaletteColors;
    for (const key of EDITABLE_KEYS.filter((k) => k !== "color.fill")) {
      for (const axis of ["lightness", "hue"] as const) {
        it(`${palette.id} ${key} ${axis}: valid is readable and painted is not, glass included`, () => {
          const steps = stepsFor(colors, key, axis, colourOf(colors, key));
          const painted = new Set(
            zonesOf(steps, colors, key).flatMap((zone) =>
              Array.from({ length: zone.to - zone.from + 1 }, (_, i) => zone.from + i),
            ),
          );
          steps.valid.forEach((valid, index) => {
            const hex = steps.hexes[index] as string;
            // Judged here by `validateTheme` directly, not by `legibleSteps`: a slider that let a
            // colour through which breaks the glass bar would be caught at the gate, too late.
            const ok = validateTheme(withColour(colors, key, hex)).every(
              (pair) => pair.fg !== key && pair.bg !== key,
            );
            expect(ok, `${hex} at step ${index}`).toBe(valid);
            expect(painted.has(index), `step ${index} painted`).toBe(!valid);
          });
        });
      }
    }
  }

  it("runs lightness 0…100 and hue 0…355 in fives, the input's own numbers", () => {
    const light = stepsFor(wine, "color.primary", "lightness", wine["color.primary"]);
    const hue = stepsFor(wine, "color.primary", "hue", wine["color.primary"]);
    expect(light.values).toEqual(Array.from({ length: 101 }, (_, i) => i));
    expect(hue.values.at(-1)).toBe(355);
    expect(hue.values).toHaveLength(72);
  });

  it("stands where the colour is: the wine's primary at its own lightness", () => {
    const steps = stepsFor(wine, "color.primary", "lightness", wine["color.primary"]);
    expect(steps.valid[steps.at]).toBe(true);
    expect(contrastRatio(steps.hexes[steps.at] as string, wine["color.primary"])).toBeLessThan(1.1);
  });

  it("judges the fill with its ink recomputed, never edited", () => {
    const steps = stepsFor(yellow, "color.fill", "lightness", "#FFCD00");
    expect(steps.valid.filter(Boolean).length).toBeGreaterThan(80);
    const next = withColour(yellow, "color.fill", "#123456");
    expect(next["color.onFill"]).not.toBe(yellow["color.onFill"]);
    expect(contrastRatio(next["color.onFill"] as string, "#123456")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("where the hand and the arrows land", () => {
  const steps = stepsFor(wine, "color.primary", "lightness", wine["color.primary"]);
  const edges = legibleExtremes(steps);

  it("the wine's primary can be lightened only so far, and the top is out of reach", () => {
    expect(edges).not.toBeNull();
    expect(steps.valid.at(-1)).toBe(false);
    expect(edges?.first).toBe(0);
    expect(edges?.last).toBeLessThan(100);
  });

  it("an arrow on the last legible step changes nothing; one step back does", () => {
    const last = edges?.last as number;
    expect(nextValid(steps, last, 1)).toBe(last);
    expect(nextValid(steps, last, -1)).toBe(last - 1);
  });

  it("a drag into the unreachable stays on the last step that could be reached", () => {
    const last = edges?.last as number;
    expect(reachable(steps, 100, last)).toBe(last);
    expect(reachable(steps, last - 3, last)).toBe(last - 3);
  });
});

describe("the wheel and the hex, judged on their change", () => {
  it("a pale pink as the wine's primary is refused with the pair and its figure", () => {
    const pairs = unreadableFor(wine, "color.primary", "#FFD1D1");
    expect(pairs.length).toBeGreaterThan(0);
    expect(unreadableSentence("color.primary", pairs[0] as never)).toMatch(
      /^Sobre el fondo: 1,\d; necesita 4,5$/,
    );
  });

  it("«Ajustar» moves it to the legible lightness nearest its own, which reads", () => {
    const steps = stepsFor(wine, "color.primary", "lightness", "#FFD1D1");
    const at = nearestValid(steps, steps.at);
    expect(at).not.toBeNull();
    const hex = steps.hexes[at as number] as string;
    expect(readable(wine, "color.primary", hex)).toBe(true);
    expect(contrastRatio(hex, wine["color.surface"])).toBeGreaterThanOrEqual(4.5);
    // The nearest: one step lighter would not read.
    expect(steps.valid[(at as number) + 1]).toBe(false);
  });

  it("says the ground's side from the ground: the surface under the text", () => {
    const pairs = unreadableFor(wine, "color.surface", "#3A3A3A");
    expect(unreadableSentence("color.surface", pairs[0] as never)).toMatch(
      /^El texto, encima: \d,\d; necesita 4,5$/,
    );
  });
});

describe("the track's zones", () => {
  it("say David's sentence where the colour is the words", () => {
    const steps = stepsFor(wine, "color.primary", "lightness", wine["color.primary"]);
    const zones = zonesOf(steps, wine, "color.primary");
    expect(zones).toHaveLength(1);
    expect(zones[0]?.to).toBe(100);
    expect(zones[0]?.title).toBe("Por aquí deja de leerse sobre el fondo");
  });

  it("and its mirror where the colour is the ground", () => {
    const steps = stepsFor(wine, "color.surface", "lightness", wine["color.surface"]);
    const titles = zonesOf(steps, wine, "color.surface").map((zone) => zone.title);
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) expect(title).toMatch(/^Por aquí .+ deja de leerse encima$/);
  });
});

describe("a typed hex", () => {
  it("is read as the schema writes colours, or not at all", () => {
    expect(parseTypedHex("#7f1d1d")).toBe("#7F1D1D");
    expect(parseTypedHex("7F1D1D")).toBe("#7F1D1D");
    expect(parseTypedHex(" #abc ")).toBe("#AABBCC");
    expect(parseTypedHex("rojo")).toBeNull();
    expect(parseTypedHex("#12345")).toBeNull();
  });
});
