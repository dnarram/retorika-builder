import type { KeyPress } from "./shortcuts.ts";

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
 * **`at` is the index of the section that has focus — the section element *itself* — or `-1` for
 * anything else.** That one sentence is the rule, and it replaced three of them on sprint 17 day 4
 * after the first version swallowed a keystroke it had no business taking.
 *
 * The first version asked the ref «which section does the keyboard belong to» and then refused the
 * press only when a `contentEditable` or an `<input>` had focus. A section's six verbs are
 * `<button>`s *inside* the section, so with focus on «bajar» the ref still said «this section», the
 * press was not in a text box, and `Enter` was taken as «choose this section» — **so the verb could
 * not be pressed at all.** The `e2e` walk «mueve una sección dos veces» is what caught it, by
 * pressing Enter on a move button and finding the page unchanged.
 *
 * Asking instead what actually has focus settles every case at once, and it is the rule a composite
 * widget always has: the canvas's keys are the canvas's only while the canvas is what is focused.
 *
 * - A verb has focus → not ours. `Enter` and `Space` belong to a button, which is how it is pressed.
 * - Text has focus → not ours. An arrow moves the caret, `Enter` commits the edit (`wireEditing`
 *   has done exactly that since sprint 11), `Escape` ends it. This is what «writing wins» means, and
 *   it is now the same rule rather than a second one — the explicit `keepsItsOwnUndo` check this
 *   function used to carry became unreachable the moment `at` stopped coming from a ref, and a
 *   guard that cannot fire is a trap for whoever trusts it next.
 * - A link in the rendered page has focus → not ours, for the same reason.
 * - Nothing in the canvas has focus → not ours. `ArrowDown` on a document body scrolls it, and
 *   taking that would be stealing. Tab is how the canvas is entered, which is what the roving
 *   `tabindex` is for.
 *
 * Two rules survive from the first version, both unchanged:
 *
 * 1. **Only a bare press.** Any modifier disqualifies everything, including Shift. `Meta+ArrowDown`
 *    means «end of document» in every text context there is, `Control+ArrowUp` is Mission Control on
 *    the machine this is built on, and `Shift+Arrow` is a selection gesture everywhere. A shortcut
 *    that fires on a superset of what it claims is how an editor eats a keystroke that was not for
 *    it — the same rule `shortcutFor` applies to `altKey`, applied wider because arrows are far more
 *    contested than `Z`.
 * 2. **The ends do not wrap.** `ArrowDown` on the last section stays on the last section. A page's
 *    sections are a document read top to bottom, and in a document the bottom is the bottom: a wrap
 *    would answer «down» with «back to the top», which is disorienting precisely for the person who
 *    cannot see that it happened. Tab still leaves in both directions, so nothing is a dead end.
 */
export function sectionKeyAction(
  press: KeyPress,
  place: { readonly count: number; readonly at: number },
): SectionKeyAction {
  if (place.count <= 0) return IGNORED;
  if (place.at < 0) return IGNORED;
  if (press.altKey || press.metaKey || press.ctrlKey || press.shiftKey) return IGNORED;

  const count = place.count;
  /*
   * **The index can be past the end, and clamping is a decision.** A list read a moment before the
   * frame was replaced can be longer than the one being asked about. Clamped to the last section
   * and *then* moved, rather than clamped and left there: the person cannot see where they are, so
   * a press that produces no movement teaches them nothing.
   */
  const at = Math.min(place.at, count - 1);
  switch (press.key) {
    case "ArrowDown":
      return { kind: "focus", index: Math.min(at + 1, count - 1) };
    case "ArrowUp":
      return { kind: "focus", index: Math.max(at - 1, 0) };
    case "Enter":
      return { kind: "choose" };
    case "Escape":
      return { kind: "release" };
    default:
      return IGNORED;
  }
}

/**
 * Which section is the door: the one that holds the keyboard's place, or the first when none does.
 * `-1` only when there are no sections at all.
 *
 * With no section holding it, the first one is the way in. That is what makes Tab reach the canvas
 * at all, and it is why `at` of `-1` is a real state rather than an error: a frame that has just
 * been wired has no focus in it, and the next Tab must still find a door.
 */
export function keyboardHolder(count: number, at: number): number {
  if (count <= 0) return -1;
  return at >= 0 && at < count ? at : 0;
}

/**
 * The roving `tabindex` for a list of sections: `0` on the one that holds the keyboard's place and
 * `-1` on the rest, so the canvas is **one** Tab stop rather than five to nine of them.
 */
export function rovingTabIndex(count: number, at: number): number[] {
  const holder = keyboardHolder(count, at);
  return Array.from({ length: count }, (_, index) => (index === holder ? 0 : -1));
}

/**
 * The roving `tabindex` for what is **inside** the sections — texts, photographs, verbs, the chrome's
 * buttons: `0` only for what is inside the section that holds the keyboard, `-1` for the rest
 * (ADR 0052 §2).
 *
 * `owners[i]` is the index of the section the i-th stop is inside. The rule is the sections' own
 * rule applied one level down, and it is what the first model never said: `rovingTabIndex` made the
 * sections one stop while every text in every section stayed a stop of its own, so the canvas with
 * the design tools on was measured at seventy-five stops, and a section whose text had been
 * touched could never be reached by Tab again — the `focusin` from the child moved the one `0` to
 * its section, always *behind* the cursor. With the insides following the holder, Tab from the
 * holder enters its own stops in order, Tab after the last of them leaves the canvas, and the
 * other sections' insides are not in the way.
 *
 * An owner outside the list (a stop that is in no section) is never a stop here; the caller does
 * not ask about those, and `-1` is the safe answer if it ever does.
 */
export function rovingTabIndexInside(
  owners: readonly number[],
  count: number,
  at: number,
): number[] {
  const holder = keyboardHolder(count, at);
  return owners.map((owner) => (owner === holder ? 0 : -1));
}

/**
 * Where the keyboard goes once a verb has rebuilt the document — **one rule for all five verbs**,
 * which is the whole point of writing it down.
 *
 * Move up, move down, duplicate, «convertir en página» and delete each change the page in a
 * different way, and the frame is thrown away and parsed again for every one of them. The obvious
 * design is five cases: follow the section up, follow it down, step to the copy, step to the
 * teaser, step to the neighbour. The rule below replaces all five with a sentence:
 *
 * > **Follow the section that was acted on. If it is no longer on this page, take whatever is now
 * > in its place.**
 *
 * Which comes out right for each of them without knowing which one ran:
 *
 * | Verb | What happened | Where this lands |
 * |---|---|---|
 * | move up / down | the same section, a different index | on it, at its new index |
 * | duplicate | the original is still there, the copy below it | on the original |
 * | «convertir en página» | the section left, a teaser took its index | on the teaser |
 * | delete | the section is gone | on the one that moved up into its place |
 * | delete the last one | gone, and nothing after it | on the new last |
 * | delete the only one | gone, and nothing at all | nowhere, honestly |
 *
 * **Duplicate stays on the original rather than stepping to the copy**, and that is the one case
 * worth defending. The copy is new, so «focus what the verb produced» is arguable — but it is
 * identical to the original, including its name, so a screen reader would hear the same section
 * name twice and have no way to know it had moved. The live region says what happened, the copy is
 * one `ArrowDown` away, and the rule stays one sentence.
 *
 * `idIndex` is where the remembered section is in the **new** list, or `-1` when it is gone.
 * `wasAt` is the index it held before. `null` back means there is nothing to focus, which happens
 * only when the last section on a page has just been deleted.
 */
export function placeAfterRebuild({
  idIndex,
  wasAt,
  count,
}: {
  readonly idIndex: number;
  readonly wasAt: number;
  readonly count: number;
}): number | null {
  if (count <= 0) return null;
  if (idIndex >= 0) return Math.min(idIndex, count - 1);
  // Gone. Whatever is at that index now is what took its place; clamped because deleting the last
  // section leaves no index `wasAt` to take.
  return Math.min(Math.max(wasAt, 0), count - 1);
}

/**
 * What a key press means inside one of the canvas's **popups** — the composition menu and the offer
 * to design a section by hand.
 *
 * `close` is Escape, and the caller is expected to put focus back on the button that opened it.
 */
export type PopupKeyAction =
  | { kind: "focus"; index: number }
  | { kind: "close" }
  | { kind: "ignore" };

/**
 * Where a press moves inside a popup, or whether it closes it.
 *
 * `at` is the index of the focused choice, or `-1` for focus that is inside the popup but not on a
 * choice — the title and the note are not focusable, so in practice this is the state only between
 * opening and the first move.
 *
 * **The ends wrap here, and they do not wrap between sections.** That is deliberate and the contrast
 * is the argument: a page's sections are a document read top to bottom, so answering «down» with
 * «back to the top» would disorient exactly the person who cannot see it happen. A popup is a short
 * ring of alternatives with no up or down about it — three compositions, or yes and no — and every
 * menu on every platform cycles. One rule each, each for its own reason, rather than one rule
 * applied where it does not fit.
 *
 * **Tab is deliberately not handled.** A popup that removed itself from under a Tab would strand
 * the focus that Tab was in the middle of computing, and these two are not modal: they sit on
 * screen, any click outside closes them, and Escape closes them from the keyboard. So Tab leaves
 * and the popup stays until one of those happens — which is the honest answer to «what does Escape
 * mean in a menu that is not modal», and the answer is that Escape is the only key that means it.
 */
export function popupKeyAction(
  press: KeyPress,
  place: { readonly count: number; readonly at: number },
): PopupKeyAction {
  if (press.altKey || press.metaKey || press.ctrlKey || press.shiftKey) return { kind: "ignore" };
  if (press.key === "Escape") return { kind: "close" };
  if (place.count <= 0) return { kind: "ignore" };
  const { count, at } = place;
  if (press.key === "ArrowDown") return { kind: "focus", index: at < 0 ? 0 : (at + 1) % count };
  if (press.key === "ArrowUp") {
    return { kind: "focus", index: at < 0 ? count - 1 : (at - 1 + count) % count };
  }
  return { kind: "ignore" };
}
