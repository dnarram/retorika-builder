/**
 * An element has a place in the stack (ADR 0085, sprint 41 día 7): an optional `layer` on a
 * placement — 1 is the bottom — written by «Traer al frente» and «Enviar atrás» on every placement of
 * a hand-designed section at once.
 *
 * **`up` seals and moves nothing.** Absent everywhere is the order every site has always drawn —
 * photographs under everything else, each in document order — and absent it stays.
 *
 * **`down` is lossy and says so.** 1.23.0 has nowhere to keep a stack: every `layer` goes, and the
 * section paints in the default order again — a text sent behind a photograph comes back above it.
 */

type Json = Record<string, unknown>;

const migration = {
  version: "1.24.0",
  description:
    "An element has a place in the stack: an optional layer on a placement (ADR 0085, sprint 41 día 7).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.24.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const pages = input["pages"];
    if (!Array.isArray(pages)) return { ...input, schemaVersion: "1.23.0" };
    return {
      ...input,
      pages: pages.map((page) => ({
        ...(page as Json),
        sections: ((page as Json)["sections"] as unknown[] | undefined)?.map((raw) => {
          const section = raw as Json;
          const layout = section["layout"] as Json | null | undefined;
          const placements = layout?.["placements"];
          if (!layout || !Array.isArray(placements)) return section;
          return {
            ...section,
            layout: {
              ...layout,
              placements: placements.map((placement) => {
                const { layer: _place, ...kept } = placement as Json;
                return kept;
              }),
            },
          };
        }),
      })),
      schemaVersion: "1.23.0",
    };
  },
} as const;

export default migration;
