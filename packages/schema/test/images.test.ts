import { describe, expect, it } from "vitest";
import type { ContentElement, RetorikaDocument, Section } from "../src/document.ts";
import { imageSourcesOf, parseDocument, rewriteImageSources } from "../src/index.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * The one walk over every image a document names (ADR 0059): the elements, items included, and
 * the header's logo — the first `src` outside `sections[].content`. Thirteen readers call it, and
 * the one that would forget the logo on its own deletes it from the account's bucket.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function image(id: string, src: string, sample?: string): ContentElement {
  return {
    id,
    role: "image",
    hidden: false,
    slot: "image",
    value: { kind: "image", src, alt: `Foto ${id}`, ...(sample === undefined ? {} : { sample }) },
  };
}

function cover(): Section {
  return {
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
        value: { kind: "text", text: "Taberna" },
      },
      image("el-image", "foto-sec-cover-el-image.jpg"),
    ],
  };
}

/** A gallery whose photographs live inside list items, which is where every walk that forgot
 * them has been a defect. */
function gallery(): Section {
  return {
    id: "sec-gallery",
    preset: { catalogId: "gallery", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-list",
        role: "list",
        hidden: false,
        slot: "photos",
        items: [
          { id: "it-1", elements: [image("el-p1", "muestra-restaurante-bar.03.webp", "rb-03")] },
          { id: "it-2", elements: [image("el-p2", "foto-sec-gallery-el-p2.jpg")] },
        ],
      },
    ],
  };
}

function documentWith(header?: RetorikaDocument["header"]): RetorikaDocument {
  return parseDocument({
    schemaVersion: "1.15.0",
    id: "doc-images",
    siteName: "Taberna Santo Domingo",
    theme,
    collections: [],
    ...(header === undefined ? {} : { header }),
    pages: [{ id: "home", slug: "index", title: "Taberna", sections: [cover(), gallery()] }],
  });
}

describe("imageSourcesOf", () => {
  it("lists every element image in reading order, items included, with where it sits", () => {
    const sources = imageSourcesOf(documentWith());
    expect(sources.map((source) => source.src)).toEqual([
      "foto-sec-cover-el-image.jpg",
      "muestra-restaurante-bar.03.webp",
      "foto-sec-gallery-el-p2.jpg",
    ]);
    expect(sources[1]).toEqual({
      kind: "element",
      src: "muestra-restaurante-bar.03.webp",
      alt: "Foto el-p1",
      sample: "rb-03",
      pageId: "home",
      sectionId: "sec-gallery",
      elementId: "el-p1",
    });
    expect(sources.some((source) => source.kind === "logo")).toBe(false);
  });

  it("puts the header's logo first, with the site name as its alt", () => {
    const sources = imageSourcesOf(documentWith({ brand: { logo: { src: "logo-3f9a7c21.png" } } }));
    expect(sources[0]).toEqual({
      kind: "logo",
      src: "logo-3f9a7c21.png",
      alt: "Taberna Santo Domingo",
    });
    expect(sources).toHaveLength(4);
  });

  it("lists nothing for a header with a name and no logo", () => {
    expect(imageSourcesOf(documentWith({ brand: { name: true } }))).toHaveLength(3);
  });
});

describe("rewriteImageSources", () => {
  it("returns the same document when nothing changes", () => {
    const doc = documentWith({ brand: { logo: { src: "logo-3f9a7c21.png" } } });
    expect(rewriteImageSources(doc, (src) => src)).toBe(doc);
  });

  it("rewrites the logo and every element, nested ones included, and leaves the input alone", () => {
    const doc = documentWith({ brand: { logo: { src: "logo-3f9a7c21.png" } } });
    const before = JSON.stringify(doc);
    const out = rewriteImageSources(doc, (src) => `assets/${src}`);
    expect(imageSourcesOf(out).map((source) => source.src)).toEqual([
      "assets/logo-3f9a7c21.png",
      "assets/foto-sec-cover-el-image.jpg",
      "assets/muestra-restaurante-bar.03.webp",
      "assets/foto-sec-gallery-el-p2.jpg",
    ]);
    expect(JSON.stringify(doc)).toBe(before);
    // The rest of the header travels with the logo.
    expect(out.header?.brand).toEqual({ logo: { src: "assets/logo-3f9a7c21.png" } });
  });

  it("keeps the logo's size when it rewrites the logo's name", () => {
    // The publisher moves the logo under `assets/`; a size dropped on the way would publish an
    // `<img>` with no width again, the shift sprint 30 día 7 stored the size to remove.
    const doc = documentWith({
      brand: { logo: { src: "logo-3f9a7c21.png", width: 512, height: 205 } },
    });
    const out = rewriteImageSources(doc, (src) => `assets/${src}`);
    expect(out.header?.brand?.logo).toEqual({
      src: "assets/logo-3f9a7c21.png",
      width: 512,
      height: 205,
    });
  });

  it("rewrites only the logo when only the logo moves, and keeps the brand's name beside it", () => {
    const doc = documentWith({ brand: { name: true, logo: { src: "logo-3f9a7c21.png" } } });
    const out = rewriteImageSources(doc, (src) => (src.startsWith("logo-") ? "blob:x" : src));
    expect(out).not.toBe(doc);
    expect(out.header?.brand).toEqual({ name: true, logo: { src: "blob:x" } });
    expect(out.pages).toEqual(doc.pages);
  });
});
