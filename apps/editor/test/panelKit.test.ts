import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Note, PanelHeader, PanelSection, panelFrame } from "../src/editor/panelKit.tsx";

/**
 * **The shared pieces of the right-hand panels, rendered** (sprint 38 día 5). The eight panels take
 * their head, groups and notes from here, so what these render is what the eight render: the level of
 * the title a landmark is labelled by, the cross's name, the legend inside its group, the note's tone.
 * Rendered to markup on the server's path — no DOM in this project — which is the markup the panel
 * ships, since the pieces hold no state.
 */
describe("PanelHeader", () => {
  const head = (props: Parameters<typeof PanelHeader>[0]) =>
    renderToStaticMarkup(createElement(PanelHeader, props));

  it("titles the panel with an h2 carrying the id its landmark is labelled by", () => {
    // An h3 here would skip a level under the editor's title for every panel at once; axe does not
    // fail on it in this suite, so this is what holds it (the sabotage of día 5 found that).
    const html = head({ id: "panel-title", title: "El estilo de toda la web" });
    expect(html).toMatch(
      /^<div[^>]*><div[^>]*><h2 id="panel-title"[^>]*>El estilo de toda la web<\/h2>/,
    );
    expect(html).not.toMatch(/<h[13456]/);
  });

  it("draws the help as a note, and the cross with the panel's own name", () => {
    const html = head({
      id: "t",
      title: "Páginas de tu web",
      help: "Una frase de ayuda.",
      close: { label: "Cerrar las páginas", onClick: () => {} },
    });
    expect(html).toContain(
      '<p class="m-0 text-[12px] leading-snug text-ui-muted ">Una frase de ayuda.</p>',
    );
    expect(html).toMatch(/<button type="button" aria-label="Cerrar las páginas"[^>]*>/);
  });

  it("draws no cross when the panel closes elsewhere, as «Listas» does", () => {
    expect(head({ id: "t", title: "Listas" })).not.toContain("<button");
  });
});

describe("PanelSection", () => {
  it("is a fieldset whose legend names the group with the document's words, capitals drawn by CSS", () => {
    // Through a variable, as «Menú» passes its block's name: an object literal would trip the excess
    // property check on a `data-` attribute that JSX itself accepts.
    const props = { legend: "Marca", "data-menu-block": "brand" };
    const html = renderToStaticMarkup(createElement(PanelSection, props, "dentro"));
    expect(html).toMatch(/^<fieldset data-menu-block="brand" class="[^"]*border-t[^"]*">/);
    expect(html).toMatch(/<legend class="[^"]*uppercase[^"]*">Marca<\/legend>dentro<\/fieldset>$/);
  });
});

describe("Note", () => {
  it("is grey by default and amber from the token when it warns, never a hex", () => {
    const quiet = renderToStaticMarkup(createElement(Note, null, "Nota"));
    const warn = renderToStaticMarkup(createElement(Note, { tone: "warn" }, "Aviso"));
    expect(quiet).toContain("text-ui-muted");
    expect(warn).toContain("text-ui-warn-deep");
    expect(warn).not.toMatch(/#[0-9a-f]{6}/i);
  });

  it("can be the second line of a label, as a block span, where a paragraph would be invalid", () => {
    const html = renderToStaticMarkup(
      createElement(Note, { as: "span" }, "Se verá como «Qué hago»"),
    );
    expect(html).toMatch(/^<span class="block [^"]*">Se verá como «Qué hago»<\/span>$/);
  });
});

describe("panelFrame", () => {
  it("is one width, one padding and one gap for the eight", () => {
    expect(panelFrame).toMatch(/^w-\[340px\] phone:w-auto gap-4 p-5 /);
  });
});
