import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INVARIANTS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./corpus.ts";

/**
 * The documentation and the harness cannot drift apart.
 *
 * The invariant numbering exists once, in invariants-catalog.ts. This asserts that
 * docs/document-rules.md still transcribes it exactly. The numbering drifted three times
 * while this work was planned, every time because a second copy was maintained by hand.
 */
describe("documentation stays in step with the invariant catalog", () => {
  const rules = readFileSync(join(REPO_ROOT, "docs", "document-rules.md"), "utf8");

  it.each(Object.entries(INVARIANTS))("documents %s verbatim", (id, name) => {
    expect(rules, `${id} is missing from docs/document-rules.md`).toContain(id);
    expect(rules, `the name of ${id} has drifted`).toContain(name);
  });
});
