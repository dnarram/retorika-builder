import { describe, expect, it } from "vitest";
import type { RetorikaDocument, Section } from "../src/document.ts";
import { parseDocument } from "../src/parse.ts";
import { deleteSection, findSection } from "../src/sections.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

const cover: Section = {
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
      id: "el-image",
      role: "image",
      hidden: false,
      slot: "image",
      value: { kind: "image", src: "a.svg", alt: "Foto" },
    },
  ],
};

const location: Section = {
  id: "sec-location",
  preset: { catalogId: "location", variantId: "stacked" },
  source: "catalog",
  layout: null,
  content: [
    {
      id: "el-loc-headline",
      role: "heading",
      hidden: false,
      slot: "headline",
      value: { kind: "text", text: "Dónde estamos" },
    },
    {
      id: "el-address",
      role: "body",
      hidden: false,
      slot: "address",
      value: { kind: "text", text: "Calle Espinel 24" },
    },
  ],
};

function documentWith(sections: Section[]): RetorikaDocument {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    pages: [{ id: "home", slug: "index", title: "Inicio", sections }],
    collections: [],
  };
}

const doc = documentWith([cover, location]);

describe("findSection", () => {
  it("finds a section by id, with the page it lives on", () => {
    const found = findSection(doc, "sec-location");
    expect(found?.section.id).toBe("sec-location");
    expect(found?.page.id).toBe("home");
  });

  it("returns undefined for an id that does not exist", () => {
    expect(findSection(doc, "no-such-section")).toBeUndefined();
  });
});

describe("deleteSection", () => {
  it("removes exactly the named section, leaving the others in order", () => {
    const edited = deleteSection(doc, "sec-cover");
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual(["sec-location"]);
  });

  it("leaves the surviving section's content byte-for-byte the same", () => {
    const edited = deleteSection(doc, "sec-cover");
    expect(edited.pages[0]?.sections[0]).toEqual(location);
  });

  it("never mutates the document it started from", () => {
    const snapshot = JSON.stringify(doc);
    deleteSection(doc, "sec-cover");
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it("throws on an id that does not exist, rather than silently doing nothing", () => {
    expect(() => deleteSection(doc, "no-such-section")).toThrow(/no section "no-such-section"/);
  });

  it("produces a document that still parses", () => {
    const edited = deleteSection(doc, "sec-cover");
    expect(() => parseDocument(edited)).not.toThrow();
  });

  it("deleting the last section on a page leaves an empty, still-valid page", () => {
    const onePage = documentWith([cover]);
    const edited = deleteSection(onePage, "sec-cover");
    expect(edited.pages[0]?.sections).toEqual([]);
    expect(() => parseDocument(edited)).not.toThrow();
  });
});
