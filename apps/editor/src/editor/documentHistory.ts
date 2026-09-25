import type { ElementAddress, RetorikaDocument, Section } from "@retorika/schema";
import {
  deleteSection as deleteSectionFromDoc,
  duplicateSection as duplicateSectionFromDoc,
  insertSection as insertSectionIntoDoc,
  mintSectionId,
  moveSection as moveSectionFromDoc,
  setElementText,
} from "@retorika/schema";

/**
 * Undo and redo, as a stack of whole documents rather than a log of commands with inverses.
 *
 * A document here is one page of a handful of sections — low single-digit kilobytes of plain
 * JSON — so keeping fifty of them costs far less than re-rendering the preview iframe once. A
 * command log would need a correct inverse for every verb this sprint is about to add, including
 * `applyRevert`, whose inverse has to carry the layout and breakpoint patches it dropped: that
 * inverse *is* a snapshot, wearing a costume. Replaying commands would also re-run the id
 * minting that duplicate needs, and any drift there lands in a `data-section` attribute the
 * golden corpus compares byte for byte.
 *
 * One history per variant. They never merge: the three variants are three different documents,
 * and undoing in one has no business touching another.
 */

/** What produced a snapshot, and which section it touched — day 4 reads this to decide whether
 * a delete's undo toast fades: ADR 0014 keeps it on screen only for a section the user edited. */
export type SnapshotCause =
  | { type: "editText"; address: ElementAddress }
  | { type: "deleteSection"; sectionId: string }
  | { type: "duplicateSection"; sectionId: string; newSectionId: string }
  | { type: "moveSection"; sectionId: string }
  | { type: "insertSection"; sectionId: string }
  | null;

export interface Snapshot {
  document: RetorikaDocument;
  cause: SnapshotCause;
}

export interface History {
  past: Snapshot[];
  present: Snapshot;
  future: Snapshot[];
}

export type Histories = readonly History[];

export type HistoryAction =
  | { type: "editText"; variant: number; address: ElementAddress; text: string }
  | { type: "deleteSection"; variant: number; sectionId: string }
  | { type: "duplicateSection"; variant: number; sectionId: string }
  | { type: "moveSection"; variant: number; sectionId: string; toIndex: number }
  | { type: "insertSection"; variant: number; section: Section; index: number }
  | { type: "undo"; variant: number }
  | { type: "redo"; variant: number };

/**
 * Fifty steps back. Not a memory limit — fifty of these documents is well under a megabyte —
 * but a limit on how far back a stack that is lost on reload is worth promising to reach.
 */
const LIMIT = 50;

export function initHistories(documents: readonly RetorikaDocument[]): History[] {
  return documents.map((document) => ({
    past: [],
    present: { document, cause: null },
    future: [],
  }));
}

function sameField(cause: SnapshotCause, address: ElementAddress): boolean {
  return (
    cause?.type === "editText" &&
    cause.address.sectionId === address.sectionId &&
    cause.address.elementId === address.elementId
  );
}

function editText(history: History, address: ElementAddress, text: string): History {
  const document = setElementText(history.present.document, address, text);
  const present: Snapshot = { document, cause: { type: "editText", address } };
  // Still typing into the field the last edit touched: amend that step rather than adding one.
  if (sameField(history.present.cause, address)) return { ...history, present, future: [] };
  return { past: [...history.past, history.present].slice(-LIMIT), present, future: [] };
}

function deleteSection(history: History, sectionId: string): History {
  const document = deleteSectionFromDoc(history.present.document, sectionId);
  const present: Snapshot = { document, cause: { type: "deleteSection", sectionId } };
  return { past: [...history.past, history.present].slice(-LIMIT), present, future: [] };
}

function duplicateSection(history: History, sectionId: string): History {
  // Minted separately from the call that actually duplicates, but from the same document with
  // the same deterministic rule (mintSectionId), so the two agree without needing the section
  // package to hand its choice back out of band.
  const newSectionId = mintSectionId(history.present.document, sectionId);
  const document = duplicateSectionFromDoc(history.present.document, sectionId);
  const present: Snapshot = {
    document,
    cause: { type: "duplicateSection", sectionId, newSectionId },
  };
  return { past: [...history.past, history.present].slice(-LIMIT), present, future: [] };
}

function moveSection(history: History, sectionId: string, toIndex: number): History {
  const document = moveSectionFromDoc(history.present.document, sectionId, toIndex);
  const present: Snapshot = { document, cause: { type: "moveSection", sectionId } };
  return { past: [...history.past, history.present].slice(-LIMIT), present, future: [] };
}

/**
 * A section built elsewhere, dropped into the page at `index`.
 *
 * The section arrives fully formed because what a valid one looks like belongs to the catalog
 * (`blankSection`) or to the questionnaire's answers (`contactSectionFor`), neither of which this
 * module should know about. What it does own is the id: the caller's is a template's, so it is
 * re-minted here against the very document being written, which is the only place that knows
 * what is free — and which keeps inserting two of the same section in a row from colliding.
 *
 * The page is the first one, the same page the preview renders (`packages/renderer` draws
 * `doc.pages[0]`). Phase 1 has exactly one; when `Páginas` arrives in phase 2 this is where the
 * choice of which one has to come from.
 */
function insertSection(history: History, section: Section, index: number): History {
  const page = history.present.document.pages[0];
  if (!page) throw new Error("insertSection: the document has no page to insert into");

  const sectionId = mintSectionId(history.present.document, section.id);
  const document = insertSectionIntoDoc(history.present.document, page.id, index, {
    ...section,
    id: sectionId,
  });
  const present: Snapshot = { document, cause: { type: "insertSection", sectionId } };
  return { past: [...history.past, history.present].slice(-LIMIT), present, future: [] };
}

function undo(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    // The restored state's own cause is dropped on the way in: an undo is an action between
    // edits, so the next edit opens a new step instead of merging into the one just undone.
    present: { document: previous.document, cause: null },
    future: [history.present, ...history.future],
  };
}

function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: { document: next.document, cause: null },
    future: rest,
  };
}

export function historiesReducer(state: Histories, action: HistoryAction): Histories {
  const history = state[action.variant];
  if (!history) throw new Error(`documentHistory: no variant ${action.variant}`);

  const next =
    action.type === "editText"
      ? editText(history, action.address, action.text)
      : action.type === "deleteSection"
        ? deleteSection(history, action.sectionId)
        : action.type === "duplicateSection"
          ? duplicateSection(history, action.sectionId)
          : action.type === "moveSection"
            ? moveSection(history, action.sectionId, action.toIndex)
            : action.type === "insertSection"
              ? insertSection(history, action.section, action.index)
              : action.type === "undo"
                ? undo(history)
                : redo(history);

  // Undo with nothing to undo changes nothing, and must not make React re-render the preview.
  if (next === history) return state;
  return state.map((entry, index) => (index === action.variant ? next : entry));
}

/**
 * Whether a section's content was ever edited by the user in this session — ADR 0014's own
 * condition for a delete's undo toast to stay put instead of fading, moved unchanged from the
 * confirmation dialog it used to gate. Not a new field: it is exactly what the history already
 * tracks, walked through every step still reachable by undo or redo. `future` is included on
 * purpose: undoing an edit moves its cause there, not out of existence, and the edit still
 * happened this session even while its step is the one a redo would restore. A section deleted
 * more than fifty steps after its last edit reports as untouched — the same horizon the
 * fifty-step cap already draws for everything else — and so does one whose only edit was undone
 * and then overwritten by a later action, which clears `future` the same way it always has.
 *
 * Only `editText` counts — deliberately narrower than "any cause naming this section". ADR 0014
 * asks about content the user *wrote*, not any structural action the section was ever subject
 * to: being deleted-and-undone, moved, or the original side of a duplicate does not write
 * anything. That distinction stopped being academic the moment duplicateSection arrived — its
 * cause names the *original* section's id too, and that original's own content never changed
 * just because it was copied, so a looser check would have marked it edited for no reason.
 */
export function wasSectionEverEdited(history: History, sectionId: string): boolean {
  const steps = [...history.past, history.present, ...history.future];
  return steps.some(
    (step) => step.cause?.type === "editText" && step.cause.address.sectionId === sectionId,
  );
}
