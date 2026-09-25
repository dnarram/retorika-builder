import { describe, expect, it } from "vitest";
import type { RetorikaDocument, Section } from "../src/document.ts";
import { parseDocument } from "../src/parse.ts";
import {
  deleteSection,
  duplicateSection,
  findSection,
  mintSectionId,
  moveSection,
} from "../src/sections.ts";
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

const contact: Section = {
  id: "sec-contact",
  preset: { catalogId: "contact", variantId: "stacked" },
  source: "catalog",
  layout: null,
  content: [
    {
      id: "el-contact-headline",
      role: "heading",
      hidden: false,
      slot: "headline",
      value: { kind: "text", text: "Te esperamos" },
    },
    {
      id: "el-contact-cta",
      role: "button",
      hidden: false,
      slot: "primaryAction",
      value: { kind: "link", text: "Llámanos", href: "tel:+34600000000" },
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

const doc3 = documentWith([cover, location, contact]);

describe("mintSectionId", () => {
  it("appends -2 to an id already used by the section itself", () => {
    expect(mintSectionId(doc, "sec-cover")).toBe("sec-cover-2");
  });

  it("counts past every suffix already taken", () => {
    const withDuplicate = documentWith([cover, { ...cover, id: "sec-cover-2" }, location]);
    expect(mintSectionId(withDuplicate, "sec-cover")).toBe("sec-cover-3");
  });

  it("strips an existing numeric suffix before counting, so duplicating a duplicate does not nest", () => {
    const withDuplicate = documentWith([cover, { ...cover, id: "sec-cover-2" }]);
    expect(mintSectionId(withDuplicate, "sec-cover-2")).toBe("sec-cover-3");
  });

  it("returns the bare root when nothing is using it, even though that should not normally happen", () => {
    expect(mintSectionId(documentWith([location]), "sec-cover")).toBe("sec-cover");
  });
});

describe("duplicateSection", () => {
  it("inserts a copy directly after the original, with a freshly minted id", () => {
    const edited = duplicateSection(doc, "sec-cover");
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-cover",
      "sec-cover-2",
      "sec-location",
    ]);
  });

  it("keeps every element id and the layout verbatim in the clone", () => {
    const edited = duplicateSection(doc, "sec-cover");
    const clone = edited.pages[0]?.sections[1];
    expect(clone?.content.map((el) => el.id)).toEqual(cover.content.map((el) => el.id));
    expect(clone?.layout).toBe(cover.layout);
  });

  it("changes only the clone's id; its content is the original's, unchanged", () => {
    const edited = duplicateSection(doc, "sec-cover");
    const clone = edited.pages[0]?.sections[1];
    expect(clone?.content).toEqual(cover.content);
    expect(clone?.preset).toEqual(cover.preset);
  });

  it("leaves the original section completely untouched", () => {
    const edited = duplicateSection(doc, "sec-cover");
    expect(edited.pages[0]?.sections[0]).toEqual(cover);
  });

  it("never mutates the document it started from", () => {
    const snapshot = JSON.stringify(doc);
    duplicateSection(doc, "sec-cover");
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it("throws on an id that does not exist", () => {
    expect(() => duplicateSection(doc, "no-such-section")).toThrow(/no section/);
  });

  it("produces a document that still parses", () => {
    expect(() => parseDocument(duplicateSection(doc, "sec-cover"))).not.toThrow();
  });

  it("duplicating a duplicate mints the next id in sequence, not a nested one", () => {
    const once = duplicateSection(doc, "sec-cover");
    const twice = duplicateSection(once, "sec-cover-2");
    expect(twice.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-cover",
      "sec-cover-2",
      "sec-cover-3",
      "sec-location",
    ]);
  });
});

describe("moveSection", () => {
  it("moves a section forward", () => {
    const edited = moveSection(doc3, "sec-cover", 2);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-location",
      "sec-contact",
      "sec-cover",
    ]);
  });

  it("moves a section backward", () => {
    const edited = moveSection(doc3, "sec-contact", 0);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-contact",
      "sec-cover",
      "sec-location",
    ]);
  });

  it("swaps with its neighbour for a move up by one", () => {
    const edited = moveSection(doc3, "sec-location", 0);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-location",
      "sec-cover",
      "sec-contact",
    ]);
  });

  it("clamps an index past the end to the last position, rather than rejecting it", () => {
    const edited = moveSection(doc3, "sec-cover", 99);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-location",
      "sec-contact",
      "sec-cover",
    ]);
  });

  it("clamps a negative index to the first position", () => {
    const edited = moveSection(doc3, "sec-contact", -5);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-contact",
      "sec-cover",
      "sec-location",
    ]);
  });

  it("is a genuine no-op back to the same order when the index does not change", () => {
    const edited = moveSection(doc3, "sec-location", 1);
    expect(edited.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-cover",
      "sec-location",
      "sec-contact",
    ]);
  });

  it("leaves every section's own content untouched", () => {
    const edited = moveSection(doc3, "sec-cover", 2);
    const moved = edited.pages[0]?.sections.find((s) => s.id === "sec-cover");
    expect(moved).toEqual(cover);
  });

  it("never mutates the document it started from", () => {
    const snapshot = JSON.stringify(doc3);
    moveSection(doc3, "sec-cover", 2);
    expect(JSON.stringify(doc3)).toBe(snapshot);
  });

  it("throws on an id that does not exist", () => {
    expect(() => moveSection(doc3, "no-such-section", 0)).toThrow(/no section/);
  });

  it("produces a document that still parses", () => {
    expect(() => parseDocument(moveSection(doc3, "sec-cover", 2))).not.toThrow();
  });
});
