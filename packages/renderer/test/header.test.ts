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

  it("gives the logo its kept size as width and height, and only its height when it has none", () => {
    // Sprint 30 día 7: with both attributes the browser has the logo's ratio before its bytes, so
    // the name beside it is laid out where it stays (`.rb-logo` still draws it 40px tall).
    const sized = { src: "assets/logo.png", width: 512, height: 205 };
    const img = draw(site(3, [], { brand: { logo: sized, name: true } })).querySelector(
      "img.rb-logo",
    );
    expect(img?.getAttribute("width")).toBe("512");
    expect(img?.getAttribute("height")).toBe("205");
    // A logo kept before the size was stored publishes as día 5 did.
    const unsized = { src: "assets/logo.png" };
    const old = draw(site(3, [], { brand: { logo: unsized, name: true } })).querySelector(
      "img.rb-logo",
    );
    expect(old?.hasAttribute("width")).toBe(false);
    expect(old?.getAttribute("height")).toBe("40");
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

/**
 * **The look** (sprint 30 día 2): each option a data attribute the stylesheet reads, each value a
 * token, and the pairs the schemes write proved in `packages/tokens/test/contrast.test.ts`.
 */
describe("the look, as attributes and rules", () => {
  const header = (doc: RetorikaDocument) => draw(doc).querySelector("header");
  const css = (doc: RetorikaDocument) => render(doc, "html").css;

  it("writes the defaults: surface, links at the far side of a left brand, medium gap, body size", () => {
    const h = header(site(3));
    expect(h?.getAttribute("data-bg")).toBe("surface");
    expect(h?.getAttribute("data-align")).toBe("end");
    expect(h?.getAttribute("data-gap")).toBe("md");
    expect(h?.getAttribute("data-size")).toBe("body");
    for (const absent of ["data-uppercase", "data-hover", "data-sticky", "data-hairline"]) {
      expect(h?.hasAttribute(absent), absent).toBe(false);
    }
    // A centred or stacked bar centres its links unless told otherwise.
    expect(header(site(3, [], { layout: "centered" }))?.getAttribute("data-align")).toBe("center");
    expect(
      header(site(3, [], { layout: "stacked", look: { align: "end" } }))?.getAttribute(
        "data-align",
      ),
    ).toBe("end");
  });

  it("writes every option the owner chose", () => {
    const h = header(
      site(3, [], {
        sticky: true,
        hairline: false,
        look: {
          background: "ink",
          align: "start",
          gap: "lg",
          uppercase: true,
          hoverUnderline: true,
          size: "small",
        },
      }),
    );
    expect(h?.getAttribute("data-bg")).toBe("ink");
    expect(h?.getAttribute("data-align")).toBe("start");
    expect(h?.getAttribute("data-gap")).toBe("lg");
    expect(h?.getAttribute("data-size")).toBe("small");
    expect(h?.getAttribute("data-hairline")).toBe("none");
    for (const present of ["data-uppercase", "data-hover", "data-sticky"]) {
      expect(h?.hasAttribute(present), present).toBe(true);
    }
  });

  it("writes the coloured schemes in surface, with the button inverted", () => {
    const sheet = css(site(3));
    for (const bg of ["primary", "secondary", "ink"]) {
      expect(sheet).toContain(
        `.rb-header[data-bg=${bg}] { background: var(--color-${bg}); border-bottom: 0; }`,
      );
    }
    expect(sheet).toContain(
      ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink])\n  :is(.rb-brand, .rb-nav a, .rb-nav-narrow > summary) { color: var(--color-surface); }",
    );
    expect(sheet).toContain(
      ".rb-header:is([data-bg=primary], [data-bg=secondary], [data-bg=ink]) .rb-nav-action {\n  background: var(--color-surface); color: var(--color-primary); }",
    );
    // Never `ink` on `secondary`: measured 1.23 in dark-slate and refused.
    expect(sheet).not.toMatch(/data-bg=secondary\][^\n]*color: var\(--color-ink\)/);
  });

  it("lays a transparent bar over the cover and opens room under it (adjustment 1a)", () => {
    const sheet = css(site(3));
    expect(sheet).toContain(
      ".rb-header[data-bg=transparent] { position: absolute; left: 0; right: 0; top: 0; z-index: 2;",
    );
    expect(sheet).toContain(
      ".rb-header[data-bg=transparent] + main > .rb-section:first-child {\n  padding-top: calc(var(--space-xl) + var(--rb-header-h)); }",
    );
    expect(sheet).toContain(
      "html { --rb-header-h: calc(2 * var(--space-md) + max(40px, 1.5 * var(--size-body))); }",
    );
  });

  it("fixes the bar with sticky, and every section makes room for it when an anchor lands", () => {
    const sheet = css(site(3));
    expect(sheet).toContain(".rb-header[data-sticky] { position: sticky; top: 0; z-index: 2; }");
    expect(sheet).toContain(
      ".rb-header[data-sticky] ~ main [data-section] { scroll-margin-top: var(--rb-header-h); }",
    );
    expect(sheet).toContain(
      ".rb-header[data-sticky][data-scrolled] { box-shadow: 0 1px 0 var(--color-muted),",
    );
  });

  it("never fixes a transparent bar without the script's mark, and turns it to surface once scrolled (adjustment 1b)", () => {
    const sheet = css(site(3));
    expect(sheet).toContain(".rb-header[data-sticky][data-bg=transparent] { position: absolute; }");
    expect(sheet).toContain(
      "html[data-rb-js] .rb-header[data-sticky][data-bg=transparent] { position: fixed; }",
    );
    expect(sheet).toContain(
      ".rb-header[data-sticky][data-bg=transparent][data-scrolled] { background: var(--color-surface);\n  border-bottom: 1px solid var(--color-muted); }",
    );
  });

  it("scrolls smoothly only for somebody who has not asked for less motion", () => {
    const sheet = css(site(3));
    expect(sheet).toContain(
      "@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }",
    );
    expect(sheet.match(/scroll-behavior/g)).toHaveLength(1);
  });

  it("lets a fixed bar go on a phone that shows the sections' row, and says so on the header", () => {
    const withRow = header(site(3, [], { sticky: true }));
    expect(withRow?.hasAttribute("data-phone-row")).toBe(true);
    const hidden = header(site(3, [], { sticky: true, sections: { mobile: "hidden" } }));
    expect(hidden?.hasAttribute("data-phone-row")).toBe(false);
    expect(css(site(3))).toContain(
      "  .rb-header[data-sticky][data-phone-row] { position: static; }",
    );
  });

  it("marks each part, so a rule of the owner's own can reach it", () => {
    const page = draw(
      site(3, [{ id: "p2", slug: "carta", title: "La carta" }], {
        brand: { name: true },
        action: { kind: "section", sectionId: "sec-contact" },
      }),
    );
    expect(page.querySelector(".rb-brand")?.getAttribute("data-part")).toBe("brand");
    expect(page.querySelector(".rb-nav-action")?.getAttribute("data-part")).toBe("action");
    expect(page.querySelector('nav[aria-label="Páginas"]')?.getAttribute("data-part")).toBe(
      "pagesLinks",
    );
    expect(page.querySelector('nav[aria-label="Secciones"]')?.getAttribute("data-part")).toBe(
      "sectionsLinks",
    );
  });
});

describe("rule 6 on the header's parts", () => {
  it("emits a reference as var() and an exact value literally, part by part, after every scheme rule", () => {
    const doc = site(3, [], {
      brand: { name: true },
      style: {
        bar: { color: { exact: "#123456", exception: true }, padding: { ref: "space.lg" } },
        pagesLinks: { color: { ref: "color.ink" } },
        sectionsLinks: { fontSize: { exact: "14px", exception: true } },
        brand: { fontFamily: { ref: "font.body" } },
      },
    });
    const { css } = render(doc, "html");
    expect(css).toContain("/* rule 6: the header's own style */");
    // The bar reads `color` as its background.
    expect(css).toContain(
      ".rb-header[data-layout][data-bg] { background: #123456; padding: var(--space-lg); }",
    );
    expect(css).toContain(
      ".rb-header[data-layout] [data-part=brand] { font-family: var(--font-body); }",
    );
    expect(css).toContain(
      ".rb-header[data-layout] [data-part=pagesLinks] a[href] { color: var(--color-ink); }",
    );
    expect(css).toContain(
      ".rb-header[data-layout] [data-part=sectionsLinks] a[href] { font-size: 14px; }",
    );
    expect(css.indexOf("/* rule 6: the header's own style */")).toBeGreaterThan(
      css.indexOf("[data-bg=ink] { background"),
    );
    // Parts in HEADER_PARTS order: bar, brand, pagesLinks, sectionsLinks.
    const at = (part: string) =>
      css.indexOf(`[data-part=${part}]`, css.indexOf("/* rule 6: the header's"));
    expect(at("brand")).toBeLessThan(at("pagesLinks"));
    expect(at("pagesLinks")).toBeLessThan(at("sectionsLinks"));
  });

  it("emits nothing for a header with no style, and the same bytes twice", () => {
    expect(render(site(3), "html").css).not.toContain("the header's own style");
    const doc = site(3, [], { style: { action: { borderRadius: { ref: "radius.lg" } } } });
    expect(render(doc, "html").css).toBe(render(doc, "html").css);
  });
});
