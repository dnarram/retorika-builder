import { buildCss, HEADER_SCRIPT, type HtmlOutput } from "@retorika/renderer";
import { type RetorikaDocument, rewriteImageSources } from "@retorika/schema";

/**
 * A copy of the document with every photograph's bundle name swapped for the object URL of its
 * bytes — what a preview needs, and what a published site must never contain.
 *
 * The document itself keeps the bundle-relative name (`foto-…jpg`, `muestra-….webp`), which is
 * what the ZIP is built from. A preview cannot use that name: an `<iframe srcDoc>` resolves a
 * relative path against the *parent* page's URL, so `muestra-restaurante-bar.03.webp` becomes a
 * request to the app's own root and 404s. The placeholder escapes this by being a `data:` URI,
 * self-contained and needing no file — which is exactly why nothing needed this function until
 * photographs started coming from the bank.
 *
 * **Shared, rather than written once per screen, because the day it was not shared it was wrong.**
 * The editor had this logic inline and the three "elige por dónde empezar" cards rendered the raw
 * document, which was harmless for as long as a generated site's only image was the placeholder
 * — and became a broken image on all three cards the moment the generator started asking the bank.
 * Found in the browser on the day it started mattering, the same way a gallery's photographs were
 * found 404ing in sprint 5. One function now, so the next screen cannot get it wrong separately.
 *
 * Recursive into list items: a gallery keeps each photograph inside one, and every walk in this
 * repository that forgot to look there has been a defect. **And into the header** (ADR 0059): the
 * logo is a `src` the preview has to swap like any photograph's, through the schema's one rewrite,
 * so that a frame drawn from `srcDoc` shows the logo and not a 404 against the editor's own root.
 */
export function withPhotoUrls(
  doc: RetorikaDocument,
  photoUrls: ReadonlyMap<string, string>,
): RetorikaDocument {
  if (photoUrls.size === 0) return doc;
  return rewriteImageSources(doc, (src) => photoUrls.get(src) ?? src);
}

/** A face the owner brought, as the renderer writes its `src` — the one shape this substitutes. */
const OWN_FACE_URL =
  /url\("fonts\/(propia-[0-9a-f]{8}-(?:regular|bold|variable)\.(?:woff2|woff|ttf|otf))"\)/g;

/** What an object URL looks like, and all it may look like before it is written into CSS: the
 * scheme, an origin, a path of a UUID — nothing that could close the quotes or the `url()`. */
const OBJECT_URL = /^blob:[A-Za-z0-9:/._-]+$/;

/**
 * The page's text — the first paint's html, or a patch's stylesheet — with each face the owner
 * brought pointed at the object URL of its bytes (ADR 0056, sprint 29 día 5).
 *
 * The photographs' problem, met in the stylesheet: the renderer writes `url("fonts/propia-…")`,
 * relative, which is what a ZIP needs, and a `srcDoc` frame would resolve it against the editor's
 * own page and get a 404. The gallery's faces are answered by the editor's `fonts/[file]` route;
 * the owner's are not on any server, so they are swapped here, in the text, **only where the map
 * has the file** — a face whose bytes have not arrived keeps its relative name and the canvas draws
 * the fallback, which is the truth about it.
 *
 * Text rather than a document, because the patch path hands `patchCanvas` a stylesheet string and
 * the first paint an html string, and the `@font-face` rules are the same lines in both. An object
 * URL is stable for as long as its entry lives, so `splitFontFaces` sees the same font sheet on a
 * palette change and re-declares nothing (`patchCanvas.test.ts`).
 */
export function withFontUrls(text: string, fontUrls: ReadonlyMap<string, string>): string {
  if (fontUrls.size === 0) return text;
  return text.replace(OWN_FACE_URL, (whole, file: string) => {
    const url = fontUrls.get(file);
    if (url === undefined) return whole;
    if (!OBJECT_URL.test(url)) throw new Error(`withFontUrls: "${url}" is not an object URL`);
    return `url("${url}")`;
  });
}

/** The published page's one script as `html.ts` writes it, on a line of its own before `</body>`. */
const PUBLISHED_SCRIPT = `<script>${HEADER_SCRIPT}</script>\n`;

/**
 * The first paint of the canvas: the published page's html with **the canvas's stylesheet** in place
 * of the published one (sprint 32 día 1, ADR 0063), **and without its script** (sprint 33 día 1).
 *
 * **The stylesheet.** The two sheets differ in one block — the header's anchor-positioned indicator,
 * written for the `html` target only — and the frame must not carry it: bisected over eight runs of
 * one walk, the mere presence of `anchor()`, `anchor-size()` and `position-anchor` in the frame's
 * sheet, in rules that matched nothing, broke Chromium's scroll anchoring across the frame's
 * re-layout and moved the section being edited 29 px when a panel closed. The patches that follow
 * the first paint already carry `buildCss(doc, "dom")`; this makes the first paint carry the same
 * sheet, so the frame never sees the other one.
 *
 * **The script, because the canvas runs nothing of the published page's** (ADR 0058 §4). It was in
 * the first paint from the day it was written (sprint 30 día 2) until sprint 33 día 1, because this
 * html is the published one, and measured in the editor it did what a visitor's browser does: it
 * marked `<html>` with `data-rb-js`, wrote `--rb-header-h` from the bar, condensed a fixed bar once
 * the canvas scrolled and marked the section in view — the last two being what the «Menú» panel
 * tells the owner the canvas does not do — and it wired Escape and a press outside for the
 * disclosures the frame held when it loaded, and for no other. A «Menú» born in the session, when
 * the owner adds a second page, was a sheet nothing closed. What the canvas needs of that behaviour
 * the editor does itself, for every disclosure at any time (`wireDisclosures` in `Editor.tsx`).
 *
 * Both swaps are exact or they throw: a sheet that is not found once, verbatim, would leave the frame
 * with the published one and nobody the wiser, and a script that is not the header's one constant is
 * nothing this function knows how to keep out of the frame.
 */
export function canvasHtml(doc: RetorikaDocument, published: HtmlOutput): string {
  const { html, css } = published;
  const at = html.indexOf(css);
  if (at === -1 || html.indexOf(css, at + 1) !== -1) {
    throw new Error("the published page's stylesheet was not found exactly once in its html");
  }
  const swapped = html.slice(0, at) + buildCss(doc, "dom") + html.slice(at + css.length);
  const scripts = swapped.split("<script").length - 1;
  if (scripts === 0) return swapped;
  const script = swapped.indexOf(PUBLISHED_SCRIPT);
  if (scripts !== 1 || script === -1) {
    throw new Error("the published page carries a script that is not the header's one constant");
  }
  return swapped.slice(0, script) + swapped.slice(script + PUBLISHED_SCRIPT.length);
}
