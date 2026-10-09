import { blankSection, GALLERY_ID, PLACEHOLDER_SAMPLE_ID } from "@retorika/catalog";
import { EMPTY_ANSWERS, generateVariants, SECTOR_IDS } from "@retorika/generator";
import { hasSamplePhotos } from "@retorika/photobank";
import {
  flattenElements,
  insertSection,
  parseDocument,
  type RetorikaDocument,
  setElementImageSrc,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { listOwnPhotoSrcs } from "../src/editor/ownPhotos.ts";

/**
 * Which photographs are the owner's, and therefore which ones go to the account (ADR 0037).
 *
 * The mirror of `samplePhotos.test.ts`: that one asserts what the app has to *fetch*, this one
 * asserts what it has to *store*. The two must never overlap, and the last case here is the one
 * that says so against a real generated site.
 */

const ANSWERS = {
  ...EMPTY_ANSWERS,
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar" as const,
  services: ["comidas", "tapas"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  mainAction: "book" as const,
  bookingLink: "https://reservas.example.com/taberna",
};

/** A sector whose owner still gets the empty marker, found rather than named — the same guard
 * `samplePhotos.test.ts` uses, and for the same reason. */
const SECTOR_WITHOUT_BANK = (() => {
  const found = SECTOR_IDS.find((sector) => !hasSamplePhotos(sector));
  if (!found) throw new Error("every sector has photographs — the empty case no longer exists");
  return found;
})();

function generated(sector: (typeof ANSWERS)["sector"] | typeof SECTOR_WITHOUT_BANK) {
  const site = generateVariants({ ...ANSWERS, sector })[0];
  if (!site) throw new Error("generateVariants produced nothing");
  return site.document;
}

/** Every image in the document, with the address `setElementImageSrc` takes. */
function images(doc: RetorikaDocument) {
  return doc.pages.flatMap((page) =>
    page.sections.flatMap((section) =>
      flattenElements(section.content)
        .filter((element) => element.value?.kind === "image")
        .map((element) => ({ sectionId: section.id, elementId: element.id, element })),
    ),
  );
}

/** Replaces the nth image of a document with an upload, the way `handlePickPhoto` does — and
 * `setElementImageSrc` is what removes the `sample` field while doing it. */
function withUpload(doc: RetorikaDocument, src: string, nth = 0): RetorikaDocument {
  const target = images(doc)[nth];
  if (!target) throw new Error(`no image at index ${nth} to replace`);
  return setElementImageSrc(doc, { sectionId: target.sectionId, elementId: target.elementId }, src);
}

describe("listOwnPhotoSrcs", () => {
  it("is empty for a generated site, because nothing in one is the owner's yet", () => {
    // Both halves of the bank's state, so neither becomes vacuous: a sector with photographs names
    // bank ids, and one without names the marker. Neither is an upload.
    expect(listOwnPhotoSrcs(generated("restaurante-bar"))).toEqual([]);
    expect(listOwnPhotoSrcs(generated(SECTOR_WITHOUT_BANK))).toEqual([]);
  });

  it("lists a photograph the owner put there", () => {
    const doc = withUpload(generated("restaurante-bar"), "foto-sec-cover-el-image.jpg");
    expect(listOwnPhotoSrcs(doc)).toEqual(["foto-sec-cover-el-image.jpg"]);
  });

  it("excludes a bank photograph even though its src is an ordinary file name", () => {
    // The field decides, not the shape of the src — which is what makes this an assertion about
    // the document's own vocabulary rather than about a naming convention that could change.
    const doc = generated("restaurante-bar");
    const values = images(doc).map(({ element }) =>
      element.value?.kind === "image" ? element.value : undefined,
    );
    expect(values.length, "a generated restaurante-bar site has a photograph").toBeGreaterThan(0);
    for (const value of values) {
      expect(value?.sample, "the bank photograph declares itself").toBeDefined();
      expect(value?.sample).not.toBe(PLACEHOLDER_SAMPLE_ID);
      expect(value?.src.startsWith("data:"), "it is a file, not an inline marker").toBe(false);
    }
    expect(listOwnPhotoSrcs(doc)).toEqual([]);
  });

  it("excludes the catalog's marker, which is a data: URI and declares itself as well", () => {
    const doc = generated(SECTOR_WITHOUT_BANK);
    expect(listOwnPhotoSrcs(doc)).toEqual([]);
  });

  it("finds a photograph inside a gallery's list item", () => {
    // The nesting that caused three defects in one day of sprint 5, and the reason this walks with
    // `flattenElements` rather than over `section.content`.
    const base = parseDocument(generated("restaurante-bar"));
    const page = base.pages[0];
    if (!page) throw new Error("no page");
    const withGallery = insertSection(
      base,
      page.id,
      page.sections.length,
      blankSection(GALLERY_ID, "stacked", "sec-gallery"),
    );
    const gallery = withGallery.pages
      .flatMap((candidate) => candidate.sections)
      .find((section) => section.preset.catalogId === GALLERY_ID);
    if (!gallery) throw new Error("the gallery was not inserted");
    // The fixture is only worth anything if the photograph really is nested: a walk over
    // `section.content` alone reaches none of a gallery's photographs.
    expect(gallery.content.filter((element) => element.value?.kind === "image")).toHaveLength(0);
    const nested = flattenElements(gallery.content).find(
      (element) => element.value?.kind === "image",
    );
    expect(nested, "the gallery has a photograph slot").toBeDefined();
    if (!nested) return;

    const uploaded = setElementImageSrc(
      withGallery,
      { sectionId: gallery.id, elementId: nested.id },
      "foto-sec-gallery-el-photo-1.jpg",
    );
    expect(listOwnPhotoSrcs(uploaded)).toContain("foto-sec-gallery-el-photo-1.jpg");
  });

  it("names one src once, however many elements share it", () => {
    // Two elements can legitimately carry the same `src`, and uploading the same bytes twice under
    // the same key is a wasted round trip rather than a bug — which is why this is deduplicated
    // here and not left to the caller, the same choice `listSampleRefs` made.
    const base = parseDocument(generated("restaurante-bar"));
    const page = base.pages[0];
    if (!page) throw new Error("no page");
    const withGallery = insertSection(
      base,
      page.id,
      page.sections.length,
      blankSection(GALLERY_ID, "stacked", "sec-gallery"),
    );
    // Two different slots, one file: the cover and a gallery card.
    const doc = withUpload(
      withUpload(withGallery, "foto-compartida.jpg", 0),
      "foto-compartida.jpg",
      1,
    );
    expect(images(doc).length, "two slots to share one file").toBeGreaterThan(1);
    expect(listOwnPhotoSrcs(doc)).toEqual(["foto-compartida.jpg"]);
  });
});
