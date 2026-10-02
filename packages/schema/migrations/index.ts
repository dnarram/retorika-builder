import { SCHEMA_VERSION } from "../src/document.ts";
import initial from "./0001-initial.ts";
import sampleImageField from "./0002-sample-image-field.ts";
import closedStyleVocabulary from "./0003-closed-style-vocabulary.ts";
import marksOnAText from "./0004-marks-on-a-text.ts";
import oneBreakpointBucket from "./0005-one-breakpoint-bucket.ts";
import howASharedLinkReads from "./0006-how-a-shared-link-reads.ts";

export interface Migration {
  version: string;
  description: string;
  up(input: Record<string, unknown>): Record<string, unknown>;
  down?(input: Record<string, unknown>): Record<string, unknown>;
}

/** In application order. The guard in scripts/schema-guard.ts reads this directory. */
export const MIGRATIONS: readonly Migration[] = [
  initial,
  sampleImageField,
  closedStyleVocabulary,
  marksOnAText,
  oneBreakpointBucket,
  howASharedLinkReads,
];

/** `1.2.0` → `[1, 2, 0]`, for comparing two versions without a dependency. A missing or
 * unparseable version sorts before every migration, which is what an unstamped document needs. */
function order(version: unknown): number[] {
  if (typeof version !== "string") return [-1];
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  return parts.every((part) => Number.isInteger(part)) ? parts : [-1];
}

function isBefore(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left < right;
  }
  return false;
}

/**
 * Bring a document up to the current schema version.
 *
 * This is what lets a site saved today still open in two years, so the migration guard
 * refuses a schema change that arrives without its migration.
 *
 * **A migration runs only when the document is older than the version it produces.** This used to
 * replay every `up` unconditionally, which was indistinguishable from correct while `0001-initial`
 * stood alone — it only stamps a version. The second migration is where that stops being safe:
 * the day one of these actually moves data, replaying it over an already-migrated document would
 * apply the change twice, and a document that has been migrated twice is not a document anyone can
 * reason about. Found by adding `0002`, which is the first moment the question could be asked.
 */
export function migrateToCurrent(input: Record<string, unknown>): Record<string, unknown> {
  let out = input;
  for (const migration of MIGRATIONS) {
    if (isBefore(order(out["schemaVersion"]), order(migration.version))) out = migration.up(out);
  }
  if (out["schemaVersion"] !== SCHEMA_VERSION) {
    throw new Error(
      `Migration chain ended at "${String(out["schemaVersion"])}" but the current version is "${SCHEMA_VERSION}"`,
    );
  }
  return out;
}
