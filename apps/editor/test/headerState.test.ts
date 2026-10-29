// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@retorika/renderer";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { headerStateFor } from "../src/editor/headerState.ts";

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
