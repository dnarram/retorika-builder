import { presetFor } from "@retorika/catalog";
import { EMPTY_ANSWERS, generate } from "@retorika/generator";
import { render } from "@retorika/renderer";
import { escalateSection, revertSection } from "@retorika/schema";
import { describe, expect, it } from "vitest";

/**
 * Why the canvas cannot tell that a section was escalated by looking at what it renders.
 *
 * This file exists because of a defect the sprint-8 day-2 browser walk found and nothing else could:
 * accepting «Diseñar a mano» left no mark on the section. The preview was a `srcDoc` iframe whose
 * chrome was attached on `load`, and the frame only reloaded when the rendered string changed —
 * which was the optimisation that kept a click-to-edit selection alive.
 *
 * The measurement below is the cause, and it is also the promise the offer makes: «No se mueve nada
 * al empezar». Until ADR 0050 escalating changed the document and changed **not one byte** of the
 * page; since the fine grid it changes the bytes and not the pixels — the section gains `rb-free`,
 * its placements are written as the fine grid's tracks and the stylesheet gains the fine grid's
 * rules, while every element keeps its left edge and width to the pixel (measured in
 * `packages/renderer/test/fine-grid.browser.test.ts`).
 *
 * **The answer to that defect was a key on the frame, and it is gone** (sprint 27 día 1). A second
 * `describe` here transcribed `chromeKey` and pinned its shape — it had to change when the switch
 * flipped or a section was escalated, neither of which shows up in the HTML. Under ADR 0051 the
 * chrome is not attached again at all: `redrawChrome` draws it over the one document after every
 * patch, the switch is a redraw, and escalating is a patch. So there is no key to pin, and what is
 * left here is the claim about the published bytes, which no route changes.
 */

const doc = generate({
  ...EMPTY_ANSWERS,
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar" as const,
  services: ["Comidas"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  mainAction: "book" as const,
  bookingLink: "https://reservas.example.com/taberna",
}).document;

const cover = presetFor("cover");

/**
 * What escalating is allowed to change in the published bytes, and nothing else (ADR 0050): the
 * section's `rb-free` class, the inline grid area of its children, and the fine grid's own
 * stylesheet block. With those three taken out, the two pages are the same string — every tag,
 * every word, every other rule.
 */
function withoutTheFineGrid(html: string): string {
  return (
    html
      .replace(/ rb-free"/g, '"')
      .replace(/ style="grid-column:[^"]*"/g, "")
      // The whole block `fineGridCss` emits, from its first rule to the end of its mobile override.
      .replace(
        /\n\.rb-section\.rb-free \{ grid-template-columns: repeat[\s\S]*?grid-auto-rows: auto; \}\n\}\n/,
        "",
      )
  );
}

describe("escalating a section changes the bytes and not the pixels", () => {
  it("renders the same page apart from the fine grid's class, tracks and rules", () => {
    // «Al escalar… se copia la maquetación del catálogo, así que no se mueve ni un píxel» — the
    // pixels are the browser suite's claim; this is the one about everything else in the page.
    const free = escalateSection(doc, "sec-cover", cover);
    const before = render(doc, "html");
    const after = render(free, "html");

    expect(free.pages[0]?.sections[0]?.source).toBe("free");
    expect(after.html).not.toBe(before.html);
    expect(after.html).toContain('rb-free"');
    expect(withoutTheFineGrid(after.html)).toBe(withoutTheFineGrid(before.html));
    // And the normaliser is doing work, on the side that has the fine grid: sabotage check.
    expect(withoutTheFineGrid(after.html)).not.toBe(after.html);
    expect(withoutTheFineGrid(after.html)).not.toContain("rb-free");
    expect(before.html).not.toContain("rb-free");
  });

  it("and going back renders the identical bytes again", () => {
    const free = escalateSection(doc, "sec-cover", cover);
    const back = render(revertSection(free, "sec-cover", cover), "html");
    expect(back.html).toBe(render(doc, "html").html);
    expect(back.css).toBe(render(doc, "html").css);
  });
});
