/**
 * The fill keeps the brand's colour, and the palette says where it came from (ADR 0074 and 0075,
 * sprint 38 día 1): an optional pair `theme["color.fill"]` / `theme["color.onFill"]` — the brand's
 * colour wherever something is filled and the ink drawn on it — and an optional `palette` beside the
 * theme — `{ kind: "palette", id }`, `{ kind: "logo" }` or `{ kind: "own" }`.
 *
 * **`up` seals and moves nothing.** All three are optional and absent on every document written
 * before today, and absent they draw exactly what every site drew before: the fill is
 * `color.primary`, its ink is `color.surface`, and nobody is recorded as having chosen the colours.
 * So a 1.19.0 document is already a valid 1.20.0 one — the shape of `0017`, `0019` and `0020` — and
 * the proof is the golden corpus, migrated to 1.20.0 and rendered byte for byte as before. Writing the
 * pair here (`fill = primary`, `onFill = surface`) was the other road and was refused: it changes no
 * pixel and every published byte, the corpus's twenty-three goldens and every saved ZIP among them.
 *
 * **Not writing `palette` is the point, not a shortcut.** Absent means «nobody chose» (ADR 0075): a
 * site whose owner picked «Neutra» in «Estilo» before today carries the same colours as one never
 * touched, and nothing in a 1.19.0 document can tell them apart. Both arrive here as untouched, which
 * is the honest reading and the ADR's known limit — a logo uploaded later repaints such a site, as one
 * history step the owner can undo.
 *
 * **`down` is lossy and says so.** 1.19.0 has nowhere to keep a fill apart from the text's colour,
 * nor an origin: the pair and `palette` go, and the six colours stay. A site whose fill differed from
 * its primary goes back to filling with its primary — which, for a brand colour too light to be read
 * as text, is the darker sibling the text was already using.
 */

const migration = {
  version: "1.20.0",
  description:
    "The fill keeps the brand's colour: optional color.fill/color.onFill in the theme and an optional palette origin (ADR 0074 and 0075, sprint 38 día 1).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.20.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const { palette: _origin, ...withoutOrigin } = input;
    const theme = input["theme"] as Record<string, unknown> | undefined;
    if (theme === undefined || !("color.fill" in theme || "color.onFill" in theme)) {
      return { ...withoutOrigin, schemaVersion: "1.19.0" };
    }
    const { "color.fill": _fill, "color.onFill": _ink, ...colours } = theme;
    return { ...withoutOrigin, theme: colours, schemaVersion: "1.19.0" };
  },
} as const;

export default migration;
