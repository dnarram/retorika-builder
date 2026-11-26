import { describe, expect, it } from "vitest";
import { buildCss } from "../src/build.ts";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * The stack of a hand-designed section, as the page writes it (ADR 0085, sprint 41 día 7). Whether
 * the browser paints it so is `stacking.browser.test.ts`.
 */

const corpus = loadCorpus();
const capas = corpus.find((entry) => entry.name === "capas");
if (!capas) throw new Error("the capas fixture is missing from the corpus");

const line = (html: string, id: string) =>
  html.split("\n").find((l) => l.includes(`data-id="${id}"`)) ?? "";

describe("a section with a stack of its own (ADR 0085)", () => {
  const html = render(capas.document, "html").html;

  it("gives every placed element its place, twice over, and the section its own context", () => {
    expect(line(html, "el-cta")).toContain("z-index:2");
    expect(line(html, "el-image")).toContain("z-index:4");
    expect(line(html, "el-headline")).toContain("z-index:6");
    expect(line(html, "el-body")).toContain("z-index:8");
    expect(html).toMatch(/<section class="rb-section rb-cover rb-image-right rb-free rb-layered"/);
    expect(buildCss(capas.document, "html")).toContain(
      ".rb-section.rb-layered { isolation: isolate; }",
    );
  });

  it("draws the panel under the text above the photograph only, one step below it", () => {
    // The headline (6) is above the photograph (4); the button (2) is under it and gets no panel.
    const panel = html.split("\n").find((l) => l.includes('class="rb-panel"')) ?? "";
    expect(panel).toContain("z-index:5");
    expect(panel).toContain(line(html, "el-headline").match(/grid-column:[^;]+/)?.[0] ?? "none");
  });

  it("is in no other document of the corpus, so every other site keeps its bytes", () => {
    for (const entry of corpus) {
      if (entry.name === "capas") continue;
      const other = render(entry.document, "html").html;
      expect(other, entry.name).not.toContain("rb-layered");
      expect(other, entry.name).not.toMatch(/grid-row:[^"]*;z-index:/);
    }
  });
});
