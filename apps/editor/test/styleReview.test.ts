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
import { contrastRatio, PALETTES } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  CONTRAST_BLOCKS_BELOW,
  CONTRAST_WARNS_BELOW,
  formatRatio,
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
