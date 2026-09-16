import { describe, expect, it } from "vitest";
import { FORBIDDEN_DOCUMENT_KEYS } from "../src/document.ts";
import { DocumentValidationError, parseDocument } from "../src/parse.ts";
import { TOKEN_KEYS } from "../src/tokens.ts";

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`]));

function validDocument(): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Peluquería Canina Lúa",
    theme,
    pages: [
      {
        id: "home",
        slug: "index",
        title: "Inicio",
        sections: [
          {
            id: "section-cover",
            preset: { catalogId: "cover", variantId: "image-right" },
            source: "catalog",
            content: [
              {
                id: "el-headline",
                role: "heading",
                hidden: false,
                slot: "headline",
                value: { kind: "text", text: "Tu perro, como nuevo" },
              },
            ],
            layout: null,
          },
        ],
      },
    ],
    collections: [],
  };
}

describe("what never enters the document", () => {
  it("accepts the baseline document these cases are built from", () => {
    expect(() => parseDocument(validDocument())).not.toThrow();
  });

  // The document describes a website. Depth belongs to the person looking at it, and
  // ownership, locking and payment belong to the database. Rejecting rather than
  // ignoring is the point: an ignored key would be written by some future caller and
  // silently lost, which is how depth becomes a property of the site — the Wix trap.
  it.each(Object.entries(FORBIDDEN_DOCUMENT_KEYS))(
    "rejects a %s key, which belongs to %s",
    (key) => {
      const doc = { ...validDocument(), [key]: "anything" };
      expect(() => parseDocument(doc)).toThrow(DocumentValidationError);
    },
  );
});
