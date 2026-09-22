import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * No text overflows its own box (docs/tasks/catalog-que-hago.md, step 8b).
 *
 * A word longer than its column — "Electrodomésticos" in composition B's 213px title column at
 * 768 — used to run through the gap into the cards. overflow-wrap: break-word is the guarantee:
 * it acts only when a word cannot fit, and it needs no dictionary. hyphens: auto on headings is
 * the visual improvement, a hyphen where the browser has a Spanish dictionary (the page declares
 * lang="es"); a Chromium without one still breaks the word, just without the hyphen.
 *
 * happy-dom does not lay out text, so these tests pin the stylesheet. Whether text fits is
 * measured in a real browser by the overflow suite's long-text case.
 */

const IMG_RULE = ".rb-section img { width: 100%; height: auto; border-radius: var(--radius-md); }";
const WRAP_RULES = [
  ".rb-section :is(h1, h2, h3, h4, h5, h6, p, a) { overflow-wrap: break-word; }",
  ".rb-section :is(h1, h2, h3, h4, h5, h6) { -webkit-hyphens: auto; hyphens: auto; }",
].join("\n");
const H1_RULE_START = ".rb-section h1 {";

const corpus = loadCorpus();

describe("long words", () => {
  it("carry the wrapping rules verbatim, once, between the image rule and the h1 rule", () => {
    for (const { name, document } of corpus) {
      const { css } = render(document, "html");
      expect(css.split(WRAP_RULES).length - 1, name).toBe(1);
      expect(css, name).toContain(`${IMG_RULE}\n${WRAP_RULES}\n${H1_RULE_START}`);
    }
  });

  it("never break a word that fits: no word-break and no overflow-wrap: anywhere", () => {
    // Both would break words that do fit, or change the min-content size the grid lays out by.
    for (const { name, document } of corpus) {
      const { css } = render(document, "html");
      expect(css, name).not.toMatch(/word-break/);
      expect(css, name).not.toMatch(/overflow-wrap:\s*anywhere/);
    }
  });

  it("apply to what the page is set in, so hyphenation uses the Spanish dictionary", () => {
    const [entry] = corpus;
    if (!entry) throw new Error("empty corpus");
    expect(render(entry.document, "html").html).toContain('<html lang="es">');
  });
});
