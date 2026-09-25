import type { ElementAddress, RetorikaDocument } from "@retorika/schema";
import { setElementText } from "@retorika/schema";

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
 *
 * Day 4 will want a label on each snapshot for the toast ADR 0014 asks for ("Has borrado la
 * sección «Portada»", with `Deshacer`), and the ids of the sections an action touched so the
 * toast knows whether to stay. Neither is here yet, because nothing reads them yet.
 */

export interface Snapshot {
  document: RetorikaDocument;
  /**
   * The field a text edit changed, when that is what produced this state. Retyping the same
   * field collapses into this snapshot instead of stacking one undo step per blur.
   */
  address: ElementAddress | null;
}

export interface History {
  past: Snapshot[];
  present: Snapshot;
  future: Snapshot[];
}

export type Histories = readonly History[];

export type HistoryAction =
  | { type: "editText"; variant: number; address: ElementAddress; text: string }
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
    present: { document, address: null },
    future: [],
  }));
}

function sameField(a: ElementAddress | null, b: ElementAddress): boolean {
  return a !== null && a.sectionId === b.sectionId && a.elementId === b.elementId;
}

function editText(history: History, address: ElementAddress, text: string): History {
  const document = setElementText(history.present.document, address, text);
  const present: Snapshot = { document, address };
  // Still typing into the field the last edit touched: amend that step rather than adding one.
  if (sameField(history.present.address, address)) return { ...history, present, future: [] };
  return { past: [...history.past, history.present].slice(-LIMIT), present, future: [] };
}

function undo(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    // The restored state's own address is dropped on the way in: an undo is an action between
    // edits, so the next edit opens a new step instead of merging into the one just undone.
    present: { document: previous.document, address: null },
    future: [history.present, ...history.future],
  };
}

function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: { document: next.document, address: null },
    future: rest,
  };
}

export function historiesReducer(state: Histories, action: HistoryAction): Histories {
  const history = state[action.variant];
  if (!history) throw new Error(`documentHistory: no variant ${action.variant}`);

  const next =
    action.type === "editText"
      ? editText(history, action.address, action.text)
      : action.type === "undo"
        ? undo(history)
        : redo(history);

  // Undo with nothing to undo changes nothing, and must not make React re-render the preview.
  if (next === history) return state;
  return state.map((entry, index) => (index === action.variant ? next : entry));
}
