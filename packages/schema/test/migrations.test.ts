import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, migrateToCurrent } from "../migrations/index.ts";
import { SCHEMA_VERSION } from "../src/document.ts";
import { parseDocument } from "../src/parse.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/** The golden corpus, reached from this file rather than from the renderer's `corpus.ts`: schema
 * must not import from a package that depends on it. */
const DOCUMENTS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "fixtures",
  "documents",
);

// `space.md` in pixels: since 1.12.0 the chain reads it to convert a stored layout to the fine
// grid (migration 0013), and a placeholder where a length should be is refused rather than guessed.
const theme = {
  ...(Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme),
  "space.md": "16px",
} as Theme;

/**
 * The versions `0003`'s claim is about: documents written before the style vocabulary closed.
 *
 * Named as a set rather than written as `!== "1.2.0"`, which is what it said until day 3 of sprint
 * 10. That form meant «everything except the then-current version», so the first 1.3.0 fixture
 * would have been swept into the assertion instead of out of it — the test would have changed
 * subject on a version bump, which is the exact failure the `step` helper above exists to avoid.
 */
const BEFORE_CLOSED_VOCABULARY = new Set<string | undefined>([undefined, "1.0.0", "1.1.0"]);

/**
 * The same thing for `0004`'s claim, and it is here because the warning above came true.
 *
 * That test said «skip the file whose version is `SCHEMA_VERSION`, assert about the rest» — the
 * exact form the comment above describes as changing subject on a version bump. It did, on this
 * one: `SCHEMA_VERSION` became 1.4.0, the 1.3.0 marks fixture stopped being skipped, and a test
 * about documents written *before* marks existed went red over a document written *with* them.
 * Named as a set, it cannot happen again.
 */
const BEFORE_MARKS = new Set<string | undefined>([undefined, "1.0.0", "1.1.0", "1.2.0"]);

/**
 * A migration addressed by the version it produces, never by its position in the list.
 *
 * `MIGRATIONS.at(-1)` used to mean `0002` and stopped meaning it the moment `0003` landed, which
 * turned four passing tests red for a reason that had nothing to do with what they check. The tests
 * below are *about* a particular step, so they have to say which one — a test that follows the end
 * of the list is a test that silently changes subject on every schema change.
 */
function step(version: string) {
  const found = MIGRATIONS.find((migration) => migration.version === version);
  if (!found) throw new Error(`no migration produces ${version}`);
  return found;
}

/** Everything up to and including `version`, for a test that wants the document as that step left
 * it rather than as the whole chain leaves it. */
function upTo(input: Record<string, unknown>, version: string): Record<string, unknown> {
  let out = input;
  for (const migration of MIGRATIONS) {
    out = migration.up(out);
    if (migration.version === version) return out;
  }
  throw new Error(`no migration produces ${version}`);
}

describe("migrations", () => {
  it("ends at the current schema version", () => {
    const last = MIGRATIONS.at(-1);
    expect(last?.version).toBe(SCHEMA_VERSION);
  });

  it("brings a document with no version up to the current one", () => {
    const migrated = migrateToCurrent({ id: "doc-1" });
    expect(migrated["schemaVersion"]).toBe(SCHEMA_VERSION);
  });

  it("has no duplicate versions, which would make the chain ambiguous", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
  });
});

/**
 * The product's first real migration, and the first time this chain has been asked to be a chain.
 *
 * `0002` adds an optional `sample` to an image value, so every 1.0.0 document is already a valid
 * 1.1.0 one and `up` changes nothing but the version it claims. That is precisely why it is the
 * right one to run for real: the guard has existed since sprint 1 and never bitten — `isInitialState`
 * let every schema change through while `0001-initial` stood alone — so the machinery is being
 * exercised for the first time on a step whose failure mode is nothing.
 *
 * **One thing here is asserted and one is only guarded.** `migrateToCurrent` now skips a migration
 * the document is not older than, where it used to replay every `up` unconditionally. That is the
 * right shape — replaying a step that *moves data* would apply the change twice — but it cannot be
 * proved through the two migrations that exist, because both of their `up`s do nothing but stamp a
 * version and are therefore idempotent: replay and skip produce the identical document. I wrote a
 * test claiming to prove it, watched it pass with the skip removed, and replaced it with a `todo`.
 * The first migration that transforms anything is what makes the claim testable — that was `0012`,
 * eight versions later, and the `todo` outlived it by two more. The assertion now lives with the
 * two steps that move data, under «1.11.0» and «1.12.0» below, and each was watched going red with
 * the skip in `migrateToCurrent` removed (sprint 28 day 6).
 */
describe("0002 — an image may name the sample it is", () => {
  /** A 1.0.0 document, as one saved before today looks: no `sample` anywhere. */
  function before(): Record<string, unknown> {
    return {
      schemaVersion: "1.0.0",
      id: "doc-1",
      siteName: "Taberna Santo Domingo",
      theme,
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna Santo Domingo",
          sections: [
            {
              id: "sec-cover",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "catalog",
              layout: null,
              content: [
                {
                  id: "el-image",
                  role: "image",
                  hidden: false,
                  slot: "image",
                  value: { kind: "image", src: "assets/foto.jpg", alt: "Una foto" },
                },
                {
                  id: "el-photos",
                  role: "list",
                  hidden: false,
                  slot: "photos",
                  items: [
                    {
                      id: "item-1",
                      elements: [
                        {
                          id: "el-item-photo",
                          role: "image",
                          hidden: false,
                          slot: "photo",
                          // Inside a list item, which is where a gallery's photographs live and
                          // where every walk in this repository has forgotten to look at least once.
                          value: { kind: "image", src: "assets/dos.jpg", alt: "Otra" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  const sampled = () => {
    const doc = before();
    const pages = doc["pages"] as { sections: { content: Record<string, unknown>[] }[] }[];
    const content = pages[0]?.sections[0]?.content ?? [];
    (content[0] as { value: Record<string, unknown> }).value["sample"] = "marcador";
    const items = (content[1] as { items: { elements: Record<string, unknown>[] }[] }).items;
    const nested = items[0]?.elements[0] as { value: Record<string, unknown> };
    nested.value["sample"] = "restaurante-bar.03";
    return { ...doc, schemaVersion: "1.1.0" };
  };

  it("opens a document saved before the field existed", () => {
    // The whole promise the guard protects: a site saved today still opens in two years.
    const migrated = migrateToCurrent(before());
    expect(migrated["schemaVersion"]).toBe(SCHEMA_VERSION);
    expect(() => parseDocument(migrated)).not.toThrow();
  });

  it("changes nothing but the version, because the field is optional", () => {
    const input = before();
    const migrated = migrateToCurrent(input);
    expect({ ...migrated, schemaVersion: "1.0.0" }).toEqual(input);
  });

  it("round-trips: down after up gives back exactly what went in", () => {
    // The round trip the guard demands, and the only real proof the field is additive.
    const input = before();
    const down = step("1.1.0").down;
    if (!down) throw new Error("0002 has no down");
    expect(down(upTo(input, "1.1.0"))).toEqual(input);
  });

  it("strips the field from every image, list items included, on the way down", () => {
    const down = step("1.1.0").down;
    if (!down) throw new Error("0002 has no down");
    const stripped = down(sampled());

    expect(JSON.stringify(stripped)).not.toContain("sample");
    expect(stripped["schemaVersion"]).toBe("1.0.0");
    // And it is the *key* that is gone, not a key set to undefined: the strict schema treats those
    // as different, and only the first of them round-trips.
    expect(down(sampled())).toEqual(before());
  });

  it("leaves an already-migrated document exactly as it found it", () => {
    const already = { ...sampled(), schemaVersion: SCHEMA_VERSION };
    expect(migrateToCurrent(already)).toEqual(already);
  });

  it("runs every step for a document with no version at all", () => {
    const migrated = migrateToCurrent({ id: "doc-1" });
    expect(migrated["schemaVersion"]).toBe(SCHEMA_VERSION);
  });
});

/**
 * `0003` narrows a shape instead of widening one, which is the first time this chain has done that.
 *
 * `0002` was additive: every 1.0.0 document was already a valid 1.1.0 document, so the only question
 * was whether `down` stripped what `up` allowed. Here the question is the opposite one, and it is
 * sharper: **a 1.1.0 document with a `style` this vocabulary does not admit cannot be migrated at
 * all.** `{"wobble": {ref: "color.primary"}}` parsed yesterday and does not parse today.
 *
 * The only reason `up` can be a version stamp is that the set of such documents is empty —
 * `ContentElement.style` has existed since phase 0 and nothing has ever written to it. That is a
 * claim about the whole repository rather than about this file, so the last test here checks it
 * where it can be checked: no fixture in the golden corpus carries the field.
 */
describe("0003 — an element's style is a closed vocabulary", () => {
  function before(): Record<string, unknown> {
    return {
      schemaVersion: "1.1.0",
      id: "doc-1",
      siteName: "Barbería El Corte",
      theme,
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Barbería El Corte",
          sections: [
            {
              id: "sec-cover",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "catalog",
              layout: null,
              content: [
                {
                  id: "el-headline",
                  role: "heading",
                  hidden: false,
                  slot: "headline",
                  value: { kind: "text", text: "Barbería El Corte" },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  it("opens a document saved before the vocabulary closed", () => {
    // The whole chain, deliberately: this one is about a 1.1.0 document still opening *today*, so
    // it follows the current version rather than the step's. `upTo` is used below, where the
    // subject is 0003 itself.
    const migrated = migrateToCurrent(before());
    expect(migrated["schemaVersion"]).toBe(SCHEMA_VERSION);
    expect(() => parseDocument(migrated)).not.toThrow();
  });

  it("changes nothing but the version, because no stored document carries style", () => {
    const input = before();
    expect({ ...upTo(input, "1.2.0"), schemaVersion: "1.1.0" }).toEqual(input);
  });

  it("round-trips: down after up gives back exactly what went in", () => {
    const input = before();
    const down = step("1.2.0").down;
    if (!down) throw new Error("0003 has no down");
    expect(down(upTo(input, "1.2.0"))).toEqual(input);
  });

  it("carries a style written against the new vocabulary back down unharmed", () => {
    // The mirror image of `0002`'s strip test, and it is a strip test with nothing to strip: every
    // 1.2.0 style object is a valid 1.1.0 open map, since the old key was `z.string()` and the old
    // value was the same ref-or-exact union. Narrowing takes nothing away that has to be given back.
    const input = before();
    const pages = input["pages"] as { sections: { content: Record<string, unknown>[] }[] }[];
    const element = pages[0]?.sections[0]?.content[0];
    if (!element) throw new Error("no element");
    element["style"] = { color: { ref: "color.ink" } };

    const down = step("1.2.0").down;
    if (!down) throw new Error("0003 has no down");
    const roundTripped = down(upTo(structuredClone(input), "1.2.0"));
    expect(roundTripped).toEqual(input);
  });

  it("is the claim it rests on: no document written before 1.2.0 carries a style", () => {
    // If this ever goes red, `up` is no longer allowed to be a version stamp — somebody's stored
    // style would have to be read, checked against the new vocabulary, and either kept or refused
    // out loud. The migration's own header says so; this is the test that would say it first.
    //
    // **The version is the whole point of the filter, and day 3 is what taught it.** This test was
    // written the day before over every fixture, and `estilo-por-elemento` — authored against 1.2.0
    // to give the renderer's new branch a golden file — turned it red. It was right to fire and
    // wrong about what it meant: the migration's claim is about documents written against *1.1.0*,
    // which is the only set `up` can be asked to convert. A 1.2.0 fixture was never one of them, so
    // it cannot be a counterexample. Written loosely, this would have been relaxed into uselessness
    // the first time somebody added a styled fixture; written this way it still fires for the case
    // it exists for, and only for that one.
    const corpus = readdirSync(DOCUMENTS_DIR).filter((file) => file.endsWith(".json"));
    expect(corpus.length).toBeGreaterThan(0);
    let older = 0;
    for (const file of corpus) {
      const raw = readFileSync(join(DOCUMENTS_DIR, file), "utf8");
      const parsed = JSON.parse(raw) as { schemaVersion?: string };
      if (!BEFORE_CLOSED_VOCABULARY.has(parsed.schemaVersion)) continue;
      older += 1;
      expect(raw, file).not.toContain('"style"');
    }
    // And the filter has not quietly excluded everything, which would make this pass by vacuum.
    expect(older).toBeGreaterThan(0);
  });
});

/**
 * `0004` is additive, like `0002` and unlike `0003`: `marks` is a new optional field, so every
 * 1.2.0 document is already a valid 1.3.0 one.
 *
 * The interesting half is `down`, and it is the first in this chain that **loses something on
 * purpose**. 1.2.0 has nowhere to put a mark, so going back drops it: the text survives and the
 * emphasis does not. The alternative is refusing to migrate down, which locks somebody out of their
 * own site over a bold word. The tests below pin that it drops marks and *only* marks.
 */
describe("0004 — a text may carry marked runs", () => {
  function before(): Record<string, unknown> {
    return {
      schemaVersion: "1.2.0",
      id: "doc-1",
      siteName: "Taberna",
      theme,
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna",
          sections: [
            {
              id: "sec-cover",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "catalog",
              layout: null,
              content: [
                {
                  id: "el-headline",
                  role: "heading",
                  hidden: false,
                  slot: "headline",
                  value: { kind: "text", text: "Solomillo al whisky" },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  function headline(doc: Record<string, unknown>): Record<string, unknown> {
    const pages = doc["pages"] as { sections: { content: Record<string, unknown>[] }[] }[];
    const element = pages[0]?.sections[0]?.content[0];
    if (!element) throw new Error("no element");
    return element;
  }

  it("opens a document saved before marks existed", () => {
    const migrated = migrateToCurrent(before());
    expect(migrated["schemaVersion"]).toBe(SCHEMA_VERSION);
    expect(() => parseDocument(migrated)).not.toThrow();
  });

  it("changes nothing but the version", () => {
    const input = before();
    expect({ ...upTo(input, "1.3.0"), schemaVersion: "1.2.0" }).toEqual(input);
  });

  it("round-trips: down after up gives back exactly what went in", () => {
    const input = before();
    const down = step("1.3.0").down;
    if (!down) throw new Error("0004 has no down");
    expect(down(upTo(input, "1.3.0"))).toEqual(input);
  });

  it("drops marks on the way down, because 1.2.0 has nowhere to keep them", () => {
    const input = upTo(before(), "1.3.0");
    headline(input)["value"] = {
      kind: "text",
      text: "Solomillo al whisky",
      marks: [{ from: 0, to: 9, mark: "strong" }],
    };
    const down = step("1.3.0").down;
    if (!down) throw new Error("0004 has no down");

    const back = down(structuredClone(input));
    expect(back["schemaVersion"]).toBe("1.2.0");
    expect(headline(back)["value"]).toEqual({ kind: "text", text: "Solomillo al whisky" });
    // The text is untouched. Losing the emphasis is the decision; losing the words would be a bug.
    expect(JSON.stringify(back)).not.toContain('"marks"');
  });

  it("drops marks on a link's text too, which is where ADR 0027 §6 puts them as well", () => {
    const input = upTo(before(), "1.3.0");
    headline(input)["value"] = {
      kind: "link",
      text: "Reserva ya",
      href: "#",
      marks: [{ from: 0, to: 7, mark: "em" }],
    };
    const down = step("1.3.0").down;
    if (!down) throw new Error("0004 has no down");
    expect(headline(down(input))["value"]).toEqual({
      kind: "link",
      text: "Reserva ya",
      href: "#",
    });
  });

  it("does not empty something else that happens to be called marks", () => {
    // The walk is keyed on a text-carrying value rather than on the key name alone, so a future
    // collection field called `marks` is not silently erased by a migration about typography.
    const input = upTo(before(), "1.3.0");
    const pages = input["pages"] as { sections: Record<string, unknown>[] }[];
    const section = pages[0]?.sections[0];
    if (!section) throw new Error("no section");
    section["marks"] = ["not a text value"];

    const down = step("1.3.0").down;
    if (!down) throw new Error("0004 has no down");
    const back = down(input);
    const backSection = (back["pages"] as { sections: Record<string, unknown>[] }[])[0]
      ?.sections[0];
    expect(backSection?.["marks"]).toEqual(["not a text value"]);
  });

  it("is the claim it rests on: no document written before 1.3.0 carries marks", () => {
    // The mirror of the 0003 test above. If this goes red, `up` can no longer be a version stamp:
    // a stored `marks` written against 1.2.0 would predate `marksSchema`'s normal form and would
    // have to be normalised or refused out loud rather than waved through.
    const corpus = readdirSync(DOCUMENTS_DIR).filter((file) => file.endsWith(".json"));
    expect(corpus.length).toBeGreaterThan(0);
    let older = 0;
    for (const file of corpus) {
      const raw = readFileSync(join(DOCUMENTS_DIR, file), "utf8");
      const parsed = JSON.parse(raw) as { schemaVersion?: string };
      if (!BEFORE_MARKS.has(parsed.schemaVersion)) continue;
      older += 1;
      expect(raw, file).not.toContain('"marks"');
    }
    expect(older).toBeGreaterThan(0);
  });
});

describe("0005 — a section's breakpoints hold one bucket", () => {
  /** A free section with both buckets, which is what the catalog wrote into every layout it built
   * until this version: the key present and the array empty. */
  function before(tablet: unknown[] = []): Record<string, unknown> {
    return {
      schemaVersion: "1.3.0",
      id: "doc-1",
      siteName: "Taberna",
      theme,
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna",
          sections: [
            {
              id: "sec-cover",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "free",
              layout: {
                grid: { columns: 12 },
                placements: [
                  { elementId: "el-headline", column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
                ],
                breakpoints: { tablet, mobile: [{ elementId: "el-headline", hidden: true }] },
              },
              content: [
                {
                  id: "el-headline",
                  role: "heading",
                  hidden: false,
                  slot: "headline",
                  value: { kind: "text", text: "Taberna" },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  function breakpoints(doc: Record<string, unknown>): Record<string, unknown> {
    const pages = doc["pages"] as { sections: { layout: Record<string, unknown> }[] }[];
    const found = pages[0]?.sections[0]?.layout["breakpoints"];
    if (!found) throw new Error("no breakpoints");
    return found as Record<string, unknown>;
  }

  it("opens a document saved while the tablet bucket still existed", () => {
    const migrated = migrateToCurrent(before());
    expect(migrated["schemaVersion"]).toBe(SCHEMA_VERSION);
    expect(() => parseDocument(migrated)).not.toThrow();
  });

  it("takes the key out rather than emptying it, because a strict schema rejects it either way", () => {
    expect(breakpoints(upTo(before(), "1.4.0"))).toEqual({
      mobile: [{ elementId: "el-headline", hidden: true }],
    });
  });

  it("leaves the mobile patches exactly as they were", () => {
    const input = before();
    expect({ ...upTo(input, "1.4.0"), schemaVersion: "1.3.0" }).toEqual({
      ...input,
      pages: [
        {
          ...(input["pages"] as Record<string, unknown>[])[0],
          sections: [
            {
              ...((input["pages"] as { sections: Record<string, unknown>[] }[])[0]
                ?.sections[0] as Record<string, unknown>),
              layout: {
                grid: { columns: 12 },
                placements: [
                  { elementId: "el-headline", column: 1, columnSpan: 12, row: 1, rowSpan: 1 },
                ],
                breakpoints: { mobile: [{ elementId: "el-headline", hidden: true }] },
              },
            },
          ],
        },
      ],
    });
  });

  it("drops a real tablet patch, which is the case that makes this window close", () => {
    // The set of documents this would cost anything is empty today, and that is the whole reason
    // the change is a minor rather than a major. The day somebody writes one, dropping it silently
    // stops being free -- so what `up` does to one is written down rather than left to be found.
    const input = before([{ elementId: "el-headline", hidden: true }]);
    expect(breakpoints(upTo(input, "1.4.0"))).toEqual({
      mobile: [{ elementId: "el-headline", hidden: true }],
    });
  });

  it("leaves a section with no layout alone", () => {
    const input = before();
    const section = (input["pages"] as { sections: Record<string, unknown>[] }[])[0]?.sections[0];
    if (!section) throw new Error("no section");
    section["layout"] = null;
    expect(() => parseDocument(migrateToCurrent(input))).not.toThrow();
  });

  it("round-trips: down after up gives back the document without the key", () => {
    // Not "exactly what went in", and the difference is honest: `down` is a version stamp because
    // the bucket was optional, so a 1.4.0 document is already a valid 1.3.0 one. What it cannot do
    // is invent back a key whose only ever value was an empty array.
    const down = step("1.4.0").down;
    if (!down) throw new Error("0005 has no down");
    const back = down(upTo(before(), "1.4.0"));
    expect(back["schemaVersion"]).toBe("1.3.0");
    expect(breakpoints(back)).toEqual({ mobile: [{ elementId: "el-headline", hidden: true }] });
  });

  it("is the claim it rests on: no stored document carries a tablet patch", () => {
    // The mirror of the 0003 and 0004 tests above, and the measurement the ADR cites: every
    // `tablet` in the corpus was the empty array the catalog wrote, never a patch somebody made.
    const corpus = readdirSync(DOCUMENTS_DIR).filter((file) => file.endsWith(".json"));
    expect(corpus.length).toBeGreaterThan(0);
    for (const file of corpus) {
      const raw = readFileSync(join(DOCUMENTS_DIR, file), "utf8");
      expect(raw, file).not.toContain('"tablet"');
    }
  });
});

describe("0006 — a document may say how a shared link reads", () => {
  function before(): Record<string, unknown> {
    return {
      schemaVersion: "1.4.0",
      id: "doc-1",
      siteName: "Taberna",
      theme,
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna",
          sections: [
            {
              id: "sec-cover",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "catalog",
              layout: null,
              content: [
                {
                  id: "el-headline",
                  role: "heading",
                  hidden: false,
                  slot: "headline",
                  value: { kind: "text", text: "Taberna" },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  it("opens a document saved before the two fields existed", () => {
    const migrated = migrateToCurrent(before());
    expect(migrated["schemaVersion"]).toBe(SCHEMA_VERSION);
    expect(() => parseDocument(migrated)).not.toThrow();
  });

  it("changes nothing but the version, because both fields are optional", () => {
    // And that is the point of deriving rather than copying: a document written before today
    // publishes the cover's subheadline, which is also what it publishes after today.
    const input = before();
    expect({ ...upTo(input, "1.5.0"), schemaVersion: "1.4.0" }).toEqual(input);
  });

  it("round-trips: down after up gives back exactly what went in", () => {
    const input = before();
    const down = step("1.5.0").down;
    if (!down) throw new Error("0006 has no down");
    expect(down(upTo(input, "1.5.0"))).toEqual(input);
  });

  it("takes both fields out on the way down, because 1.4.0 has nowhere to keep them", () => {
    const input = {
      ...upTo(before(), "1.5.0"),
      siteDescription: "Comer y beber en el puerto",
      siteUrl: "https://taberna.example",
    };
    const down = step("1.5.0").down;
    if (!down) throw new Error("0006 has no down");
    const back = down(input);
    expect(back["schemaVersion"]).toBe("1.4.0");
    // The *key* is gone, not a key set to undefined: the strict schema treats those differently and
    // only the first round-trips.
    expect(Object.hasOwn(back, "siteDescription")).toBe(false);
    expect(Object.hasOwn(back, "siteUrl")).toBe(false);
  });
});

describe("0007 — an exact length is a number of pixels", () => {
  it("opens a document saved while other units were admitted", () => {
    const migrated = migrateToCurrent({
      schemaVersion: "1.5.0",
      id: "doc-1",
      siteName: "Taberna",
      theme,
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna",
          sections: [
            {
              id: "sec-cover",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "catalog",
              layout: null,
              content: [
                {
                  id: "el-headline",
                  role: "heading",
                  hidden: false,
                  slot: "headline",
                  value: { kind: "text", text: "Taberna" },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(migrated["schemaVersion"]).toBe(SCHEMA_VERSION);
    expect(() => parseDocument(migrated)).not.toThrow();
  });

  it("is the claim it rests on: no stored document carries a length in another unit", () => {
    // **`up` is a version stamp only because this is true.** The day a document carries `2rem`, this
    // migration has to decide between converting it — to what? — and refusing to open somebody's
    // own site. The same mirror `0003`, `0004` and `0005` each keep for their own claim.
    const corpus = readdirSync(DOCUMENTS_DIR).filter((file) => file.endsWith(".json"));
    expect(corpus.length).toBeGreaterThan(0);
    const unit = /"exact":\s*"[^"]*(?:rem|em|%|vh|vw|ch)"/;
    for (const file of corpus) {
      const raw = readFileSync(join(DOCUMENTS_DIR, file), "utf8");
      expect(unit.test(raw), `${file} carries an exact length in a unit 1.6.0 refuses`).toBe(false);
    }
  });
});

describe("0008 — an element may name one of the two families its theme carries", () => {
  function before(style?: Record<string, unknown>): Record<string, unknown> {
    return {
      schemaVersion: "1.6.0",
      id: "doc-1",
      siteName: "Taberna",
      theme,
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna",
          sections: [
            {
              id: "sec-cover",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "catalog",
              layout: null,
              content: [
                {
                  id: "el-headline",
                  role: "heading",
                  hidden: false,
                  slot: "headline",
                  value: { kind: "text", text: "Taberna" },
                  ...(style ? { style } : {}),
                },
              ],
            },
          ],
        },
      ],
    };
  }

  const headline = (doc: Record<string, unknown>): Record<string, unknown> => {
    const pages = doc["pages"] as { sections: { content: Record<string, unknown>[] }[] }[];
    const element = pages[0]?.sections[0]?.content[0];
    if (!element) throw new Error("no element");
    return element;
  };

  it("opens a document saved before the property existed", () => {
    const migrated = migrateToCurrent(before());
    expect(migrated["schemaVersion"]).toBe(SCHEMA_VERSION);
    expect(() => parseDocument(migrated)).not.toThrow();
  });

  it("changes nothing but the version, because it ships no face and fills nothing in", () => {
    const input = before();
    expect({ ...upTo(input, "1.7.0"), schemaVersion: "1.6.0" }).toEqual(input);
  });

  it("round-trips: down after up gives back exactly what went in", () => {
    const input = before();
    const down = step("1.7.0").down;
    if (!down) throw new Error("0008 has no down");
    expect(down(upTo(input, "1.7.0"))).toEqual(input);
  });

  it("drops the family on the way down, because 1.6.0 has nowhere to keep it", () => {
    const input = upTo(before({ fontFamily: { ref: "font.heading" } }), "1.7.0");
    const down = step("1.7.0").down;
    if (!down) throw new Error("0008 has no down");
    const back = down(input);
    expect(back["schemaVersion"]).toBe("1.6.0");
    // The whole `style` goes with it, because an element left carrying `{}` is not what
    // `setElementStyle` ever stores and would not round-trip.
    expect(Object.hasOwn(headline(back), "style")).toBe(false);
  });

  it("keeps the other properties when it drops the family", () => {
    const input = upTo(
      before({ color: { ref: "color.ink" }, fontFamily: { ref: "font.body" } }),
      "1.7.0",
    );
    const down = step("1.7.0").down;
    if (!down) throw new Error("0008 has no down");
    expect(headline(down(input))["style"]).toEqual({ color: { ref: "color.ink" } });
  });

  it("reaches a family inside a list item, which is where a card's title lives", () => {
    const input = upTo(before(), "1.7.0");
    const pages = input["pages"] as { sections: { content: Record<string, unknown>[] }[] }[];
    const content = pages[0]?.sections[0]?.content;
    if (!content) throw new Error("no content");
    content.push({
      id: "el-list",
      role: "list",
      hidden: false,
      slot: "services",
      items: [
        {
          id: "item-1",
          elements: [
            {
              id: "el-card-title",
              role: "heading",
              hidden: false,
              slot: "title",
              value: { kind: "text", text: "Comidas" },
              style: { fontFamily: { ref: "font.body" } },
            },
          ],
        },
      ],
    });
    const down = step("1.7.0").down;
    if (!down) throw new Error("0008 has no down");
    expect(JSON.stringify(down(input))).not.toContain("fontFamily");
  });
});

describe("0009 — a collection entry's field carries marks", () => {
  /** A 1.7.0 document, optionally with a collection in it. Every document this product has ever
   * produced has `collections: []`, which is exactly why the collection has to be written by hand
   * here: the transform has no real input to be tested against. */
  function before(collections: unknown[] = []): Record<string, unknown> {
    return {
      schemaVersion: "1.7.0",
      id: "doc-1",
      siteName: "Taberna",
      theme,
      collections,
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Inicio",
          sections: [
            {
              id: "sec-services",
              preset: { catalogId: "services", variantId: "cards" },
              source: "catalog",
              layout: null,
              content: [
                {
                  id: "el-list",
                  role: "list",
                  hidden: false,
                  slot: "services",
                  items: [
                    {
                      id: "item-1",
                      elements: [
                        {
                          id: "el-card-title",
                          role: "heading",
                          hidden: false,
                          slot: "title",
                          value: { kind: "text", text: "Comidas" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  const withEntries = () => [
    {
      id: "col-servicios",
      name: "Servicios",
      entries: [
        { id: "entry-1", fields: { nombre: "Comidas", precio: "12 €" } },
        { id: "entry-2", fields: { nombre: "Cenas", precio: "18 €" } },
      ],
    },
  ];

  const entries = (doc: Record<string, unknown>): Record<string, unknown>[] => {
    const collections = doc["collections"] as { entries: Record<string, unknown>[] }[];
    const first = collections[0];
    if (!first) throw new Error("no collection");
    return first.entries;
  };

  it("opens a document saved before an entry could carry a mark", () => {
    const migrated = migrateToCurrent(before());
    expect(migrated["schemaVersion"]).toBe(SCHEMA_VERSION);
    expect(() => parseDocument(migrated)).not.toThrow();
  });

  it("changes nothing but the version for the documents that actually exist", () => {
    // The counted case: `collections: []` on every stored document, so there is nothing to convert.
    const input = before();
    expect({ ...upTo(input, "1.8.0"), schemaVersion: "1.7.0" }).toEqual(input);
  });

  it("wraps a bare string into a text that can carry marks", () => {
    const migrated = upTo(before(withEntries()), "1.8.0");
    expect(entries(migrated)[0]?.["fields"]).toEqual({
      nombre: { text: "Comidas" },
      precio: { text: "12 €" },
    });
    // And the result is a document the current schema accepts, which is the only claim that matters.
    expect(() => parseDocument(migrateToCurrent(before(withEntries())))).not.toThrow();
  });

  it("does not wrap a value twice, so running up again is not a corruption", () => {
    const once = upTo(before(withEntries()), "1.8.0");
    const twice = step("1.8.0").up(once);
    expect(twice["collections"]).toEqual(once["collections"]);
  });

  it("round-trips: down after up gives back exactly what went in", () => {
    const input = before(withEntries());
    const down = step("1.8.0").down;
    if (!down) throw new Error("0009 has no down");
    expect(down(upTo(input, "1.8.0"))).toEqual(input);
  });

  it("drops the marks on the way down, because 1.7.0 has nowhere to keep an offset", () => {
    const marked = [
      {
        id: "col-servicios",
        name: "Servicios",
        entries: [
          {
            id: "entry-1",
            fields: {
              nombre: { text: "Comidas y cenas", marks: [{ from: 0, to: 7, mark: "strong" }] },
            },
          },
        ],
      },
    ];
    const down = step("1.8.0").down;
    if (!down) throw new Error("0009 has no down");
    const back = down({ ...before(), collections: marked, schemaVersion: "1.8.0" });
    expect(back["schemaVersion"]).toBe("1.7.0");
    // The words survive; the emphasis does not. Said in the migration and asserted here.
    expect(entries(back)[0]?.["fields"]).toEqual({ nombre: "Comidas y cenas" });
  });

  it("drops a container's fieldless binding on the way down rather than inventing a field", () => {
    // 1.7.0 required `field`, so a binding without one could not have existed there. Giving it a
    // made-up name would be a dead reference, which is what rule 5 refuses.
    const input = before(withEntries());
    const pages = input["pages"] as { sections: { content: Record<string, unknown>[] }[] }[];
    const list = pages[0]?.sections[0]?.content[0];
    if (!list) throw new Error("no list");
    list["binding"] = { collectionId: "col-servicios" };
    const inner = (list["items"] as { elements: Record<string, unknown>[] }[])[0]?.elements[0];
    if (!inner) throw new Error("no inner element");
    inner["binding"] = { collectionId: "col-servicios", field: "nombre" };

    const down = step("1.8.0").down;
    if (!down) throw new Error("0009 has no down");
    const back = down({ ...input, schemaVersion: "1.8.0" });
    const backPages = back["pages"] as { sections: { content: Record<string, unknown>[] }[] }[];
    const backList = backPages[0]?.sections[0]?.content[0];
    if (!backList) throw new Error("no list came back");
    expect(Object.hasOwn(backList, "binding")).toBe(false);
    // The leaf's binding named a field, so 1.7.0 can hold it and it stays.
    const backInner = (backList["items"] as { elements: Record<string, unknown>[] }[])[0]
      ?.elements[0];
    expect(backInner?.["binding"]).toEqual({ collectionId: "col-servicios", field: "nombre" });
  });
});

describe("0010 — a page per entry", () => {
  /** A 1.8.0 document with a collection and a bound list, which is the most a 1.8.0 document can
   * say about collections; nothing in it is touched on the way up. */
  function before(): Record<string, unknown> {
    return {
      schemaVersion: "1.8.0",
      id: "doc-1",
      siteName: "Taller",
      theme,
      collections: [
        {
          id: "col-servicios",
          name: "Servicios",
          entries: [{ id: "entry-1", fields: { nombre: { text: "Chapa" } } }],
        },
      ],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Inicio",
          sections: [
            {
              id: "sec-services",
              preset: { catalogId: "services", variantId: "cards" },
              source: "catalog",
              layout: null,
              content: [
                {
                  id: "el-list",
                  role: "list",
                  hidden: false,
                  slot: "services",
                  binding: { collectionId: "col-servicios" },
                  items: [
                    {
                      id: "item-1",
                      elements: [
                        {
                          id: "el-card-title",
                          role: "heading",
                          hidden: false,
                          slot: "title",
                          value: { kind: "text", text: "Chapa" },
                          binding: { collectionId: "col-servicios", field: "nombre" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /** The same document after a page per entry was made: a slug on the entry, a bound page whose
   * leaf reads the collection outside any list. */
  function after(): Record<string, unknown> {
    const input = before();
    const collections = input["collections"] as { entries: Record<string, unknown>[] }[];
    const entry = collections[0]?.entries[0];
    if (!entry) throw new Error("no entry");
    entry["slug"] = "chapa";
    (input["pages"] as unknown[]).push({
      id: "page-ficha-servicios",
      slug: "ficha",
      title: "Ficha",
      binding: { collectionId: "col-servicios", titleField: "nombre" },
      sections: [
        {
          id: "sec-ficha",
          preset: { catalogId: "cover", variantId: "image-right" },
          source: "catalog",
          layout: null,
          content: [
            {
              id: "el-ficha-headline",
              role: "heading",
              hidden: false,
              slot: "headline",
              value: { kind: "text", text: "" },
              binding: { collectionId: "col-servicios", field: "nombre" },
            },
          ],
        },
      ],
    });
    return { ...input, schemaVersion: "1.9.0" };
  }

  it("stamps the version and moves nothing, because the affected set is zero", () => {
    const migrated = upTo(before(), "1.9.0");
    expect(migrated).toEqual({ ...before(), schemaVersion: "1.9.0" });
    expect(() => parseDocument(migrateToCurrent(before()))).not.toThrow();
  });

  it("is a round trip for a document that never had a page per entry", () => {
    const down = step("1.9.0").down;
    if (!down) throw new Error("0010 has no down");
    expect(down(upTo(before(), "1.9.0"))).toEqual(before());
  });

  it("parses what a page per entry writes, and the corpus fixture with a collection still parses", () => {
    expect(() => parseDocument(after())).not.toThrow();
    const fixture = JSON.parse(
      readFileSync(join(DOCUMENTS_DIR, "contenido-reutilizable.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(() => parseDocument(migrateToCurrent(fixture))).not.toThrow();
  });

  it("drops the page's binding, the entries' slugs and the page-level leaf bindings on the way down, and keeps the list's", () => {
    const down = step("1.9.0").down;
    if (!down) throw new Error("0010 has no down");
    const back = down(after());
    expect(back["schemaVersion"]).toBe("1.8.0");
    const pages = back["pages"] as Record<string, unknown>[];
    const ficha = pages[1] as { sections: { content: Record<string, unknown>[] }[] } & Record<
      string,
      unknown
    >;
    expect(Object.hasOwn(ficha, "binding")).toBe(false);
    expect(Object.hasOwn(ficha.sections[0]?.content[0] ?? {}, "binding")).toBe(false);
    // The list on the home page is still bound, and so is the card's own leaf: 1.8.0 holds both.
    const list = (pages[0] as { sections: { content: Record<string, unknown>[] }[] }).sections[0]
      ?.content[0];
    expect(list?.["binding"]).toEqual({ collectionId: "col-servicios" });
    const items = list?.["items"] as { elements: Record<string, unknown>[] }[] | undefined;
    const leaf = items?.[0]?.elements[0];
    expect(leaf?.["binding"]).toEqual({ collectionId: "col-servicios", field: "nombre" });
    const entries = (back["collections"] as { entries: Record<string, unknown>[] }[])[0]?.entries;
    expect(Object.hasOwn(entries?.[0] ?? {}, "slug")).toBe(false);
    // And what comes down is a 1.8.0 document the old chain would accept again.
    expect(() => parseDocument(migrateToCurrent(back))).not.toThrow();
  });
});

/**
 * `0011` — a section and a page may say whether they appear in the menu (ADR 0043).
 *
 * The same four questions every migration here is asked: that `up` moves nothing, that a document
 * which never curated round-trips exactly, that what curation writes parses, and that `down`
 * leaves a document the old chain would accept again.
 */
describe("1.10.0 — the menu is curated", () => {
  /** A plain two-page document, with nothing decided about the menu. */
  function before(): Record<string, unknown> {
    return {
      schemaVersion: "1.9.0",
      id: "doc-menu",
      siteName: "Taberna",
      theme,
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna",
          sections: [
            {
              id: "sec-cover",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "catalog",
              layout: null,
              content: [],
            },
            {
              id: "sec-location",
              preset: { catalogId: "location", variantId: "stacked" },
              source: "catalog",
              layout: null,
              content: [],
            },
          ],
        },
        {
          id: "p2",
          slug: "carta",
          title: "Nuestra carta",
          sections: [
            {
              id: "sec-carta",
              preset: { catalogId: "prices", variantId: "stacked" },
              source: "catalog",
              layout: null,
              content: [],
            },
          ],
        },
      ],
    };
  }

  /** The same document after an owner decided: one section out, one page out, one kept on purpose. */
  function after(): Record<string, unknown> {
    const input = before();
    const pages = input["pages"] as Record<string, unknown>[];
    const home = pages[0] as { sections: Record<string, unknown>[] };
    const location = home.sections[1];
    if (!location) throw new Error("no section to curate");
    location["inMenu"] = false;
    (home.sections[0] as Record<string, unknown>)["inMenu"] = true;
    (pages[1] as Record<string, unknown>)["inMenu"] = false;
    return { ...input, schemaVersion: "1.10.0" };
  }

  it("stamps the version and moves nothing, because the affected set is zero", () => {
    const migrated = upTo(before(), "1.10.0");
    expect(migrated).toEqual({ ...before(), schemaVersion: "1.10.0" });
    expect(() => parseDocument(migrateToCurrent(before()))).not.toThrow();
  });

  it("is a round trip for a document whose owner never touched the menu", () => {
    const down = step("1.10.0").down;
    if (!down) throw new Error("0011 has no down");
    expect(down(upTo(before(), "1.10.0"))).toEqual(before());
  });

  it("parses what curating writes, including an explicit «yes»", () => {
    // `inMenu: true` is not redundant with absence: the key's presence is what says somebody
    // decided, which is what lets the threshold of three step aside (ADR 0043 §5).
    expect(() => parseDocument(after())).not.toThrow();
  });

  it("drops every choice on the way down, and keeps every word", () => {
    const down = step("1.10.0").down;
    if (!down) throw new Error("0011 has no down");
    const back = down(after());
    expect(back["schemaVersion"]).toBe("1.9.0");
    expect(back).toEqual(before());
    // 1.9.0's objects are strict, so a surviving `inMenu` would be refused rather than ignored.
    expect(() => parseDocument(migrateToCurrent(back))).not.toThrow();
  });
});

describe("1.11.0 — the serif reserves no name", () => {
  const PLAYFAIR =
    "'Playfair Display', Didot, 'Bodoni MT', 'Big Caslon', Georgia, 'Times New Roman', serif";
  const GARAMOND =
    "'EB Garamond', Garamond, Baskerville, 'Big Caslon', Georgia, 'Times New Roman', serif";

  /** A site made with «Clásica y seria» before this version: the stack is resolved in its bytes. */
  function before(heading = PLAYFAIR): Record<string, unknown> {
    return {
      schemaVersion: "1.10.0",
      id: "doc-classic",
      siteName: "Taberna",
      theme: { ...theme, "font.heading": heading },
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Taberna",
          sections: [
            {
              id: "sec-cover",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "catalog",
              layout: null,
              content: [],
            },
          ],
        },
      ],
    };
  }

  it("is registered", () => {
    // `step` throws when nothing produces that version, which is the whole assertion. It was the
    // end of the chain until 1.12.0, and the test said so — the form the `step` helper's own
    // comment warns against, caught the day the next version landed.
    expect(step("1.11.0").version).toBe("1.11.0");
  });

  it("swaps the heading stack it knows and stamps the version", () => {
    const after = upTo(before(), "1.11.0");
    expect((after["theme"] as Theme)["font.heading"]).toBe(GARAMOND);
    expect(after["schemaVersion"]).toBe("1.11.0");
    expect(() => parseDocument(migrateToCurrent(after))).not.toThrow();
  });

  /**
   * **Every other token untouched**, which is the whole of what a value migration owes: the body
   * face, the palette and the sizes are not this decision's business.
   */
  it("touches nothing else in the theme", () => {
    const after = migrateToCurrent(before());
    const was = before()["theme"] as Theme;
    const now = after["theme"] as Theme;
    for (const key of TOKEN_KEYS) {
      if (key === "font.heading") continue;
      expect(now[key], key).toBe(was[key]);
    }
  });

  /**
   * **A stack it does not know is left exactly alone.** Sixteen of the nineteen corpus fixtures say
   * `Georgia, serif`, and a site on «Moderna y neutra» names Inter — nothing here may touch either.
   */
  it("leaves a document that never named Playfair Display alone", () => {
    const other = "Georgia, serif";
    const after = migrateToCurrent(before(other));
    expect((after["theme"] as Theme)["font.heading"]).toBe(other);
  });

  /**
   * **The skip, asserted where it can fail.** A document already at 1.11.0 that still names
   * Playfair Display cannot be made through the product — `down` from 1.12.0 does not touch fonts —
   * which is exactly what makes it the probe: replaying `up` is invisible on every document this
   * step produced, and visible only on one it did not. Skipped, the stack stays; replayed, it
   * becomes EB Garamond.
   */
  it("does not re-apply itself to a document that is already 1.11.0", () => {
    const already = { ...before(), schemaVersion: "1.11.0" };
    const after = migrateToCurrent(already);
    expect((after["theme"] as Theme)["font.heading"]).toBe(PLAYFAIR);
  });

  it("goes back down to the stack 1.10.0 would have produced", () => {
    const down = step("1.11.0").down;
    expect(down, "1.11.0 has no `down`").toBeDefined();
    expect(down?.(migrateToCurrent(before()))).toEqual(before());
  });
});

describe("1.12.0 — a free section is a fine grid", () => {
  /** A site with one hand-designed cover as 1.11.0 stored it: twelve columns, content rows. */
  function before(spaceMd = "16px"): Record<string, unknown> {
    return {
      schemaVersion: "1.11.0",
      id: "doc-free",
      siteName: "Fisio",
      theme: { ...theme, "space.md": spaceMd },
      collections: [],
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Fisio",
          sections: [
            {
              id: "sec-cover",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "free",
              layout: {
                grid: { columns: 12 },
                placements: [
                  { elementId: "el-image", column: 1, columnSpan: 5, row: 1, rowSpan: 3 },
                  { elementId: "el-headline", column: 6, columnSpan: 7, row: 1, rowSpan: 1 },
                  { elementId: "el-body", column: 6, columnSpan: 7, row: 2, rowSpan: 1 },
                ],
                breakpoints: {
                  mobile: [{ elementId: "el-image", order: 2, columnSpan: 12 }],
                },
              },
              content: [
                {
                  id: "el-image",
                  role: "image",
                  hidden: false,
                  slot: "image",
                  value: { kind: "image", src: "image.jpg", alt: "" },
                },
                {
                  id: "el-headline",
                  role: "heading",
                  hidden: false,
                  slot: "headline",
                  value: { kind: "text", text: "Fisio" },
                },
                {
                  id: "el-body",
                  role: "body",
                  hidden: false,
                  slot: "intro",
                  value: { kind: "text", text: "Te ayudamos" },
                },
              ],
            },
            {
              id: "sec-other",
              preset: { catalogId: "cover", variantId: "image-right" },
              source: "catalog",
              layout: null,
              content: [],
            },
          ],
        },
      ],
    };
  }

  const layoutAfter = (doc: Record<string, unknown>) =>
    (doc["pages"] as { sections: { layout: Record<string, unknown> | null }[] }[])[0]?.sections[0]
      ?.layout;

  it("is registered, and it is the one the chain ends at", () => {
    expect(step("1.12.0").version).toBe("1.12.0");
    expect(SCHEMA_VERSION).toBe("1.12.0");
  });

  /**
   * **The replay this chain's skip exists to prevent**, and the first step where it would corrupt a
   * document anyone can have: every 1.12.0 site with a hand-designed section. A second `up` would
   * multiply by eight again — column 41 to 321 on a ninety-six-unit grid.
   */
  it("migrating a migrated document changes nothing", () => {
    const once = migrateToCurrent(before());
    expect(migrateToCurrent(once)).toEqual(once);
  });

  it("multiplies every column and span by eight, exactly, and says the grid is ninety-six", () => {
    const after = migrateToCurrent(before());
    expect(after["schemaVersion"]).toBe("1.12.0");
    const layout = layoutAfter(after);
    expect(layout?.["grid"]).toEqual({ columns: 96 });
    expect(layout?.["placements"]).toMatchObject([
      { elementId: "el-image", column: 1, columnSpan: 40 },
      { elementId: "el-headline", column: 41, columnSpan: 56 },
      { elementId: "el-body", column: 41, columnSpan: 56 },
    ]);
    expect(() => parseDocument(after)).not.toThrow();
  });

  /**
   * **The ×8 asserted directly, not through the overflow invariant**: a migration that forgot the
   * multiplication would leave `column: 6, columnSpan: 7` on a grid of ninety-six, which overflows
   * nothing and parses — and the section would publish squeezed into the leftmost eighth.
   */
  it("follows each content row with the rows that stand for the theme's gap", () => {
    // 16px is two eight-pixel rows: rows 1 and 2 become 1 and 4; three rows with two gaps are seven.
    expect(layoutAfter(migrateToCurrent(before()))?.["placements"]).toMatchObject([
      { elementId: "el-image", row: 1, rowSpan: 7 },
      { elementId: "el-headline", row: 1, rowSpan: 1 },
      { elementId: "el-body", row: 4, rowSpan: 1 },
    ]);
    // The generous scale: three gap rows, so the second row is the fifth and three rows with two
    // gaps of three are nine.
    expect(layoutAfter(migrateToCurrent(before("24px")))?.["placements"]).toMatchObject([
      { elementId: "el-image", row: 1, rowSpan: 9 },
      { elementId: "el-headline", row: 1, rowSpan: 1 },
      { elementId: "el-body", row: 5, rowSpan: 1 },
    ]);
  });

  it("leaves the mobile patch in twelfths, because «Foto menor» still is one", () => {
    expect(layoutAfter(migrateToCurrent(before()))?.["breakpoints"]).toEqual({
      mobile: [{ elementId: "el-image", order: 2, columnSpan: 12 }],
    });
  });

  it("leaves a section the catalog draws alone", () => {
    type Pages = { sections: Record<string, unknown>[] }[];
    const after = (migrateToCurrent(before())["pages"] as Pages)[0]?.sections;
    const was = (before()["pages"] as Pages)[0]?.sections;
    expect(after?.[1]).toEqual(was?.[1]);
  });

  it("refuses a document whose theme has no pixel gap rather than guessing a rhythm", () => {
    expect(() => migrateToCurrent(before("space.md-x"))).toThrow(/pixel length/);
  });

  it("never reads the theme of a document with nothing to convert", () => {
    const plain = { ...before("not a length"), pages: [] };
    expect(() => migrateToCurrent(plain)).not.toThrow();
  });

  it("goes back down to what 1.11.0 could express, exactly for what up produced", () => {
    const down = step("1.12.0").down;
    expect(down, "1.12.0 has no `down`").toBeDefined();
    expect(down?.(migrateToCurrent(before()))).toEqual(before());
    expect(down?.(migrateToCurrent(before("24px")))).toEqual(before("24px"));
  });

  it("takes a hand-placed unit down to the column it falls in, and says so in its header", () => {
    const down = step("1.12.0").down;
    const dragged = migrateToCurrent(before());
    const layout = layoutAfter(dragged) as { placements: Record<string, number>[] };
    const headline = layout.placements[1];
    if (!headline) throw new Error("no headline placement");
    headline["column"] = 44; // three units right of column 6's start: still column 6
    headline["columnSpan"] = 52; // six and a half columns: seven
    const back = layoutAfter(down?.(dragged) ?? {}) as { placements: Record<string, number>[] };
    expect(back.placements[1]).toMatchObject({ column: 6, columnSpan: 7 });
  });

  it("is the claim it rests on: two corpus fixtures carry a layout, and both now parse as the fine grid", () => {
    const corpus = readdirSync(DOCUMENTS_DIR).filter((file) => file.endsWith(".json"));
    const withLayout: string[] = [];
    for (const file of corpus) {
      const raw = readFileSync(join(DOCUMENTS_DIR, file), "utf8");
      if (!raw.includes('"source": "free"')) continue;
      withLayout.push(file);
      const parsed = parseDocument(JSON.parse(raw));
      for (const page of parsed.pages) {
        for (const section of page.sections) {
          if (section.layout) expect(section.layout.grid.columns, file).toBe(96);
        }
      }
    }
    expect(withLayout.sort()).toEqual(["hidden-and-embed.json", "physio-free-cover.json"]);
  });
});
