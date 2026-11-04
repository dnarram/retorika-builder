import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EMPTY_ANSWERS, generateVariants } from "@retorika/generator";
import { buildCss } from "@retorika/renderer";
import { describe, expect, it } from "vitest";
import { canvasDocument } from "../audit/canvas-document.ts";
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

  // **The audit's canvas carries the editor's sheet, not a copy of it** (David's adjustment 4 of
  // sprint 33): the document the menu audit opens in three engines takes `CANVAS_STILLNESS` from this
  // same module, and `Editor.tsx` spreads that same constant into the frame. Held by reading both:
  // the string the audit injects, line for line, and the editor's source spreading the name.
  it("is what the menu audit's canvas document carries, from the same module Editor.tsx spreads", () => {
    const html = canvasDocument(doc());
    // The last `<style>` of the head is the audit's; the first is the canvas's own stylesheet.
    const head = html.slice(0, html.indexOf("</head>"));
    const style = head.slice(head.lastIndexOf("<style>\n") + "<style>\n".length);
    expect(style.endsWith("\n</style>\n"), "no stillness sheet closes the head").toBe(true);
    expect(style.slice(0, -"\n</style>\n".length)).toBe(CANVAS_STILLNESS.join("\n"));
    expect(html).not.toContain("<script");
    const editor = readFileSync(
      fileURLToPath(new URL("../src/questionnaire/Editor.tsx", import.meta.url)),
      "utf8",
    );
    expect(editor).toContain('import { CANVAS_STILLNESS } from "../editor/canvasStillness.ts";');
    expect(editor).toContain("...CANVAS_STILLNESS,");
    const audit = readFileSync(
      fileURLToPath(new URL("../audit/canvas-document.ts", import.meta.url)),
      "utf8",
    );
    expect(audit).toContain('import { CANVAS_STILLNESS } from "../src/editor/canvasStillness.ts";');
  });

  it("has nothing to flatten in the canvas's own sheet", () => {
    // The phone's sheets name `rb-rise` for their entries (sprint 32 día 4), but its keyframes
    // travel with the published page only: in the canvas the name animates nothing.
    expect(buildCss(doc(), "dom")).not.toMatch(
      /@keyframes rb-rise|@keyframes rb-reveal|animation-timeline|view-transition/,
    );
  });
});
