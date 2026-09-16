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

export function nodeToHtml(node: RenderNode, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (isComment(node)) return `${pad}<!-- ${escapeHtml(node.comment ?? "")} -->`;

  const open = `${pad}<${node.tag}${attributesToString(node.attributes)}>`;
  if (VOID_TAGS.has(node.tag)) return open;

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
export function pageToHtml(body: RenderNode, css: string, title: string): string {
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
    nodeToHtml(body),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
