import type { ContentElement, RetorikaDocument } from "./document.ts";
import { flattenElements } from "./invariants.ts";

/**
 * Every image a document names, in one list (ADR 0059).
 *
 * **Until the logo, an image was an element and nothing else**, and twelve places in this
 * repository walked `pages → sections → flattenElements` to find them: the renderer's
 * `collectAssets`, the publisher's rewrite, the download route's two readers, the editor's five
 * lists and the account's reconciliation among them. Twelve copies of one walk were already one
 * defect each time a photograph moved into a list item (sprint 5 found three in a day). The logo is
 * the first `src` that lives outside `sections[].content` — on `header.brand.logo` — and twelve
 * walks that each had to learn it would have been twelve chances to forget: the one that forgets
 * in `listOwnPhotoSrcs` makes the account's reconciliation **delete the logo from the bucket** on
 * the next save, because the plan removes what the document does not name.
 *
 * So the walk is written once, here, and every reader calls it. The third use is what makes the
 * abstraction worth having; there are thirteen.
 *
 * **The logo comes first**: it is the first image a visitor meets on every page. The elements
 * follow in reading order — page, section, element, items included — which is the order every
 * list in the editor already shows them in.
 */

export type ImageSource =
  /** An image element, wherever it sits. `sample` is the photobank's id when the bytes are ours. */
  | {
      kind: "element";
      src: string;
      alt: string;
      sample?: string;
      pageId: string;
      sectionId: string;
      elementId: string;
    }
  /** The header's logo: the owner's bytes, never a sample, its `alt` derived from the site name
   * at render time (ADR 0057 §6) and reported here as that name. */
  | { kind: "logo"; src: string; alt: string };

export function imageSourcesOf(doc: RetorikaDocument): ImageSource[] {
  const sources: ImageSource[] = [];
  const logo = doc.header?.brand?.logo;
  if (logo) sources.push({ kind: "logo", src: logo.src, alt: doc.siteName });
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        const value = element.value;
        if (value?.kind !== "image") continue;
        sources.push({
          kind: "element",
          src: value.src,
          alt: value.alt,
          ...(value.sample === undefined ? {} : { sample: value.sample }),
          pageId: page.id,
          sectionId: section.id,
          elementId: element.id,
        });
      }
    }
  }
  return sources;
}

/**
 * A copy of the document with every image `src` passed through `map` — the logo's as well as the
 * elements'. What the publisher does to point a page at `assets/<name>`, and what the editor's
 * preview does to point it at the object URL of the bytes in memory; two rewrites that used to be
 * two walks, each of which would have had to learn the logo on its own.
 *
 * Returns **the same document** when `map` changes nothing, so a caller that keys a render on
 * identity (the editor's canvas) sees no change where there is none. Links are never touched.
 */
export function rewriteImageSources(
  doc: RetorikaDocument,
  map: (src: string) => string,
): RetorikaDocument {
  let changed = false;
  const swap = (element: ContentElement): ContentElement => {
    let next = element;
    if (element.value?.kind === "image") {
      const src = map(element.value.src);
      if (src !== element.value.src) {
        changed = true;
        next = { ...element, value: { ...element.value, src } };
      }
    }
    if (element.items) {
      const items = element.items.map((item) => ({
        ...item,
        elements: item.elements.map(swap),
      }));
      next = { ...next, items };
    }
    return next;
  };

  const pages = doc.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => ({
      ...section,
      content: section.content.map(swap),
    })),
  }));

  const logo = doc.header?.brand?.logo;
  let header = doc.header;
  if (header && logo) {
    const src = map(logo.src);
    if (src !== logo.src) {
      changed = true;
      header = { ...header, brand: { ...header.brand, logo: { src } } };
    }
  }

  if (!changed) return doc;
  return { ...doc, pages, ...(header === undefined ? {} : { header }) };
}
