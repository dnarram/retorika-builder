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
}

export const DEFAULT_RENDER_OPTIONS: Required<RenderOptions> = {
  allowEmbeds: false,
};

export function withDefaults(options: RenderOptions = {}): Required<RenderOptions> {
  return { ...DEFAULT_RENDER_OPTIONS, ...options };
}
