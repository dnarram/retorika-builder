import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RAIL_ORDER, STUDIO_TOOLS } from "../src/editor/railLayout.ts";
import es from "../src/locales/es.json" with { type: "json" };
import { CollectionsPanel } from "../src/questionnaire/CollectionsPanel.tsx";
import { MenuPanel } from "../src/questionnaire/MenuPanel.tsx";

/**
 * **Where things are, after sprint 39 día 2**: the rail's order, the bar's horizontal choices in one
 * block of «Menú», and «Listas» closing like the other seven. Each is a place, and a place is what a
 * person learns; these hold it.
 */

const FIXTURES = join(import.meta.dirname, "..", "..", "..", "fixtures", "documents");
const fixture = (name: string): RetorikaDocument =>
  parseDocument(JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")));
const noop = () => {};

describe("the rail's order (David's answer E)", () => {
  it("is Secciones · Estilo · Fotos · Páginas · Menú · Compartir, and the studio's two after", () => {
    expect([...RAIL_ORDER]).toEqual(["sections", "style", "photos", "pages", "menu", "share"]);
    expect([...STUDIO_TOOLS]).toEqual(["design", "collections"]);
  });

  it("is read by the shell, never written out there again", () => {
    // A second list in the shell is how the two layouts would come to disagree on where a tool is.
    const shell = readFileSync(
      join(import.meta.dirname, "..", "src", "editor", "EditorShell.tsx"),
      "utf8",
    );
    expect(shell).toContain("RAIL_ORDER.map(");
    expect(shell).not.toMatch(/"sections",\s*"style",\s*"pages"/);
    expect(shell).not.toMatch(/icon="(sections|style|pages|menu|share|photos)"/);
  });
});

/** The `<fieldset>` whose legend is `legend`, cut out of the markup. Fieldsets in «Menú» do not nest
 * at the top level, so the next `</fieldset>` at depth zero closes it. */
function block(html: string, legend: string): string {
  const at = html.indexOf(`>${legend}</legend>`);
  expect(at, `no block «${legend}»`).toBeGreaterThan(-1);
  const start = html.lastIndexOf("<fieldset", at);
  let depth = 0;
  for (const match of html.slice(start).matchAll(/<fieldset|<\/fieldset>/g)) {
    depth += match[0] === "<fieldset" ? 1 : -1;
    if (depth === 0) return html.slice(start, start + (match.index ?? 0) + match[0].length);
  }
  throw new Error(`block «${legend}» never closes`);
}

describe("«Disposición» holds the bar's horizontal choices (David's answer B)", () => {
  const html = renderToStaticMarkup(
    createElement(MenuPanel, {
      doc: fixture("cabecera-con-marca"),
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
  const layout = block(html, es["editor.menuPanel.layout"]);
  const brand = block(html, es["editor.menuPanel.brandBlock"]);
  const look = block(html, es["editor.menuPanel.look"]);
  const group = (name: string) => `role="radiogroup" aria-label="${name}"`;

  it("puts the three layouts, where the brand sits and where the links go in one block", () => {
    expect(layout).toMatch(/name="[^"]*-layout"/);
    expect(layout).toContain(group(es["editor.menuPanel.place"]));
    expect(layout).toContain(group(es["editor.menuPanel.align"]));
    // In that order: the layout first, then the brand, then the links that read the brand.
    expect(layout.indexOf("-layout")).toBeLessThan(
      layout.indexOf(group(es["editor.menuPanel.place"])),
    );
    expect(layout.indexOf(group(es["editor.menuPanel.place"]))).toBeLessThan(
      layout.indexOf(group(es["editor.menuPanel.align"])),
    );
  });

  it("leaves neither in the block it came from", () => {
    expect(brand).not.toContain(group(es["editor.menuPanel.place"]));
    expect(look).not.toContain(group(es["editor.menuPanel.align"]));
    // The brand block keeps what is the brand's: the name, the logo and its size, the name's size.
    expect(brand).toContain(group(es["editor.menuPanel.nameSize"]));
    // And the look keeps the gap and the letter.
    expect(look).toContain(group(es["editor.menuPanel.gap"]));
    expect(look).toContain(group(es["editor.menuPanel.size"]));
  });

  it("draws the gesture's sentence in no block: the help line says it (día 3)", () => {
    expect(brand).not.toContain(es["editor.help.gesture.brand"]);
    expect(layout).not.toContain(es["editor.help.gesture.brand"]);
    expect(html).not.toContain("arrastrar");
  });
});

describe("«Listas» closes with the cross the other seven have", () => {
  const html = renderToStaticMarkup(
    createElement(CollectionsPanel, {
      document: fixture("cabecera-con-marca"),
      sectionName: (id: string) => id,
      blockFor: () => undefined,
      candidates: [],
      onMakeList: noop,
      onBindList: noop,
      canBind: () => false,
      onAddEntry: noop,
      onAddEntryPage: noop,
      onRemoveEntryPage: noop,
      onShowPage: noop,
      pagesFull: false,
      headingFieldsFor: () => [],
      onRenameCollection: noop,
      onDeleteCollection: noop,
      onSetEntryField: noop,
      onRemoveEntry: noop,
      onMoveEntry: noop,
      onClose: noop,
    }),
  );

  it("draws the cross beside its title, named for the panel", () => {
    expect(es["editor.collections.close"]).toBe("Cerrar las listas");
    expect(html).toMatch(
      /<\/h2>(?:<p[^>]*>.*?<\/p>)?<button type="button" aria-label="Cerrar las listas"/,
    );
  });

  it("and no second way out at its foot", () => {
    expect(html.match(/<button/g)?.length).toBe(1);
    expect(html).not.toMatch(/>Cerrar<\/button>/);
  });
});
