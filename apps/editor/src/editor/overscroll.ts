/**
 * **The room the canvas needs at the end of the page so that zooming out never clamps the scroll**
 * (sprint 28 día 1).
 *
 * The canvas card is scaled down when a panel takes its room (`EditorShell`), and its height is
 * `100 / zoom %` so the shrunk card still fills the row. That makes the frame's viewport **taller in
 * the page's own pixels** — at a 1024 window with «Diseño» open, 654 → 909 — so the greatest
 * `scrollTop` the page allows shrinks by the same amount, and a section near the end of the page that
 * was at the top of the view is pushed down to make the page's end meet the viewport's bottom.
 * Measured on 26 October 2026: `scrollY` 1895 → 1754 (the new maximum exactly), the section's top
 * 0 → 166 in the frame. With a section in the middle of the page nothing moved, and at 1280 and 1600,
 * where the zoom stays 1, nothing moved either: the browser's own scroll anchoring absorbs the
 * re-flow (`overflow-anchor: auto`) as long as nothing clamps the scroll first. The clamp, not the
 * re-flow, was the 164 px the backlog has carried since sprint 24.
 *
 * So the page is given exactly the room the viewport gained: `rowHeight × (1 / zoom − 1)` frame
 * pixels, drawn as editor chrome after the last section (`.rb-overscroll`, never in the published
 * page). The greatest scroll then stays what it was across a change of zoom, nothing is clamped,
 * and anchoring does the rest. At zoom 1 the room is zero and the preview is the page, as before.
 *
 * `rowHeight` is the height the canvas row has on the editor's page (screen pixels), which is what
 * the card fills; the frame's own `innerHeight` is deliberately not read here, because reading it
 * forces the frame's layout — and the clamp happens *in* that layout, before any room could be given.
 */
export function overscrollFor(rowHeight: number, zoom: number): number {
  if (!(rowHeight > 0) || !(zoom > 0) || zoom >= 1) return 0;
  return rowHeight * (1 / zoom - 1);
}
