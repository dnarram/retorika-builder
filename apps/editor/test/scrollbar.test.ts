import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Safari draws the panel's scrollbar, and the rule that would stop it is kept out.
 *
 * **Measured in Playwright's WebKit — Safari's own engine — on 5 October 2026**, on a 200px box
 * holding 900px of content, reading `offsetWidth - clientWidth`: zero for an overlay bar that
 * floats and fades, the lane's width for one that is drawn.
 *
 * | rules present at load | WebKit | Chromium |
 * |---|---|---|
 * | none | **0px** | 0px |
 * | `::-webkit-scrollbar` only | **10px** | 0px |
 * | `::-webkit-scrollbar` **and** `scrollbar-width: thin` | **0px** | 0px |
 *
 * The third row is why this test exists. The obvious way to write this fix is to style
 * `::-webkit-scrollbar` for WebKit *and* set the standard `scrollbar-width`/`scrollbar-color` for
 * everyone else — and in WebKit the standard property wins and switches the overlay bar back on.
 * The first draft did exactly that and would have shipped as a fix that fixed nothing.
 *
 * **Asserted on the stylesheet rather than in a browser**, because the browser that can show this
 * is WebKit and the suite runs Chromium, where the number is 0 whatever the CSS says. Adding a
 * second engine to CI to guard one rule is not worth it; the rule is.
 */

const CSS = readFileSync(join(import.meta.dirname, "..", "src", "app", "globals.css"), "utf8");

/** The file without its comments, so a measurement written down in prose is not read as a rule. */
const DECLARATIONS = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

describe("the editor's scrollbar", () => {
  it("styles ::-webkit-scrollbar, which is what makes Safari draw one at all", () => {
    expect(DECLARATIONS).toContain("::-webkit-scrollbar");
    expect(DECLARATIONS, "the thumb is what is actually seen").toContain(
      "::-webkit-scrollbar-thumb",
    );
  });

  it("declares no scrollbar-width or scrollbar-color, which would switch WebKit back to an overlay", () => {
    expect(DECLARATIONS).not.toMatch(/scrollbar-width\s*:/);
    expect(DECLARATIONS).not.toMatch(/scrollbar-color\s*:/);
  });

  it("gives the bar a width, since a lane of zero is the thing being fixed", () => {
    const width = DECLARATIONS.match(/::-webkit-scrollbar\s*\{[^}]*width:\s*(\d+)px/);
    expect(width?.[1], "no width on ::-webkit-scrollbar").toBeDefined();
    expect(Number(width?.[1])).toBeGreaterThan(6);
  });

  it("leaves the published site alone, which is the one thing this must never touch", () => {
    // ADR 0001: nothing of the editor's styling may reach a client's page. The preview is an
    // iframe with its own document from `packages/renderer`, and the proof that this cannot cross
    // is that the renderer emits no scrollbar rule of its own to be overridden.
    const rendererSrc = join(import.meta.dirname, "..", "..", "..", "packages", "renderer", "src");
    for (const file of readdirSync(rendererSrc).filter((f) => f.endsWith(".ts"))) {
      expect(readFileSync(join(rendererSrc, file), "utf8"), file).not.toContain("scrollbar");
    }
  });
});
