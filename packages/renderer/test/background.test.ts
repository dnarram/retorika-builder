import { type RetorikaDocument, type VeilColours, veilFor } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { buildCss } from "../src/build.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * A background with motifs in the stylesheet (ADR 0081, sprint 40 día 5): the picture under the box,
 * the veil over it at the opacity `veilFor` derives when the page is drawn, half the tile on a phone,
 * and nothing painted over the cover's photograph.
 */

const corpus = loadCorpus();
const fixture = (name: string): RetorikaDocument => {
  const found = corpus.find((entry) => entry.name === name);
  if (!found) throw new Error(`no corpus fixture ${name}`);
  return found.document;
};
const coloursOf = (doc: RetorikaDocument): VeilColours => ({
  "color.surface": doc.theme["color.surface"],
  "color.ink": doc.theme["color.ink"],
  "color.primary": doc.theme["color.primary"],
  "color.secondary": doc.theme["color.secondary"],
  "color.muted": doc.theme["color.muted"],
});

describe("a background with motifs, in the stylesheet", () => {
  const doc = fixture("fondo-con-motivos");
  const css = buildCss(doc, "html");

  it("veils the picture at the opacity derived from its extremes, under the site and under the section", () => {
    const background = doc.background;
    if (!background) throw new Error("the fixture has a site background");
    const alpha = veilFor(coloursOf(doc), background.extremes);
    const veil = `color-mix(in srgb, var(--color-surface) ${alpha}%, transparent)`;
    expect(css).toContain(`body::before { content: ""; position: absolute; inset: 0; z-index: -1;`);
    expect(css).toContain(
      `[data-section="sec-services"]::before { content: ""; position: absolute;`,
    );
    expect(css.split(veil)).toHaveLength(3);
    expect(css).toContain("html { background: var(--color-surface); }");
    expect(css).toContain('background-image: url("assets/motivo.png");');
  });

  it("tiles at the picture's own size, half of it on a phone, and covers where asked", () => {
    expect(css).toContain("body { position: relative; isolation: isolate;");
    expect(css).toContain("background-size: 160px 160px; background-repeat: repeat;");
    expect(css).toContain("@media (max-width: 720px) {\n  body { background-size: 80px 80px; }\n}");
    expect(css).toContain(
      '[data-section="sec-services"] { position: relative; isolation: isolate;',
    );
    expect(css).toContain("background-size: cover; background-repeat: no-repeat;");
    // Cover is cover at every width: no phone rule for the section.
    expect(css).not.toContain('[data-section="sec-services"] { background-size:');
  });

  it("paints nothing over the cover's photograph: no rule puts the picture on a section without one", () => {
    const rules = css.split("\n").filter((line) => line.includes("background-image"));
    expect(rules).toHaveLength(2);
    expect(css).not.toMatch(/\.rb-cover[^{]*\{[^}]*background-image/);
    expect(css).not.toMatch(/sec-cover-full[^{]*\{[^}]*background-image/);
  });

  it("asks again when the palette changes: a dark surface is another veil for the same picture", () => {
    const dark: RetorikaDocument = {
      ...doc,
      theme: {
        ...doc.theme,
        "color.surface": "#0F172A",
        "color.ink": "#F8FAFC",
        "color.primary": "#93C5FD",
        "color.secondary": "#BFDBFE",
        "color.muted": "#CBD5E1",
      },
    };
    const alphaLight = veilFor(
      coloursOf(doc),
      doc.background?.extremes ?? { darkest: "#000000", lightest: "#FFFFFF" },
    );
    const alphaDark = veilFor(
      coloursOf(dark),
      doc.background?.extremes ?? { darkest: "#000000", lightest: "#FFFFFF" },
    );
    expect(alphaDark).not.toBe(alphaLight);
    expect(buildCss(dark, "html")).toContain(`var(--color-surface) ${alphaDark}%, transparent`);
  });

  it("writes the same rules for the canvas as for the published page", () => {
    const tail = css.slice(css.indexOf("html { background: var(--color-surface); }"));
    expect(buildCss(doc, "dom")).toContain(tail);
  });

  it("emits nothing at all for a document without one, which is every document before 1.22.0", () => {
    for (const entry of corpus) {
      // `capas` (sprint 41 día 7) carries a section background under its stack.
      if (entry.name === "fondo-con-motivos" || entry.name === "capas") continue;
      expect(buildCss(entry.document, "html"), entry.name).not.toContain("background-image");
    }
  });

  it("refuses a name the stylesheet cannot carry, and takes the preview's object URL", () => {
    const background = doc.background;
    if (!background) throw new Error("the fixture has a site background");
    // Past the schema on purpose: the guard is the renderer's own, for whatever reaches it.
    const withSrc = (src: string): RetorikaDocument => ({
      ...doc,
      background: { ...background, src },
    });
    expect(() => buildCss(withSrc("javascript:alert(1)"), "html")).toThrow(/stylesheet can carry/);
    expect(() =>
      buildCss(withSrc('motivo.png") } body { color: red; } x { a: url("'), "html"),
    ).toThrow(/stylesheet can carry/);
    expect(() => buildCss(withSrc("motivo.png?x=<script>"), "html")).toThrow(
      /stylesheet can carry/,
    );
    expect(
      buildCss(withSrc("blob:http://localhost:4173/2f9a0b1c-3d4e-4f5a-8b6c-7d8e9f0a1b2c"), "html"),
    ).toContain('url("blob:http://localhost:4173/2f9a0b1c-3d4e-4f5a-8b6c-7d8e9f0a1b2c")');
  });
});
