import { blankSection, GALLERY_ID } from "@retorika/catalog";
import { type RetorikaDocument, type Section, type Theme, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";

/**
 * What a gallery looks like once it is drawn — the half of sprint 5 day 3 that the catalog's own
 * tests cannot see.
 *
 * Two claims, and both are about the caption. It is the one place "Fotos de trabajos" departs from
 * every other list in the catalog, so it is the one place a later tidy-up would break something.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function cover(): Section {
  return {
    id: "sec-cover",
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-cover-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Barbería El Corte" },
      },
    ],
  };
}

/** A gallery of `count` photographs, each with the caption it was given. */
function gallery(captions: readonly string[]): Section {
  return {
    id: "sec-gallery",
    preset: { catalogId: GALLERY_ID, variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-ga-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Nuestros trabajos" },
      },
      {
        id: "el-photos",
        role: "list",
        hidden: false,
        slot: "photos",
        items: captions.map((caption, index) => ({
          id: `item-${index + 1}`,
          elements: [
            {
              id: `el-photo-${index + 1}`,
              role: "image" as const,
              hidden: false,
              slot: "photo",
              value: {
                kind: "image" as const,
                src: `assets/foto-${index + 1}.jpg`,
                alt: "Trabajo",
              },
            },
            {
              id: `el-caption-${index + 1}`,
              role: "body" as const,
              hidden: false,
              slot: "caption",
              value: { kind: "text" as const, text: caption },
            },
          ],
        })),
      },
    ],
  };
}

function documentWith(section: Section): RetorikaDocument {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Barbería El Corte",
    theme,
    collections: [],
    pages: [
      { id: "home", slug: "index", title: "Barbería El Corte", sections: [cover(), section] },
    ],
  };
}

function parse(source: string): Document {
  return new DOMParser().parseFromString(source, "text/html");
}

function draw(section: Section): Document {
  return parse(render(documentWith(section), "html").html);
}

describe("a gallery's captions and the page outline", () => {
  it("draws every caption as a paragraph, so eight photographs add nothing to the outline", () => {
    // The reason the caption is a `body` where a service's name and a carta line's dish are
    // `heading`s. A caption heads nothing; marked up as one it would tell a screen reader that a
    // part of the page starts there, once per photograph. Same correction as issue #19 made for
    // the cover's tagline, with more of it.
    const page = draw(gallery(["Corte clásico", "Barba a navaja", "Degradado", "Color"]));
    const outline = [...page.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((el) => el.tagName);
    expect(outline).toEqual(["H1", "H2"]);

    const captions = [...page.querySelectorAll('[data-slot="caption"]')];
    expect(captions).toHaveLength(4);
    for (const caption of captions) expect(caption.tagName).toBe("P");
  });

  it("still draws the list as a list, with one item per photograph", () => {
    const page = draw(gallery(["Uno", "Dos", "Tres"]));
    const list = page.querySelector(".rb-gallery .rb-list");
    expect(list?.getAttribute("role")).toBe("list");
    expect(list?.querySelectorAll("li.rb-item")).toHaveLength(3);
    expect(page.querySelectorAll(".rb-gallery .rb-item img")).toHaveLength(3);
  });

  it("keeps the photograph when its caption is emptied, leaving no trace of the words", () => {
    // What makes the caption genuinely optional on the page while being required in the structure
    // (`gallery.ts`, and the same argument `prices.ts` makes for a price). An owner who does not
    // want captions empties them, and what publishes is a grid of photographs and nothing else.
    const page = draw(gallery(["Corte clásico", "", "Degradado"]));
    expect(page.querySelectorAll(".rb-gallery .rb-item img")).toHaveLength(3);
    expect(page.querySelectorAll('[data-slot="caption"]')).toHaveLength(2);
    // Not an empty <p> holding the gap open, which is what used to publish before sprint 4 day 6.
    expect(page.querySelector('[data-item="item-2"]')?.querySelectorAll("p")).toHaveLength(0);
  });

  it("draws one a blank section made, not only a hand-built fixture", () => {
    // The path the editor actually takes: the "Añadir sección aquí" pill calls `blankSection`.
    const page = draw(blankSection(GALLERY_ID, "stacked", "sec-gallery"));
    const item = page.querySelector(".rb-gallery .rb-item");
    expect(item?.querySelector("img")?.getAttribute("src")).toMatch(/^data:image\/svg\+xml,/);
    expect(item?.querySelector("p")?.textContent).toContain("Escribe aquí");
  });
});

describe("how a photograph is cropped", () => {
  it("declares a ratio for a gallery's photographs and for nothing else", () => {
    // Without it, four photographs of four shapes give four card heights and four caption levels.
    // Scoped to `.rb-gallery` on purpose: a cover's photograph is drawn full width and must keep
    // its own shape, so the rule must not reach `.rb-section img` generally.
    const { css } = render(documentWith(gallery(["Uno"])), "html");
    expect(css).toContain(".rb-gallery .rb-item img { aspect-ratio: 4 / 3; object-fit: cover; }");
    expect(css).toContain(".rb-section img { width: 100%; height: auto;");
  });
});
