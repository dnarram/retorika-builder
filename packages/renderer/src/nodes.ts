/**
 * The one node tree both targets are built from.
 *
 * Protocol Part 3.2: if two renderers exist they diverge, and the user sees one thing
 * while editing and another once published. So the document is turned into this tree
 * once, and each target only knows how to walk it.
 */

export interface RenderNode {
  tag: string;
  attributes: Record<string, string>;
  children: (RenderNode | string)[];
  /** Emitted as an HTML comment by the html target, and as a comment node by the dom target. */
  comment?: string;
}

export function element(
  tag: string,
  attributes: Record<string, string>,
  children: (RenderNode | string)[] = [],
): RenderNode {
  return { tag, attributes, children };
}

export function commentNode(text: string): RenderNode {
  return { tag: "#comment", attributes: {}, children: [], comment: text };
}

export function isComment(node: RenderNode): boolean {
  return node.tag === "#comment";
}
