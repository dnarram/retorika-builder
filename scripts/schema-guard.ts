import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { schemaGuardVerdict } from "../packages/schema/guard.ts";
import { schemaSnapshotText } from "../packages/schema/snapshot.ts";

/**
 * The migration guard of protocol Part 8.4.
 *
 * A site saved today has to open in two years. So a change to the document's **stored shape** must
 * arrive with a migration, a round-trip test between the old version and the new, and a
 * `SCHEMA_VERSION` that says which is which — and this refuses the commit that forgets.
 *
 * **It compares the shape, not the file names, and that changed on sprint 7 day 2.** Until then it
 * fired on any edit under `packages/schema/src/`, which is a proxy for a shape change rather than
 * the thing itself. Its first real judgement was wrong in both directions at once:
 *
 * - **False positive.** `moveItem` — a verb that reorders a list, adding no field, touching no Zod
 *   schema, leaving `SCHEMA_VERSION` alone — was refused. The only ways past a guard that cannot
 *   tell a verb from a field are a migration that migrates nothing or a disabled hook, and each
 *   teaches the next person that the guard is an obstacle rather than a promise.
 * - **False negative, which is the worse half.** A path list only watches the paths on it. A schema
 *   moved into a new file, or a tightened `SLUG_PATTERN` — a regex that decides which stored
 *   documents still parse — would sail through a guard keyed on directories it happens to know.
 *
 * It now reads `packages/schema/schema-snapshot.json`: the document schema rendered as JSON Schema
 * (`packages/schema/snapshot.ts`) beside the version it belongs to. The decision itself is
 * `schemaGuardVerdict` in `packages/schema/guard.ts`, which is pure and has its own tests; this
 * file is the part that knows about git.
 *
 * The diff range is an argument so the same script serves the local pre-commit hook and the CI
 * job. With no argument it reads the git index, which is what the hook wants.
 */

const SNAPSHOT_REPO_PATH = "packages/schema/schema-snapshot.json";
const SNAPSHOT_PATH = join(import.meta.dirname, "..", SNAPSHOT_REPO_PATH);

function changedFiles(range: string | undefined): string[] {
  const args = range ? ["diff", "--name-only", range] : ["diff", "--cached", "--name-only"];
  return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
}

/** The snapshot as it stood before this change, or `undefined` when there was none — true exactly
 * once, on the commit that introduces the file. `stderr` is swallowed because git's "exists on
 * disk, but not in HEAD" is this script's normal answer on that commit, not a fault worth
 * printing. */
function snapshotAt(ref: string): string | undefined {
  try {
    return execFileSync("git", ["show", `${ref}:${SNAPSHOT_REPO_PATH}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
}

/**
 * An argument that is present but blank is an error, not the same as no argument.
 *
 * Without this, a caller that computed an empty range — a workflow step whose own failure was made
 * non-fatal, say — would land in the git-index branch below. In CI the index is empty, so the
 * guard would report "nothing to check" and exit 0: fail-open, one careless edit away. Absent
 * means "use the index"; blank means someone's range calculation went wrong and we must not guess.
 */
const rawRange = process.argv[2];
if (rawRange !== undefined && rawRange.trim() === "") {
  console.error("schema-guard: a diff range was given but is blank — refusing to guess.");
  console.error("Pass a real range, or no argument at all to use the git index.");
  process.exit(1);
}

const range = rawRange;

/**
 * Which commit counts as "before".
 *
 * For the hook that is `HEAD`. For a range it is the left side — except that CI passes a
 * three-dot range, where `git diff a...b` means "what b added since the two diverged". The state
 * to compare a shape against is therefore the **merge base**, not the tip of `a`: on a pull
 * request whose target branch has moved on with a schema change of its own, comparing against the
 * tip would report that change as this branch's and demand a migration for somebody else's work.
 */
function baseOf(diffRange: string | undefined): string {
  if (!diffRange) return "HEAD";
  const [left, right] = diffRange.split("...");
  if (right === undefined) return diffRange.split("..")[0] ?? "HEAD";
  try {
    return execFileSync("git", ["merge-base", left ?? "HEAD", right || "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return left ?? "HEAD";
  }
}

const base = baseOf(range);

const verdict = schemaGuardVerdict({
  live: schemaSnapshotText(),
  inTree: readFileSync(SNAPSHOT_PATH, "utf8"),
  previous: snapshotAt(base),
  changed: changedFiles(range),
});

if (verdict.ok) {
  const said = {
    "first-snapshot": "no previous snapshot — this is the commit that introduces it.",
    "shape-unchanged": "the document's shape is unchanged; no migration needed.",
    "carries-everything": "the shape changed and carries its migration, test and version bump.",
  } as const;
  console.log(`schema-guard: ${said[verdict.reason]}`);
  process.exit(0);
}

if (verdict.reason === "snapshot-stale") {
  console.error("schema-guard: the committed schema snapshot is out of date.");
  console.error(`  ${SNAPSHOT_REPO_PATH} does not match what the code produces.`);
  console.error("\nRegenerate it and include it in this commit:\n  pnpm schema:snapshot");
  process.exit(1);
}

console.error("schema-guard: the document's stored shape changed in this commit.");
console.error(`  See the diff of ${SNAPSHOT_REPO_PATH} for exactly what moved.`);
console.error("");
// Each named separately: "write the migration" is no use to somebody who wrote one and forgot the
// version.
const wording = {
  migration: "a new file in packages/schema/migrations/",
  "round-trip test": "a round-trip test between the previous version and the new one",
  "SCHEMA_VERSION bump": "a new SCHEMA_VERSION — the old one already means a different shape",
} as const;
for (const missing of verdict.missing) console.error(`  Missing: ${wording[missing]}`);
console.error("\nDo not disable the hook. Write the migration.");
process.exit(1);
