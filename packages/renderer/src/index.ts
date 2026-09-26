import { flattenElements, type RetorikaDocument } from "@retorika/schema";
import { buildCss, buildTree } from "./build.ts";
import { treeToFragment } from "./dom.ts";
import { pageToHtml } from "./html.ts";
import { type RenderOptions, withDefaults } from "./options.ts";

export { escapeHtml, NEUTRALISED_URL, safeUrl } from "./escape.ts";
export type { RenderOptions } from "./options.ts";
export { DEFAULT_RENDER_OPTIONS } from "./options.ts";

export interface AssetRef {
  /** The path as it appears in the document, before the publisher rewrites it. */
  src: string;
  alt: string;
}

export interface HtmlOutput {
  html: string;
  css: string;
  assets: AssetRef[];
}

/**
 * One renderer, two targets.
 *
 * `"dom"` paints the editor, `"html"` produces the published page, and both are built
 * from the same node tree — because two renderers diverge and the user ends up seeing
 * one thing while editing and another once published (protocol Part 3.2).
 */
export function render(doc: RetorikaDocument, target: "html", options?: RenderOptions): HtmlOutput;
export function render(
  doc: RetorikaDocument,
  target: "dom",
  options?: RenderOptions,
): DocumentFragment;
export function render(
  doc: RetorikaDocument,
  target: "html" | "dom",
  options: RenderOptions = {},
): HtmlOutput | DocumentFragment {
  const resolved = withDefaults(options);
  const tree = buildTree(doc, resolved);

  if (target === "dom") {
    if (typeof document === "undefined") {
      // Explicit rather than a confusing null-reference failure deep in the walk.
      throw new Error('render(doc, "dom") needs a DOM; use the "html" target outside a browser');
    }
    return treeToFragment(tree, document);
  }

  const css = buildCss(doc);
  return {
    html: pageToHtml(tree, css, doc.siteName),
    css,
    assets: collectAssets(doc),
  };
}

/**
 * Every image the page references, items included.
 *
 * It used to walk `section.content` only, which missed an image inside a list item — and
 * `buildSite` uses this list to check, after rendering, that everything the page asks for is in
 * the bundle. So a card's photo was rewritten and bundled correctly by `rewriteImages`, which
 * does recurse, and then skipped by the very check meant to catch a rewrite going wrong. Nothing
 * had photos in cards yet; uploads make that a matter of time rather than of luck.
 */
function collectAssets(doc: RetorikaDocument): AssetRef[] {
  const assets: AssetRef[] = [];
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const el of flattenElements(section.content)) {
        if (el.value?.kind === "image") assets.push({ src: el.value.src, alt: el.value.alt });
      }
    }
  }
  return assets;
}
