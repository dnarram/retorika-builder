import type { Theme } from "@retorika/schema";
import { AA_NORMAL_TEXT, CONTRAST_PAIRS, contrastRatio, PALETTES } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { FAVICON_PATH, faviconLetter, faviconSvg, render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * The site's icon (ADR 0054): the business name's first letter or digit, surface on primary, or
 * the disc alone when the name has none.
 */

const theme = (): Theme => {
  const found = loadCorpus()[0];
  if (!found) throw new Error("the corpus is empty");
  return structuredClone(found.document.theme);
};

describe("the letter", () => {
  it.each([
    ["¡Hola!", "H"],
    ['"La Tasca"', "L"],
    ["#1 Pizzas", "1"],
    ["  taberna", "T"],
    ["Ñandú", "Ñ"],
    ["Ελιά", "Ε"],
    // An «é» typed as «e» plus a combining accent is one letter, and keeps its accent.
    ["éxito", "É"],
    // An uppercase can be longer than its letter; a disc holds one.
    ["ß", "S"],
  ])("of «%s» is %s", (name, letter) => {
    expect(faviconLetter(name)).toBe(letter);
  });

  it.each([[""], ["   "], ["¡!"], ["— & —"]])("of «%s» is none", (name) => {
    expect(faviconLetter(name)).toBeUndefined();
  });
});

describe("the icon", () => {
  it("draws the letter in surface on a disc of primary", () => {
    const t = theme();
    const svg = faviconSvg(t, "Taberna del Puerto");
    expect(svg).toContain(`<circle cx="16" cy="16" r="16" fill="${t["color.primary"]}"/>`);
    expect(svg).toContain(`fill="${t["color.surface"]}">T</text>`);
    expect(svg).toContain('font-family="system-ui, sans-serif"');
  });

  it("is the disc alone for a name with no letter or digit, never a placeholder glyph", () => {
    const svg = faviconSvg(theme(), "¡!");
    expect(svg).toContain("<circle");
    expect(svg).not.toContain("<text");
  });

  it("escapes what it is given, because a theme colour is any non-empty string to the schema", () => {
    const hostile = { ...theme(), "color.primary": '"/><script>x()</script>' };
    const svg = faviconSvg(hostile, "<b>Bar</b>");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain(">B</text>");
  });

  it("is the same bytes for the same theme and name", () => {
    expect(faviconSvg(theme(), "Taberna")).toBe(faviconSvg(theme(), "Taberna"));
  });

  /**
   * Not a second measurement of the palettes — `packages/tokens` makes that one — but the claim
   * that this icon's pair is one of the proved ones, so that a change to either side is caught here.
   */
  it("uses a pair that is proved, and that clears AA in every palette", () => {
    expect(CONTRAST_PAIRS).toContainEqual({ fg: "color.surface", bg: "color.primary" });
    for (const palette of PALETTES) {
      expect(
        contrastRatio(palette.colors["color.surface"], palette.colors["color.primary"]),
        palette.id,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });
});

describe("the link", () => {
  const head = (pagePath?: string) => {
    const found = loadCorpus()[0];
    if (!found) throw new Error("the corpus is empty");
    const options = pagePath === undefined ? {} : { pagePath };
    return render(found.document, "html", options).html.split("<style>")[0] ?? "";
  };

  it("is in the head of a page that lives in a bundle, naming the file beside it", () => {
    expect(head("index.html")).toContain(
      `<link rel="icon" type="image/svg+xml" href="${FAVICON_PATH}">`,
    );
    expect(head("servicios.html")).toContain(`href="${FAVICON_PATH}"`);
  });

  it("is absent outside a bundle — the preview and the golden corpus — where no file exists", () => {
    expect(head()).not.toContain('rel="icon"');
  });
});
