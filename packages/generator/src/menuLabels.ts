import type { Section } from "@retorika/schema";
import type { SectorId } from "./answers.ts";
import es from "./locales/es.json" with { type: "json" };

/**
 * The word a sector has for a section's menu entry, where it has one (ADR 0059, David's
 * adjustment 6 of the sprint 30 plan).
 *
 * The catalog names every section's entry neutrally — «Precios», «Contacto» — because the catalog
 * does not know sectors (a package below never learns the things above it). A restaurant's list of
 * prices is its *carta*, and the one thing a visitor does on its contact section is *reservar*; a
 * salon's is *pedir cita*. Those words are the generator's, which is the one package that knows
 * both the sector and the section, and they are written as the destination's **own label**
 * (`menuLabel`) rather than as a renderer rule: a button that says «Contacto» is a bigger link, one
 * that says «Reservar» is the action — and if the owner takes the button away, the entry comes back
 * to the menu with that word, editable like any other.
 *
 * **A sector without a word gets no word.** `undefined` here leaves the catalog's neutral entry
 * standing; nothing is invented, and a test says so by name.
 */
export function sectorMenuLabel(sector: SectorId | null, catalogId: string): string | undefined {
  if (sector === null) return undefined;
  const key = `menuLabel.${sector}.${catalogId}` as keyof typeof es;
  return es[key];
}

/** The section with its sector's word as its own label, or the section as it was. */
export function withSectorMenuLabel(sector: SectorId | null, section: Section): Section {
  const label = sectorMenuLabel(sector, section.preset.catalogId);
  return label === undefined ? section : { ...section, menuLabel: label };
}
