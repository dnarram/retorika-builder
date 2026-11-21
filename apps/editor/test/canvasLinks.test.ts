import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { canvasLinkPress, canvasLinkTarget, opensOutside } from "../src/editor/canvasLinks.ts";

/**
 * The one decision the canvas makes about a clicked link, with the twelve-entry fixture as the
 * document: a page's slug moves the canvas, an entry's slug is **inert** (ADR 0040, David's
 * adjustment: the click edits the title), the template's own slug reaches nothing, and so does
 * anything that is not a file of this site.
 */
const doc = parseDocument(
  JSON.parse(
    readFileSync(
      join(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "fixtures",
        "documents",
        "una-pagina-por-ficha.json",
      ),
      "utf8",
    ),
  ),
);

describe("canvasLinkTarget", () => {
  it("names the page for a page's slug, and the section for a fragment that names one there", () => {
    expect(canvasLinkTarget(doc, "./index.html")).toEqual({ kind: "page", pageId: "home" });
    // Since sprint 30 día 3 a fragment that names a section of that page is the section — what the
    // header's button writes from another page (ADR 0057) — and one that names nothing is the page.
    expect(canvasLinkTarget(doc, "./index.html#sec-prices")).toEqual({
      kind: "section",
      pageId: "home",
      sectionId: "sec-prices",
    });
    expect(canvasLinkTarget(doc, "./index.html#sec-ficha")).toEqual({
      kind: "page",
      pageId: "home",
    });
    expect(canvasLinkTarget(doc, "./index.html#")).toEqual({ kind: "page", pageId: "home" });
  });

  it("reads `./index.html` as the first page whatever it is slugged, since that is its file", () => {
    const renamed = {
      ...doc,
      pages: doc.pages.map((p, i) => (i === 0 ? { ...p, slug: "inicio" } : p)),
    };
    expect(canvasLinkTarget(renamed, "./index.html")).toEqual({ kind: "page", pageId: "home" });
    expect(canvasLinkTarget(renamed, "./inicio.html")).toEqual({ kind: "page", pageId: "home" });
  });

  it("names a section of the page being drawn for a bare fragment, and nothing on another page", () => {
    // The renderer writes a section's anchor local to its own page (ADR 0043 §1).
    expect(canvasLinkTarget(doc, "#sec-prices")).toEqual({
      kind: "section",
      pageId: "home",
      sectionId: "sec-prices",
    });
    expect(canvasLinkTarget(doc, "#sec-prices", "home")).toMatchObject({ kind: "section" });
    expect(canvasLinkTarget(doc, "#sec-prices", "page-ficha-carta")).toEqual({ kind: "none" });
    expect(canvasLinkTarget(doc, "#sec-ficha", "page-ficha-carta")).toEqual({
      kind: "section",
      pageId: "page-ficha-carta",
      sectionId: "sec-ficha",
    });
    // The skip link's destination is `<main>`, not a section: nothing to choose.
    expect(canvasLinkTarget(doc, "#rb-main")).toEqual({ kind: "none" });
  });

  it("names the entry for an entry's slug, so a hand-typed link to a ficha moves the canvas there", () => {
    expect(canvasLinkTarget(doc, "./ensaladilla-rusa.html")).toEqual({
      kind: "entry",
      pageId: "page-ficha-carta",
      entryId: "entry-1",
    });
    expect(canvasLinkTarget(doc, " ./albondigas-de-la-abuela.html ")).toMatchObject({
      kind: "entry",
      entryId: "entry-12",
    });
  });

  it("reaches nothing for the template's own slug, an outside href, or a dead one", () => {
    // No file is ever written under the template's slug (ADR 0040 §1).
    expect(canvasLinkTarget(doc, "./ficha-de-plato.html")).toEqual({ kind: "none" });
    expect(canvasLinkTarget(doc, "https://reservas.example.com/taberna")).toEqual({ kind: "none" });
    expect(canvasLinkTarget(doc, "#")).toEqual({ kind: "none" });
    expect(canvasLinkTarget(doc, "./no-existe.html")).toEqual({ kind: "none" });
  });
});

/**
 * What a click on a link *does*, by where the link is (sprint 40 día 2, ADR 0079). Until that day
 * the decision above was the whole of it, and a button inside a section that pointed at a page took
 * the owner there on the first click — before the second one that writes.
 */
describe("canvasLinkPress", () => {
  it("edits a link inside a section, wherever it points", () => {
    for (const href of [
      "./index.html",
      "./ensaladilla-rusa.html",
      "./index.html#sec-prices",
      "#sec-prices",
      "tel:600111222",
      "https://reservas.example.com/taberna",
      "./no-existe.html",
    ]) {
      expect(canvasLinkPress(doc, href, "home", "section"), href).toEqual({ kind: "edit" });
    }
  });

  it("chooses the header for its button and for its brand, as ADR 0066 §1 wrote", () => {
    expect(canvasLinkPress(doc, "#sec-prices", "home", "header-action")).toEqual({
      kind: "header",
    });
    expect(canvasLinkPress(doc, "./index.html", "page-ficha-carta", "header-brand")).toEqual({
      kind: "header",
    });
  });

  it("follows a header entry to its page or its section, and nowhere for a dead one", () => {
    expect(canvasLinkPress(doc, "./index.html", "page-ficha-carta", "header-entry")).toEqual({
      kind: "go",
      target: { kind: "page", pageId: "home" },
    });
    expect(canvasLinkPress(doc, "#sec-prices", "home", "header-entry")).toEqual({
      kind: "go",
      target: { kind: "section", pageId: "home", sectionId: "sec-prices" },
    });
    expect(canvasLinkPress(doc, "./no-existe.html", "home", "header-entry")).toEqual({
      kind: "none",
    });
    // The skip link's `<main>` is nothing to go to.
    expect(canvasLinkPress(doc, "#rb-main", "home", "elsewhere")).toEqual({ kind: "none" });
  });

  it("names what a browser can open outside the site, and nothing else", () => {
    expect(opensOutside("https://reservas.example.com/taberna")).toBe(true);
    expect(opensOutside(" http://example.com ")).toBe(true);
    expect(opensOutside("tel:600111222")).toBe(false);
    expect(opensOutside("mailto:hola@example.com")).toBe(false);
    expect(opensOutside("./index.html")).toBe(false);
    expect(opensOutside("#sec-prices")).toBe(false);
  });
});
