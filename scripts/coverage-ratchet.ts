import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The coverage ratchet (ADR 0006).
 *
 * The floor in coverage-thresholds.json only ever goes up. Lowering a number requires an
 * ADR, and this is what makes that rule real rather than a sentence in a document — a
 * rule that lives only in prose is a rule that gets broken.
 *
 * It reads the thresholds at two points and compares them. One of those points is not on
 * disk, which is why the numbers live in their own JSON file: reading them must never
 * require evaluating vitest.config.ts. Executing a config checked out from another
 * revision would be both fragile and a way to run arbitrary code from a branch.
 */

const FILE = "coverage-thresholds.json";
const METRICS = ["lines", "functions", "branches", "statements"] as const;
type Metric = (typeof METRICS)[number];
type Thresholds = Record<Metric, number>;

function parse(source: string, where: string): Thresholds {
  const raw: unknown = JSON.parse(source);
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`${FILE} at ${where} is not an object`);
  }
  const record = raw as Record<string, unknown>;
  const out = {} as Thresholds;
  for (const metric of METRICS) {
    const value = record[metric];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${FILE} at ${where} has no numeric "${metric}"`);
    }
    out[metric] = value;
  }
  return out;
}

/** The committed version at a revision, or undefined when the file did not exist yet. */
function atRevision(revision: string): Thresholds | undefined {
  try {
    const source = execFileSync("git", ["show", `${revision}:${FILE}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return parse(source, revision);
  } catch {
    return undefined;
  }
}

function onDisk(): Thresholds {
  return parse(readFileSync(join(import.meta.dirname, "..", FILE), "utf8"), "the working tree");
}

/**
 * Which two versions to compare.
 *
 * In CI a diff range is passed and the comparison is against the base of that range. The
 * pre-commit hook has no base branch — locally the range comes from the git index — so it
 * compares the file as it stands against the last commit, which still catches someone
 * lowering a number here.
 *
 * When there is genuinely nothing to compare, it says so and passes, leaving the blocking
 * case to CI where a real range exists. A hook that fails every time is a hook that gets
 * bypassed with --no-verify, and that is how a guard is lost.
 */
const range = process.argv[2];
const baseRevision = range ? (range.split("...")[0] ?? range.split("..")[0] ?? "") : "HEAD";

if (range && !baseRevision) {
  console.error(`coverage-ratchet: could not read a base revision out of the range "${range}".`);
  process.exit(1);
}

const before = atRevision(baseRevision);
const after = onDisk();

if (!before) {
  console.log(
    `coverage-ratchet: no ${FILE} at ${baseRevision} — nothing to compare, so nothing to lower.`,
  );
  process.exit(0);
}

const drops = METRICS.filter((metric) => after[metric] < before[metric]).map(
  (metric) => `  ${metric}: ${before[metric]} -> ${after[metric]}`,
);

if (drops.length > 0) {
  console.error(
    `coverage-ratchet: the coverage floor went down (compared against ${baseRevision}):`,
  );
  for (const drop of drops) console.error(drop);
  console.error("");
  console.error("The floor only goes up. If lowering it is genuinely right, write the ADR first");
  console.error("— see docs/decisions/0006-coverage-is-a-ratcheted-floor.md — and say why there.");
  console.error("Do not bypass this hook: a threshold quietly lowered to turn CI green is exactly");
  console.error("what it exists to prevent.");
  process.exit(1);
}

const raised = METRICS.filter((metric) => after[metric] > before[metric]);
console.log(
  raised.length > 0
    ? `coverage-ratchet: floor raised (${raised.join(", ")}). Good.`
    : `coverage-ratchet: floor unchanged against ${baseRevision}.`,
);
