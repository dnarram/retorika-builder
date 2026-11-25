/**
 * A photograph has a shape and a point (ADR 0084, sprint 41 día 4): an optional `ratio` on a
 * placement — the shape a photograph was given by hand, width to height in lowest terms — and an
 * optional `focus` on an image value — the point, in whole percent, that its crop keeps.
 *
 * **`up` seals and moves nothing.** Both keys are optional and absent on every document written
 * before today, and absent they draw exactly what every photograph drew: the catalog's ratio,
 * centred. The shape of `0017`, `0019`–`0023`.
 *
 * **`down` is lossy and says so.** 1.22.0 has nowhere to keep either: every `ratio` and every
 * `focus` goes, the photographs go back to the catalog's shape, centred, and nothing else moves.
 */

type Json = Record<string, unknown>;

/** Every element of a section, a card's included, without its `focus`. */
function withoutFocus(elements: unknown): unknown {
  if (!Array.isArray(elements)) return elements;
  return elements.map((raw) => {
    const element = raw as Json;
    const value = element["value"] as Json | undefined;
    let out: Json = element;
    if (value && value["kind"] === "image" && "focus" in value) {
      const { focus: _point, ...kept } = value;
      out = { ...out, value: kept };
    }
    const items = element["items"];
    if (Array.isArray(items)) {
      out = {
        ...out,
        items: items.map((item) => ({
          ...(item as Json),
          elements: withoutFocus((item as Json)["elements"]),
        })),
      };
    }
    return out;
  });
}

const migration = {
  version: "1.23.0",
  description:
    "A photograph has a shape and a point: an optional ratio on a placement and an optional focus on an image (ADR 0084, sprint 41 día 4).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.23.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const pages = input["pages"];
    if (!Array.isArray(pages)) return { ...input, schemaVersion: "1.22.0" };
    return {
      ...input,
      pages: pages.map((page) => ({
        ...(page as Json),
        sections: ((page as Json)["sections"] as unknown[] | undefined)?.map((raw) => {
          const section = raw as Json;
          const layout = section["layout"] as Json | null | undefined;
          const placements = layout?.["placements"];
          return {
            ...section,
            content: withoutFocus(section["content"]),
            ...(layout && Array.isArray(placements)
              ? {
                  layout: {
                    ...layout,
                    placements: placements.map((placement) => {
                      const { ratio: _shape, ...kept } = placement as Json;
                      return kept;
                    }),
                  },
                }
              : {}),
          };
        }),
      })),
      schemaVersion: "1.22.0",
    };
  },
} as const;

export default migration;
