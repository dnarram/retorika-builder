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
  // Carried across since 7 October 2026, when the «Diseñada a mano» bar moved into the flow and
  // started having to arrive rather than appear. Until then nothing inside the preview animated, so
  // `chromeScale.test.ts` excused this one by name — and that exception had to argue with the
  // addition, which is the whole reason the list exists.
  easeShape: "cubic-bezier(0.4, 0, 0.2, 1)",
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

/**
 * The section verbs' geometry: how big the round buttons in the canvas are, and how much bigger
 * they get when a pointer or a keyboard arrives on one.
 *
 * **A decision rather than a transcription**, which is why it is its own export beside
 * `PILL_REST_BORDER` instead of a row in the table above. Nothing in `globals.css` draws these —
 * they exist only inside the preview iframe — so there is no `--ui-*` for them to agree with, and
 * pretending otherwise would weaken what `CHROME_SCALE` promises.
 *
 * **Why 32 and not the 26 they were for eighteen sprints.** David, 14 October 2026: «los iconos se
 * ven muy pequeños y no consigo diferenciarlos fácilmente». A 26px disc with a 13px glyph inside a
 * 2px ring leaves about 11px of drawing — eight silhouettes that at a glance are eight grey marks.
 * 32 with a 16px glyph is the smallest that reads as a picture; the growth on top is emphasis, and
 * it is `transform` so a button swelling never pushes its neighbours sideways under the pointer
 * that is reaching for it.
 *
 * The numbers live here rather than in the stylesheet string so that the walks can assert what the
 * CSS declares instead of a second copy typed into a test — David's own condition when he approved
 * the sprint.
 */
/**
 * **A length of the chrome, in the pixels of the screen** (ADR 0053, sprint 27 día 7).
 *
 * The canvas is a page laid out at desktop width and scaled into whatever room the editor has left,
 * so everything drawn inside the frame is drawn at that zoom — at 1024 with a panel open, about
 * three quarters. For the page that is the point: the owner sees their site as it will be. For the
 * chrome drawn over it, it is a defect: measured on 25 October 2026 at 1024 with «Diseño», a 32 px
 * verb was 23.6 on screen, the text bar's grip 17.7 × 19.2 — under the 24 that WCAG 2.2 §2.5.8 asks of
 * a pointer target — and a 2 px outline 1.48, which is a line drawn between two pixels.
 *
 * So the chrome's lengths are written divided by the zoom: `calc(Npx / var(--rb-zoom, 1))`, where
 * `--rb-zoom` is the measured zoom `redrawChrome` writes on the frame's root. At zoom 1 it is N
 * pixels exactly, which is why nothing changes for a canvas drawn at its own size.
 *
 * **The zoom is a measurement, not a token**, which is why it can be a custom property when the
 * tokens above cannot: a string handed to the frame cannot read a variable from the editor's own
 * document, as the note at the top says, but the editor can measure the frame and write the answer
 * into it — the same reason `--rb-enter-offset` exists.
 */
export function screenPx(px: number): string {
  return `calc(${px}px / var(--rb-zoom, 1))`;
}

/**
 * The size of an icon of the chrome, as the attributes an `<svg>` string opens with: the width and
 * height the glyph was drawn at, and an inline style that makes them pixels of the screen
 * (ADR 0053). A presentation attribute cannot be divided by a variable; an inline style can, and it
 * wins over the attribute — so the attribute stays as what an `<svg>` read without the stylesheet
 * would fall back to.
 */
export function screenIcon(px: number): string {
  return `width="${px}" height="${px}" style="width: ${screenPx(px)}; height: ${screenPx(px)}"`;
}

export const VERB_SCALE = {
  /** The button's whole box, its 2px white ring included. */
  size: 32,
  /** The glyph inside it, interpolated into all eight SVG strings. */
  icon: 16,
  /** 36px of button, as a factor: hover and `:focus-visible` both. */
  grow: 1.125,
  /** Between two buttons. */
  gap: 4,
  /** From the section's own corner, which is where the cluster has always sat. */
  inset: 8,
  /**
   * The grip's width — narrower than a verb, because it is not one.
   *
   * 24 and not the 20 that would look right beside eight discs: WCAG 2.5.8 asks 24 × 24 CSS pixels
   * of a pointer target, and a handle somebody has to catch with a trembling hand is the last
   * control to shave. It keeps the verbs' height, so the row stays level.
   */
  grip: 24,
} as const;
