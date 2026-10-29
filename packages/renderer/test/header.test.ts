import { teaserSection } from "@retorika/catalog";
import { type RetorikaDocument, type Section, type Theme, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { actionEntry, headerDrawn, headerSettings } from "../src/header.ts";
import { render } from "../src/index.ts";

/**
 * The header is the owner's (ADR 0057): what `header.ts` draws from the document's `header` and the
 * two menus. `menu.test.ts` holds the lists; this file holds the bar — its defaults, its three
 * layouts, the brand, the button, the skip link, and the one rule that keeps a published site from
 * changing face: **a document with no `header` draws what it drew before the object existed.**
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function section(id: string, catalogId: string, title: string): Section {
  return {
    id,
    preset: { catalogId, variantId: catalogId === "cover" ? "image-right" : "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: `el-${id}`,
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: title },
      },
    ],
  };
}

/** A home page of a cover and `n` headed sections, plus the pages given. */
function site(
  n: number,
  pages: { id: string; slug: string; title: string }[] = [],
  header?: RetorikaDocument["header"],
): RetorikaDocument {
  const kinds = ["services", "location", "contact", "prices", "gallery"];
  return {
    schemaVersion: "1.15.0",
    id: "doc-cabecera",
    siteName: "Taberna Santo Domingo",
    theme,
    collections: [],
    ...(header === undefined ? {} : { header }),
    pages: [
      {
        id: "home",
        slug: "index",
        title: "Taberna Santo Domingo",
        sections: [
          section("sec-cover", "cover", "Taberna"),
          ...pages.map((page) =>
            teaserSection(`sec-avance-${page.id}`, `./${page.slug}.html`, "Ver más"),
          ),
          ...kinds.slice(0, n).map((kind) => section(`sec-${kind}`, kind, `Sobre ${kind}`)),
        ],
      },
      ...pages.map((page) => ({
        ...page,
        sections: [section(`sec-${page.slug}`, "prices", page.title)],
      })),
    ],
  };
}

function draw(doc: RetorikaDocument, pageId?: string): Document {
  const html = render(doc, "html", pageId === undefined ? {} : { pageId }).html;
  return new DOMParser().parseFromString(html, "text/html");
}

const texts = (nodes: Iterable<Element>) => [...nodes].map((el) => el.textContent?.trim());

describe("a document with no header draws what it always drew", () => {
  it("draws nothing above <main> for a one-page site under the threshold, and no header CSS", () => {
    const doc = site(2);
    expect(headerDrawn(doc)).toBe(false);
    const page = draw(doc);
    expect(page.querySelector("header")).toBeNull();
    expect(page.querySelector(".rb-skip")).toBeNull();
    expect(page.body.firstElementChild?.tagName).toBe("MAIN");
    expect(render(doc, "html").css).not.toContain(".rb-header");
    expect(render(doc, "html").css).not.toContain(".rb-nav");
  });

  it("draws the two menus, and nothing else, once the threshold is met", () => {
    const doc = site(3);
    const page = draw(doc);
    expect(page.querySelector("header.rb-header")).not.toBeNull();
    expect(page.querySelector(".rb-brand")).toBeNull();
    expect(page.querySelector(".rb-nav-action")).toBeNull();
    expect(texts(page.querySelectorAll(".rb-nav-wide nav[aria-label=Secciones] a"))).toEqual([
      "Servicios",
      "Dónde estamos",
      "Contacto",
    ]);
    const settings = headerSettings(doc);
    expect(settings).toMatchObject({
      pagesShown: true,
      sectionsShown: true,
      sectionsRow: "shared",
      sectionsMobile: "row",
      layout: "brand-left",
      brandName: false,
      hairline: true,
      sticky: false,
      background: "surface",
    });
  });
});

describe("the skip link and the main landmark", () => {
  it("is the first node of the body and points at <main>'s id", () => {
    const page = draw(site(3));
    const first = page.body.firstElementChild;
    expect(first?.className).toBe("rb-skip");
    expect(first?.getAttribute("href")).toBe("#rb-main");
    expect(first?.textContent?.trim()).toBe("Saltar al contenido");
    expect(page.querySelector("main")?.id).toBe("rb-main");
    expect(first?.nextElementSibling?.tagName).toBe("HEADER");
  });

  it("gives <main> its id even where no header is drawn, so the id is a rule and not an exception", () => {
    expect(draw(site(1)).querySelector("main")?.id).toBe("rb-main");
  });

  it("is on screen only when focused: the stylesheet moves it, never hides it from the tree", () => {
    const { css } = render(site(3), "html");
    expect(css).toContain(".rb-skip { position: absolute; left: var(--space-md); top: -100px;");
    expect(css).toContain(".rb-skip:focus-visible { top: var(--space-md); }");
    expect(css).not.toContain(".rb-skip { display: none");
  });
});

describe("the owner's word on each menu", () => {
  it("draws the sections below the threshold when the owner said «siempre»", () => {
    const doc = site(2, [], { sections: { shown: true } });
    expect(headerDrawn(doc)).toBe(true);
    expect(texts(draw(doc).querySelectorAll(".rb-nav-wide a"))).toEqual([
      "Servicios",
      "Dónde estamos",
    ]);
  });

  it("draws no menu above the threshold when the owner said «nunca», and then no header at all", () => {
    const doc = site(4, [], { sections: { shown: false }, pages: { shown: false } });
    expect(headerDrawn(doc)).toBe(false);
    expect(draw(doc).querySelector("header")).toBeNull();
  });

  it("silences one menu and keeps the other", () => {
    const doc = site(3, [{ id: "p2", slug: "carta", title: "La carta" }], {
      pages: { shown: false },
    });
    const page = draw(doc);
    expect(page.querySelector('nav[aria-label="Páginas"]')).toBeNull();
    expect(page.querySelector("details")).toBeNull();
    expect(page.querySelector('.rb-nav-wide nav[aria-label="Secciones"]')).not.toBeNull();
  });

  it("emits no nav for a menu the owner wants but that has nothing to hold", () => {
    // One page, «siempre» for the pages: there is no other page to offer, so no landmark is announced
    // for an empty strip (ADR 0043 §5's first bound, kept).
    const doc = site(3, [], { pages: { shown: true } });
    expect(draw(doc).querySelector('nav[aria-label="Páginas"]')).toBeNull();
  });
});

describe("the brand", () => {
  it("is a span on the home page and a link home everywhere else", () => {
    const doc = site(3, [{ id: "p2", slug: "carta", title: "La carta" }], {
      brand: { name: true },
    });
    const home = draw(doc).querySelector(".rb-brand");
    expect(home?.tagName).toBe("SPAN");
    expect(home?.textContent?.trim()).toBe("Taberna Santo Domingo");
    const away = draw(doc, "p2").querySelector(".rb-brand");
    expect(away?.tagName).toBe("A");
    expect(away?.getAttribute("href")).toBe("./index.html");
  });

  it("derives the logo's alt from the site name, and empties it when the name is written beside it", () => {
    const logo = { src: "assets/logo.png" };
    const alone = draw(site(3, [], { brand: { logo } })).querySelector("img.rb-logo");
    expect(alone?.getAttribute("alt")).toBe("Taberna Santo Domingo");
    expect(alone?.getAttribute("height")).toBe("40");
    const beside = draw(site(3, [], { brand: { logo, name: true } })).querySelector("img.rb-logo");
    expect(beside?.getAttribute("alt")).toBe("");
    // Renaming the business renames the alt, because nothing stored it.
    const renamed = { ...site(3, [], { brand: { logo } }), siteName: "Casa Trufa" };
    expect(draw(renamed).querySelector("img.rb-logo")?.getAttribute("alt")).toBe("Casa Trufa");
  });

  it("draws a header for the brand alone, under the threshold", () => {
    const doc = site(1, [], { brand: { name: true } });
    expect(headerDrawn(doc)).toBe(true);
    const page = draw(doc);
    expect(page.querySelector("header .rb-brand")).not.toBeNull();
    expect(page.querySelector("nav")).toBeNull();
  });

  it("is never a heading, so the page's outline is untouched", () => {
    const page = draw(site(3, [], { brand: { name: true } }));
    expect(page.querySelector("header :is(h1,h2,h3,h4,h5,h6)")).toBeNull();
  });
});

describe("the button", () => {
  const withButton = (header: RetorikaDocument["header"]) =>
    site(3, [{ id: "p2", slug: "carta", title: "La carta" }], header);

  it("takes a section's words and a local anchor on its own page", () => {
    const doc = withButton({ action: { kind: "section", sectionId: "sec-contact" } });
    expect(actionEntry(doc, doc.pages[0] as NonNullable<(typeof doc.pages)[0]>)).toEqual({
      label: "Contacto",
      href: "#sec-contact",
      sectionId: "sec-contact",
    });
    const button = draw(doc).querySelector("a.rb-nav-action");
    expect(button?.getAttribute("href")).toBe("#sec-contact");
    expect(button?.textContent?.trim()).toBe("Contacto");
  });

  it("links into the page that holds its section from every other page", () => {
    const doc = withButton({ action: { kind: "section", sectionId: "sec-contact" } });
    expect(draw(doc, "p2").querySelector("a.rb-nav-action")?.getAttribute("href")).toBe(
      "./index.html#sec-contact",
    );
  });

  it("takes a page's words and its file", () => {
    const doc = withButton({ action: { kind: "page", pageId: "p2" } });
    expect(draw(doc).querySelector("a.rb-nav-action")?.getAttribute("href")).toBe("./carta.html");
    expect(draw(doc).querySelector("a.rb-nav-action")?.textContent?.trim()).toBe("La carta");
  });

  it("prefers the destination's own label", () => {
    const doc = withButton({ action: { kind: "section", sectionId: "sec-contact" } });
    const labelled = {
      ...doc,
      pages: doc.pages.map((page) => ({
        ...page,
        sections: page.sections.map((s) =>
          s.id === "sec-contact" ? { ...s, menuLabel: "Reservar" } : s,
        ),
      })),
    };
    expect(draw(labelled).querySelector("a.rb-nav-action")?.textContent?.trim()).toBe("Reservar");
  });

  it("takes its destination out of the menu: one destination, one place", () => {
    const atSection = withButton({ action: { kind: "section", sectionId: "sec-contact" } });
    expect(
      texts(draw(atSection).querySelectorAll('.rb-nav-wide nav[aria-label="Secciones"] a')),
    ).toEqual(["Servicios", "Dónde estamos"]);
    const atPage = withButton({ action: { kind: "page", pageId: "p2" } });
    expect(draw(atPage).querySelector('nav[aria-label="Páginas"]')).toBeNull();
    expect(draw(atPage).querySelector("details")).toBeNull();
  });

  it("draws a header for the button alone, under the threshold", () => {
    const doc = site(1, [], { action: { kind: "section", sectionId: "sec-services" } });
    expect(headerDrawn(doc)).toBe(true);
    expect(draw(doc).querySelector("header a.rb-nav-action")).not.toBeNull();
  });
});

describe("the three layouts and the sections' row", () => {
  it("writes the layout on the header for the stylesheet to read", () => {
    for (const layout of ["brand-left", "centered", "stacked"] as const) {
      const page = draw(site(3, [], { layout }));
      expect(page.querySelector("header")?.getAttribute("data-layout")).toBe(layout);
    }
    const { css } = render(site(3), "html");
    expect(css).toContain(".rb-header[data-layout=centered] { justify-content: center; }");
    expect(css).toContain(
      ".rb-header[data-layout=stacked] .rb-brand { flex-basis: 100%; justify-content: center; }",
    );
  });

  it("keeps the sections in the bar and gives the phone a row, by default", () => {
    const page = draw(site(3));
    expect(page.querySelector("header")?.getAttribute("data-sections")).toBe("shared");
    expect(page.querySelector('.rb-nav-wide nav[aria-label="Secciones"]')).not.toBeNull();
    expect(page.querySelector("nav.rb-nav-row")?.getAttribute("data-mobile")).toBe("row");
  });

  it("takes the sections out of the bar when they have a row of their own", () => {
    const page = draw(
      site(3, [{ id: "p2", slug: "carta", title: "La carta" }], { sections: { row: "own" } }),
    );
    expect(page.querySelector("header")?.getAttribute("data-sections")).toBe("own");
    expect(page.querySelector('.rb-nav-wide nav[aria-label="Secciones"]')).toBeNull();
    expect(texts(page.querySelectorAll("nav.rb-nav-row a"))).toEqual([
      "Servicios",
      "Dónde estamos",
      "Contacto",
    ]);
  });

  it("draws no row at all when the sections share the bar and the phone hides them", () => {
    const page = draw(site(3, [], { sections: { mobile: "hidden" } }));
    expect(page.querySelector("nav.rb-nav-row")).toBeNull();
    expect(page.querySelector('.rb-nav-wide nav[aria-label="Secciones"]')).not.toBeNull();
  });

  it("marks a row the phone hides, when the row is the owner's at every other width", () => {
    const page = draw(site(3, [], { sections: { row: "own", mobile: "hidden" } }));
    expect(page.querySelector("nav.rb-nav-row")?.getAttribute("data-mobile")).toBe("hidden");
    expect(render(site(3), "html").css).toContain(
      "  .rb-header[data-sections] .rb-nav-row[data-mobile=hidden] { display: none; }",
    );
  });
});

describe("determinism and the two targets", () => {
  it("renders the same bytes twice", () => {
    const doc = site(3, [{ id: "p2", slug: "carta", title: "La carta" }], {
      brand: { name: true },
      action: { kind: "page", pageId: "p2" },
      layout: "stacked",
      sections: { row: "own" },
    });
    expect(render(doc, "html").html).toBe(render(doc, "html").html);
  });

  it("puts the same header in the dom target", () => {
    const doc = site(3, [], { brand: { name: true } });
    const fragment = render(doc, "dom");
    expect(fragment.firstElementChild?.className).toBe("rb-skip");
    expect(fragment.querySelector("header .rb-brand-name")?.textContent).toBe(
      "Taberna Santo Domingo",
    );
    expect(fragment.querySelector("main")?.id).toBe("rb-main");
  });
});
