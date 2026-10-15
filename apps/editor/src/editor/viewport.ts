import { PHONE_BREAKPOINT } from "./overflowCheck.ts";

/**
 * The one place the application asks «is this window a phone?» in JavaScript (ADR 0042).
 *
 * **The number is the renderer's, not a new one.** A window at or below `PHONE_BREAKPOINT` is one
 * where the published site itself would be showing its phone layout, so «la vista de móvil» in the
 * editor and «un móvil» holding the editor mean exactly the same width. `globals.css` declares the
 * same boundary as the `phone:` variant for the Tailwind side, and `test/canvasZoom.test.ts` reads
 * both and fails if they ever disagree — the arrangement `PHONE_BREAKPOINT` itself already has with
 * the renderer's CSS.
 *
 * `matchMedia` rather than `innerWidth`, so the answer is the one the stylesheet is acting on at
 * that moment: a `resize` listener comparing a number can disagree with CSS by a pixel of scrollbar.
 * `false` on the server, where there is no window and nothing is drawn.
 */
export const PHONE_MEDIA = `(max-width: ${PHONE_BREAKPOINT}px)`;

export function isPhoneViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia(PHONE_MEDIA).matches;
}
