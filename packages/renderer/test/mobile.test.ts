import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * The automatic mobile derivation (PR #6, finding 1): below 720px every section is one column
 * with one element per row, the photo first, and no panel.
 *
 * happy-dom does not lay anything out, so these tests pin the stylesheet. The layout itself is
 * checked in a real browser by the accessibility harness and the task's manual step. The markup
 * is not compared here: the golden diff already proves only the media query changed.
 */

const MOBILE_BLOCK = [
  "@media (max-width: 720px) {",
  "  .rb-section { grid-template-columns: 1fr; padding: var(--space-lg); }",
  "  .rb-section > * { grid-column: 1 / -1 !important; grid-row: auto !important; }",
  "  .rb-section > img { order: -1; }",
  "  .rb-panel { display: none; }",
  "}",
].join("\n");

/** The three rules this task adds; each must exist only inside the mobile block. */
const MOBILE_ONLY = [
  "grid-row: auto !important",
  ".rb-section > img { order: -1; }",
  ".rb-panel { display: none; }",
];

const corpus = loadCorpus();

function styleOf(html: string): string {
  const start = html.indexOf("<style>");
  const end = html.indexOf("</style>");
  if (start === -1 || end === -1) throw new Error("rendered page has no <style> block");
  return html.slice(start + "<style>".length, end);
}

describe("the mobile layout", () => {
  it.each(corpus.map((entry) => entry.name))(
    "renders the mobile block verbatim and once in %s",
    (name) => {
      const entry = corpus.find((candidate) => candidate.name === name);
      if (!entry) throw new Error(`missing fixture ${name}`);
      const css = styleOf(render(entry.document, "html").html);
      expect(css.split(MOBILE_BLOCK).length - 1).toBe(1);
    },
  );

  it("keeps the mobile rules inside the media query, so desktop and tablet do not change", () => {
    for (const { name, document } of corpus) {
      const outside = styleOf(render(document, "html").html).replace(MOBILE_BLOCK, "");
      for (const rule of MOBILE_ONLY) {
        expect(outside.includes(rule), `${name}: ${rule}`).toBe(false);
      }
    }
  });

  it("still emits the desktop panel, which the mobile rule only hides", () => {
    for (const name of ["hidden-and-embed", "image-background-full"]) {
      const entry = corpus.find((candidate) => candidate.name === name);
      if (!entry) throw new Error(`missing fixture ${name}`);
      expect(render(entry.document, "html").html, name).toContain('class="rb-panel"');
    }
  });
});
