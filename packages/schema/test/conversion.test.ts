import { describe, expect, it } from "vitest";
import {
  canFoldPage,
  foldsInto,
  MAX_PAGES,
  pageToSection,
  sectionToPage,
  type TeaserFactory,
} from "../src/conversion.ts";
import { listDeadDestinations } from "../src/destinations.ts";
import type { ContentElement, RetorikaDocument, Section } from "../src/document.ts";

import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * A section becomes a page — the dossier §6 verb, and ADR 0022's «una página nace convirtiendo una
 * sección».
 *
 * The property that matters most here is that it is **one step**: the page, the move and the avance
 * happen together or not at all, so a single «Deshacer» takes back all three. That is asserted by
 * every test working on the document the verb returns, rather than on some half-applied state — and
 * by the verb never mutating what it was given.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

function heading(id: string, text: string): ContentElement {
  return { id, role: "heading", hidden: false, slot: "headline", value: { kind: "text", text } };
}

function body(id: string, text: string, slot = "intro"): ContentElement {
  return { id, role: "body", hidden: false, slot, value: { kind: "text", text } };
}

function section(id: string, catalogId: string, content: ContentElement[]): Section {
  return {
    id,
    preset: { catalogId, variantId: catalogId === "cover" ? "image-right" : "stacked" },
    source: "catalog",
    layout: null,
    content,
  };
}

/** The catalog's `teaserSection`, inlined: `packages/schema` may not import the catalog. */
const makeTeaser: TeaserFactory = ({ sectionId, href }) =>
  section(sectionId, "teaser", [
    {
      id: "el-link",
      role: "link",
      hidden: false,
      slot: "link",
      value: { kind: "link", text: "Ver más", href },
    },
  ]);

function documentWith(sections: Section[]): RetorikaDocument {
  return {
    schemaVersion: "1.0.0",
    id: "doc-1",
    siteName: "Taberna Santo Domingo",
    theme,
    collections: [],
    pages: [{ id: "home", slug: "index", title: "Taberna Santo Domingo", sections }],
  };
}

const carta = () =>
  section("sec-prices", "prices", [
    heading("el-headline", "Nuestra carta"),
    body("el-intro", "Pregunta por lo que haya hoy fuera de carta."),
  ]);

const base = () =>
  documentWith([
    section("sec-cover", "cover", [heading("el-cover", "Taberna Santo Domingo")]),
    carta(),
  ]);

describe("sectionToPage", () => {
  it("creates the page, moves the section onto it, and leaves an avance — in one document", () => {
    const after = sectionToPage(base(), "sec-prices", makeTeaser);

    expect(after.pages).toHaveLength(2);
    const [home, page] = after.pages;
    expect(page?.sections.map((s) => s.id)).toEqual(["sec-prices"]);
    expect(home?.sections.map((s) => s.preset.catalogId)).toEqual(["cover", "teaser"]);
  });

  it("names the page after the heading the owner already wrote", () => {
    const after = sectionToPage(base(), "sec-prices", makeTeaser);
    expect(after.pages[1]?.title).toBe("Nuestra carta");
    expect(after.pages[1]?.slug).toBe("nuestra-carta");
  });

  it("points the avance at the page it just made", () => {
    const after = sectionToPage(base(), "sec-prices", makeTeaser);
    const teaser = after.pages[0]?.sections.find((s) => s.preset.catalogId === "teaser");
    expect(teaser?.content[0]?.value).toMatchObject({ href: "./nuestra-carta.html" });
  });

  it("gives the avance its own id and leaves the section's with the section", () => {
    // The first draft did the opposite — the avance kept `sec-prices` so that anchors to it would
    // still land on something — and `parseDocument` refused the result outright: two sections
    // cannot share an id (rule 5). The section that moved is still the same section, and its id is
    // what its own layout is written against.
    const after = sectionToPage(base(), "sec-prices", makeTeaser);
    expect(after.pages[1]?.sections[0]?.id).toBe("sec-prices");
    expect(after.pages[0]?.sections.map((s) => s.id)).toEqual(["sec-cover", "sec-avance"]);
  });

  it("rewrites the owner's own buttons instead of leaving them pointing at nothing", () => {
    // What replaced the id trick, and it is the better answer. A «Ver la carta» button saying
    // `#sec-prices` would resolve to nothing the moment that section moved off the page — and
    // since today `listDeadDestinations` correctly says so, converting a section would silently
    // block the download until the owner found and fixed a button they never touched. The button
    // still goes where its words promise; that is now a page rather than a place on this one.
    const doc = documentWith([
      section("sec-cover", "cover", [
        heading("el-cover", "Taberna"),
        {
          id: "el-cta",
          role: "link",
          hidden: false,
          slot: "secondaryAction",
          value: { kind: "link", text: "Ver la carta", href: "#sec-prices" },
        },
      ]),
      carta(),
    ]);
    const after = sectionToPage(doc, "sec-prices", makeTeaser);
    const cta = after.pages[0]?.sections[0]?.content.find((el) => el.id === "el-cta");
    expect(cta?.value).toMatchObject({ href: "./nuestra-carta.html", text: "Ver la carta" });
    expect(listDeadDestinations(after)).toEqual([]);
  });

  it("rewrites a button inside a list item too, where a card's own link lives", () => {
    const doc = documentWith([
      section("sec-cover", "cover", [heading("el-cover", "Taberna")]),
      section("sec-services", "services", [
        heading("el-s", "Qué ponemos"),
        {
          id: "el-cards",
          role: "list",
          hidden: false,
          slot: "services",
          items: [
            {
              id: "item-1",
              elements: [
                heading("el-c1", "Comidas"),
                {
                  id: "el-c1-link",
                  role: "link",
                  hidden: false,
                  slot: "link",
                  value: { kind: "link", text: "Ver", href: "#sec-prices" },
                },
              ],
            },
          ],
        },
      ]),
      carta(),
    ]);
    const after = sectionToPage(doc, "sec-prices", makeTeaser);
    expect(listDeadDestinations(after)).toEqual([]);
  });

  it("produces a document with no dead destinations of its own", () => {
    // The teaser's own link is the thing most likely to be wrong, and it is checked by the gate
    // that would refuse the download rather than by re-reading the href here.
    expect(listDeadDestinations(sectionToPage(base(), "sec-prices", makeTeaser))).toEqual([]);
  });

  it("does not touch the document it was given", () => {
    // One step means all-or-nothing, and a verb that half-mutated its input could not be undone
    // by restoring a snapshot — which is exactly how the editor's history works.
    const before = base();
    const snapshot = JSON.stringify(before);
    sectionToPage(before, "sec-prices", makeTeaser);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("falls back to the site name when the section has no heading to be named after", () => {
    const doc = documentWith([
      section("sec-cover", "cover", [heading("el-cover", "Taberna")]),
      section("sec-plain", "prices", [body("el-intro", "Sin título.")]),
    ]);
    const after = sectionToPage(doc, "sec-plain", makeTeaser);
    expect(after.pages[1]?.title).toBe("Taberna Santo Domingo");
  });

  it("numbers a slug a page already has rather than making two pages one file", () => {
    const first = sectionToPage(base(), "sec-prices", makeTeaser);
    const another = section("sec-prices-2", "prices", [heading("el-h2", "Nuestra carta")]);
    const withSecond = {
      ...first,
      pages: first.pages.map((page, index) =>
        index === 0 ? { ...page, sections: [...page.sections, another] } : page,
      ),
    };
    const second = sectionToPage(withSecond as RetorikaDocument, "sec-prices-2", makeTeaser);
    expect(second.pages.map((page) => page.slug)).toEqual([
      "index",
      "nuestra-carta",
      "nuestra-carta-2",
    ]);
  });

  it.each([
    ["cover", "sec-cover"],
    ["footer", "sec-footer"],
    ["teaser", "sec-teaser"],
  ])("refuses to convert a %s section", (catalogId, sectionId) => {
    const doc = documentWith([
      section("sec-cover", "cover", [heading("el-cover", "Taberna")]),
      section("sec-footer", "footer", [body("el-name", "© Taberna", "businessName")]),
      makeTeaser({ sectionId: "sec-teaser", href: "./x.html", pageTitle: "X" }),
    ]);
    expect(() => sectionToPage(doc, sectionId, makeTeaser)).toThrow(
      new RegExp(`"${catalogId}" section cannot become a page`),
    );
  });

  it("throws for a section the document does not have", () => {
    expect(() => sectionToPage(base(), "sec-nope", makeTeaser)).toThrow(/no section "sec-nope"/);
  });

  it(`refuses to build page ${MAX_PAGES + 1}, where the download route would have refused it`, () => {
    let doc = base();
    for (let n = 0; n < MAX_PAGES - 1; n += 1) {
      const id = `sec-extra-${n}`;
      doc = {
        ...doc,
        pages: doc.pages.map((page, index) =>
          index === 0
            ? {
                ...page,
                sections: [
                  ...page.sections,
                  section(id, "prices", [heading(`el-${id}`, `Carta ${n}`)]),
                ],
              }
            : page,
        ),
      };
      doc = sectionToPage(doc, id, makeTeaser);
    }
    expect(doc.pages).toHaveLength(MAX_PAGES);

    const last = section("sec-last", "prices", [heading("el-last", "Una más")]);
    const full = {
      ...doc,
      pages: doc.pages.map((page, index) =>
        index === 0 ? { ...page, sections: [...page.sections, last] } : page,
      ),
    };
    expect(() => sectionToPage(full as RetorikaDocument, "sec-last", makeTeaser)).toThrow(
      /a site may have 5 pages/,
    );
  });

  it("mints a second avance id rather than colliding with the first", () => {
    const first = sectionToPage(base(), "sec-prices", makeTeaser);
    const another = section("sec-otra", "gallery", [heading("el-g", "Fotos de la casa")]);
    const withSecond = {
      ...first,
      pages: first.pages.map((page, index) =>
        index === 0 ? { ...page, sections: [...page.sections, another] } : page,
      ),
    };
    const second = sectionToPage(withSecond as RetorikaDocument, "sec-otra", makeTeaser);
    const teasers = second.pages[0]?.sections
      .filter((s) => s.preset.catalogId === "teaser")
      .map((s) => s.id);
    expect(teasers).toEqual(["sec-avance", "sec-avance-2"]);
  });
});

describe("pageToSection", () => {
  it("puts the section back where the avance was and removes both", () => {
    const converted = sectionToPage(base(), "sec-prices", makeTeaser);
    const back = pageToSection(converted, converted.pages[1]?.id ?? "");

    expect(back.pages).toHaveLength(1);
    expect(back.pages[0]?.sections.map((s) => s.id)).toEqual(["sec-cover", "sec-prices"]);
    expect(back.pages[0]?.sections[1]?.preset.catalogId).toBe("prices");
  });

  it("round-trips a document back to exactly what it was", () => {
    // The dossier's «se puede deshacer», as an equality rather than as a description.
    const before = base();
    const converted = sectionToPage(before, "sec-prices", makeTeaser);
    const back = pageToSection(converted, converted.pages[1]?.id ?? "");
    expect(back).toEqual(before);
  });

  it("brings back every section the owner added to the page, in order", () => {
    const converted = sectionToPage(base(), "sec-prices", makeTeaser);
    const grown = {
      ...converted,
      pages: converted.pages.map((page, index) =>
        index === 1
          ? {
              ...page,
              sections: [
                ...page.sections,
                section("sec-extra", "gallery", [heading("el-g", "Fotos")]),
              ],
            }
          : page,
      ),
    };
    const back = pageToSection(grown as RetorikaDocument, converted.pages[1]?.id ?? "");
    expect(back.pages[0]?.sections.map((s) => s.id)).toEqual([
      "sec-cover",
      "sec-prices",
      "sec-extra",
    ]);
  });

  it("refuses a page no avance points at, rather than choosing somewhere to put it", () => {
    // The owner may delete an avance and keep the page — that is a real state. Folding such a page
    // back has no answer the owner gave, so this says so instead of inventing one; `deletePage` is
    // the verb for getting rid of it.
    const converted = sectionToPage(base(), "sec-prices", makeTeaser);
    const orphaned = {
      ...converted,
      pages: converted.pages.map((page, index) =>
        index === 0
          ? { ...page, sections: page.sections.filter((s) => s.preset.catalogId !== "teaser") }
          : page,
      ),
    };
    expect(() => pageToSection(orphaned as RetorikaDocument, converted.pages[1]?.id ?? "")).toThrow(
      /nothing points at/,
    );
  });

  it("refuses the first page, which is the site's entry", () => {
    expect(() => pageToSection(base(), "home")).toThrow(/first page/);
  });

  it("throws for a page the document does not have", () => {
    expect(() => pageToSection(base(), "nope")).toThrow(/no page "nope"/);
  });

  it("does not touch the document it was given", () => {
    const converted = sectionToPage(base(), "sec-prices", makeTeaser);
    const snapshot = JSON.stringify(converted);
    pageToSection(converted, converted.pages[1]?.id ?? "");
    expect(JSON.stringify(converted)).toBe(snapshot);
  });
});

/**
 * The question the «Páginas» panel asks before it draws the button, which has to be the same
 * question the verb answers.
 *
 * Every one of these is written as an agreement rather than as an expected boolean: `canFoldPage`
 * is true exactly where `pageToSection` does not throw. A separate list of conditions in the editor
 * would pass its own tests on the day it was written and drift the first time one of them moved —
 * which is the shape of the `canBeBlank` duplication this sprint is about to go and fix elsewhere.
 */
describe("canFoldPage agrees with pageToSection", () => {
  /** True when the verb works, established by running it. */
  function verbAccepts(doc: RetorikaDocument, pageId: string): boolean {
    try {
      pageToSection(doc, pageId);
      return true;
    } catch {
      return false;
    }
  }

  function agree(doc: RetorikaDocument, pageId: string) {
    expect(canFoldPage(doc, pageId)).toBe(verbAccepts(doc, pageId));
  }

  it("agrees on a page a conversion made", () => {
    const converted = sectionToPage(base(), "sec-prices", makeTeaser);
    expect(canFoldPage(converted, converted.pages[1]?.id ?? "")).toBe(true);
    agree(converted, converted.pages[1]?.id ?? "");
  });

  it("agrees on the first page even when an avance points at it", () => {
    /**
     * Built by hand, because the verbs cannot produce it: `sectionToPage` never aims an avance at
     * the entry. Without it the first-page rule looks tested and is not — nothing points at `home`
     * in any document these tests build, so the teaser check alone would answer `false` and the
     * agreement would hold for the wrong reason. Deleting the rule from `foldsInto` turns this red
     * and nothing else, which is how it was checked.
     */
    const converted = sectionToPage(base(), "sec-prices", makeTeaser);
    const aimedAtHome = {
      ...converted,
      pages: converted.pages.map((page, index) =>
        index === 1
          ? {
              ...page,
              sections: [
                ...page.sections,
                section("sec-back", "teaser", [
                  {
                    id: "el-back",
                    role: "link",
                    hidden: false,
                    slot: "link",
                    value: { kind: "link", text: "Ver más", href: "./index.html" },
                  },
                ]),
              ],
            }
          : page,
      ),
    } as RetorikaDocument;

    expect(canFoldPage(aimedAtHome, "home")).toBe(false);
    agree(aimedAtHome, "home");
  });

  it("agrees on a page no avance points at", () => {
    // The state ADR 0022 explicitly allows: the owner deleted the avance and kept the page. The
    // button has to be gone, because the verb would refuse.
    const converted = sectionToPage(base(), "sec-prices", makeTeaser);
    const orphaned = {
      ...converted,
      pages: converted.pages.map((page, index) =>
        index === 0
          ? { ...page, sections: page.sections.filter((s) => s.preset.catalogId !== "teaser") }
          : page,
      ),
    } as RetorikaDocument;
    expect(canFoldPage(orphaned, converted.pages[1]?.id ?? "")).toBe(false);
    agree(orphaned, converted.pages[1]?.id ?? "");
  });

  it("answers false for a page the document does not have, where the verb throws", () => {
    // The one place the two do not have the same *shape* of answer: a predicate a panel calls
    // while rendering may not throw, so an unknown id is simply not foldable.
    expect(canFoldPage(base(), "nope")).toBe(false);
    expect(() => pageToSection(base(), "nope")).toThrow();
  });

  it("agrees on every page of a document with two conversions in it", () => {
    const first = sectionToPage(base(), "sec-prices", makeTeaser);
    const withSecond = {
      ...first,
      pages: first.pages.map((page, index) =>
        index === 0
          ? {
              ...page,
              sections: [
                ...page.sections,
                section("sec-team", "team", [heading("el-t", "Equipo")]),
              ],
            }
          : page,
      ),
    } as RetorikaDocument;
    const both = sectionToPage(withSecond, "sec-team", makeTeaser);
    for (const page of both.pages) agree(both, page.id);
    expect(both.pages.map((page) => canFoldPage(both, page.id))).toEqual([false, true, true]);
  });
});

/**
 * Where a folded page's sections come back to — which the editor needs in order to show them.
 *
 * The answer is not always the first page, and the case where it is not is reachable in three
 * presses: convert a section, open the page that made, convert a section of that.
 */
describe("foldsInto", () => {
  it("names the page holding the avance", () => {
    const converted = sectionToPage(base(), "sec-prices", makeTeaser);
    expect(foldsInto(converted, converted.pages[1]?.id ?? "")).toBe("home");
  });

  it("names the converted page, not the first, when the conversion happened on it", () => {
    // A page converted out of a page. Its avance sits on the first converted page, so that is
    // where its sections return — and a canvas that fell back to the first page would be showing
    // the owner somewhere their sections are not.
    const first = sectionToPage(base(), "sec-prices", makeTeaser);
    const firstPageId = first.pages[1]?.id ?? "";
    const withNested = {
      ...first,
      pages: first.pages.map((page, index) =>
        index === 1
          ? {
              ...page,
              sections: [
                ...page.sections,
                section("sec-wines", "prices", [heading("el-w", "Vinos")]),
              ],
            }
          : page,
      ),
    } as RetorikaDocument;
    const nested = sectionToPage(withNested, "sec-wines", makeTeaser);
    const nestedPageId = nested.pages.at(-1)?.id ?? "";

    expect(foldsInto(nested, nestedPageId)).toBe(firstPageId);
    expect(nested.pages[0]?.id).not.toBe(firstPageId);

    // And the verb agrees: the sections really do land there.
    const folded = pageToSection(nested, nestedPageId);
    expect(folded.pages.find((page) => page.id === firstPageId)?.sections.map((s) => s.id)).toEqual(
      ["sec-prices", "sec-wines"],
    );
  });

  it("is undefined exactly where the page cannot be folded", () => {
    expect(foldsInto(base(), "home")).toBeUndefined();
    expect(foldsInto(base(), "nope")).toBeUndefined();
  });
});
