import { describe, expect, it } from "vitest";
import { listAnchorsTo, listDeadDestinations } from "../src/destinations.ts";
import type { ContentElement, RetorikaDocument, Section } from "../src/document.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function action(id: string, href: string, hidden = false): ContentElement {
  return {
    id,
    role: "button",
    hidden,
    slot: "primaryAction",
    value: { kind: "link", text: "Reserva tu cita", href },
  };
}

/** A document whose contact section holds `content`, plus a cover an anchor can resolve to. */
function documentWithCover(content: ContentElement[]): RetorikaDocument {
  const doc = documentWith(content);
  const page = doc.pages[0];
  if (!page) throw new Error("no page");
  const contact = page.sections[0];
  if (!contact) throw new Error("no section");
  const cover: Section = {
    id: "sec-cover",
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "catalog",
    layout: null,
    content: [],
  };
  return { ...doc, pages: [{ ...page, sections: [cover, contact] }] };
}

function documentWith(content: ContentElement[]): RetorikaDocument {
  const section: Section = {
    id: "sec-contact",
    preset: { catalogId: "contact", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content,
  };
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    pages: [{ id: "home", slug: "index", title: "Inicio", sections: [section] }],
    collections: [],
  };
}

describe("listDeadDestinations", () => {
  it("finds a link whose href is empty", () => {
    const dead = listDeadDestinations(documentWith([action("el-cta", "")]));
    expect(dead).toHaveLength(1);
    expect(dead[0]).toMatchObject({
      pageId: "home",
      sectionId: "sec-contact",
      elementId: "el-cta",
      slot: "primaryAction",
      role: "button",
      text: "Reserva tu cita",
    });
  });

  it("finds a link whose href is a bare #", () => {
    // What a hand-written placeholder usually is, and what safeUrl neutralises a dangerous
    // scheme down to. Either way the visitor presses it and nothing happens.
    expect(listDeadDestinations(documentWith([action("el-cta", "#")]))).toHaveLength(1);
  });

  it("finds a link that is nothing but whitespace", () => {
    expect(listDeadDestinations(documentWith([action("el-cta", "   ")]))).toHaveLength(1);
  });

  it("is empty for the destinations the questionnaire actually produces", () => {
    const doc = documentWith([
      action("el-cta", "tel:+34600112233"),
      { ...action("el-wa", "https://wa.me/34600112233"), role: "link", slot: "secondaryAction" },
      { ...action("el-mail", "mailto:hola@example.com"), role: "link", slot: "secondaryAction" },
      {
        ...action("el-book", "https://reservas.example.com/x"),
        role: "link",
        slot: "secondaryAction",
      },
    ]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });

  it("ignores a hidden link, which the renderer never puts on the page", () => {
    // Rule 3 keeps a hidden element so the place to fill it in survives; refusing to publish
    // over one would be refusing over something no visitor can press.
    expect(listDeadDestinations(documentWith([action("el-cta", "", true)]))).toEqual([]);
  });

  it("ignores text, images and every other value kind", () => {
    const doc = documentWith([
      {
        id: "el-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "" },
      },
      {
        id: "el-image",
        role: "image",
        hidden: false,
        slot: "image",
        value: { kind: "image", src: "", alt: "" },
      },
    ]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });

  it("looks inside list items too, where a card's own link would live", () => {
    const doc = documentWith([
      {
        id: "el-services",
        role: "list",
        hidden: false,
        slot: "services",
        items: [{ id: "item-1", elements: [action("el-item-1-cta", "#")] }],
      },
    ]);
    expect(listDeadDestinations(doc).map((entry) => entry.elementId)).toEqual(["el-item-1-cta"]);
  });

  it("reports every dead link, not just the first", () => {
    const doc = documentWith([
      action("el-cta", ""),
      { ...action("el-second", "#"), role: "link", slot: "secondaryAction" },
    ]);
    expect(listDeadDestinations(doc)).toHaveLength(2);
  });
});

describe("listDeadDestinations, in-page anchors", () => {
  it("lets through an anchor that names a section of the document", () => {
    const doc = documentWithCover([action("el-cta", "#sec-cover")]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });

  it("finds an anchor that names no section — the case deleting a section creates", () => {
    // The href is neither empty nor "#", so the two original checks waved it through. A browser
    // given an unresolvable fragment does nothing at all, which on a page with no error state is
    // indistinguishable from a broken site.
    const doc = documentWithCover([action("el-cta", "#sec-opiniones")]);
    expect(listDeadDestinations(doc).map((entry) => entry.elementId)).toEqual(["el-cta"]);
  });

  it("finds an anchor to the very section that was holding it", () => {
    const doc = documentWith([action("el-cta", "#sec-contact")]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });

  it("does not try to resolve a link to somewhere else entirely", () => {
    // Not ours to resolve: an external URL with a fragment is the other site's business.
    const doc = documentWithCover([action("el-cta", "https://example.com/#sec-nope")]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });

  it("ignores whitespace around an anchor, as it does around every other href", () => {
    expect(listDeadDestinations(documentWithCover([action("el-cta", "  #sec-cover  ")]))).toEqual(
      [],
    );
  });

  it("still treats a bare # as dead, which names no section at all", () => {
    expect(listDeadDestinations(documentWithCover([action("el-cta", "#")]))).toHaveLength(1);
  });
});

describe("listAnchorsTo", () => {
  it("finds the buttons pointing at a section, before it is deleted", () => {
    const doc = documentWithCover([action("el-cta", "#sec-cover")]);
    const pointing = listAnchorsTo(doc, "sec-cover");
    expect(pointing).toHaveLength(1);
    expect(pointing[0]).toMatchObject({ elementId: "el-cta", text: "Reserva tu cita" });
  });

  it("is empty for a section nothing links to", () => {
    const doc = documentWithCover([action("el-cta", "tel:+34600112233")]);
    expect(listAnchorsTo(doc, "sec-cover")).toEqual([]);
  });

  it("does not count a hidden link, which is not on the page to be broken", () => {
    const doc = documentWithCover([action("el-cta", "#sec-cover", true)]);
    expect(listAnchorsTo(doc, "sec-cover")).toEqual([]);
  });

  it("counts every button pointing there, not just the first", () => {
    const doc = documentWithCover([
      action("el-cta", "#sec-cover"),
      { ...action("el-second", "#sec-cover"), role: "link", slot: "secondaryAction" },
    ]);
    expect(listAnchorsTo(doc, "sec-cover")).toHaveLength(2);
  });
});
