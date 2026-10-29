import { flattenElements, type RetorikaDocument } from "@retorika/schema";
import { buildCss, buildTree, pageTitleFor, resolvePage } from "./build.ts";
import { treeToFragment } from "./dom.ts";
import { fontFilesFor } from "./fonts.ts";
import { headerDrawn } from "./header.ts";
import { HEADER_SCRIPT } from "./headerScript.ts";

export type { OwnFace } from "./fonts.ts";
export {
  fontFilesFor,
  ownFaceFile,
  ownFacesFor,
  ownFontsFor,
  SHIPPABLE_FAMILIES,
  shippedFontFilesFor,
} from "./fonts.ts";

import { headMetaOf } from "./head.ts";
import { pageToHtml } from "./html.ts";
import { type DomRenderOptions, type RenderOptions, withDefaults } from "./options.ts";

/**
 * **The page's stylesheet on its own, and the `@font-face` half of it** (ADR 0051, sprint 26
 * día 1). The editor keeps one document for the whole session and patches it; a patch rewrites
 * the `<style>`'s text when the document's CSS changed, and needs that text without asking the
 * `html` target for a page it is not going to parse. `fontFaceCss` is exported beside it for the
 * fallback the plan names: if rewriting a stylesheet whose font rules did not change makes the
 * faces flash, the two halves go in two elements and only the second is rewritten.
 */
export { buildCss } from "./build.ts";
export { escapeHtml, NEUTRALISED_URL, safeUrl } from "./escape.ts";
export { FAVICON_PATH, faviconLetter, faviconSvg } from "./favicon.ts";
export { fontFaceCss } from "./fonts.ts";
/**
 * **What the menu would call a section, and how much of a menu is left**, for the places in the
 * editor that have to show it: the switch that takes a section out (ADR 0043 §3), the one per page
 * row beside it, and the count said out loud next to both.
 *
 * Exported rather than re-derived there. Which sections lend an anchor is a rule with five clauses,
 * and whether a menu is drawn at all is now three questions in a particular order — two copies of
 * either would drift the first time one changed, and the copy in the editor is the one that would
 * be telling somebody a number while they decide.
 */
export type { ActionEntry, HeaderSettings } from "./header.ts";
export {
  actionEntry,
  headerDrawn,
  headerPhoneRow,
  headerSettings,
  homeMenuLabel,
} from "./header.ts";
export { HEADER_SCRIPT } from "./headerScript.ts";
export type { PageEntry, SectionEntry } from "./menu.ts";
export {
  hasMenu,
  MENU_MIN_ENTRIES,
  menuIsCurated,
  pageLabel,
  pageMenuEntries,
  sectionLabel,
  sectionMenuEntries,
} from "./menu.ts";
export type { DomRenderOptions, RenderOptions } from "./options.ts";
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
  options?: DomRenderOptions,
): DocumentFragment;
export function render(
  doc: RetorikaDocument,
  target: "html" | "dom",
  options: DomRenderOptions = {},
): HtmlOutput | DocumentFragment {
  const resolved = withDefaults(options);
  const tree = buildTree(doc, resolved);

  if (target === "dom") {
    // The document the nodes are born in — see `DomRenderOptions` for why an editor passes an
    // inert one. Unset, the global `document`, as every caller before sprint 26 got.
    const host = options.document ?? (typeof document === "undefined" ? undefined : document);
    if (host === undefined) {
      // Explicit rather than a confusing null-reference failure deep in the walk.
      throw new Error('render(doc, "dom") needs a DOM; use the "html" target outside a browser');
    }
    return treeToFragment(tree, host);
  }

  const css = buildCss(doc);
  const page = resolvePage(doc, resolved.pageId);
  // On a page drawn per entry the words are the entry's title field (ADR 0040 §4).
  const title = titleFor({ title: pageTitleFor(doc, page, resolved.entryId) }, doc.siteName);
  return {
    html: pageToHtml(
      tree,
      css,
      title,
      headMetaOf(doc, title, resolved.pagePath),
      headerDrawn(doc) ? HEADER_SCRIPT : undefined,
    ),
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
