/**
 * A background with motifs (ADR 0081, sprint 40 día 5): an optional `background` record on the
 * document and on each section — a picture's name, its size, how it is painted and its two
 * extremes — under which the renderer draws a veil whose opacity it derives when the page is drawn.
 *
 * **`up` seals and moves nothing.** Both keys are optional and absent on every document written
 * before today, and absent they draw exactly what every site drew before. The shape of `0017`,
 * `0019`, `0020`, `0021` and `0022`.
 *
 * **`down` is lossy and says so.** 1.21.0 has nowhere to keep a background: both keys go, the site
 * and the sections keep everything else, and the picture's bytes stay where they are until the
 * account's reconciliation sees nothing naming them.
 */

type Json = Record<string, unknown>;

const migration = {
  version: "1.22.0",
  description:
    "A background with motifs: an optional background on the document and on each section (ADR 0081, sprint 40 día 5).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.22.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const { background: _site, ...rest } = input;
    const pages = rest["pages"];
    if (!Array.isArray(pages)) return { ...rest, schemaVersion: "1.21.0" };
    return {
      ...rest,
      pages: pages.map((page) => ({
        ...(page as Json),
        sections: ((page as Json)["sections"] as unknown[] | undefined)?.map((section) => {
          const { background: _own, ...kept } = section as Json;
          return kept;
        }),
      })),
      schemaVersion: "1.21.0",
    };
  },
} as const;

export default migration;
