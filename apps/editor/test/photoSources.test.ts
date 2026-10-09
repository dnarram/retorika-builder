import { blankSection, GALLERY_ID } from "@retorika/catalog";
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
import { photoSources } from "../src/editor/photoSources.ts";
import { listSampleRefs } from "../src/editor/samplePhotos.ts";

/**
 * Where the bytes of each photograph come from (ADR 0037).
 *
 * The one thing worth proving here beyond the plumbing is that the two sources **partition** the
 * photographs a document names: every one is fetched, and none is fetched twice from two places.
 * That is a property of the document's own `sample` field, which is why the last case asserts it
 * against a real generated site rather than against a document written to make it true.
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

function images(doc: RetorikaDocument) {
  return doc.pages.flatMap((page) =>
    page.sections.flatMap((section) =>
      flattenElements(section.content)
        .filter((element) => element.value?.kind === "image")
        .map((element) => ({ sectionId: section.id, elementId: element.id, element })),
    ),
  );
}

function withUpload(doc: RetorikaDocument, src: string, nth = 0): RetorikaDocument {
  const target = images(doc)[nth];
  if (!target) throw new Error(`no image at index ${nth}`);
  return setElementImageSrc(doc, { sectionId: target.sectionId, elementId: target.elementId }, src);
}

describe("photoSources", () => {
  it("asks the bank for a generated site, whether or not it is in the account", () => {
    const doc = generated("restaurante-bar");
    for (const fromAccount of [false, true]) {
      const sources = photoSources(doc, { fromAccount });
      expect(sources, String(fromAccount)).toHaveLength(1);
      expect(sources[0]?.kind).toBe("bank");
    }
  });

  it("asks for nothing when every photograph is the catalog's inline marker", () => {
    // A `data:` URI needs no fetch at all, from either source. Both halves say so.
    const doc = generated(SECTOR_WITHOUT_BANK);
    expect(photoSources(doc, { fromAccount: false })).toEqual([]);
    expect(photoSources(doc, { fromAccount: true })).toEqual([]);
  });

  it("asks the account for the owner's own photograph, and only for a site that is in one", () => {
    /**
     * The distinction that matters: for a site living in this browser the bytes are already here,
     * in IndexedDB, and asking a server for them would be asking for something nobody uploaded —
     * which would turn an ordinary anonymous session into a site that reports a failed photograph.
     */
    const doc = withUpload(generated("restaurante-bar"), "foto-sec-cover-el-image.jpg");
    expect(photoSources(doc, { fromAccount: false })).toEqual([]);
    expect(photoSources(doc, { fromAccount: true })).toEqual([
      { kind: "account", src: "foto-sec-cover-el-image.jpg" },
    ]);
  });

  it("asks both sources for a site that has one of each", () => {
    // The case that would have been missed by choosing one source per site: a saved web whose
    // owner replaced the cover but not the gallery still names a bank photograph, and those bytes
    // stay ours rather than being stored once per owner.
    const base = parseDocument(generated("restaurante-bar"));
    const page = base.pages[0];
    if (!page) throw new Error("no page");
    const withGallery = insertSection(
      base,
      page.id,
      page.sections.length,
      blankSection(GALLERY_ID, "stacked", "sec-gallery"),
    );
    // The cover keeps the bank's photograph; a gallery card gets the owner's.
    const gallery = withGallery.pages
      .flatMap((candidate) => candidate.sections)
      .find((section) => section.preset.catalogId === GALLERY_ID);
    if (!gallery) throw new Error("the gallery was not inserted");
    const slot = flattenElements(gallery.content).find(
      (element) => element.value?.kind === "image",
    );
    if (!slot) throw new Error("the gallery has no photograph slot");
    const doc = setElementImageSrc(
      withGallery,
      { sectionId: gallery.id, elementId: slot.id },
      "foto-sec-gallery-el-item-1-photo.jpg",
    );

    const sources = photoSources(doc, { fromAccount: true });
    expect(sources.filter((source) => source.kind === "bank")).toHaveLength(1);
    expect(sources.filter((source) => source.kind === "account")).toEqual([
      { kind: "account", src: "foto-sec-gallery-el-item-1-photo.jpg" },
    ]);
  });

  it("partitions the photographs: every one is asked for once, from exactly one source", () => {
    /**
     * **The property, not an example of it.** `listSampleRefs` and `listOwnPhotoSrcs` each read the
     * document's `sample` field and must never both claim the same photograph — one would be
     * fetched twice, and whichever answered second would overwrite the other's object URL with
     * bytes from the wrong place.
     *
     * Asserted over a site that carries one of each, plus the marker, which is every shape a
     * document can hold.
     */
    const base = parseDocument(generated("restaurante-bar"));
    const page = base.pages[0];
    if (!page) throw new Error("no page");
    const withGallery = insertSection(
      base,
      page.id,
      page.sections.length,
      blankSection(GALLERY_ID, "stacked", "sec-gallery"),
    );
    const doc = withUpload(withGallery, "foto-propia.jpg", 1);

    const sources = photoSources(doc, { fromAccount: true });
    const srcs = sources.map((source) => source.src);
    expect(new Set(srcs).size, "a photograph is asked for twice").toBe(srcs.length);

    const bank = new Set(listSampleRefs(doc).map((ref) => ref.src));
    const own = new Set(listOwnPhotoSrcs(doc));
    for (const src of bank) expect(own.has(src), `${src} claimed by both`).toBe(false);
    expect(srcs.sort()).toEqual([...bank, ...own].sort());

    // And every file-backed photograph in the document is covered by one of the two.
    const needed = images(doc)
      .map(({ element }) => (element.value?.kind === "image" ? element.value : undefined))
      .filter((value) => value !== undefined && !value.src.startsWith("data:"))
      .map((value) => value?.src);
    expect(srcs.sort()).toEqual([...new Set(needed)].sort());
  });
});
