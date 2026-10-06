import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every audit exception must carry its reason and its date.
 *
 * `pnpm audit` blocks, which is right. But an advisory in a transitive dependency with no patch
 * available would turn CI red, and with the rule that nothing merges red it would stop all work
 * until a third party ships a fix — a stoppage caused by something that is not ours. So there is an
 * escape hatch, and this is what stops it becoming a quiet one.
 *
 * **It validates `audit-exceptions.json`, and that is a correction.** The list used to live in
 * `package.json`'s `pnpm.auditConfig.ignoreCves`, and this script read it there and was satisfied.
 * pnpm 10 stopped reading the `pnpm` field at all, and pnpm 12 has no `auditConfig` anywhere; the
 * facility is the repeatable `--ignore <GHSA>` flag, which `scripts/security-audit.ts` now builds
 * from that file. For some number of versions, then, an exception added here would have passed this
 * check and still left the audit red — the hatch validated and unconnected. Found on 6 October 2026
 * while pinning `source-map-js` past GHSA-68fv-2mgg-jv7q.
 *
 * There is deliberately **no expiry automation**. A job that turns red on a date is another
 * automatic blockage, which is the thing this exists to avoid. The dates are simply visible, and
 * reviewing the exceptions means reading them.
 */

interface Note {
  added?: unknown;
  why?: unknown;
}

const root = join(import.meta.dirname, "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as Record<
  string,
  unknown
>;
const exceptions = JSON.parse(readFileSync(join(root, "audit-exceptions.json"), "utf8")) as {
  ignored?: Record<string, Note>;
};

const ignored = exceptions.ignored ?? {};
const problems: string[] = [];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The dead home, kept out on purpose.
 *
 * Re-adding `pnpm.auditConfig` would look exactly like configuring something and would configure
 * nothing — which is the state this script was just rescued from. It is cheaper to refuse the
 * shape than to discover it again.
 */
if (manifest["pnpm"] !== undefined) {
  problems.push(
    'package.json has a "pnpm" field again — pnpm has not read it since v10. Settings belong in ' +
      "pnpm-workspace.yaml, and audit exceptions in audit-exceptions.json.",
  );
}

for (const [id, note] of Object.entries(ignored)) {
  if (typeof note !== "object" || note === null) {
    problems.push(`${id}: has no note object`);
    continue;
  }
  if (typeof note.added !== "string" || !ISO_DATE.test(note.added)) {
    problems.push(`${id}: note has no "added" date in YYYY-MM-DD form`);
  }
  if (typeof note.why !== "string" || note.why.trim().length === 0) {
    problems.push(`${id}: note has no "why"`);
  }
}

if (problems.length > 0) {
  console.error("audit-exceptions: every ignored advisory needs a dated, explained note.");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("");
  console.error('Shape: { "ignored": { "<GHSA-id>": { "added": "YYYY-MM-DD", "why": "..." } } }');
  console.error("An exception is temporary by definition. Its date is how you know to revisit it.");
  process.exit(1);
}

const count = Object.keys(ignored).length;
console.log(
  count === 0
    ? "audit-exceptions: no advisories ignored."
    : `audit-exceptions: ${count} ignored advisory(ies), each dated and explained.`,
);
