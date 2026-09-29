import type { Theme } from "@retorika/schema";
import { buildTheme } from "@retorika/tokens";
import type { SectorId } from "./answers.ts";

/**
 * ADR 0010: "sin logo, la paleta por defecto del sector." No default existed anywhere. This is a
 * first pass, not a decision with its own ADR — it is a lookup table, changeable by editing a
 * row, not a schema change.
 *
 * Until sprint 6 day 6 this comment ended by saying the logo «is captured by the questionnaire but
 * never analysed», and that every generation used the sector default whether or not a logo had
 * been uploaded — which made the questionnaire's own promise, «De sus colores sacamos los de toda
 * la web», untrue for five sprints. It is analysed now, and this table is what still answers when
 * there is no logo, or when its colour is not close enough to any of the four palettes to say so
 * honestly.
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

/**
 * The theme a site is generated with: the sector's, with the logo's palette in place of the
 * sector's when the logo chose one.
 *
 * **Only the palette.** The typography stays the sector's in every case — a logo's colours say
 * nothing about whether a business reads as editorial or as modern, and inventing that from an
 * image would be a guess wearing the costume of data.
 *
 * `logoPaletteId` arrives as a plain string decided in the browser, so this stays a pure lookup:
 * same arguments, same theme, no image anywhere near it.
 */
export function themeFor(sector: SectorId, logoPaletteId?: string | null): Theme {
  const choice = SECTOR_THEME[sector];
  return buildTheme({
    paletteId: logoPaletteId ?? choice.paletteId,
    typePairId: choice.typePairId,
  });
}
