import type { PresetShape } from "@retorika/schema";
import { CONTACT_ID, contactPreset } from "./contact.ts";
import { COVER_ID, coverPreset } from "./cover.ts";
import { LOCATION_ID, locationPreset } from "./location.ts";
import { SERVICES_ID, servicesPreset } from "./services.ts";

export type { ContactVariant } from "./contact.ts";
export { CONTACT_ID, CONTACT_SLOTS, CONTACT_VARIANTS, contactPreset } from "./contact.ts";
export type { CoverVariant } from "./cover.ts";
export { COVER_ID, COVER_SLOTS, COVER_VARIANTS, coverPreset } from "./cover.ts";
export type { SlotPlacement } from "./layout.ts";
export type { LocationVariant } from "./location.ts";
export { LOCATION_ID, LOCATION_SLOTS, LOCATION_VARIANTS, locationPreset } from "./location.ts";
export { SEARCH_ALIASES } from "./search.ts";
export type { ServicesVariant } from "./services.ts";
export {
  SERVICES_ID,
  SERVICES_ITEM_SLOTS,
  SERVICES_ITEMS,
  SERVICES_SLOTS,
  SERVICES_VARIANTS,
  servicesPreset,
} from "./services.ts";

/** Every section the catalog knows. */
export const CATALOG: Readonly<Record<string, PresetShape>> = {
  [COVER_ID]: coverPreset,
  [SERVICES_ID]: servicesPreset,
  [LOCATION_ID]: locationPreset,
  [CONTACT_ID]: contactPreset,
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
