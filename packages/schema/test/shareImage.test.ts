import { describe, expect, it } from "vitest";
import type { RetorikaDocument, Section } from "../src/document.ts";
import { shareImageOf } from "../src/shareImage.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function doc(sections: Section[], second: Section[] = []): RetorikaDocument {
  const pages = [{ id: "home", slug: "index", title: "Inicio", sections }];
  if (second.length > 0) {
    pages.push({ id: "p2", slug: "servicios", title: "Servicios", sections: second });
  }
  return {
    schemaVersion: "1.5.0",
    id: "doc-1",
    siteName: "Taberna",
    theme,
    pages,
    collections: [],
  };
}

function section(id: string, content: Section["content"]): Section {
  return {
    id,
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "catalog",
    layout: null,
    content,
  };
}

const image = (id: string, src: string, hidden = false) => ({
  id,
  role: "image" as const,
  hidden,
  slot: "image",
  value: { kind: "image" as const, src, alt: "Foto" },
});
const heading = (id: string) => ({
  id,
  role: "heading" as const,
  hidden: false,
  slot: "headline",
  value: { kind: "text" as const, text: "Taberna" },
});

describe("shareImageOf", () => {
  it("is the first visible image on the first page", () => {
    const found = shareImageOf(
      doc([section("sec-cover", [heading("el-h"), image("el-image", "assets/portada.jpg")])]),
    );
    expect(found).toEqual({ src: "assets/portada.jpg", alt: "Foto", elementId: "el-image" });
  });

  it("reads in page order, not slot order, so a deleted cover does not leave it blank", () => {
    // A cover can be deleted (ADR 0003). The first picture a visitor then meets is whatever is now
    // at the top, which is also the one a preview card should show.
    const found = shareImageOf(
      doc([
        section("sec-services", [heading("el-h")]),
        section("sec-gallery", [image("el-g1", "assets/uno.jpg")]),
      ]),
    );
    expect(found?.src).toBe("assets/uno.jpg");
  });

  it("skips a hidden image, because the page does not show it either", () => {
    const found = shareImageOf(
      doc([
        section("sec-cover", [image("el-hidden", "assets/oculta.jpg", true)]),
        section("sec-gallery", [image("el-shown", "assets/vista.jpg")]),
      ]),
    );
    expect(found?.src).toBe("assets/vista.jpg");
  });

  it("looks inside a list's items, where a gallery keeps its photographs", () => {
    const list: Section["content"][number] = {
      id: "el-list",
      role: "list",
      hidden: false,
      slot: "photos",
      items: [{ id: "item-1", elements: [image("el-item-photo", "assets/plato.jpg")] }],
    };
    expect(shareImageOf(doc([section("sec-gallery", [list])]))?.src).toBe("assets/plato.jpg");
  });

  it("ignores later pages: a shared link is the home page", () => {
    const found = shareImageOf(
      doc(
        [section("sec-cover", [heading("el-h")])],
        [section("sec-two", [image("el-i", "a.jpg")])],
      ),
    );
    expect(found).toBeUndefined();
  });

  it("is undefined for a document with no picture at all", () => {
    expect(shareImageOf(doc([section("sec-cover", [heading("el-h")])]))).toBeUndefined();
  });
});
