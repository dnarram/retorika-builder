import { type ContentElement, checkAgainstPreset, type Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { blankItem, blankSection } from "../src/blank.ts";
import {
  GALLERY_ID,
  GALLERY_ITEM_SLOTS,
  GALLERY_PHOTOS,
  GALLERY_SLOTS,
  GALLERY_VARIANTS,
  galleryPreset,
} from "../src/gallery.ts";
import { PLACEHOLDER_IMAGE_ALT, presetFor, sectionsMatching } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * "Fotos de trabajos" — the eighth catalog section, and the other half of the sentence sprint 4
 * answered: «le falta una sección para mostrar los platos estrella **o** poner la carta del
 * restaurante» (Taberna, 25 Sep).
 *
 * What is pinned here is the shape of one card, because that is where the decisions are: a
 * photograph and a caption that is a paragraph rather than a heading.
 */

function photo(id: string, src: string, alt: string): ContentElement {
  return { id, role: "image", hidden: false, slot: "photo", value: { kind: "image", src, alt } };
}

function caption(id: string, text: string): ContentElement {
  return { id, role: "body", hidden: false, slot: "caption", value: { kind: "text", text } };
}

function section(items: { id: string; elements: ContentElement[] }[]): Section {
  return {
    id: "sec-gallery",
    preset: { catalogId: GALLERY_ID, variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Nuestros trabajos" },
      },
      { id: "el-photos", role: "list", hidden: false, slot: "photos", items },
    ],
  };
}

const oneCard = {
  id: "item-1",
  elements: [
    photo("el-1-photo", "assets/corte.jpg", "Un corte terminado"),
    caption("el-1-caption", "Corte clásico"),
  ],
};

describe("the shape of a gallery", () => {
  it("is a title, an optional introduction and a list of photographs", () => {
    expect(GALLERY_SLOTS).toEqual([
      { slot: "headline", role: "heading", min: 1, max: 1 },
      { slot: "intro", role: "body", min: 0, max: 1 },
      { slot: "photos", role: "list", min: 1, max: 1 },
    ]);
  });

  it("makes a card a photograph and then its caption, in that reading order", () => {
    expect(GALLERY_ITEM_SLOTS.map((slot) => slot.slot)).toEqual(["photo", "caption"]);
  });

  it("keeps the caption a body, so a gallery does not invent sections in the outline", () => {
    // The one place this section departs from every other list in the catalog, and the reason is
    // issue #19's: a caption heads nothing. Eight of them marked up as headings would put eight
    // entries in a screen reader's heading list, each announcing a part of the page that is not
    // there. Asserted rather than left to a comment, because "make it an h3 like the others" is
    // exactly the tidying-up someone would do later in good faith.
    const captionSlot = GALLERY_ITEM_SLOTS.find((slot) => slot.slot === "caption");
    expect(captionSlot?.role).toBe("body");
  });

  it("requires both, so a new photograph is born with somewhere to type", () => {
    // `prices.ts`'s argument, applied again: nothing in this editor can reach a list item's
    // optional slot, so min: 0 would mean a caption that exists and can never be written.
    for (const slot of GALLERY_ITEM_SLOTS) expect(slot.min, slot.slot).toBe(1);
  });

  it("stops at eight photographs, between a card grid's six and a carta's twelve", () => {
    expect(GALLERY_PHOTOS).toEqual({ min: 1, max: 8 });
  });

  it("is a valid section against its own preset", () => {
    expect(checkAgainstPreset(section([oneCard]), galleryPreset)).toEqual([]);
  });

  it("is registered, so the editor's menu offers it without being told", () => {
    // `Variants.tsx` builds the "Añadir sección aquí" menu from `Object.keys(CATALOG)`. Being in
    // the registry is the whole of what it takes to appear there.
    expect(presetFor(GALLERY_ID)).toBe(galleryPreset);
  });
});

describe("a gallery that has just been added", () => {
  const blank = blankSection(GALLERY_ID, "stacked", "sec-1");

  it("is valid the moment it is inserted", () => {
    expect(checkAgainstPreset(blank, galleryPreset)).toEqual([]);
  });

  it("arrives with one photograph already in it, not an empty list", () => {
    const list = blank.content.find((element) => element.role === "list");
    expect(list?.items).toHaveLength(1);
  });

  it("puts the marker photograph in it rather than an empty src", () => {
    // An `<img src="">` in a client's ZIP is a broken image, not a placeholder. The catalog's own
    // marker image is a data URI, so it also works from `file://` with nothing serving it.
    const list = blank.content.find((element) => element.role === "list");
    const image = list?.items?.[0]?.elements.find((element) => element.role === "image");
    expect(image?.value?.kind).toBe("image");
    if (image?.value?.kind !== "image") throw new Error("no image in a blank gallery card");
    expect(image.value.src.startsWith("data:image/svg+xml,")).toBe(true);
    expect(image.value.alt).toBe(PLACEHOLDER_IMAGE_ALT);
  });

  it("puts marker words under it, in Spanish and from the locale file", () => {
    const list = blank.content.find((element) => element.role === "list");
    const words = list?.items?.[0]?.elements.find((element) => element.slot === "caption");
    expect(words?.value).toEqual({
      kind: "text",
      text: es["section.gallery.placeholder.item.caption"],
    });
  });
});

describe("adding a photograph to a gallery that already has some", () => {
  it("builds a card with both halves filled", () => {
    // `addItem` in `@retorika/schema` takes a line already built; what a valid one looks like is
    // this package's business. Without this, the "Añadir" button under a gallery has nothing to add.
    const item = blankItem(GALLERY_ID);
    expect(item.elements.map((element) => element.slot)).toEqual(["photo", "caption"]);
    expect(item.elements[0]?.value?.kind).toBe("image");
    expect(item.elements[1]?.value?.kind).toBe("text");
  });

  it("makes a section that is still valid once the card is in it", () => {
    const added = { id: "item-2", elements: blankItem(GALLERY_ID).elements };
    expect(checkAgainstPreset(section([oneCard, added]), galleryPreset)).toEqual([]);
  });
});

describe("every composition draws a gallery", () => {
  it.each(GALLERY_VARIANTS)("%s places the title, the introduction and the grid", (variantId) => {
    const elements: ContentElement[] = [
      {
        id: "el-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Nuestros trabajos" },
      },
      {
        id: "el-intro",
        role: "body",
        hidden: false,
        slot: "intro",
        value: { kind: "text", text: "Los últimos." },
      },
      { id: "el-photos", role: "list", hidden: false, slot: "photos", items: [oneCard] },
    ];
    const placed = galleryPreset.layoutFor(variantId, elements).placements;
    expect(placed.map((placement) => placement.elementId).sort()).toEqual(
      elements.map((element) => element.id).sort(),
    );
  });

  it("refuses a composition it does not have, rather than drawing an empty box", () => {
    expect(() => galleryPreset.layoutFor("mosaico", [])).toThrow(/mosaico/);
  });
});

describe("finding it by what an owner would type", () => {
  it.each(["galería", "galeria", "fotos", "imágenes", "antes y después", "escaparate"])(
    "«%s» finds it",
    (query) => {
      expect(sectionsMatching(query)).toContain(GALLERY_ID);
    },
  );

  it("«platos estrella» finds the photographs first, which is what Taberna asked for", () => {
    // The exact words of the session. `prices` still matches — «platos» is one of its aliases and
    // is contained in this query — but it comes second, because the words say photographs.
    expect(sectionsMatching("platos estrella")[0]).toBe(GALLERY_ID);
  });

  it("«platos» alone finds the carta first, and the photographs behind it", () => {
    // Conchi's phrasing pairs the word with a list: «mis platos, la carta, etc.». Both are right,
    // so both are offered; `SHARED_ALIASES` decides which is first rather than the registry's order.
    expect(sectionsMatching("platos").slice(0, 2)).toEqual(["prices", GALLERY_ID]);
  });

  it("leaves «carta» where sprint 4 put it", () => {
    // The regression this section could cause: a gallery is not a carta, and claiming the word
    // would move it in front of the section that has prices on every line.
    expect(sectionsMatching("carta")[0]).toBe("prices");
    expect(sectionsMatching("carta")).not.toContain(GALLERY_ID);
  });
});

describe("what the editor shows", () => {
  it.each([
    "section.gallery.name",
    "section.gallery.description",
    "section.gallery.slot.headline",
    "section.gallery.slot.intro",
    "section.gallery.slot.photos",
    "section.gallery.item.photo",
    "section.gallery.item.caption",
  ])("%s is in the locale file", (key) => {
    expect(es[key as keyof typeof es]).toBeTruthy();
  });

  it("keeps the dossier's name, as «Precios» did", () => {
    // The dossier's nine list it as «Fotos de trabajos». A restaurant's photographs are of dishes
    // and not of "trabajos", and the answer is the one sprint 4 already validated: the name in the
    // menu stays, and the search understands what the owner would actually type.
    expect(es["section.gallery.name"]).toBe("Fotos de trabajos");
  });
});
