import { describe, expect, it } from "vitest";
import { FONT_GALLERY } from "../src/fontGallery.ts";
import { MAX_OWN_FONTS, type OwnFont, ownFamilyIssue, ownFontCovers } from "../src/fonts.ts";
import { DocumentValidationError, parseDocument } from "../src/parse.ts";
import { TOKEN_KEYS } from "../src/tokens.ts";

/**
 * The record of a font the owner brought (ADR 0056): what the schema admits, and the shapes it
 * refuses rather than interprets. Every refusal here is a state the product must not be able to
 * store, because a stored document is the one that reaches the ZIP.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`]));

const casa: OwnFont = {
  id: "3f9a7c21",
  family: "Casa Trufa",
  kind: "sans",
  faces: [
    { role: "regular", format: "woff2" },
    { role: "bold", format: "woff" },
  ],
  licence: { declared: true, at: "2026-10-27T18:00:00Z" },
  licenceFile: "txt",
};

function withFonts(fonts: unknown): Record<string, unknown> {
  return {
    schemaVersion: "1.14.0",
    id: "doc-fonts",
    siteName: "Pastelería Trufa",
    theme,
    fonts,
    pages: [
      {
        id: "home",
        slug: "index",
        title: "Pastelería Trufa",
        sections: [
          {
            id: "sec-cover",
            preset: { catalogId: "cover", variantId: "image-right" },
            source: "catalog",
            layout: null,
            content: [],
          },
        ],
      },
    ],
    collections: [],
  };
}

const refuses = (fonts: unknown, pattern: RegExp) => {
  expect(() => parseDocument(withFonts(fonts))).toThrow(DocumentValidationError);
  expect(() => parseDocument(withFonts(fonts))).toThrow(pattern);
};

describe("an own font's record", () => {
  it("parses the three shapes faces may take", () => {
    for (const faces of [
      [{ role: "regular", format: "ttf" }],
      [
        { role: "regular", format: "woff2" },
        { role: "bold", format: "otf" },
      ],
      [{ role: "variable", format: "woff2", wght: [300, 800] }],
    ]) {
      expect(
        () => parseDocument(withFonts([{ ...casa, faces }])),
        JSON.stringify(faces),
      ).not.toThrow();
    }
  });

  it("is absent on every document that has none, and an empty list is not an error", () => {
    const { fonts: _absent, ...without } = withFonts([]);
    expect(parseDocument(without).fonts).toBeUndefined();
    expect(parseDocument(withFonts([])).fonts).toEqual([]);
  });

  it("keeps the licence file optional and the declaration literal", () => {
    const { licenceFile: _none, ...plain } = casa;
    expect(parseDocument(withFonts([plain])).fonts?.[0]?.licenceFile).toBeUndefined();
    refuses([{ ...casa, licence: { declared: false, at: casa.licence.at } }], /licence\.declared/);
    refuses([{ ...casa, licence: { declared: "yes", at: casa.licence.at } }], /licence\.declared/);
    refuses([{ ...casa, licence: { declared: true } }], /licence\.at/);
    refuses([{ ...casa, licence: { declared: true, at: "ayer" } }], /licence\.at/);
    refuses([{ ...casa, licenceFile: "docx" }], /licenceFile/);
  });

  it("refuses a bold without a regular, because the family would mean two things", () => {
    refuses([{ ...casa, faces: [{ role: "bold", format: "woff2" }] }], /faces are \[regular\]/);
    refuses(
      [
        {
          ...casa,
          faces: [
            { role: "bold", format: "woff2" },
            { role: "regular", format: "woff2" },
          ],
        },
      ],
      /faces are \[regular\]/,
    );
  });

  it("refuses a variable face beside a static one, and the same role twice", () => {
    refuses(
      [
        {
          ...casa,
          faces: [
            { role: "regular", format: "woff2" },
            { role: "variable", format: "woff2", wght: [100, 900] },
          ],
        },
      ],
      /faces are \[regular\]/,
    );
    refuses(
      [
        {
          ...casa,
          faces: [
            { role: "regular", format: "woff2" },
            { role: "regular", format: "woff" },
          ],
        },
      ],
      /faces are \[regular\]/,
    );
    refuses([{ ...casa, faces: [] }], /faces/);
  });

  it("holds a variable face to a real range, in order and within 1–1000", () => {
    refuses(
      [{ ...casa, faces: [{ role: "variable", format: "ttf", wght: [800, 300] }] }],
      /min <= max/,
    );
    refuses([{ ...casa, faces: [{ role: "variable", format: "ttf", wght: [0, 700] }] }], /wght/);
    refuses([{ ...casa, faces: [{ role: "variable", format: "ttf", wght: [400, 1001] }] }], /wght/);
    refuses([{ ...casa, faces: [{ role: "variable", format: "ttf", wght: [400] }] }], /wght/);
    // A static face carries no range, and a range on it is a face that does not know what it is.
    refuses([{ ...casa, faces: [{ role: "regular", format: "ttf", wght: [100, 900] }] }], /wght/);
  });

  it("refuses a third font", () => {
    const three = [
      casa,
      { ...casa, id: "aaaaaaaa", family: "Otra" },
      { ...casa, id: "bbbbbbbb", family: "Tercera" },
    ];
    expect(MAX_OWN_FONTS).toBe(2);
    refuses(three, /fonts/);
  });

  it("refuses an id that is not eight lower-case hex digits", () => {
    for (const id of ["3F9A7C21", "3f9a7c2", "3f9a7c21a", "../evil", "", "propia-01"]) {
      refuses([{ ...casa, id }], /eight lower-case hex digits/);
    }
  });

  it("refuses a format the ZIP would not carry as a font", () => {
    for (const format of ["svg", "ttc", "eot", "WOFF2", "woff2 "]) {
      refuses([{ ...casa, faces: [{ role: "regular", format }] }], /format/);
    }
  });

  it("refuses a name that collides with the gallery, in any case", () => {
    for (const { family } of FONT_GALLERY.slice(0, 3)) {
      refuses([{ ...casa, family }], /already ships/);
      refuses([{ ...casa, family: family.toLowerCase() }], /already ships/);
      refuses([{ ...casa, family: family.toUpperCase() }], /already ships/);
    }
  });

  it("refuses a name the stylesheet could not emit, or that CSS would read as a keyword", () => {
    for (const family of ["Casa-Trufa", "Trufa's", "Ñandú", " Casa", "Casa  Trufa", "../evil"]) {
      refuses([{ ...casa, family }], /ASCII letters and digits/);
    }
    // `sans-serif` and `system-ui` never get this far: the hyphen fails the pattern first.
    for (const family of [
      "serif",
      "Serif",
      "monospace",
      "cursive",
      "fantasy",
      "inherit",
      "initial",
    ]) {
      refuses([{ ...casa, family }], /CSS keyword/);
    }
  });

  it("refuses two own fonts with the same name, in any case, and the same id", () => {
    refuses([casa, { ...casa, id: "aaaaaaaa", family: "casa trufa" }], /already another own font/);
    refuses([casa, { ...casa, family: "Otra Letra" }], /share an id/);
  });

  it("rejects an unknown key, like every other record in the document", () => {
    refuses([{ ...casa, bytes: "…" }], /bytes/);
    refuses([{ ...casa, faces: [{ role: "regular", format: "ttf", file: "x.ttf" }] }], /file/);
  });
});

describe("ownFamilyIssue", () => {
  it("names the first reason a name cannot be an own font's, and none for a free one", () => {
    expect(ownFamilyIssue("Casa Trufa")).toBeUndefined();
    expect(ownFamilyIssue("Inter")).toMatch(/already ships/);
    expect(ownFamilyIssue("serif")).toMatch(/CSS keyword/);
    expect(ownFamilyIssue("Casa Trufa", [casa])).toMatch(/already another own font/);
    expect(ownFamilyIssue("Casa Trufa 2", [casa])).toBeUndefined();
  });
});

describe("ownFontCovers", () => {
  it("derives the two weights from the faces rather than storing them", () => {
    expect(ownFontCovers({ faces: [{ role: "regular", format: "ttf" }] })).toEqual({
      regular: true,
      bold: false,
    });
    expect(ownFontCovers(casa)).toEqual({ regular: true, bold: true });
  });

  it("covers a weight through a variable face only when its range includes it", () => {
    const variable = (wght: [number, number]) =>
      ownFontCovers({ faces: [{ role: "variable", format: "woff2", wght }] });
    expect(variable([300, 800])).toEqual({ regular: true, bold: true });
    expect(variable([500, 900])).toEqual({ regular: false, bold: true });
    expect(variable([100, 600])).toEqual({ regular: true, bold: false });
    expect(variable([400, 400])).toEqual({ regular: true, bold: false });
    expect(variable([700, 700])).toEqual({ regular: false, bold: true });
  });
});
