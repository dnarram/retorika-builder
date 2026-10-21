import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

const corpus = loadCorpus();

/**
 * The dom target's own tests: that it paints, that it is safe, and — since sprint 26 día 1 —
 * **where** it paints. Whether it paints the *same* thing as the html target is a question of its
 * own, with its own file: `parity.test.ts` walks both trees node by node and is what ADR 0051
 * rests on. The section count this file used to compare is subsumed there.
 */
describe("the dom target", () => {
  it.each(corpus.map((entry) => entry.name))("paints %s without throwing", (name) => {
    const entry = corpus.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`missing fixture ${name}`);
    const fragment = render(entry.document, "dom");
    expect(fragment.childNodes.length).toBeGreaterThan(0);
  });

  it("does not turn injected markup into structure", () => {
    const hostile = corpus.find((entry) => entry.name === "xss-attempt");
    if (!hostile) throw new Error("missing hostile fixture");

    const fragment = render(hostile.document, "dom");
    expect((fragment.firstChild as Element).querySelectorAll("script").length).toBe(0);
  });

  /**
   * **The nodes are born in the document the caller names, and nowhere else** (ADR 0051, David's
   * adjustment 4 to the sprint 26 plan).
   *
   * An `<img src>` created in a document with a browsing context fetches its source the moment it
   * exists, attached or not. An editor that renders the tree on every edit to diff it against the
   * screen would fire one request per photograph per keystroke for fragments it is about to throw
   * away. `document.implementation.createHTMLDocument("")` has no browsing context and loads
   * nothing — so the test is that every node, images included, has *that* document as its owner,
   * and that the global document is exactly as empty afterwards as it was before. The request
   * itself is measured in the browser, by the e2e; here the ownership is what can be asserted.
   */
  it("creates every node in the document it is given, and nothing in the global one", () => {
    const entry = corpus.find((candidate) => candidate.name === "cover-and-services");
    if (!entry) throw new Error("missing fixture cover-and-services");

    const inert = document.implementation.createHTMLDocument("");
    const before = document.body.childNodes.length;

    const fragment = render(entry.document, "dom", { document: inert });

    const owners = new Set<Document | null>();
    const walker = inert.createTreeWalker(fragment, 0xffffffff);
    let node: Node | null = walker.currentNode;
    while (node) {
      if (node !== fragment) owners.add(node.ownerDocument);
      node = walker.nextNode();
    }
    expect([...owners]).toEqual([inert]);
    expect(
      fragment.querySelectorAll("img").length,
      "the fixture has no image to prove it on",
    ).toBeGreaterThan(0);
    expect(document.body.childNodes.length).toBe(before);
    // And the default is still the global document, which every caller before this day got.
    expect(render(entry.document, "dom").firstChild?.ownerDocument).toBe(document);
  });
});
