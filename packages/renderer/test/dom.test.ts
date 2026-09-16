import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

const corpus = loadCorpus();

describe("the dom target", () => {
  it.each(corpus.map((entry) => entry.name))("paints %s without throwing", (name) => {
    const entry = corpus.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`missing fixture ${name}`);
    const fragment = render(entry.document, "dom");
    expect(fragment.childNodes.length).toBeGreaterThan(0);
  });

  it("builds structure from the same tree the html target uses", () => {
    const entry = corpus[0];
    if (!entry) throw new Error("empty corpus");

    const fragment = render(entry.document, "dom");
    const { html } = render(entry.document, "html");

    const sections = (fragment.firstChild as Element).querySelectorAll("section");
    const htmlSections = html.match(/<section\b/g) ?? [];
    expect(sections.length).toBe(htmlSections.length);
  });

  it("does not turn injected markup into structure", () => {
    const hostile = corpus.find((entry) => entry.name === "xss-attempt");
    if (!hostile) throw new Error("missing hostile fixture");

    const fragment = render(hostile.document, "dom");
    expect((fragment.firstChild as Element).querySelectorAll("script").length).toBe(0);
  });
});
