import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { GOLDEN_DIR, loadCorpus, REPO_ROOT } from "./corpus.ts";

/**
 * The golden corpus (protocol Part 8.3): the generated HTML is compared against a stored
 * copy, and the diff is reviewed in the pull request. It is the only way to see that a
 * style change has quietly altered two hundred published sites.
 *
 * Regenerate deliberately with `UPDATE_GOLDEN=1 pnpm test:golden`, then read the diff. A
 * missing golden fails instead of being written: a golden nobody generated on purpose is a
 * golden nobody reviewed (issue #8).
 *
 * The Vitest `-u` flag is not supported: Vitest does not pass its flags to the workers that
 * run this file, so it could never reach this check (issue #8).
 */

const UPDATE = process.env["UPDATE_GOLDEN"] === "1";

/** Write only under UPDATE_GOLDEN=1; otherwise compare, or fail if there is nothing to compare. */
function goldenAction(update: boolean, exists: boolean): "write" | "compare" | "missing" {
  if (update) return "write";
  return exists ? "compare" : "missing";
}

/** Why the test failed and exactly how to fix it; the path is repository-relative. */
function missingGoldenMessage(name: string): string {
  const path = relative(REPO_ROOT, join(GOLDEN_DIR, `${name}.html`));
  return [
    `No golden file for "${name}" at ${path}. A missing golden is never written by the test:`,
    "generate it deliberately with `UPDATE_GOLDEN=1 pnpm test:golden`, then read the new",
    "file and the diff before committing.",
  ].join("\n");
}

describe("golden", () => {
  mkdirSync(GOLDEN_DIR, { recursive: true });

  for (const { name, document } of loadCorpus()) {
    it(`renders ${name} exactly as stored`, () => {
      const { html } = render(document, "html");
      const file = join(GOLDEN_DIR, `${name}.html`);
      const action = goldenAction(UPDATE, existsSync(file));

      if (action === "missing") throw new Error(missingGoldenMessage(name));
      if (action === "write") {
        writeFileSync(file, html, "utf8");
        return;
      }

      expect(html).toBe(readFileSync(file, "utf8"));
    });
  }
});

describe("goldenAction", () => {
  it("writes only under UPDATE_GOLDEN=1, whether or not the golden exists", () => {
    expect(goldenAction(true, false)).toBe("write");
    expect(goldenAction(true, true)).toBe("write");
  });

  it("compares an existing golden when not updating", () => {
    expect(goldenAction(false, true)).toBe("compare");
  });

  it("reports a missing golden instead of writing it", () => {
    expect(goldenAction(false, false)).toBe("missing");
  });

  it("says how to generate a missing golden", () => {
    const message = missingGoldenMessage("barbershop-cover");
    expect(message).toContain('"barbershop-cover"');
    expect(message).toContain("fixtures/golden/barbershop-cover.html");
    expect(message).toContain("UPDATE_GOLDEN=1 pnpm test:golden");
  });
});
