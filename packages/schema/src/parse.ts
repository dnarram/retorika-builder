import { documentSchema, type RetorikaDocument } from "./document.ts";
import { checkInvariants, type Violation } from "./invariants.ts";

/**
 * Protocol Part 8.1: validation happens on write, not on paint.
 *
 * Every mutation goes through here, so the editor cannot produce a broken document and
 * the renderer does not have to defend itself against cases that cannot occur.
 */

export class DocumentValidationError extends Error {
  readonly violations: readonly Violation[];

  constructor(message: string, violations: readonly Violation[]) {
    super(message);
    this.name = "DocumentValidationError";
    this.violations = violations;
  }
}

export function parseDocument(input: unknown): RetorikaDocument {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new DocumentValidationError(`Document does not match the schema — ${detail}`, []);
  }

  const violations = checkInvariants(parsed.data);
  if (violations.length > 0) {
    const detail = violations.map((v) => `rule ${v.rule} at ${v.path}: ${v.message}`).join("; ");
    throw new DocumentValidationError(`Document breaks the document rules — ${detail}`, violations);
  }

  return parsed.data;
}

/** Non-throwing variant, for callers that want to show every problem at once. */
export function safeParseDocument(
  input: unknown,
): { ok: true; document: RetorikaDocument } | { ok: false; error: DocumentValidationError } {
  try {
    return { ok: true, document: parseDocument(input) };
  } catch (error) {
    if (error instanceof DocumentValidationError) return { ok: false, error };
    throw error;
  }
}
