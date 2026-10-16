import { teaserSection } from "@retorika/catalog";
import { type RetorikaDocument, type Section, type Theme, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { hasMenu, MENU_MIN_ENTRIES, pageMenuEntries, sectionMenuEntries } from "../src/menu.ts";

/**
 * The menu that writes itself (ADR 0023, concept dossier §6), in the two halves ADR 0043 split it
 * into.
 *
 * **The pages menu is a property of the document** — the same list on every page, which is what a
 * menu is for — and only its hrefs and its `aria-current` depend on where the visitor is. **The
 * sections menu is a property of the page being drawn**, so its anchors are always local. Those
 * two sentences are what most of this file is checking.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function heading(id: string, text: string): Section["content"][number] {
  return { id, role: "heading", hidden: false, slot: "headline", value: { kind: "text", text } };
}

function section(id: string, catalogId: string, title?: string): Section {
  return {
    id,
    preset: { catalogId, variantId: catalogId === "cover" ? "image-right" : "stacked" },
    source: "catalog",
    layout: null,
    content: title === undefined ? [] : [heading(`el-${id}`, title)],
  };
}

function footer(): Section {
  return {
    id: "sec-footer",
    preset: { catalogId: "footer", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-businessName",
        role: "body",
        hidden: false,
        slot: "businessName",
        value: { kind: "text", text: "© Taberna Santo Domingo" },
      },
    ],
  };
}

function documentWith(
  homeSections: Section[],
  pages: { id: string; slug: string; title: string; sections?: Section[] }[] = [],
): RetorikaDocument {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Taberna Santo Domingo",
    theme,
    collections: [],
    pages: [
      { id: "home", slug: "index", title: "Taberna Santo Domingo", sections: homeSections },
      ...pages.map((page) => ({
        ...page,
        sections: page.sections ?? [section(`sec-${page.slug}`, "prices", page.title)],
      })),
    ],
  };
}

function parse(source: string): Document {
  return new DOMParser().parseFromString(source, "text/html");
}

function draw(doc: RetorikaDocument, pageId?: string): Document {
  return parse(render(doc, "html", pageId === undefined ? {} : { pageId }).html);
}

/**
 * The entries as a reader of the wide bar would read them: label, href, and whether current.
 *
 * With no label it reads the whole bar, both menus in source order, which is what the eye sees;
 * with one it reads that menu alone. Both views are wanted: the bar is what a visitor reads, and
 * the single menu is what the split is actually about.
 */
function strip(
  page: Document,
  label?: string,
): { label: string; href: string; current: boolean }[] {
  const where =
    label === undefined ? ".rb-nav-wide a" : `.rb-nav-wide nav[aria-label="${label}"] a`;
  return [...page.querySelectorAll(where)].map((a) => ({
    label: a.textContent?.trim() ?? "",
    href: a.getAttribute("href") ?? "",
    current: a.getAttribute("aria-current") === "page",
  }));
}

/** Cover, three ordinary sections and a footer: three entries, so a menu. */
const threeSections = () =>
  documentWith([
    section("sec-cover", "cover", "Taberna Santo Domingo"),
    section("sec-services", "services", "Qué ponemos"),
    section("sec-location", "location", "Dónde estamos"),
    section("sec-contact", "contact", "Te esperamos"),
    footer(),
  ]);

describe("the pages of the site", () => {
  const converted = () =>
    documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        teaserSection("sec-avance", "./que-ponemos.html", "Ver más"),
        section("sec-location", "location", "Dónde estamos"),
        section("sec-contact", "contact", "Te esperamos"),
      ],
      [{ id: "p2", slug: "que-ponemos", title: "Qué ponemos" }],
    );

  it("is empty for a site with one page, because there is nowhere to go", () => {
    expect(pageMenuEntries(threeSections())).toEqual([]);
  });

  it("holds the page an avance points at", () => {
    expect(pageMenuEntries(converted())).toEqual([
      { label: "Qué ponemos", slug: "que-ponemos", pageId: "p2" },
    ]);
  });

  /**
   * **What the split gave up, said as a test.** ADR 0023 made converting invisible to a visitor by
   * keeping the entry in the slot the section held. Pages and anchors are now two lists, so the
   * entry moves from one to the other; what survives is the order *among the pages*, which is the
   * half the avances still decide.
   */
  it("keeps the pages in the order their avances are in", () => {
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        teaserSection("sec-b", "./segunda.html", "Ver más"),
        section("sec-location", "location", "Dónde estamos"),
        teaserSection("sec-a", "./primera.html", "Ver más"),
      ],
      [
        { id: "p-first", slug: "primera", title: "La primera" },
        { id: "p-second", slug: "segunda", title: "La segunda" },
      ],
    );
    // Document order of the pages is first, second; the avances ask for second, first.
    expect(pageMenuEntries(doc).map((entry) => entry.label)).toEqual(["La segunda", "La primera"]);
  });

  it("appends a page nothing points at, rather than leaving it with no way in", () => {
    // An owner may delete an avance and keep its page (ADR 0022). A page at the end of the strip
    // is worse than one in its place and better than one that cannot be reached.
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        section("sec-services", "services", "Qué ponemos"),
        section("sec-contact", "contact", "Te esperamos"),
      ],
      [{ id: "p2", slug: "huerfana", title: "La huérfana" }],
    );
    expect(pageMenuEntries(doc).map((entry) => entry.label)).toEqual(["La huérfana"]);
  });

  it("leaves out an avance whose page is gone, rather than offering a broken entry", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      teaserSection("sec-avance", "./borrada.html", "Ver más"),
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    expect(pageMenuEntries(doc)).toEqual([]);
  });

  /**
   * **Two avances to one page are one entry, not two.** The same words twice in one list of links
   * is the duplicate-link problem ADR 0022 already solved for «Ver más» with its screen-reader
   * colon. It could not happen while the append loop was the only other source; with the teaser
   * loop collecting, it could.
   */
  it("gives a page one entry however many avances point at it", () => {
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        teaserSection("sec-a", "./carta.html", "Ver más"),
        section("sec-location", "location", "Dónde estamos"),
        teaserSection("sec-b", "./carta.html", "Ver más"),
      ],
      [{ id: "p2", slug: "carta", title: "Nuestra carta" }],
    );
    expect(pageMenuEntries(doc).map((entry) => entry.label)).toEqual(["Nuestra carta"]);
  });
});

describe("the sections of the page you are on", () => {
  it("is the page's own sections, in the page's own order", () => {
    const home = threeSections().pages[0];
    expect(home).toBeDefined();
    expect(sectionMenuEntries(home as NonNullable<typeof home>).map((e) => e.label)).toEqual([
      "Qué ponemos",
      "Dónde estamos",
      "Te esperamos",
    ]);
  });

  it("leaves out the cover and the footer", () => {
    // The cover is the top of the page, which is where a visitor already is; the footer is chrome.
    const home = threeSections().pages[0] as NonNullable<
      ReturnType<typeof threeSections>["pages"][0]
    >;
    const labels = sectionMenuEntries(home).map((entry) => entry.label);
    expect(labels).not.toContain("Taberna Santo Domingo");
    expect(labels.some((label) => label.startsWith("©"))).toBe(false);
  });

  it("leaves out a section with no heading to be called by", () => {
    // There is no honest word for it, and inventing one is what this whole mechanism avoids.
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      section("sec-services", "services", "Qué ponemos"),
      section("sec-mystery", "gallery"),
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(sectionMenuEntries(home).map((entry) => entry.label)).toEqual([
      "Qué ponemos",
      "Te esperamos",
    ]);
  });

  it("leaves out an avance, whose words belong to a page in the other menu", () => {
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        teaserSection("sec-avance", "./que-ponemos.html", "Ver más"),
        section("sec-contact", "contact", "Te esperamos"),
      ],
      [{ id: "p2", slug: "que-ponemos", title: "Qué ponemos" }],
    );
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(sectionMenuEntries(home).map((entry) => entry.label)).toEqual(["Te esperamos"]);
  });

  /**
   * **The clause the split made necessary.** A converted page opens with whatever section was
   * converted rather than with a cover, so without this a one-section page would publish a strip
   * holding one link whose words are its own `<h1>` and whose destination is the top of the page
   * you are reading. `headings.ts` is the one place that decides which section that is, so the
   * renderer and the menu cannot disagree about it.
   */
  it("leaves out the section that carries the page's h1, cover or not", () => {
    const doc = documentWith(
      [section("sec-cover", "cover", "Taberna"), section("sec-contact", "contact", "Te esperamos")],
      [
        {
          id: "p2",
          slug: "que-ponemos",
          title: "Qué ponemos",
          sections: [
            section("sec-moved", "services", "Qué ponemos"),
            section("sec-extra", "prices", "Precios"),
          ],
        },
      ],
    );
    const made = doc.pages[1] as NonNullable<(typeof doc.pages)[1]>;
    // `sec-moved` is this page's h1; only the section below it lends an anchor.
    expect(sectionMenuEntries(made).map((entry) => entry.label)).toEqual(["Precios"]);
  });
});

describe("the threshold of three", () => {
  it("draws no menu at all below it", () => {
    // Two links above a page that already scrolls is furniture, not navigation.
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      section("sec-services", "services", "Qué ponemos"),
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(sectionMenuEntries(home)).toHaveLength(MENU_MIN_ENTRIES - 1);
    expect(hasMenu(doc)).toBe(false);
    expect(draw(doc).querySelectorAll("nav")).toHaveLength(0);
  });

  it("draws one at it", () => {
    expect(hasMenu(threeSections())).toBe(true);
    expect(strip(draw(threeSections()))).toHaveLength(3);
  });

  it("counts entries and not pages, so a one-page site gets a menu too", () => {
    // The half of ADR 0023 that was in question: «sí al menú con una sola página, pero solo cuando
    // haya al menos tres entradas».
    expect(threeSections().pages).toHaveLength(1);
    expect(hasMenu(threeSections())).toBe(true);
  });

  /**
   * **The two menus are counted together, and the arithmetic is the whole argument.** A threshold
   * of three *per menu* would delete the navigation from this document — two pages, one headed
   * section — which is the shape of the only multi-page fixture in the corpus and of any site
   * built by converting two sections of a generated one.
   */
  it("adds the two menus together rather than asking three of each", () => {
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        teaserSection("sec-a", "./carta.html", "Ver más"),
        teaserSection("sec-b", "./donde.html", "Ver más"),
        section("sec-contact", "contact", "Te esperamos"),
      ],
      [
        { id: "p2", slug: "carta", title: "Nuestra carta" },
        { id: "p3", slug: "donde", title: "Dónde estamos" },
      ],
    );
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(pageMenuEntries(doc)).toHaveLength(2);
    expect(sectionMenuEntries(home)).toHaveLength(1);
    expect(hasMenu(doc)).toBe(true);
  });

  it("answers the same on every page of the site", () => {
    // A menu that appears on one page and not on another is not a menu, which is why the count is
    // taken on the home page whatever page is being drawn.
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        teaserSection("sec-a", "./carta.html", "Ver más"),
        teaserSection("sec-b", "./donde.html", "Ver más"),
        section("sec-contact", "contact", "Te esperamos"),
      ],
      [
        { id: "p2", slug: "carta", title: "Nuestra carta" },
        { id: "p3", slug: "donde", title: "Dónde estamos" },
      ],
    );
    for (const pageId of ["home", "p2", "p3"]) {
      expect(draw(doc, pageId).querySelectorAll(".rb-nav-wide nav").length).toBeGreaterThan(0);
    }
  });
});

describe("where an entry points, which depends on the page being drawn", () => {
  const converted = () =>
    documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        teaserSection("sec-avance", "./que-ponemos.html", "Ver más"),
        section("sec-location", "location", "Dónde estamos"),
        section("sec-contact", "contact", "Te esperamos"),
      ],
      [{ id: "p2", slug: "que-ponemos", title: "Qué ponemos" }],
    );

  it("splits the bar into the pages and this page's sections", () => {
    expect(strip(draw(converted()), "Páginas")).toEqual([
      { label: "Qué ponemos", href: "./que-ponemos.html", current: false },
    ]);
    expect(strip(draw(converted()), "Secciones")).toEqual([
      { label: "Dónde estamos", href: "#sec-location", current: false },
      { label: "Te esperamos", href: "#sec-contact", current: false },
    ]);
  });

  /**
   * **Every anchor is local now, and that is what the split bought.** The sections menu is the
   * page being drawn, so `./index.html#sec-x` — the shape that existed only because one strip had
   * to serve every page — is gone from the published output.
   */
  it("writes bare anchors on every page, home or not", () => {
    const away = draw(converted(), "p2");
    expect(strip(away, "Páginas")).toEqual([
      { label: "Inicio", href: "./index.html", current: false },
      { label: "Qué ponemos", href: "./que-ponemos.html", current: true },
    ]);
    for (const entry of strip(away, "Secciones")) expect(entry.href.startsWith("#")).toBe(true);
    expect(render(converted(), "html", { pageId: "p2" }).html).not.toContain("./index.html#");
  });

  it("marks the page the visitor is on, and only that one", () => {
    const current = strip(draw(converted(), "p2")).filter((entry) => entry.current);
    expect(current.map((entry) => entry.label)).toEqual(["Qué ponemos"]);
  });

  it("offers «Inicio» only where it is not a link to the page you are reading", () => {
    expect(strip(draw(converted())).map((e) => e.label)).not.toContain("Inicio");
    expect(strip(draw(converted(), "p2")).map((e) => e.label)).toContain("Inicio");
  });

  it("gives the two menus names a screen reader can tell apart", () => {
    const page = draw(converted());
    expect(
      [...page.querySelectorAll(".rb-nav-wide nav")].map((n) => n.getAttribute("aria-label")),
    ).toEqual(["Páginas", "Secciones"]);
  });
});

describe("the two versions of the menu", () => {
  it("emits a wide strip and a narrow disclosure with the same entries", () => {
    const page = draw(threeSections());
    const wide = [...page.querySelectorAll(".rb-nav-wide a")].map((a) => a.textContent?.trim());
    const narrow = [...page.querySelectorAll(".rb-nav-narrow a")].map((a) => a.textContent?.trim());
    expect(narrow).toEqual(wide);
  });

  it("collapses with <details>, and puts no <input> on a published page", () => {
    // ADR 0016 left the `field` role unused precisely so that no orphan input reaches a client's
    // site; the checkbox-toggle trick would put one there by the back door.
    const page = draw(threeSections());
    expect(page.querySelector(".rb-nav-narrow")?.tagName).toBe("DETAILS");
    expect(page.querySelector(".rb-nav-narrow > summary")?.textContent?.trim()).toBe("Menú");
    expect(page.querySelectorAll("input")).toHaveLength(0);
  });

  it("hides exactly one of them at each width, with display: none", () => {
    // `display: none` and not `visibility` or a clip: it is the only one that takes an element out
    // of the accessibility tree, which is what makes two menus "alternated" rather than "announced".
    // That one landmark is in the tree is asserted in a real browser by the a11y matrix.
    const { css } = render(threeSections(), "html");
    expect(css).toContain(".rb-nav-narrow { display: none; }");
    expect(css).toContain("  .rb-nav-wide { display: none; }");
    expect(css).toContain("  .rb-nav-narrow { display: block; }");
  });

  it("costs no JavaScript", () => {
    expect(render(threeSections(), "html").html).not.toContain("<script");
  });
});

describe("the footer on every page", () => {
  const converted = () =>
    documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        teaserSection("sec-avance", "./que-ponemos.html", "Ver más"),
        section("sec-location", "location", "Dónde estamos"),
        section("sec-contact", "contact", "Te esperamos"),
        footer(),
      ],
      [{ id: "p2", slug: "que-ponemos", title: "Qué ponemos" }],
    );

  it("draws it on a page that does not have one, from the home page's own", () => {
    // A converted page with no footer looks unfinished, and the owner never asked for one there.
    const page = draw(converted(), "p2");
    expect(page.querySelector("footer")?.textContent).toContain("© Taberna Santo Domingo");
  });

  it("draws exactly one on the home page, which already has it", () => {
    expect(draw(converted()).querySelectorAll("footer")).toHaveLength(1);
  });

  it("does not add a second to a page that has its own", () => {
    const doc = converted();
    const withOwn: RetorikaDocument = {
      ...doc,
      pages: doc.pages.map((page, index) =>
        index === 1 ? { ...page, sections: [...page.sections, footer()] } : page,
      ),
    };
    expect(draw(withOwn, "p2").querySelectorAll("footer")).toHaveLength(1);
  });

  it("leaves the document alone: there is still one footer, on one page", () => {
    // Rule 5 is about the document, not about the rendered page. Repeating the footer is not
    // duplicating it.
    const doc = converted();
    const footers = doc.pages.flatMap((page) =>
      page.sections.filter((s) => s.preset.catalogId === "footer"),
    );
    expect(footers).toHaveLength(1);
  });
});

describe("a page drawn per entry (ADR 0040)", () => {
  it("contributes no entry, whatever the page count", () => {
    const doc: RetorikaDocument = {
      schemaVersion: "1.9.0",
      id: "doc-ficha",
      siteName: "Taberna",
      theme,
      collections: [
        {
          id: "col-carta",
          name: "La carta",
          entries: [
            { id: "entry-1", slug: "ensaladilla", fields: { nombre: { text: "Ensaladilla" } } },
          ],
        },
      ],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna",
          sections: [
            section("sec-cover", "cover", "Taberna"),
            section("sec-services", "services", "Qué hacemos"),
            section("sec-location", "location", "Dónde estamos"),
            section("sec-contact", "contact", "Contacto"),
          ],
        },
        {
          id: "page-ficha-carta",
          slug: "ficha",
          title: "Ficha de plato",
          binding: { collectionId: "col-carta", titleField: "nombre" },
          sections: [section("sec-ficha", "cover", "Ensaladilla")],
        },
      ],
    };
    // It is in no menu: not as a page nothing points at, and never through an avance.
    expect(pageMenuEntries(doc)).toEqual([]);
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(sectionMenuEntries(home).map((entry) => entry.label)).toEqual([
      "Qué hacemos",
      "Dónde estamos",
      "Contacto",
    ]);
    const drawn = render(doc, "html", { pageId: "page-ficha-carta" }).html;
    expect(drawn).toContain("Inicio");
    expect(drawn).not.toMatch(/<a[^>]*aria-current=/);
    expect(drawn).not.toContain("ficha.html");
    // And its own section carries its h1, so the drawn page offers no sections menu either —
    // «Inicio» alone, which is the way back ADR 0040 §5 asks for.
    expect(drawn).not.toContain('aria-label="Secciones"');
  });
});
