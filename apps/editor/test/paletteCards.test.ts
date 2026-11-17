import { buildTheme, PALETTES, withPalette } from "@retorika/tokens";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { logoPalettesFor } from "../src/editor/logoColours.ts";
import { paletteCards, StylePanel, stripeOf } from "../src/questionnaire/StylePanel.tsx";

/**
 * **The palettes as cards** (sprint 38 día 6, David's P7): which card the site wears is computed from
 * the theme and its origin, the stripe shows the fill where the page fills, and the grid is a
 * `radiogroup` of buttons with one Tab stop.
 */
const neutral = buildTheme({ paletteId: "neutral", typePairId: "modern-sans" });
const yellow = logoPalettesFor({ brand: "#FFCD00", second: null });
const noop = () => {};

function cardsOf(overrides: Partial<Parameters<typeof paletteCards>[0]> = {}) {
  return paletteCards({
    theme: neutral,
    origin: undefined,
    logoPalettes: null,
    logoColours: null,
    onPickPalette: noop,
    ...overrides,
  });
}

describe("the stripe", () => {
  it("paints the fill first when the palette has one, and the primary when it has not", () => {
    // The yellow logo's light palette: the page fills its buttons with the exact yellow and writes
    // its headlines in the darker sibling. A stripe showing the sibling would show ochre where the
    // site shows yellow.
    expect(stripeOf(yellow.light)[0]).toBe("#FFCD00");
    expect(stripeOf(yellow.light)[0]).not.toBe(yellow.light["color.primary"]);
    expect(stripeOf(neutral)[0]).toBe(neutral["color.primary"]);
    expect(stripeOf(neutral)).toHaveLength(5);
  });
});

describe("which card the site wears", () => {
  it("is the palette the values match when there is no origin, and «Neutra» for the start", () => {
    const { cards, selectedId } = cardsOf();
    expect(selectedId).toBe("neutral");
    expect(cards.map((card) => card.id)).toEqual([...PALETTES.map((p) => p.id), "own"]);
    expect(cards.filter((card) => card.selected).map((card) => card.id)).toEqual(["neutral"]);
    expect(cards.at(-1)).toMatchObject({ id: "own", colors: null, selected: false });
  });

  it("is the origin's palette, «personalizada» once a colour moved", () => {
    const wine = withPalette(neutral, "deep-wine");
    const chosen = cardsOf({ theme: wine, origin: { kind: "palette", id: "deep-wine" } });
    expect(chosen.cards.find((card) => card.id === "deep-wine")).toMatchObject({
      selected: true,
      customised: false,
    });
    const moved = cardsOf({
      theme: { ...wine, "color.secondary": "#000000" },
      origin: { kind: "palette", id: "deep-wine" },
    });
    expect(moved.selectedId).toBe("deep-wine");
    expect(moved.cards.find((card) => card.id === "deep-wine")?.customised).toBe(true);
    // A palette the values match but the origin does not name: the origin wins (ADR 0075).
    expect(cardsOf({ theme: wine }).selectedId).toBe("deep-wine");
  });

  it("puts the logo's two cards first, the dark one chosen when the site wears it", () => {
    const dark = cardsOf({
      theme: { ...neutral, ...yellow.dark },
      origin: { kind: "logo" },
      logoPalettes: yellow,
      logoColours: { brand: "#FFCD00", second: null },
      onPickLogoPalette: noop,
    });
    expect(dark.cards.slice(0, 2).map((card) => card.name)).toEqual([
      "De tu logo",
      "De tu logo, oscura",
    ]);
    expect(dark.selectedId).toBe("logo-dark");
    expect(dark.note).toContain("un tono más oscuro");
    // Without the pick, no logo cards: the panel has nothing to write them with.
    expect(cardsOf({ logoPalettes: yellow }).cards[0]?.id).toBe("neutral");
  });

  it("is «Tu paleta» for an own origin, carrying the theme's colours", () => {
    const own = cardsOf({
      theme: { ...neutral, "color.primary": "#123456" },
      origin: { kind: "own" },
    });
    expect(own.selectedId).toBe("own");
    expect(own.cards.at(-1)?.colors?.["color.primary"]).toBe("#123456");
  });

  it("is none for colours no card stands for", () => {
    expect(
      cardsOf({ theme: { ...neutral, "color.primary": "#123456" } }).selectedId,
    ).toBeUndefined();
  });
});

describe("the grid, rendered", () => {
  const html = renderToStaticMarkup(
    createElement(StylePanel, {
      theme: neutral,
      fonts: [],
      fontUrls: new Map(),
      onPickPalette: noop,
      logoPalettes: yellow,
      logoColours: { brand: "#FFCD00", second: null },
      onPickLogoPalette: noop,
      onPickTypePair: noop,
      onOpenChooser: noop,
      onPickScale: noop,
      designTools: false,
      onClose: noop,
    }),
  );

  it("is a radiogroup of buttons, not of inputs, with one Tab stop on the chosen card", () => {
    const radios = html.match(/<button type="button" role="radio"[^>]*>/g) ?? [];
    expect(radios).toHaveLength(2 + PALETTES.length + 1);
    expect(html).not.toMatch(
      /<input type="radio"[^>]*name="[^"]*"[^>]*>[^<]*<span class="flex gap-1\.5"/,
    );
    expect(radios.filter((radio) => radio.includes('tabindex="0"'))).toHaveLength(1);
    expect(radios.filter((radio) => radio.includes('aria-checked="true"'))).toHaveLength(1);
    expect(radios.find((radio) => radio.includes('tabindex="0"'))).toContain(
      'data-palette="neutral"',
    );
  });

  it("keeps «Se parece a» out of the logo card's name and in its description", () => {
    const logo = html.match(
      /<button type="button" role="radio"[^>]*data-palette="logo-light"[^>]*>/,
    )?.[0];
    expect(logo).toMatch(/aria-describedby="/);
    expect(html).toMatch(
      /aria-hidden="true" class="[^"]*">Se parece a «[^»]+», pero son los tuyos\./,
    );
  });

  it("opens the chosen card's swatches under its row, each with its role and its hex", () => {
    const swatches = html.match(
      /<fieldset aria-label="Los colores de «Neutra»"[\s\S]*?<\/fieldset>/,
    )?.[0];
    expect(swatches).toBeDefined();
    expect(swatches).toContain(neutral["color.primary"]);
    expect(swatches).toContain(">Principal<");
    expect(swatches).toContain(">Fondo<");
    expect(swatches).not.toContain(">Relleno<");
    // After «Azul confianza», the row-mate of «Neutra», not after «Neutra» itself.
    const azul = html.indexOf('data-palette="classic-blue"');
    const group = html.indexOf('aria-label="Los colores de «Neutra»"');
    expect(group).toBeGreaterThan(azul);
  });
});

describe("the chosen card, once its colours can move (día 7)", () => {
  const wine = withPalette(neutral, "deep-wine");
  const moved = { ...wine, "color.primary": "#B9534D" };

  it("shows the colours the site wears, not the catalog's, and carries its origin", () => {
    const { cards } = cardsOf({ theme: moved, origin: { kind: "palette", id: "deep-wine" } });
    const card = cards.find((c) => c.id === "deep-wine");
    expect(card?.colors?.["color.primary"]).toBe("#B9534D");
    expect(card?.origin).toEqual({ kind: "palette", id: "deep-wine" });
    // A card the site does not wear still shows the catalog's.
    expect(cards.find((c) => c.id === "classic-blue")?.colors?.["color.primary"]).toBe("#1D4ED8");
    expect(cards.at(-1)?.origin).toEqual({ kind: "own" });
  });

  it("is named «Vino tinto, personalizada», the label ADR 0075 computes", () => {
    const html = renderToStaticMarkup(
      createElement(StylePanel, {
        theme: moved,
        origin: { kind: "palette", id: "deep-wine" },
        fonts: [],
        fontUrls: new Map(),
        onPickPalette: noop,
        logoPalettes: null,
        logoColours: null,
        onPickTypePair: noop,
        onOpenChooser: noop,
        onPickScale: noop,
        designTools: false,
        onClose: noop,
        onSetColours: noop,
        onAdjustColours: noop,
        onSettleColours: noop,
      }),
    );
    const card =
      html.match(/<button[^>]*data-palette="deep-wine"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(card).toContain('aria-label="Vino tinto, personalizada"');
    // «Volver a la original» and a «Cambiar» per colour that can move — five, no fill, no accent.
    expect(html).toContain(">Volver a la original<");
    expect(html.match(/aria-label="Cambiar «[^»]+»"/g)).toHaveLength(5);
  });

  it("offers no «Cambiar» without the handlers, and none on a card the site does not wear", () => {
    const html = renderToStaticMarkup(
      createElement(StylePanel, {
        theme: neutral,
        fonts: [],
        fontUrls: new Map(),
        onPickPalette: noop,
        logoPalettes: null,
        logoColours: null,
        onPickTypePair: noop,
        onOpenChooser: noop,
        onPickScale: noop,
        designTools: false,
        onClose: noop,
      }),
    );
    expect(html).not.toContain("Cambiar «");
  });

  it("a logo palette moved by hand stays the dark card when its ground is dark", () => {
    const dark = { ...neutral, ...yellow.dark, "color.secondary": "#FFE680" };
    const chosen = cardsOf({
      theme: dark,
      origin: { kind: "logo" },
      logoPalettes: yellow,
      logoColours: { brand: "#FFCD00", second: null },
      onPickLogoPalette: noop,
    });
    expect(chosen.selectedId).toBe("logo-dark");
    expect(chosen.cards.find((c) => c.id === "logo-dark")?.customised).toBe(true);
  });
});
