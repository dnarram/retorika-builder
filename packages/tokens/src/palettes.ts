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
];
