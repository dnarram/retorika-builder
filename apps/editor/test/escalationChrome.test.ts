import { presetFor } from "@retorika/catalog";
import { EMPTY_ANSWERS, generate } from "@retorika/generator";
import { render } from "@retorika/renderer";
import { escalateSection, revertSection } from "@retorika/schema";
import { describe, expect, it } from "vitest";

/**
 * Why the canvas cannot tell that a section was escalated by looking at what it renders.
 *
 * This file exists because of a defect the sprint-8 day-2 browser walk found and nothing else could:
 * accepting «Diseñar a mano» left no mark on the section. The preview is a `srcDoc` iframe, the
 * editor's chrome is attached on its `load`, and the frame only reloads when the rendered string
 * changes — which is the optimisation that keeps a click-to-edit selection alive.
 *
 * The measurement below is the cause, and it is also the promise the offer makes: «No se mueve nada
 * al empezar». Until ADR 0050 escalating changed the document and changed **not one byte** of the
 * page; since the fine grid it changes the bytes and not the pixels — the section gains `rb-free`,
 * its placements are written as the fine grid's tracks and the stylesheet gains the fine grid's
 * rules, while every element keeps its left edge and width to the pixel (measured in
 * `packages/renderer/test/fine-grid.browser.test.ts`). So the frame now reloads on escalation on
 * its own, and the key the editor puts on its frame (`Editor.tsx`, the note at the `<iframe>`) is
 * still what carries the *switch*, which changes nothing in the document. If anybody ever deletes
 * that key, the test at the bottom is what fails.
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

describe("so the chrome cannot be keyed on the rendered page", () => {
  /**
   * The key `Editor.tsx` actually uses, transcribed. Not imported: it is three lines inside a
   * component this project cannot mount (the editor's vitest project is node with no DOM), and the
   * point of writing it out is that the *shape* is what matters — it must change when either thing
   * the chrome depends on changes, and neither of those shows up in the HTML.
   */
  const chromeKey = (designTools: boolean, document: typeof doc) =>
    `${designTools}|${document.pages
      .flatMap((page) => page.sections)
      .filter((section) => section.source === "free")
      .map((section) => section.id)
      .sort()
      .join(",")}`;

  it("changes when the switch flips, though the document is untouched", () => {
    expect(chromeKey(true, doc)).not.toBe(chromeKey(false, doc));
  });

  it("changes when a section is escalated, which the frame reloads for on its own since ADR 0050", () => {
    const free = escalateSection(doc, "sec-cover", cover);
    expect(chromeKey(true, free)).not.toBe(chromeKey(true, doc));
  });

  it("changes back when the section does, so the bar goes away again", () => {
    const free = escalateSection(doc, "sec-cover", cover);
    expect(chromeKey(true, revertSection(free, "sec-cover", cover))).toBe(chromeKey(true, doc));
  });

  /**
   * **And does not move when a section comes, goes or changes place** (sprint 26 día 3). The first
   * key was one bit per section in page order, so a duplicate, a delete, a move or their undo
   * changed it and the frame was rebuilt for an edit that touched no section's source — under
   * `patch`, three refused patches in one walk. Keyed by id, only an escalation, a return, the
   * switch, or a hand-designed section arriving or leaving can move it.
   */
  it("stays put when a catalog section is duplicated, removed or moved", () => {
    const sections = doc.pages[0]?.sections ?? [];
    expect(sections.length).toBeGreaterThan(2);
    const first = sections[0];
    if (!first) throw new Error("fixture shape");
    const twin = { ...structuredClone(first), id: `${first.id}-twin` };
    const withTwin = {
      ...doc,
      pages: [{ ...doc.pages[0], sections: [first, twin, ...sections.slice(1)] }],
    } as typeof doc;
    const withoutLast = {
      ...doc,
      pages: [{ ...doc.pages[0], sections: sections.slice(0, -1) }],
    } as typeof doc;
    const reordered = {
      ...doc,
      pages: [{ ...doc.pages[0], sections: [...sections].reverse() }],
    } as typeof doc;
    for (const changed of [withTwin, withoutLast, reordered]) {
      expect(chromeKey(true, changed)).toBe(chromeKey(true, doc));
    }
  });

  it("moves when a hand-designed section is duplicated, because the copy needs a bar of its own", () => {
    const free = escalateSection(doc, "sec-cover", cover);
    const sections = free.pages[0]?.sections ?? [];
    const first = sections[0];
    if (!first) throw new Error("fixture shape");
    const twin = { ...structuredClone(first), id: `${first.id}-twin` };
    const withTwin = {
      ...free,
      pages: [{ ...free.pages[0], sections: [first, twin, ...sections.slice(1)] }],
    } as typeof doc;
    expect(chromeKey(true, withTwin)).not.toBe(chromeKey(true, free));
  });

  it("names every section, not just the first page's", () => {
    // A section escalated on the last page has to re-wire the chrome too, and a key that only
    // looked at `pages[0]` would be silently right for every single-page site — which is most of
    // them, and exactly how this would have survived to production.
    const last = doc.pages[doc.pages.length - 1];
    const section = last?.sections[last.sections.length - 1];
    if (!last || !section) throw new Error("fixture shape");
    const freed = {
      ...doc,
      pages: [
        ...doc.pages.slice(0, -1),
        { ...last, sections: [...last.sections.slice(0, -1), { ...section, source: "free" }] },
      ],
    } as typeof doc;
    expect(chromeKey(false, freed)).not.toBe(chromeKey(false, doc));
    expect(chromeKey(false, freed)).toContain(section.id);
  });

  it("does not change for an edit that the rendered page already reflects", () => {
    // The optimisation this key must not defeat: typing into a headline changes the HTML, so the
    // frame reloads on its own. If the key changed on every document change it would be doing the
    // reload twice, and the selection would be lost on every keystroke.
    const edited = {
      ...doc,
      siteName: "Taberna Santo Domingo, Ronda",
    };
    expect(chromeKey(true, edited)).toBe(chromeKey(true, doc));
  });
});
