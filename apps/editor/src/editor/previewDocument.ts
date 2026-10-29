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
