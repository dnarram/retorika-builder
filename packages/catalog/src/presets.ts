import type { PresetShape } from "@retorika/schema";
import { CONTACT_ID, CONTACT_VARIANTS, contactPreset } from "./contact.ts";
import { COVER_ID, COVER_VARIANTS, coverPreset } from "./cover.ts";
import { FOOTER_ID, FOOTER_VARIANTS, footerPreset } from "./footer.ts";
import { GALLERY_ID, GALLERY_VARIANTS, galleryPreset } from "./gallery.ts";
import es from "./locales/es.json" with { type: "json" };
import { LOCATION_ID, LOCATION_VARIANTS, locationPreset } from "./location.ts";
import { PRICES_ID, PRICES_VARIANTS, pricesPreset } from "./prices.ts";
import { SERVICES_ID, SERVICES_VARIANTS, servicesPreset } from "./services.ts";
import { TEAM_ID, TEAM_VARIANTS, teamPreset } from "./team.ts";
import { TEASER_ID, TEASER_VARIANTS, teaserPreset } from "./teaser.ts";
import { TESTIMONIALS_ID, TESTIMONIALS_VARIANTS, testimonialsPreset } from "./testimonials.ts";

/**
 * The registry, in its own module rather than in `index.ts`, so that `blank.ts` can read it
 * without importing the barrel that also exports `blank.ts` back.
 */

/** Every section the catalog knows. */
export const CATALOG: Readonly<Record<string, PresetShape>> = {
  [COVER_ID]: coverPreset,
  [SERVICES_ID]: servicesPreset,
  [LOCATION_ID]: locationPreset,
  [TESTIMONIALS_ID]: testimonialsPreset,
  [PRICES_ID]: pricesPreset,
  // Next to the section it was asked for alongside — «los platos estrella o poner la carta» — and
  // before the two that end a page. This order is what the "Añadir sección aquí" menu offers, so
  // it reads as a page reads; the tests sort it, so nothing rests on it.
  [GALLERY_ID]: galleryPreset,
  // The ninth and last section a page can hold, placed the same way gallery was: right before the
  // two that always close a page, so adding it disturbs nothing else's position in the menu.
  [TEAM_ID]: teamPreset,
  [CONTACT_ID]: contactPreset,
  [FOOTER_ID]: footerPreset,
  // Last, and never offered by the "Añadir sección aquí" menu (`Variants.tsx` leaves it out):
  // an avance exists only because `sectionToPage` made one. Registered all the same, because the
  // renderer resolves every section through `presetFor` and rule 5 admits no section without one.
  [TEASER_ID]: teaserPreset,
};

/** Each section's compositions, in the order the catalog considers them: the first is the one
 * anything that has to pick without being told — inserting a section, say — picks. */
const VARIANTS: Readonly<Record<string, readonly string[]>> = {
  [COVER_ID]: COVER_VARIANTS,
  [SERVICES_ID]: SERVICES_VARIANTS,
  [LOCATION_ID]: LOCATION_VARIANTS,
  [TESTIMONIALS_ID]: TESTIMONIALS_VARIANTS,
  [PRICES_ID]: PRICES_VARIANTS,
  [GALLERY_ID]: GALLERY_VARIANTS,
  [TEAM_ID]: TEAM_VARIANTS,
  [CONTACT_ID]: CONTACT_VARIANTS,
  [FOOTER_ID]: FOOTER_VARIANTS,
  [TEASER_ID]: TEASER_VARIANTS,
};

export function presetFor(catalogId: string): PresetShape {
  const preset = CATALOG[catalogId];
  if (!preset) {
    // Never a silent empty box: an unknown section means the document and the catalog
    // disagree, and publishing that would put a hole in a client's site.
    throw new Error(
      `Unknown catalog section "${catalogId}". Known: ${Object.keys(CATALOG).join(", ")}`,
    );
  }
  return preset;
}

export function variantsFor(catalogId: string): readonly string[] {
  const variants = VARIANTS[catalogId];
  if (!variants) {
    throw new Error(
      `Unknown catalog section "${catalogId}". Known: ${Object.keys(VARIANTS).join(", ")}`,
    );
  }
  return variants;
}

/**
 * The short name the menu calls a section of this kind by (ADR 0057): «Servicios», «Galería»,
 * «Contacto» — a word, where `section.<id>.name` is a phrase for a chooser («Horario y ubicación»).
 *
 * **Never the section's heading.** A heading is a sentence the owner wrote for the top of a block
 * («Te esperamos»); a menu entry is a name for a place. David's decision of 28 October 2026: the
 * entry derives from the kind, and the owner may write their own on top (`menuLabel`), which the
 * renderer prefers. The three kinds that lend no entry — cover, footer, avance — have no label here
 * and asking for one throws, the way an unknown section does: a word invented here would be a word
 * published on a client's site that nobody chose.
 */
export function menuLabelOf(catalogId: string): string {
  const key = `section.${catalogId}.menuLabel` as keyof typeof es;
  const label = es[key];
  if (typeof label !== "string" || label === "") {
    throw new Error(`menuLabelOf: "${catalogId}" lends no menu entry and has no short name`);
  }
  return label;
}
