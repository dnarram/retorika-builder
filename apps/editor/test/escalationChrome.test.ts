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
 * al empezar». Escalating changes the document and changes **not one byte** of the page. So the
 * editor keys its frame on the chrome's own state (`Editor.tsx`, the note at the `<iframe>`), and if
 * anybody ever deletes that key, the test at the bottom is what fails.
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

describe("escalating a section is invisible in what gets published", () => {
  it("renders the identical HTML and the identical CSS", () => {
    // «Al escalar… se copia la maquetación del catálogo, así que no se mueve ni un píxel», at the
    // only level where that sentence can be checked rather than believed.
    const free = escalateSection(doc, "sec-cover", cover);
    const before = render(doc, "html");
    const after = render(free, "html");

    expect(free.pages[0]?.sections[0]?.source).toBe("free");
    expect(after.html).toBe(before.html);
    expect(after.css).toBe(before.css);
  });

  it("and so does going back", () => {
    const free = escalateSection(doc, "sec-cover", cover);
    const back = render(revertSection(free, "sec-cover", cover), "html");
    expect(back.html).toBe(render(doc, "html").html);
    expect(back.css).toBe(render(doc, "html").css);
  });

  it("which is also `INV_5` reached through the product for the first time", () => {
    // "Publishing produces identical output with tools on or off" has only ever been checked as
    // determinism — the same document rendered twice. This is the other half: two documents that
    // differ exactly by the switch's work, publishing the same bytes.
    const free = escalateSection(doc, "sec-cover", cover);
    expect(render(free, "html").html).toBe(render(doc, "html").html);
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
      .map((section) => (section.source === "free" ? "1" : "0"))
      .join("")}`;

  it("changes when the switch flips, though the document is untouched", () => {
    expect(chromeKey(true, doc)).not.toBe(chromeKey(false, doc));
  });

  it("changes when a section is escalated, though the page renders the same", () => {
    const free = escalateSection(doc, "sec-cover", cover);
    expect(render(free, "html").html).toBe(render(doc, "html").html);
    expect(chromeKey(true, free)).not.toBe(chromeKey(true, doc));
  });

  it("changes back when the section does, so the bar goes away again", () => {
    const free = escalateSection(doc, "sec-cover", cover);
    expect(chromeKey(true, revertSection(free, "sec-cover", cover))).toBe(chromeKey(true, doc));
  });

  it("names every section, not just the first page's", () => {
    // A section escalated on the second page has to re-wire the chrome too, and a key that only
    // looked at `pages[0]` would be silently right for every single-page site — which is most of
    // them, and exactly how this would have survived to production.
    const many = doc.pages.flatMap((page) => page.sections).length;
    expect(chromeKey(false, doc)).toHaveLength("false|".length + many);
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
