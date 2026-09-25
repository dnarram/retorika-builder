import type { PresetShape } from "@retorika/schema";
import { CONTACT_ID, CONTACT_VARIANTS, contactPreset } from "./contact.ts";
import { COVER_ID, COVER_VARIANTS, coverPreset } from "./cover.ts";
import { LOCATION_ID, LOCATION_VARIANTS, locationPreset } from "./location.ts";
import { SERVICES_ID, SERVICES_VARIANTS, servicesPreset } from "./services.ts";

/**
 * The registry, in its own module rather than in `index.ts`, so that `blank.ts` can read it
 * without importing the barrel that also exports `blank.ts` back.
 */

/** Every section the catalog knows. */
export const CATALOG: Readonly<Record<string, PresetShape>> = {
  [COVER_ID]: coverPreset,
  [SERVICES_ID]: servicesPreset,
  [LOCATION_ID]: locationPreset,
  [CONTACT_ID]: contactPreset,
};

/** Each section's compositions, in the order the catalog considers them: the first is the one
 * anything that has to pick without being told — inserting a section, say — picks. */
const VARIANTS: Readonly<Record<string, readonly string[]>> = {
  [COVER_ID]: COVER_VARIANTS,
  [SERVICES_ID]: SERVICES_VARIANTS,
  [LOCATION_ID]: LOCATION_VARIANTS,
  [CONTACT_ID]: CONTACT_VARIANTS,
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
