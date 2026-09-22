import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * Lists end to end: a semantic <ul>/<li> in both targets, heading levels by section, and the
 * stylesheet's list rules. The renderer knows nothing about "services": the same code draws
 * every future list section, so these tests speak of lists, and use "Qué hago" as the example.
 */

const LIST_CSS = [
  ".rb-section h3 { font-family: var(--font-heading); font-size: var(--size-body);",
  "  color: var(--color-ink); margin: 0; }",
  ".rb-list { display: grid; gap: var(--space-md); margin: 0; padding: 0; list-style: none;",
  "  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr)); }",
  ".rb-item { display: flex; flex-direction: column; gap: var(--space-xs);",
  "  padding-top: var(--space-sm); border-top: 1px solid var(--color-muted); }",
].join("\n");
const H2_RULE_END = "  color: var(--color-secondary); margin: 0; }";
const PARAGRAPH_RULE_START = ".rb-section p {";

const corpus = loadCorpus();
const fixture = corpus.find((entry) => entry.name === "cover-and-services")?.document;
if (!fixture) throw new Error("fixture cover-and-services is missing from the corpus");
const doc: RetorikaDocument = fixture;

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function htmlTarget(document: RetorikaDocument): Element {
  const main = parse(render(document, "html").html).querySelector("main");
  if (!main) throw new Error("rendered page has no <main>");
  return main;
}

function domTarget(document: RetorikaDocument): Element {
  return render(document, "dom").firstChild as Element;
}

/** Every attribute of every element in a subtree, in document order, for comparing targets. */
function shape(root: Element): string[] {
  return [root, ...root.querySelectorAll("*")].map(
    (el) =>
      `${el.tagName.toLowerCase()} ${[...el.attributes]
        .map((a) => `${a.name}=${a.value}`)
        .sort()
        .join(" ")}`,
  );
}

/** The fixture with the list's items replaced, for the edge cases. */
function withItemsHidden(hideAll: boolean): RetorikaDocument {
  const copy = structuredClone(doc);
  const section = copy.pages[0]?.sections.find((s) => s.id === "sec-services");
  const list = section?.content.find((el) => el.role === "list");
  if (!list?.items) throw new Error("the fixture's services section has no list");
  for (const item of list.items) {
    for (const el of item.elements) el.hidden = hideAll || el.hidden;
  }
  return parseDocument(copy);
}

describe("lists", () => {
  for (const [target, root] of [
    ["html", () => htmlTarget(doc)],
    ["dom", () => domTarget(doc)],
  ] as const) {
    it(`draws a semantic <ul role="list"> of <li> in the ${target} target`, () => {
      const lists = root().querySelectorAll("ul");
      expect(lists).toHaveLength(1);
      const ul = lists[0] as Element;
      expect(ul.getAttribute("role")).toBe("list");
      expect(ul.getAttribute("class")).toBe("rb-list");
      expect(ul.getAttribute("data-role")).toBe("list");
      expect(ul.getAttribute("data-slot")).toBe("services");
      expect(ul.getAttribute("style")).toBe("grid-column:1/span 12;grid-row:3/span 1");
      for (const li of ul.children) {
        expect(li.tagName).toBe("LI");
        expect(li.getAttribute("class")).toBe("rb-item");
      }
    });
  }

  it("builds the same structure, attribute for attribute, in both targets", () => {
    expect(shape(domTarget(doc))).toEqual(shape(htmlTarget(doc)));
  });

  it("keeps the items in document order", () => {
    const ids = [...htmlTarget(doc).querySelectorAll("li")].map((li) =>
      li.getAttribute("data-item"),
    );
    expect(ids).toEqual(["item-1", "item-2", "item-3"]);
  });

  it("does not emit a hidden element inside an item", () => {
    const color = htmlTarget(doc).querySelector('[data-item="item-3"]');
    expect(color?.querySelector('[data-slot="title"]')?.textContent?.trim()).toBe("Color");
    expect(color?.querySelector('[data-slot="description"]')).toBeNull();
  });

  it("does not emit an item whose elements are all hidden", () => {
    const main = htmlTarget(doc);
    expect(main.querySelector('[data-item="item-4"]')).toBeNull();
    expect(main.textContent).not.toContain("Niños");
  });

  it("does not emit the list when no item is left", () => {
    const main = htmlTarget(withItemsHidden(true));
    expect(main.querySelector("ul")).toBeNull();
    expect(main.querySelector("li")).toBeNull();
  });
});

describe("heading levels, by section", () => {
  it("reads h1 in the cover, h2 for a section's title, h3 for the cards", () => {
    const main = htmlTarget(doc);
    const headings = [...main.querySelectorAll("h1, h2, h3, h4, h5, h6")].map(
      (h) => `${h.tagName.toLowerCase()} ${h.closest("section")?.getAttribute("data-preset")}`,
    );
    expect(headings).toEqual([
      "h1 cover",
      "h2 cover",
      "h2 services",
      "h3 services",
      "h3 services",
      "h3 services",
    ]);
    expect(main.querySelector('[data-slot="headline"][data-role="heading"]')?.tagName).toBe("H1");
    expect(
      main.querySelector('section[data-preset="services"] [data-slot="headline"]')?.tagName,
    ).toBe("H2");
  });
});

describe("the stylesheet", () => {
  it("carries the list rules verbatim, once, between the h2 rule and the paragraph rule", () => {
    for (const { name, document } of corpus) {
      const { css } = render(document, "html");
      expect(css.split(LIST_CSS).length - 1, name).toBe(1);
      expect(css, name).toContain(`${H2_RULE_END}\n${LIST_CSS}\n${PARAGRAPH_RULE_START}`);
    }
  });
});
