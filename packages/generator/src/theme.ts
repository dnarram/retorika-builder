import type { Theme } from "@retorika/schema";
import { buildTheme, derivePalette, STARTING_PALETTE_ID } from "@retorika/tokens";
import type { LogoColours, SectorId } from "./answers.ts";

/**
 * What the sector decides about a generated site's theme: **its typography, and nothing else.**
 *
 * Until 13 October 2026 this map also chose a palette per sector — terracotta for a restaurant,
 * slate for a shop — and the three proposals arrived in it. David changed that (ADR 0041): the
 * proposals start in the neutral palette so the owner judges the structure and not a colour
 * nobody chose, and the palette is theirs to pick afterwards in «Estilo».
 *
 * **A logo's colours are the site's** (ADR 0076, sprint 38 día 3): with a logo whose colours were
 * read, the palette is derived from them — the brand's colour exact as the fill, its sibling where it
 * has to be read as text — and no longer the predefined palette nearest to it, which was the defect.
 * A logo with no colour in it (a black wordmark) leaves the neutral start, honestly.
 */
const SECTOR_TYPE_PAIR: Record<SectorId, string> = {
  "peluqueria-barberia": "editorial-serif",
  estetica: "modern-sans",
  fisioterapia: "modern-sans",
  "restaurante-bar": "classic-display",
  tienda: "modern-sans",
  taller: "modern-sans",
  reformas: "modern-sans",
  academia: "editorial-serif",
  fotografia: "classic-display",
  asesoria: "editorial-serif",
  otro: "modern-sans",
};

export function themeFor(sector: SectorId, logoColours?: LogoColours | null): Theme {
  const typePairId = SECTOR_TYPE_PAIR[sector];
  if (!logoColours) return buildTheme({ paletteId: STARTING_PALETTE_ID, typePairId });
  const { colors } = derivePalette({ brand: logoColours.brand, second: logoColours.second });
  return buildTheme({ colors, typePairId });
}
