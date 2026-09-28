/**
 * The first schema version. There is nothing to migrate from, so `up` only stamps the
 * version onto a document that predates the field.
 *
 * **The version is written out rather than read from `SCHEMA_VERSION`.** It referenced that
 * constant while there was only one version, which was true and became false the moment `0002`
 * arrived: a migration names the version *it* produces, and that version never changes again. Read
 * from the constant, this step would have started claiming to produce 1.1.0 — and the chain would
 * have had two migrations both stamping the newest version, which is no chain at all.
 */
export const migration = {
  version: "1.0.0",
  description: "Initial document model: roles v1, closed token namespace, grid layout.",
  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.0.0" };
  },
} as const;

export default migration;
