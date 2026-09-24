import type { SectorId } from "./types.ts";

/**
 * Step 3's ticked suggestions, per sector — the part of the reviewed mockup that only makes
 * sense once a sector's text bank exists (ADR 0009). Only the sector the mockup itself
 * demonstrates is populated; every other sector gets an honest empty state rather than invented
 * copy, until day 3 writes the real bank.
 */
export const SERVICE_SUGGESTIONS: Partial<Record<SectorId, string[]>> = {
  "peluqueria-barberia": [
    "Corte de caballero",
    "Arreglo de barba",
    "Color y mechas",
    "Corte infantil",
    "Peinado y recogido",
    "Tratamientos capilares",
  ],
};
