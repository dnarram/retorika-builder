import type { Theme } from "@retorika/schema";

/**
 * What a filled shape is drawn in, and the ink written on it (ADR 0074, sprint 38 día 1).
 *
 * **Two shapes of the stylesheet, decided here and nowhere else.** A theme with no fill of its own —
 * every predefined palette, every site before 1.20.0 — fills with `color.primary` and writes on it in
 * `color.surface`, and this returns exactly those two `var()`s, so the stylesheet it feeds is the one
 * those sites always published, byte for byte: the golden corpus is the proof. A theme with a fill of
 * its own (a logo's yellow, too light to be read as text on white) fills with `--color-fill` and writes
 * on it in `--color-on-fill`, and `own` says so, for the few rules that must split a shared selector to
 * reach the primary bar alone.
 *
 * **What is a fill and what is not.** The button, the nav's button, a bar in the primary and whatever
 * hangs from it (the phone's open menu, the rail, «Ir a…»), and the favicon's disc. **Not** the
 * text-role uses of the primary: headings, links, the skip link, the brand's name — and not the thin
 * indicator under the current entry on a surface bar either, which is a mark read against the surface
 * like an underline is, and which a yellow fill would draw at 1.5:1 on white. Those keep the primary,
 * which every theme proves at 4.5:1 on its surface.
 */
export interface FillVars {
  fill: string;
  ink: string;
  own: boolean;
}

export function fillVars(theme: Theme): FillVars {
  const own = theme["color.fill"] !== undefined && theme["color.onFill"] !== undefined;
  return own
    ? { fill: "var(--color-fill)", ink: "var(--color-on-fill)", own }
    : { fill: "var(--color-primary)", ink: "var(--color-surface)", own };
}
