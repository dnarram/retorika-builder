import { FONT_KINDS, type OwnFont } from "@retorika/schema";
import { buildTheme, GALLERY_FAMILIES, withFamily, withOwnFont } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { fold } from "../src/editor/fold.ts";
import {
  chooserRows,
  countText,
  initiallyRevealed,
  KIND_FILTERS,
  kindFiltersFor,
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

  it("names the way to bring one in, by the button's own words, now that it exists (día 5)", () => {
    // Día 3 held this line to promising nothing; the button is here, so the line names it — by the
    // label the button actually carries, so the two cannot drift apart.
    expect(es["editor.style.chooser.notIncluded"]).toContain(
      `«${es["editor.style.chooser.upload"]}»`,
    );
    expect(es["editor.style.chooser.notIncluded"]).toContain("{site}");
    expect(es["editor.style.chooser.notIncludedSite"]).toBe("fonts.google.com");
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

describe("the owner's own fonts in the chooser (sprint 29 día 5)", () => {
  const CASA: OwnFont = {
    id: "3f9a7c21",
    family: "Casa Trufa",
    kind: "serif",
    faces: [{ role: "regular", format: "ttf" }],
    licence: { declared: true, at: "2026-10-28T09:00:00.000Z" },
  };

  it("puts them first, ticks the one the stack names, and leaves the gallery as it was", () => {
    const theme = withOwnFont(start, "font.heading", CASA);
    const rows = chooserRows(theme, "font.heading", "", "all", [CASA]);
    expect(rows[0]).toMatchObject({ family: "Casa Trufa", chosen: true, visible: true, own: CASA });
    expect(rows.slice(1).map((row) => row.family)).toEqual(all);
    expect(rows.filter((row) => row.chosen)).toHaveLength(1);
    // The other half does not name it, so nothing is ticked there.
    expect(chooserRows(theme, "font.body", "", "all", [CASA])[0]?.chosen).toBe(false);
  });

  it("answers «Propias» and its own species' chip, and the search like any row", () => {
    const own = chooserRows(start, "font.body", "", "own", [CASA]).filter((row) => row.visible);
    expect(own.map((row) => row.family)).toEqual(["Casa Trufa"]);
    const serifs = chooserRows(start, "font.body", "", "serif", [CASA]).filter(
      (row) => row.visible,
    );
    expect(serifs[0]?.family).toBe("Casa Trufa");
    expect(visibleCount(chooserRows(start, "font.body", "trufa", "all", [CASA]))).toBe(1);
    expect(visibleCount(chooserRows(start, "font.body", "", "sans", [CASA]).slice(0, 1))).toBe(0);
  });

  it("offers «Propias» right after «Todas», and only once there is something to narrow to", () => {
    expect(kindFiltersFor([])).toEqual(KIND_FILTERS);
    expect(kindFiltersFor([CASA])).toEqual(["all", "own", ...KIND_FILTERS.slice(1)]);
    expect(es["editor.style.chooser.kind.own"]).toBe("Propias");
  });

  it("never asks the gallery's sheet for an own face", () => {
    const theme = withOwnFont(start, "font.heading", CASA);
    expect(
      initiallyRevealed(chooserRows(theme, "font.heading", "", "all", [CASA])).has("Casa Trufa"),
    ).toBe(false);
  });
});
