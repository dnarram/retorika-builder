import { describe, expect, it } from "vitest";
import { MIGRATIONS, migrateToCurrent } from "../migrations/index.ts";
import { SCHEMA_VERSION } from "../src/document.ts";

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
