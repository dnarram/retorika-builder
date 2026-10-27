import { describe, expect, it } from "vitest";
import {
  FONT_FAMILY_PATTERN,
  FONT_GALLERY,
  FONT_KINDS,
  fontFamilySlug,
  GENERIC_OF,
} from "../src/fontGallery.ts";

/**
 * The one hand-written list of families (ADR 0055), held to the conditions the derivations rely on.
 * The faces, the stacks and the sources are derived from it in three other packages and tested there;
 * what is tested here is the list itself.
 */
describe("FONT_GALLERY", () => {
  const families = FONT_GALLERY.map((row) => row.family);

  it("is alphabetical and names each family once, because a published page emits it in this order", () => {
    expect(families).toEqual([...families].sort((a, b) => a.localeCompare(b, "en")));
    expect(new Set(families).size).toBe(families.length);
  });

  it("names only families the stylesheet can emit", () => {
    for (const family of families) expect(family).toMatch(FONT_FAMILY_PATTERN);
  });

  /**
   * **David's condition, row by row** (27 October 2026): a substitute is another family **already in
   * the table, of the same species**, so retiring any row is a mechanical migration to it — the next
   * `0014`, not a decision.
   */
  it("gives every row a substitute of its own species, already in the table and not itself", () => {
    for (const { family, kind, substitute } of FONT_GALLERY) {
      const target = FONT_GALLERY.find((row) => row.family === substitute);
      expect(target, `${family}'s substitute ${substitute} is not in the table`).toBeDefined();
      expect(target?.kind, `${family} (${kind}) is substituted by a ${target?.kind}`).toBe(kind);
      expect(substitute, family).not.toBe(family);
    }
  });

  it("files every row under a species the chooser knows", () => {
    for (const { family, kind } of FONT_GALLERY) expect(FONT_KINDS, family).toContain(kind);
  });

  /** David's quota for the composition (27 October 2026): about fourteen sans, and not above. */
  it("keeps the sans within the composition's quota", () => {
    expect(FONT_GALLERY.filter((row) => row.kind === "sans").length).toBeLessThanOrEqual(14);
  });
});

describe("GENERIC_OF", () => {
  it("falls a slab back to a serif and a headline family to a sans", () => {
    expect(GENERIC_OF).toEqual({
      sans: "sans-serif",
      serif: "serif",
      slab: "serif",
      display: "sans-serif",
    });
  });
});

describe("fontFamilySlug", () => {
  it("is @fontsource's id: lower case, spaces as hyphens, digits kept", () => {
    expect(fontFamilySlug("EB Garamond")).toBe("eb-garamond");
    expect(fontFamilySlug("Source Sans 3")).toBe("source-sans-3");
    expect(fontFamilySlug("Inter")).toBe("inter");
  });

  it("refuses a name the stylesheet could not emit rather than slugging it", () => {
    for (const bad of ["../evil", "Libre-Baskerville", "Ação", "Foo  Bar", "9Lives"]) {
      expect(() => fontFamilySlug(bad), bad).toThrow(/not a family name/);
    }
  });
});
