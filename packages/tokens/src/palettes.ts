import type { TokenKey } from "@retorika/schema";

/** The six colour keys of the namespace. Not re-derived by hand: imported and narrowed. */
export type ColorKey = Extract<TokenKey, `color.${string}`>;

export interface Palette {
  id: string;
  /** Shown in the style panel. Spanish lives in the locale file, not here. */
  nameKey: string;
  colors: Record<ColorKey, string>;
}

export const PALETTES: readonly Palette[] = [
  {
    id: "classic-blue",
    nameKey: "palette.classicBlue",
    colors: {
      "color.primary": "#1D4ED8",
      "color.secondary": "#0F766E",
      "color.accent": "#D97706",
      "color.surface": "#FFFFFF",
      "color.ink": "#0F172A",
      "color.muted": "#475569",
    },
  },
  {
    id: "warm-terracotta",
    nameKey: "palette.warmTerracotta",
    colors: {
      "color.primary": "#9A3412",
      "color.secondary": "#78350F",
      "color.accent": "#C2410C",
      "color.surface": "#FAFAF9",
      "color.ink": "#1C1917",
      "color.muted": "#57534E",
    },
  },
  {
    id: "forest-emerald",
    nameKey: "palette.forestEmerald",
    colors: {
      "color.primary": "#047857",
      "color.secondary": "#065F46",
      "color.accent": "#B45309",
      "color.surface": "#F0FDF4",
      "color.ink": "#064E3B",
      "color.muted": "#374151",
    },
  },
  {
    id: "dark-slate",
    nameKey: "palette.darkSlate",
    colors: {
      "color.primary": "#38BDF8",
      "color.secondary": "#A7F3D0",
      "color.accent": "#F472B6",
      "color.surface": "#0F172A",
      "color.ink": "#F8FAFC",
      "color.muted": "#94A3B8",
    },
  },
];
