import { presetFor } from "@retorika/catalog";
import { arbitraryDocument } from "@retorika/schema/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { headerDrawn } from "../src/header.ts";
import { HEADER_SCRIPT } from "../src/headerScript.ts";
import { escapeHtml, render } from "../src/index.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * **`render(doc, "dom")` and `render(doc, "html")` paint the same tree, node for node** (ADR 0051,
 * sprint 26 día 1).
 *
 * Protocol §3.2 draws one renderer with two outputs so that the editor and the published page can
 * never disagree. The editor is about to lean on that for the first time — from this sprint it
 * paints every edit from the `dom` target and shows the person a document it will publish from
 * the `html` target — and until today nothing held the two together but a test that counted
 * `<section>`s. This walks both trees in lockstep over every document in the corpus, every page of
 * the multi-page ones, and a hundred generated covers, and refuses **any** difference in tag, child
 * order, attribute set or value, comment, or character.
 *
 * **The only thing forgiven is the pretty-printer, and it is forgiven exactly.** `nodeToHtml` puts
 * every child of a block node on its own line — a newline and two spaces per level before each
 * child (`html.ts`), and the closing tag on its own line after the last — while the dom target
 * inserts no whitespace at all. So the html side is normalised by stripping precisely that: a
 * leading `"\n" + pad(depth + 1)` and a trailing `"\n" + pad(depth)` from a text node, and nothing
 * else. A node with `inlineChildren` gets no pretty-printing on the html side either, so its text
 * is compared to the character — one space inserted inside a marked run would print «Solo millo»
 * for «Solomillo», which is why `nodes.ts` lays those end to end and why this test must not be
 * loosened to «trim».
 *
 * Attributes are compared **decoded**: `escapeHtml` on the way to text, `setAttribute` on the way
 * to a node, and the two must round-trip — `xss-attempt` is what makes that sharp. A comment's
 * data is not decoded by a parser, so the html side's comment is compared to `escapeHtml` of the
 * dom side's, with the single space `nodeToHtml` puts on either side taken off.
 *
 * Not a sixth invariant: protocol §8.2 names five and this is a property of the renderer, not of a
 * document. The sabotage that proves the boundary is in the plan — drop `loading` from `dom.ts`'s
 * attribute walk and this goes red while every golden stays green; change the pretty-printer's
 * indentation and this stays green while the goldens go red.
 */

const corpus = loadCorpus();
const cover = presetFor("cover");

/** Two spaces per level, which is `nodeToHtml`'s own `"  ".repeat(indent)`. */
const pad = (depth: number): string => "  ".repeat(depth);

/**
 * The html side's text, with the pretty-printer's own whitespace taken off and nothing else.
 *
 * `nodeToHtml` writes a block's text child as `"\n" + pad(depth + 1) + text`, and whatever follows
 * — the next child or the closing tag — begins with `"\n" + pad(…)`. Parsed back, the text node
 * therefore carries that exact prefix and, if it is the last child, the closing tag's `"\n" +
 * pad(depth)` as its suffix. A text node that is *only* that whitespace is the line break between
 * two element children, and disappears.
 */
function unprinted(text: string, depth: number): string | null {
  let out = text;
  const lead = `\n${pad(depth + 1)}`;
  if (out.startsWith(lead)) out = out.slice(lead.length);
  // What follows a text child is either the next child's line — indented one level deeper than
  // the parent — or the parent's closing tag, at the parent's own indent. The deeper one is tried
  // first, because the shallower pad is a suffix of it and would otherwise match early and leave
  // two spaces behind.
  for (const trail of [`\n${pad(depth + 1)}`, `\n${pad(depth)}`]) {
    if (out.endsWith(trail)) {
      out = out.slice(0, out.length - trail.length);
      break;
    }
  }
  return out === "" ? null : out;
}

function describeNode(node: Node): string {
  if (node.nodeType === node.ELEMENT_NODE) {
    const el = node as Element;
    const id = el.getAttribute("data-id") ?? el.getAttribute("data-section") ?? "";
    return `<${el.tagName.toLowerCase()}${id ? ` ${id}` : ""}>`;
  }
  // Trimmed, because `nodeToHtml` writes `<!-- text -->` and a parser keeps those two spaces in
  // the data; the comparison in `same` trims the same way before it escapes.
  if (node.nodeType === node.COMMENT_NODE) return `<!-- ${(node.nodeValue ?? "").trim()} -->`;
  return JSON.stringify(node.nodeValue);
}

/** The children that count on the html side: pretty-print whitespace removed, text unprinted. */
function htmlChildren(parent: Element, depth: number): { node: Node; text: string | null }[] {
  const out: { node: Node; text: string | null }[] = [];
  for (const child of parent.childNodes) {
    if (child.nodeType === child.TEXT_NODE) {
      const text = unprinted(child.nodeValue ?? "", depth);
      if (text === null) continue;
      out.push({ node: child, text });
    } else {
      out.push({ node: child, text: null });
    }
  }
  return out;
}

function same(fromHtml: Node, fromDom: Node, depth: number, path: string): void {
  const where = `${path} › ${describeNode(fromDom)}`;
  expect(fromHtml.nodeType, `${where}: node type`).toBe(fromDom.nodeType);

  if (fromDom.nodeType === fromDom.COMMENT_NODE) {
    expect((fromHtml.nodeValue ?? "").trim(), `${where}: comment`).toBe(
      escapeHtml(fromDom.nodeValue ?? ""),
    );
    return;
  }

  if (fromDom.nodeType === fromDom.TEXT_NODE) {
    // The caller has already unprinted the html side; here the two strings must be equal.
    expect(fromHtml.nodeValue, `${where}: text`).toBe(fromDom.nodeValue);
    return;
  }

  const a = fromHtml as Element;
  const b = fromDom as Element;
  expect(a.tagName, `${where}: tag`).toBe(b.tagName);

  const names = (el: Element) => [...el.attributes].map((attr) => attr.name).sort();
  expect(names(a), `${where}: attribute names`).toEqual(names(b));
  for (const name of names(b)) {
    expect(a.getAttribute(name), `${where}: attribute ${name}`).toBe(b.getAttribute(name));
  }

  const left = htmlChildren(a, depth);
  const right = [...b.childNodes];
  // Described after unprinting, or a block's text child would be reported with the printer's own
  // newline and indentation still on it and fail here on whitespace the walk is about to forgive.
  expect(
    left.map((entry) =>
      entry.text === null ? describeNode(entry.node) : JSON.stringify(entry.text),
    ),
    `${where}: children`,
  ).toEqual(right.map(describeNode));

  for (const [index, entry] of left.entries()) {
    const twin = right[index];
    if (twin === undefined) throw new Error(`${where}: child ${index} has no twin`);
    if (entry.text !== null) {
      expect(entry.text, `${where} › child ${index}: text`).toBe(twin.nodeValue);
    } else {
      same(entry.node, twin, depth + 1, where);
    }
  }
}

/** Both targets over one document and one set of options, compared root by root. */
function assertParity(
  doc: Parameters<typeof render>[0],
  options: Parameters<typeof render>[2] = {},
  label = "",
): void {
  // Built in an inert document, which is how the editor will build it (adjustment 4) and which
  // keeps happy-dom from trying to load any photograph named in a fixture.
  const inert = document.implementation.createHTMLDocument("");
  const fragment = render(doc, "dom", { ...options, document: inert });
  const { html } = render(doc, "html", options);
  const parsed = new DOMParser().parseFromString(html, "text/html");

  // The body's roots are the fragment's roots: the menu, when there is one, and `<main>`. Every
  // root is an element — `treeToFragment` appends `nodeToDom` results and nothing else — so any
  // text at this level is the page skeleton's: the newline between two roots, and the
  // `"\n</body>\n</html>\n"` tail that an HTML parser folds back into the body. Dropped here
  // on the html side, and asserted absent on the dom side so the rule cannot hide a real text root.
  const allRoots = [...parsed.body.childNodes].filter(
    (node) => !(node.nodeType === node.TEXT_NODE && (node.nodeValue ?? "").trim() === ""),
  );
  // **The one divergence the two targets have, and it is a decision** (ADR 0058): a page that
  // draws a header ends its body with the header's script, and the dom target — the editor's canvas
  // — never carries it. Asserted as exactly that: the last root, the constant, present where and
  // only where a header is drawn; then set aside so everything before it is still compared node for
  // node.
  const last = allRoots.at(-1);
  const scriptRoot = last && (last as Element).tagName === "SCRIPT" ? (last as Element) : undefined;
  expect(scriptRoot !== undefined, `${label}: script present ≠ header drawn`).toBe(
    headerDrawn(doc),
  );
  if (scriptRoot)
    expect(scriptRoot.textContent, `${label}: not the header's script`).toBe(HEADER_SCRIPT);
  const roots = scriptRoot ? allRoots.slice(0, -1) : allRoots;
  expect(
    [...fragment.childNodes].every((node) => node.nodeType === node.ELEMENT_NODE),
    `${label}: the dom target has a non-element root`,
  ).toBe(true);
  expect(roots.map(describeNode), `${label} roots`).toEqual(
    [...fragment.childNodes].map(describeNode),
  );
  for (const [index, root] of roots.entries()) {
    const twin = fragment.childNodes[index];
    if (twin === undefined) throw new Error(`${label}: root ${index} has no twin`);
    // Each root is itself printed at indent 0, so its children sit at depth 1.
    same(root, twin, 0, label || "document");
  }
}

describe("the dom target paints exactly what the html target publishes", () => {
  it.each(corpus.map((entry) => entry.name))("on %s, every page", (name) => {
    const entry = corpus.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`missing fixture ${name}`);
    for (const page of entry.document.pages) {
      assertParity(entry.document, { pageId: page.id }, `${name} / ${page.id}`);
    }
  });

  it.each(corpus.map((entry) => entry.name))("on %s with the editor's entry hints", (name) => {
    // The one option only the editor turns on (ADR 0033 §10), and so the one shape the published
    // page never has and the canvas always does — exactly the pair this file exists to compare.
    const entry = corpus.find((candidate) => candidate.name === name);
    if (!entry) throw new Error(`missing fixture ${name}`);
    for (const page of entry.document.pages) {
      assertParity(
        entry.document,
        { pageId: page.id, entryHints: true },
        `${name} / ${page.id} / hints`,
      );
    }
  });

  it("on a hundred generated covers", () => {
    // **The theme is a fixture's, because the theme is not what this compares.** `arbitraryTheme`
    // writes every token as `key-<suffix>` with an arbitrary string, and the html target's CSS
    // emitter refuses most of those — rightly, and with a thrown error (`buildCss`). A property
    // that skipped them would starve; one that let the dom target paint a document the html target
    // refuses would be comparing nothing. This walk compares the **body**, never the stylesheet, so
    // every generated document gets a theme a real site has and the hundred runs stay a hundred.
    const published = corpus.find((entry) => entry.name === "cover-and-services");
    if (!published) throw new Error("missing fixture cover-and-services");
    const theme = published.document.theme;
    fc.assert(
      fc.property(arbitraryDocument(cover, "image-right"), (generated) => {
        assertParity({ ...generated, theme }, {}, "generated");
      }),
      { numRuns: 100 },
    );
  });

  /**
   * A guard on the guard: the walk has to have looked at something. A corpus whose fixtures all
   * rendered to an empty body would pass every `same` above by comparing nothing to nothing.
   */
  it("actually compares nodes, and plenty of them", () => {
    const entry = corpus.find((candidate) => candidate.name === "cover-and-services");
    if (!entry) throw new Error("missing fixture cover-and-services");
    const inert = document.implementation.createHTMLDocument("");
    const fragment = render(entry.document, "dom", { document: inert });
    // A floor and not a measurement: the fixture has nineteen elements today, and anything under
    // ten means the corpus has been gutted rather than edited.
    expect(fragment.querySelectorAll("*").length).toBeGreaterThan(10);
  });
});
