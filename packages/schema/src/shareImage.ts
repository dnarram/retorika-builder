import type { ContentElement, RetorikaDocument } from "./document.ts";
import { flattenElements } from "./invariants.ts";

/**
 * The photograph a shared link would show, if the document has one (ADR 0029).
 *
 * **Defined once because two things ask it.** The editor asks in order to warn that a picture is
 * heavy for a preview card; the renderer asks in order to emit `og:image`. Two functions answering
 * «which picture represents this site» would be two answers the day one of them changed, which is
 * the duplication this repository keeps finding and naming.
 *
 * **The first visible image on the first page**, which is the cover's photograph in every document
 * this product generates — and stays the right answer when it is not. A cover can be deleted
 * (ADR 0003), and then the first picture a visitor meets is whatever is now at the top; that is
 * also the one a preview card should show. Reading order, not a slot name, is what makes it
 * deterministic without the schema having to learn what a cover is, which it must not.
 *
 * Hidden elements are skipped: rule 3 keeps them in the document so the owner can find them again,
 * and a card showing a picture the page does not would be the preview disagreeing with the site.
 */
export function shareImageOf(
  doc: RetorikaDocument,
): { src: string; alt: string; elementId: string } | undefined {
  const page = doc.pages[0];
  if (!page) return undefined;
  for (const section of page.sections) {
    for (const element of flattenElements(section.content)) {
      const found = imageOf(element);
      if (found) return found;
    }
  }
  return undefined;
}

function imageOf(
  element: ContentElement,
): { src: string; alt: string; elementId: string } | undefined {
  if (element.hidden) return undefined;
  const value = element.value;
  if (value?.kind !== "image") return undefined;
  return { src: value.src, alt: value.alt, elementId: element.id };
}
