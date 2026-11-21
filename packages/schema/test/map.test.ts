import { describe, expect, it } from "vitest";
import { listDeadDestinations } from "../src/destinations.ts";
import type { ContentElement, RetorikaDocument, Section } from "../src/document.ts";
import { addressOf, MAP_ADDRESS_SLOT, mapHref } from "../src/map.ts";
import { parseDocument } from "../src/parse.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * Where «Cómo llegar» leads (ADR 0080, sprint 40 día 4): a point, a place written on purpose, or the
 * address its section shows — read when the page is drawn, never stored, so a corrected address moves
 * the link with it (David's adjustment 1). And where it leads nowhere, the download says so.
 */

const address = (text: string, hidden = false): ContentElement => ({
  id: "el-address",
  role: "body",
  hidden,
  slot: MAP_ADDRESS_SLOT,
  value: { kind: "text", text },
});
const map = (value: Record<string, unknown>, hidden = false): ContentElement =>
  ({
    id: "el-map",
    role: "map",
    hidden,
    slot: "map",
    value: { kind: "map", label: "Cómo llegar", ...value },
  }) as ContentElement;
const section = (...content: ContentElement[]): Pick<Section, "content"> => ({ content });
const mapValue = (element: ContentElement) => {
  if (element.value?.kind !== "map") throw new Error("not a map");
  return element.value;
};

describe("mapHref", () => {
  it("follows the address its section shows, encoded for a URL", () => {
    const m = map({});
    expect(mapHref(mapValue(m), section(address("Cta. de Santo Domingo, 2, Ronda"), m))).toBe(
      "https://www.google.com/maps/search/?api=1&query=Cta.%20de%20Santo%20Domingo%2C%202%2C%20Ronda",
    );
  });

  it("moves with the address: the same map, a corrected address, a different link", () => {
    const m = map({});
    const before = mapHref(mapValue(m), section(address("Muelle 3, Ronda"), m));
    const after = mapHref(mapValue(m), section(address("Muelle 5, Ronda"), m));
    expect(before).not.toBe(after);
    expect(after).toContain("Muelle%205");
  });

  it("encodes what would break a URL or an attribute: & # ? quotes and angle brackets", () => {
    const m = map({});
    const href = mapHref(mapValue(m), section(address(`Bar "El 7" & Co. #2 <a>?x=1`), m));
    expect(href).toBe(
      "https://www.google.com/maps/search/?api=1&query=Bar%20%22El%207%22%20%26%20Co.%20%232%20%3Ca%3E%3Fx%3D1",
    );
  });

  it("goes to a place written on purpose instead of the address", () => {
    const m = map({ query: "Plaza de España, Ronda" });
    expect(mapHref(mapValue(m), section(address("Muelle 3, Ronda"), m))).toBe(
      "https://www.google.com/maps/search/?api=1&query=Plaza%20de%20Espa%C3%B1a%2C%20Ronda",
    );
  });

  it("goes to a point to OpenStreetMap, as ADR 0004's map always did", () => {
    const m = map({ latitude: 36.74, longitude: -5.16, query: "Ronda" });
    expect(mapHref(mapValue(m), section(address("Muelle 3"), m))).toBe(
      "https://www.openstreetmap.org/?mlat=36.74&mlon=-5.16",
    );
  });

  it("leads nowhere with no point, no place, and no visible address", () => {
    const m = map({});
    expect(mapHref(mapValue(m), section(m))).toBe("");
    expect(mapHref(mapValue(m), section(address("Muelle 3", true), m))).toBe("");
    expect(mapHref(mapValue(m), section(address("   "), m))).toBe("");
    expect(addressOf(section(address("  Muelle 3  ")))).toBe("Muelle 3");
  });
});

describe("listDeadDestinations, for a map", () => {
  const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, "1px"])) as unknown as Theme;
  const site = (...content: ContentElement[]): RetorikaDocument =>
    parseDocument({
      schemaVersion: "1.21.0",
      id: "doc-mapa",
      siteName: "Taberna",
      theme: { ...theme, "color.primary": "#000000" },
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna",
          sections: [
            {
              id: "sec-location",
              preset: { catalogId: "location", variantId: "stacked" },
              source: "catalog",
              layout: null,
              content,
            },
          ],
        },
      ],
    });

  it("names a map that follows an address the section no longer shows", () => {
    expect(listDeadDestinations(site(address("Muelle 3"), map({})))).toEqual([]);
    expect(listDeadDestinations(site(address("Muelle 3", true), map({})))).toEqual([
      {
        pageId: "home",
        sectionId: "sec-location",
        elementId: "el-map",
        slot: "map",
        role: "map",
        text: "Cómo llegar",
      },
    ]);
  });

  it("does not name a map with a place of its own, nor one that is hidden", () => {
    expect(listDeadDestinations(site(map({ query: "Ronda" })))).toEqual([]);
    expect(listDeadDestinations(site(map({}, true)))).toEqual([]);
  });
});
