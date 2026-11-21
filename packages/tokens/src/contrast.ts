import type { FillKey } from "@retorika/schema";
import type { ColorKey } from "./palettes.ts";

/**
 * The arithmetic — `relativeLuminance`, `contrastRatio`, `mixHex`, `AA_NORMAL_TEXT` — lived here
 * from sprint 1 to sprint 40 día 5 and moved to `@retorika/schema` (`colour.ts`) without a change of
 * behaviour, so the renderer can derive a veil's opacity from a motif's extremes (ADR 0081): this
 * package depends on the schema, the renderer cannot depend on this one. Re-exported here, so every
 * proof in this package and every caller reads the same function it always did.
 */
export { AA_NORMAL_TEXT, contrastRatio, mixHex, relativeLuminance } from "@retorika/schema";

import { AA_NORMAL_TEXT } from "@retorika/schema";

/**
 * The colour pairs this product has actually proved, as data.
 *
 * It used to be a `PAIRS` const inside `contrast.test.ts`, which was fine while the only reader was
 * the test. Sprint 9 day 4 gave it a second one: the floating toolbar offers a colour per element,
 * and **it may only offer a role whose pair against that element's background is proved**. A second
 * list in the editor would be a list that drifts — and the way it would drift is the worst one, a
 * toolbar quietly offering a combination nobody has measured.
 *
 * So: one list, two readers. `contrast.test.ts` asserts every entry clears {@link AA_NORMAL_TEXT} in
 * every palette; `textToolbar.ts` offers exactly these and nothing else.
 *
 * **What is not here matters as much as what is.** `color.surface` on `color.surface` is 1:1 —
 * invisible text, and a perfectly legal `{ref: "color.surface"}` in the schema. It is absent, so the
 * toolbar cannot offer it. Neither is `color.accent`, whose contrast is asserted nowhere and which
 * measures 3.19:1 on surface in `classic-blue`.
 *
 * Adding a pair here is a claim, and the test is what makes it one: an entry that does not clear
 * 4.5:1 in every palette turns the suite red before it can reach a toolbar.
 */
export interface ContrastPair {
  fg: PairKey;
  bg: PairKey;
}

/** A colour a pair can name: the six of every palette, plus the fill and its ink (ADR 0074). */
export type PairKey = ColorKey | FillKey;

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { fg: "color.ink", bg: "color.surface" },
  { fg: "color.primary", bg: "color.surface" },
  { fg: "color.secondary", bg: "color.surface" },
  { fg: "color.muted", bg: "color.surface" },
  { fg: "color.surface", bg: "color.primary" },
  // The header's two other backgrounds (ADR 0057, sprint 30 día 2): the bar on `color.secondary`
  // or on `color.ink` writes its entries in `color.surface`. Measured over the five palettes of 29
  // October 2026 before being written here: surface on secondary 5.47 at its lowest (classic-blue),
  // surface on ink 9.28 (forest-emerald). `color.ink` on `color.secondary` — the plan's first
  // thought — measured 1.23 in dark-slate and was refused; the schemes read these two instead.
  { fg: "color.surface", bg: "color.secondary" },
  { fg: "color.surface", bg: "color.ink" },
  // **The fill and its ink** (ADR 0074, sprint 38 día 1): wherever the page fills a shape — the
  // button, a coloured bar, the favicon's disc — it fills it with `color.fill` and writes on it in
  // `color.onFill`. Both are optional and resolve to `color.primary` and `color.surface` when absent
  // (`resolveFill`), so for every palette above this pair *is* surface on primary, measured twice;
  // it earns its place on the day a theme carries a fill of its own, a logo's yellow under black.
  // Surface on primary stays: it is what a fill-less button carries, and the toolbar offers it there.
  { fg: "color.onFill", bg: "color.fill" },
];

/**
 * The colours a pair is measured in, with the fill pair resolved: `color.fill` falls back to
 * `color.primary` and `color.onFill` to `color.surface`, which is what the renderer draws when a
 * theme carries no fill of its own (ADR 0074). A palette, or a whole theme, goes in; the eight colours
 * a pair can name come out. The one place the fallback is written for the arithmetic, so the tests and
 * the editor's review cannot disagree with the stylesheet about what a fill-less button is drawn in.
 */
export function resolveFill(
  colors: Record<ColorKey, string> & { [K in FillKey]?: string | undefined },
): Record<PairKey, string> {
  return {
    ...colors,
    "color.fill": colors["color.fill"] ?? colors["color.primary"],
    "color.onFill": colors["color.onFill"] ?? colors["color.surface"],
  };
}

/** The foregrounds proved against this background, in the order above. Empty is a real answer: a
 * background nobody has measured a pair against offers no colours at all, rather than offering
 * five and hoping. */
export function provedOn(background: PairKey): PairKey[] {
  return CONTRAST_PAIRS.filter((pair) => pair.bg === background).map((pair) => pair.fg);
}
