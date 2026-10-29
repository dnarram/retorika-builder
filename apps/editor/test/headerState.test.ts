// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@retorika/renderer";
import { parseDocument, type RetorikaDocument, setHeader, setMenuLabel } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  headerStateFor,
  type MenuMode,
  menuModePatch,
  menuStatusText,
  sectionsMobilePatch,
} from "../src/editor/headerState.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * What the «Menú» panel says the header holds (sprint 30 día 3), held against what the renderer
 * actually draws — the panel must never describe a header the published page does not have.
 */

const FIXTURES = join(import.meta.dirname, "..", "..", "..", "fixtures", "documents");
const fixture = (name: string): RetorikaDocument =>
  parseDocument(JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")));

/** The entries the published page draws in the wide bar, per menu, by its landmark name. */
function drawn(doc: RetorikaDocument, pageId?: string) {
  const page = new DOMParser().parseFromString(
    render(doc, "html", pageId === undefined ? {} : { pageId }).html,
    "text/html",
  );
  const read = (selector: string) =>
    [...page.querySelectorAll(selector)].map((a) => a.textContent?.trim() ?? "");
  return {
    header: page.querySelector("header") !== null,
    pages: read('.rb-nav-wide nav[aria-label="Páginas"] a').filter((label) => label !== "Inicio"),
    sections: read(
      'nav[aria-label="Secciones"].rb-nav-row a, .rb-nav-wide nav[aria-label="Secciones"] a',
    ),
    action: page.querySelector(".rb-nav-action")?.textContent?.trim() ?? null,
  };
}

describe("headerStateFor", () => {
  it("says exactly what the page draws, menu by menu, on every page of a site with a header", () => {
    const doc = fixture("cabecera-con-marca");
    for (const page of doc.pages) {
      const state = headerStateFor(doc, page.id);
      const page_ = drawn(doc, page.id);
      expect(state.drawn).toBe(page_.header);
      expect(state.pages ?? []).toEqual(page_.pages);
      // The row and the wide bar are two copies of one list; the set of words is the menu's.
      expect(state.sections ?? []).toEqual([...new Set(page_.sections)]);
      expect(state.action).toBe(page_.action);
    }
  });

  it("names the brand, the button's words and whose sections these are", () => {
    const doc = fixture("cabecera-con-marca");
    const home = headerStateFor(doc, undefined);
    expect(home.brandName).toBe(true);
    expect(home.action).toBe("Contacto");
    expect(home.pageTitle).toBe(doc.pages[0]?.title);
    // The button's destination is not also in the menu: one destination, one place.
    expect(home.sections).not.toContain("Contacto");
  });

  it("says no menu is drawn where none is, and no header where there is none", () => {
    const silent = fixture("menu-explicito");
    expect(headerStateFor(silent, undefined).pages).toBeNull();
    expect(headerStateFor(silent, undefined).sections).toEqual(["Servicios", "Contacto"]);

    const bare = fixture("barbershop-cover");
    const state = headerStateFor(bare, undefined);
    expect(state.drawn).toBe(false);
    expect(drawn(bare).header).toBe(false);
  });
});

/**
 * Sprint 30 día 4: the numbers and sentences the panel's controls stand on, each held against the
 * page the renderer publishes — the panel's whole promise is that «se dibuja con 3 destinos» is
 * three links a visitor can press.
 */
const CORPUS = ["cabecera-con-marca", "menu-explicito", "menu-y-paginas", "menu-curado"];
const MODES: MenuMode[] = ["auto", "always", "never"];

function withModes(doc: RetorikaDocument, pages: MenuMode, sections: MenuMode): RetorikaDocument {
  const once = setHeader(doc, menuModePatch(doc, "pages", pages));
  return setHeader(once, menuModePatch(once, "sections", sections));
}

describe("each switch's count and state are the renderer's", () => {
  it("on every page of every menu fixture, under every pair of modes", () => {
    let checked = 0;
    for (const name of CORPUS) {
      const original = fixture(name);
      for (const pagesMode of MODES) {
        for (const sectionsMode of MODES) {
          const doc = withModes(original, pagesMode, sectionsMode);
          for (const page of doc.pages) {
            if (page.binding) continue;
            const state = headerStateFor(doc, page.id);
            const published = drawn(doc, page.id);
            expect(state.pagesMenu.mode).toBe(pagesMode);
            expect(state.sectionsMenu.mode).toBe(sectionsMode);
            expect(state.pagesMenu.drawn, `${name} ${page.id} pages`).toBe(
              published.pages.length > 0,
            );
            expect(state.sectionsMenu.drawn, `${name} ${page.id} sections`).toBe(
              published.sections.length > 0,
            );
            if (state.pagesMenu.drawn) expect(state.pagesMenu.count).toBe(published.pages.length);
            if (state.sectionsMenu.drawn) {
              expect(state.sectionsMenu.count).toBe(new Set(published.sections).size);
            }
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it("counts under «Siempre» what «Automático» would draw, so the number does not lie either way", () => {
    for (const name of CORPUS) {
      const doc = withModes(fixture(name), "always", "always");
      const state = headerStateFor(doc, undefined);
      const published = drawn(doc);
      expect(state.pagesMenu.count).toBe(published.pages.length);
      expect(state.sectionsMenu.count).toBe(new Set(published.sections).size);
    }
  });
});

describe("the sentences under the switches", () => {
  it("«Siempre» with nothing to show says there is nothing to show — and the page has no such nav", () => {
    // `menu-explicito` is one page: the pages menu has no destination at all.
    const doc = withModes(fixture("menu-explicito"), "always", "auto");
    const state = headerStateFor(doc, undefined);
    expect(state.pagesMenu).toMatchObject({ mode: "always", count: 0, drawn: false });
    expect(menuStatusText(state.pagesMenu, "pages")).toBe(es["editor.menuPanel.statusEmptyPages"]);
    expect(menuStatusText(state.pagesMenu, "pages")).toContain("No hay nada que mostrar");
    const page = new DOMParser().parseFromString(render(doc, "html").html, "text/html");
    expect(page.querySelector('nav[aria-label="Páginas"]')).toBeNull();
  });

  it("«Automático» says the number it draws with, and «Nunca» that it draws nothing", () => {
    const doc = fixture("menu-y-paginas");
    const auto = headerStateFor(doc, undefined).pagesMenu;
    expect(auto.mode).toBe("auto");
    expect(menuStatusText(auto, "pages")).toBe(
      auto.count === 1
        ? es["editor.menuPanel.statusAutoOne"]
        : es["editor.menuPanel.statusAuto"].replace("{n}", String(auto.count)),
    );
    const never = headerStateFor(withModes(doc, "never", "auto"), undefined).pagesMenu;
    expect(menuStatusText(never, "pages")).toBe(es["editor.menuPanel.statusNever"]);
  });

  it("«Automático» under the threshold says it is not drawn yet, with the threshold's number", () => {
    // `menu-explicito` without its `shown` keys: two destinations, nobody curated — under three.
    const explicit = fixture("menu-explicito");
    const { header: _, ...rest } = explicit;
    const doc = parseDocument(rest);
    const state = headerStateFor(doc, undefined);
    expect(state.sectionsMenu).toMatchObject({ mode: "auto", drawn: false });
    expect(menuStatusText(state.sectionsMenu, "sections")).toBe(
      es["editor.menuPanel.statusAutoNotYet"].replace("{min}", "3"),
    );
    expect(drawn(doc).sections).toEqual([]);
  });
});

describe("the patches the panel writes", () => {
  it("«Automático» chosen again leaves no trace of the menu in the document", () => {
    const doc = fixture("barbershop-cover");
    const always = setHeader(doc, menuModePatch(doc, "pages", "always"));
    expect(always.header).toEqual({ pages: { shown: true } });
    const back = setHeader(always, menuModePatch(always, "pages", "auto"));
    expect(back.header).toBeUndefined();
  });

  it("keeps the rest of `sections` when the switch or the phone row changes", () => {
    const doc = fixture("cabecera-con-marca");
    const never = setHeader(doc, menuModePatch(doc, "sections", "never"));
    expect(never.header?.sections).toEqual({ shown: false, row: "own", mobile: "row" });
    const hidden = setHeader(never, sectionsMobilePatch(never, "hidden"));
    expect(hidden.header?.sections).toEqual({ shown: false, row: "own", mobile: "hidden" });
  });
});

describe("the rows and the button", () => {
  it("lists every section with its switch or the reason it has none", () => {
    const state = headerStateFor(fixture("cabecera-con-marca"), undefined);
    const byId = Object.fromEntries(state.sectionRows.map((row) => [row.sectionId, row]));
    expect(byId["sec-cover"]).toMatchObject({ inMenu: null, reason: "cover", derived: undefined });
    expect(byId["sec-footer"]).toMatchObject({ inMenu: null, reason: "footer" });
    expect(byId["sec-avance"]).toMatchObject({ inMenu: null, reason: "teaser" });
    expect(byId["sec-services-home"]).toMatchObject({ inMenu: true, derived: "Servicios" });
    expect(byId["sec-contact"]).toMatchObject({ inMenu: true, inButton: true });
    // The section that opens a converted page carries its `<h1>`, and lends nothing for that.
    const converted = headerStateFor(fixture("cabecera-con-marca"), "page-que-ponemos");
    expect(converted.sectionRows[0]).toMatchObject({ inMenu: null, reason: "opens" });
  });

  it("gives the first page no switch, and the word an empty box goes back to", () => {
    const state = headerStateFor(fixture("cabecera-con-marca"), undefined);
    expect(state.pageRows[0]).toMatchObject({ inMenu: null, reason: "home", derived: "Inicio" });
    expect(state.pageRows[2]).toMatchObject({ own: "Dónde", derived: "Dónde estamos" });
  });

  it("an empty label goes back to the derived word, in the panel and on the page", () => {
    const doc = fixture("cabecera-con-marca");
    const cleared = setMenuLabel(doc, { kind: "page", pageId: "page-donde-estamos" }, "");
    expect(headerStateFor(cleared, undefined).pageRows[2]?.own).toBeUndefined();
    expect(drawn(cleared).pages).toContain("Dónde estamos");
    expect(drawn(doc).pages).toContain("Dónde");
  });

  it("offers the pages and this page's sections, and says when the button takes an entry out", () => {
    const doc = fixture("cabecera-con-marca");
    const state = headerStateFor(doc, undefined);
    expect(state.actionChoices.map((choice) => choice.key)).toEqual([
      "page:page-que-ponemos",
      "page:page-donde-estamos",
      "section:sec-services-home",
      "section:sec-contact",
    ]);
    expect(state.actionKey).toBe("section:sec-contact");
    expect(state.actionLeavesMenu).toBe(true);
    // With the sections menu off, the contact section was in no menu to leave.
    const off = setHeader(doc, menuModePatch(doc, "sections", "never"));
    expect(headerStateFor(off, undefined).actionLeavesMenu).toBe(false);
  });

  it("says the same of a page as the button, against the pages menu's own switch", () => {
    const doc = setHeader(fixture("cabecera-con-marca"), {
      action: { kind: "page", pageId: "page-donde-estamos" },
    });
    const state = headerStateFor(doc, undefined);
    expect(state.actionKey).toBe("page:page-donde-estamos");
    expect(state.pageRows[2]?.inButton).toBe(true);
    expect(state.actionLeavesMenu).toBe(true);
    expect(drawn(doc).pages).not.toContain("Dónde");
    const off = setHeader(doc, menuModePatch(doc, "pages", "never"));
    expect(headerStateFor(off, undefined).actionLeavesMenu).toBe(false);
  });

  it("still shows a button chosen on another page, with the page it is on", () => {
    const doc = fixture("cabecera-con-marca");
    const state = headerStateFor(doc, "page-donde-estamos");
    const chosen = state.actionChoices.find((choice) => choice.key === state.actionKey);
    expect(chosen).toMatchObject({ label: "Contacto", where: "Taberna Santo Domingo" });
  });
});
