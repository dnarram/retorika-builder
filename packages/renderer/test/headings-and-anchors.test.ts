import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * Two changes that share a day and a golden regeneration: headings stop claiming sections the
 * page does not have (#19), and sections start carrying the anchor a button can point at.
 *
 * Written against the whole corpus rather than one fixture, because both are properties of the
 * renderer and not of any document — a new section added later must satisfy them without anyone
 * remembering to come back here.
 */

const corpus = loadCorpus();
const HEADINGS = ["H1", "H2", "H3", "H4", "H5", "H6"];

function documentOf(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("a subheading is never a heading (#19)", () => {
  it.each(corpus.map((entry) => entry.name))("%s emits no heading for a subheading", (name) => {
    const entry = corpus.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`missing fixture ${name}`);
    const doc = documentOf(render(entry.document, "html").html);
    for (const element of doc.querySelectorAll('[data-role="subheading"]')) {
      expect(HEADINGS, `${name}: ${element.tagName} for a subheading`).not.toContain(
        element.tagName,
      );
    }
  });

  it("emits it as a paragraph carrying the subtitle class, with the role untouched", () => {
    const entry = corpus.find((candidate) => candidate.name === "barbershop-cover");
    if (!entry) throw new Error("missing fixture");
    const doc = documentOf(render(entry.document, "html").html);
    const subtitle = doc.querySelector('[data-role="subheading"]');
    expect(subtitle?.tagName).toBe("P");
    expect(subtitle?.classList.contains("rb-subtitle")).toBe(true);
    // The document is unchanged by this: only the tag the renderer picks moved.
    expect(subtitle?.getAttribute("data-slot")).toBe("subheadline");
  });

  it("gives the subtitle the look the h2 used to, not the look of body copy", () => {
    // `.rb-section p` would otherwise win on specificity and quietly render the tagline at body
    // size in muted grey — the regression this rule exists to prevent.
    const { css } = render(
      corpus[0]?.document ??
        (() => {
          throw new Error("empty corpus");
        })(),
      "html",
    );
    expect(css).toContain(".rb-section p.rb-subtitle { font-family: var(--font-heading);");
    expect(css).toContain("font-size: var(--size-subheading); color: var(--color-secondary);");
  });

  it("reads h1, h2, h3 in cover-and-services, and nothing between them", () => {
    // The outline the issue names: the business's promise, the section that follows it, and the
    // cards inside that section. Before this change a tagline sat between the first two.
    const entry = corpus.find((candidate) => candidate.name === "cover-and-services");
    if (!entry) throw new Error("missing fixture");
    const doc = documentOf(render(entry.document, "html").html);
    const outline = [...doc.querySelectorAll(HEADINGS.join(","))].map((el) => el.tagName);
    expect(outline).toEqual(["H1", "H2", "H3", "H3", "H3"]);
  });
});

describe("every section carries its anchor", () => {
  it.each(corpus.map((entry) => entry.name))("%s gives each section an id", (name) => {
    const entry = corpus.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`missing fixture ${name}`);
    const doc = documentOf(render(entry.document, "html").html);
    const sections = [...doc.querySelectorAll("[data-section]")];
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(section.id, `${name}: section without an id`).toBe(
        section.getAttribute("data-section"),
      );
    }
  });

  it("makes every id unique within the page, so an anchor resolves to one place", () => {
    for (const entry of corpus) {
      const doc = documentOf(render(entry.document, "html").html);
      const ids = [...doc.querySelectorAll("[data-section]")].map((section) => section.id);
      expect(new Set(ids).size, `${entry.name}: duplicate section ids`).toBe(ids.length);
    }
  });

  it("is the section id itself, not a slug of its Spanish name", () => {
    // A slug would need the catalog's locale, and this package may not import the catalog.
    const entry = corpus.find((candidate) => candidate.name === "contacto-y-horario");
    if (!entry) throw new Error("missing fixture");
    const doc = documentOf(render(entry.document, "html").html);
    expect([...doc.querySelectorAll("[data-section]")].map((s) => s.id)).toContain("sec-contact");
  });
});
