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
    el.appendChild(typeof child === "string" ? doc.createTextNode(child) : nodeToDom(child, doc));
  }
  return el;
}

export function treeToFragment(node: RenderNode, doc: Document): DocumentFragment {
  const fragment = doc.createDocumentFragment();
  fragment.appendChild(nodeToDom(node, doc));
  return fragment;
}
