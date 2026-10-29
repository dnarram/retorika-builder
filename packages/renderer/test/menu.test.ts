import { teaserSection } from "@retorika/catalog";
import { type RetorikaDocument, type Section, type Theme, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import {
  hasMenu,
  MENU_MIN_ENTRIES,
  menuIsCurated,
  pageMenuEntries,
  sectionMenuEntries,
} from "../src/menu.ts";

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
   * **The order is the pages' own** (ADR 0057, David's decision of 28 October 2026). ADR 0043 let the
   * avances decide it, which left «Páginas» with a «Subir» that moved the tabs and not the menu.
   * Now what the owner sees in the panel is what the site publishes, whatever order the avances
   * happen to sit in on the home page.
   */
  it("keeps the pages in the order the pages are in, whatever order their avances take", () => {
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
    // Document order of the pages is first, second; the avances ask for second, first — and lose.
    expect(pageMenuEntries(doc).map((entry) => entry.label)).toEqual(["La primera", "La segunda"]);
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
  /**
   * **The page half of ADR 0043 §3, and the avance is the reason it is worth a test of its own.**
   * Taking a page out of the menu leaves everything else exactly where it was: the page is still
   * published, the section that announces it still carries its words and its link, and a visitor
   * reaches it the way the owner meant them to. «Fuera del menú» is not «fuera de la web» for a
   * page either.
   */
  it("leaves out a page the owner took out, and keeps the avance that announces it", () => {
    const doc = converted();
    const out = { ...(doc.pages[1] as NonNullable<(typeof doc.pages)[1]>), inMenu: false };
    const curated = { ...doc, pages: [doc.pages[0], out] } as typeof doc;
    expect(pageMenuEntries(curated)).toEqual([]);
    // The avance is untouched: same section, same words, same destination.
    const drawn = draw(curated);
    const avance = drawn.querySelector('[data-section="sec-avance"] a');
    expect(avance?.getAttribute("href")).toBe("./que-ponemos.html");
    expect(avance?.textContent?.trim()).toBe("Ver más");
  });

  it("leaves out a page nothing points at when the owner took it out", () => {
    // The appended half: a page with no avance is still a page the owner can prune.
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        section("sec-location", "location", "Dónde estamos"),
      ],
      [{ id: "p2", slug: "carta", title: "Nuestra carta" }],
    );
    const out = { ...(doc.pages[1] as NonNullable<(typeof doc.pages)[1]>), inMenu: false };
    expect(pageMenuEntries({ ...doc, pages: [doc.pages[0], out] } as typeof doc)).toEqual([]);
  });

  it("counts an explicit «yes» as in, the same as never having been asked", () => {
    const doc = converted();
    const kept = { ...(doc.pages[1] as NonNullable<(typeof doc.pages)[1]>), inMenu: true };
    expect(
      pageMenuEntries({ ...doc, pages: [doc.pages[0], kept] } as typeof doc).map((e) => e.label),
    ).toEqual(["Qué ponemos"]);
  });

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
    // By the short name of each kind, never by the heading («Te esperamos» is a heading, «Contacto»
    // is a place) — ADR 0057. That «Dónde estamos» is both here is the catalog's word coinciding
    // with the heading the fixture happens to write.
    expect(sectionMenuEntries(home as NonNullable<typeof home>).map((e) => e.label)).toEqual([
      "Servicios",
      "Dónde estamos",
      "Contacto",
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

  it("names a section with no heading by its kind, like every other", () => {
    // ADR 0043 had to leave it out for want of a word; the word is now the kind's (ADR 0057), so a
    // gallery with no title is still «Galería» in the menu — which is what it is.
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      section("sec-services", "services", "Qué ponemos"),
      section("sec-mystery", "gallery"),
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(sectionMenuEntries(home).map((entry) => entry.label)).toEqual([
      "Servicios",
      "Galería",
      "Contacto",
    ]);
  });

  it("prefers the owner's own label to the kind's", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      { ...section("sec-prices", "prices", "Lo que cuesta"), menuLabel: "Carta" },
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(sectionMenuEntries(home).map((entry) => entry.label)).toEqual(["Carta", "Contacto"]);
  });

  /**
   * **The one exclusion that is a decision rather than a rule** (ADR 0043 §3). It changes the menu
   * and nothing else: `packages/schema/test/menu-visibility.test.ts` is where that half is held —
   * the section keeps its id and a link at it stays alive — and this is the half the renderer owes.
   */
  it("leaves out a section the owner took out, and only that one", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      { ...section("sec-location", "location", "Dónde estamos"), inMenu: false },
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(sectionMenuEntries(home).map((entry) => entry.label)).toEqual(["Contacto"]);
    // And the section is still on the page, with its heading and its anchor.
    const drawn = draw(doc);
    expect(drawn.querySelector('[data-section="sec-location"]')).not.toBeNull();
    expect(drawn.querySelector('[data-section="sec-location"] h2')?.textContent?.trim()).toBe(
      "Dónde estamos",
    );
  });

  it("counts an explicit «yes» as in, the same as never having been asked", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      { ...section("sec-location", "location", "Dónde estamos"), inMenu: true },
    ]);
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(sectionMenuEntries(home).map((entry) => entry.label)).toEqual(["Dónde estamos"]);
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
    expect(sectionMenuEntries(home).map((entry) => entry.label)).toEqual(["Contacto"]);
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

/**
 * **Once the owner has curated, the threshold steps aside** (ADR 0043 §5) — David's own rule, in
 * his words: «se queda si el dueño lo ha tocado».
 *
 * The threshold of three is a judgement about documents nobody has looked at: a generated site
 * with two headed sections is not a site somebody decided should have two. The moment somebody
 * does decide, the judgement has nothing left to be about, and overruling them would be the
 * product telling an owner their own navigation is too short.
 */
describe("the curated threshold", () => {
  /** Cover, two ordinary sections and a third the owner took out: one destination left, curated. */
  const curatedToOne = () =>
    documentWith([
      section("sec-cover", "cover", "Taberna"),
      { ...section("sec-location", "location", "Dónde estamos"), inMenu: false },
      section("sec-contact", "contact", "Te esperamos"),
    ]);

  it("keeps the threshold while nobody has decided anything", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      section("sec-services", "services", "Qué ponemos"),
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    expect(menuIsCurated(doc)).toBe(false);
    expect(hasMenu(doc)).toBe(false);
  });

  it("draws a menu of one destination once the owner has curated down to it", () => {
    const doc = curatedToOne();
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(menuIsCurated(doc)).toBe(true);
    expect(sectionMenuEntries(home)).toHaveLength(1);
    expect(sectionMenuEntries(home).length).toBeLessThan(MENU_MIN_ENTRIES);
    expect(hasMenu(doc)).toBe(true);
    expect(strip(draw(doc))).toEqual([{ label: "Contacto", href: "#sec-contact", current: false }]);
  });

  /**
   * **Curation is the presence of the key, not its value**, which is the clause that decides what
   * happens when somebody changes their mind. Turning a switch off and back on leaves the document
   * curated, so the menu they were just looking at does not vanish on them — a menu that
   * disappeared when an owner undid their own decision would read as the editor losing their work.
   */
  it("stays curated when a switch is turned off and back on", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      { ...section("sec-location", "location", "Dónde estamos"), inMenu: true },
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(menuIsCurated(doc)).toBe(true);
    expect(sectionMenuEntries(home)).toHaveLength(2);
    expect(hasMenu(doc)).toBe(true);
  });

  it("notices a decision made on any page, because a menu is drawn for the whole site", () => {
    // Two destinations, under the threshold, and the only decision was made away from home.
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        teaserSection("sec-avance", "./carta.html", "Ver más"),
        section("sec-contact", "contact", "Te esperamos"),
      ],
      [
        {
          id: "p2",
          slug: "carta",
          title: "Nuestra carta",
          sections: [
            section("sec-carta", "prices", "Nuestra carta"),
            { ...section("sec-extra", "services", "Para llevar"), inMenu: false },
          ],
        },
      ],
    );
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(pageMenuEntries(doc).length + sectionMenuEntries(home).length).toBe(
      MENU_MIN_ENTRIES - 1,
    );
    expect(menuIsCurated(doc)).toBe(true);
    expect(hasMenu(doc)).toBe(true);
  });

  /**
   * **David's own clause, added on approving the sprint: with nothing left, nothing is emitted.**
   * Not an empty `<nav>`, not a `<details>` with an empty list inside it. A landmark announced as
   * navigation to somebody who cannot see it, holding nothing, is worse than no landmark — and the
   * narrow version would be a disclosure that opens onto nothing at all.
   */
  it("emits no nav and no details when the owner has taken everything out", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      { ...section("sec-location", "location", "Dónde estamos"), inMenu: false },
    ]);
    const home = doc.pages[0] as NonNullable<(typeof doc.pages)[0]>;
    expect(menuIsCurated(doc)).toBe(true);
    expect(pageMenuEntries(doc).length + sectionMenuEntries(home).length).toBe(0);
    expect(hasMenu(doc)).toBe(false);
    const drawn = draw(doc);
    expect(drawn.querySelectorAll("nav")).toHaveLength(0);
    expect(drawn.querySelectorAll("details")).toHaveLength(0);
  });
});

/**
 * **The pages strip has a floor of two visible pages, and «Inicio» is what makes it asymmetric**
 * (ADR 0043 §5). A strip is drawn only when it holds a link to somewhere the visitor is not.
 */
describe("the pages strip and its floor", () => {
  /** Three headed sections, so the sections menu carries the site past the threshold, and one
   * other page the owner took out of the menu. */
  const oneVisiblePage = () => {
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        section("sec-services", "services", "Qué ponemos"),
        section("sec-location", "location", "Dónde estamos"),
        section("sec-contact", "contact", "Te esperamos"),
      ],
      [{ id: "p2", slug: "carta", title: "Nuestra carta" }],
    );
    const out = { ...(doc.pages[1] as NonNullable<(typeof doc.pages)[1]>), inMenu: false };
    return { ...doc, pages: [doc.pages[0], out] } as typeof doc;
  };

  it("draws no pages strip on the home page when there is no other page to offer", () => {
    const drawn = draw(oneVisiblePage(), "home");
    expect(drawn.querySelector('.rb-nav-wide nav[aria-label="Páginas"]')).toBeNull();
    expect(strip(drawn, "Secciones")).toHaveLength(3);
  });

  /**
   * **And keeps the way back**, which is the half the floor must not take away. On the page the
   * owner pruned, «Inicio» is a link to somewhere the visitor is not, so the strip is drawn with
   * it alone — the same thing that keeps a page drawn per entry from being a dead end.
   */
  it("still offers «Inicio» from the page the owner took out", () => {
    expect(strip(draw(oneVisiblePage(), "p2"), "Páginas")).toEqual([
      { label: "Inicio", href: "./index.html", current: false },
    ]);
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
      { label: "Contacto", href: "#sec-contact", current: false },
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
  /** Three pages, so both menus are drawn and the phone has something to fold. */
  const twoMenus = () =>
    documentWith(
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

  /**
   * **The pages fold, the sections do not** (ADR 0057, amending ADR 0043 §1). The phone's
   * disclosure holds the pages alone; the sections of the page you are on are a row under the bar.
   * Added together, the two phone copies are exactly the wide bar.
   */
  it("emits a wide strip, and for the phone a disclosure of the pages plus a row of the sections", () => {
    const page = draw(twoMenus());
    const text = (nodes: NodeListOf<Element>) => [...nodes].map((a) => a.textContent?.trim());
    const wide = text(page.querySelectorAll(".rb-nav-wide a"));
    const folded = text(page.querySelectorAll(".rb-nav-narrow a"));
    const row = text(page.querySelectorAll(".rb-nav-row a"));
    expect(folded).toEqual(["Nuestra carta", "Dónde estamos"]);
    expect(row).toEqual(["Contacto"]);
    expect([...folded, ...row]).toEqual(wide);
  });

  it("collapses the pages with <details>, and puts no <input> on a published page", () => {
    // ADR 0016 left the `field` role unused precisely so that no orphan input reaches a client's
    // site; the checkbox-toggle trick would put one there by the back door.
    const page = draw(twoMenus());
    expect(page.querySelector(".rb-nav-narrow")?.tagName).toBe("DETAILS");
    expect(page.querySelector(".rb-nav-narrow > summary")?.textContent?.trim()).toBe("Menú");
    expect(page.querySelectorAll("details")).toHaveLength(1);
    expect(page.querySelectorAll("input")).toHaveLength(0);
  });

  it("draws no disclosure for a one-page site, whose whole phone menu is the row", () => {
    // Nothing to fold: an empty `<details>` would be a button that opens onto nothing.
    const page = draw(threeSections());
    expect(page.querySelector("details")).toBeNull();
    expect([...page.querySelectorAll(".rb-nav-row a")].map((a) => a.textContent?.trim())).toEqual([
      "Servicios",
      "Dónde estamos",
      "Contacto",
    ]);
  });

  it("hides exactly one copy at each width, with display: none", () => {
    // `display: none` and not `visibility` or a clip: it is the only one that takes an element out
    // of the accessibility tree, which is what makes two menus "alternated" rather than "announced".
    // That one landmark is in the tree is asserted in a real browser by the a11y matrix.
    const { css } = render(twoMenus(), "html");
    expect(css).toContain(".rb-nav-narrow { display: none; }");
    expect(css).toContain(".rb-header[data-sections=shared] .rb-nav-row { display: none; }");
    expect(css).toContain("  .rb-nav-wide { display: none; }");
    expect(css).toContain("  .rb-nav-narrow { display: block;");
    expect(css).toContain("  .rb-header[data-sections] .rb-nav-row { display: flex;");
  });

  it("costs no JavaScript", () => {
    expect(render(twoMenus(), "html").html).not.toContain("<script");
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
      "Servicios",
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
