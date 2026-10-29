import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { blankSection, GALLERY_ID } from "@retorika/catalog";
import { EMPTY_ANSWERS, generateVariants } from "@retorika/generator";
import { buildCss, render } from "@retorika/renderer";
import {
  flattenElements,
  insertSection,
  parseDocument,
  type RetorikaDocument,
  setElementImageSrc,
  setHeader,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { withFontUrls, withPhotoUrls } from "../src/editor/previewDocument.ts";

/**
 * The swap every preview makes: a bundle-relative photo name becomes the object URL of its bytes.
 *
 * Extracted from `Editor.tsx` on sprint 6 day 4 and tested here for the first time, because the
 * day it was inline the other screen that needed it did not have it — the three "elige por dónde
 * empezar" cards rendered the raw document, which was invisible while a generated site's only
 * image was the placeholder and became three broken images the moment the generator started
 * asking the bank.
 */

const ANSWERS = {
  ...EMPTY_ANSWERS,
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar" as const,
  services: ["comidas"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  mainAction: "book" as const,
  bookingLink: "https://reservas.example.com/taberna",
};

function generated(): RetorikaDocument {
  const site = generateVariants(ANSWERS)[0];
  if (!site) throw new Error("generateVariants produced nothing");
  return site.document;
}

function imageSrcs(doc: RetorikaDocument): string[] {
  return doc.pages
    .flatMap((page) => page.sections)
    .flatMap((section) => flattenElements(section.content))
    .flatMap((element) => (element.value?.kind === "image" ? [element.value.src] : []));
}

describe("withPhotoUrls", () => {
  it("returns the document untouched when there is nothing to swap", () => {
    const doc = generated();
    expect(withPhotoUrls(doc, new Map())).toBe(doc);
  });

  it("leaves a src it has no bytes for alone, rather than blanking it", () => {
    const doc = generated();
    const swapped = withPhotoUrls(doc, new Map([["otra-cosa.jpg", "blob:x"]]));
    expect(imageSrcs(swapped)).toEqual(imageSrcs(doc));
  });

  it("swaps a photograph it does have bytes for", () => {
    const doc = generated();
    const page = doc.pages[0];
    const cover = page?.sections[0];
    if (!page || !cover) throw new Error("no cover");
    const image = cover.content.find((element) => element.value?.kind === "image");
    if (!image) throw new Error("the cover has no image");

    const named = setElementImageSrc(
      doc,
      { sectionId: cover.id, elementId: image.id },
      "foto-sec-cover-el-image.jpg",
    );
    const swapped = withPhotoUrls(named, new Map([["foto-sec-cover-el-image.jpg", "blob:abc"]]));
    expect(imageSrcs(swapped)).toContain("blob:abc");
  });

  it("swaps the header's logo, which lives outside every section (ADR 0059)", () => {
    const doc = setHeader(generated(), { brand: { logo: { src: "logo-3f9a7c21.png" } } });
    const swapped = withPhotoUrls(doc, new Map([["logo-3f9a7c21.png", "blob:logo"]]));
    expect(swapped.header?.brand?.logo?.src).toBe("blob:logo");
    expect(doc.header?.brand?.logo?.src).toBe("logo-3f9a7c21.png");
    // The photographs are left alone when only the logo has bytes, and vice versa.
    expect(imageSrcs(swapped)).toEqual(imageSrcs(doc));
    const onlyPhoto = withPhotoUrls(doc, new Map([["otra.jpg", "blob:x"]]));
    expect(onlyPhoto.header?.brand?.logo?.src).toBe("logo-3f9a7c21.png");
  });

  it("swaps a photograph inside a list item, where a gallery keeps them", () => {
    // The recursion. A gallery's photographs are nested one level deeper than a cover's, and a
    // swap that stopped at `section.content` left every one of them pointing at a name the iframe
    // resolves against the parent page — the exact defect found in sprint 5 day 3.
    const doc = generated();
    const page = doc.pages[0];
    if (!page) throw new Error("no page");
    const withGallery = insertSection(
      doc,
      page.id,
      page.sections.length,
      blankSection(GALLERY_ID, "stacked", "sec-gallery-2"),
    );
    const gallery = withGallery.pages
      .flatMap((p) => p.sections)
      .find((section) => section.id === "sec-gallery-2");
    if (!gallery) throw new Error("the gallery was not inserted");

    const nested = flattenElements(gallery.content).find(
      (element) => element.value?.kind === "image",
    );
    if (!nested) throw new Error("the gallery has no image");
    expect(gallery.content.some((element) => element.value?.kind === "image")).toBe(false);

    const named = setElementImageSrc(
      withGallery,
      { sectionId: gallery.id, elementId: nested.id },
      "foto-sec-gallery-el-item.jpg",
    );
    const swapped = withPhotoUrls(
      named,
      new Map([["foto-sec-gallery-el-item.jpg", "blob:nested"]]),
    );
    expect(imageSrcs(swapped)).toContain("blob:nested");
  });

  it("does not mutate the document it was given — the ZIP is built from that one", () => {
    const doc = generated();
    const page = doc.pages[0];
    const cover = page?.sections[0];
    if (!page || !cover) throw new Error("no cover");
    const image = cover.content.find((element) => element.value?.kind === "image");
    if (!image) throw new Error("the cover has no image");
    const named = setElementImageSrc(
      doc,
      { sectionId: cover.id, elementId: image.id },
      "foto-sec-cover-el-image.jpg",
    );
    const before = imageSrcs(named);

    withPhotoUrls(named, new Map([["foto-sec-cover-el-image.jpg", "blob:abc"]]));
    expect(imageSrcs(named)).toEqual(before);
  });
});

describe("withFontUrls — the owner's faces in the preview (sprint 29 día 5)", () => {
  /** The corpus fixture: Gelasio from the gallery for the text, «Karla 2» the owner brought for
   * the headings — one face of each kind in one stylesheet, which is the case that can go wrong. */
  const OWN = parseDocument(
    JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../../fixtures/documents/letra-propia.json", import.meta.url)),
        "utf8",
      ),
    ),
  );
  const URLS = new Map([
    [
      "propia-3f9a7c21-regular.woff2",
      "blob:http://localhost:3000/0b1c2d3e-aaaa-bbbb-cccc-0123456789ab",
    ],
  ]);

  it("swaps only the faces it has bytes for, and leaves the gallery's to its route", () => {
    const css = buildCss(OWN);
    const swapped = withFontUrls(css, URLS);
    expect(swapped).toContain(
      'src: url("blob:http://localhost:3000/0b1c2d3e-aaaa-bbbb-cccc-0123456789ab") format("woff2");',
    );
    // The bold has not arrived: it keeps its relative name and the canvas draws the fallback.
    expect(swapped).toContain('src: url("fonts/propia-3f9a7c21-bold.woff") format("woff");');
    expect(swapped).toContain('src: url("fonts/gelasio-latin-400-normal.woff2") format("woff2");');
    // Nothing else in the sheet moved.
    expect(
      swapped.replace(
        URLS.get("propia-3f9a7c21-regular.woff2") as string,
        "fonts/propia-3f9a7c21-regular.woff2",
      ),
    ).toBe(css);
  });

  it("works on the first paint's html exactly as on a patch's stylesheet", () => {
    const html = render(OWN, "html").html;
    expect(withFontUrls(html, URLS)).toContain(URLS.get("propia-3f9a7c21-regular.woff2"));
  });

  it("refuses to write anything but an object URL into the stylesheet", () => {
    const hostile = new Map([["propia-3f9a7c21-regular.woff2", 'https://evil.example/x") ; }']]);
    expect(() => withFontUrls(buildCss(OWN), hostile)).toThrow(/not an object URL/);
  });

  it("is the text itself with no own faces in it", () => {
    const css = buildCss(generated());
    expect(withFontUrls(css, URLS)).toBe(css);
  });
});
