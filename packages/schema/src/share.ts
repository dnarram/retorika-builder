import type { ContentElement, RetorikaDocument } from "./document.ts";
import { flattenElements } from "./invariants.ts";

/**
 * What a shared link says about a site, in one place because **four things ask it**: the editor's
 * `Compartir` panel, which shows the owner what will be published; the renderer, which publishes it;
 * and the tests of both. Two functions answering one of these questions would be two answers the
 * day either moved — and the first symptom would be the panel promising something the ZIP does not
 * carry, which is the one failure a preview of what-will-be-published must not have.
 *
 * It lives in `packages/schema` rather than in the renderer because these are questions *about a
 * document*, and the renderer may not be imported by the editor's panel.
 */

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

/**
 * The sentence a shared link shows, which the owner may have written and usually has not.
 *
 * **Derived, never copied** (ADR 0029, and ADR 0022's principle before it). `siteDescription` holds
 * a sentence only when somebody chose a different one; otherwise this is the cover's subheadline,
 * read out of the document at the moment of publishing. Nothing is kept in step because nothing is
 * duplicated.
 *
 * **It can be nothing at all, and that is a real answer.** A cover's `subheadline` is `0..1`, so a
 * document may have neither — and no description is better than one invented from the business
 * name, which is a sentence nobody reviewed.
 */
export function shareDescriptionOf(doc: RetorikaDocument): string | undefined {
  const own = doc.siteDescription?.trim();
  if (own) return own;
  for (const section of doc.pages[0]?.sections ?? []) {
    for (const element of section.content) {
      if (element.slot !== "subheadline" || element.hidden) continue;
      const value = element.value;
      if (value?.kind === "text" && value.text.trim() !== "") return value.text.trim();
    }
  }
  return undefined;
}

/** Why a picture cannot be the one a shared link shows. */
export type ShareImageIssue =
  /** A `data:` URI. There is no path to make absolute — the picture is inline in the HTML text,
   *  not a file in the bundle. The catalog's grey marker is one of these. */
  | "inline"
  /** An SVG. Scrapers reject it, and a preview card that renders nothing is worse than a link with
   *  no card at all. */
  | "vector";

/**
 * Whether this `src` can be the picture a shared link shows (ADR 0029 §4).
 *
 * The three refusals that ADR names are **not three separate cases**: the grey marker is a `data:`
 * URI whose payload is an SVG, so it is already excluded twice over. It still gets a test of its own
 * because that protection is incidental — if the marker ever becomes a real file at a path, which
 * the photo bank filling up would make tempting, only a test named after it would notice.
 */
export function shareImageIssue(src: string): ShareImageIssue | undefined {
  if (src.startsWith("data:")) return "inline";
  const withoutQuery = src.split(/[?#]/)[0] ?? "";
  return withoutQuery.toLowerCase().endsWith(".svg") ? "vector" : undefined;
}
