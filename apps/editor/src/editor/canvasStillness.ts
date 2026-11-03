/**
 * **The canvas is still** (ADR 0051 §3; David's adjustment 2 of sprint 32): the rules the editor
 * writes over the site's own stylesheet inside the frame so that nothing the published page animates
 * runs where the editor measures and drags. Here, as data, so a test can hold them against what the
 * renderer animates.
 *
 * - The published page scrolls smoothly where a header is drawn (ADR 0057); the canvas must not. The
 *   editor scrolls the frame itself — to the section the hand chose, to the bar it just drew — and
 *   measures where things landed in the next frame; an animation under those reads put the verbs'
 *   handle 39px from where the sprint 20 walk expects it.
 * - The published page's sections come in as the visitor scrolls (ADR 0062); the canvas must not. An
 *   animation in flight owns `transform` and `opacity`: the drag of sprint 25 writes `transform`
 *   inline and would stop moving the element, `measurePlaced` and the handles, guides and `rowAt`
 *   would read positions 16 px low, and every walk that measures a box would go intermittent with the
 *   scroll. The renderer already writes none of it for the `"dom"` target (`buildCss`); this is the
 *   canvas's own refusal, for any section animation that reaches the frame by another road.
 *
 * `!important` because the renderer's rules sit on the same elements, and this sheet is the editor's
 * to win.
 */
export const CANVAS_STILLNESS: readonly string[] = [
  "html { scroll-behavior: auto !important; }",
  "main > .rb-section > * { animation: none !important; }",
];
