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
}

/** `allowEmbeds` resolved; `pageId` stays optional because "unset" is itself a meaningful value
 * (the first page) and not a gap to be filled in. */
export type ResolvedRenderOptions = Omit<Required<RenderOptions>, "pageId" | "pagePath"> &
  Pick<RenderOptions, "pageId" | "pagePath">;

export const DEFAULT_RENDER_OPTIONS: ResolvedRenderOptions = {
  allowEmbeds: false,
};

export function withDefaults(options: RenderOptions = {}): ResolvedRenderOptions {
  return { ...DEFAULT_RENDER_OPTIONS, ...options };
}
