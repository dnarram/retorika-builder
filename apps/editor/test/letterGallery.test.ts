import { SHIPPABLE_FAMILIES } from "@retorika/renderer";
import type { OwnFont } from "@retorika/schema";
import {
  buildTheme,
  GALLERY_FAMILIES,
  withFamily,
  withOwnFont,
  withTypePair,
} from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  familiesHelpText,
  familyRowFor,
  galleryFaceCss,
  galleryRows,
  ownFaceCss,
  toolbarFamilyLabel,
  typePairNoteText,
} from "../src/editor/letterGallery.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * What the «Estilo» panel's gallery shows, and what the floating toolbar's two buttons are called
 * (ADR 0046, sprint 24 día 6).
 *
 * The panel renders what these functions return, so this is where the derivation is held: one row
 * per family this product actually ships, a tick deduced from the document's own theme, and a
 * specimen pointing at the face the ZIP will carry.
 */

const start = buildTheme({ paletteId: "classic-blue", typePairId: "modern-sans" });

describe("galleryRows", () => {
  it("offers every family this product ships, which is ADR 0046's condition", () => {
    // Derived rather than written out: a family added to the renderer's table appears here without
    // anybody remembering to add it, and one removed stops being offered.
    const rows = galleryRows(start, "font.heading");
    expect(rows.map((row) => row.family)).toEqual(SHIPPABLE_FAMILIES.map((f) => f.family));
    // A literal floor beside the derivation, so an empty table cannot pass as «every family».
    expect(rows.length).toBeGreaterThanOrEqual(25);
  });

  it("keeps the gallery's own order, which is the order the owner reads", () => {
    expect(galleryRows(start, "font.body").map((row) => row.family)).toEqual(
      GALLERY_FAMILIES.map((f) => f.family),
    );
  });

  it("points each specimen at that family's 400 face, as the route serves it", () => {
    for (const row of galleryRows(start, "font.heading")) {
      const shipped = SHIPPABLE_FAMILIES.find((f) => f.family === row.family);
      expect(row.file, row.family).toBe(shipped?.faces.find((f) => f.weight === 400)?.file);
    }
  });

  it("ticks the family the theme names first, and only for the key asked about", () => {
    const theme = withFamily(start, "font.heading", "Spectral");
    expect(galleryRows(theme, "font.heading").filter((row) => row.chosen)).toEqual([
      { family: "Spectral", kind: "serif", file: "spectral-latin-400-normal.woff2", chosen: true },
    ]);
    // The body still carries the pair's system stack, so nothing is ticked in the other column.
    expect(galleryRows(theme, "font.body").some((row) => row.chosen)).toBe(false);
  });

  it("ticks nothing for a theme whose letter this product does not send", () => {
    const editorial = withTypePair(start, "editorial-serif");
    expect(galleryRows(editorial, "font.heading").some((row) => row.chosen)).toBe(false);
  });
});

describe("galleryFaceCss", () => {
  it("declares one face per shipped family, and names each exactly once", () => {
    const css = galleryFaceCss();
    expect(css.match(/@font-face\{/g) ?? []).toHaveLength(SHIPPABLE_FAMILIES.length);
    for (const { family } of SHIPPABLE_FAMILIES) {
      expect(css.match(new RegExp(`font-family:'${family}'`, "g")) ?? [], family).toHaveLength(1);
    }
  });

  it("asks the editor's own route by an absolute path, which is the trap this would fall into", () => {
    // `cssFontSrc` in the renderer emits `url("fonts/…")` — right for a published page and for a ZIP
    // opened from `file://`, and wrong here: the panel is a page at `/mis-webs/<id>`, where the same
    // relative URL would ask for `/mis-webs/fonts/…` and get a 404 with the specimen silently
    // falling back to a system face. The one thing a specimen is for is being what you will get.
    const css = galleryFaceCss();
    expect(css).not.toMatch(/url\("fonts\//);
    for (const { family, faces } of SHIPPABLE_FAMILIES) {
      const regular = faces.find((face) => face.weight === 400);
      expect(css, family).toContain(`url("/fonts/${regular?.file}") format("woff2")`);
    }
  });

  it("draws the specimens in the regular, which is half of what opening the group fetches", () => {
    expect(galleryFaceCss().match(/font-weight:400/g) ?? []).toHaveLength(
      SHIPPABLE_FAMILIES.length,
    );
    expect(galleryFaceCss()).not.toContain("font-weight:700");
  });

  it("declares only the families it is handed, which is what lets the chooser fetch as it scrolls", () => {
    // A declared face downloads the moment text is laid out in it, on screen or not — so a sheet
    // naming every family would fetch every face on open. The chooser hands over the revealed set
    // and grows it (sprint 29 día 1).
    const css = galleryFaceCss(["Spectral", "Figtree"]);
    expect(css.match(/@font-face\{/g) ?? []).toHaveLength(2);
    expect(css).toContain("font-family:'Spectral'");
    expect(css).toContain("font-family:'Figtree'");
    expect(css).not.toContain("Bitter");
    expect(galleryFaceCss([])).toBe("");
  });

  it("refuses a family this product does not send, rather than drawing a specimen in a lie", () => {
    expect(() => galleryFaceCss(["Comic Sans MS"])).toThrow(/no 400 face shipped/);
  });
});

describe("familyRowFor", () => {
  it("names a gallery family outright and draws the row in that very face", () => {
    const theme = withFamily(start, "font.heading", "Spectral");
    expect(familyRowFor(theme, "font.heading")).toEqual({
      family: "Spectral",
      text: "Spectral",
      stack: "'Spectral'",
    });
  });

  it("reads the pair's own Inter as the heading of a brand-new site, because it is", () => {
    // `modern-sans` heads in Inter and this product sends Inter: the row says so before anybody
    // has chosen anything, which is the truth of the document and not a quirk.
    expect(familyRowFor(start, "font.heading").family).toBe("Inter");
  });

  it("names a pair's system letter by the pair and never by the font, drawn in the theme's own stack", () => {
    // `editorial-serif` heads in Georgia and bodies in system-ui: nothing ships for either, so the
    // visitor gets whatever their machine has, and the row shows exactly that (issue #9).
    const editorial = withTypePair(start, "editorial-serif");
    const heading = familyRowFor(editorial, "font.heading");
    expect(heading.family).toBeUndefined();
    expect(heading.text).toBe("La letra de «Sobria y legible»");
    expect(heading.stack).toBe(editorial["font.heading"]);
    expect(familyRowFor(editorial, "font.body").stack).toBe(editorial["font.body"]);
  });

  /**
   * **Each half named on its own** (sprint 29 día 3). A restaurante on «Clásica y seria» whose
   * headings were changed to Gelasio still has the pair's Charter in its text; until día 3 that row
   * said «una letra que no está en esta lista» about a letter the product had put there itself.
   */
  it("names a half by the pair whose letter it still is, when only the other half changed", () => {
    const classic = withFamily(withTypePair(start, "classic-display"), "font.heading", "Gelasio");
    expect(familyRowFor(classic, "font.heading").text).toBe("Gelasio");
    const body = familyRowFor(classic, "font.body");
    expect(body.family).toBeUndefined();
    expect(body.text).toBe("La letra de «Clásica y seria»");
    expect(body.stack).toBe(classic["font.body"]);
  });

  it("names a system sans two pairs share by the first of them, which is true of both", () => {
    const theme = withFamily(withTypePair(start, "modern-sans"), "font.heading", "Gelasio");
    expect(familyRowFor(theme, "font.body").text).toBe("La letra de «Sobria y legible»");
  });

  it("says a hand-edited letter is off the list, in the words the pairs group uses", () => {
    const row = familyRowFor(
      { ...start, "font.heading": "Comic Sans MS, sans-serif" },
      "font.heading",
    );
    expect(row).toEqual({
      family: undefined,
      text: es["editor.style.unknownLetter"],
      stack: "Comic Sans MS, sans-serif",
    });
  });
});

describe("familiesHelpText", () => {
  it("counts the families from the table rather than from the sentence", () => {
    // «Las ocho letras…» was the copy until sprint 29, and eight stops being true on día 2.
    expect(familiesHelpText()).toBe(
      `${GALLERY_FAMILIES.length} letras que viajan con tu web: se ven igual en cualquier ordenador, porque se descargan con la página.`,
    );
    expect(familiesHelpText()).not.toContain("{n}");
  });
});

describe("typePairNoteText", () => {
  it("stops telling an owner their letter is nowhere when they picked it by name", () => {
    // The old sentence — «usa una letra que no está en esta lista» — was true while the only way out
    // of the three pairs was a hand-edited document. Picking Spectral below is now the ordinary way.
    expect(typePairNoteText(withFamily(start, "font.heading", "Spectral"))).toBe(
      es["editor.style.fromGallery"],
    );
  });

  it("keeps the old sentence for a theme nobody here produced", () => {
    expect(typePairNoteText({ ...start, "font.heading": "Comic Sans MS, sans-serif" })).toBe(
      es["editor.style.noTypePair"],
    );
  });
});

describe("toolbarFamilyLabel", () => {
  it("names the family behind the reference when it is one we send", () => {
    const theme = withFamily(start, "font.heading", "Gelasio");
    expect(toolbarFamilyLabel(theme, "font.heading")).toBe("Letra — Titular (Gelasio)");
  });

  it("gives the role word alone when the letter is not ours to name", () => {
    // Issue #9's rule, still standing where it applies: naming a face we do not ship promises a
    // font that may never arrive.
    const editorial = withTypePair(start, "editorial-serif");
    expect(toolbarFamilyLabel(editorial, "font.heading")).toBe("Letra — Titular");
    expect(toolbarFamilyLabel(editorial, "font.body")).toBe("Letra — Texto");
  });

  it("keeps the role word, which is what tells the two «Texto» controls apart", () => {
    // «Texto» is also the `color.ink` swatch's label one group over, so the family button's name
    // has to keep saying which control it is.
    const theme = withFamily(start, "font.body", "Spectral");
    expect(toolbarFamilyLabel(theme, "font.body")).toContain("Texto");
    expect(toolbarFamilyLabel(theme, "font.body")).toBe("Letra — Texto (Spectral)");
  });
});

describe("the owner's own fonts in the panel and the chooser (sprint 29 día 5)", () => {
  const CASA: OwnFont = {
    id: "3f9a7c21",
    family: "Casa Trufa",
    kind: "serif",
    faces: [
      { role: "regular", format: "ttf" },
      { role: "bold", format: "woff" },
    ],
    licence: { declared: true, at: "2026-10-28T09:00:00.000Z" },
  };
  const VARIABLE: OwnFont = {
    ...CASA,
    id: "0badc0de",
    family: "Marca Variable",
    faces: [{ role: "variable", format: "woff2", wght: [300, 800] }],
  };
  const URLS = new Map([
    [
      "propia-3f9a7c21-regular.ttf",
      "blob:http://localhost:3000/aaaaaaaa-0000-0000-0000-000000000001",
    ],
    [
      "propia-0badc0de-variable.woff2",
      "blob:http://localhost:3000/aaaaaaaa-0000-0000-0000-000000000002",
    ],
  ]);

  it("declares one face per font from its object URL — the regular, or the variable with its range", () => {
    const css = ownFaceCss([CASA, VARIABLE], URLS);
    expect(css.split("\n")).toEqual([
      '@font-face{font-family:\'Casa Trufa\';src:url("blob:http://localhost:3000/aaaaaaaa-0000-0000-0000-000000000001") format("truetype");font-weight:400;font-style:normal;font-display:swap}',
      '@font-face{font-family:\'Marca Variable\';src:url("blob:http://localhost:3000/aaaaaaaa-0000-0000-0000-000000000002") format("woff2");font-weight:300 800;font-style:normal;font-display:swap}',
    ]);
  });

  it("leaves out a font whose bytes have not arrived, and refuses a URL that is not an object URL", () => {
    expect(ownFaceCss([CASA], new Map())).toBe("");
    const hostile = new Map([["propia-3f9a7c21-regular.ttf", "https://evil.example/x.ttf"]]);
    expect(() => ownFaceCss([CASA], hostile)).toThrow(/not an object URL/);
  });

  it("names an own font in the panel's row, drawn in its own face", () => {
    const theme = withOwnFont(start, "font.heading", CASA);
    expect(familyRowFor(theme, "font.heading", [CASA])).toEqual({
      family: undefined,
      own: CASA,
      text: "Casa Trufa",
      stack: "'Casa Trufa'",
    });
    // Without the record the stack is a letter nobody here produced, which is what it would be.
    expect(familyRowFor(theme, "font.heading").text).toBe(es["editor.style.unknownLetter"]);
  });

  it("says the letter was chosen by name when it is the owner's own", () => {
    const theme = withOwnFont(start, "font.body", CASA);
    expect(typePairNoteText(theme, [CASA])).toBe(es["editor.style.fromGallery"]);
  });
});
