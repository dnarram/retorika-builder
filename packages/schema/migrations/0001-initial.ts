import { SCHEMA_VERSION } from "../src/document.ts";

/**
 * The first schema version. There is nothing to migrate from, so `up` only stamps the
 * version onto a document that predates the field.
 */
export const migration = {
  version: SCHEMA_VERSION,
  description: "Initial document model: roles v1, closed token namespace, grid layout.",
  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: SCHEMA_VERSION };
  },
} as const;

export default migration;
