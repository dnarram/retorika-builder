import { type Theme, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  buildTheme,
  contrastRatio,
  DEFAULT_SCALE_ID,
  identifyPalette,
  identifyScale,
  identifyTypePair,
  PALETTES,
  RENDERED_COLOR_KEYS,
  SCALES,
  TYPE_PAIRS,
  withPalette,
  withScale,
  withTypePair,
} from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * What the Estilo panel stands on: editing a theme in place, and asking which palette a set of
 * values came from — because a theme keeps values and not identities.
 */

const start = buildTheme({ paletteId: "classic-blue", typePairId: "modern-sans" });

describe("withPalette", () => {
  it("replaces the colours and nothing else", () => {
    const next = withPalette(start, "forest-emerald");
    for (const key of TOKEN_KEYS) {
      const expected = key.startsWith("color.")
        ? PALETTES.find((p) => p.id === "forest-emerald")?.colors[
            key as keyof (typeof PALETTES)[number]["colors"]
          ]
        : start[key];
      expect(next[key], key).toBe(expected);
    }
  });

  it("keeps the scale, which is what using buildTheme here would have thrown away", () => {
    // The whole reason this verb exists rather than a second call to buildTheme: sizes, spaces
    // and radii belong to the document, not to the palette, and a palette change must not snap
    // them back to the default scale.
    const scaled: Theme = {
      ...start,
      "size.heading": "3.5rem",
      "space.lg": "2.75rem",
      "radius.md": "0.75rem",
    };
    const next = withPalette(scaled, "dark-slate");
    expect(next["size.heading"]).toBe("3.5rem");
    expect(next["space.lg"]).toBe("2.75rem");
    expect(next["radius.md"]).toBe("0.75rem");
  });

  it("is a complete theme, still, whichever palette is asked for", () => {
    for (const palette of PALETTES) {
      const next = withPalette(start, palette.id);
      expect(Object.keys(next).sort(), palette.id).toEqual([...TOKEN_KEYS].sort());
    }
  });

  it("refuses an unknown palette rather than leaving the theme as it was", () => {
    expect(() => withPalette(start, "coral-cercano")).toThrow(/Unknown paletteId/);
  });
});

describe("withTypePair", () => {
  it("replaces the two font stacks and nothing else", () => {
    const next = withTypePair(start, "classic-display");
    expect(next["font.heading"]).toMatch(/^'Playfair Display'/);
    for (const key of TOKEN_KEYS) {
      if (!key.startsWith("font.")) expect(next[key], key).toBe(start[key]);
    }
  });

  it("composes with a palette change, so both choices survive", () => {
    const next = withTypePair(withPalette(start, "warm-terracotta"), "classic-display");
    expect(next["color.primary"]).toBe("#9A3412");
    expect(next["font.heading"]).toMatch(/^'Playfair Display'/);
  });

  it("refuses an unknown pair", () => {
    expect(() => withTypePair(start, "poppins")).toThrow(/Unknown typePairId/);
  });
});

describe("withScale", () => {
  it("replaces the eleven sizes, spaces and radii and nothing else", () => {
    const next = withScale(start, "generous");
    const generous = SCALES.find((s) => s.id === "generous");
    if (!generous) throw new Error("no generous scale");
    for (const key of TOKEN_KEYS) {
      if (key.startsWith("size.")) {
        expect(next[key], key).toBe(generous.sizes[key as keyof typeof generous.sizes]);
      } else if (key.startsWith("space.")) {
        expect(next[key], key).toBe(generous.spaces[key as keyof typeof generous.spaces]);
      } else if (key.startsWith("radius.")) {
        expect(next[key], key).toBe(generous.radii[key as keyof typeof generous.radii]);
      } else {
        expect(next[key], key).toBe(start[key]);
      }
    }
  });

  it("composes with both other choices, so all three survive", () => {
    // The property the panel's three groups rest on: pick a palette, a typeface and a scale in any
    // order and none of them undoes another. `buildTheme` cannot promise this — it assembles from
    // ids, so whichever choice is not passed snaps back to a default.
    const next = withScale(
      withTypePair(withPalette(start, "warm-terracotta"), "classic-display"),
      "compact",
    );
    expect(next["color.primary"]).toBe("#9A3412");
    expect(next["font.heading"]).toMatch(/^'Playfair Display'/);
    expect(next["size.heading"]).toBe("2rem");
  });

  it("is a complete theme, still, whichever scale is asked for", () => {
    for (const scale of SCALES) {
      const next = withScale(start, scale.id);
      expect(Object.keys(next).sort(), scale.id).toEqual([...TOKEN_KEYS].sort());
    }
  });

  it("refuses an unknown scale rather than leaving the theme as it was", () => {
    expect(() => withScale(start, "enorme")).toThrow(/Unknown scaleId/);
  });
});

describe("identifyScale", () => {
  it("names the scale a theme was built from", () => {
    for (const scale of SCALES) {
      const theme = buildTheme({
        paletteId: "classic-blue",
        typePairId: "modern-sans",
        scaleId: scale.id,
      });
      expect(identifyScale(theme)?.id).toBe(scale.id);
    }
  });

  it("says default for a theme built without asking for a scale", () => {
    // Which is every document the generator has ever produced, and the whole golden corpus.
    expect(identifyScale(start)?.id).toBe(DEFAULT_SCALE_ID);
  });

  it("follows withScale, which is what makes the panel's tick honest after a click", () => {
    expect(identifyScale(withScale(start, "generous"))?.id).toBe("generous");
  });

  it("answers undefined when a single one of the eleven has been edited by hand", () => {
    // Ten of eleven is not "this scale wrote these values". The panel shows nothing ticked, which
    // is the honest answer for a theme somebody has been editing outside the system — and it is
    // the state rule 6's «excepción marcada» will produce on purpose later in this sprint.
    expect(identifyScale({ ...start, "radius.sm": "3px" })).toBeUndefined();
  });

  it("is not fooled by a theme that mixes two scales", () => {
    expect(identifyScale({ ...withScale(start, "compact"), "space.xl": "72px" })).toBeUndefined();
  });
});

describe("identifyPalette", () => {
  it("names the palette a theme was built from", () => {
    for (const palette of PALETTES) {
      const theme = buildTheme({ paletteId: palette.id, typePairId: "modern-sans" });
      expect(identifyPalette(theme)?.id).toBe(palette.id);
    }
  });

  it("follows withPalette, which is what makes the panel's tick honest after a click", () => {
    expect(identifyPalette(withPalette(start, "dark-slate"))?.id).toBe("dark-slate");
  });

  it("answers undefined for colours no palette produced", () => {
    // A real case, not a contrived one: the renderer's own fixtures carry the Retorika brand
    // blue, and a document restored from a browser after a palette's values changed would land
    // here too. The panel shows nothing selected and says so.
    expect(identifyPalette({ ...start, "color.primary": "#123456" })).toBeUndefined();
  });

  it("is not fooled by a theme that matches on every colour but the accent", () => {
    // Five of six is not "this palette wrote these values". Nothing renders accent, but the
    // question being asked is about provenance, not about what shows.
    expect(identifyPalette({ ...start, "color.accent": "#123456" })).toBeUndefined();
  });
});

describe("identifyTypePair", () => {
  it("names the pair a theme was built from", () => {
    for (const pair of TYPE_PAIRS) {
      const theme = buildTheme({ paletteId: "classic-blue", typePairId: pair.id });
      expect(identifyTypePair(theme)?.id).toBe(pair.id);
    }
  });

  it("answers undefined for a font stack no pair declares", () => {
    expect(identifyTypePair({ ...start, "font.body": "Comic Sans MS" })).toBeUndefined();
  });
});

describe("RENDERED_COLOR_KEYS", () => {
  it("is the five the palette swatches show, and excludes the accent", () => {
    expect([...RENDERED_COLOR_KEYS]).toEqual([
      "color.primary",
      "color.secondary",
      "color.muted",
      "color.surface",
      "color.ink",
    ]);
  });

  it("holds only colours whose contrast against the surface is asserted for every palette", () => {
    // The reason accent is out, restated as an assertion rather than a comment: every key shown
    // as a swatch clears AA against its own palette's surface, or is the surface. If a future
    // palette breaks that, this fails before anyone sees the swatch.
    for (const palette of PALETTES) {
      for (const key of RENDERED_COLOR_KEYS) {
        if (key === "color.surface") continue;
        const ratio = contrastRatio(palette.colors[key], palette.colors["color.surface"]);
        expect(ratio, `${palette.id} ${key}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("would not hold the accent, which is the fact the exclusion rests on", () => {
    // Asserted rather than asserted-about: at least one palette's accent is under AA on its own
    // surface, so there is no version of this list that could include it honestly.
    const failing = PALETTES.filter(
      (p) => contrastRatio(p.colors["color.accent"], p.colors["color.surface"]) < 4.5,
    );
    expect(failing.map((p) => p.id)).toContain("classic-blue");
  });
});

describe("the Spanish names", () => {
  it("exist for every palette, every type pair and every scale", () => {
    // They are declared as `nameKey` on each entry and, until today, resolved to nothing at all:
    // this package had no locale file, and nothing had ever shown them.
    for (const palette of PALETTES) {
      expect(es, palette.id).toHaveProperty([palette.nameKey]);
      expect(es[palette.nameKey as keyof typeof es]).toBeTruthy();
    }
    for (const pair of TYPE_PAIRS) {
      expect(es, pair.id).toHaveProperty([pair.nameKey]);
      expect(es[pair.nameKey as keyof typeof es]).toBeTruthy();
    }
    for (const scale of SCALES) {
      expect(es, scale.id).toHaveProperty([scale.nameKey]);
      expect(es[scale.nameKey as keyof typeof es]).toBeTruthy();
    }
  });

  it("has no key that names nothing", () => {
    const declared = new Set([
      ...PALETTES.map((p) => p.nameKey),
      ...TYPE_PAIRS.map((t) => t.nameKey),
      ...SCALES.map((s) => s.nameKey),
    ]);
    for (const key of Object.keys(es)) expect(declared, key).toContain(key);
  });

  it("names a scale by its character and never by a number", () => {
    // Same rule the typefaces follow, for the same reason. "Compacta" says what the owner will
    // see; "0,875x" or "Pequeña" says what a developer chose — and "pequeña / mediana / grande"
    // reads as a quality ladder when none of the three is better than the others.
    for (const scale of SCALES) {
      const name = es[scale.nameKey as keyof typeof es];
      expect(name, scale.id).not.toMatch(/\d/);
      for (const forbidden of ["Pequeña", "Mediana", "Grande", "rem", "px"]) {
        expect(name, `${scale.id} / ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it("names a typeface by its character and never by a font that may not arrive", () => {
    // Issue #9: Inter and Playfair Display fall back on machines without them, and ADR 0001
    // forbids downloading either. "Inter" as a label would be a promise the page cannot keep;
    // "Moderna y neutra" is true whichever font resolves.
    const names = TYPE_PAIRS.map((t) => es[t.nameKey as keyof typeof es]);
    for (const forbidden of ["Inter", "Playfair", "Georgia", "Poppins", "Source Serif"]) {
      for (const name of names) expect(name, forbidden).not.toContain(forbidden);
    }
  });

  it("says out loud that the dark palette is dark", () => {
    // Mockup 13 calls it «Neutro elegante». It is a white-on-near-black theme, and a name that
    // does not say so hides the one thing an owner most needs to know before clicking it.
    expect(es["palette.darkSlate"]).toContain("scura");
  });
});
