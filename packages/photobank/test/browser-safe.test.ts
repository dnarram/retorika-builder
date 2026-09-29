import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `src/index.ts` is imported into a browser bundle — `packages/generator` calls `sampleImageFor`
 * client-side, the same way `packages/copybank` is bundled into it already. It must never import
 * `node:fs`, `node:path` or anything else under `node:`, and it must never reach `./server.ts`,
 * which is the one module that does.
 *
 * A source-level check, in the same spirit as `test/drafts.test.ts` and the guard
 * `packages/copybank/test/drafts.test.ts` draws around its own `drafts/`: the failure this exists
 * to catch is a single import line, added in good faith by someone who needed a byte count and
 * reached for the obvious thing.
 */
describe("src/index.ts stays browser-safe", () => {
  const source = readFileSync(join(import.meta.dirname, "..", "src", "index.ts"), "utf8");

  it("imports nothing under node:", () => {
    expect(source).not.toMatch(/from\s+["']node:/);
  });

  it("does not import ./server.ts, named, bare or dynamic", () => {
    // Not anchored to `from`: `import "./server.ts"` — a bare import, run for a side effect and
    // easy to add by accident — has no `from` at all, and the first version of this check missed
    // exactly that shape. Found by breaking it on purpose and watching the test stay green.
    expect(source).not.toMatch(/["']\.\/server(\.ts)?["']/);
  });
});
