import type { PresetShape } from "@retorika/schema";
import { COVER_ID, coverPreset } from "./cover.ts";
import { SERVICES_ID, servicesPreset } from "./services.ts";

export type { CoverVariant } from "./cover.ts";
export { COVER_ID, COVER_SLOTS, COVER_VARIANTS, coverPreset } from "./cover.ts";
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
