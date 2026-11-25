import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { buildCss } from "../src/build.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * A photograph's shape and the point its crop keeps (ADR 0084, sprint 41 día 4), as the stylesheet
 * writes them. Whether the browser draws them is `photo-shape.browser.test.ts`.
 */

const corpus = loadCorpus();
const shaped = corpus.find((entry) => entry.name === "foto-con-forma");
if (!shaped) throw new Error("the foto-con-forma fixture is missing from the corpus");

const MARK = "/* a photograph's shape and the point its crop keeps (ADR 0084) */";
const PHONE = "/* on a phone, a shape between 3:4 and 3:1 */";

/** The lines of one commented block, up to its blank line. */
function block(doc: RetorikaDocument, mark: string): string[] {
  const lines = buildCss(doc, "html").split("\n");
  const start = lines.indexOf(mark);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.indexOf("");
  return (end === -1 ? rest : rest.slice(0, end)).map((line) => line.trim());
}

/** The fixture with the cover photograph's shape and point replaced, or taken away. */
function withCover(
  ratio: { width: number; height: number } | undefined,
  hidden = false,
): RetorikaDocument {
  const raw = JSON.parse(JSON.stringify(shaped?.document)) as RetorikaDocument;
  const cover = raw.pages[0]?.sections[0];
  if (!cover?.layout) throw new Error("no free cover");
  const placement = cover.layout.placements.find((p) => p.elementId === "el-image");
  if (!placement) throw new Error("no photograph placement");
  if (ratio) placement.ratio = ratio;
  else delete placement.ratio;
  const photo = cover.content.find((el) => el.id === "el-image");
  if (photo) photo.hidden = hidden;
  return parseDocument(raw);
}

const COVER = '[data-section="sec-cover"] [data-id="el-image"][data-role]';
const MEMBER = '[data-section="sec-team"] [data-id="el-member-1-photo"][data-role]';

describe("a photograph's shape and its point, in the stylesheet (ADR 0084)", () => {
  it("writes the shape with its crop and its point, and a card's point alone", () => {
    expect(block(shaped.document, MARK)).toEqual([
      `${COVER} { aspect-ratio: 4 / 1; object-fit: cover; object-position: 30% 70%; }`,
      `${MEMBER} { object-position: 50% 20%; }`,
    ]);
  });

  it("draws a shape outside 3:4 – 3:1 at the nearer limit on a phone, and leaves the rest alone", () => {
    // Written out per shape: 4:1 is wider than 3:1, 1:3 is taller than 3:4, and 16:9 and the two
    // limits themselves are inside.
    const phone = (ratio: { width: number; height: number }) => {
      const lines = buildCss(withCover(ratio), "html").split("\n");
      const start = lines.indexOf(PHONE);
      return start === -1 ? [] : [lines[start + 2]?.trim()];
    };
    expect(phone({ width: 4, height: 1 })).toEqual([`${COVER} { aspect-ratio: 3 / 1; }`]);
    expect(phone({ width: 1, height: 3 })).toEqual([`${COVER} { aspect-ratio: 3 / 4; }`]);
    expect(phone({ width: 16, height: 9 })).toEqual([]);
    expect(phone({ width: 3, height: 1 })).toEqual([]);
    expect(phone({ width: 3, height: 4 })).toEqual([]);
  });

  it("writes no shape for a photograph nobody shaped, and nothing for a hidden one", () => {
    expect(block(withCover(undefined), MARK)[0]).toBe(`${COVER} { object-position: 30% 70%; }`);
    expect(block(withCover({ width: 4, height: 1 }, true), MARK)).toEqual([
      `${MEMBER} { object-position: 50% 20%; }`,
    ]);
  });

  it("is in no other document of the corpus, so every other site keeps its bytes", () => {
    for (const entry of corpus) {
      if (entry.name === "foto-con-forma") continue;
      expect(buildCss(entry.document, "html"), entry.name).not.toContain(MARK);
    }
  });

  it("carries no !important, and comes after rule 6's block and before rule 7's patches", () => {
    const css = buildCss(shaped.document, "html");
    const own = css.slice(css.indexOf(MARK), css.indexOf("}\n}\n", css.indexOf(PHONE)));
    expect(own).not.toContain("!important");
    // A media query adds no specificity: the phone's limit wins over the shape only by coming later.
    expect(css.indexOf(PHONE)).toBeGreaterThan(css.indexOf(MARK));
    expect(css.indexOf('[data-id="el-body"] { order: 3; }')).toBeGreaterThan(css.indexOf(PHONE));
  });
});
