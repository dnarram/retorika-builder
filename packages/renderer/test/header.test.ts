import { teaserSection } from "@retorika/catalog";
import { type RetorikaDocument, type Section, type Theme, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  actionEntry,
  headerDrawn,
  headerPlaces,
  headerSettings,
  RAIL_FOLD_WIDTH,
  RAIL_WIDTH,
  TWO_RAILS_FOLD_WIDTH,
} from "../src/header.ts";
import { buildCss, GLASS_BACKGROUNDS, GLASS_MIX, render } from "../src/index.ts";

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
      pagesPosition: "bar",
      sectionsPosition: "bar",
      sectionsMobile: "row",
      brandWithPages: false,
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
    expect(page.querySelector("header")?.getAttribute("data-sections")).toBe("bar");
    expect(page.querySelector("header")?.getAttribute("data-pages")).toBe("bar");
    expect(page.querySelector('.rb-nav-wide nav[aria-label="Secciones"]')).not.toBeNull();
    expect(page.querySelector("nav.rb-nav-row")?.getAttribute("data-mobile")).toBe("row");
  });

  it("takes the sections out of the bar when they have a row of their own", () => {
    const page = draw(
      site(3, [{ id: "p2", slug: "carta", title: "La carta" }], {
        sections: { position: "row" },
      }),
    );
    expect(page.querySelector("header")?.getAttribute("data-sections")).toBe("row");
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
    const page = draw(site(3, [], { sections: { position: "row", mobile: "hidden" } }));
    expect(page.querySelector("nav.rb-nav-row")?.getAttribute("data-mobile")).toBe("hidden");
    // And a row that stands at every width still carries the phone's choice of «Ir a…», where the
    // row would have been announced beside the disclosure (sprint 32 día 1, found at 320).
    expect(render(site(3), "html").css).toContain(
      "  .rb-header[data-sections] .rb-nav-row:is([data-mobile=hidden], [data-mobile=fold]) { display: none; }",
    );
  });
});

describe("determinism and the two targets", () => {
  it("renders the same bytes twice", () => {
    const doc = site(3, [{ id: "p2", slug: "carta", title: "La carta" }], {
      brand: { name: true },
      action: { kind: "page", pageId: "p2" },
      layout: "stacked",
      sections: { position: "row" },
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
    // **The cover reads the estimate, never the measure** (David's adjustment 7 of sprint 32): the
    // measure drops when a fixed bar condenses, and room that followed it would pull the headline up.
    expect(sheet).toContain(
      ".rb-header[data-bg=transparent] + main > .rb-section:first-child {\n  padding-top: calc(var(--space-xl) + var(--rb-bar-h)); }",
    );
    expect(sheet).not.toContain(
      "first-child {\n  padding-top: calc(var(--space-xl) + var(--rb-header-h))",
    );
    expect(sheet).toContain(
      "html { --rb-bar-h: calc(2 * var(--space-md) + max(40px, 1.5 * var(--size-body)));\n  --rb-header-h: var(--rb-bar-h); }",
    );
    expect(sheet).toContain(
      "  html { --rb-bar-h: calc(2 * var(--space-sm) + max(40px, 1.5 * var(--size-body))); }",
    );
  });

  it("fixes the bar with sticky, and every section makes room for it when an anchor lands", () => {
    const sheet = css(site(3));
    expect(sheet).toContain(".rb-header[data-sticky] { position: sticky; top: 0; z-index: 2; }");
    expect(sheet).toContain(
      ".rb-header[data-sticky] ~ main [data-section] { scroll-margin-top: var(--rb-header-h); }",
    );
    expect(sheet).toContain(
      ".rb-header[data-sticky][data-scrolled] { box-shadow: 0 1px 0 color-mix(in srgb, var(--color-ink) 10%, transparent),",
    );
  });

  it("condenses a fixed bar once scrolled without changing its outer box (sprint 32, adjustment 1)", () => {
    // The padding it gives up goes to the margin under it, so the page does not move 16 px on the
    // first scroll; only above the phone, whose bar already has the small padding.
    const sheet = css(site(3));
    expect(sheet).toContain(
      "@media (min-width: 721px) {\n  .rb-header[data-sticky][data-scrolled] { padding-block: var(--space-sm);\n    margin-bottom: calc(2 * (var(--space-md) - var(--space-sm))); }\n}",
    );
  });

  it("turns a scrolled fixed bar to glass on surface, transparent and ink, and on no coloured scheme (ADR 0063)", () => {
    const sheet = css(site(3));
    const pct = `${Math.round(GLASS_MIX * 100)}%`;
    expect(pct).toBe("88%");
    const glass = sheet.slice(sheet.indexOf("@supports (backdrop-filter: blur(1px))"));
    expect(glass).toContain(
      `  .rb-header[data-sticky][data-scrolled]:is([data-bg=surface], [data-bg=transparent]) {\n    background: color-mix(in srgb, var(--color-surface) ${pct}, transparent);`,
    );
    expect(glass).toContain(
      `  .rb-header[data-sticky][data-scrolled][data-bg=ink] {\n    background: color-mix(in srgb, var(--color-ink) ${pct}, transparent);`,
    );
    for (const bg of ["primary", "secondary"]) {
      expect(sheet).not.toMatch(new RegExp(`color-mix\\(in srgb, var\\(--color-${bg}\\) ${pct}`));
    }
    // Every blur is inside the `@supports`, and the glass comes after the transparent bar's own
    // scrolled rule, which it has to win over at equal weight.
    expect(sheet.match(/backdrop-filter: blur\(12px\)/g)).toHaveLength(4);
    expect(sheet.indexOf("@supports (backdrop-filter")).toBeGreaterThan(
      sheet.indexOf(".rb-header[data-sticky][data-bg=transparent][data-scrolled] {"),
    );
    expect(Object.keys(GLASS_BACKGROUNDS)).toEqual(["surface", "ink"]);
  });

  it("writes the primary on no word of a surface bar: entries and brand in ink, the primary under them (ADR 0063)", () => {
    const sheet = css(site(3));
    expect(sheet).toContain(
      ".rb-nav a { color: var(--color-ink); font-family: var(--font-body); font-size: var(--size-body);",
    );
    expect(sheet).toContain(
      "  max-width: 100%; color: var(--color-ink); font-family: var(--font-heading);",
    );
    expect(sheet).toContain(".rb-nav-narrow > summary { color: var(--color-ink);");
    expect(sheet).toContain(
      ".rb-nav a[aria-current] { text-decoration-color: var(--color-primary); }",
    );
    expect(sheet).not.toMatch(/\.rb-nav a \{ color: var\(--color-primary\)/);
    // The ruled line between the two menus went with the look.
    expect(sheet).not.toContain(".rb-nav + .rb-nav { padding-left");
    // One hairline everywhere, a tenth of the ink.
    expect(sheet).toContain(
      "  background: var(--color-surface); border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 10%, transparent); line-height: 1.3; }",
    );
    expect(sheet).not.toContain("border-bottom: 1px solid var(--color-muted)");
  });

  it("slides one indicator per strip with anchor positioning, inside @supports, and never in a rail or a disclosure", () => {
    const sheet = css(site(3));
    const at = sheet.indexOf("@supports (anchor-name: --rb-x) {");
    expect(at).toBeGreaterThan(0);
    const block = sheet.slice(at, sheet.indexOf("\n}\n", at));
    expect(block).toContain(
      ":is(.rb-nav-wide, .rb-header) > .rb-nav[data-part=pagesLinks] a[aria-current] { anchor-name: --rb-current-pages; }",
    );
    expect(block).toContain(
      ":is(.rb-nav-wide, .rb-header) > .rb-nav[data-part=sectionsLinks] a[aria-current] { anchor-name: --rb-current-sections; }",
    );
    // **Not a word of it for the canvas** (sprint 32 día 1, bisected over eight runs): the presence
    // of an anchor function in the frame's sheet, matched or not, broke Chromium's scroll anchoring
    // in the editor, and the section being edited moved 29 px when a panel closed.
    const canvas = buildCss(site(3), "dom");
    expect(canvas).not.toMatch(
      /anchor-name|position-anchor|anchor\(|anchor-size\(|@supports \(anchor/,
    );
    // And the two sheets differ in that block and in the page's motion alone (`motion.test.ts`).
    expect(block).toContain("left: anchor(left); width: anchor-size(width);");
    expect(block).toContain(":not(:has(a[aria-current]))::after { display: none; }");
    // Every anchor word of the sheet is inside that one block.
    const outside = sheet.slice(0, at) + sheet.slice(at + block.length);
    expect(outside).not.toMatch(/anchor-name|position-anchor|anchor\(|anchor-size\(/);
    // The button is a pill, in the heading letter, that lifts only under a pointer that can hover.
    expect(sheet).toContain("font-size: var(--size-body); font-weight: 700; border-radius: 999px;");
    expect(sheet).toContain(
      "@media (hover: hover) {\n  .rb-nav-action:hover { transform: translateY(-1px); box-shadow: 0 8px 24px -16px var(--color-ink); }\n}",
    );
  });

  it("never fixes a transparent bar without the script's mark, and turns it to surface once scrolled (adjustment 1b)", () => {
    const sheet = css(site(3));
    expect(sheet).toContain(".rb-header[data-sticky][data-bg=transparent] { position: absolute; }");
    expect(sheet).toContain(
      "html[data-rb-js] .rb-header[data-sticky][data-bg=transparent] { position: fixed; }",
    );
    expect(sheet).toContain(
      ".rb-header[data-sticky][data-bg=transparent][data-scrolled] { background: var(--color-surface);\n  border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 10%, transparent); }",
    );
  });

  it("scrolls smoothly only for somebody who has not asked for less motion", () => {
    const sheet = css(site(3));
    expect(sheet).toContain(
      "@media (prefers-reduced-motion: no-preference) {\n  html { scroll-behavior: smooth; }",
    );
    expect(sheet.match(/scroll-behavior/g)).toHaveLength(1);
  });

  it("keeps the rule under every entry, in no colour, so the current one can fade in (sprint 31 día 3)", () => {
    const sheet = css(site(3));
    expect(sheet).toContain(
      "  padding: var(--space-xs) 0; text-decoration: underline transparent; text-underline-offset: 6px;\n  text-decoration-thickness: 2px; }",
    );
    // The current entry's rule and the hover rule give the colour back — half of it on hover.
    expect(sheet).toContain(
      ".rb-nav a[aria-current] { text-decoration-color: var(--color-primary); }",
    );
    expect(sheet).toContain(
      ".rb-header[data-hover] .rb-nav a:hover, .rb-header[data-hover] .rb-nav a:focus-visible {\n  text-decoration-color: color-mix(in srgb, var(--color-primary) 50%, transparent); }",
    );
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

/**
 * **Each menu has its place** (ADR 0060, sprint 31 día 2). A menu placed `left` or `right` gets a copy
 * in a rail; the bar keeps every copy it had, because the bar is where a rail falls on a narrower
 * screen; which copy is seen is the stylesheet's `display: none`, measured in a real browser since día 3
 * (`a11y.browser.test.ts`, «each menu is announced once, from wherever it stands»).
 * What is pinned here is the markup and the rules: where each menu's copies land, when the brand
 * goes with the pages, when the bar has nothing left, and that a site without a rail carries none of
 * it.
 */
describe("each menu has its place (ADR 0060)", () => {
  const PAGES = [{ id: "p2", slug: "carta", title: "La carta" }];
  const placed = (header: RetorikaDocument["header"]) => site(3, PAGES, header);
  const railOf = (page: Document, side: string) =>
    page.querySelector(`header > .rb-rail[data-side="${side}"]`);
  const labelsIn = (root: Element | null) =>
    [...(root?.querySelectorAll(":scope > nav") ?? [])].map((nav) =>
      nav.getAttribute("aria-label"),
    );

  it("puts each menu's copy where its place says, for every pair of places", () => {
    for (const pages of ["bar", "left", "right"] as const) {
      for (const sections of ["bar", "row", "left", "right", "fold"] as const) {
        const where = `pages ${pages}, sections ${sections}`;
        const page = draw(placed({ pages: { position: pages }, sections: { position: sections } }));
        const header = page.querySelector("header");
        expect(header?.getAttribute("data-pages"), where).toBe(pages);
        expect(header?.getAttribute("data-sections"), where).toBe(sections);
        // The bar always keeps the pages, and the sections unless their place is a row of their own
        // or the disclosure — places of their own at every wide width.
        expect(labelsIn(page.querySelector(".rb-nav-wide")), where).toEqual(
          sections === "row" || sections === "fold" ? ["Páginas"] : ["Páginas", "Secciones"],
        );
        expect(page.querySelector("nav.rb-nav-row") !== null, where).toBe(true);
        expect(labelsIn(page.querySelector("header > details.rb-nav-fold")), where).toEqual(
          sections === "fold" ? ["Secciones"] : [],
        );
        // A rail per side that holds something, pages before sections when they share one.
        const sides = (["left", "right"] as const).filter(
          (side) => pages === side || sections === side,
        );
        expect(header?.getAttribute("data-rails") ?? null, where).toBe(
          sides.length === 0 ? null : sides.join(" "),
        );
        for (const side of ["left", "right"] as const) {
          const expected = [
            ...(pages === side ? ["Páginas"] : []),
            ...(sections === side ? ["Secciones"] : []),
          ];
          if (expected.length === 0) expect(railOf(page, side), where).toBeNull();
          else expect(labelsIn(railOf(page, side)), `${where}, ${side}`).toEqual(expected);
        }
      }
    }
  });

  it("keeps the rails inside the header, so the header is still the sibling `~ main` reads", () => {
    const page = draw(placed({ pages: { position: "left" }, sections: { position: "right" } }));
    expect(page.querySelectorAll("header > .rb-rail")).toHaveLength(2);
    expect(page.querySelector("header ~ main#rb-main")).not.toBeNull();
    // One banner holds the whole of the site's navigation.
    expect(page.querySelectorAll("header")).toHaveLength(1);
    expect(page.querySelectorAll("body > nav, main nav")).toHaveLength(0);
  });

  it("sends the brand and the button to the pages' rail, and keeps the bar's copies to fall back on", () => {
    const page = draw(
      placed({
        pages: { position: "left" },
        brandWithPages: true,
        brand: { name: true },
        // A section and not the one page: a page in the button leaves the pages menu (one
        // destination, one place), and an empty pages menu has no rail to take the brand to.
        action: { kind: "section", sectionId: "sec-contact" },
      }),
    );
    const header = page.querySelector("header");
    expect(header?.getAttribute("data-brand")).toBe("pages");
    const rail = railOf(page, "left");
    expect([...(rail?.children ?? [])].map((child) => child.className)).toEqual([
      "rb-brand",
      "rb-nav",
      "rb-nav-action",
    ]);
    expect(header?.querySelector(":scope > .rb-brand")).not.toBeNull();
    expect(header?.querySelector(":scope > .rb-nav-action")).not.toBeNull();
  });

  it("leaves the brand in the bar where the pages are not drawn in a rail", () => {
    for (const header of [
      { pages: { position: "bar" as const }, brandWithPages: true, brand: { name: true } },
      {
        pages: { position: "left" as const, shown: false },
        brandWithPages: true,
        brand: { name: true },
      },
    ]) {
      const page = draw(placed(header));
      expect(page.querySelector("header")?.hasAttribute("data-brand")).toBe(false);
      expect(page.querySelector(".rb-rail .rb-brand")).toBeNull();
    }
  });

  it("collapses the bar only when everything it would draw stands in a rail", () => {
    const bar = (header: RetorikaDocument["header"]) =>
      draw(placed(header)).querySelector("header")?.getAttribute("data-bar") ?? null;
    const everything = {
      pages: { position: "left" as const },
      sections: { position: "right" as const },
      brandWithPages: true,
      brand: { name: true },
    };
    expect(bar(everything)).toBe("none");
    // The sections in the bar, in a row, or the brand left behind: the bar still has words.
    expect(bar({ ...everything, sections: { position: "bar" } })).toBeNull();
    expect(bar({ ...everything, sections: { position: "row" } })).toBeNull();
    expect(bar({ ...everything, brandWithPages: false })).toBeNull();
    // And with nothing in a rail there is no collapsing at all.
    expect(bar({ brand: { name: true } })).toBeNull();
  });

  it("writes the rail's stylesheet only for a site that has one, from the widths that hold it", () => {
    const without = render(site(3), "html").css;
    expect(without).not.toContain(".rb-rail");
    expect(without).not.toContain("data-rails");
    const { css } = render(
      placed({ pages: { position: "left" }, sections: { position: "right" } }),
      "html",
    );
    expect(css).toContain(
      ".rb-rail { display: none; position: fixed; top: 0; bottom: 0; z-index: 2;",
    );
    expect(css).toContain(`width: ${RAIL_WIDTH}px;`);
    // Scrolls down when its entries outgrow the window, never across: a sideways scroller would
    // exempt every entry from the overflow walk.
    expect(css).toContain("overflow: hidden auto;");
    expect(css).toContain(
      `@media (min-width: ${RAIL_FOLD_WIDTH}px) {\n  .rb-rail { display: flex; }`,
    );
    expect(css).toContain(
      `  .rb-header[data-rails~=left], .rb-header[data-rails~=left] ~ main { margin-left: ${RAIL_WIDTH}px;\n    --rb-rail-l: ${RAIL_WIDTH}px; }`,
    );
    expect(css).toContain(
      `@media (min-width: ${RAIL_FOLD_WIDTH}px) and (max-width: ${TWO_RAILS_FOLD_WIDTH - 1}px) {`,
    );
    expect(css).toContain(`@media (min-width: ${TWO_RAILS_FOLD_WIDTH}px) {`);
    // The pages' copy hidden in the bar, the sections that follow it draw no line beside nothing.
    expect(css).toContain(
      "  .rb-header[data-pages=right] .rb-nav-wide > .rb-nav + .rb-nav { padding-left: 0; border-left: 0; }",
    );
    // A collapsed bar leaves no room for itself in an anchor's landing.
    expect(css).toContain(
      '  .rb-header[data-layout][data-bar=none]:not([data-rails="left right"])[data-sticky] ~ main [data-section] { scroll-margin-top: 0; }',
    );
    expect(RAIL_FOLD_WIDTH - RAIL_WIDTH).toBeGreaterThanOrEqual(768);
    expect(TWO_RAILS_FOLD_WIDTH - 2 * RAIL_WIDTH).toBeGreaterThanOrEqual(768);
  });

  it("tells the editor where the menus stand from the header it draws (sprint 31 día 5)", () => {
    for (const pages of ["bar", "left", "right"] as const) {
      for (const sections of ["bar", "row", "left", "right", "fold"] as const) {
        for (const brandWithPages of [false, true]) {
          const doc = placed({
            pages: { position: pages },
            sections: { position: sections },
            brandWithPages,
            brand: { name: true },
          });
          const home = doc.pages[0];
          if (!home) throw new Error("no home page");
          const header = draw(doc).querySelector("header");
          const where = `${pages}/${sections}/${brandWithPages}`;
          const answer = headerPlaces(doc, home);
          expect(answer.rails.join(" "), where).toBe(header?.getAttribute("data-rails") ?? "");
          expect(answer.barEmpty, where).toBe(header?.getAttribute("data-bar") === "none");
        }
      }
    }
  });

  it("renders the same bytes twice for every pair of places", () => {
    for (const pages of ["bar", "left", "right"] as const) {
      for (const sections of ["bar", "row", "left", "right", "fold"] as const) {
        const doc = placed({
          pages: { position: pages },
          sections: { position: sections },
          brandWithPages: true,
          brand: { name: true },
        });
        const first = render(doc, "html");
        const second = render(doc, "html");
        expect(second.html, `${pages}/${sections}`).toBe(first.html);
        expect(second.css, `${pages}/${sections}`).toBe(first.css);
      }
    }
  });
});

/**
 * **«Ir a…»** (ADR 0060, sprint 31 día 3): the sections behind one `<summary>`, fixed under the bar on
 * a wide screen and a word beside «Menú» on a phone. One element for both places; which one shows is
 * the stylesheet's, read in a real browser by `header.browser.test.ts`. What is pinned here is the
 * markup, the one sum its distance from the top is, and that no site without it carries a byte of it.
 */
describe("«Ir a…», the sections' disclosure", () => {
  const PAGES = [{ id: "p2", slug: "carta", title: "La carta" }];
  const fold = (page: Document) => page.querySelector("header > details.rb-nav-fold");

  it("holds this page's sections behind «Ir a…», after the button and before «Menú»", () => {
    const page = draw(
      site(3, PAGES, {
        sections: { position: "fold" },
        // A section, so the pages menu keeps its one page and «Menú» is drawn; the button's own
        // section leaves the disclosure, as it leaves every menu (one destination, one place).
        action: { kind: "section", sectionId: "sec-contact" },
      }),
    );
    const disclosure = fold(page);
    expect(disclosure?.querySelector(":scope > summary")?.textContent?.trim()).toBe("Ir a…");
    expect(disclosure?.querySelector(":scope > nav")?.getAttribute("aria-label")).toBe("Secciones");
    expect(texts(disclosure?.querySelectorAll("nav a") ?? [])).toEqual([
      "Servicios",
      "Dónde estamos",
    ]);
    expect(disclosure?.getAttribute("data-mobile")).toBe("row");
    const order = [...(page.querySelector("header")?.children ?? [])].map((el) => el.className);
    expect(order.indexOf("rb-nav-fold")).toBe(order.indexOf("rb-nav-action") + 1);
    expect(order.indexOf("rb-nav-narrow")).toBe(order.indexOf("rb-nav-fold") + 1);
    // No copy of the sections in the strip, and the phone's row is still drawn for the phone.
    expect(page.querySelector('.rb-nav-wide nav[aria-label="Secciones"]')).toBeNull();
    expect(page.querySelector("nav.rb-nav-row")?.getAttribute("data-mobile")).toBe("row");
  });

  it("is the phone's place wherever the wide one is, and only the phone's", () => {
    for (const position of ["bar", "row", "left", "right", "fold"] as const) {
      const page = draw(site(3, PAGES, { sections: { position, mobile: "fold" } }));
      expect(fold(page)?.getAttribute("data-mobile"), position).toBe("fold");
      // The phone's row is the other answer to the same question, so it is not drawn.
      expect(page.querySelector("nav.rb-nav-row[data-mobile]"), position).toBe(
        position === "row" ? page.querySelector("nav.rb-nav-row") : null,
      );
    }
    // A fixed bar stays fixed on a phone that folds the sections: one line, not two.
    expect(
      draw(site(3, [], { sticky: true, sections: { mobile: "fold" } }))
        .querySelector("header")
        ?.hasAttribute("data-phone-row"),
    ).toBe(false);
  });

  it("is drawn only where it has something to hold", () => {
    expect(fold(draw(site(3, [], { sections: { position: "fold", mobile: "hidden" } })))).not.toBe(
      null,
    );
    expect(fold(draw(site(3, [], { sections: { position: "bar", mobile: "hidden" } })))).toBeNull();
    // A page with no headed section: no disclosure on it, as there is no row on it.
    const away = draw(site(3, PAGES, { sections: { position: "fold", mobile: "fold" } }), "p2");
    expect(fold(away)).toBeNull();
    expect(away.querySelector("nav.rb-nav-row")).toBeNull();
  });

  it("collapses a bar it leaves with nothing, with or without a rail", () => {
    const bar = (header: RetorikaDocument["header"]) =>
      draw(site(3, PAGES, header))
        .querySelector("header")
        ?.getAttribute("data-bar") ?? null;
    expect(bar({ pages: { shown: false }, sections: { position: "fold" } })).toBe("none");
    expect(
      bar({
        pages: { position: "left" },
        sections: { position: "fold" },
        brandWithPages: true,
        brand: { name: true },
      }),
    ).toBe("none");
    // The brand left behind, or the pages in the bar: the bar still has words.
    expect(
      bar({ pages: { shown: false }, sections: { position: "fold" }, brand: { name: true } }),
    ).toBeNull();
    expect(bar({ sections: { position: "fold" } })).toBeNull();
    // Folded on the phone only, the sections are still the bar's on a wide screen.
    expect(bar({ pages: { shown: false }, sections: { position: "bar", mobile: "fold" } })).toBe(
      null,
    );
  });

  it("hangs under the bar by the bar's height plus a space, never minus (David's erratum)", () => {
    const { css } = render(site(3, [], { sections: { position: "fold" } }), "html");
    expect(css).toContain(
      "    top: calc(var(--rb-header-h) + var(--space-md)); right: var(--space-md); }",
    );
    expect(css).not.toMatch(/--rb-header-h\)\s*-\s*var\(--space-md\)/);
    // A collapsed bar is zero on the header itself, which is what the disclosure inherits.
    expect(css).toContain(
      "  .rb-header[data-layout][data-bar=none]:not([data-rails]) { --rb-header-h: 0px;",
    );
  });

  it("takes the side a rail leaves free, by the header's attribute and only where rails stand", () => {
    const right = render(
      site(3, PAGES, { pages: { position: "right" }, sections: { position: "fold" } }),
      "html",
    ).css;
    expect(right).toContain(
      `@media (min-width: ${RAIL_FOLD_WIDTH}px) {\n  .rb-header[data-sections=fold][data-rails=right] .rb-nav-fold { right: auto; left: var(--space-md); }`,
    );
    // No rail, no rule for one.
    expect(render(site(3, [], { sections: { position: "fold" } }), "html").css).not.toContain(
      "data-rails=right] .rb-nav-fold",
    );
  });

  it("closes up the phone's bar only where it joins it", () => {
    const { css } = render(site(3, [], { sections: { mobile: "fold" } }), "html");
    expect(css).toContain(
      "  .rb-header:has(> .rb-nav-fold[data-mobile=fold]) { column-gap: var(--space-sm); }",
    );
    // The rule for the gap after a drawn disclosure names the drawn one: `+` matches a hidden one.
    expect(css).toContain("  .rb-nav-fold[data-mobile=fold] + .rb-nav-narrow { margin-left: 0; }");
  });

  it("writes its stylesheet only for a site that uses it", () => {
    const without = render(site(3, PAGES, { pages: { position: "left" } }), "html").css;
    expect(without).not.toContain("rb-nav-fold");
    expect(without).not.toContain("rb-fold-in");
  });
});
