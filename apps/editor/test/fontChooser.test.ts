import { buildTheme, GALLERY_FAMILIES, withFamily } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { fold } from "../src/editor/fold.ts";
import {
  chooserRows,
  countText,
  initiallyRevealed,
  KIND_FILTERS,
  sampleLine,
  visibleCount,
} from "../src/editor/fontChooser.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * What the letter chooser shows (sprint 29 día 1): the rows the words typed and the chip pressed
 * leave visible, the count under the search, the sample line, and which faces are declared before
 * anybody scrolls.
 */

const start = buildTheme({ paletteId: "classic-blue", typePairId: "modern-sans" });
const all = GALLERY_FAMILIES.map((row) => row.family);

describe("fold", () => {
  it("strips accents and case, the Spanish way", () => {
    expect(fold("Peluquería")).toBe("peluqueria");
    expect(fold("GARAMÓND")).toBe("garamond");
    expect(fold("Été")).toBe("ete");
  });
});

describe("chooserRows", () => {
  it("keeps every row mounted and marks the ones the words hide", () => {
    // One radio group: unmounting a miss would unmount its radio, and a group whose members come
    // and go loses the checked one and the place the arrows start from.
    const rows = chooserRows(start, "font.heading", "gara", "all");
    expect(rows.map((row) => row.family)).toEqual(all);
    expect(rows.filter((row) => row.visible).map((row) => row.family)).toEqual(["EB Garamond"]);
  });

  it("matches the family's name without caring about accents or case", () => {
    expect(visibleCount(chooserRows(start, "font.heading", "GARAMÓND", "all"))).toBe(1);
    expect(visibleCount(chooserRows(start, "font.heading", "  spec ", "all"))).toBe(1);
  });

  it("shows everything for an empty query", () => {
    expect(visibleCount(chooserRows(start, "font.heading", "", "all"))).toBe(all.length);
    expect(visibleCount(chooserRows(start, "font.heading", "   ", "all"))).toBe(all.length);
  });

  it("narrows by species before the words do", () => {
    const serifs = chooserRows(start, "font.body", "", "serif");
    expect(serifs.filter((row) => row.visible).every((row) => row.kind === "serif")).toBe(true);
    expect(visibleCount(serifs)).toBe(
      GALLERY_FAMILIES.filter((row) => row.kind === "serif").length,
    );
    // A serif's name under the sans chip is hidden, however well it matches.
    expect(visibleCount(chooserRows(start, "font.body", "spectral", "sans"))).toBe(0);
  });

  it("still ticks the family the theme names, hidden or not", () => {
    const theme = withFamily(start, "font.heading", "Spectral");
    const rows = chooserRows(theme, "font.heading", "figtree", "all");
    const spectral = rows.find((row) => row.family === "Spectral");
    expect(spectral).toMatchObject({ chosen: true, visible: false });
  });

  it("offers the chips in the gallery's own order, with «Todas» first", () => {
    expect(KIND_FILTERS).toEqual(["all", "sans", "serif"]);
    for (const kind of KIND_FILTERS) {
      expect(es[`editor.style.chooser.kind.${kind}`], kind).toBeTypeOf("string");
    }
  });
});

describe("countText", () => {
  it("counts, singularises, and says a sentence for none", () => {
    expect(countText(chooserRows(start, "font.heading", "", "all"))).toBe(`${all.length} letras`);
    expect(countText(chooserRows(start, "font.heading", "spectral", "all"))).toBe("1 letra");
    expect(countText(chooserRows(start, "font.heading", "zzz", "all"))).toBe(
      es["editor.style.chooser.none"],
    );
  });
});

describe("sampleLine", () => {
  it("prefers the business's own name, which is what a specimen is for", () => {
    expect(sampleLine("Taberna Santo Domingo")).toBe("Taberna Santo Domingo");
    expect(sampleLine("  Taberna  ")).toBe("Taberna");
  });

  it("falls back to the neutral sentence for a site with no name yet", () => {
    expect(sampleLine("")).toBe(es["editor.style.chooser.sample"]);
    expect(sampleLine("   ")).toBe(es["editor.style.chooser.sample"]);
  });
});

describe("initiallyRevealed", () => {
  it("declares the first screen of visible rows", () => {
    const rows = chooserRows(start, "font.heading", "", "all");
    const revealed = initiallyRevealed(rows);
    // Eight families today, so the first screen is the whole table; the cap earns its keep on día 2.
    expect([...revealed].sort()).toEqual([...all].sort());
    expect(revealed.size).toBeLessThanOrEqual(8);
  });

  it("always includes the chosen family, even when the words hide it", () => {
    // Its row is where the keyboard lands and what the owner reads first; a chosen row drawing in
    // the fallback for a frame would show the letter changing on open, for a site whose letter did
    // not change.
    const theme = withFamily(start, "font.body", "Spectral");
    const revealed = initiallyRevealed(chooserRows(theme, "font.body", "figtree", "all"));
    expect(revealed.has("Spectral")).toBe(true);
    expect(revealed.has("Figtree")).toBe(true);
    expect(revealed.has("Bitter")).toBe(false);
  });

  it("declares nothing for a search that matches nothing, beyond the chosen one", () => {
    const revealed = initiallyRevealed(chooserRows(start, "font.heading", "zzz", "all"));
    // `modern-sans` heads in Inter, which is a gallery family and therefore chosen.
    expect([...revealed]).toEqual(["Inter"]);
  });
});
