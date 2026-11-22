import { readFileSync } from "node:fs";
import { EMPTY_ANSWERS, generate } from "@retorika/generator";
import { type RetorikaDocument, setTheme, type Theme } from "@retorika/schema";
import { PALETTES, STARTING_PALETTE_ID, validateTheme, withPalette } from "@retorika/tokens";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coloursOf,
  isUntouchedStart,
  loadLogoOfferDismissed,
  logoOfferFor,
  logoPalettesFor,
  originByValues,
  sameColours,
  saveLogoOfferDismissed,
  withLogoColours,
} from "../src/editor/logoColours.ts";

/**
 * The logo's colours in the editor (sprint 38 día 3, ADR 0076): the untouched start a late logo
 * repaints, the theme «De tu logo» writes, and the offer the help line makes once.
 */

/** A site the generator made without a logo: the untouched start. */
function start(): RetorikaDocument {
  return generate({
    ...EMPTY_ANSWERS,
    businessName: "Correos de barrio",
    sector: "tienda",
    services: ["Envíos"],
    mainAction: "call",
    phone: "600111222",
  }).document;
}

const LOGO = { src: "logo-0a1b2c3d.png", width: 96, height: 96 };
const withLogo = (doc: RetorikaDocument): RetorikaDocument => ({
  ...doc,
  header: { ...doc.header, brand: { ...doc.header?.brand, name: true, logo: LOGO } },
});

const YELLOW = { brand: "#FFCD00", second: null };

describe("the untouched start", () => {
  it("is a generated site without a logo, and nothing chosen since", () => {
    expect(isUntouchedStart(start())).toBe(true);
    expect(isUntouchedStart(withLogo(start()))).toBe(true);
  });

  /**
   * David's adjustment 1: «Neutra» chosen on purpose after trying another palette carries the same
   * six colours as the untouched start and an origin it does not — and a logo must not repaint it.
   */
  it("is not «Neutra» chosen in «Estilo», whose colours are the same", () => {
    const tried = setTheme(start(), withPalette(start().theme, "warm-terracotta"), {
      kind: "palette",
      id: "warm-terracotta",
    });
    const back = setTheme(tried, withPalette(tried.theme, "neutral"), {
      kind: "palette",
      id: "neutral",
    });
    expect(sameColours(back.theme, PALETTES[0]?.colors ?? ({} as never))).toBe(true);
    expect(isUntouchedStart(back)).toBe(false);
  });

  it("is not a site whose colours moved, nor one that came from a logo", () => {
    expect(isUntouchedStart(setTheme(start(), withPalette(start().theme, "classic-blue")))).toBe(
      false,
    );
    const fromLogo = generate({
      ...EMPTY_ANSWERS,
      businessName: "Correos de barrio",
      sector: "tienda",
      logoColours: YELLOW,
    }).document;
    expect(isUntouchedStart(fromLogo)).toBe(false);
  });

  it("reads a pre-1.20.0 site with «Neutra» chosen by hand as untouched — the known limit of ADR 0075", () => {
    const { palette: _none, ...saved } = setTheme(start(), start().theme, {
      kind: "palette",
      id: "neutral",
    });
    expect(isUntouchedStart(saved as RetorikaDocument)).toBe(true);
  });
});

describe("the logo's palettes", () => {
  it("derives a light one and a dark one, both readable, and says when the text takes a darker tone", () => {
    const yellow = logoPalettesFor(YELLOW);
    expect(yellow.light["color.fill"]).toBe("#FFCD00");
    expect(yellow.dark["color.primary"]).toBe("#FFCD00");
    expect(yellow.darkerForText).toBe(true);
    expect(validateTheme(yellow.light)).toEqual([]);
    expect(validateTheme(yellow.dark)).toEqual([]);
    expect(logoPalettesFor({ brand: "#2563EB", second: null }).darkerForText).toBe(false);
  });

  it("writes the colours over the theme and keeps its letter and its measures", () => {
    const doc = start();
    const yellow = logoPalettesFor(YELLOW).light;
    const theme = withLogoColours(doc.theme, yellow);
    expect(sameColours(theme, yellow)).toBe(true);
    expect(theme["font.heading"]).toBe(doc.theme["font.heading"]);
    expect(theme["space.md"]).toBe(doc.theme["space.md"]);
    // A palette without a fill of its own takes away the one before it.
    const blue = logoPalettesFor({ brand: "#2563EB", second: null }).light;
    const back = withLogoColours(theme, blue);
    expect(Object.hasOwn(back, "color.fill")).toBe(false);
    expect(sameColours(back, blue)).toBe(true);
  });
});

describe("the offer", () => {
  let storage: Map<string, string>;
  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    });
  });

  it("is made for a site with a logo that does not wear its colours", () => {
    const chosen = setTheme(withLogo(start()), withPalette(start().theme, "warm-terracotta"), {
      kind: "palette",
      id: "warm-terracotta",
    });
    expect(logoOfferFor(chosen, YELLOW, false)).toBe(true);
  });

  it("is not made without a logo, without colours read, once answered, or once the colours are worn", () => {
    const doc = withLogo(start());
    expect(logoOfferFor(start(), YELLOW, false)).toBe(false);
    expect(logoOfferFor(doc, null, false)).toBe(false);
    expect(logoOfferFor(doc, YELLOW, true)).toBe(false);
    const worn = setTheme(doc, withLogoColours(doc.theme, logoPalettesFor(YELLOW).dark), {
      kind: "logo",
    });
    expect(logoOfferFor(worn, YELLOW, false)).toBe(false);
    // The same colours with no origin recorded (a site saved before 1.20.0) are worn too.
    const { palette: _none, ...unmarked } = worn;
    expect(logoOfferFor(unmarked as RetorikaDocument, YELLOW, false)).toBe(false);
  });

  it("is remembered as answered in this browser, and a refusing browser offers again", () => {
    expect(loadLogoOfferDismissed()).toBe(false);
    expect(saveLogoOfferDismissed()).toBe(true);
    expect(storage.get("retorika.logoOffer.v1")).toBe("1");
    expect(loadLogoOfferDismissed()).toBe(true);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });
    expect(saveLogoOfferDismissed()).toBe(false);
    expect(loadLogoOfferDismissed()).toBe(false);
  });

  it("keeps the answer out of the document and the session, like the rail's", () => {
    const source = readFileSync(new URL("../src/editor/logoColours.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/autosave/);
    expect(source).toMatch(/"retorika\.logoOffer\.v1"/);
  });
});

describe("coloursOf and originByValues (sprint 40 día 7)", () => {
  const neutral = PALETTES.find((palette) => palette.id === STARTING_PALETTE_ID);

  it("takes a theme's colours alone, the fill pair only when it has one", () => {
    if (!neutral) throw new Error("no starting palette");
    const theme = { ...neutral.colors, "font.heading": "serif" } as unknown as Theme;
    expect(coloursOf(theme)).toEqual(neutral.colors);
    const filled = { ...theme, "color.fill": "#156FE7", "color.onFill": "#FFFFFF" } as Theme;
    expect(coloursOf(filled)).toEqual({
      ...neutral.colors,
      "color.fill": "#156FE7",
      "color.onFill": "#FFFFFF",
    });
  });

  it("names the predefined palette a theme's colours are, and the owner's own otherwise", () => {
    if (!neutral) throw new Error("no starting palette");
    expect(originByValues(neutral.colors as unknown as Theme)).toEqual({
      kind: "palette",
      id: STARTING_PALETTE_ID,
    });
    expect(
      originByValues({ ...neutral.colors, "color.primary": "#123456" } as unknown as Theme),
    ).toEqual({ kind: "own" });
  });
});
