import { describe, expect, it } from "vitest";
import { listAnchorsTo, listDeadDestinations, listLinksTo } from "../src/destinations.ts";
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

/**
 * Two pages, so that "the same page" is a question with two possible answers. Every test above
 * this point runs on a single-page document, where "on this page" and "in this document" cannot be
 * told apart — which is exactly why both of the defects below survived four sprints.
 */
function twoPageDocument(
  homeContent: ContentElement[],
  awayContent: ContentElement[] = [],
): RetorikaDocument {
  const section = (id: string, content: ContentElement[]): Section => ({
    id,
    preset: { catalogId: "prices", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content,
  });
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Taberna Santo Domingo",
    theme,
    collections: [],
    pages: [
      { id: "home", slug: "index", title: "Inicio", sections: [section("sec-home", homeContent)] },
      {
        id: "p2",
        slug: "nuestra-carta",
        title: "Nuestra carta",
        sections: [section("sec-carta", awayContent)],
      },
    ],
  };
}

describe("listDeadDestinations, an anchor is only alive on its own page", () => {
  it("kills an anchor naming a section that lives on another page", () => {
    // The defect this sprint creates by the dozen: convert «Nuestra carta» into a page and every
    // button that said `#sec-carta` on the home page now does nothing at all. It passed before
    // because the check asked whether the section existed *anywhere* in the document — the same
    // question while there is one page, and the wrong one the moment there are two.
    const doc = twoPageDocument([action("el-cta", "#sec-carta")]);
    expect(listDeadDestinations(doc).map((entry) => entry.elementId)).toEqual(["el-cta"]);
  });

  it("keeps an anchor naming a section on the page it is written on", () => {
    const doc = twoPageDocument([action("el-cta", "#sec-home")]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });

  it("judges each page by its own sections, not by the first page's", () => {
    const doc = twoPageDocument([], [action("el-cta", "#sec-carta")]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });
});

describe("listDeadDestinations, a link to another page", () => {
  it("lets through a link to a page that exists", () => {
    const doc = twoPageDocument([action("el-cta", "./nuestra-carta.html")]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });

  it("kills a link to a page that does not — what deleting a teaser's page leaves behind", () => {
    // Before today this returned `false` for anything not starting with `#`, so a link to a page
    // that was never created, or was deleted afterwards, went straight past the download gate and
    // into somebody's ZIP.
    const doc = twoPageDocument([action("el-cta", "./precios.html")]);
    expect(listDeadDestinations(doc).map((entry) => entry.elementId)).toEqual(["el-cta"]);
  });

  it("lets through a link into a section of that page", () => {
    const doc = twoPageDocument([action("el-cta", "./nuestra-carta.html#sec-carta")]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });

  it("kills a link to a real page naming a section that is not on it", () => {
    // Judged twice over: the page has to exist and the section has to be on *that* page.
    const doc = twoPageDocument([action("el-cta", "./nuestra-carta.html#sec-home")]);
    expect(listDeadDestinations(doc).map((entry) => entry.elementId)).toEqual(["el-cta"]);
  });

  it("kills a link to a real page with an empty fragment, which names no section", () => {
    const doc = twoPageDocument([action("el-cta", "./nuestra-carta.html#")]);
    expect(listDeadDestinations(doc)).toHaveLength(1);
  });

  it("kills a page link whose slug could never be a page, rather than searching for it", () => {
    const doc = twoPageDocument([action("el-cta", "./../fuera.html")]);
    expect(listDeadDestinations(doc)).toHaveLength(1);
  });

  it("still leaves an external address alone, fragment and all", () => {
    const doc = twoPageDocument([action("el-cta", "https://example.com/carta.html#nope")]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });

  it("leaves a bare relative path alone, which nothing in this repository emits", () => {
    // Named rather than handled: refusing a shape no generator, catalog or editor produces would
    // block a download over something that has never existed. If one ever does, it belongs here.
    const doc = twoPageDocument([action("el-cta", "nuestra-carta.html")]);
    expect(listDeadDestinations(doc)).toEqual([]);
  });
});

describe("listLinksTo", () => {
  it("counts what points at a page, before the page is deleted", () => {
    const doc = twoPageDocument([action("el-cta", "./nuestra-carta.html")]);
    const pointing = listLinksTo(doc, "p2");
    expect(pointing).toHaveLength(1);
    expect(pointing[0]).toMatchObject({ elementId: "el-cta", sectionId: "sec-home" });
  });

  it("counts a link into a section of that page too, which dies with it just the same", () => {
    const doc = twoPageDocument([action("el-cta", "./nuestra-carta.html#sec-carta")]);
    expect(listLinksTo(doc, "p2")).toHaveLength(1);
  });

  it("is empty for a page nothing points at", () => {
    const doc = twoPageDocument([action("el-cta", "tel:+34600112233")]);
    expect(listLinksTo(doc, "p2")).toEqual([]);
  });

  it("does not count a link to a different page that happens to share a prefix", () => {
    const doc = twoPageDocument([action("el-cta", "./nuestra-carta-2.html")]);
    expect(listLinksTo(doc, "p2")).toEqual([]);
  });

  it("does not count a hidden link, which never reaches the published page", () => {
    const doc = twoPageDocument([action("el-cta", "./nuestra-carta.html", true)]);
    expect(listLinksTo(doc, "p2")).toEqual([]);
  });

  it("throws for a page the document does not have, rather than answering zero", () => {
    // Zero would read as "nothing points there", when the truth is that nobody knows what page
    // this is — the same distinction `deleteSection` refuses to blur.
    expect(() => listLinksTo(twoPageDocument([]), "no-such-page")).toThrow(/no page/);
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
