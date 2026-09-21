import type { TokenKey } from "@retorika/schema";

export type FontKey = Extract<TokenKey, `font.${string}`>;

export interface TypePair {
  id: string;
  nameKey: string;
  fonts: Record<FontKey, string>;
}

export const TYPE_PAIRS: readonly TypePair[] = [
  {
    id: "editorial-serif",
    nameKey: "typography.editorialSerif",
    fonts: {
      "font.heading": "Georgia, Cambria, 'Times New Roman', Times, serif",
      "font.body": "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
  },
  {
    id: "modern-sans",
    nameKey: "typography.modernSans",
    fonts: {
      "font.heading": "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      "font.body": "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    },
  },
  {
    id: "classic-display",
    nameKey: "typography.classicDisplay",
    fonts: {
      "font.heading": "'Playfair Display', Georgia, 'Times New Roman', serif",
      "font.body": "Georgia, Cambria, 'Times New Roman', Times, serif",
    },
  },
];
