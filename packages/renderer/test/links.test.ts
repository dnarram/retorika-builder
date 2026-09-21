import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * Plain links (PR #6, finding 3): every <a> in a section that is not the button is drawn in
 * color.primary and stays underlined; the button and the browser's focus ring are untouched.
 *
 * happy-dom does not compute a real cascade, so these tests pin the stylesheet. Colours,
 * underline and focus are checked in a real browser by the accessibility harness and the task's
 * manual step. The markup is not compared here: the golden diff already proves it unchanged.
 */

const PARAGRAPH_RULE =
  ".rb-section p { font-size: var(--size-body); color: var(--color-muted); margin: 0; }";
const LINK_RULE =
  ".rb-section a:not([role=button]) { color: var(--color-primary); text-decoration: underline; }";
const BUTTON_RULE = [
  ".rb-section [role=button] { display: inline-block; padding: var(--space-sm) var(--space-md);",
  "  background: var(--color-primary); color: var(--color-surface);",
  "  border-radius: var(--radius-sm); text-decoration: none; }",
].join("\n");

const corpus = loadCorpus();

function styleOf(html: string): string {
  const start = html.indexOf("<style>");
  const end = html.indexOf("</style>");
  if (start === -1 || end === -1) throw new Error("rendered page has no <style> block");
  return html.slice(start + "<style>".length, end);
}

describe("plain links", () => {
  it.each(corpus.map((entry) => entry.name))(
    "puts the link rule once, between the paragraph and the button rules, in %s",
    (name) => {
      const entry = corpus.find((candidate) => candidate.name === name);
      if (!entry) throw new Error(`missing fixture ${name}`);
      const css = styleOf(render(entry.document, "html").html);
      expect(css.split(LINK_RULE).length - 1).toBe(1);
      expect(css).toContain([PARAGRAPH_RULE, LINK_RULE, BUTTON_RULE].join("\n"));
    },
  );

  it("leaves the button rule exactly as it was", () => {
    for (const { name, document } of corpus) {
      expect(styleOf(render(document, "html").html).split(BUTTON_RULE).length - 1, name).toBe(1);
    }
  });

  it("never removes the browser's focus indicator or adds state colours", () => {
    for (const { name, document } of corpus) {
      const css = styleOf(render(document, "html").html);
      for (const forbidden of ["outline", ":focus", ":focus-visible", ":visited", ":hover"]) {
        expect(css.includes(forbidden), `${name}: ${forbidden}`).toBe(false);
      }
    }
  });

  it("colours plain links with the primary token, not an exact value", () => {
    expect(LINK_RULE).toContain("color: var(--color-primary)");
    expect(LINK_RULE).toContain("text-decoration: underline");
  });
});
