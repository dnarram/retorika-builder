/**
 * The chrome's scale, for the half of the chrome that cannot read a stylesheet.
 *
 * **Why this file has to exist.** The editor draws furniture in two different documents. The rail,
 * the top bar and the side panels live in the application's own page and are styled by
 * `globals.css`, where the scale is a set of `--ui-*` custom properties. The selection outline, the
 * section verbs and the «Añadir sección aquí» pills live **inside the preview iframe**, whose
 * document is written by `packages/renderer` and never sees `globals.css` — `Editor.tsx` injects a
 * `<style>` element into it as a string.
 *
 * A string cannot read a CSS variable from another document, so without this the canvas would
 * carry a second, hand-typed copy of every number, and the two would drift. They already had:
 * before this file, the canvas used 13px, 11px, 9px and 7px corners and three shadows that
 * matched nothing on the other side of the boundary.
 *
 * **`globals.css` stays the source of truth and this is its transcription**, held to it by
 * `test/chromeScale.test.ts`, which reads both and fails if a single value disagrees. The same
 * arrangement `overflowCheck.ts` has with the renderer's breakpoint, and for the same reason: a
 * copied number with nothing holding the copy to its original is a number that will be wrong one
 * day with every test still green.
 *
 * **This cannot reach a client's site (ADR 0001).** The stylesheet it feeds is injected into the
 * live preview only; `render(doc, "html")` never sees it, the ZIP never carries a `.rb-` rule, and
 * `pnpm test:golden` is what keeps saying so.
 */
export const CHROME_SCALE = {
  bg: "#f5f7fa",
  surface: "#ffffff",
  border: "#e8ecf2",
  borderStrong: "#8490a1",
  ink: "#0f172a",
  muted: "#5b6b82",
  brand: "#156fe7",
  brandSurface: "#e8f1fe",
  danger: "#dc2626",

  radiusSm: "8px",
  radius: "12px",
  radiusLg: "16px",
  radiusXl: "20px",

  shadow1: "0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.05)",
  shadow2: "0 2px 4px rgba(15, 23, 42, 0.06), 0 8px 20px rgba(15, 23, 42, 0.09)",
  shadow3: "0 10px 20px rgba(15, 23, 42, 0.08), 0 24px 56px rgba(15, 23, 42, 0.16)",

  ease: "cubic-bezier(0.2, 0, 0, 1)",
  fast: "120ms",
  base: "180ms",
} as const;

/**
 * The resting pill's border, and the reason it is the brand blue rather than a soft tint.
 *
 * It was `#A9C9F4`, which measures **1.70:1** on the white the gap paints behind it, and the rule
 * beside it was `#B9CDEA` at **1.62:1** — both below the **3:1** WCAG 1.4.11 asks of anything whose
 * appearance is what identifies a control. So «Añadir sección aquí» was already, before any of this
 * work, a control you could miss.
 *
 * The first draft of the plan made that worse: it proposed letting the pills fade almost away at
 * rest and bloom on hover. Direction refused it, and was right to — a control that only appears
 * under a pointer does not exist for someone who has no pointer. The resting state is now the
 * brand blue at **4.71:1**, which is visible without being loud, and the hover lives in
 * `@media (hover: hover)` so a touch screen never gets the quiet version of anything.
 */
export const PILL_REST_BORDER = CHROME_SCALE.brand;
