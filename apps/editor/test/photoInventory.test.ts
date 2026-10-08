import { blankSection, GALLERY_ID, teaserSection } from "@retorika/catalog";
import { EMPTY_ANSWERS, generateVariants, SECTOR_IDS } from "@retorika/generator";
import { hasSamplePhotos } from "@retorika/photobank";
import {
  insertSection,
  parseDocument,
  type RetorikaDocument,
  sectionToPage,
  setElementImageSrc,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { countPhotos, listPhotos } from "../src/editor/photoInventory.ts";

/**
 * The inventory the «Fotos» panel and the pre-download warning both read.
 *
 * Tested against documents built the way the product builds them — generated, converted, inserted
 * — rather than hand-written ones, because the thing most likely to go wrong is not the counting
 * but *where it looks*: a gallery's photographs live inside list items, and a converted page's
 * live on a page that is not the first.
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

/** A sector whose owner still gets the marker rather than a photograph, found rather than named,
 * so this stops compiling a vacuous case the day the last sector fills. */
const SECTOR_WITHOUT_BANK = (() => {
  const found = SECTOR_IDS.find((sector) => !hasSamplePhotos(sector));
  if (!found) throw new Error("every sector has photographs — the empty case no longer exists");
  return found;
})();

function generated(): RetorikaDocument {
  const [first] = generateVariants(ANSWERS);
  if (!first) throw new Error("the generator produced no variant");
  return first.document;
}

/** The same site for a sector the bank has nothing for. */
function generatedWithoutBank(): RetorikaDocument {
  const [first] = generateVariants({ ...ANSWERS, sector: SECTOR_WITHOUT_BANK });
  if (!first) throw new Error("the generator produced no variant");
  return first.document;
}

/** The same document with a gallery added to the home page, as the pill would. */
function withGallery(doc: RetorikaDocument): RetorikaDocument {
  const page = doc.pages[0];
  if (!page) throw new Error("no page");
  return insertSection(
    doc,
    page.id,
    page.sections.length,
    blankSection(GALLERY_ID, "stacked", "sec-gallery"),
  );
}

describe("what a generated site has", () => {
  it("has exactly one photograph, and nobody has put it there", () => {
    // The number this whole sprint is about. A site the generator produces carries one image, and
    // that is its entire visual content — one, whether the bank fills it or not.
    const photos = listPhotos(generatedWithoutBank());
    expect(photos).toHaveLength(1);
    expect(photos[0]?.state).toBe("empty");
    expect(countPhotos(generatedWithoutBank())).toEqual({ empty: 1, sample: 0, own: 0, total: 1 });
  });

  it("counts that photograph as a sample when the sector has a bank", () => {
    // `"sample"` was written on 29 September 2026 and could not be produced by anything until
    // restaurante-bar was approved on 8 October: with every sector empty, `sampleImageFor` always
    // answered the catalog marker, so the whole «Foto de ejemplo» half of the editor — this state,
    // the canvas badge, the chip in «Fotos», the ADR 0011 wording in the pre-download warning —
    // was reachable only from a hand-written document. This is the first assertion that reaches it
    // the way an owner does.
    expect(hasSamplePhotos("restaurante-bar"), "the fixture sector lost its bank").toBe(true);
    const photos = listPhotos(generated());
    expect(photos).toHaveLength(1);
    expect(photos[0]?.state).toBe("sample");
    expect(countPhotos(generated())).toEqual({ empty: 0, sample: 1, own: 0, total: 1 });
  });

  it("says where that photograph is, in words the owner would recognise", () => {
    const [photo] = listPhotos(generated());
    expect(photo?.pageTitle).toBe("Taberna Santo Domingo");
    expect(photo?.sectionName).toBe("Portada");
    expect(photo?.itemNumber).toBeUndefined();
  });
});

describe("photographs inside a list", () => {
  it("finds a gallery's own, which live inside list items", () => {
    // The walk every other one in this repository has forgotten at least once — three defects in a
    // single day of sprint 5 came from stopping at `section.content`.
    const photos = listPhotos(withGallery(generated()));
    expect(photos).toHaveLength(2);
    expect(photos[1]?.sectionName).toBe("Fotos de trabajos");
  });

  it("numbers them within their own list, not among everything in the section", () => {
    const doc = withGallery(generated());
    const gallery = doc.pages[0]?.sections.find((s) => s.preset.catalogId === GALLERY_ID);
    const list = gallery?.content.find((el) => el.role === "list");
    if (!gallery || !list?.items) throw new Error("no gallery list");

    // Two more photographs, so the numbering has something to get wrong.
    const grown = parseDocument({
      ...doc,
      pages: doc.pages.map((page, index) =>
        index !== 0
          ? page
          : {
              ...page,
              sections: page.sections.map((section) =>
                section.id !== gallery.id
                  ? section
                  : {
                      ...section,
                      content: section.content.map((el) =>
                        el.id !== list.id
                          ? el
                          : {
                              ...el,
                              items: [
                                ...(el.items ?? []),
                                {
                                  id: "item-2",
                                  elements: (el.items?.[0]?.elements ?? []).map((nested) => ({
                                    ...nested,
                                    id: `${nested.id}-2`,
                                  })),
                                },
                              ],
                            },
                      ),
                    },
              ),
            },
      ),
    });

    const inGallery = listPhotos(grown).filter((p) => p.sectionName === "Fotos de trabajos");
    expect(inGallery.map((p) => p.itemNumber)).toEqual([1, 2]);
  });
});

describe("photographs on a page that is not the first", () => {
  it("finds them, and names the page they are on", () => {
    const makeTeaser = ({ sectionId, href }: { sectionId: string; href: string }) =>
      teaserSection(sectionId, href, "Ver más");
    const doc = sectionToPage(withGallery(generated()), "sec-gallery", makeTeaser);

    const photos = listPhotos(doc);
    const moved = photos.find((p) => p.sectionName === "Fotos de trabajos");
    expect(moved?.pageId).not.toBe(doc.pages[0]?.id);
    expect(moved?.pageTitle).toBe(doc.pages[1]?.title);
  });
});

describe("whose photograph it is", () => {
  it("counts one as the owner's the moment they replace it", () => {
    const doc = generated();
    const [photo] = listPhotos(doc);
    if (!photo) throw new Error("no photo");

    const after = setElementImageSrc(
      doc,
      { sectionId: photo.sectionId, elementId: photo.elementId },
      "foto-sec-cover-el-image.jpg",
    );
    expect(countPhotos(after)).toEqual({ empty: 0, sample: 0, own: 1, total: 1 });
  });

  it("tells a bank photograph from the grey marker", () => {
    // Two different things to say to an owner: one is a photograph of somebody else's business,
    // the other is a hole. The warning before a download says different sentences for each.
    const doc = generated();
    const page = doc.pages[0];
    const section = page?.sections[0];
    const element = section?.content.find((el) => el.value?.kind === "image");
    if (!page || !section || !element || element.value?.kind !== "image") {
      throw new Error("no cover image");
    }

    const sampled = parseDocument({
      ...doc,
      pages: [
        {
          ...page,
          sections: page.sections.map((candidate) =>
            candidate.id !== section.id
              ? candidate
              : {
                  ...candidate,
                  content: candidate.content.map((el) =>
                    el.id !== element.id
                      ? el
                      : {
                          ...el,
                          value: {
                            ...el.value,
                            src: "muestra-restaurante-bar.03.webp",
                            sample: "restaurante-bar.03",
                          },
                        },
                  ),
                },
          ),
        },
        ...doc.pages.slice(1),
      ],
    });

    expect(countPhotos(sampled)).toEqual({ empty: 0, sample: 1, own: 0, total: 1 });
  });
});

describe("a site with no photographs at all", () => {
  it("answers an empty list rather than throwing", () => {
    // Reachable: a cover can be deleted, and nothing else a generated site carries holds an image.
    const doc = generated();
    const page = doc.pages[0];
    if (!page) throw new Error("no page");
    const withoutCover = parseDocument({
      ...doc,
      pages: [
        { ...page, sections: page.sections.filter((s) => s.preset.catalogId !== "cover") },
        ...doc.pages.slice(1),
      ],
    });

    expect(listPhotos(withoutCover)).toEqual([]);
    expect(countPhotos(withoutCover)).toEqual({ empty: 0, sample: 0, own: 0, total: 0 });
  });
});
