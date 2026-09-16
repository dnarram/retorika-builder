import { SCHEMA_VERSION } from "../src/document.ts";
import initial from "./0001-initial.ts";

export interface Migration {
  version: string;
  description: string;
  up(input: Record<string, unknown>): Record<string, unknown>;
  down?(input: Record<string, unknown>): Record<string, unknown>;
}

/** In application order. The guard in scripts/schema-guard.ts reads this directory. */
export const MIGRATIONS: readonly Migration[] = [initial];

/**
 * Bring a document up to the current schema version.
 *
 * This is what lets a site saved today still open in two years, so the migration guard
 * refuses a schema change that arrives without its migration.
 */
export function migrateToCurrent(input: Record<string, unknown>): Record<string, unknown> {
  let out = input;
  for (const migration of MIGRATIONS) out = migration.up(out);
  if (out["schemaVersion"] !== SCHEMA_VERSION) {
    throw new Error(
      `Migration chain ended at "${String(out["schemaVersion"])}" but the current version is "${SCHEMA_VERSION}"`,
    );
  }
  return out;
}
