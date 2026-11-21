/**
 * The map follows the address (ADR 0080, sprint 40 día 4): a `map` value may carry a `query` — a
 * place the owner wrote on purpose — and its latitude and longitude become an optional pair. With
 * neither, the link follows the address its section shows, read when the page is drawn.
 *
 * **`up` seals and moves nothing.** A 1.20.0 `map` had to carry both coordinates, which is still a
 * valid 1.21.0 one. No owner's site holds a map — no question asks for coordinates and no panel wrote
 * one — and the one corpus fixture that does, `contacto-y-horario` (written by hand in sprint 1),
 * carries its point and publishes byte for byte as before (`migrations.test.ts` asserts both). The
 * shape of `0017`, `0019`, `0020` and `0021`.
 *
 * **`down` is lossy and says so.** 1.20.0 has no map without a point: every `map` element that has
 * no latitude and longitude is taken out of its section — the «Cómo llegar» a site generated from
 * 1.21.0 is born with — and its section keeps everything else. A map with a point keeps the point and
 * loses its `query`, which 1.20.0 cannot hold.
 */

type Json = Record<string, unknown>;

function downContent(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  const kept: unknown[] = [];
  for (const raw of content) {
    const element = raw as Json;
    const value = element["value"] as Json | undefined;
    if (value?.["kind"] === "map") {
      if (value["latitude"] === undefined || value["longitude"] === undefined) continue;
      const { query: _query, ...point } = value;
      kept.push({ ...element, value: point });
      continue;
    }
    const items = element["items"];
    if (Array.isArray(items)) {
      kept.push({
        ...element,
        items: items.map((item) => ({
          ...(item as Json),
          elements: downContent((item as Json)["elements"]),
        })),
      });
      continue;
    }
    kept.push(element);
  }
  return kept;
}

const migration = {
  version: "1.21.0",
  description:
    "The map follows the address: an optional query and an optional point on a map value (ADR 0080, sprint 40 día 4).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.21.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const pages = input["pages"];
    if (!Array.isArray(pages)) return { ...input, schemaVersion: "1.20.0" };
    return {
      ...input,
      pages: pages.map((page) => ({
        ...(page as Json),
        sections: ((page as Json)["sections"] as unknown[] | undefined)?.map((section) => ({
          ...(section as Json),
          content: downContent((section as Json)["content"]),
        })),
      })),
      schemaVersion: "1.20.0",
    };
  },
} as const;

export default migration;
