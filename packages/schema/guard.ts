/**
 * What the migration guard decides, separated from how it reads git.
 *
 * `scripts/schema-guard.ts` gathers four facts — the snapshot the code produces now, the one
 * committed in the tree, the one at the base of the change, and which files the change touches —
 * and this turns them into a verdict. Split out so the decision can be tested against a new field,
 * a new verb and a tightened `SLUG_PATTERN` without a git repository in the middle: the thing
 * worth pinning is the judgement, and the judgement is pure.
 *
 * Outside `src/` for the same reason `snapshot.ts` is: a module in there would be watched by the
 * guard it feeds.
 */

export type GuardVerdict =
  | { ok: true; reason: "first-snapshot" | "shape-unchanged" | "carries-everything" }
  | { ok: false; reason: "snapshot-stale" }
  | { ok: false; reason: "incomplete"; missing: GuardRequirement[] };

export type GuardRequirement = "migration" | "round-trip test" | "SCHEMA_VERSION bump";

export interface GuardInputs {
  /** What the code produces right now. */
  live: string;
  /** What `packages/schema/schema-snapshot.json` says in the tree being committed. */
  inTree: string;
  /** What it said before this change, or `undefined` on the commit that introduces the file. */
  previous: string | undefined;
  /** Repository-relative paths touched by the change. */
  changed: readonly string[];
}

function versionOf(snapshot: string): string | undefined {
  try {
    return (JSON.parse(snapshot) as { schemaVersion?: string }).schemaVersion;
  } catch {
    return undefined;
  }
}

export function schemaGuardVerdict({ live, inTree, previous, changed }: GuardInputs): GuardVerdict {
  // Asked first: a committed snapshot that does not describe the code makes every later answer a
  // lie, including "nothing changed".
  if (live !== inTree) return { ok: false, reason: "snapshot-stale" };

  if (previous === undefined) return { ok: true, reason: "first-snapshot" };

  // The whole point of comparing shapes rather than paths. A new verb, a refactor, a comment —
  // none of them move this, and none of them owe a migration.
  if (previous === live) return { ok: true, reason: "shape-unchanged" };

  const missing: GuardRequirement[] = [];
  if (!changed.some((file) => /^packages\/schema\/migrations\/\d{4}-/.test(file))) {
    missing.push("migration");
  }
  if (!changed.some((file) => file.startsWith("packages/schema/test/"))) {
    missing.push("round-trip test");
  }
  // A shape that moved under a version that did not is the one failure that makes a stored
  // document unversionable: nothing downstream can tell which of the two shapes it was written
  // against.
  if (versionOf(previous) === versionOf(live)) missing.push("SCHEMA_VERSION bump");

  if (missing.length > 0) return { ok: false, reason: "incomplete", missing };
  return { ok: true, reason: "carries-everything" };
}
