import { type FocusedElement, type KeyPress, keepsItsOwnUndo } from "./shortcuts.ts";

/**
 * What a key press means when the keyboard is in the canvas — decided without a DOM.
 *
 * **Why the canvas and not a panel.** `docs/design/REVIEW.md` closes the obvious door: «There is no
 * sections panel: `Secciones` *is* the canvas». So the route to a section has to be the section, and
 * a section is a `<section>` inside an `<iframe srcDoc>` that `packages/renderer` wrote. Six verbs —
 * move up, move down, composition, duplicate, fields, delete — have been reachable only by mouse
 * since sprint 2, not because the buttons are inaccessible (they are `<button aria-label=…>` and
 * always have been) but because they do not **exist** until `select()` runs, and `select()` only
 * ran from a `click`.
 *
 * The decision shape is a pure function here rather than an `if` at the listener, for the reason
 * `shortcuts.ts` gives: the rules that keep it safe are the half worth testing, and a listener needs
 * a browser. `Editor.tsx` keeps the wiring and this file keeps the judgement.
 */

/**
 * What should happen to a press.
 *
 * - `focus` — move the keyboard's place to this section. The caller focuses it; the roving
 *   `tabindex` follows.
 * - `choose` — what a click does: select, and draw the action cluster.
 * - `release` — give the keyboard back to the page around the canvas.
 * - `ignore` — not ours. The press reaches whatever it was for.
 */
export type SectionKeyAction =
  | { kind: "focus"; index: number }
  | { kind: "choose" }
  | { kind: "release" }
  | { kind: "ignore" };

const IGNORED: SectionKeyAction = { kind: "ignore" };

/**
 * Which section the keyboard should go to, or what else the press means.
 *
 * `at` is the index of the section that currently holds the keyboard's place, or `-1` for «the
 * canvas has it and no section does» — the state after Tab lands on the first section but before
 * any arrow, and the state after Escape.
 *
 * Three rules decide more than the key does:
 *
 * 1. **Writing wins.** Inside a `contentEditable` or an `<input>`, an arrow moves the caret, Enter
 *    makes a paragraph and Escape ends the edit — and sprint 11 spent itself on making that typing
 *    trustworthy. `keepsItsOwnUndo` is reused rather than re-derived: the question «does the thing
 *    with focus own this keystroke» has one answer and should have one implementation. Stealing an
 *    arrow from somebody mid-word would be a worse version of the defect ADR 0022's shortcut was
 *    careful not to cause.
 * 2. **Only a bare press.** Any modifier disqualifies everything, including Shift. `Meta+ArrowDown`
 *    means «end of document» in every text context there is, `Control+ArrowUp` is Mission Control on
 *    the machine this is built on, and `Shift+Arrow` is a selection gesture everywhere. A shortcut
 *    that fires on a superset of what it claims is how an editor eats a keystroke that was not for
 *    it — the same rule `shortcutFor` applies to `altKey`, applied wider because arrows are far more
 *    contested than `Z`.
 * 3. **The ends do not wrap.** `ArrowDown` on the last section stays on the last section. A page's
 *    sections are a document read top to bottom, and in a document the bottom is the bottom: a wrap
 *    would answer «down» with «back to the top», which is disorienting precisely for the person who
 *    cannot see that it happened. Tab still leaves in both directions, so nothing is a dead end.
 *
 * **What `ArrowUp` does from nowhere is a choice and not a fallback:** it goes to the **last**
 * section, because somebody pressing up is travelling upwards and the thing above the canvas's
 * start is its end. The focus trap in `useFocusTrap` resolved the same question the same way for
 * `Shift+Tab`, and two answers to one shape would be two things to remember.
 */
export function sectionKeyAction(
  press: KeyPress,
  focused: FocusedElement | null | undefined,
  place: { readonly count: number; readonly at: number },
): SectionKeyAction {
  if (place.count <= 0) return IGNORED;
  if (keepsItsOwnUndo(focused)) return IGNORED;
  if (press.altKey || press.metaKey || press.ctrlKey || press.shiftKey) return IGNORED;

  const count = place.count;
  /*
   * **The remembered place can be past the end, and clamping is a decision.** A section is deleted,
   * the frame is rebuilt with one fewer, and `at` still names the index that was. Clamped to the
   * last section and *then* moved, rather than clamped and left there: the person cannot see where
   * they are, so a press that produces no movement teaches them nothing, and the place they would
   * have been «left» at is one they never heard announced anyway. `-1` is left alone, because it
   * means something different — nothing holds the keyboard — and the two entry rules below are
   * what answer it.
   */
  const at = place.at < 0 ? -1 : Math.min(place.at, count - 1);
  switch (press.key) {
    case "ArrowDown":
      return { kind: "focus", index: at < 0 ? 0 : Math.min(at + 1, count - 1) };
    case "ArrowUp":
      return { kind: "focus", index: at < 0 ? count - 1 : Math.max(at - 1, 0) };
    case "Enter":
      // Nothing to choose when no section holds the keyboard's place. Enter then belongs to
      // whatever does — a button in the chrome, most often.
      return at < 0 ? IGNORED : { kind: "choose" };
    case "Escape":
      return at < 0 ? IGNORED : { kind: "release" };
    default:
      return IGNORED;
  }
}

/**
 * The roving `tabindex` for a list of sections: `0` on the one that holds the keyboard's place and
 * `-1` on the rest, so the canvas is **one** Tab stop rather than five to nine of them.
 *
 * With no section holding it, the first one is the way in. That is what makes Tab reach the canvas
 * at all, and it is why `at` of `-1` is a real state rather than an error: a frame that has just
 * been rebuilt has no focus in it, and the next Tab must still find a door.
 */
export function rovingTabIndex(count: number, at: number): number[] {
  if (count <= 0) return [];
  const holder = at >= 0 && at < count ? at : 0;
  return Array.from({ length: count }, (_, index) => (index === holder ? 0 : -1));
}
