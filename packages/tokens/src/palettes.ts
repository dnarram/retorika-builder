import type { TokenKey } from "@retorika/schema";

/** The six colour keys of the namespace. Not re-derived by hand: imported and narrowed. */
export type ColorKey = Extract<TokenKey, `color.${string}`>;

export interface Palette {
  id: string;
  /** Shown in the style panel. Spanish lives in the locale file, not here. */
  nameKey: string;
  colors: Record<ColorKey, string>;
  /**
   * The palette a generated site starts with when no logo chose one (ADR 0041): offered in the
   * panel like the others and ticked on opening, but **not a colour a logo chooses** — a blue logo
   * lands on `classic-blue`, never here — and so skipped by `nearestPalette`.
   */
  starting?: true;
}

/** The id of the palette every proposal starts with when the logo chose none (ADR 0041). */
export const STARTING_PALETTE_ID = "neutral";

export const PALETTES: readonly Palette[] = [
  {
    /**
     * «Neutra» — black ink, the brand's blue for headings, buttons and links, white surfaces.
     * **The one palette that carries Retorika's blue, by David's decision of 13 October 2026**,
     * which amends ADR 0015's warning about a client's site taking it: the three proposals are
     * shown in it so that the owner judges the structure, not a colour nobody chose, and the
     * palette is theirs to pick afterwards in «Estilo». A site left untouched ships in this blue;
     * the ADR says so rather than pretending otherwise.
     */
    id: STARTING_PALETTE_ID,
    nameKey: "palette.neutral",
    starting: true,
    colors: {
      "color.primary": "#156FE7",
      "color.secondary": "#105CB1",
      "color.accent": "#FF3A72",
      "color.surface": "#FFFFFF",
      "color.ink": "#0F172A",
      "color.muted": "#475569",
    },
  },
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
  /*
   * **Eight more, sprint 38 día 4** (David's P4 of 16 November 2026: «ocho → trece»; the names are the
   * plan's proposals, his to change). Each was measured before it was written, with the engine's own
   * `validateTheme`: the seven pairs and the fill's at 4.5:1 and the glass bar's four over black and
   * over white — the lowest pair is olive's primary on its sand, 4.70; the lowest glass is ocean's,
   * 6.41. Two are dark, as «Pizarra oscura» is: a dark palette is another palette (protocol §8). None
   * carries a fill of its own: every primary here reads as text on its surface, so it fills with itself.
   */
  {
    id: "deep-wine",
    nameKey: "palette.deepWine",
    colors: {
      "color.primary": "#7F1D1D",
      "color.secondary": "#5C1A1A",
      "color.accent": "#B45309",
      "color.surface": "#FFF8F6",
      "color.ink": "#1C1917",
      "color.muted": "#57534E",
    },
  },
  {
    id: "olive-sand",
    nameKey: "palette.oliveSand",
    colors: {
      "color.primary": "#4D7C0F",
      "color.secondary": "#3F6212",
      "color.accent": "#A16207",
      "color.surface": "#FAF8F1",
      "color.ink": "#1A2E05",
      "color.muted": "#4B5563",
    },
  },
  {
    id: "midnight-gold",
    nameKey: "palette.midnightGold",
    colors: {
      "color.primary": "#FCD34D",
      "color.secondary": "#FDE68A",
      "color.accent": "#F472B6",
      "color.surface": "#111827",
      "color.ink": "#F9FAFB",
      "color.muted": "#9CA3AF",
    },
  },
  {
    id: "graphite",
    nameKey: "palette.graphite",
    colors: {
      "color.primary": "#E4E4E7",
      "color.secondary": "#D4D4D8",
      "color.accent": "#F59E0B",
      "color.surface": "#18181B",
      "color.ink": "#FAFAFA",
      "color.muted": "#A1A1AA",
    },
  },
  {
    id: "lavender",
    nameKey: "palette.lavender",
    colors: {
      "color.primary": "#6D28D9",
      "color.secondary": "#4C1D95",
      "color.accent": "#DB2777",
      "color.surface": "#FAF5FF",
      "color.ink": "#1E1B4B",
      "color.muted": "#4C4F69",
    },
  },
  {
    id: "coral-sand",
    nameKey: "palette.coralSand",
    colors: {
      "color.primary": "#BE123C",
      "color.secondary": "#9F1239",
      "color.accent": "#F97316",
      "color.surface": "#FFF7ED",
      "color.ink": "#1C1917",
      "color.muted": "#57534E",
    },
  },
  {
    id: "ocean",
    nameKey: "palette.ocean",
    colors: {
      "color.primary": "#0E7490",
      "color.secondary": "#155E75",
      "color.accent": "#F59E0B",
      "color.surface": "#F0F9FF",
      "color.ink": "#0C4A6E",
      "color.muted": "#475569",
    },
  },
  {
    id: "mustard",
    nameKey: "palette.mustard",
    colors: {
      "color.primary": "#854D0E",
      "color.secondary": "#713F12",
      "color.accent": "#CA8A04",
      "color.surface": "#FEFCE8",
      "color.ink": "#1C1917",
      "color.muted": "#57534E",
    },
  },
];
