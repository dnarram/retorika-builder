import type { Answers } from "@retorika/generator";
import { type RetorikaDocument, safeParseDocument } from "@retorika/schema";
import { migrateToCurrent } from "@retorika/schema/migrations";

/**
 * The Fase 1 "guardado automático" requirement, met in its minimal version: `localStorage`, one
 * browser, no account. That trade-off is written down, not just coded — see the note in ADR 0012
 * — because it changes what the word means: clear this browser's site data, or open the link on
 * another computer, and it is gone. The `Guardado` tick in `EditorShell` has to say exactly that
 * rather than a bare "Guardado", which would claim a guarantee this does not have.
 *
 * What gets saved is the editing session, not the questionnaire: `answers` (kept only to restart
 * or regenerate), the three variants' current documents (their edits, additions, deletions —
 * whatever the sprint has added by the time this runs), and which one was open. History is not
 * saved — fifty snapshots per variant would risk the quota for a promise ("undo") that this slice
 * only ever made within one session anyway.
 */

const SESSION_KEY = "retorika.session.v1";
const REJECTED_KEY = "retorika.session.v1.rejected";

export interface StoredSession {
  payloadVersion: 1;
  savedAt: string;
  answers: Omit<Answers, "logo">;
  documents: RetorikaDocument[];
  openIndex: number | null;
}

export interface RestoredSession {
  answers: Omit<Answers, "logo">;
  documents: RetorikaDocument[];
  openIndex: number | null;
}

/** `false` on a full or disabled storage: the caller's `Guardado` tick has to know. */
export function saveSession(session: Omit<StoredSession, "payloadVersion" | "savedAt">): boolean {
  const payload: StoredSession = {
    payloadVersion: 1,
    savedAt: new Date().toISOString(),
    ...session,
  };
  try {
    globalThis.localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * `undefined` when there is nothing to try — a first visit, same as any other. `null` when
 * something was there and failed to restore: wrong shape, a document that no longer validates,
 * storage that threw. Either way the raw value moves to `.rejected` rather than being
 * overwritten by the next save, so a corrupt session is inspectable, not silently destroyed.
 */
export function loadSession(): RestoredSession | null | undefined {
  let raw: string | null;
  try {
    raw = globalThis.localStorage.getItem(SESSION_KEY);
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;

  const reject = (): null => {
    try {
      globalThis.localStorage.setItem(REJECTED_KEY, raw as string);
      globalThis.localStorage.removeItem(SESSION_KEY);
    } catch {
      // Best effort: if storage will not accept the write, there is nothing more to do.
    }
    return null;
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return reject();
  }
  if (typeof parsed !== "object" || parsed === null) return reject();
  const candidate = parsed as Record<string, unknown>;
  if (candidate.payloadVersion !== 1) return reject();
  if (!Array.isArray(candidate.documents) || candidate.documents.length === 0) return reject();
  if (typeof candidate.answers !== "object" || candidate.answers === null) return reject();
  const openIndex = candidate.openIndex;
  if (openIndex !== null && typeof openIndex !== "number") return reject();

  const documents: RetorikaDocument[] = [];
  for (const rawDocument of candidate.documents) {
    if (typeof rawDocument !== "object" || rawDocument === null) return reject();
    let migrated: Record<string, unknown>;
    try {
      migrated = migrateToCurrent(rawDocument as Record<string, unknown>);
    } catch {
      return reject();
    }
    const result = safeParseDocument(migrated);
    if (!result.ok) return reject();
    documents.push(result.document);
  }

  return {
    answers: candidate.answers as Omit<Answers, "logo">,
    documents,
    openIndex: openIndex as number | null,
  };
}

export function clearSession(): void {
  try {
    globalThis.localStorage.removeItem(SESSION_KEY);
    globalThis.localStorage.removeItem(REJECTED_KEY);
  } catch {
    // Nothing to clear if storage is unavailable in the first place.
  }
}
