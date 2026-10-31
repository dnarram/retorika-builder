// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@retorika/renderer";
import {
  HEADER_ALIGNMENTS,
  HEADER_BACKGROUNDS,
  HEADER_GAPS,
  HEADER_PARTS,
  HEADER_SIZES,
  listHeaderStyleExceptions,
  parseDocument,
  type RetorikaDocument,
  setHeader,
  setMenuLabel,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  brandNamePatch,
  brandWithPagesPatch,
  headerColorInForce,
  headerExact,
  headerStateFor,
  headerStylePatch,
  lookPatch,
  type MenuMode,
  menuModePatch,
  menuStatusText,
  pagesPositionPatch,
  SCHEME_TOKENS,
  schemeSwatch,
  sectionsMobilePatch,
  sectionsPositionPatch,
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

  it("names the logo and the bar it sits on, as the page draws them (ADR 0059)", () => {
    const doc = fixture("cabecera-con-marca");
    const state = headerStateFor(doc, undefined);
    expect(state.logoSrc).toBe("assets/logo.png");
    // The swatch's colour is the bar's: `surface` by default, resolved in this theme.
    expect(state.barBackground).toBe(doc.theme["color.surface"]);
    const page = new DOMParser().parseFromString(render(doc, "html").html, "text/html");
    expect(page.querySelector("img.rb-logo")?.getAttribute("src")).toBe(state.logoSrc);
    // Painted `ink`, the swatch follows.
    const dark = setHeader(doc, { look: { background: "ink" } });
    expect(headerStateFor(dark, undefined).barBackground).toBe(doc.theme["color.ink"]);
    expect(headerStateFor(fixture("menu-explicito"), undefined).logoSrc).toBeUndefined();
  });

  it("switches the name without touching the logo, and drops an emptied brand", () => {
    const doc = fixture("cabecera-con-marca");
    // The logo travels whole, its kept size included (sprint 30 día 7).
    const logo = { src: "assets/logo.png", width: 96, height: 96 };
    expect(brandNamePatch(doc, false)).toEqual({ brand: { logo } });
    const nameless = setHeader(doc, brandNamePatch(doc, false));
    expect(brandNamePatch(nameless, true)).toEqual({ brand: { logo, name: true } });
    const plain = setHeader(fixture("menu-explicito"), { brand: { name: true } });
    expect(brandNamePatch(plain, false)).toEqual({ brand: undefined });
    expect(setHeader(plain, brandNamePatch(plain, false)).header?.brand).toBeUndefined();
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
    expect(never.header?.sections).toEqual({ shown: false, position: "row", mobile: "row" });
    const hidden = setHeader(never, sectionsMobilePatch(never, "hidden"));
    expect(hidden.header?.sections).toEqual({ shown: false, position: "row", mobile: "hidden" });
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

/** The published page of `doc` as a DOM, and the text of its stylesheet. */
function published(doc: RetorikaDocument, pageId?: string) {
  const page = new DOMParser().parseFromString(
    render(doc, "html", pageId === undefined ? {} : { pageId }).html,
    "text/html",
  );
  const css = [...page.querySelectorAll("style")]
    .map((style) => style.textContent ?? "")
    .join("\n");
  const header = page.querySelector("header.rb-header");
  if (!header) throw new Error("published: the page draws no header");
  return { page, css, header };
}

/** The declarations of the stylesheet rule whose selector is exactly `selector`, joined. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return "";
  return css.slice(start, css.indexOf("}", start));
}

describe("the look (sprint 30 día 6): every option reaches the published page", () => {
  const doc = fixture("cabecera-con-marca");
  const options = [
    ...HEADER_BACKGROUNDS.map((background) => ({
      attribute: "data-bg",
      value: background,
      look: { background },
    })),
    ...HEADER_ALIGNMENTS.map((align) => ({
      attribute: "data-align",
      value: align,
      look: { align },
    })),
    ...HEADER_GAPS.map((gap) => ({ attribute: "data-gap", value: gap, look: { gap } })),
    ...HEADER_SIZES.map((size) => ({ attribute: "data-size", value: size, look: { size } })),
  ];

  it.each(options)(
    "$attribute=$value: the panel's state, the attribute and a rule for it",
    ({ attribute, value, look }) => {
      const chosen = setHeader(doc, lookPatch(doc, look));
      const state = headerStateFor(chosen, undefined);
      const { css, header } = published(chosen);
      // What the panel shows as chosen is what the page carries…
      expect(Object.values(state.look)).toContain(value);
      expect(header.getAttribute(attribute)).toBe(value);
      // …and the stylesheet acts on it — except on the two values that are the base rules
      // themselves: the `surface` bar and the `md` gap are `.rb-header` and `.rb-nav` unadorned.
      if (
        !(attribute === "data-bg" && value === "surface") &&
        !(attribute === "data-gap" && value === "md") &&
        !(attribute === "data-size" && value === "body")
      ) {
        expect(css).toContain(`[${attribute}=${value}]`);
      }
    },
  );

  it.each([
    ["uppercase", "data-uppercase", "text-transform: uppercase"],
    ["hoverUnderline", "data-hover", "text-decoration: underline"],
  ] as const)(
    "«%s» writes its attribute, and its rule says what the switch says",
    (key, attribute, declaration) => {
      const on = setHeader(doc, lookPatch(doc, { [key]: true }));
      expect(headerStateFor(on, undefined).look[key]).toBe(true);
      const { css, header } = published(on);
      expect(header.hasAttribute(attribute)).toBe(true);
      const selectorAt = css.indexOf(`.rb-header[${attribute}]`);
      expect(selectorAt).toBeGreaterThan(-1);
      expect(css.slice(selectorAt, css.indexOf("}", selectorAt))).toContain(declaration);
      // Off again leaves the document as it was: no `false`, and no empty `look`.
      const off = setHeader(on, lookPatch(on, { [key]: false }));
      expect(off.header).toEqual(doc.header);
      expect(published(off).header.hasAttribute(attribute)).toBe(false);
    },
  );

  it("the swatches are the renderer's pairs: each scheme's bar and words, read off its stylesheet", () => {
    const { css } = published(doc);
    for (const background of HEADER_BACKGROUNDS) {
      const tokens = SCHEME_TOKENS[background];
      const bar = tokens.bar.replace("color.", "--color-");
      const text = tokens.text.replace("color.", "--color-");
      if (background === "surface") {
        expect(rule(css, ".rb-header")).toContain(`background: var(${bar})`);
        expect(rule(css, ".rb-nav a")).toContain(`color: var(${text})`);
      } else if (background === "transparent") {
        // Nothing of its own: the page's surface shows through, and its words are the base ones.
        expect(rule(css, ".rb-header[data-bg=transparent]")).toContain("background: transparent");
        expect(rule(css, ".rb-brand")).toContain(`color: var(${text})`);
      } else {
        expect(rule(css, `.rb-header[data-bg=${background}]`)).toContain(`background: var(${bar})`);
        const coloured = css.indexOf(
          ":is(.rb-brand, .rb-nav a, .rb-nav-narrow > summary) { color:",
        );
        expect(css.slice(coloured, css.indexOf("}", coloured))).toContain(`var(${text})`);
      }
      const swatch = schemeSwatch(doc, background);
      expect(swatch).toEqual({ bar: doc.theme[tokens.bar], text: doc.theme[tokens.text] });
    }
  });

  it("«Secciones en su propia fila» is the page's `data-sections`, and keeps the rest of `sections`", () => {
    const bar = setHeader(doc, sectionsPositionPatch(doc, "bar"));
    expect(headerStateFor(bar, undefined).sectionsPosition).toBe("bar");
    expect(published(bar).header.getAttribute("data-sections")).toBe("bar");
    // Back to the bar drops the key rather than writing it: absent is the bar (ADR 0060).
    const { position: _, ...rest } = doc.header?.sections ?? {};
    expect(bar.header?.sections).toEqual(rest);
    const row = setHeader(bar, sectionsPositionPatch(bar, "row"));
    expect(published(row).header.getAttribute("data-sections")).toBe("row");
    expect(row.header?.sections).toEqual({ ...rest, position: "row" });
  });

  it("places the pages menu in a rail with the brand, and undoing both leaves the document as it was", () => {
    const left = setHeader(doc, pagesPositionPatch(doc, "left"));
    expect(left.header?.pages).toEqual({ ...doc.header?.pages, position: "left" });
    const withBrand = setHeader(left, brandWithPagesPatch(true));
    const state = headerStateFor(withBrand, undefined);
    expect([state.pagesPosition, state.brandWithPages]).toEqual(["left", true]);
    expect(published(withBrand).header.getAttribute("data-pages")).toBe("left");
    expect(published(withBrand).header.getAttribute("data-brand")).toBe("pages");
    const undone = setHeader(
      setHeader(withBrand, brandWithPagesPatch(false)),
      pagesPositionPatch(withBrand, "bar"),
    );
    expect(undone.header).toEqual(doc.header);
    // And a menu object left with nothing in it goes with its last key.
    const bare = fixture("barbershop-cover");
    const there = setHeader(bare, pagesPositionPatch(bare, "right"));
    expect(there.header).toEqual({ pages: { position: "right" } });
    expect(setHeader(there, pagesPositionPatch(there, "bar")).header).toBeUndefined();
  });
});

describe("the exact values behind the switch (sprint 30 día 6)", () => {
  const doc = fixture("cabecera-con-marca");

  it("offers exactly the parts the page draws", () => {
    for (const page of doc.pages) {
      const state = headerStateFor(doc, page.id);
      const { header } = published(doc, page.id);
      const drawnParts = new Set(
        [...header.querySelectorAll("[data-part]")]
          // A nav that is drawn with no entry in it offers nothing to colour.
          .filter((node) => node.querySelector("a") !== null || node.tagName !== "NAV")
          .map((node) => node.getAttribute("data-part")),
      );
      expect(state.parts).toEqual(
        HEADER_PARTS.filter((part) => part === "bar" || drawnParts.has(part)),
      );
    }
  });

  it("writes a marked exception the page paints, and «Volver al sistema» leaves no trace", () => {
    const colored = setHeader(doc, headerStylePatch(doc, "action", "color", "#123456"));
    const sized = setHeader(colored, headerStylePatch(colored, "action", "fontSize", "19px"));
    expect(headerExact(sized, "action", "color")).toBe("#123456");
    expect(listHeaderStyleExceptions(sized)).toEqual([
      { part: "action", property: "color", exact: "#123456" },
      { part: "action", property: "fontSize", exact: "19px" },
    ]);
    const { css } = published(sized);
    const own = rule(css, ".rb-header[data-layout] [data-part=action]");
    expect(own).toContain("#123456");
    expect(own).toContain("19px");
    // One property back, then the whole part in one step.
    const oneBack = setHeader(sized, headerStylePatch(sized, "action", "fontSize", undefined));
    expect(listHeaderStyleExceptions(oneBack)).toHaveLength(1);
    const back = setHeader(sized, headerStylePatch(sized, "action", undefined, undefined));
    expect(back.header).toEqual(doc.header);
  });

  it("starts each colour input from the colour in force, never from black", () => {
    expect(headerColorInForce(doc, "bar")).toBe(doc.theme["color.surface"]);
    expect(headerColorInForce(doc, "brand")).toBe(doc.theme["color.primary"]);
    expect(headerColorInForce(doc, "action")).toBe(doc.theme["color.surface"]);
    const ink = setHeader(doc, lookPatch(doc, { background: "ink" }));
    expect(headerColorInForce(ink, "bar")).toBe(doc.theme["color.ink"]);
    expect(headerColorInForce(ink, "pagesLinks")).toBe(doc.theme["color.surface"]);
    // On a coloured bar the button inverts: surface, with primary words.
    expect(headerColorInForce(ink, "action")).toBe(doc.theme["color.primary"]);
    const exact = setHeader(ink, headerStylePatch(ink, "bar", "color", "#abcdef"));
    expect(headerColorInForce(exact, "bar")).toBe("#abcdef");
  });
});
