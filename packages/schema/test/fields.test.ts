import { describe, expect, it } from "vitest";
import type { RetorikaDocument, Section } from "../src/document.ts";
import { applyTextEdits, listEditableFields } from "../src/fields.ts";
import { parseDocument } from "../src/parse.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

const section: Section = {
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
      id: "el-services",
      role: "list",
      hidden: false,
      slot: "services",
      items: [
        {
          id: "item-1",
          elements: [
            {
              id: "el-card-1-title",
              role: "heading",
              hidden: false,
              slot: "title",
              value: { kind: "text", text: "Corte" },
            },
            {
              id: "el-card-1-description",
              role: "body",
              hidden: false,
              slot: "description",
              value: { kind: "text", text: "Corte a tu gusto." },
            },
          ],
        },
      ],
    },
    {
      id: "el-cta",
      role: "button",
      hidden: false,
      slot: "primaryAction",
      value: { kind: "link", text: "Reservar", href: "tel:+34600000000" },
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

function documentWith(overrideSection: Section): RetorikaDocument {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    pages: [{ id: "home", slug: "index", title: "Inicio", sections: [overrideSection] }],
    collections: [],
  };
}

const doc = documentWith(section);

describe("applyTextEdits", () => {
  it("replaces a top-level element's text by id", () => {
    const edited = applyTextEdits(doc, { "el-headline": "Barbería Espinel" });
    const headline = edited.pages[0]?.sections[0]?.content[0];
    expect(headline?.value).toEqual({ kind: "text", text: "Barbería Espinel" });
  });

  it("replaces a link's label without touching its href", () => {
    const edited = applyTextEdits(doc, { "el-cta": "Llámanos ya" });
    const cta = edited.pages[0]?.sections[0]?.content.find((el) => el.id === "el-cta");
    expect(cta?.value).toEqual({ kind: "link", text: "Llámanos ya", href: "tel:+34600000000" });
  });

  it("reaches an element nested inside a list item", () => {
    const edited = applyTextEdits(doc, { "el-card-1-title": "Corte a máquina" });
    const list = edited.pages[0]?.sections[0]?.content.find((el) => el.id === "el-services");
    const title = list?.items?.[0]?.elements.find((el) => el.id === "el-card-1-title");
    expect(title?.value).toEqual({ kind: "text", text: "Corte a máquina" });
  });

  it("applies several edits from one call, leaving everything else untouched", () => {
    const edited = applyTextEdits(doc, {
      "el-headline": "Nuevo título",
      "el-card-1-description": "Nueva descripción.",
    });
    expect(listEditableFields(edited).find((f) => f.elementId === "el-headline")?.text).toBe(
      "Nuevo título",
    );
    expect(
      listEditableFields(edited).find((f) => f.elementId === "el-card-1-description")?.text,
    ).toBe("Nueva descripción.");
    // Untouched fields, unchanged.
    expect(listEditableFields(edited).find((f) => f.elementId === "el-image")?.text).toBe("Foto");
  });

  it("ignores an id that matches nothing in the document", () => {
    const edited = applyTextEdits(doc, { "no-such-id": "does nothing" });
    expect(edited).toEqual(doc);
  });

  it("is a no-op — same reference — for an empty edits object", () => {
    expect(applyTextEdits(doc, {})).toBe(doc);
  });

  it("never changes an element's id, role or slot: only textOf's own field", () => {
    const edited = applyTextEdits(doc, { "el-headline": "x" });
    const headline = edited.pages[0]?.sections[0]?.content[0];
    expect(headline?.id).toBe("el-headline");
    expect(headline?.role).toBe("heading");
    expect(headline?.slot).toBe("headline");
  });

  it("produces a document that still parses: content edits cannot break structure", () => {
    const edited = applyTextEdits(doc, {
      "el-headline": "",
      "el-cta": 'Nuevo texto con <angle> brackets and "quotes"',
    });
    expect(() => parseDocument(edited)).not.toThrow();
  });
});
