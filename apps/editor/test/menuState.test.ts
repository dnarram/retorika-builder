import { render } from "@retorika/renderer";
import type { RetorikaDocument, Section, Theme } from "@retorika/schema";
import { TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  type MenuState,
  menuNoteText,
  menuStateFor,
  pagesLeftText,
  sectionsLeftText,
} from "../src/editor/menuState.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * What the editor tells the owner about their menu while they are deciding it (ADR 0043 §5).
 *
 * The one property this file exists for is the last test: **the editor never says a menu is drawn
 * when the published page has none.** Every number here is asked of the renderer, and that test is
 * what proves the asking actually happened rather than a second copy of the rule being maintained
 * in the editor until it drifted.
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

function documentWith(
  homeSections: Section[],
  pages: { id: string; slug: string; title: string; sections?: Section[]; inMenu?: boolean }[] = [],
): RetorikaDocument {
  return {
    schemaVersion: "1.10.0",
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

/** Cover plus three headed sections: three destinations, so a menu without anybody deciding. */
const threeSections = () =>
  documentWith([
    section("sec-cover", "cover", "Taberna Santo Domingo"),
    section("sec-services", "services", "Qué ponemos"),
    section("sec-location", "location", "Dónde estamos"),
    section("sec-contact", "contact", "Te esperamos"),
  ]);

describe("the counts", () => {
  it("counts the sections of the page being edited, not the home page's", () => {
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        section("sec-services", "services", "Qué ponemos"),
        section("sec-location", "location", "Dónde estamos"),
      ],
      [
        {
          id: "p2",
          slug: "carta",
          title: "Nuestra carta",
          sections: [
            section("sec-carta", "prices", "Nuestra carta"),
            section("sec-extra", "services", "Para llevar"),
          ],
        },
      ],
    );
    // Home has two anchors; the other page has one, because its own heading carries the h1.
    expect(menuStateFor(doc, "home").sections).toBe(2);
    expect(menuStateFor(doc, "p2").sections).toBe(1);
  });

  it("falls back to the home page when no page is open", () => {
    expect(menuStateFor(threeSections(), undefined).sections).toBe(3);
    // The button's destination is out of the count, as it is out of the strip (ADR 0057 §5; a
    // generated site is born this way since ADR 0059). The threshold's count keeps it.
    const doc = threeSections();
    const target = doc.pages[0]?.sections.find((s) => s.preset.catalogId !== "cover");
    if (!target) throw new Error("no section to point the button at");
    const withButton = menuStateFor(
      { ...doc, header: { action: { kind: "section", sectionId: target.id } } },
      undefined,
    );
    expect(withButton.sections).toBe(2);
    expect(withButton.destinations).toBe(3);
  });

  it("counts the pages menu without «Inicio», which is a way back and not an entry", () => {
    const doc = documentWith(
      [section("sec-cover", "cover", "Taberna")],
      [{ id: "p2", slug: "carta", title: "Nuestra carta" }],
    );
    expect(menuStateFor(doc, "p2").pages).toBe(1);
  });

  /**
   * **The threshold counts the home page's menus even while the owner stands elsewhere**, because
   * whether a menu is drawn is one answer for the whole site. So `destinations` can differ from
   * `sections + pages`, and the sentence that uses it says «tu web», not «esta página».
   */
  it("counts the threshold on the home page whatever page is open", () => {
    const doc = documentWith(
      [
        section("sec-cover", "cover", "Taberna"),
        section("sec-services", "services", "Qué ponemos"),
        section("sec-location", "location", "Dónde estamos"),
      ],
      [{ id: "p2", slug: "carta", title: "Nuestra carta" }],
    );
    const onOtherPage = menuStateFor(doc, "p2");
    expect(onOtherPage.sections).toBe(0);
    expect(onOtherPage.pages).toBe(1);
    expect(onOtherPage.destinations).toBe(3);
  });
});

describe("the one sentence beyond the count", () => {
  it("says nothing when the site is over the threshold", () => {
    const state = menuStateFor(threeSections(), "home");
    expect(state.note).toBe("none");
    expect(menuNoteText(state, "sections")).toBeUndefined();
  });

  it("says the menu is not drawn yet when nobody has decided and it is short", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      section("sec-services", "services", "Qué ponemos"),
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    const state = menuStateFor(doc, "home");
    expect(state).toMatchObject({ destinations: 2, curated: false, drawn: false, note: "notYet" });
    expect(menuNoteText(state, "sections")).toBe(
      es["editor.menu.notYet"].replace("{n}", "2").replace("{min}", "3"),
    );
  });

  /**
   * **The sentence David asked for**: when the owner's own decision keeps a menu under three, the
   * interface says it is theirs instead of leaving a site that behaves unlike every other one with
   * no explanation of why.
   */
  it("names the owner's decision when a short menu is drawn because of it", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      { ...section("sec-services", "services", "Qué ponemos"), inMenu: false },
      section("sec-location", "location", "Dónde estamos"),
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    const state = menuStateFor(doc, "home");
    expect(state).toMatchObject({ destinations: 2, curated: true, drawn: true, note: "yours" });
    expect(menuNoteText(state, "sections")).toContain("lo has decidido tú");
  });

  it("uses the singular where only one link is left", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      { ...section("sec-services", "services", "Qué ponemos"), inMenu: false },
      section("sec-contact", "contact", "Te esperamos"),
    ]);
    const state = menuStateFor(doc, "home");
    expect(state.destinations).toBe(1);
    expect(menuNoteText(state, "sections")).toBe(es["editor.menu.yoursOne"].replace("{min}", "3"));
  });

  it("says there is no menu at all when nothing is left", () => {
    const doc = documentWith([
      section("sec-cover", "cover", "Taberna"),
      { ...section("sec-services", "services", "Qué ponemos"), inMenu: false },
    ]);
    const state = menuStateFor(doc, "home");
    expect(state).toMatchObject({ destinations: 0, drawn: false, note: "gone" });
    expect(menuNoteText(state, "sections")).toBe(es["editor.menu.gone"]);
  });
});

/**
 * **The fourth clause** (ADR 0057, sprint 30 día 4): once the owner chose «Siempre» or «Nunca» for a
 * menu in «Menú», the threshold no longer decides it, and the sentence beside the switch in «Campos»
 * or «Páginas» must stop counting towards it — each panel asked about its own menu.
 */
describe("the owner's word in «Menú» overrides the sentence about the threshold", () => {
  const short = () =>
    documentWith([
      section("sec-cover", "cover", "Taberna"),
      section("sec-services", "services", "Qué ponemos"),
      section("sec-contact", "contact", "Te esperamos"),
    ]);

  it("«Siempre» on a short menu says nothing more than the count, and the page has it", () => {
    const doc = { ...short(), header: { sections: { shown: true } } };
    const state = menuStateFor(doc, "home");
    // The threshold's own reading is unchanged — it is just no longer what the panel says.
    expect(state.note).toBe("notYet");
    expect(menuNoteText(state, "sections")).toBeUndefined();
    expect(render(doc, "html").html).toContain('aria-label="Secciones"');
    // The other menu is still «Automático», so its panel still speaks of the threshold.
    expect(menuNoteText(state, "pages")).toBe(
      es["editor.menu.notYet"].replace("{n}", "2").replace("{min}", "3"),
    );
  });

  it("«Nunca» says the switch beside it changes nothing a visitor sees", () => {
    const doc = { ...threeSections(), header: { pages: { shown: false } } };
    const state = menuStateFor(doc, "home");
    expect(menuNoteText(state, "pages")).toBe(es["editor.menu.off"]);
    expect(menuNoteText(state, "sections")).toBeUndefined();
  });

  it("«Siempre» with nothing left says it draws nothing all the same", () => {
    const doc = {
      ...documentWith([
        section("sec-cover", "cover", "Taberna"),
        { ...section("sec-services", "services", "Qué ponemos"), inMenu: false },
      ]),
      header: { sections: { shown: true } },
    };
    const state = menuStateFor(doc, "home");
    expect(menuNoteText(state, "sections")).toBe(es["editor.menu.emptyAlways"]);
    expect(render(doc, "html").html).not.toContain('aria-label="Secciones"');
  });
});

describe("the counts in words", () => {
  it("agrees in number, which is why there are three keys and not one", () => {
    // A whole state rather than a cast of two fields: the sentences read one number each today,
    // and a cast would hand them `undefined` for the rest the day one of them reads a second.
    const base = menuStateFor(threeSections(), "home");
    const of = (sections: number, pages: number): MenuState => ({ ...base, sections, pages });
    expect(sectionsLeftText(of(0, 0))).toBe(es["editor.menu.sectionsLeftNone"]);
    expect(sectionsLeftText(of(1, 0))).toBe(es["editor.menu.sectionsLeftOne"]);
    expect(sectionsLeftText(of(4, 0))).toBe(es["editor.menu.sectionsLeft"].replace("{n}", "4"));
    expect(pagesLeftText(of(0, 0))).toBe(es["editor.menu.pagesLeftNone"]);
    expect(pagesLeftText(of(0, 1))).toBe(es["editor.menu.pagesLeftOne"]);
    expect(pagesLeftText(of(0, 2))).toBe(es["editor.menu.pagesLeft"].replace("{n}", "2"));
  });
});

/**
 * **The promise this file is here to keep** — David's words on approving the day: «Nada de interfaz
 * que prometa más de lo que hay.»
 *
 * `drawn` is compared against the published page itself rather than against a restatement of the
 * rule. The rule has three clauses in a particular order now, and an editor holding its own copy
 * would go on saying «your site shows a menu» after the renderer stopped drawing one.
 */
describe("what the editor says against what the page publishes", () => {
  const cases: [string, RetorikaDocument][] = [
    ["three sections, nobody has decided", threeSections()],
    [
      "two sections, nobody has decided",
      documentWith([
        section("sec-cover", "cover", "Taberna"),
        section("sec-services", "services", "Qué ponemos"),
        section("sec-contact", "contact", "Te esperamos"),
      ]),
    ],
    [
      "one left, and the owner decided",
      documentWith([
        section("sec-cover", "cover", "Taberna"),
        { ...section("sec-services", "services", "Qué ponemos"), inMenu: false },
        section("sec-contact", "contact", "Te esperamos"),
      ]),
    ],
    [
      "nothing left at all",
      documentWith([
        section("sec-cover", "cover", "Taberna"),
        { ...section("sec-services", "services", "Qué ponemos"), inMenu: false },
      ]),
    ],
    [
      "only the pages menu, and a page taken out of it",
      documentWith(
        [
          section("sec-cover", "cover", "Taberna"),
          section("sec-services", "services", "Qué ponemos"),
          section("sec-location", "location", "Dónde estamos"),
        ],
        [{ id: "p2", slug: "carta", title: "Nuestra carta", inMenu: false }],
      ),
    ],
  ];

  for (const [name, doc] of cases) {
    it(`agrees with the published home page: ${name}`, () => {
      const published = render(doc, "html").html.includes("<nav");
      expect(menuStateFor(doc, "home").drawn).toBe(published);
    });
  }
});
