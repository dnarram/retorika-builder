import {
  parseDocument,
  type RetorikaDocument,
  SCHEMA_VERSION,
  type Section,
  type StyleValue,
  setElementStyle,
  type Theme,
  TOKEN_KEYS,
} from "@retorika/schema";
import { contrastRatio, PALETTES, relativeLuminance, withFamily } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  CONTRAST_BLOCKS_BELOW,
  CONTRAST_WARNS_BELOW,
  formatRatio,
  headerBarBackground,
  LOGO_CONTRAST_WARNS_BELOW,
  reviewLogo,
  reviewStyle,
} from "../src/editor/styleReview.ts";

/**
 * The pre-publish contrast review, with every threshold provoked on purpose.
 *
 * The colours below are chosen by measuring rather than by eye — `ratioOnWhite` finds a grey with a
 * given ratio against `color.surface`, so «just under 3» and «just over 3» are exactly that and not
 * "a grey that looked about right". A threshold test whose inputs were guessed is a test that
 * passes for the wrong reason the first time somebody moves the number.
 */

const classicBlue = PALETTES.find((palette) => palette.id === "classic-blue");
if (!classicBlue) throw new Error("no classic-blue palette");
const theme = {
  ...(Object.fromEntries(TOKEN_KEYS.map((key) => [key, "1rem"])) as Theme),
  ...classicBlue.colors,
} as Theme;

/** The grey whose contrast against #FFFFFF is closest to `target`, found by bisection. */
function greyAt(target: number): string {
  let low = 0;
  let high = 255;
  for (let i = 0; i < 24; i += 1) {
    const mid = Math.round((low + high) / 2);
    const hex = `#${mid.toString(16).padStart(2, "0").repeat(3)}`;
    if (contrastRatio(hex, "#FFFFFF") > target) low = mid;
    else high = mid;
  }
  return `#${low.toString(16).padStart(2, "0").repeat(3)}`;
}

const section: Section = {
  id: "sec-cover",
  preset: { catalogId: "cover", variantId: "image-right" },
  source: "catalog",
  layout: null,
  content: [
    {
      id: "el-headline",
      role: "heading",
      hidden: false,
      slot: "headline",
      value: { kind: "text", text: "Barbería El Corte" },
    },
    {
      id: "el-body",
      role: "body",
      hidden: false,
      slot: "body",
      value: { kind: "text", text: "Cortes y barbas" },
    },
    {
      id: "el-cta",
      role: "button",
      hidden: false,
      slot: "primaryAction",
      value: { kind: "link", text: "Llamar", href: "tel:+34600111222" },
    },
    {
      id: "el-oculto",
      role: "body",
      hidden: true,
      slot: "body",
      value: { kind: "text", text: "Oculto" },
    },
  ],
};

function docWith(
  ...styles: [elementId: string, property: "color" | "padding", value: StyleValue][]
): RetorikaDocument {
  let doc = parseDocument({
    schemaVersion: SCHEMA_VERSION,
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    pages: [{ id: "home", slug: "index", title: "Inicio", sections: [section] }],
    collections: [],
  });
  for (const [elementId, property, value] of styles) {
    doc = setElementStyle(doc, { sectionId: "sec-cover", elementId }, property, value);
  }
  return doc;
}

const exact = (hex: string): StyleValue => ({ exact: hex, exception: true });

describe("the two thresholds", () => {
  it("are WCAG's own, not numbers picked for this product", () => {
    // 3:1 is the large-text threshold, so a colour under it fails even the most forgiving bar the
    // standard offers, at any size. 4.5:1 is AA for normal text.
    expect(CONTRAST_BLOCKS_BELOW).toBe(3);
    expect(CONTRAST_WARNS_BELOW).toBe(4.5);
  });

  it("blocks just under 3:1 and only warns just over it", () => {
    const under = greyAt(2.9);
    const over = greyAt(3.1);
    expect(contrastRatio(under, "#FFFFFF")).toBeLessThan(3);
    expect(contrastRatio(over, "#FFFFFF")).toBeGreaterThan(3);

    expect(reviewStyle(docWith(["el-body", "color", exact(under)])).blocking).toHaveLength(1);
    expect(reviewStyle(docWith(["el-body", "color", exact(under)])).warning).toHaveLength(0);
    expect(reviewStyle(docWith(["el-body", "color", exact(over)])).blocking).toHaveLength(0);
    expect(reviewStyle(docWith(["el-body", "color", exact(over)])).warning).toHaveLength(1);
  });

  it("warns just under 4.5:1 and says nothing at all just over it", () => {
    const under = greyAt(4.4);
    const over = greyAt(4.6);
    const quiet = reviewStyle(docWith(["el-body", "color", exact(over)]));
    expect(reviewStyle(docWith(["el-body", "color", exact(under)])).warning).toHaveLength(1);
    expect(quiet.blocking).toEqual([]);
    expect(quiet.warning).toEqual([]);
  });

  it("says nothing about black on white, which is the ordinary case", () => {
    const review = reviewStyle(docWith(["el-body", "color", exact("#000000")]));
    expect(review.blocking).toEqual([]);
    expect(review.warning).toEqual([]);
  });
});

describe("what the review looks at", () => {
  it("measures against the element's own background, so a button is judged differently", () => {
    // White text is invisible on white and perfectly readable on `color.primary`. One colour, two
    // verdicts, decided by which element carries it — which is the whole reason `backgroundOf`
    // exists rather than a single page-wide assumption.
    expect(reviewStyle(docWith(["el-body", "color", exact("#FFFFFF")])).blocking).toHaveLength(1);
    const onButton = reviewStyle(docWith(["el-cta", "color", exact("#FFFFFF")]));
    expect(onButton.blocking).toEqual([]);
    expect(onButton.warning).toEqual([]);
  });

  it("ignores a hidden element, which publishes nothing", () => {
    // The renderer drops a hidden element entirely, so blocking a download over a colour nobody
    // can see is the mistake `listDeadDestinations` already refuses to make. The `Diseño` panel's
    // audit still shows it — one list, two readers.
    const review = reviewStyle(docWith(["el-oculto", "color", exact("#FEFEFE")]));
    expect(review.blocking).toEqual([]);
    expect(review.warning).toEqual([]);
  });

  it("ignores a padding exception, which makes no legibility claim", () => {
    // Judging it would mean inventing a rule nobody has stated, which is how a gate starts blocking
    // things for reasons its own author cannot defend.
    const review = reviewStyle(docWith(["el-body", "padding", exact("40px")]));
    expect(review.blocking).toEqual([]);
    expect(review.warning).toEqual([]);
  });

  it("ignores a reference, because every reference the toolbar writes is already proved", () => {
    const review = reviewStyle(docWith(["el-body", "color", { ref: "color.muted" }]));
    expect(review.blocking).toEqual([]);
    expect(review.warning).toEqual([]);
  });

  it("says nothing about a document with no style at all", () => {
    // Every document this product has ever produced. The review must be silent for all of them.
    expect(reviewStyle(docWith())).toEqual({ blocking: [], warning: [] });
  });

  it("says nothing about a letter chosen from the gallery, which is a reference and not an exception", () => {
    /**
     * **The download gate of ADR 0046, as a test rather than as a claim in a plan.** A family
     * chosen by name writes a **theme token**, not an element's own style, so rule 6 has no
     * exception to report and the gate has nothing to warn about. The review would have to invent
     * a rule nobody has stated to say otherwise — the same mistake the padding case above refuses.
     */
    const plain = docWith();
    const both = {
      ...plain,
      theme: withFamily(
        withFamily(plain.theme, "font.heading", "Spectral"),
        "font.body",
        "Figtree",
      ),
    };
    expect(reviewStyle(both)).toEqual({ blocking: [], warning: [] });
    // And it is the same answer as before the choice, which is the point: choosing a letter cannot
    // make a document any more or less publishable.
    expect(reviewStyle(both)).toEqual(reviewStyle(plain));
  });

  it("reports several, and separates them by level", () => {
    const review = reviewStyle(
      docWith(["el-headline", "color", exact(greyAt(2.5))], ["el-body", "color", exact(greyAt(4))]),
    );
    expect(review.blocking.map((f) => f.exception.elementId)).toEqual(["el-headline"]);
    expect(review.warning.map((f) => f.exception.elementId)).toEqual(["el-body"]);
  });

  it("carries the words a person recognises, and the measured ratio", () => {
    const [finding] = reviewStyle(docWith(["el-headline", "color", exact(greyAt(2.5))])).blocking;
    expect(finding?.exception.label).toBe("Barbería El Corte");
    expect(finding?.ratio).toBeCloseTo(2.5, 1);
    expect(finding?.level).toBe("block");
  });
});

describe("formatRatio", () => {
  it("writes the number the way Spanish does", () => {
    expect(formatRatio(3.44)).toBe("3,4");
    expect(formatRatio(12)).toBe("12,0");
  });
});

/**
 * **The header's parts, against the bar they sit on** (ADR 0057, sprint 30 día 2): the words are
 * judged against the scheme's background, or the exact one the owner painted the bar with; the bar's
 * own colour is a background and makes no legibility claim; the button's words are judged against the
 * button. The findings arrive addressed to `header` and the part, which is where the «Menú» panel is.
 */
describe("the header's parts", () => {
  const headerDoc = (header: RetorikaDocument["header"]): RetorikaDocument =>
    parseDocument({
      schemaVersion: SCHEMA_VERSION,
      id: "doc-cabecera",
      siteName: "Barbería El Corte",
      theme,
      header,
      pages: [{ id: "home", slug: "index", title: "Inicio", sections: [section] }],
      collections: [],
    });

  it("judges a link colour against the scheme's background, and finds white on white unreadable", () => {
    const review = reviewStyle(headerDoc({ style: { pagesLinks: { color: exact("#FFFFFF") } } }));
    expect(
      review.blocking.map((f) => [f.exception.sectionId, f.exception.elementId, f.exception.role]),
    ).toEqual([["header", "pagesLinks", "link"]]);
    // The same white on an `ink` bar is the proved pair, and nothing is said.
    expect(
      reviewStyle(
        headerDoc({
          look: { background: "ink" },
          style: { pagesLinks: { color: exact("#FFFFFF") } },
        }),
      ).blocking,
    ).toEqual([]);
  });

  it("judges the words against the exact bar the owner painted, when there is one", () => {
    const dark = headerDoc({
      style: { bar: { color: exact("#111111") }, brand: { color: exact("#222222") } },
    });
    const review = reviewStyle(dark);
    expect(review.blocking.map((f) => f.exception.elementId)).toEqual(["brand"]);
    // The bar's own colour is a background: it is listed nowhere as a finding.
    expect(
      [...review.blocking, ...review.warning].some((f) => f.exception.elementId === "bar"),
    ).toBe(false);
  });

  it("judges the button's words against the button, which inverts on a coloured bar", () => {
    // On a surface bar the button is `color.primary`: blue words on a blue button block.
    const onSurface = headerDoc({ style: { action: { color: exact(theme["color.primary"]) } } });
    expect(reviewStyle(onSurface).blocking.map((f) => f.exception.role)).toEqual(["button"]);
    // On a primary bar the button is `color.surface`: the same blue words read fine.
    const onPrimary = headerDoc({
      look: { background: "primary" },
      style: { action: { color: exact(theme["color.primary"]) } },
    });
    expect(reviewStyle(onPrimary).blocking).toEqual([]);
  });

  it("warns between the two thresholds, as it does for an element", () => {
    const review = reviewStyle(
      headerDoc({ style: { sectionsLinks: { color: exact(greyAt(3.6)) } } }),
    );
    expect(review.blocking).toEqual([]);
    expect(review.warning.map((f) => [f.exception.elementId, f.level])).toEqual([
      ["sectionsLinks", "warn"],
    ]);
  });

  it("says nothing about a header dressed in references, or in sizes", () => {
    const refs = headerDoc({
      look: { background: "secondary" },
      style: { pagesLinks: { color: { ref: "color.ink" } }, bar: { padding: exact("12px") } },
    });
    expect(reviewStyle(refs)).toEqual({ blocking: [], warning: [] });
  });
});

describe("the logo on its bar (ADR 0059, David's adjustment 4)", () => {
  const logoDoc = (header: RetorikaDocument["header"]): RetorikaDocument =>
    parseDocument({
      schemaVersion: SCHEMA_VERSION,
      id: "doc-logo",
      siteName: "Barbería El Corte",
      theme,
      header: { ...header, brand: { ...header?.brand, logo: { src: "logo-3f9a7c21.png" } } },
      pages: [{ id: "home", slug: "index", title: "Inicio", sections: [section] }],
      collections: [],
    });
  const white = 1;
  const black = 0;

  it("warns about a white logo on the light surface bar, and says nothing on an ink bar", () => {
    const light = reviewLogo(logoDoc({}), white);
    expect(light).toMatchObject({ src: "logo-3f9a7c21.png", background: theme["color.surface"] });
    expect(light?.ratio).toBeLessThan(LOGO_CONTRAST_WARNS_BELOW);
    expect(reviewLogo(logoDoc({ look: { background: "ink" } }), white)).toBeUndefined();
    // And the mirror: a black mark reads on surface, not on ink.
    expect(reviewLogo(logoDoc({}), black)).toBeUndefined();
    expect(reviewLogo(logoDoc({ look: { background: "ink" } }), black)).toBeDefined();
  });

  it("holds the logo to 3:1 — WCAG's line for a graphic — and not to text's 4.5", () => {
    expect(LOGO_CONTRAST_WARNS_BELOW).toBe(3);
    expect(LOGO_CONTRAST_WARNS_BELOW).toBe(CONTRAST_BLOCKS_BELOW);
    // The luminance of a logo darker than this theme's surface, just either side of 3:1 against
    // it — from the formula's inverse, so «just» is a measured 0.002 and not a guess.
    const behind = relativeLuminance(theme["color.surface"]);
    expect(contrastRatio("#000000", theme["color.surface"])).toBeGreaterThan(3);
    const justUnder = (behind + 0.05) / 3 - 0.05 + 0.002;
    const justOver = (behind + 0.05) / 3 - 0.05 - 0.002;
    expect(reviewLogo(logoDoc({}), justUnder)).toBeDefined();
    expect(reviewLogo(logoDoc({}), justOver)).toBeUndefined();
  });

  it("says nothing without a logo, or before its bytes have been read", () => {
    expect(reviewLogo(logoDoc({}), null)).toBeUndefined();
    const noLogo = parseDocument({
      schemaVersion: SCHEMA_VERSION,
      id: "doc-sin-logo",
      siteName: "Barbería El Corte",
      theme,
      header: { brand: { name: true } },
      pages: [{ id: "home", slug: "index", title: "Inicio", sections: [section] }],
      collections: [],
    });
    expect(reviewLogo(noLogo, white)).toBeUndefined();
  });

  it("judges against the exact bar the owner painted, when there is one", () => {
    const painted = logoDoc({ style: { bar: { color: exact("#111111") } } });
    expect(headerBarBackground(painted)).toBe("#111111");
    expect(reviewLogo(painted, white)).toBeUndefined();
    expect(reviewLogo(painted, black)?.background).toBe("#111111");
  });
});
