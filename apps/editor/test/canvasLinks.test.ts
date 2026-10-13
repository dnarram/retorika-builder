import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { canvasLinkTarget } from "../src/editor/canvasLinks.ts";

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
  it("names the page for a page's slug, fragment or not", () => {
    expect(canvasLinkTarget(doc, "./index.html")).toEqual({ kind: "page", pageId: "home" });
    expect(canvasLinkTarget(doc, "./index.html#sec-prices")).toEqual({
      kind: "page",
      pageId: "home",
    });
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
