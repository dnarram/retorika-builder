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
