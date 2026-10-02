import {
  type RetorikaDocument,
  shareDescriptionOf,
  shareImageIssue,
  shareImageOf,
} from "@retorika/schema";

/**
 * What a published page says about itself when somebody shares the link (ADR 0029).
 *
 * **Why this is a module and not six lines inside `pageToHtml`:** every one of these tags is
 * conditional, and each condition is a decision somebody made for a reason. Written inline they
 * would read as a pile of `&&`s; written here each one can say what it is protecting.
 */

/** The tags, decided. Absent means «do not emit», which is different from empty. */
export interface HeadMeta {
  description?: string;
  ogTitle: string;
  ogImage?: string;
  ogUrl?: string;
}

/**
 * **`og:image` and `og:url` need an origin, and a ZIP does not have one.**
 *
 * `siteUrl` is the owner's answer to «where is this going to live», which is the only way a
 * downloaded site can carry an absolute URL — and absolute is not a preference: WhatsApp and every
 * other scraper refuse a relative `og:image`. It is **not** `buildSite`'s `baseUrl`, which says
 * where *this build* is served from and is omitted for a download; reading one as the other would
 * put a sitemap in a ZIP.
 *
 * `pagePath` comes from the publisher rather than being computed here, and that is the day's one
 * real trap. The publisher decides what a page's file is called (`index.html`, then `<slug>.html`),
 * and a second opinion about it in the renderer would be a link that disagrees with the file beside
 * it. No path given means no `og:url` — which is exactly the editor's live preview, where there is
 * no bundle and no page to link to.
 */
export function headMetaOf(
  doc: RetorikaDocument,
  title: string,
  pagePath: string | undefined,
): HeadMeta {
  const meta: HeadMeta = { ogTitle: title };

  const description = shareDescriptionOf(doc);
  if (description !== undefined) meta.description = description;

  const origin = doc.siteUrl;
  if (origin === undefined) return meta;

  // The home page is served at the origin itself, which is also the string the owner was shown in
  // the `Compartir` panel. Every other page is the file the publisher named.
  if (pagePath !== undefined) {
    meta.ogUrl = pagePath === "index.html" ? origin : `${origin}/${pagePath}`;
  }

  const image = shareImageOf(doc);
  // **Inside `buildSite` this `src` is already the bundle's path**, because `rewriteImages` runs
  // over the document before any page is rendered. So the absolute URL is the origin and the file,
  // with no second way of naming a path anywhere.
  if (image && shareImageIssue(image.src) === undefined) {
    meta.ogImage = `${origin}/${image.src}`;
  }
  return meta;
}
