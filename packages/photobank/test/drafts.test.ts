import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bankFileSchema, draftBankFileSchema } from "../src/schema.ts";

/**
 * `drafts/` — sample photographs awaiting review. The same shape `packages/copybank/test/drafts.test.ts`
 * proves around the text bank, drawn here around this one.
 *
 * Two things are proved, and they pull in opposite directions on purpose:
 *
 * 1. **Nothing published can come from here.** The loader (`src/index.ts`) never imports from
 *    `drafts/`, and the strict, approved-only schema rejects a draft record outright.
 * 2. **A draft is nonetheless correct.** `draftBankFileSchema` checks everything the approved
 *    schema does except the signature, so approving one is a `git mv` and a one-word change to
 *    `review`, and it cannot fail on a rule nobody had already checked.
 *
 * **Read from the directory, not imported**, for the reason copybank's own comment gives: nothing
 * bundles `drafts/`, and reading it is what lets approving a draft be exactly that `git mv` with no
 * test to edit afterwards. When there is nothing in `drafts/` — which is this package's state from
 * the day it was written — this file still guards the one claim that outlives every draft: that
 * `src/` never reaches in here.
 */

const HERE = import.meta.dirname;
const DRAFTS_DIR = join(HERE, "..", "drafts");
const SRC_DIR = join(HERE, "..", "src");

function draftNames(): string[] {
  if (!existsSync(DRAFTS_DIR)) return [];
  return readdirSync(DRAFTS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

const NAMES = draftNames();

/** Skipped rather than failing on an empty `drafts/` — the state this package ships in — for the
 * same reason copybank's own test does this: `it.each([])` would report a describe with no tests
 * as a failure, so the suite would go red on the day there is nothing left to approve. */
const perDraft = NAMES.length > 0 ? describe : describe.skip;

describe("drafts/ is out of reach whether or not anything is in it", () => {
  it("is not imported or read by anything in src/", () => {
    const reaches = /(?:from|import|require|readFileSync|readdirSync)\s*\(?\s*["'][^"']*drafts\//;
    for (const name of readdirSync(SRC_DIR)) {
      const source = readFileSync(join(SRC_DIR, name), "utf8");
      expect(source, `src/${name} reaches into drafts/`).not.toMatch(reaches);
    }
  });
});

perDraft("no draft's photograph can reach a published page", () => {
  it.each(NAMES)("%s is rejected by the schema the loader uses", (name) => {
    expect(() =>
      bankFileSchema.parse(JSON.parse(readFileSync(join(DRAFTS_DIR, name), "utf8"))),
    ).toThrow();
  });
});

perDraft("every draft is correct apart from being unsigned", () => {
  it.each(NAMES)("%s parses against the draft schema", (name) => {
    expect(() =>
      draftBankFileSchema.parse(JSON.parse(readFileSync(join(DRAFTS_DIR, name), "utf8"))),
    ).not.toThrow();
  });

  it.each(NAMES)("%s says every image is unsigned, and when it was drafted", (name) => {
    const draft = draftBankFileSchema.parse(
      JSON.parse(readFileSync(join(DRAFTS_DIR, name), "utf8")),
    );
    for (const image of draft.images) {
      expect(image.review.status).toBe("draft");
      expect(image.review.drafted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(image.review).not.toHaveProperty("by");
    }
  });

  it.each(NAMES)("%s gives every image an id of its own", (name) => {
    const draft = draftBankFileSchema.parse(
      JSON.parse(readFileSync(join(DRAFTS_DIR, name), "utf8")),
    );
    const ids = draft.images.map((image) => image.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
