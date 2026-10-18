import { SHIPPABLE_FAMILIES } from "@retorika/renderer";
import { buildTheme, GALLERY_FAMILIES, withFamily, withTypePair } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  chosenFamilyText,
  galleryFaceCss,
  galleryRows,
  galleryStartsOpen,
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
    expect(rows).toHaveLength(8);
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
    expect(galleryFaceCss().match(/font-weight:400/g) ?? []).toHaveLength(8);
    expect(galleryFaceCss()).not.toContain("font-weight:700");
  });
});

describe("chosenFamilyText", () => {
  it("says both when both halves are chosen", () => {
    const theme = withFamily(withFamily(start, "font.heading", "Figtree"), "font.body", "Bitter");
    expect(chosenFamilyText(theme)).toBe("Figtree en los titulares y Bitter en el texto.");
  });

  it("says only the half that was chosen", () => {
    // From `editorial-serif`, whose Georgia heading and system body are nobody's shipped face —
    // `modern-sans` would not do, because **it already heads in Inter**, which is a gallery family,
    // so a theme built on it reports two halves honestly before anybody has chosen anything.
    const plain = withTypePair(start, "editorial-serif");
    expect(chosenFamilyText(withFamily(plain, "font.heading", "Work Sans"))).toBe(
      "Work Sans en los titulares.",
    );
    expect(chosenFamilyText(withFamily(plain, "font.body", "DM Sans"))).toBe(
      "DM Sans en el texto.",
    );
  });

  it("reports the pair's own Inter, because a pair that names a shipped family has chosen one", () => {
    // `modern-sans` heads in Inter and this product sends Inter, so the line says so rather than
    // pretending the choice is empty until somebody clicks. The same sentence, from the one place
    // that composes it.
    expect(chosenFamilyText(start)).toBe("Inter en los titulares.");
  });

  it("names the pair as the thing in charge when neither half was chosen", () => {
    // `modern-sans` heads in Inter, which *is* a gallery family — so this case needs a theme whose
    // two stacks begin with nothing we ship, and `editorial-serif` is one.
    expect(chosenFamilyText(withTypePair(start, "editorial-serif"))).toBe(
      es["editor.style.familyNeither"],
    );
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

describe("galleryStartsOpen", () => {
  it("stays closed for a site on one of the three pairs", () => {
    // Including `modern-sans`, which heads in Inter — a family we send. «Some gallery family is
    // named» is true of the default theme, so it cannot be the test on its own.
    for (const id of ["editorial-serif", "modern-sans", "classic-display"]) {
      expect(galleryStartsOpen(withTypePair(start, id)), id).toBe(false);
    }
  });

  it("opens when the owner has left the pairs for a family of their own", () => {
    // Otherwise the ticked row sits inside a collapsed group: a choice they cannot see and cannot
    // take back.
    expect(galleryStartsOpen(withFamily(start, "font.body", "Spectral"))).toBe(true);
    expect(galleryStartsOpen(withFamily(start, "font.heading", "Bitter"))).toBe(true);
  });

  it("stays closed for a theme nobody here produced, where there is nothing to show ticked", () => {
    expect(galleryStartsOpen({ ...start, "font.heading": "Comic Sans MS, sans-serif" })).toBe(
      false,
    );
  });
});

describe("toolbarFamilyLabel", () => {
  it("names the family behind the reference when it is one we send", () => {
    const theme = withFamily(start, "font.heading", "Libre Baskerville");
    expect(toolbarFamilyLabel(theme, "font.heading")).toBe("Letra — Titular (Libre Baskerville)");
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
