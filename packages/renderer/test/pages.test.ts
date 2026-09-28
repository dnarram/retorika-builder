import type { RetorikaDocument, Theme } from "@retorika/schema";
import { TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * Sprint 5 day 2: the renderer draws one page named by `options.pageId`, not unconditionally
 * `doc.pages[0]`. Two rules the single-page world never had to generalise ride along — the
 * `<title>` and which section carries `<h1>` — and a third, `resolvePage`'s own error, is new.
 *
 * No fixture in the golden corpus has more than one page, so the multi-page documents here are
 * built by hand. They are not added to the corpus itself: that would grow the golden diff for a
 * day whose whole point is that nothing published changes yet.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function heading(id: string, text: string, slot = "headline") {
  return {
    id,
    role: "heading" as const,
    hidden: false,
    slot,
    value: { kind: "text" as const, text },
  };
}

function body(id: string, text: string, slot: string) {
  return {
    id,
    role: "body" as const,
    hidden: false,
    slot,
    value: { kind: "text" as const, text },
  };
}

/** cover + services, so it looks like a real generated page rather than a bare fixture. */
function homeSection() {
  return {
    id: "sec-cover",
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "catalog" as const,
    layout: null,
    content: [heading("el-headline", "Taberna Santo Domingo")],
  };
}

/** A page with no cover — what a converted section becomes (day 6), stood up by hand today. */
function pricesSection(id: string, title: string) {
  return {
    id,
    preset: { catalogId: "prices", variantId: "stacked" },
    source: "catalog" as const,
    layout: null,
    content: [
      heading(`el-${id}`, title),
      {
        id: `el-${id}-lines`,
        role: "list" as const,
        hidden: false,
        slot: "lines",
        items: [
          {
            id: "item-1",
            elements: [
              heading(`el-${id}-name`, "Ensaladilla", "name"),
              body(`el-${id}-price`, "6,50 €", "price"),
            ],
          },
        ],
      },
    ],
  };
}

function twoPageDocument(homeTitle: string, secondTitle: string): RetorikaDocument {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Taberna Santo Domingo",
    theme,
    collections: [],
    pages: [
      { id: "home", slug: "index", title: homeTitle, sections: [homeSection()] },
      {
        id: "p2",
        slug: "carta",
        title: secondTitle,
        sections: [pricesSection("sec-carta", "Nuestra carta")],
      },
    ],
  };
}

const doc = twoPageDocument("Taberna Santo Domingo", "Nuestra carta");

function html(pageId?: string): string {
  // `exactOptionalPropertyTypes` means `{ pageId: undefined }` and `{ pageId? }` are different
  // types: the object is only built with the key when a real value was given.
  return render(doc, "html", pageId === undefined ? {} : { pageId }).html;
}

function parse(source: string): Document {
  return new DOMParser().parseFromString(source, "text/html");
}

describe("which page render() draws", () => {
  it("draws the first page when no pageId is given, as it always has", () => {
    expect(parse(html()).querySelector("[data-page]")?.getAttribute("data-page")).toBe("home");
    expect(html()).toContain("Taberna Santo Domingo");
  });

  it("draws the named page instead", () => {
    const page = parse(html("p2"));
    expect(page.querySelector("[data-page]")?.getAttribute("data-page")).toBe("p2");
    expect(page.body.textContent).toContain("Nuestra carta");
    expect(page.body.textContent).not.toContain("Taberna Santo Domingo");
  });

  it("draws only the named page's sections, not both", () => {
    const home = parse(html("home"));
    const p2 = parse(html("p2"));
    expect(home.querySelectorAll("[data-section]")).toHaveLength(1);
    expect(p2.querySelectorAll("[data-section]")).toHaveLength(1);
    expect(home.querySelector("[data-section]")?.getAttribute("data-preset")).toBe("cover");
    expect(p2.querySelector("[data-section]")?.getAttribute("data-preset")).toBe("prices");
  });

  it("throws naming the page when asked for one the document does not have", () => {
    expect(() => html("no-such-page")).toThrow(/no page "no-such-page"/);
  });
});

describe("which section carries <h1>", () => {
  it("is the cover, unchanged, when the page has one", () => {
    const outline = [...parse(html("home")).querySelectorAll("h1,h2,h3")].map((el) => el.tagName);
    expect(outline).toEqual(["H1"]);
    const h1 = parse(html("home")).querySelector("h1");
    expect(h1?.closest("[data-section]")?.getAttribute("data-preset")).toBe("cover");
  });

  it("falls to the page's first section when there is no cover — the case that used to publish no h1 at all", () => {
    const page = parse(html("p2"));
    const h1 = page.querySelector("h1");
    expect(h1, "a converted page must still have an h1, or axe marks it").not.toBeNull();
    expect(h1?.closest("[data-section]")?.getAttribute("data-preset")).toBe("prices");
    expect(h1?.textContent?.trim()).toBe("Nuestra carta");
  });

  it("levels everything else on that page one below it, exactly as the cover page always did", () => {
    // The item inside the list is a card title, which is h{level+1} relative to the section.
    const page = parse(html("p2"));
    const cardHeading = page.querySelector('[data-slot="name"]');
    expect(cardHeading?.tagName).toBe("H2");
  });

  it("is every cover-preset section when a page has more than one, unchanged from before sprint 5", () => {
    // The regression this pins: `hidden-and-embed` in the golden corpus has three sections built
    // on the cover preset, one of them free, on a single page — and all three were h1 before
    // pages existed. The new "promote the first section" rule is for a page with *no* cover at
    // all; it must never narrow a page that already has one down to a single h1.
    const threeCovers: RetorikaDocument = {
      ...doc,
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna Santo Domingo",
          sections: [
            homeSection(),
            { ...homeSection(), id: "sec-cover-2" },
            { ...homeSection(), id: "sec-cover-3", source: "free" },
          ],
        },
      ],
    };
    const page = parse(render(threeCovers, "html").html);
    expect([...page.querySelectorAll("h1")]).toHaveLength(3);
    expect(page.querySelectorAll("h2")).toHaveLength(0);
  });
});

describe("the <title> a page gets", () => {
  it("is the site name alone when the page says nothing more", () => {
    // Every fixture in the golden corpus has page.title === siteName, which is why this is the
    // path the corpus exercises and the reason it does not move today.
    expect(parse(html("home")).title).toBe("Taberna Santo Domingo");
  });

  it("puts the page's own words first when it has some", () => {
    expect(parse(html("p2")).title).toBe("Nuestra carta — Taberna Santo Domingo");
  });

  it("stays exactly the site name for every fixture in the golden corpus", () => {
    for (const entry of loadCorpus()) {
      const rendered = render(entry.document, "html").html;
      expect(parse(rendered).title, entry.name).toBe(entry.document.siteName);
    }
  });
});

describe("the golden corpus", () => {
  it("still renders through the default page with no pageId given", () => {
    // The regression this whole day risks: every existing call site calls render(doc, "html")
    // with no options at all, and it must behave exactly as before.
    for (const entry of loadCorpus()) {
      const firstId = entry.document.pages[0]?.id;
      if (!firstId) throw new Error(`${entry.name}: no first page`);
      const withDefault = render(entry.document, "html").html;
      const withExplicitFirst = render(entry.document, "html", { pageId: firstId }).html;
      expect(withDefault, entry.name).toBe(withExplicitFirst);
    }
  });
});
