import { teaserSection } from "@retorika/catalog";
import { type RetorikaDocument, type Section, type Theme, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { hasMenu, MENU_MIN_ENTRIES, menuEntries } from "../src/menu.ts";

/**
 * The menu that writes itself (ADR 0023, concept dossier §6).
 *
 * Two things are being pinned, and they pull in different directions. **What the menu contains** is
 * a property of the site, computed once from the home page — so it is the same strip everywhere,
 * which is what a menu is for. **Where each entry points** depends on the page being drawn, because
 * an anchor to a home section has to leave whatever page it is written on.
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

/** The entries as a reader of the wide strip would read them: label, href, and whether current. */
function strip(page: Document): { label: string; href: string; current: boolean }[] {
  return [...page.querySelectorAll(".rb-nav-wide a")].map((a) => ({
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

describe("what the menu contains", () => {
  it("is the home page's sections, in the home page's own order", () => {
    expect(menuEntries(threeSections()).map((entry) => entry.label)).toEqual([
      "Qué ponemos",
      "Dónde estamos",
      "Te esperamos",
    ]);
  });

  it("leaves out the cover and the footer", () => {
    // The cover is the top of the page, which is where a visitor already is; the footer is chrome.
    const labels = menuEntries(threeSections()).map((entry) => entry.label);
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
    expect(menuEntries(doc).map((entry) => entry.label)).toEqual(["Qué ponemos", "Te esperamos"]);
  });
});

describe("what a conversion does to the menu", () => {
  it("puts the page's entry exactly where the converted section was", () => {
    // The rule that makes converting invisible to a visitor: the entry that said `#sec-services`
    // becomes `./que-ponemos.html` and does not move in the strip.
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        teaserSection("sec-avance", "./que-ponemos.html", "Ver más"),
        section("sec-location", "location", "Dónde estamos"),
        section("sec-contact", "contact", "Te esperamos"),
      ],
      [{ id: "p2", slug: "que-ponemos", title: "Qué ponemos" }],
    );
    expect(menuEntries(doc)).toEqual([
      { kind: "page", label: "Qué ponemos", slug: "que-ponemos", pageId: "p2" },
      { kind: "anchor", label: "Dónde estamos", sectionId: "sec-location" },
      { kind: "anchor", label: "Te esperamos", sectionId: "sec-contact" },
    ]);
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
    expect(menuEntries(doc).map((entry) => entry.label)).toEqual([
      "Qué ponemos",
      "Te esperamos",
      "La huérfana",
    ]);
  });

  it("leaves out an avance whose page is gone, rather than offering a broken entry", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      teaserSection("sec-avance", "./borrada.html", "Ver más"),
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    expect(menuEntries(doc).map((entry) => entry.label)).toEqual(["Te esperamos"]);
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
    expect(menuEntries(doc)).toHaveLength(MENU_MIN_ENTRIES - 1);
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

  it("uses a bare anchor on the home page", () => {
    expect(strip(draw(converted()))).toEqual([
      { label: "Qué ponemos", href: "./que-ponemos.html", current: false },
      { label: "Dónde estamos", href: "#sec-location", current: false },
      { label: "Te esperamos", href: "#sec-contact", current: false },
    ]);
  });

  it("sends the same anchor back to the home page from anywhere else", () => {
    // `#sec-location` on `que-ponemos.html` would resolve to nothing, and on a static file with no
    // error state a fragment that resolves to nothing looks exactly like a broken site.
    expect(strip(draw(converted(), "p2"))).toEqual([
      { label: "Inicio", href: "./index.html", current: false },
      { label: "Qué ponemos", href: "./que-ponemos.html", current: true },
      { label: "Dónde estamos", href: "./index.html#sec-location", current: false },
      { label: "Te esperamos", href: "./index.html#sec-contact", current: false },
    ]);
  });

  it("marks the page the visitor is on, and only that one", () => {
    const current = strip(draw(converted(), "p2")).filter((entry) => entry.current);
    expect(current.map((entry) => entry.label)).toEqual(["Qué ponemos"]);
  });

  it("offers «Inicio» only where it is not a link to the page you are reading", () => {
    expect(strip(draw(converted())).map((e) => e.label)).not.toContain("Inicio");
    expect(strip(draw(converted(), "p2")).map((e) => e.label)).toContain("Inicio");
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
