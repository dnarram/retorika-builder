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
import { listSampleRefs } from "../src/editor/samplePhotos.ts";

/**
 * Which photographs the app has to fetch bytes for.
 *
 * The empty case and the bank case are both real, and since 8 October 2026 they are told apart by
 * the sector rather than by the calendar. Until then the bank held nothing, so a generated
 * document named no photograph whatever the answers said; restaurante-bar now holds nine, so the
 * assertions about naming none are generated for a sector that still holds none — read off the
 * bank rather than named here, so filling another sector does not quietly turn one of them
 * vacuous.
 *
 * The documents that reference the bank are still built by stamping `sample` on by hand. That is
 * deliberate even now that a real one exists: these assertions are about ids and nesting that no
 * sector happens to produce today — a photograph inside a gallery's list item, two elements
 * sharing one file — and a fixture that depends on which photograph a hash picks would be a
 * fixture that changes when the bank grows.
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

/** A sector whose owner still gets the empty marker, found rather than named. If every sector
 * fills, this throws instead of silently generating a document with a photograph in it and
 * asserting there is none. */
const SECTOR_WITHOUT_BANK = (() => {
  const found = SECTOR_IDS.find((sector) => !hasSamplePhotos(sector));
  if (!found) throw new Error("every sector has photographs — the empty case no longer exists");
  return found;
})();

function generated(): RetorikaDocument {
  const site = generateVariants(ANSWERS)[0];
  if (!site) throw new Error("generateVariants produced nothing");
  return site.document;
}

/** The same site for a sector the bank has nothing for: every photograph is the catalog's marker. */
function generatedWithoutBank(): RetorikaDocument {
  const site = generateVariants({ ...ANSWERS, sector: SECTOR_WITHOUT_BANK })[0];
  if (!site) throw new Error("generateVariants produced nothing");
  return site.document;
}

/** A document whose cover image claims to have come from the bank. What the generator will
 * produce on its own the day `bank/restaurante-bar.json` stops being empty. */
function withBankCover(doc: RetorikaDocument, id = "restaurante-bar.01"): RetorikaDocument {
  const page = doc.pages[0];
  if (!page) throw new Error("no page");
  return parseDocument({
    ...doc,
    pages: doc.pages.map((p) =>
      p.id !== page.id
        ? p
        : {
            ...p,
            sections: p.sections.map((section) => ({
              ...section,
              content: section.content.map((element) =>
                element.value?.kind === "image"
                  ? {
                      ...element,
                      value: { ...element.value, src: `muestra-${id}.webp`, sample: id },
                    }
                  : element,
              ),
            })),
          },
    ),
  });
}

/** The same stamp, applied to a photograph **inside a list item** — a gallery card's — and to
 * nothing else. What a gallery will look like once a sector holds eight photographs. */
function stampGalleryPhoto(doc: RetorikaDocument, id: string): RetorikaDocument {
  return parseDocument({
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.preset.catalogId !== GALLERY_ID
          ? section
          : {
              ...section,
              content: section.content.map((element) =>
                !element.items
                  ? element
                  : {
                      ...element,
                      items: element.items.map((item, index) => ({
                        ...item,
                        elements: item.elements.map((nested) =>
                          index === 0 && nested.value?.kind === "image"
                            ? {
                                ...nested,
                                value: {
                                  ...nested.value,
                                  src: `muestra-${id}.webp`,
                                  sample: id,
                                },
                              }
                            : nested,
                        ),
                      })),
                    },
              ),
            },
      ),
    })),
  });
}

describe("a document with no bank photographs in it", () => {
  it("names none, for a sector the bank has no photographs for", () => {
    expect(listSampleRefs(generatedWithoutBank())).toEqual([]);
  });

  it("does not name the catalog's marker, which is a data: URI and needs no file", () => {
    const doc = generatedWithoutBank();
    // The marker really is there; it is simply not something to fetch.
    const samples = doc.pages
      .flatMap((page) => page.sections)
      .flatMap((section) => flattenElements(section.content))
      .flatMap((element) => (element.value?.kind === "image" ? [element.value.sample] : []));
    expect(samples).toContain(PLACEHOLDER_SAMPLE_ID);
    expect(listSampleRefs(doc)).toEqual([]);
  });

  it("does not name a photograph the owner uploaded, whose bytes are already stored", () => {
    const doc = generated();
    const page = doc.pages[0];
    const cover = page?.sections[0];
    if (!page || !cover) throw new Error("no cover");
    const image = cover.content.find((element) => element.value?.kind === "image");
    if (!image) throw new Error("the cover has no image");
    // `setElementImageSrc` strips `sample` as it writes — the field says the photograph is not the
    // owner's, and this is the moment it becomes theirs. That is what makes this assertion real
    // rather than incidental.
    const owned = setElementImageSrc(
      doc,
      { sectionId: cover.id, elementId: image.id },
      "foto-sec-cover-el-image.jpg",
    );
    expect(listSampleRefs(owned)).toEqual([]);
  });
});

describe("a document that does reference the bank", () => {
  it("names it once, with the id the route takes and the src everything else is keyed by", () => {
    expect(listSampleRefs(withBankCover(generated()))).toEqual([
      { id: "restaurante-bar.01", src: "muestra-restaurante-bar.01.webp" },
    ]);
  });

  it("looks inside list items, where a gallery's photographs live", () => {
    // The omission that caused three separate defects in one day of sprint 5. A gallery puts each
    // photograph inside a list item, so a walk over `section.content` alone finds none of them.
    // Generated without a bank on purpose: the assertion below is that the *nested* photograph is
    // the only one reported, which says nothing if the cover is a bank photograph too.
    const doc = generatedWithoutBank();
    const page = doc.pages[0];
    if (!page) throw new Error("no page");
    const withGallery = insertSection(
      doc,
      page.id,
      page.sections.length,
      blankSection(GALLERY_ID, "stacked", "sec-gallery"),
    );
    const stamped = withBankCover(withGallery);

    const gallery = stamped.pages
      .flatMap((p) => p.sections)
      .find((section) => section.preset.catalogId === GALLERY_ID);
    if (!gallery) throw new Error("the gallery was not inserted");
    // The fixture is only worth anything if the photograph really is nested: a gallery keeps its
    // photographs inside list items, so a walk over `section.content` alone reaches none of them.
    expect(gallery.content.filter((element) => element.value?.kind === "image")).toHaveLength(0);
    expect(
      flattenElements(gallery.content).filter((element) => element.value?.kind === "image").length,
    ).toBeGreaterThan(0);

    // And the assertion that actually depends on the recursion: the *nested* photograph is the one
    // stamped as the bank's, so a `listSampleRefs` that stopped at `section.content` would report
    // nothing at all. The first version of this test stamped only the cover, and passed
    // identically with the recursion removed — found by removing it.
    const nestedOnly = stampGalleryPhoto(withGallery, "restaurante-bar.07");
    expect(listSampleRefs(nestedOnly)).toEqual([
      { id: "restaurante-bar.07", src: "muestra-restaurante-bar.07.webp" },
    ]);
  });

  it("reports one entry per file, however many elements share it", () => {
    // Two elements can legitimately carry the same bank photograph once a sector holds fewer of
    // them than a gallery has cards. Fetching it twice would store the same bytes twice under the
    // same key; the deduplication is by src, which is what the store is keyed by.
    const doc = withBankCover(generated());
    const page = doc.pages[0];
    if (!page) throw new Error("no page");
    const twice = parseDocument({
      ...doc,
      pages: [
        {
          ...page,
          sections: [...page.sections, { ...page.sections[0], id: "sec-cover-2" }],
        },
        ...doc.pages.slice(1),
      ],
    });
    expect(listSampleRefs(twice)).toHaveLength(1);
  });
});
