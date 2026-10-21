/**
 * Options that change what reaches a published page.
 */
export interface RenderOptions {
  /**
   * Whether an `embed` element may emit its payload.
   *
   * **Defaults to false, and stays false in phase 0.** An embed is the only surface on
   * which we publish HTML we cannot escape, so every other guarantee in the renderer
   * assumes it is off. Turning it on needs its own ADR — see docs/document-rules.md.
   */
  allowEmbeds?: boolean;

  /**
   * Which page to draw. Undefined, and left undefined by the defaults below, means the
   * document's first page — there is no sentinel string that could mean that honestly, so
   * "unset" stays unset rather than being forced into `Required` and cast to fit.
   *
   * Sprint 5: the renderer used to draw `doc.pages[0]` unconditionally, which was correct for
   * every document that existed because every document had exactly one page. `packages/publisher`
   * already calls `render` once per page, passing `{ ...doc, pages: [thatPage] }` as its own way of
   * saying "this one" — this option replaces that trick with a real parameter, so a caller can hand
   * over the whole document and just say which page it wants.
   */
  pageId?: string;

  /**
   * What this page's file is called in the bundle — `index.html`, or `<slug>.html`.
   *
   * **Passed in rather than derived, and that is the one rule this option exists to keep.** The
   * publisher decides what a page's file is called, and a second opinion about it here would be an
   * `og:url` that disagrees with the file sitting beside it in the ZIP. Unset is the editor's live
   * preview, where there is no bundle and nothing to link to, so no `og:url` is emitted at all.
   */
  pagePath?: string;

  /**
   * Whether each card drawn from a collection entry says **which entry it is**, as `data-entry`.
   *
   * **Off by default, and the editor is the only caller that turns it on** (ADR 0033 §10). The
   * editor needs it and the document cannot supply it: a binding carries no entry id, and the cards
   * do not exist in the document at all — they are one template drawn N times, so every card shares
   * the template's `data-id`. Without this there is nothing to tell card three from card one, and
   * editing one would write to the wrong entry.
   *
   * **A published page must never carry it**, which is why it defaults to false rather than being
   * stripped later: `buildSite` does not pass it, the golden corpus is generated without it, and
   * `collections.test.ts` in this package asserts the published bytes contain no `data-entry`, no
   * collection name and no entry id. A page that shipped with these would be telling a visitor how
   * the site was built, and ADR 0001's promise is that a published page is just HTML and CSS.
   */
  entryHints?: boolean;

  /**
   * Which entry a page bound to a collection is drawn for (ADR 0040).
   *
   * The page is stored once and drawn once per entry; this names the entry. Unset means the
   * collection's first entry, which is what the editor's canvas shows until the owner picks
   * another and what a caller that only wants *a* drawing gets. The publisher names every entry in
   * turn. Refused with a throw — never a silent fallback — on a page that has no binding, and for
   * an entry the collection does not carry, because either would publish the wrong page.
   */
  entryId?: string;
}

/**
 * What the `"dom"` target additionally takes, and the `"html"` target cannot.
 *
 * **The document the nodes are created in** (ADR 0051, sprint 26 día 1). It is a parameter of the
 * target and not an option of the page: nothing here changes a byte of what is rendered, which is
 * why it does not live in `RenderOptions` above — that interface's own first line is «options that
 * change what reaches a published page», and this one reaches no page at all.
 *
 * It exists because of what a browser does with a node the moment it is created: an `<img src>`
 * made in a document that has a browsing context **fetches its source**, and it fetches it whether
 * or not the node is ever attached. An editor that renders the tree on every edit, to diff it
 * against what is on screen, would therefore fire one request per photograph per keystroke, each
 * for a fragment it is about to discard. A document from `document.implementation
 * .createHTMLDocument("")` has no browsing context and loads nothing; the editor builds the tree
 * there and `importNode`s what it keeps. Unset, the global `document` — which is what every caller
 * before this sprint got, and what a test that only counts sections still wants.
 */
export interface DomRenderOptions extends RenderOptions {
  document?: Document;
}

/** `allowEmbeds` resolved; `pageId` stays optional because "unset" is itself a meaningful value
 * (the first page) and not a gap to be filled in. */
export type ResolvedRenderOptions = Omit<
  Required<RenderOptions>,
  "pageId" | "pagePath" | "entryId"
> &
  Pick<RenderOptions, "pageId" | "pagePath" | "entryId">;

export const DEFAULT_RENDER_OPTIONS: ResolvedRenderOptions = {
  allowEmbeds: false,
  entryHints: false,
};

export function withDefaults(options: RenderOptions = {}): ResolvedRenderOptions {
  return { ...DEFAULT_RENDER_OPTIONS, ...options };
}
