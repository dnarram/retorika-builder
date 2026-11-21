import type { ContentValue, Section } from "./document.ts";

/**
 * **Where a «Cómo llegar» leads** (ADR 0080, sprint 40 día 4).
 *
 * One function, read by the renderer when it draws the link and by `listDeadDestinations` when the
 * download asks whether it leads anywhere, so the published href and the check can never disagree.
 *
 * In order: a point (latitude and longitude, ADR 0004's form, to OpenStreetMap as it always was); a
 * place the owner wrote on purpose («Otro destino», `query`); and otherwise **the address its section
 * shows right now** — David's adjustment 1 approving the sprint: the generator stores no copy, so a
 * corrected address moves the link with it. Google Maps for the last two, because on a phone it opens
 * the maps application the visitor already has. Nothing is fetched and nothing is embedded: the page
 * holds one `<a>`, and the visitor's browser goes to Google only when the visitor presses it.
 *
 * `""` when there is nowhere to go — no point, no place, no visible address — which the download
 * refuses like any other dead link.
 */

/** The location preset's slot that holds the address. The catalog owns slot names; this is the one
 * the map reads, and `packages/catalog`'s location test holds the two equal. */
export const MAP_ADDRESS_SLOT = "address";

const GOOGLE_MAPS = "https://www.google.com/maps/search/?api=1&query=";

type MapValue = Extract<ContentValue, { kind: "map" }>;

/** The text of the first visible top-level element in the address slot, trimmed; `""` for none. */
export function addressOf(section: Pick<Section, "content">): string {
  for (const element of section.content) {
    if (element.slot !== MAP_ADDRESS_SLOT || element.hidden) continue;
    const value = element.value;
    if (value?.kind === "text" && value.text.trim() !== "") return value.text.trim();
  }
  return "";
}

export function mapHref(value: MapValue, section: Pick<Section, "content">): string {
  if (value.latitude !== undefined && value.longitude !== undefined) {
    return `https://www.openstreetmap.org/?mlat=${value.latitude}&mlon=${value.longitude}`;
  }
  const place = value.query?.trim() || addressOf(section);
  return place === "" ? "" : `${GOOGLE_MAPS}${encodeURIComponent(place)}`;
}
