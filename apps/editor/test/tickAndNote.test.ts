// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, type RetorikaDocument, setHeader } from "@retorika/schema";
import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { Note } from "../src/editor/panelKit.tsx";
import { MenuPanel } from "../src/questionnaire/MenuPanel.tsx";

/**
 * **The tick is drawn and the note fades** (sprint 39 día 5, David's P1 and P2). What moves is the
 * stylesheet's and the walk's; what is here is the markup each piece is given — the tick mounted only
 * while checked, so it draws on checking and never on unchecking; the sentence wrapped to fade only
 * when it changes, never on the first paint.
 */

let root: Root | null = null;
afterEach(() => {
  root?.unmount();
  root = null;
  document.body.innerHTML = "";
});

function drawNote(text: string): HTMLElement {
  if (!root) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  flushSync(() => root?.render(createElement(Note, null, text)));
  const p = document.body.querySelector("p");
  if (!p) throw new Error("no note drawn");
  return p;
}

describe("Note fades a sentence that changes", () => {
  it("draws its first sentence as it is", () => {
    const p = drawNote("Se muestra con 3 enlaces.");
    expect(p.querySelector(".ui-cross-in")).toBeNull();
    expect(p.textContent).toBe("Se muestra con 3 enlaces.");
  });

  it("fades the new sentence in when it changes, and keeps the same node for the same sentence", () => {
    drawNote("Se muestra con 3 enlaces.");
    const changed = drawNote("Se muestra con 4 enlaces.").querySelector(".ui-cross-in");
    expect(changed?.textContent).toBe("Se muestra con 4 enlaces.");
    // A re-render that says the same thing is the same node: nothing arrives twice.
    const again = drawNote("Se muestra con 4 enlaces.").querySelector(".ui-cross-in");
    expect(again).toBe(changed);
    // A third sentence is a new node, which is what makes it fade again.
    const third = drawNote("No se muestra.").querySelector(".ui-cross-in");
    expect(third).not.toBe(changed);
  });

  it("draws the first sentence as it is when it comes back", () => {
    drawNote("Se muestra con 3 enlaces.");
    drawNote("Se muestra con 4 enlaces.");
    expect(drawNote("Se muestra con 3 enlaces.").querySelector(".ui-cross-in")).toBeNull();
  });
});

const FIXTURES = join(import.meta.dirname, "..", "..", "..", "fixtures", "documents");
const fixture = (name: string): RetorikaDocument =>
  parseDocument(JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf8")));
const noop = () => {};

function menuMarkup(doc: RetorikaDocument): string {
  return renderToStaticMarkup(
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
}

describe("«Menú»'s checkboxes draw their tick", () => {
  const sticky = setHeader(fixture("menu-y-paginas"), { sticky: true } as never);
  const html = menuMarkup(sticky);
  const boxes = [...html.matchAll(/<input type="checkbox"[^>]*>/g)].map((m) => m[0]);

  it("keeps every platform checkbox in the page, out of sight but never out of the keyboard", () => {
    expect(boxes.length, "the bar's options and a switch per row").toBeGreaterThan(3);
    for (const box of boxes) {
      expect(box).toContain("opacity-0");
      expect(box).not.toMatch(/\b(hidden|sr-only|invisible)\b/);
      expect(box).toContain("peer");
    }
  });

  it("draws one tick for each checked box, and none for an empty one", () => {
    const checked = boxes.filter((box) => /checked=""/.test(box)).length;
    const unchecked = boxes.length - checked;
    expect(checked, "a sticky bar and a menu with links").toBeGreaterThan(1);
    expect(unchecked, "and something left unchecked").toBeGreaterThan(0);
    expect(html.match(/data-tick=""/g)?.length).toBe(checked);
    // Each tick is the «Guardado» tick's piece: one path, drawn once by `ui-draw`.
    expect(html.match(/<path class="ui-draw" pathLength="1"/g)?.length).toBe(checked);
  });

  it("ripples from the label the hand pressed", () => {
    const labels = [...html.matchAll(/<label class="([^"]*)"><input type="checkbox"/g)];
    expect(labels).toHaveLength(boxes.length);
    for (const [, cls] of labels) expect(cls).toContain("ui-ripple");
  });
});
