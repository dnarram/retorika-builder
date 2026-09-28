import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type Facts, textFor } from "../src/index.ts";
import { draftFileSchema, sectorFileSchema } from "../src/schema.ts";

/**
 * `drafts/` — texts written and waiting for a person to read them.
 *
 * ADR 0009 proposed this directory with one sentence about it: "AI drafts awaiting review: no
 * code reads them, ever". `packages/copybank/README.md` then deferred creating it — "If drafting
 * ever outpaces review, `drafts/` is created then, along with the test proving no code path reads
 * it." This is that test, and this is that day: both usability sessions found the tone wrong for
 * hostelería, the rewrite is drafted, and nobody has read it yet.
 *
 * Two things are proved, and they pull in opposite directions on purpose:
 *
 * 1. **Nothing published can come from here.** The loader cannot reach it, the strict schema
 *    rejects it, and none of a draft's new wordings is being served.
 * 2. **A draft is nonetheless correct.** Every rule that applies to an approved file applies to it
 *    except the signature, so approving one is a one-word change that cannot fail on a rule nobody
 *    had checked yet.
 *
 * **Read from the directory, not imported**, unlike `bank.test.ts`. The bank is imported because
 * the generator is bundled and a filesystem path would not survive deployment; nothing bundles
 * `drafts/`, and reading the directory is what lets approving a draft be a plain `git mv` — the
 * act ADR 0009 named as the review — with no test to edit afterwards. When the last draft is
 * approved this file keeps passing, still guarding the one claim that outlives them all: that
 * `src/` never reaches in here.
 */

const here = import.meta.dirname;
const DRAFTS_DIR = join(here, "..", "drafts");
const BANK_DIR = join(here, "..", "bank");
const SRC_DIR = join(here, "..", "src");

function draftNames(): string[] {
  if (!existsSync(DRAFTS_DIR)) return [];
  return readdirSync(DRAFTS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function readJson(dir: string, name: string): unknown {
  return JSON.parse(readFileSync(join(dir, name), "utf8"));
}

const NAMES = draftNames();

/**
 * The per-draft blocks are skipped when there is nothing in `drafts/`, which is the state this
 * package spent its first four days in and the state it returns to once the last draft is
 * approved. Without this, `it.each([])` reports a describe with no tests as a failure — so the
 * suite would go red on the very commit that finished the work it was written to guard.
 */
const perDraft = NAMES.length > 0 ? describe : describe.skip;

describe("drafts/ is out of reach whether or not anything is in it", () => {
  it("is not imported or read by anything in src/", () => {
    // The promise `README.md` made, as something that fails rather than something remembered. A
    // source-level check because that is where the mistake would be made: one import line in
    // `index.ts` is all it would take for an unread text to reach a published page.
    //
    // Imports and reads, not mentions: `index.ts`'s own comment says it must never read from
    // there, and a test that forbade naming the thing would forbid explaining it.
    const reaches = /(?:from|import|require|readFileSync|readdirSync)\s*\(?\s*["'][^"']*drafts\//;
    for (const name of readdirSync(SRC_DIR)) {
      const source = readFileSync(join(SRC_DIR, name), "utf8");
      expect(source, `src/${name} reaches into drafts/`).not.toMatch(reaches);
    }
  });
});

perDraft("no draft's words can reach a published page", () => {
  it.each(NAMES)("%s is rejected by the schema the loader uses", (name) => {
    // Belt as well as braces: even if something did import it, `sectorFileSchema.parse` runs at
    // module load and would bring the application down rather than publish it.
    expect(() => sectorFileSchema.parse(readJson(DRAFTS_DIR, name))).toThrow();
  });

  it.each(NAMES)("%s has none of its new wordings served by the bank", (name) => {
    // The end-to-end version of the same claim: for every text this draft would change, ask the
    // bank for that slot and confirm the answer is still the approved one.
    const draft = draftFileSchema.parse(readJson(DRAFTS_DIR, name));
    const facts: Facts = { negocio: "Taberna Santo Domingo", ciudad: "Ronda" };
    const fill = (text: string) =>
      text.replace("{negocio}", facts.negocio).replace("{ciudad}", facts.ciudad ?? "");

    let changed = 0;
    for (const entry of draft.entries) {
      const served = textFor(draft.sector, entry.section, entry.slot, facts);
      if (served === fill(entry.text)) continue;
      changed += 1;
      expect(served, `${entry.id} is being served from the draft`).not.toBe(fill(entry.text));
    }
    // And the draft is not a copy of what already ships: a file that changed nothing would be a
    // review request with no decision in it.
    expect(changed, `${name} changes nothing the bank does not already say`).toBeGreaterThan(0);
  });

  it.each(NAMES)("%s was not copied into bank/ instead of moved", (name) => {
    if (!existsSync(join(BANK_DIR, name))) return;
    expect(readJson(BANK_DIR, name), `${name} is identical in bank/ and drafts/`).not.toEqual(
      readJson(DRAFTS_DIR, name),
    );
  });
});

perDraft("every draft is correct apart from being unsigned", () => {
  it.each(NAMES)("%s parses against the draft schema", (name) => {
    expect(() => draftFileSchema.parse(readJson(DRAFTS_DIR, name))).not.toThrow();
  });

  it.each(NAMES)("%s says it is unsigned, and when it was written", (name) => {
    const draft = draftFileSchema.parse(readJson(DRAFTS_DIR, name));
    expect(draft.review.status).toBe("draft");
    expect(draft.review.drafted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // No `by`. Nobody has approved it, so there is nobody to name — see `draftFileSchema`.
    expect(draft.review).not.toHaveProperty("by");
  });

  it.each(NAMES)("%s gives every entry an id of its own", (name) => {
    const ids = draftFileSchema.parse(readJson(DRAFTS_DIR, name)).entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(NAMES)("%s keeps the {ciudad} rule of ADR 0009", (name) => {
    // Every text using {ciudad} has a sibling without it, because question 4 admits "solo online".
    // Checked before approval, since a draft that broke it would put a literal "{ciudad}" on a
    // cover the moment it was signed.
    const draft = draftFileSchema.parse(readJson(DRAFTS_DIR, name));
    for (const entry of draft.entries) {
      if (!entry.placeholders.includes("ciudad")) continue;
      const sibling = draft.entries.find(
        (candidate) =>
          candidate.section === entry.section &&
          candidate.slot === entry.slot &&
          !candidate.placeholders.includes("ciudad"),
      );
      expect(sibling, `${entry.id} has no alternative without a city`).toBeDefined();
    }
  });
});
