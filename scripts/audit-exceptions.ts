import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Every audit exception must carry its reason and its date.
 *
 * `pnpm audit` blocks, which is right. But a moderate advisory in a transitive dependency
 * with no patch available would turn CI red, and with the rule that nothing merges red it
 * would stop all work until a third party ships a fix — a stoppage caused by something
 * that is not ours. So there is an escape hatch, and this is what stops it becoming a
 * quiet one.
 *
 * pnpm reads `pnpm.auditConfig.ignoreCves`. JSON has no comments, so the reasons live
 * beside it in `pnpm.auditConfig.exceptionNotes`, and an ignored advisory without a
 * dated, explained note fails here.
 *
 * There is deliberately **no expiry automation**. A job that turns red on a date is
 * another automatic blockage, which is the thing this exists to avoid. The dates are
 * simply visible, and reviewing the exceptions means reading them.
 */

interface Note {
  added?: unknown;
  why?: unknown;
}

const manifest = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"),
) as {
  pnpm?: { auditConfig?: { ignoreCves?: unknown; exceptionNotes?: Record<string, Note> } };
};

const auditConfig = manifest.pnpm?.auditConfig ?? {};
const ignored = Array.isArray(auditConfig.ignoreCves) ? auditConfig.ignoreCves : [];
const notes = auditConfig.exceptionNotes ?? {};

const problems: string[] = [];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

for (const entry of ignored) {
  const id = String(entry);
  const note = notes[id];

  if (!note) {
    problems.push(`${id}: ignored with no entry in pnpm.auditConfig.exceptionNotes`);
    continue;
  }
  if (typeof note.added !== "string" || !ISO_DATE.test(note.added)) {
    problems.push(`${id}: note has no "added" date in YYYY-MM-DD form`);
  }
  if (typeof note.why !== "string" || note.why.trim().length === 0) {
    problems.push(`${id}: note has no "why"`);
  }
}

// The other direction too: a note for something that is not actually ignored is a leftover,
// and leftovers are how a list stops meaning anything.
for (const id of Object.keys(notes)) {
  if (!ignored.map(String).includes(id)) {
    problems.push(`${id}: has a note but is not in ignoreCves — stale entry, remove it`);
  }
}

if (problems.length > 0) {
  console.error("audit-exceptions: every ignored advisory needs a dated, explained note.");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error("");
  console.error('Shape: "exceptionNotes": { "<id>": { "added": "YYYY-MM-DD", "why": "..." } }');
  console.error("An exception is temporary by definition. Its date is how you know to revisit it.");
  process.exit(1);
}

console.log(
  ignored.length === 0
    ? "audit-exceptions: no advisories ignored."
    : `audit-exceptions: ${ignored.length} ignored advisory(ies), each dated and explained.`,
);
