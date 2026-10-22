/**
 * **Which route the canvas takes to show an edit** (ADR 0051 §6, sprint 26 día 2).
 *
 * `swap` is the model the editor has had since sprint 15: every edit renders the page again and
 * replaces the frame's `srcDoc`, through a buffered second frame when the chrome has to be
 * re-attached. `patch` is this sprint's: one document for the session, every edit a patch from
 * `render(doc, "dom")`.
 *
 * **Both routes live until sprint 27 closes** — David's adjustment 6 — so the key is read once at
 * mount and never again: a route switched halfway through a session would leave a document wired
 * for one model under the other. **The default is `patch` since día 5** (22 October 2026), the
 * day the walks' contract stopped waiting for a new document and CI ran green on both routes;
 * `swap` stays reachable under the key until sprint 27 closes.
 *
 * Pure of the browser: what is stored comes in, the mode goes out, so the rule is testable and
 * the one `localStorage` read lives in the editor, wrapped, because storage can throw.
 */
export type CanvasMode = "swap" | "patch";

export const CANVAS_MODE_KEY = "rb.canvas";

/** `patch` since día 5; `swap` is the key's other value, kept until sprint 27 closes (adjustment 6). */
export const DEFAULT_CANVAS_MODE: CanvasMode = "patch";

export function canvasModeFrom(stored: string | null | undefined): CanvasMode {
  if (stored === "patch" || stored === "swap") return stored;
  return DEFAULT_CANVAS_MODE;
}
