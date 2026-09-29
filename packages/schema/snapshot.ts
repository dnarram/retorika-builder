import { z } from "zod";
import { documentSchema, SCHEMA_VERSION } from "./src/document.ts";

/**
 * The document's stored shape, as data — what `scripts/schema-guard.ts` compares against.
 *
 * **Why this exists.** The migration guard used to fire on any change under
 * `packages/schema/src/`, which is a proxy for "the shape changed" and not the thing itself. On
 * sprint 7 day 2 it made its first real judgement and got it wrong: `moveItem` is a verb over the
 * existing shape — sixty lines that add no field, touch no Zod schema and leave `SCHEMA_VERSION`
 * alone — and the guard demanded a migration for it. The only ways past a guard that cannot tell
 * those apart are a migration that migrates nothing or a disabled hook, and both teach the next
 * person that the guard is an obstacle rather than a promise.
 *
 * So it compares the shape. `z.toJSONSchema` turns the Zod tree into JSON, which means the guard
 * sees **what a document is allowed to be** rather than which files someone edited:
 *
 * - A new field, an optional made required, a `max` raised — all move this snapshot.
 * - A new verb, a comment, a refactor, a new file full of helpers — none of them do.
 * - **A validation rule changes it too**, which a file list would never have caught: `SLUG_PATTERN`
 *   is a regex inside a `.regex()`, and JSON Schema carries it as `pattern`. Tightening it would
 *   make documents that parse today stop parsing, which is exactly a migration's business.
 *
 * **Outside `src/` on purpose.** A module inside it would be caught by the very guard it feeds, so
 * the commit introducing it would demand a migration for itself.
 *
 * **`io: "input"` is the side that matters.** A stored document is what goes *in* to `parse`, so
 * the input shape is what a migration has to bring an old file up to. The output shape can differ
 * wherever a default or a transform fills something in, and that difference is not something a
 * saved file has to care about.
 */
export interface SchemaSnapshot {
  /** The version a document written against this shape declares. A shape change without a bump
   * here is the specific failure the guard names, because it is the one that makes a stored
   * document unversionable. */
  schemaVersion: string;
  document: unknown;
}

export function schemaSnapshot(): SchemaSnapshot {
  return {
    schemaVersion: SCHEMA_VERSION,
    document: z.toJSONSchema(documentSchema, { io: "input" }),
  };
}

/** Two spaces and a trailing newline, so the committed file reads as a file and a diff of it is
 * legible line by line rather than one very long line changing. */
export function schemaSnapshotText(): string {
  return `${JSON.stringify(schemaSnapshot(), null, 2)}\n`;
}
