// @vitest-environment happy-dom
import { buildTheme, withFill } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import { themePreviewer } from "../src/editor/themePreviewer.ts";

/**
 * **Pasar pinta y no escribe** (sprint 38 día 6, David's P7): the colours are written inline on the
 * canvas's root as chrome, taken away on leaving, kept for the patch on pressing, and a patch's
 * `clear` takes them whether or not a preview is showing.
 */
function canvas(): Document {
  return document.implementation.createHTMLDocument("canvas");
}
const read = (doc: Document, variable: string) =>
  doc.documentElement.style.getPropertyValue(variable);

const wine = buildTheme({ paletteId: "deep-wine", typePairId: "modern-sans" });
const blue = buildTheme({ paletteId: "classic-blue", typePairId: "modern-sans" });
// A palette with a fill of its own (ADR 0074): the yellow logo's.
const yellow = withFill(
  buildTheme({ paletteId: "neutral", typePairId: "modern-sans" }),
  "#FFCD00",
  "#201A09",
);

describe("the theme's preview on the canvas", () => {
  it("writes the six colours inline while it shows, and takes them away on leaving", () => {
    const doc = canvas();
    const preview = themePreviewer(() => doc);
    preview.show(wine);
    expect(read(doc, "--color-primary")).toBe(wine["color.primary"]);
    expect(read(doc, "--color-surface")).toBe(wine["color.surface"]);
    // No fill of its own: the pair as the renderer resolves it, so a fill the page's own sheet
    // declares does not stay in force under the preview.
    expect(read(doc, "--color-fill")).toBe(wine["color.primary"]);
    expect(read(doc, "--color-on-fill")).toBe(wine["color.surface"]);
    preview.end("restore");
    expect(read(doc, "--color-primary")).toBe("");
    expect(doc.documentElement.getAttribute("style") ?? "").toBe("");
  });

  it("carries the fill pair for a palette that has one, and resolves it for one that has not", () => {
    const doc = canvas();
    const preview = themePreviewer(() => doc);
    preview.show(yellow);
    expect(read(doc, "--color-fill")).toBe("#FFCD00");
    expect(read(doc, "--color-on-fill")).toBe("#201A09");
    // The second preview takes the first away before it writes: no yellow left under the blue.
    preview.show(blue);
    expect(read(doc, "--color-primary")).toBe(blue["color.primary"]);
    expect(read(doc, "--color-fill")).toBe(blue["color.primary"]);
    expect(read(doc, "--color-on-fill")).toBe(blue["color.surface"]);
  });

  it("keeps the colours on a press, for the patch to take, and clear takes them", () => {
    const doc = canvas();
    const preview = themePreviewer(() => doc);
    preview.show(wine);
    preview.end("keep");
    expect(read(doc, "--color-primary")).toBe(wine["color.primary"]);
    // The patch: whether or not a preview is active.
    preview.clear();
    expect(read(doc, "--color-primary")).toBe("");
    preview.clear();
    expect(read(doc, "--color-primary")).toBe("");
  });

  it("writes nothing when the canvas has no document yet, and ends quietly", () => {
    const preview = themePreviewer(() => null);
    expect(() => {
      preview.show(wine);
      preview.end("restore");
      preview.clear();
    }).not.toThrow();
  });
});
