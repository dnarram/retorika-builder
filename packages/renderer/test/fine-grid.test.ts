import {
  FINE_COLUMNS,
  fineTemplateColumns,
  parseDocument,
  type RetorikaDocument,
  type Section,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * The fine grid's emission (ADR 0050): what a hand-designed section gets, and what a document
 * without one does not pay for.
 *
 * Three claims, each of which a wrong line would break differently: the stylesheet rules exist
 * only when a free section does; a free section carries `rb-free` and its placements are written
 * as tracks with the gutters counted in; a catalog section beside it is untouched. The pixels the
 * tracks resolve to are the browser suite's business (`fine-grid.browser.test.ts`).
 */

const corpus = loadCorpus();

function fixture(name: string): RetorikaDocument {
  const entry = corpus.find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`fixture ${name} is missing from the corpus`);
  return entry.document;
}

function withFirstSection(doc: RetorikaDocument, change: (s: Section) => Section) {
  const page = doc.pages[0];
  if (!page) throw new Error("fixture has no pages");
  const first = page.sections[0];
  if (!first) throw new Error("fixture has no sections");
  return parseDocument({ ...doc, pages: [{ ...page, sections: [change(first)] }] });
}

/** barbershop-cover's cover, designed by hand: the headline over six catalog columns. */
function freeCover(): RetorikaDocument {
  return withFirstSection(fixture("barbershop-cover"), (section) => ({
    ...section,
    source: "free",
    layout: {
      grid: { columns: FINE_COLUMNS },
      placements: [{ elementId: "el-headline", column: 9, columnSpan: 48, row: 1, rowSpan: 1 }],
      breakpoints: {},
    },
  }));
}

describe("the fine grid's stylesheet", () => {
  it("is emitted only for a document with a hand-designed section", () => {
    const plain = render(fixture("barbershop-cover"), "html").html;
    expect(plain).not.toContain(".rb-section.rb-free");
    expect(plain).not.toContain("rb-free");

    const free = render(freeCover(), "html").html;
    expect(free).toContain(
      `.rb-section.rb-free { grid-template-columns: ${fineTemplateColumns()};`,
    );
    expect(free).toContain("column-gap: 0; row-gap: 0; grid-auto-rows: minmax(8px, auto);");
    expect(free).toContain("align-items: start; }");
  });

  it("gives the one column back on mobile, with the theme's row gap and content-sized rows", () => {
    const free = render(freeCover(), "html").html;
    expect(free).toContain(
      "@media (max-width: 720px) {\n  .rb-section.rb-free { grid-template-columns: 1fr; row-gap: var(--space-md);\n    grid-auto-rows: auto; }\n}",
    );
  });

  it("is written once however many free sections there are, and the dom target marks the section too", () => {
    const html = render(freeCover(), "html").html;
    expect(html.match(/\.rb-section\.rb-free \{ grid-template-columns: repeat/g)).toHaveLength(1);
    // The dom target is the same node tree: the class is on the section there as well, so the
    // editor's preview selects the same rules the published page does.
    const dom = render(freeCover(), "dom");
    expect(dom.querySelector("section.rb-section.rb-free")).not.toBeNull();
  });

  it("appears in exactly the two corpus documents that carry a free section", () => {
    const withIt = corpus
      .filter(({ document }) => render(document, "html").html.includes(".rb-section.rb-free"))
      .map(({ name }) => name)
      .sort();
    expect(withIt).toEqual(["hidden-and-embed", "physio-free-cover"]);
  });
});

describe("a hand-designed section's markup", () => {
  it("carries rb-free and writes its placements as tracks, gutters included", () => {
    const html = render(freeCover(), "html").html;
    expect(html).toMatch(/<section class="rb-section rb-cover rb-[a-z-]+ rb-free"/);
    // Unit 9 is track 10 (the ninth track is a gutter); forty-eight units cross five gutters.
    expect(html).toContain('data-id="el-headline"');
    expect(html).toMatch(
      /data-id="el-headline"[^>]*style="grid-column:10\/span 53;grid-row:1\/span 1"/,
    );
  });

  it("leaves a catalog section's placements in the catalog's own twelve", () => {
    const html = render(fixture("barbershop-cover"), "html").html;
    expect(html).toMatch(/data-id="el-headline"[^>]*style="grid-column:\d{1,2}\/span \d{1,2};/);
    expect(html).not.toContain("rb-free");
  });

  it("counts a gutter the moment a span reaches into the next group, and not before", () => {
    // From unit 9: forty-seven units end on unit 55 (the seventh group, five gutters crossed, 52
    // tracks); forty-nine end on unit 57, the eighth group, one gutter more — 55 tracks, not 54.
    // A translation that forgot the gutters would say 47 and 49.
    const spanning = (columnSpan: number) =>
      withFirstSection(fixture("barbershop-cover"), (section) => ({
        ...section,
        source: "free",
        layout: {
          grid: { columns: FINE_COLUMNS },
          placements: [{ elementId: "el-headline", column: 9, columnSpan, row: 1, rowSpan: 1 }],
          breakpoints: {},
        },
      }));
    expect(render(spanning(47), "html").html).toMatch(/style="grid-column:10\/span 52;/);
    expect(render(spanning(49), "html").html).toMatch(/style="grid-column:10\/span 55;/);
  });
});
