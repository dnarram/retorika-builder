/**
 * The colour arithmetic WCAG 2.1 asks for, in the one package every other can reach.
 *
 * Written in `@retorika/tokens` in sprint 1 (`contrast.ts`) and **moved here on sprint 40 día 5**
 * without a change of behaviour: the renderer cannot import `tokens` (its dependency allowlist, and
 * `tokens` already depends on this package), and from that day it derives a veil's opacity from a
 * motif's extremes when a page is drawn (`veil.ts`, ADR 0081). `tokens` re-exports these three, so
 * every proof it holds is the same function it always was — one arithmetic, two packages reading it,
 * the same reason `GLASS_MIX` lived twice and `glass.test.ts` held the two equal.
 */

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

/**
 * `weight` of `color` over `1 − weight` of `under`, mixed per sRGB channel: what a translucent
 * `color-mix(in srgb, <color> <weight>, transparent)` composites to over a solid `under`. For the
 * glass bar (sprint 32 día 1, ADR 0063) the two solids that matter are black and white, the
 * extremes of whatever scrolls under it, and the proof is arithmetic rather than axe, which reads a
 * blurred translucent background as a contrast it cannot compute. For a veil over a motif (ADR 0081)
 * the two solids are the motif's own darkest and lightest pixels.
 */
export function mixHex(color: string, under: string, weight: number): string {
  const channels = (hex: string): number[] => {
    relativeLuminance(hex);
    const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
    return [1, 3, 5].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  };
  const a = channels(color);
  const b = channels(under);
  return `#${a
    .map((x, i) =>
      Math.round(x * weight + (b[i] ?? 0) * (1 - weight))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** AA for normal text. Not «the number we picked»: the one WCAG 2.1 asks of body copy, and the
 * threshold every palette in `tokens` has been held to since sprint 1. */
export const AA_NORMAL_TEXT = 4.5;
