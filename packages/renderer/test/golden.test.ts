import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "../src/index.ts";
import { GOLDEN_DIR, loadCorpus } from "./corpus.ts";

/**
 * The golden corpus (protocol Part 8.3): the generated HTML is compared against a stored
 * copy, and the diff is reviewed in the pull request. It is the only way to see that a
 * style change has quietly altered two hundred published sites.
 *
 * Regenerate deliberately with `pnpm test:golden -u`, then read the diff.
 */

const UPDATE = process.argv.includes("-u") || process.env["UPDATE_GOLDEN"] === "1";

describe("golden", () => {
  mkdirSync(GOLDEN_DIR, { recursive: true });

  for (const { name, document } of loadCorpus()) {
    it(`renders ${name} exactly as stored`, () => {
      const { html } = render(document, "html");
      const file = join(GOLDEN_DIR, `${name}.html`);

      if (UPDATE || !existsSync(file)) {
        writeFileSync(file, html, "utf8");
        return;
      }

      expect(html).toBe(readFileSync(file, "utf8"));
    });
  }
});
