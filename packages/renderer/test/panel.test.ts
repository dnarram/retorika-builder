import { parseDocument, type RetorikaDocument, type Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * The panel behind text that overlaps an image (PR #6, finding 2).
 *
 * The rule is placement-driven: a section gets one empty `div.rb-panel`, as its first child,
 * covering the bounding box of the visible non-image elements whose grid area intersects a
 * visible image. It is render-only — no role, no slot, never in the document.
 */

const corpus = loadCorpus();

function fixture(name: string): RetorikaDocument {
  const entry = corpus.find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`fixture ${name} is missing from the corpus`);
  return entry.document;
}

const PANEL_CSS = [
  ".rb-panel { align-self: stretch; margin: calc(-1 * var(--space-md)); z-index: 1;",
  "  background: var(--color-surface); border-radius: var(--radius-lg); pointer-events: none; }",
  ".rb-panel ~ :not(img) { z-index: 2; }",
].join("\n");

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function section(doc: Document, id: string): Element {
  const found = doc.querySelector(`section[data-section="${id}"]`);
  if (!found) throw new Error(`no section ${id}`);
  return found;
}

function panelOf(el: Element): Element | null {
  return [...el.children].find((child) => child.classList.contains("rb-panel")) ?? null;
}

function panelStyle(document: RetorikaDocument, sectionId: string): string | null {
  const panel = panelOf(section(parse(render(document, "html").html), sectionId));
  return panel?.getAttribute("style") ?? null;
}

/** The first section of a fixture, replaced; parsed so a bad test document fails loudly. */
function withSection(
  base: RetorikaDocument,
  change: (section: Section) => Section,
): RetorikaDocument {
  const [page] = base.pages;
  const [first] = page?.sections ?? [];
  if (!page || !first) throw new Error("fixture has no section");
  return parseDocument({ ...base, pages: [{ ...page, sections: [change(first)] }] });
}

/** A free section of barbershop-cover's elements, laid out by hand. */
function freeSection(
  placements: Record<string, [column: number, columnSpan: number, row: number, rowSpan: number]>,
  hidden: string[] = [],
): RetorikaDocument {
  return withSection(fixture("barbershop-cover"), (s) => ({
    ...s,
    source: "free",
    content: s.content.map((el) => (hidden.includes(el.id) ? { ...el, hidden: true } : el)),
    layout: {
      grid: { columns: 12 },
      placements: Object.entries(placements).map(
        ([elementId, [column, columnSpan, row, rowSpan]]) => ({
          elementId,
          column,
          columnSpan,
          row,
          rowSpan,
        }),
      ),
      breakpoints: {},
    },
  }));
}

describe("the panel behind text over an image", () => {
  it("covers every overlapping element of a full image-background cover", () => {
    expect(panelStyle(fixture("image-background-full"), "sec-cover-full")).toBe(
      "grid-column:2/span 9;grid-row:2/span 4",
    );
  });

  it("covers only the visible headline in hidden-and-embed, where the rest is hidden", () => {
    expect(panelStyle(fixture("hidden-and-embed"), "sec-cover")).toBe(
      "grid-column:2/span 8;grid-row:2/span 1",
    );
  });

  it("does not grow for hidden elements", () => {
    const hideActions = withSection(fixture("image-background-full"), (s) => ({
      ...s,
      content: s.content.map((el) =>
        ["primaryAction", "secondaryAction"].includes(el.slot) ? { ...el, hidden: true } : el,
      ),
    }));
    // Headline, subheadline and body only: columns 2-9, rows 2-4.
    expect(panelStyle(hideActions, "sec-cover-full")).toBe(
      "grid-column:2/span 8;grid-row:2/span 3",
    );
  });

  it("appears exactly in the two sections of the corpus where text overlaps an image", () => {
    const panels: string[] = [];
    for (const { name, document } of corpus) {
      const page = parse(render(document, "html").html);
      for (const el of page.querySelectorAll("section")) {
        if (panelOf(el)) panels.push(`${name}/${el.getAttribute("data-section")}`);
        if (el.getAttribute("data-variant") === "image-right") {
          expect(panelOf(el), `${name}/${el.getAttribute("data-section")}`).toBeNull();
        }
      }
    }
    expect(panels.sort()).toEqual([
      "hidden-and-embed/sec-cover",
      "image-background-full/sec-cover-full",
    ]);
  });

  it("gives a free section with text placed over its image a panel", () => {
    const doc = freeSection({
      "el-image": [1, 6, 1, 3],
      "el-headline": [1, 4, 2, 1],
      "el-body": [7, 6, 1, 1],
    });
    expect(panelStyle(doc, "sec-cover")).toBe("grid-column:1/span 4;grid-row:2/span 1");
  });

  it("treats edges that only touch as not overlapping", () => {
    const doc = freeSection({
      "el-image": [1, 6, 1, 2],
      "el-headline": [1, 6, 3, 1], // the row right after the image
      "el-body": [7, 6, 1, 2], // the column right after the image
    });
    expect(panelStyle(doc, "sec-cover")).toBeNull();
  });

  it("emits no panel when the image is hidden", () => {
    const doc = withSection(fixture("image-background-full"), (s) => ({
      ...s,
      content: s.content.map((el) => (el.slot === "image" ? { ...el, hidden: true } : el)),
    }));
    expect(panelStyle(doc, "sec-cover-full")).toBeNull();
  });

  it("emits no panel when the section has no image", () => {
    const doc = freeSection({ "el-headline": [1, 6, 1, 1], "el-body": [1, 6, 2, 1] }, ["el-image"]);
    expect(panelStyle(doc, "sec-cover")).toBeNull();
  });

  it("is the section's first child, empty, with no role and no slot", () => {
    const { html } = render(fixture("hidden-and-embed"), "html");
    expect(html).toContain(
      '    <div aria-hidden="true" class="rb-panel" style="grid-column:2/span 8;grid-row:2/span 1"></div>',
    );
    const el = section(parse(html), "sec-cover");
    const panel = el.firstElementChild;
    expect(panel?.classList.contains("rb-panel")).toBe(true);
    expect(panel?.getAttributeNames().sort()).toEqual(["aria-hidden", "class", "style"]);
    expect(panel?.getAttribute("aria-hidden")).toBe("true");
    expect(panel?.childNodes.length).toBe(0);
  });

  it("is the same panel in the dom target as in the html target", () => {
    const document = fixture("image-background-full");
    const fromHtml = panelOf(section(parse(render(document, "html").html), "sec-cover-full"));
    const fragment = render(document, "dom");
    const fromDom = fragment.querySelector('section[data-section="sec-cover-full"] > .rb-panel');
    expect(fromDom).not.toBeNull();
    for (const name of ["aria-hidden", "class", "style"]) {
      expect(fromDom?.getAttribute(name), name).toBe(fromHtml?.getAttribute(name));
    }
    expect(fromDom?.hasAttribute("data-role")).toBe(false);
    expect(fromDom?.hasAttribute("data-slot")).toBe(false);
  });

  it("puts the three stacking rules in the stylesheet, verbatim and once", () => {
    const { html } = render(fixture("barbershop-cover"), "html");
    expect(html.split(PANEL_CSS).length - 1).toBe(1);
  });

  it("relies on every image being a bare <img> child of its section", () => {
    // `.rb-panel ~ :not(img)` keeps the image under the panel only because the image is a
    // bare <img> sibling. A wrapper would match :not(img), rise above the panel and, coming
    // after the text in the markup, cover it again (task, "Stop and ask" 7).
    for (const { name, document } of corpus) {
      for (const img of parse(render(document, "html").html).querySelectorAll("img")) {
        expect(img.parentElement?.tagName, `${name}: ${img.getAttribute("alt")}`).toBe("SECTION");
      }
    }
  });
});
