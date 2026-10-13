import type { Theme } from "@retorika/schema";
import { buildTheme, STARTING_PALETTE_ID } from "@retorika/tokens";
import type { SectorId } from "./answers.ts";

/**
 * What the sector decides about a generated site's theme: **its typography, and nothing else.**
 *
 * Until 13 October 2026 this map also chose a palette per sector — terracotta for a restaurant,
 * slate for a shop — and the three proposals arrived in it. David changed that (ADR 0041): the
 * proposals start in the neutral palette so the owner judges the structure and not a colour
 * nobody chose, and the palette is theirs to pick afterwards in «Estilo». The logo still decides
 * when it chose one (dossier §4, ADR 0010): a palette read off the owner's own mark is theirs, not
 * ours.
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

export function themeFor(sector: SectorId, logoPaletteId?: string | null): Theme {
  return buildTheme({
    paletteId: logoPaletteId ?? STARTING_PALETTE_ID,
    typePairId: SECTOR_TYPE_PAIR[sector],
  });
}
