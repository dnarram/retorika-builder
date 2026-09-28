import { teaserSection } from "@retorika/catalog";
import {
  listDeadDestinations,
  type RetorikaDocument,
  type Section,
  type Theme,
  TOKEN_KEYS,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";

/**
 * «Avance» — the first section whose content is partly **derived** rather than stored.
 *
 * Until now only the `rb-panel` was drawn without being in the document, and that is decoration
 * with no words in it. A teaser holds one link; the title above it and the line under it are read
 * from the destination page every time the page is drawn. These tests are mostly about proving that
 * the reading really happens — that editing the destination changes the teaser, which is the whole
 * point of not copying the words.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function heading(id: string, text: string): Section["content"][number] {
  return { id, role: "heading", hidden: false, slot: "headline", value: { kind: "text", text } };
}

function body(id: string, text: string): Section["content"][number] {
  return { id, role: "body", hidden: false, slot: "intro", value: { kind: "text", text } };
}

function cover(): Section {
  return {
    id: "sec-cover",
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "catalog",
    layout: null,
    content: [heading("el-cover", "Taberna Santo Domingo")],
  };
}

function carta(id = "sec-prices", title = "Nuestra carta", intro?: string): Section {
  return {
    id,
    preset: { catalogId: "prices", variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [heading(`el-${id}`, title), ...(intro ? [body(`el-${id}-intro`, intro)] : [])],
  };
}

/** A home page with one avance, and the page it points at. */
function converted(
  options: { title?: string; intro?: string; href?: string; slug?: string } = {},
): RetorikaDocument {
  const title = options.title ?? "Nuestra carta";
  const slug = options.slug ?? "nuestra-carta";
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Taberna Santo Domingo",
    theme,
    collections: [],
    pages: [
      {
        id: "home",
        slug: "index",
        title: "Taberna Santo Domingo",
        sections: [
          cover(),
          teaserSection("sec-avance", options.href ?? `./${slug}.html`, "Ver más"),
        ],
      },
      {
        id: "page-carta",
        slug,
        title,
        sections: [carta("sec-prices", title, options.intro)],
      },
    ],
  };
}

function parse(source: string): Document {
  return new DOMParser().parseFromString(source, "text/html");
}

function home(doc: RetorikaDocument): Document {
  return parse(render(doc, "html").html);
}

/** Trimmed, because the "html" target pretty-prints and every node carries its indentation. */
function text(node: Element | null | undefined): string | undefined {
  return node?.textContent?.trim();
}

/** A page of the fixture by index, throwing rather than asserting non-null: a fixture that lost a
 * page is a bug in this file, and the message should say so. */
function pageAt(doc: RetorikaDocument, index: number) {
  const page = doc.pages[index];
  if (!page) throw new Error(`fixture has no page ${index}`);
  return page;
}

function teaserOf(page: Document): Element {
  const node = page.querySelector('[data-preset="teaser"]');
  if (!node) throw new Error("no teaser on the page");
  return node;
}

describe("what an avance shows", () => {
  it("reads the destination page's title, which it does not store", () => {
    const teaser = teaserOf(home(converted({ intro: "Pregunta por lo de hoy." })));
    expect(text(teaser.querySelector("h2"))).toBe("Nuestra carta");
  });

  it("reads the first line of the destination's first section", () => {
    const teaser = teaserOf(home(converted({ intro: "Pregunta por lo de hoy." })));
    expect(text(teaser.querySelector("p"))).toBe("Pregunta por lo de hoy.");
  });

  it("follows the destination when it changes, because nothing was copied", () => {
    // The claim the whole design rests on. A teaser that had copied the words would still be
    // saying «Nuestra carta» here, and nothing in the document model would ever reconcile the two.
    const before = converted({ title: "Nuestra carta", intro: "Lo de siempre." });
    const after: RetorikaDocument = {
      ...before,
      pages: before.pages.map((page, index) =>
        index === 1
          ? {
              ...page,
              title: "Menú del día",
              sections: [carta("sec-prices", "Menú del día", "Lo de hoy.")],
            }
          : page,
      ),
    };
    const teaser = teaserOf(home(after));
    expect(text(teaser.querySelector("h2"))).toBe("Menú del día");
    expect(text(teaser.querySelector("p"))).toBe("Lo de hoy.");
  });

  it("shows a title and a link and no line when the destination has no introduction", () => {
    // Honest rather than invented: a section whose introduction the owner deleted has no line to
    // lend, and nothing here makes one up.
    const teaser = teaserOf(home(converted()));
    expect(text(teaser.querySelector("h2"))).toBe("Nuestra carta");
    expect(teaser.querySelectorAll("p")).toHaveLength(0);
    expect(teaser.querySelector("a")).not.toBeNull();
  });

  it("never lends a list item as the summary of a page", () => {
    // `flattenElements` would have reached inside the carta's lines and offered «6,50 €» as the
    // summary. The line is read from the top level of the section only.
    const doc = converted();
    const withLines: RetorikaDocument = {
      ...doc,
      pages: doc.pages.map((page, index) =>
        index === 1
          ? {
              ...page,
              sections: [
                {
                  ...carta(),
                  content: [
                    heading("el-h", "Nuestra carta"),
                    {
                      id: "el-lines",
                      role: "list" as const,
                      hidden: false,
                      slot: "lines",
                      items: [
                        {
                          id: "item-1",
                          elements: [heading("el-n", "Ensaladilla"), body("el-p", "6,50 €")],
                        },
                      ],
                    },
                  ],
                },
              ],
            }
          : page,
      ),
    };
    expect(teaserOf(home(withLines)).querySelectorAll("p")).toHaveLength(0);
  });
});

describe("the accessible name of an avance's link", () => {
  it("says the visible words and then the destination, separated by a colon", () => {
    // Approved wording: «Ver más: Nuestra carta». The colon sidesteps gender agreement entirely —
    // «Ver Nuestra carta completo» is what a template that built a sentence would produce.
    const link = teaserOf(home(converted())).querySelector("a");
    expect(text(link)).toBe("Ver más");
    expect(link?.getAttribute("aria-label")).toBe("Ver más: Nuestra carta");
  });

  it("tells three avances apart although all three read «Ver más»", () => {
    // WCAG 2.4.4: three identical link names going to three different places is what a screen
    // reader's link list would otherwise show.
    const doc = converted();
    const three: RetorikaDocument = {
      ...doc,
      pages: [
        {
          ...pageAt(doc, 0),
          sections: [
            cover(),
            teaserSection("sec-a1", "./nuestra-carta.html", "Ver más"),
            teaserSection("sec-a2", "./fotos.html", "Ver más"),
            teaserSection("sec-a3", "./donde-estamos.html", "Ver más"),
          ],
        },
        pageAt(doc, 1),
        {
          id: "p3",
          slug: "fotos",
          title: "Fotos de la casa",
          sections: [carta("sec-g", "Fotos de la casa")],
        },
        {
          id: "p4",
          slug: "donde-estamos",
          title: "Dónde estamos",
          sections: [carta("sec-l", "Dónde estamos")],
        },
      ],
    };
    const page = home(three);
    const links = [...page.querySelectorAll('[data-preset="teaser"] a')];
    expect(links.map((a) => text(a))).toEqual(["Ver más", "Ver más", "Ver más"]);
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual([
      "Ver más: Nuestra carta",
      "Ver más: Fotos de la casa",
      "Ver más: Dónde estamos",
    ]);
  });

  it("keeps the owner's own words in front when they rewrite the label", () => {
    // The label is the one thing an avance stores, and it is editable. WCAG 2.5.3 wants the
    // accessible name to begin with what the eye reads, and it still does.
    const doc = converted();
    const relabelled: RetorikaDocument = {
      ...doc,
      pages: doc.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              sections: [
                cover(),
                teaserSection("sec-avance", "./nuestra-carta.html", "Mira la carta"),
              ],
            }
          : page,
      ),
    };
    const link = teaserOf(home(relabelled)).querySelector("a");
    expect(link?.getAttribute("aria-label")).toBe("Mira la carta: Nuestra carta");
  });
});

describe("an avance whose page is gone", () => {
  const orphan = () => {
    const doc = converted();
    return { ...doc, pages: [pageAt(doc, 0)] } as RetorikaDocument;
  };

  it("draws the link rather than throwing, so the editor does not go blank", () => {
    // Against the renderer's usual rule, and deliberately: deleting a page would otherwise blank
    // the whole preview instead of showing one broken teaser.
    const teaser = teaserOf(home(orphan()));
    expect(text(teaser.querySelector("a"))).toBe("Ver más");
    expect(teaser.querySelectorAll("h2")).toHaveLength(0);
  });

  it("is caught by the gate that refuses the download, which is the rule that already governs", () => {
    expect(listDeadDestinations(orphan()).map((entry) => entry.sectionId)).toEqual(["sec-avance"]);
  });
});

describe("an avance and the page's outline", () => {
  it("does not take the h1 of a page that has no cover", () => {
    // Its heading is borrowed from somewhere else; promoting it would make this page claim to be
    // about another one.
    const doc = converted();
    const noCover: RetorikaDocument = {
      ...doc,
      pages: [
        {
          ...pageAt(doc, 0),
          sections: [
            teaserSection("sec-avance", "./nuestra-carta.html", "Ver más"),
            carta("sec-otra", "Otra cosa"),
          ],
        },
        pageAt(doc, 1),
      ],
    };
    const page = home(noCover);
    expect(text(page.querySelector("h1"))).toBe("Otra cosa");
    expect(text(teaserOf(page).querySelector("h2"))).toBe("Nuestra carta");
  });

  it("is levelled h2 under a cover, like every other section", () => {
    const page = home(converted());
    expect([...page.querySelectorAll("h1,h2,h3")].map((el) => el.tagName)).toEqual(["H1", "H2"]);
  });
});

describe("what an avance costs the stylesheet", () => {
  it("adds no rule at all, which is why the golden corpus does not move today", () => {
    const { css } = render(converted(), "html");
    expect(css).not.toContain("rb-teaser");
    // And no visually-hidden helper either: the accessible suffix is an attribute, not a node.
    expect(css).not.toContain("clip-path");
  });
});
