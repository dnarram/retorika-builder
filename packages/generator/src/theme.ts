import type { Theme } from "@retorika/schema";
import { buildTheme } from "@retorika/tokens";
import type { SectorId } from "./answers.ts";

/**
 * ADR 0010: "sin logo, la paleta por defecto del sector." No default existed anywhere. This is a
 * first pass, not a decision with its own ADR — it is a lookup table, changeable by editing a
 * row, not a schema change.
 *
 * The logo a business uploads is captured by the questionnaire but never analysed: extracting a
 * palette from an image needs real image-processing work this sprint does not include. Every
 * generation uses the sector default today, whether or not a logo was uploaded.
 */
const SECTOR_THEME: Record<SectorId, { paletteId: string; typePairId: string }> = {
  "peluqueria-barberia": { paletteId: "warm-terracotta", typePairId: "editorial-serif" },
  estetica: { paletteId: "forest-emerald", typePairId: "modern-sans" },
  fisioterapia: { paletteId: "classic-blue", typePairId: "modern-sans" },
  "restaurante-bar": { paletteId: "warm-terracotta", typePairId: "classic-display" },
  tienda: { paletteId: "dark-slate", typePairId: "modern-sans" },
  taller: { paletteId: "dark-slate", typePairId: "modern-sans" },
  reformas: { paletteId: "forest-emerald", typePairId: "modern-sans" },
  academia: { paletteId: "classic-blue", typePairId: "editorial-serif" },
  fotografia: { paletteId: "dark-slate", typePairId: "classic-display" },
  asesoria: { paletteId: "classic-blue", typePairId: "editorial-serif" },
  otro: { paletteId: "classic-blue", typePairId: "modern-sans" },
};

export function themeFor(sector: SectorId): Theme {
  const choice = SECTOR_THEME[sector];
  return buildTheme({ paletteId: choice.paletteId, typePairId: choice.typePairId });
}
