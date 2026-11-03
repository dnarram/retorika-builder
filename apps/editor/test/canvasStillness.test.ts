import { EMPTY_ANSWERS, generateVariants } from "@retorika/generator";
import { buildCss } from "@retorika/renderer";
import { describe, expect, it } from "vitest";
import { CANVAS_STILLNESS } from "../src/editor/canvasStillness.ts";

/**
 * The canvas's refusals against what the published page animates (sprint 32 día 2, adjustment 2):
 * every selector the renderer gives a section animation to is a child of a section, which the
 * canvas's one rule covers — and the renderer writes none of them for the canvas's own sheet anyway.
 */
describe("the canvas is still", () => {
  const doc = () => {
    const d = generateVariants(EMPTY_ANSWERS)[0]?.document;
    if (!d) throw new Error("no generated site");
    return d;
  };

  it("flattens every section animation, and scrolls without smoothing", () => {
    expect(CANVAS_STILLNESS).toContain("main > .rb-section > * { animation: none !important; }");
    expect(CANVAS_STILLNESS).toContain("html { scroll-behavior: auto !important; }");
  });

  it("covers every selector the published page animates inside a section", () => {
    const published = buildCss(doc(), "html");
    const animated = [...published.matchAll(/^\s*([^{}\n]+)\{[^{}]*animation(?:-[a-z]+)?:/gm)].map(
      (m) => (m[1] ?? "").trim(),
    );
    const sectionRules = animated.filter(
      (s) => s.includes(".rb-section") || s.includes(".rb-cover"),
    );
    expect(sectionRules.length).toBeGreaterThan(0);
    for (const selector of sectionRules) {
      // A child of a section: `main > .rb-… > …`, which `main > .rb-section > *` reaches.
      expect(selector, selector).toMatch(/^main > \.rb-(section|cover)[^ ]* > /);
    }
  });

  it("has nothing to flatten in the canvas's own sheet", () => {
    expect(buildCss(doc(), "dom")).not.toMatch(/rb-rise|animation-timeline|view-transition/);
  });
});
