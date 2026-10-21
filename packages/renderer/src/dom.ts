import { isComment, type RenderNode } from "./nodes.ts";

/**
 * The same tree, as live DOM nodes for the editor.
 *
 * No escaping happens here and none is needed: `createTextNode` and `setAttribute` do
 * not parse markup, so user content cannot become structure. That is the same guarantee
 * the html target gets from escaping, reached a different way.
 */
export function nodeToDom(node: RenderNode, doc: Document): Node {
  if (isComment(node)) return doc.createComment(node.comment ?? "");

  const el = doc.createElement(node.tag);
  for (const name of Object.keys(node.attributes).sort()) {
    el.setAttribute(name, node.attributes[name] ?? "");
  }
  for (const child of node.children) {
    // An empty string makes no node (ADR 0051, sprint 26 día 1). The html target prints it as a
    // line with nothing on it, which no parser turns into a text node — so a page parsed from the
    // html has no node there, and a fragment that did would be a tree the editor's patch kept
    // adding and removing for nothing. The parity test is what found it, on a generated button
    // with an empty label; it is the one structural difference the two targets ever had.
    if (child === "") continue;
    el.appendChild(typeof child === "string" ? doc.createTextNode(child) : nodeToDom(child, doc));
  }
  return el;
}

/** A fragment holding every root the page has — since sprint 5 day 5 that is the menu and
 * `<main>`, rather than `<main>` alone. */
export function treeToFragment(nodes: readonly RenderNode[], doc: Document): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  for (const node of nodes) fragment.appendChild(nodeToDom(node, doc));
  return fragment;
}
