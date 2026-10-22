import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **A handler the canvas wires reads the present, never what was captured** (ADR 0051 §5).
 *
 * Under the `patch` route the document and its listeners outlive every edit, so a handler that
 * read `doc` from its closure would act on the document from before the edit — and a callback
 * read from the closure would close over a history that has since moved. The rule is that every
 * such value goes through a «now» ref, and this holds the source to it: between `wireLinks` and
 * `wireOnce`, no bare `doc`, no bare `designTools`, no bare `on*` prop. One read missed is a
 * handler acting on a document that no longer exists, silently, which no walk is likely to catch.
 *
 * Line-based and deliberately dumb, like `chromeGuard.test.ts`: a regex over the file, not a type,
 * because the type of a stale `doc` is exactly the type of a fresh one.
 */
const EDITOR = fileURLToPath(new URL("../src/questionnaire/Editor.tsx", import.meta.url));

function wiringRange(source: string): string {
  const start = source.indexOf("\n  function wireLinks(");
  const end = source.indexOf("\n  function wireOnce(");
  expect(start, "wireLinks is where the wiring begins").toBeGreaterThan(0);
  expect(end, "wireOnce is where it ends").toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("the wiring reads the present", () => {
  const range = wiringRange(readFileSync(EDITOR, "utf8"));

  it("never reads `doc` or the design state from a closure", () => {
    for (const name of [
      "doc",
      "designTools",
      "pageId",
      "photoStates",
      "designOn",
      "designSectionId",
      "placingElementId",
    ]) {
      const bare = range.match(new RegExp(`(?<![\\w.])${name}(?!\\w)`, "g")) ?? [];
      expect(bare, `a bare \`${name}\` in the wiring: it must be \`${name}Now.current\``).toEqual(
        [],
      );
    }
  });

  it("calls every callback through propsNow", () => {
    const bare = (range.match(/(?<![\w.])on[A-Z]\w+\(/g) ?? []).filter(
      (call) => call !== "onClick(",
    );
    expect(bare, "a prop called from the wiring without `propsNow.current.`").toEqual([]);
    // And the refs are read, so an empty match above is not an empty range.
    expect((range.match(/docNow\.current/g) ?? []).length).toBeGreaterThan(20);
    expect((range.match(/propsNow\.current\./g) ?? []).length).toBeGreaterThan(15);
  });
});
