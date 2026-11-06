/**
 * The fixed bar can say how much has been read (ADR 0068, sprint 34 día 6): `header.progress` may be
 * `true`, and only beside `sticky: true` — the line lives at the foot of a bar that stays at the top,
 * and a schema refinement refuses it anywhere else.
 *
 * **`up` seals and moves nothing.** The key is optional and absent on every document written before
 * today, so a 1.17.0 document is already a valid 1.18.0 one — the shape of `0015`, `0016` and `0017`.
 * Nothing here could turn it on either: the line is an owner's choice, off by default for every site,
 * saved or new (David's condition b). The affected set is counted rather than assumed: no corpus
 * fixture carries the key. Counted 6 November 2026.
 *
 * **`down` is lossy and says so.** 1.17.0 has nowhere to keep the line, so the key goes and the bar
 * stays fixed: what is left is the header as it published the day before, without its line.
 */

const migration = {
  version: "1.18.0",
  description:
    "A fixed bar may show how much of the page has been read (ADR 0068, sprint 34 día 6).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.18.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const header = input["header"] as Record<string, unknown> | undefined;
    if (header === undefined || !("progress" in header)) {
      return { ...input, schemaVersion: "1.17.0" };
    }
    const { progress: _, ...rest } = header;
    return { ...input, header: rest, schemaVersion: "1.17.0" };
  },
} as const;

export default migration;
