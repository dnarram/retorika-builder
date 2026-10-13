import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { menuEntries } from "../src/menu.ts";
import { DOCUMENTS_DIR } from "./corpus.ts";

/**
 * «Una página por ficha», drawn (ADR 0040).
 *
 * The claim this file holds, beside `collections.test.ts`'s: **a page bound to a collection is
 * stored once and drawn once per entry, and the drawn page knows nothing about the collection.**
 * The fixture has twelve entries — `PRICES_LINES`' maximum, which is the most a page per entry can
 * ever become — a bound page whose leaves read them, and a hand-written link to one entry's file.
 */

const doc = () =>
  parseDocument(JSON.parse(readFileSync(join(DOCUMENTS_DIR, "una-pagina-por-ficha.json"), "utf8")));

const FICHA = "page-ficha-carta";

describe("a page drawn per entry", () => {
  it("draws the first entry when no entry is named, and the named one otherwise", () => {
    const first = render(doc(), "html", { pageId: FICHA }).html;
    expect(first).toContain("<h1");
    expect(first).toContain("Ensaladilla rusa");
    expect(first).toContain("huevo y mayonesa casera.");
    expect(first).not.toContain("Tortilla de patatas");

    const named = render(doc(), "html", { pageId: FICHA, entryId: "entry-5" }).html;
    expect(named).toContain("Pulpo a la gallega");
    expect(named).not.toContain("Ensaladilla rusa");
  });

  it("titles the page by the entry's title field, the way every page after the first is titled", () => {
    const { html } = render(doc(), "html", { pageId: FICHA, entryId: "entry-10" });
    expect(html).toContain("<title>Jamón ibérico — Taberna del Puerto</title>");
  });

  it("splits a bound text's marks on the page through the one path every text takes", () => {
    const { html } = render(doc(), "html", { pageId: FICHA });
    expect(html).toContain("<strong>Con atún</strong>, huevo y mayonesa casera.");
  });

  it("refuses an entry the collection does not carry, and an entry on an ordinary page", () => {
    expect(() => render(doc(), "html", { pageId: FICHA, entryId: "entry-99" })).toThrow(
      /has no entry "entry-99"/,
    );
    expect(() => render(doc(), "html", { entryId: "entry-1" })).toThrow(/is not drawn per entry/);
  });

  it("knows nothing about the collection, which is how it stays inside ADR 0001", () => {
    const { html } = render(doc(), "html", { pageId: FICHA, entryId: "entry-3" });
    expect(html).not.toContain("data-entry");
    expect(html).not.toContain("col-carta");
    expect(html).not.toContain("La carta</");
    expect(html).not.toContain("entry-3");
    // And the template's own placeholder words are nowhere: the entry replaced them.
    expect(html).not.toContain("Nombre del plato");
  });

  it("says which entry it is drawn for only when the editor asks", () => {
    const { html } = render(doc(), "html", { pageId: FICHA, entryId: "entry-3", entryHints: true });
    expect(html).toContain('data-entry="entry-3"');
  });

  it("is a pure function of the document and the entry", () => {
    const a = render(doc(), "html", { pageId: FICHA, entryId: "entry-7" }).html;
    const b = render(doc(), "html", { pageId: FICHA, entryId: "entry-7" }).html;
    expect(a).toBe(b);
  });
});

describe("what links the drawn pages, since they are in no menu", () => {
  it("leaves the page per entry out of the menu, so twelve files do not flood a strip of three", () => {
    expect(menuEntries(doc()).map((entry) => entry.kind)).not.toContain("page");
    const home = render(doc(), "html").html;
    expect(home).not.toContain("ficha-de-plato.html");
  });

  it("draws the site's menu on a drawn page with «Inicio» first and no aria-current", () => {
    // Two anchors on the home page («La carta» and nothing else visible) is under the threshold,
    // so this document has no menu at all; what it must not have is a current-page mark.
    const { html } = render(doc(), "html", { pageId: FICHA, entryId: "entry-2" });
    // The stylesheet names `a[aria-current=page]` on every page; what must be absent is the mark.
    expect(html).not.toMatch(/<a[^>]*aria-current=/);
  });

  it("links each card's title to its entry's file, derived from the slug and nothing stored", () => {
    const home = render(doc(), "html").html;
    for (const [title, slug] of [
      ["Ensaladilla rusa", "ensaladilla-rusa"],
      ["Croquetas de jamón", "croquetas-de-jamon"],
      ["Albóndigas de la abuela", "albondigas-de-la-abuela"],
    ]) {
      // Attributes come out sorted, like everything the renderer emits (INV_5).
      expect(home).toContain(`<a class="rb-entry-link" href="./${slug}.html">${title}</a>`);
    }
    // Twelve cards, twelve links, inside the heading each card already had.
    expect([...home.matchAll(/class="rb-entry-link"/g)]).toHaveLength(12);
    expect(home).toMatch(/<h3[^>]*><a class="rb-entry-link" href="\.\/ensaladilla-rusa\.html"/);
  });

  it("does not link the title on the drawn page itself, where it would point at the page it is on", () => {
    const { html } = render(doc(), "html", { pageId: FICHA, entryId: "entry-1" });
    expect(html).not.toContain("rb-entry-link");
  });

  it("keeps a bound list's cards unlinked while the collection has no page", () => {
    const base = doc();
    const withoutPage = parseDocument({
      ...base,
      pages: base.pages.filter((page) => page.id !== FICHA),
    });
    expect(render(withoutPage, "html").html).not.toContain("rb-entry-link");
  });
});
