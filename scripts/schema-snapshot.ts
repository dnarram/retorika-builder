import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { schemaSnapshotText } from "../packages/schema/snapshot.ts";

/**
 * Writes `packages/schema/schema-snapshot.json` — the file `scripts/schema-guard.ts` compares
 * against.
 *
 * Regenerating it is not a way around the guard: the guard's own first question is whether this
 * file matches the code, so a stale one fails and a freshly written one simply tells the truth
 * about what the shape now is. If that truth is different from the previous commit's, the guard
 * then asks for the migration, the round-trip test and the version bump.
 */
writeFileSync(
  join(import.meta.dirname, "..", "packages", "schema", "schema-snapshot.json"),
  schemaSnapshotText(),
);
console.log("schema-snapshot: packages/schema/schema-snapshot.json written.");
