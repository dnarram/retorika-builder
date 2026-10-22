import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **The retirement list cannot rot in silence** (sprint 26 día 6). `docs/tasks/swap-route-retirement.md`
 * names every symbol the `swap` route leaves behind on sprint 27 día 1, with the line it lives on.
 * Lines move with every edit of `Editor.tsx`; a list that named a line nothing is on any more would
 * be read on the 27 as a list of things already gone. So each identifier the list names must still
 * exist in its file, within a tolerance of the line it states — and when one drifts past it, this
 * is what says so, by name, so the list is refreshed and not trusted.
 */
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const list = readFileSync(join(root, "docs", "tasks", "swap-route-retirement.md"), "utf8");

const FILES: Record<string, string> = {
  "## `apps/editor/src/questionnaire/Editor.tsx`": "apps/editor/src/questionnaire/Editor.tsx",
  "## `apps/editor/e2e/critical-flows.e2e.test.ts`": "apps/editor/e2e/critical-flows.e2e.test.ts",
};
/** How far a stated line may be from the symbol before the list is called stale. */
const TOLERANCE = 120;

interface Row {
  file: string;
  symbol: string;
  line: number | null;
}

/** One row per symbol: the first cell's backticked identifiers, zipped with the second cell's
 * integers when there are as many — one line per symbol, in order — and all given the first line
 * otherwise. */
function rows(): Row[] {
  const out: Row[] = [];
  let file: string | null = null;
  for (const raw of list.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      file = FILES[line] ?? null;
      continue;
    }
    if (!file || !line.startsWith("| `")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    const [first, second] = cells;
    if (!first || !second) continue;
    const symbols = [...first.matchAll(/`([^`]+)`/g)]
      .map((m) => m[1] ?? "")
      .map((s) => s.replace(/\(.*$/, "").replace(/^"|"$/g, ""))
      .filter((s) => /^[A-Za-z_][\w.-]*$/.test(s));
    const stated = [...second.matchAll(/\d+/g)].map((m) => Number(m[0]));
    for (const [index, symbol] of symbols.entries()) {
      const at = stated.length === symbols.length ? stated[index] : stated[0];
      out.push({ file, symbol, line: at ?? null });
    }
  }
  return out;
}

describe("the swap route's retirement list", () => {
  const parsed = rows();

  it("names something in each file it has a table for", () => {
    for (const file of Object.values(FILES)) {
      expect(
        parsed.filter((row) => row.file === file).length,
        `no rows parsed for ${file}`,
      ).toBeGreaterThan(3);
    }
  });

  for (const row of parsed) {
    {
      const symbol = row.symbol;
      it(`${symbol} is still in ${row.file.split("/").pop()} near line ${row.line ?? "?"}`, () => {
        const lines = readFileSync(join(root, row.file), "utf8").split("\n");
        // Code, not prose: a comment that *mentions* the symbol would put a stale line within reach
        // (the first version let «promote» at 1200 pass on a comment near it). Whole words only.
        const escaped = symbol.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
        const word = new RegExp(`(^|[^\\w])${escaped}($|[^\\w])`);
        const at = lines
          .map((text, index) => {
            const trimmed = text.trim();
            const comment =
              trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
            return !comment && word.test(text) ? index + 1 : -1;
          })
          .filter((index) => index > 0);
        expect(
          at.length,
          `«${symbol}» is gone from ${row.file}: the list is stale`,
        ).toBeGreaterThan(0);
        if (row.line !== null) {
          const nearest = at.reduce(
            (best, index) =>
              Math.abs(index - (row.line ?? 0)) < Math.abs(best - (row.line ?? 0)) ? index : best,
            at[0] ?? 0,
          );
          expect(
            Math.abs(nearest - row.line),
            `«${symbol}» says line ${row.line} but the nearest is ${nearest}: refresh the list`,
          ).toBeLessThanOrEqual(TOLERANCE);
        }
      });
    }
  }
});
