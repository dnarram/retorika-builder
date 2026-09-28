import { describe, expect, it } from "vitest";
import { MIGRATIONS, migrateToCurrent } from "../migrations/index.ts";
import { SCHEMA_VERSION } from "../src/document.ts";
import { parseDocument } from "../src/parse.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

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
    expect(migrated["schemaVersion"]).toBe("1.1.0");
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
    const down = MIGRATIONS.at(-1)?.down;
    if (!down) throw new Error("0002 has no down");
    expect(down(migrateToCurrent(input))).toEqual(input);
  });

  it("strips the field from every image, list items included, on the way down", () => {
    const down = MIGRATIONS.at(-1)?.down;
    if (!down) throw new Error("0002 has no down");
    const stripped = down(sampled());

    expect(JSON.stringify(stripped)).not.toContain("sample");
    expect(stripped["schemaVersion"]).toBe("1.0.0");
    // And it is the *key* that is gone, not a key set to undefined: the strict schema treats those
    // as different, and only the first of them round-trips.
    expect(down(sampled())).toEqual(before());
  });

  it("leaves an already-migrated document exactly as it found it", () => {
    const already = sampled();
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
