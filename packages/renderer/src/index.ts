import { flattenElements, type RetorikaDocument } from "@retorika/schema";
import { buildCss, buildTree, resolvePage } from "./build.ts";
import { treeToFragment } from "./dom.ts";
import { fontFilesFor } from "./fonts.ts";

export { fontFilesFor, SHIPPABLE_FAMILIES } from "./fonts.ts";

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
  /**
   * The font files this page's stylesheet names, as names inside `fonts/`.
   *
   * **A channel of its own, and not a kind of asset, because a font has nothing to be collected
   * from.** `assets` is built by walking elements for an image `src`; a face is named by the CSS the
   * theme produced, so there is no element, no `src`, and nothing for `collectAssets` to find. Putting
   * fonts in `assets` would also make `assetPathFor` learn a font extension, and
   * `publisher/test/site.test.ts` asserts that a document of only `data:` images produces **no** file
   * under `assets/` — true today and worth keeping true.
   *
   * Empty for every document that names no shippable family, which is what keeps a site on
   * `editorial-serif` carrying zero font bytes.
   */
  fonts: string[];
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
  const page = resolvePage(doc, resolved.pageId);
  return {
    html: pageToHtml(tree, css, titleFor(page, doc.siteName)),
    css,
    assets: collectAssets(doc),
    fonts: fontFilesFor(doc),
  };
}

/**
 * The `<title>` for one page: the business name alone, or the page's own title in front of it
 * when the page says something the business name does not already say.
 *
 * Every document the generator has ever produced has exactly one page, whose title is the
 * business name (`packages/generator/src/index.ts` sets both from `answers.businessName`), so
 * this is a no-op for every fixture the golden corpus holds today — verified by the corpus not
 * moving. It stops being a no-op the day a converted page exists, whose title is the heading the
 * owner gave the section it came from.
 *
 * The page's own words go first: a browser tab or a history entry shows the start of a long
 * title first, and "Nuestra carta" is what tells two tabs of the same site apart — the business
 * name is what both tabs already share.
 */
function titleFor(page: { title: string }, siteName: string): string {
  return page.title === siteName ? siteName : `${page.title} — ${siteName}`;
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
