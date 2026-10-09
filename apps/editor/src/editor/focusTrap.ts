/**
 * Where focus goes, decided without a DOM.
 *
 * The hook in `useFocusTrap.ts` does the three things that need a browser — find the focusable
 * elements, listen for keys, move focus — and asks this module what the answer is. The split is the
 * one `shortcuts.ts` already uses, and it exists because the `editor` test project runs in Node:
 * without it the only coverage a focus trap can have is an `e2e` walk, and a walk proves the common
 * path while saying nothing about the edges, which in a trap is where every bug lives.
 *
 * Nothing here knows what an element is. A caller passes how many focusable things it found and
 * which one has focus, and gets back a decision.
 */

/**
 * What should happen to a Tab press.
 *
 * - `browser` — let it through. Moving between two elements inside the dialog is the browser's own
 *   job and it does it better than we would, including for whatever it considers focusable that our
 *   selector does not.
 * - `move` — prevent the default and focus the element at `index`. The wrap at either edge, and the
 *   pull back in when focus has escaped.
 * - `stay` — prevent the default and focus nothing. Only for a dialog with nothing focusable in it,
 *   where the browser's next stop would be the page the dialog claims is unavailable.
 */
export type TabDecision = { kind: "browser" } | { kind: "move"; index: number } | { kind: "stay" };

/**
 * Where Tab goes from here.
 *
 * `current` is the index of the element that has focus, or `-1` for focus that is not inside the
 * dialog at all — a click on the backdrop, or a browser handing focus back from its own chrome
 * after the address bar had it.
 *
 * **Shift+Tab from outside lands on the last element, not the first.** Today's hook sends both
 * directions to the first, which is a small lie about which way the person was going; backwards
 * into a dialog means its end. Found by writing the table of cases out rather than by a walk.
 */
export function tabDecision({
  count,
  current,
  shiftKey,
}: {
  count: number;
  current: number;
  shiftKey: boolean;
}): TabDecision {
  if (count === 0) return { kind: "stay" };
  if (current < 0) return { kind: "move", index: shiftKey ? count - 1 : 0 };
  if (!shiftKey && current === count - 1) return { kind: "move", index: 0 };
  if (shiftKey && current === 0) return { kind: "move", index: count - 1 };
  return { kind: "browser" };
}

/**
 * Which element takes focus when the dialog opens.
 *
 * `preferred` is the index of the element the dialog asked for, or `-1` when it asked for nothing
 * or asked for something that is not focusable right now. `null` back means **focus the dialog
 * container itself** — correct for a dialog with nothing to focus, because the alternative is
 * leaving focus on the button that opened it, outside a dialog that has just told a screen reader
 * the rest of the page is unavailable.
 *
 * The preference exists because the first focusable element is the right answer only by accident.
 * `AccountPage`'s deletion dialog is the proof: its own comment says «the default focus is the
 * cancel button and not the confirm», and the first focusable element in it is «Exportar todo».
 * Nothing destructive sat under a stray Return, so the behaviour was defensible — but the record
 * described a decision the code did not make, and the way to end that is to let the decision be
 * stated at the call site.
 */
export function initialFocusIndex({
  count,
  preferred,
}: {
  count: number;
  preferred: number;
}): number | null {
  if (count === 0) return null;
  if (preferred >= 0 && preferred < count) return preferred;
  return 0;
}
