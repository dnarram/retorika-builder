import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasMenu, MENU_MIN_ENTRIES, pageMenuEntries, sectionMenuEntries } from "@retorika/renderer";
import { parseDocument, type RetorikaDocument, setHeader } from "@retorika/schema";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  headerStateFor,
  menuLineFor,
  menuStatusText,
  rowReasonText,
} from "../src/editor/headerState.ts";
import es from "../src/locales/es.json" with { type: "json" };
import { FieldsPanel } from "../src/questionnaire/FieldsPanel.tsx";
import { MenuPanel, menuRowKey } from "../src/questionnaire/MenuPanel.tsx";
import { PagesPanel } from "../src/questionnaire/PagesPanel.tsx";

/**
 * **The one switch, and the two doors to it** (sprint 39 día 1, ADR 0078).
 *
 * Until this day a page's «aparece en el menú» was a checkbox in «Páginas» and another in «Menú», and
 * a section's one in «Campos» and another in «Menú»: three visible controls writing two keys. The
 * switch lives in «Menú» now; «Páginas» and «Campos» read its state in a line and open «Menú» at the
 * row with a door. What these hold: the line says what the row says (one reader, `headerStateFor`);
 * the door's verb promises only what the row can keep («Cambiar» where a switch waits, «Ver en
 * «Menú»» where only a reason does); and the row the door lands on is always something — a switch, or
 * a row that can take the focus itself, with its reason beside it (David's adjustment 1).
 *
 * Rendered to markup on the server's path, as `panelKit.test.ts` renders the pieces: the effect
 * that moves the focus does not run here, and the browser walk is what measures where it lands.
 */

const FIXTURES = join(import.meta.dirname, "..", "..", "..", "fixtures", "documents");
const fixture = (name: string): RetorikaDocument =>
  parseDocument(JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")));

const noop = () => {};

describe("the line each row reads, from the same object «Menú» draws its rows from", () => {
  const doc = fixture("cabecera-con-marca");
  const state = headerStateFor(doc, "page-que-ponemos");
  const page = (id: string) => state.pageRows.find((row) => row.pageId === id);
  const section = (id: string) => state.sectionRows.find((row) => row.sectionId === id);

  it("says «En el menú» for a page with a switch that is on, and offers to change it", () => {
    expect(menuLineFor(page("page-donde-estamos") as never)).toEqual({
      text: es["editor.menu.line.in"],
      door: "change",
    });
  });

  it("says «Fuera del menú» once the switch is off", () => {
    const out = setHeader(doc, {});
    const page_ = out.pages.find((candidate) => candidate.id === "page-donde-estamos");
    if (page_) page_.inMenu = false;
    const row = headerStateFor(out, undefined).pageRows.find(
      (candidate) => candidate.pageId === "page-donde-estamos",
    );
    expect(menuLineFor(row as never)).toEqual({ text: es["editor.menu.line.out"], door: "change" });
  });

  it("says the reason for a row with no switch, and offers only to see it", () => {
    const home = page("home");
    expect(home?.inMenu).toBeNull();
    expect(menuLineFor(home as never)).toEqual({
      text: es["editor.menuPanel.reason.home"],
      door: "see",
    });
    const cover = headerStateFor(doc, undefined).sectionRows.find(
      (row) => row.sectionId === "sec-cover",
    );
    expect(menuLineFor(cover as never)).toEqual({
      text: es["editor.menuPanel.reason.cover"],
      door: "see",
    });
    expect(rowReasonText(cover as never)).toBe(es["editor.menuPanel.reason.cover"]);
    // The section that opens its page carries the page's `<h1>`: it lends no entry there.
    expect(rowReasonText(section("sec-services") as never)).toBe(
      es["editor.menuPanel.reason.opens"],
    );
  });

  it("reads a section by the words the menu uses — the owner's own label first", () => {
    const services = headerStateFor(doc, undefined).sectionRows.find(
      (row) => row.sectionId === "sec-services-home",
    );
    expect(services?.derived).toBeDefined();
    expect(menuLineFor(services as never)).toEqual({
      text: es["editor.menu.as"].replace("{label}", services?.derived ?? ""),
      door: "change",
    });
    // An owner's own word wins over the derived one.
    expect(menuLineFor({ ...services, own: "Carta" } as never).text).toBe(
      es["editor.menu.as"].replace("{label}", "Carta"),
    );
  });

  it("says the button holds a destination the menu leaves out, with the switch still there", () => {
    const contact = headerStateFor(doc, undefined).sectionRows.find(
      (row) => row.sectionId === "sec-contact",
    );
    expect(contact?.inButton).toBe(true);
    expect(contact?.inMenu).not.toBeNull();
    expect(menuLineFor(contact as never)).toEqual({
      text: es["editor.menuPanel.inButton"],
      door: "change",
    });
  });
});

describe("a menu drawn under the threshold is named as the owner's (ADR 0043 §5)", () => {
  it("says so under «Automático», with the renderer's own count", () => {
    const doc = fixture("menu-curado");
    const home = doc.pages[0];
    const destinations = pageMenuEntries(doc).length + (home ? sectionMenuEntries(home).length : 0);
    expect(destinations).toBeLessThan(MENU_MIN_ENTRIES);
    expect(hasMenu(doc)).toBe(true);
    const state = headerStateFor(doc, undefined);
    expect(state.pagesMenu.belowThreshold).toBe(true);
    expect(menuStatusText(state.pagesMenu, "pages")).toBe(
      es["editor.menuPanel.statusAutoYoursOne"].replace("{min}", String(MENU_MIN_ENTRIES)),
    );
    // The owner's word silences the threshold: «Siempre» says only the count.
    const always = setHeader(doc, { pages: { shown: true } });
    const said = headerStateFor(always, undefined).pagesMenu;
    expect(said.belowThreshold).toBe(false);
    expect(menuStatusText(said, "pages")).toBe(es["editor.menuPanel.statusAlwaysOne"]);
  });

  it("says nothing of the kind over the threshold", () => {
    const state = headerStateFor(fixture("cabecera-con-marca"), undefined);
    expect(state.pagesMenu.belowThreshold).toBe(false);
    expect(menuStatusText(state.pagesMenu, "pages")).not.toContain("decidido");
  });
});

describe("«Páginas» reads the switch and opens the door, and draws no switch of its own", () => {
  const doc = fixture("cabecera-con-marca");
  const html = renderToStaticMarkup(
    createElement(PagesPanel, {
      document: doc,
      currentPageId: undefined,
      onSelectPage: noop,
      onRenamePage: noop,
      onMovePage: noop,
      onDeletePage: noop,
      onPageToSection: noop,
      onOpenMenuFor: noop,
      canFold: () => false,
      linksTo: () => 0,
      entryShown: () => undefined,
      onPreviewEntry: noop,
      onClose: noop,
    }),
  );

  it("has no checkbox left", () => {
    expect(html).not.toContain('type="checkbox"');
  });

  it("gives each page with a switch its line and «Cambiar», named for that page", () => {
    expect(html).toContain(es["editor.menu.line.in"]);
    expect(html).toContain(
      `aria-label="${es["editor.menu.door.changeLabel"].replace("{name}", "Qué ponemos")}"`,
    );
    expect(html).toContain(`>${es["editor.menu.door.change"]}</button>`);
  });

  it("gives Inicio its reason and a door that only promises to see", () => {
    expect(html).toContain(es["editor.menuPanel.reason.home"]);
    expect(html).toContain(
      `aria-label="${es["editor.menu.door.seeLabel"].replace("{name}", "Taberna Santo Domingo")}"`,
    );
    expect(html).toContain(`>${es["editor.menu.door.see"]}</button>`);
  });

  it("no longer counts what the menu has left: that sentence lives with the switch", () => {
    expect(html).not.toContain("quedan");
    expect(html).not.toContain("decidido tú");
  });
});

describe("«Campos» reads the switch and opens the door", () => {
  const doc = fixture("cabecera-con-marca");
  const rows = headerStateFor(doc, "home").sectionRows;
  const render = (sectionId: string, pageId: string) =>
    renderToStaticMarkup(
      createElement(FieldsPanel, {
        sectionName: "Servicios",
        rows: [],
        slotOrder: [],
        itemSlotOrder: [],
        sectionId,
        onFill: noop,
        onClear: noop,
        onEditText: noop,
        onClose: noop,
        menuRow: headerStateFor(doc, pageId).sectionRows.find((row) => row.sectionId === sectionId),
        onOpenMenuFor: noop,
      }),
    );

  it("says what the menu reads the section as, with «Cambiar» named for it", () => {
    const services = rows.find((row) => row.sectionId === "sec-services-home");
    expect(services?.derived).toBeDefined();
    const html = render("sec-services-home", "home");
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain(es["editor.menu.as"].replace("{label}", services?.derived ?? ""));
    expect(html).toContain(
      `aria-label="${es["editor.menu.door.changeLabel"].replace("{name}", services?.name ?? "")}"`,
    );
  });

  it("says why the cover lends no entry, and offers only to see it", () => {
    const html = render("sec-cover", "home");
    expect(html).toContain(es["editor.menuPanel.reason.cover"]);
    expect(html).toContain(`>${es["editor.menu.door.see"]}</button>`);
  });

  it("draws no block for a section «Menú» does not list", () => {
    const html = render("sec-nowhere", "home");
    expect(html).not.toContain(es["editor.menu.door.see"]);
    expect(html).not.toContain(es["editor.menu.door.change"]);
  });
});

describe("«Menú» names every row for the door, and a row without a switch can take the focus", () => {
  const doc = fixture("cabecera-con-marca");
  const html = renderToStaticMarkup(
    createElement(MenuPanel, {
      doc,
      pageId: undefined,
      layoutWidth: 1280,
      device: "desktop",
      logoUrl: undefined,
      logoFaint: false,
      designTools: false,
      onChangeLogo: noop,
      onRemoveLogo: noop,
      onSetHeader: noop,
      onSetHeaderAction: noop,
      onSetMenuLabel: noop,
      onSetPageInMenu: noop,
      onSetSectionInMenu: noop,
      onClose: noop,
    }),
  );
  const row = (key: string): string => {
    const at = html.indexOf(`data-menu-row="${key}"`);
    expect(at, key).toBeGreaterThan(-1);
    const start = html.lastIndexOf("<li", at);
    return html.slice(start, html.indexOf("</li>", at));
  };

  it("keys a page's row and a section's row by what the door asks for", () => {
    expect(menuRowKey({ block: "page", pageId: "page-que-ponemos" })).toBe("page:page-que-ponemos");
    expect(menuRowKey({ block: "section", sectionId: "sec-cover" })).toBe("section:sec-cover");
    expect(row("page:page-que-ponemos")).toContain('type="checkbox"');
    expect(row("section:sec-services-home")).toContain('type="checkbox"');
  });

  it("makes a row with no switch focusable by script, never by Tab, with its reason inside", () => {
    const home = row("page:home");
    expect(home).toMatch(/^<li[^>]*tabindex="-1"/);
    expect(home).not.toContain('type="checkbox"');
    expect(home).toContain(es["editor.menuPanel.reason.home"]);
    const cover = row("section:sec-cover");
    expect(cover).toMatch(/^<li[^>]*tabindex="-1"/);
    expect(cover).toContain(es["editor.menuPanel.reason.cover"]);
  });

  it("leaves a row with a switch out of the Tab order itself: the switch is the stop", () => {
    expect(row("page:page-que-ponemos")).not.toMatch(/^<li[^>]*tabindex/);
  });
});
