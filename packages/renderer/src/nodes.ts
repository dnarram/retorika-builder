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
  /**
   * Whether this node's children are **inline content**, serialised with nothing between them.
   *
   * The html target pretty-prints: every child goes on its own line, indented. That is harmless
   * while a text element holds one string, and it **corrupts the words** the moment it holds
   * several — which is what a marked run makes it hold. Measured in Chromium on sprint 10 day 4:
   * `<p>` with the children `"Solo"`, `<strong>millo</strong>`, `" al whisky"` pretty-printed
   * renders as **«Solo millo al whisky»**, because HTML collapses the newline and the indentation
   * into a space that is not in the document.
   *
   * So a node holding marks says so, and `nodeToHtml` lays its children end to end. **Nothing else
   * changes**: a text with no marks has one string child, does not set this, and publishes the
   * bytes it published before — which is what keeps the golden corpus still.
   *
   * The dom target ignores it, and correctly: `nodeToDom` never inserted whitespace in the first
   * place, so the two targets already agreed and this is what keeps them agreeing.
   */
  inlineChildren?: boolean;
}

export function element(
  tag: string,
  attributes: Record<string, string>,
  children: (RenderNode | string)[] = [],
): RenderNode {
  return { tag, attributes, children };
}

/** An element whose children are laid end to end rather than pretty-printed. See
 * `RenderNode.inlineChildren` for the measurement that makes this necessary. */
export function inlineElement(
  tag: string,
  attributes: Record<string, string>,
  children: (RenderNode | string)[] = [],
): RenderNode {
  return { tag, attributes, children, inlineChildren: true };
}

export function commentNode(text: string): RenderNode {
  return { tag: "#comment", attributes: {}, children: [], comment: text };
}

export function isComment(node: RenderNode): boolean {
  return node.tag === "#comment";
}
