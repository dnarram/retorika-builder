import type { ContentElement, RetorikaDocument } from "@retorika/schema";

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
 * repository that forgot to look there has been a defect.
 */
export function withPhotoUrls(
  doc: RetorikaDocument,
  photoUrls: ReadonlyMap<string, string>,
): RetorikaDocument {
  if (photoUrls.size === 0) return doc;

  const swap = (element: ContentElement): ContentElement => {
    if (element.items) {
      return {
        ...element,
        items: element.items.map((item) => ({
          ...item,
          elements: item.elements.map(swap),
        })),
      };
    }
    if (element.value?.kind !== "image") return element;
    const url = photoUrls.get(element.value.src);
    return url ? { ...element, value: { ...element.value, src: url } } : element;
  };

  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        content: section.content.map(swap),
      })),
    })),
  };
}
