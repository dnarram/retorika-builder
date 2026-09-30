import type { ColorKey } from "./palettes.ts";

/**
 * Relative luminance per WCAG 2.1, from an #rrggbb or #rgb string.
 * Throws on anything else.
 */
export function relativeLuminance(color: string): number {
  if (typeof color !== "string") {
    throw new Error("Color must be a string");
  }

  const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color);
  if (!hexMatch) {
    throw new Error(`Invalid hex color format: "${color}"`);
  }

  const hex = hexMatch[1] ?? "";
  let rHex: string;
  let gHex: string;
  let bHex: string;

  if (hex.length === 3) {
    const c0 = hex[0] ?? "";
    const c1 = hex[1] ?? "";
    const c2 = hex[2] ?? "";
    rHex = c0 + c0;
    gHex = c1 + c1;
    bHex = c2 + c2;
  } else {
    rHex = hex.slice(0, 2);
    gHex = hex.slice(2, 4);
    bHex = hex.slice(4, 6);
  }

  const r255 = Number.parseInt(rHex, 16);
  const g255 = Number.parseInt(gHex, 16);
  const b255 = Number.parseInt(bHex, 16);

  const linearise = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  const r = linearise(r255);
  const g = linearise(g255);
  const b = linearise(b255);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio per WCAG 2.1, always >= 1. Order of arguments does not matter.
 */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/** AA for normal text. Not «the number we picked»: the one WCAG 2.1 asks of body copy, and the
 * threshold every palette in this package has been held to since sprint 1. */
export const AA_NORMAL_TEXT = 4.5;

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
 * 4.5:1 in all four palettes turns the suite red before it can reach a toolbar.
 */
export interface ContrastPair {
  fg: ColorKey;
  bg: ColorKey;
}

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  { fg: "color.ink", bg: "color.surface" },
  { fg: "color.primary", bg: "color.surface" },
  { fg: "color.secondary", bg: "color.surface" },
  { fg: "color.muted", bg: "color.surface" },
  { fg: "color.surface", bg: "color.primary" },
];

/** The foregrounds proved against this background, in the order above. Empty is a real answer: a
 * background nobody has measured a pair against offers no colours at all, rather than offering
 * five and hoping. */
export function provedOn(background: ColorKey): ColorKey[] {
  return CONTRAST_PAIRS.filter((pair) => pair.bg === background).map((pair) => pair.fg);
}
