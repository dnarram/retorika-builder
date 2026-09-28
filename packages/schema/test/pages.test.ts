import { describe, expect, it } from "vitest";
import type { Page, RetorikaDocument } from "../src/document.ts";
import { deletePage, movePage, renamePage } from "../src/pages.ts";
import { parseDocument } from "../src/parse.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * The verbs on a document's pages (ADR 0022). There is no `addPage`: a page is born by converting a
 * section, so the verb that creates one lives with the conversion.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function page(id: string, slug: string, title: string): Page {
  return {
    id,
    slug,
    title,
    sections: [
      {
        id: `sec-${id}`,
        preset: { catalogId: "cover", variantId: "image-right" },
        source: "catalog",
        layout: null,
        content: [
          {
            id: `el-${id}`,
            role: "heading",
            hidden: false,
            slot: "headline",
            value: { kind: "text", text: "Barbería El Corte" },
          },
        ],
      },
    ],
  };
}

function documentWith(pages: Page[]): RetorikaDocument {
  return parseDocument({
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    collections: [],
    pages,
  });
}

const doc = documentWith([
  page("home", "index", "Inicio"),
  page("p2", "precios", "Precios"),
  page("p3", "carta", "Nuestra carta"),
]);

const slugs = (d: RetorikaDocument) => d.pages.map((p) => p.slug);
const titles = (d: RetorikaDocument) => d.pages.map((p) => p.title);

describe("renamePage", () => {
  it("changes the name and nothing else", () => {
    const edited = renamePage(doc, "p2", "Tarifas");
    expect(titles(edited)).toEqual(["Inicio", "Tarifas", "Nuestra carta"]);
    expect(edited.pages[1]?.sections).toEqual(doc.pages[1]?.sections);
  });

  it("does not move the file, which is the whole reason the slug is invisible", () => {
    // Renaming is something an owner does freely. If the file moved with the name, every link into
    // that page would break on a whim — and nobody would see why, because nobody sees the slug.
    expect(slugs(renamePage(doc, "p2", "Tarifas"))).toEqual(slugs(doc));
  });

  it("hands back the very same document when the name is already that one", () => {
    expect(renamePage(doc, "p2", "Precios")).toBe(doc);
  });

  it("can rename the first page, which only moving and deleting are barred from", () => {
    expect(titles(renamePage(doc, "home", "Portada"))[0]).toBe("Portada");
  });

  it("throws on a page the document does not have", () => {
    expect(() => renamePage(doc, "no-such", "X")).toThrow(/no page/);
  });
});

describe("movePage", () => {
  it("reorders, which is also the order the menu reads in", () => {
    expect(slugs(movePage(doc, "p3", 1))).toEqual(["index", "carta", "precios"]);
  });

  it("refuses to move the first page", () => {
    // It is the entry: `packages/publisher` writes it as index.html whatever it is slugged, and
    // ADR 0023 derives the menu from its sections. Swapping it would rewrite both at once.
    expect(() => movePage(doc, "home", 2)).toThrow(/is the entry and cannot move/);
  });

  it("refuses to move anything into the first position", () => {
    expect(() => movePage(doc, "p3", 0)).toThrow(/first position belongs to the entry/);
  });

  it("refuses a position that is not there", () => {
    expect(() => movePage(doc, "p2", 9)).toThrow(/there are 3 pages/);
  });

  it("hands back the very same document when the page is already there", () => {
    expect(movePage(doc, "p2", 1)).toBe(doc);
  });

  it("keeps every page's own content untouched", () => {
    const moved = movePage(doc, "p3", 1);
    expect(moved.pages.find((p) => p.id === "p3")).toEqual(doc.pages.find((p) => p.id === "p3"));
  });
});

describe("deletePage", () => {
  it("takes the page and everything on it", () => {
    expect(slugs(deletePage(doc, "p2"))).toEqual(["index", "carta"]);
  });

  it("refuses to delete the first page, which is the site's entry", () => {
    expect(() => deletePage(doc, "home")).toThrow(/is the site's entry/);
  });

  it("throws on a page the document does not have", () => {
    expect(() => deletePage(doc, "no-such")).toThrow(/no page/);
  });

  it("produces a document that still parses", () => {
    expect(() => parseDocument(deletePage(doc, "p3"))).not.toThrow();
  });
});
