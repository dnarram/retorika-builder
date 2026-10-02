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

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

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
 * test claiming to prove it, watched it pass with the skip removed, and replaced it with the `todo`
 * below. The first migration that transforms anything is what makes the claim testable, and that is
 * the commit where this belongs.
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

  it.todo(
    "does not re-apply a migration the document has already had — untestable until one moves data",
  );

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
