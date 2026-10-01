import { escapeHtml } from "./escape.ts";
import { isComment, type RenderNode } from "./nodes.ts";

/** Elements with no closing tag. */
const VOID_TAGS = new Set(["img", "input", "br", "hr", "meta", "link"]);

function attributesToString(attributes: Record<string, string>): string {
  // Sorted, so the same document always produces the same bytes.
  return Object.keys(attributes)
    .sort()
    .map((name) => ` ${name}="${escapeHtml(attributes[name] ?? "")}"`)
    .join("");
}

/**
 * Inline content, end to end: no newline and no indentation anywhere inside.
 *
 * **Every string still goes through `escapeHtml`, one piece at a time**, which is the whole of what
 * ADR 0024 called «the delicate part» — «the string is split, each piece escaped separately, and
 * only the marked pieces wrapped». Splitting a text into marked runs happens in the node tree, so
 * the pieces arrive here as separate children and this function escapes each of them exactly as the
 * block path already escaped the single child it used to get. There is no second escaping rule and
 * no place where a piece travels unescaped.
 */
function inlineToHtml(child: RenderNode | string): string {
  if (typeof child === "string") return escapeHtml(child);
  if (isComment(child)) return `<!-- ${escapeHtml(child.comment ?? "")} -->`;

  const open = `<${child.tag}${attributesToString(child.attributes)}>`;
  if (VOID_TAGS.has(child.tag)) return open;
  return `${open}${child.children.map(inlineToHtml).join("")}</${child.tag}>`;
}

export function nodeToHtml(node: RenderNode, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (isComment(node)) return `${pad}<!-- ${escapeHtml(node.comment ?? "")} -->`;

  const open = `${pad}<${node.tag}${attributesToString(node.attributes)}>`;
  if (VOID_TAGS.has(node.tag)) return open;

  // The node keeps its own place in the indented layout; only what is *inside* it is laid end to
  // end. Pretty-printing between inline children inserts whitespace the document does not contain,
  // and HTML collapses it into a space in the middle of a word.
  if (node.inlineChildren) {
    return `${open}${node.children.map(inlineToHtml).join("")}</${node.tag}>`;
  }

  const children = node.children.map((child) =>
    typeof child === "string" ? `${pad}  ${escapeHtml(child)}` : nodeToHtml(child, indent + 1),
  );

  if (children.length === 0) return `${open}</${node.tag}>`;
  return [open, ...children, `${pad}</${node.tag}>`].join("\n");
}

/**
 * A complete, self-contained page.
 *
 * ADR 0001: the CSS is inlined and there is no script tag, so the file works when opened
 * by double-clicking it, with no server and no network.
 */
export function pageToHtml(body: readonly RenderNode[], css: string, title: string): string {
  return [
    "<!doctype html>",
    '<html lang="es">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    css.trimEnd(),
    "</style>",
    "</head>",
    "<body>",
    ...body.map((node) => nodeToHtml(node)),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
