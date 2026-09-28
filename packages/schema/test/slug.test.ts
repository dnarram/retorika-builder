import { describe, expect, it } from "vitest";
import { parseDocument } from "../src/parse.ts";
import { mintSlug, SLUG_PATTERN, slugFrom } from "../src/slug.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * A page's slug (ADR 0022): what its file is called, and the one thing about a page the owner
 * never sees. These rules used to live in `packages/publisher`, where a slug becomes a file name —
 * which is the last thing that runs before a ZIP is written, so a bad one surfaced as a 500 at the
 * moment of download rather than as a validation error where it was written.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function documentWith(pages: { id: string; slug: string; title: string }[]): unknown {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    collections: [],
    pages: pages.map((page) => ({
      ...page,
      sections: [
        {
          id: `sec-${page.id}`,
          preset: { catalogId: "cover", variantId: "image-right" },
          source: "catalog",
          layout: null,
          content: [
            {
              id: `el-${page.id}`,
              role: "heading",
              hidden: false,
              slot: "headline",
              value: { kind: "text", text: "Barbería El Corte" },
            },
          ],
        },
      ],
    })),
  };
}

describe("slugFrom", () => {
  it("folds the accents and eñes a Spanish business name actually carries", () => {
    // The whole reason this exists. A shop called «Peluquería» is the common case, not the edge.
    expect(slugFrom("Peluquería")).toBe("peluqueria");
    expect(slugFrom("Diseño")).toBe("diseno");
    expect(slugFrom("Cañón")).toBe("canon");
    expect(slugFrom("Menú del día")).toBe("menu-del-dia");
    expect(slugFrom("Atención al público")).toBe("atencion-al-publico");
  });

  it("folds a composed and a decomposed accent to the same thing", () => {
    // «é» arrives either as one code point or as e + U+0301, depending on the keyboard and the
    // operating system, and a person cannot tell them apart by looking.
    expect(slugFrom("Café")).toBe(slugFrom("Café"));
    expect(slugFrom("Café")).toBe("cafe");
  });

  it("collapses everything that is not a letter or a digit into single hyphens", () => {
    expect(slugFrom("  Nuestra   carta  ")).toBe("nuestra-carta");
    expect(slugFrom("Tapas & raciones")).toBe("tapas-raciones");
    expect(slugFrom("¿Dónde estamos?")).toBe("donde-estamos");
    expect(slugFrom("Precios (2026)")).toBe("precios-2026");
  });

  it("produces something the schema will accept, for every case it produces anything at all", () => {
    for (const title of [
      "Peluquería",
      "Menú del día",
      "¿Dónde estamos?",
      "Tapas & raciones",
      "2 por 1",
      "Ñandú",
    ]) {
      const slug = slugFrom(title);
      expect(slug, title).toBeDefined();
      expect(SLUG_PATTERN.test(slug ?? ""), `${title} -> ${slug}`).toBe(true);
    }
  });

  it("answers undefined rather than inventing one when nothing survives", () => {
    // A heading of only punctuation or only emoji. The caller decides what to do, because only the
    // caller knows whether it has a fallback.
    expect(slugFrom("🎨🎨")).toBeUndefined();
    expect(slugFrom("¿?¡!")).toBeUndefined();
    expect(slugFrom("   ")).toBeUndefined();
  });
});

describe("mintSlug", () => {
  it("uses the plain slug when nothing is in the way", () => {
    expect(mintSlug("Precios", [])).toBe("precios");
  });

  it("numbers the second page that wants the same name", () => {
    expect(mintSlug("Precios", ["precios"])).toBe("precios-2");
    expect(mintSlug("Precios", ["precios", "precios-2"])).toBe("precios-3");
  });

  it("never hands out index, whatever the title", () => {
    // The first page is the entry file whatever it is slugged, so a later page slugged `index`
    // would take the file from it — and that is the one slug problem the schema cannot see,
    // because "index" is a perfectly good slug and there is only one of it in the document.
    expect(mintSlug("Index", [])).toBe("index-2");
    expect(mintSlug("Inicio", [])).toBe("inicio");
  });

  it("falls back to a real word when the title yields nothing", () => {
    expect(mintSlug("🎨", [])).toBe("pagina");
    expect(mintSlug("🎨", ["pagina"])).toBe("pagina-2");
  });
});

describe("what a document may carry", () => {
  it("accepts the slugs a real site uses", () => {
    expect(() =>
      parseDocument(
        documentWith([
          { id: "home", slug: "index", title: "Barbería El Corte" },
          { id: "page-2", slug: "nuestra-carta", title: "Nuestra carta" },
        ]),
      ),
    ).not.toThrow();
  });

  it.each([
    ["an uppercase letter", "Servicios"],
    ["a path segment", "../fuera"],
    ["a space", "mi pagina"],
    ["an accent", "peluquería"],
    ["a leading hyphen", "-precios"],
    ["nothing at all", ""],
  ])("refuses %s, where it is written rather than where it becomes a file", (_label, slug) => {
    expect(() =>
      parseDocument(documentWith([{ id: "home", slug, title: "Barbería El Corte" }])),
    ).toThrow(/slug is lowercase/);
  });

  it("refuses two pages with the same slug, which would make one unreachable", () => {
    expect(() =>
      parseDocument(
        documentWith([
          { id: "home", slug: "index", title: "Inicio" },
          { id: "page-2", slug: "index", title: "Otra" },
        ]),
      ),
    ).toThrow(/slug "index" appears more than once/);
  });

  it("refuses two pages with the same id, which would make insertSection ambiguous", () => {
    expect(() =>
      parseDocument(
        documentWith([
          { id: "home", slug: "index", title: "Inicio" },
          { id: "home", slug: "otra", title: "Otra" },
        ]),
      ),
    ).toThrow(/page id "home" appears more than once/);
  });
});
