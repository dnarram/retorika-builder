import { describe, expect, it } from "vitest";
import { schemaGuardVerdict } from "../guard.ts";
import { schemaSnapshotText } from "../snapshot.ts";
import { SLUG_PATTERN } from "../src/slug.ts";

/**
 * The migration guard's judgement, against the three cases sprint 7 day 2 asked it to get right.
 *
 * The guard used to fire on any edit under `packages/schema/src/`, and its first real judgement
 * was wrong twice over: it refused `moveItem`, a verb that changes no document, and it would have
 * waved through a tightened `SLUG_PATTERN`, which changes which stored documents still parse.
 *
 * These drive the **real** snapshot rather than a hand-written stand-in: the "new field" and
 * "changed pattern" cases are produced by editing the actual JSON Schema this repository commits,
 * so if `z.toJSONSchema` ever stopped carrying a constraint, the case built on it would stop
 * differing and the test would fail rather than quietly testing nothing.
 */

const snapshot = schemaSnapshotText();

/** The change a commit makes, as the guard sees it. */
function change(previous: string, live: string, changed: readonly string[]) {
  return schemaGuardVerdict({ live, inTree: live, previous, changed });
}

const WITH_EVERYTHING = [
  "packages/schema/src/document.ts",
  "packages/schema/migrations/0003-something.ts",
  "packages/schema/test/migrations.test.ts",
];

describe("the snapshot is what the guard can see", () => {
  it("carries the slug pattern, which lives in a regex and not in a field", () => {
    // The false negative the old guard had: `SLUG_PATTERN` decides which stored documents parse,
    // and a path-based guard watching `src/` would only have caught it by luck.
    expect(snapshot).toContain(SLUG_PATTERN.source);
  });

  it("carries the version the shape belongs to", () => {
    expect(JSON.parse(snapshot).schemaVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("names no verb, because verbs are not shape", () => {
    // The false positive: `moveItem`, `moveSection`, `addItem` are functions over the shape. If
    // any of them ever appeared here, the snapshot would have stopped being a description of what
    // a document may be.
    for (const verb of ["moveItem", "moveSection", "addItem", "removeItem", "duplicateSection"]) {
      expect(snapshot).not.toContain(verb);
    }
  });
});

describe("a new verb passes", () => {
  it("is let through, because it moves nothing a stored document would notice", () => {
    // `moveItem` — sixty lines in `sections.ts`, one export line, no field, no version change. The
    // snapshot before and after is the same text, which is the whole argument.
    const verdict = change(snapshot, snapshot, [
      "packages/schema/src/sections.ts",
      "packages/schema/src/index.ts",
    ]);
    expect(verdict).toEqual({ ok: true, reason: "shape-unchanged" });
  });

  it("is let through even when it touches many files, including new ones", () => {
    expect(
      change(snapshot, snapshot, [
        "packages/schema/src/reorder.ts",
        "packages/schema/src/index.ts",
        "apps/editor/src/questionnaire/Editor.tsx",
      ]).ok,
    ).toBe(true);
  });
});

describe("a new field fails without its migration", () => {
  /** The real snapshot with one property added to the document object — what adding a field to
   * `documentSchema` produces. */
  const withNewField = (() => {
    const parsed = JSON.parse(snapshot);
    parsed.document.properties = { ...parsed.document.properties, nuevoCampo: { type: "string" } };
    return `${JSON.stringify(parsed, null, 2)}\n`;
  })();

  it("actually differs from the snapshot, or the rest of this block proves nothing", () => {
    expect(withNewField).not.toBe(snapshot);
  });

  it("is refused when nothing accompanies it", () => {
    const verdict = change(snapshot, withNewField, ["packages/schema/src/document.ts"]);
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({
      reason: "incomplete",
      missing: ["migration", "round-trip test", "SCHEMA_VERSION bump"],
    });
  });

  it("is refused when the migration is there but the version did not move", () => {
    // The failure that makes a stored document unversionable: two different shapes claiming the
    // same version, and nothing downstream able to tell which one a saved file was written against.
    const verdict = change(snapshot, withNewField, WITH_EVERYTHING);
    expect(verdict).toEqual({ ok: false, reason: "incomplete", missing: ["SCHEMA_VERSION bump"] });
  });

  it("is refused when the version moved but no migration was written", () => {
    const bumped = withNewField.replace(/"schemaVersion": "[^"]*"/, '"schemaVersion": "9.9.9"');
    const verdict = change(snapshot, bumped, [
      "packages/schema/src/document.ts",
      "packages/schema/test/migrations.test.ts",
    ]);
    expect(verdict).toEqual({ ok: false, reason: "incomplete", missing: ["migration"] });
  });

  it("passes once it carries the migration, the test and the bump", () => {
    const bumped = withNewField.replace(/"schemaVersion": "[^"]*"/, '"schemaVersion": "9.9.9"');
    expect(change(snapshot, bumped, WITH_EVERYTHING)).toEqual({
      ok: true,
      reason: "carries-everything",
    });
  });
});

describe("a change to SLUG_PATTERN fails", () => {
  /** The real snapshot with the slug regex tightened — no digits allowed. Documents whose pages
   * have a digit in the slug would stop parsing, which is exactly a migration's business. */
  const tightened = snapshot.replaceAll(
    SLUG_PATTERN.source.replaceAll("\\", "\\\\"),
    "^[a-z][a-z-]*$",
  );

  it("moves the snapshot at all — the thing a path-based guard could not see", () => {
    expect(tightened).not.toBe(snapshot);
  });

  it("is refused, even though no field was added and no file under src/ need have moved", () => {
    // `SLUG_PATTERN` lives in `slug.ts`. The old guard happened to watch that directory; a schema
    // moved anywhere else would not have been watched at all. This one does not care where it is.
    const verdict = change(snapshot, tightened, ["packages/schema/src/slug.ts"]);
    expect(verdict.ok).toBe(false);
    expect(verdict).toMatchObject({ reason: "incomplete" });
  });
});

describe("the snapshot has to describe the code", () => {
  it("refuses a stale committed file before answering anything else", () => {
    // Asked first on purpose: a snapshot that does not match the code makes "nothing changed" a
    // lie, and "nothing changed" is the answer that lets a commit through.
    const verdict = schemaGuardVerdict({
      live: snapshot,
      inTree: `${snapshot}stale`,
      previous: snapshot,
      changed: [],
    });
    expect(verdict).toEqual({ ok: false, reason: "snapshot-stale" });
  });

  it("does not mistake a stale file for a shape change", () => {
    const verdict = schemaGuardVerdict({
      live: snapshot,
      inTree: "{}",
      previous: undefined,
      changed: ["packages/schema/migrations/0003-x.ts", "packages/schema/test/x.test.ts"],
    });
    expect(verdict.reason).toBe("snapshot-stale");
  });
});

describe("the first commit, which has no previous snapshot", () => {
  it("passes, or the commit introducing the guard could never land", () => {
    expect(
      schemaGuardVerdict({ live: snapshot, inTree: snapshot, previous: undefined, changed: [] }),
    ).toEqual({ ok: true, reason: "first-snapshot" });
  });
});
