import { FINE_COLUMNS, FINE_PER_COLUMN, GRID_COLUMNS } from "../src/document.ts";
import { coarseToFine, gapRowsFor } from "../src/fineGrid.ts";

/**
 * A hand-designed section's grid is ninety-six units and eight-pixel rows (ADR 0050).
 *
 * Until 1.11.0 a free section stored its placements on the catalog's own grid — twelve columns and
 * content-sized rows, `grid: { columns: 12 }` — because a free section began as a copy of what the
 * catalog drew and the four «Colocación» steppers moved things a column at a time. Sprint 25 asks
 * for an element to stay where the hand lets go of it, and a twelfth of a section (75–100 px) is a
 * step anybody notices. The grid got finer; rule 4 did not move.
 *
 * **What `up` does to a stored layout, and how exact each half is.**
 *
 * - `grid.columns` becomes 96, and every `column` and `columnSpan` is multiplied by eight. **Exact
 *   to the pixel**: the published stylesheet keeps the twelve bands and the eleven gutters as they
 *   were, and `fineGrid.ts` puts unit `(c − 1) · 8 + 1` on the same CSS line column `c` was on.
 * - `row` and `rowSpan` take the theme's rhythm: the catalog's rows had `space.md` of gap between
 *   them and a free section's rows have none, so each row is followed by as many empty eight-pixel
 *   rows as that gap was tall (`gapRowsFor`). **Exact in the default scale** (16 px is two rows)
 *   **and within 4 px in the other two** (12 px rounds to two rows; 24 is three). What it cannot
 *   reproduce is the one case a content-sized grid never drew tightly either: a photograph taller
 *   than the texts beside it, whose spare height the browser spreads over the rows it spans. A
 *   section escalated *after* this version is measured by the editor instead and does not have this.
 * - **`align-items` goes from `center` to `start`** in a free section, which is a change to the
 *   stylesheet and not to the document, and is named here because this migration is what makes it
 *   reach a stored site: a short text beside a taller photograph stops being centred in its row and
 *   sits at the top of it. Two corpus fixtures move (`hidden-and-embed`, `physio-free-cover`), and
 *   the review of their diff is in the pull request that lands this file.
 *
 * **The mobile patch is untouched.** «Foto menor» is a fraction of twelve over a one-column page
 * (`breakpointPatchSchema.columnSpan`), and twelve is still what it is a fraction of.
 *
 * **The affected set, counted:** 2 of the 19 corpus fixtures carry a layout. Pre-launch, so no
 * client site does. Counted 20 October 2026.
 *
 * **`down` is lossy and says so.** It takes the column a unit falls in and the nearest whole
 * number of columns for a span, and takes the rhythm back out the same way — exact for everything
 * `up` produced, and the column a placement somebody dragged to unit 37 sits in. 1.11.0 has no way
 * to say «unit 37», and the most a `down` can honestly promise is what 1.11.0 could express.
 */

type Json = Record<string, unknown>;

/** A section's stored layout, when it has one, or `null`/`undefined`. */
function layoutOf(section: Json): Json | null {
  const layout = section["layout"];
  return layout && typeof layout === "object" ? (layout as Json) : null;
}

/** The theme's `space.md`, which a 1.11.0 document always carries in pixels (migration 0007). */
function spaceMdOf(input: Json): unknown {
  const theme = input["theme"];
  return theme && typeof theme === "object" ? (theme as Json)["space.md"] : undefined;
}

function mapLayouts(input: Json, change: (layout: Json) => Json): Json {
  const pages = input["pages"];
  if (!Array.isArray(pages)) return input;
  return {
    ...input,
    pages: pages.map((page) => {
      const sections = (page as Json)["sections"];
      if (!Array.isArray(sections)) return page;
      return {
        ...(page as Json),
        sections: sections.map((section) => {
          const layout = layoutOf(section as Json);
          return layout ? { ...(section as Json), layout: change(layout) } : section;
        }),
      };
    }),
  };
}

const migration = {
  version: "1.12.0",
  description:
    "A hand-designed section's grid is ninety-six units and eight-pixel rows; stored placements convert exactly sideways and by the theme's rhythm downwards (ADR 0050).",

  up(input: Json): Json {
    // Read once per document, and only when there is a layout to convert: a document with no free
    // section never needs its theme looked at, and one with a free section and no pixel theme is
    // not a 1.11.0 document at all — said explicitly rather than converted by a guess.
    let gapRows: number | undefined;
    const converted = mapLayouts(input, (layout) => {
      gapRows ??= gapRowsFor(spaceMdOf(input));
      const rhythm = gapRows;
      const placements = Array.isArray(layout["placements"]) ? layout["placements"] : [];
      return {
        ...layout,
        grid: { columns: FINE_COLUMNS },
        placements: placements.map((placement) =>
          coarseToFine(placement as Parameters<typeof coarseToFine>[0], rhythm),
        ),
      };
    });
    return { ...converted, schemaVersion: "1.12.0" };
  },

  down(input: Json): Json {
    let gapRows: number | undefined;
    const converted = mapLayouts(input, (layout) => {
      gapRows ??= gapRowsFor(spaceMdOf(input));
      const rhythm = 1 + gapRows;
      const placements = Array.isArray(layout["placements"]) ? layout["placements"] : [];
      return {
        ...layout,
        grid: { columns: GRID_COLUMNS },
        placements: placements.map((entry) => {
          const placement = entry as Json;
          const column = Number(placement["column"]);
          const columnSpan = Number(placement["columnSpan"]);
          const row = Number(placement["row"]);
          const rowSpan = Number(placement["rowSpan"]);
          return {
            ...placement,
            column: Math.floor((column - 1) / FINE_PER_COLUMN) + 1,
            columnSpan: Math.max(1, Math.round(columnSpan / FINE_PER_COLUMN)),
            row: Math.floor((row - 1) / rhythm) + 1,
            rowSpan: Math.max(1, Math.round((rowSpan + (rhythm - 1)) / rhythm)),
          };
        }),
      };
    });
    return { ...converted, schemaVersion: "1.11.0" };
  },
} as const;

export default migration;
