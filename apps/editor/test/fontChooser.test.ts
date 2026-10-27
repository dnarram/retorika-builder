import { FONT_KINDS } from "@retorika/schema";
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
    expect(rows.filter((row) => row.visible).map((row) => row.family)).toEqual([
      "Cormorant Garamond",
      "EB Garamond",
    ]);
  });

  it("matches the family's name without caring about accents or case", () => {
    // Two Garamonds since día 3: EB and Cormorant.
    expect(visibleCount(chooserRows(start, "font.heading", "GARAMÓND", "all"))).toBe(2);
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

  it("offers a chip for each species the gallery has, in its own order, with «Todas» first", () => {
    // The slabs entered on día 2 and brought «Remates gruesos» with them; «De cartel» waits for the
    // first headline family, so no chip can narrow the list to nothing.
    // «De cartel» arrived with the first headline families on día 3.
    expect(KIND_FILTERS).toEqual(["all", "sans", "serif", "slab", "display"]);
    for (const kind of KIND_FILTERS.slice(1)) {
      expect(
        GALLERY_FAMILIES.some((row) => row.kind === kind),
        kind,
      ).toBe(true);
    }
  });

  it("has a label for every species there is, including the one with no family yet", () => {
    for (const kind of ["all", ...FONT_KINDS]) {
      expect(es[`editor.style.chooser.kind.${kind}` as keyof typeof es], kind).toBeTypeOf("string");
    }
  });

  it("files Bitter under the slabs, where until día 2 it read «Con remates»", () => {
    const slabs = chooserRows(start, "font.body", "", "slab").filter((row) => row.visible);
    expect(slabs.map((row) => row.family)).toEqual([
      "Aleo",
      "Bitter",
      "Hepta Slab",
      "Rokkitt",
      "Solway",
      "Zilla Slab",
    ]);
    const serifs = chooserRows(start, "font.body", "", "serif").filter((row) => row.visible);
    expect(serifs.some((row) => row.family === "Bitter")).toBe(false);
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

describe("the line about the families that are not here", () => {
  /**
   * David's condition 2, held to the facts: every family the line names is one the gallery does not
   * ship. The plan's draft named Montserrat and Poppins, which the survey found reserve no name and
   * which ship since día 2 — had the line been written from the draft, this is what would have said so.
   */
  it("names only families that really are not in the gallery", () => {
    const named = es["editor.style.chooser.notIncluded"].split(" y otras")[0]?.split(", ") ?? [];
    expect(named.length).toBeGreaterThanOrEqual(3);
    for (const family of named) expect(all, family).not.toContain(family);
  });

  it("promises no way of bringing one in until that way exists", () => {
    expect(es["editor.style.chooser.notIncluded"]).not.toMatch(/subir|importar/i);
  });
});

describe("initiallyRevealed", () => {
  it("declares the first screen of visible rows, and not the rest", () => {
    const rows = chooserRows(start, "font.heading", "", "all");
    const revealed = initiallyRevealed(rows);
    // Forty families since día 3, so the cap earns its keep: the first eight in the gallery's order,
    // and the chosen one — Inter, on «Moderna y neutra» — wherever it falls.
    expect([...revealed].sort()).toEqual(
      [
        "Alegreya",
        "Aleo",
        "Big Shoulders Display",
        "Bitter",
        "Bodoni Moda",
        "Bricolage Grotesque",
        "Cormorant Garamond",
        "Crimson Pro",
        "Inter",
      ].sort(),
    );
    // And the foot of the list is not fetched by opening the dialog.
    expect(revealed.has("Zilla Slab")).toBe(false);
    expect(revealed.size).toBeLessThan(rows.length);
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
