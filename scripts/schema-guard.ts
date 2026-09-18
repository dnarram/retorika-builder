import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The migration guard of protocol Part 8.4.
 *
 * Fails if packages/schema/src changed without a migration and a round-trip test between
 * the previous version and the new one. Not bureaucracy: it is what lets a site saved
 * today still open in two years.
 *
 * The diff range is an argument so the same script serves the local pre-commit hook and
 * the CI job. With no argument it reads the git index, which is what the hook wants.
 */

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "packages", "schema", "migrations");

function changedFiles(range: string | undefined): string[] {
  const args = range ? ["diff", "--name-only", range] : ["diff", "--cached", "--name-only"];
  return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
}

/**
 * An argument that is present but blank is an error, not the same as no argument.
 *
 * Without this, a caller that computed an empty range — a workflow step whose own
 * failure was made non-fatal, say — would land in the git-index branch below. In CI the
 * index is empty, so the guard would report "nothing to check" and exit 0: fail-open,
 * one careless edit away. Absent means "use the index"; blank means someone's range
 * calculation went wrong and we must not guess.
 */
const rawRange = process.argv[2];
if (rawRange !== undefined && rawRange.trim() === "") {
  console.error("schema-guard: a diff range was given but is blank — refusing to guess.");
  console.error("Pass a real range, or no argument at all to use the git index.");
  process.exit(1);
}

const range = rawRange;
const changed = changedFiles(range);

const schemaChanged = changed.filter((file) => file.startsWith("packages/schema/src/"));
if (schemaChanged.length === 0) {
  console.log("schema-guard: packages/schema/src unchanged, nothing to check.");
  process.exit(0);
}

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((file) => /^\d{4}-.*\.ts$/.test(file))
  .sort();

/**
 * The initial state, handled explicitly. While 0001-initial is the only migration there
 * is no previous version to round-trip against, so requiring one would make the guard
 * block the very commit that introduces it.
 */
const isInitialState = migrations.length === 1 && migrations[0]?.startsWith("0001-");

if (isInitialState) {
  console.log(
    "schema-guard: initial schema version — 0001-initial present, no previous version to migrate from.",
  );
  process.exit(0);
}

const migrationAdded = changed.some((file) => /^packages\/schema\/migrations\/\d{4}-/.test(file));
const testAdded = changed.some((file) => file.startsWith("packages/schema/test/"));

if (!migrationAdded || !testAdded) {
  console.error("schema-guard: packages/schema/src changed:");
  for (const file of schemaChanged) console.error(`  ${file}`);
  console.error("");
  if (!migrationAdded) {
    console.error("  Missing: a new file in packages/schema/migrations/");
  }
  if (!testAdded) {
    console.error("  Missing: a round-trip test between the previous version and the new one");
  }
  console.error("\nDo not disable the hook. Write the migration.");
  process.exit(1);
}

console.log("schema-guard: schema change carries its migration and round-trip test.");
