import { type RefObject, useEffect, useRef } from "react";
import { initialFocusIndex, tabDecision } from "./focusTrap.ts";

/**
 * The four things a modal dialog owes a keyboard.
 *
 * Sprint 14's closing sweep counted it: `.focus()` and `autoFocus` appeared **zero** times in
 * `apps/editor/src`, and the dialogs carried `aria-modal="true"` while taking focus nowhere,
 * trapping nothing, returning nothing and ignoring Escape. `aria-modal` is a promise to a screen
 * reader that the rest of the page is unavailable; a dialog that makes that claim and then lets Tab
 * walk out of it into a page the reader has been told to ignore is worse than one that never
 * claimed it.
 *
 * David's adjustment of 4 October scoped that sprint's fix to its own new screens, leaving the
 * dialogs that already existed owed this as a backlog row. **Sprint 17 day 1 pays it:** all eight
 * `aria-modal` dialogs now call this hook, and `test/modalTrap.test.ts` fails if a ninth is written
 * without it. The row said «five» because the sixth, `PhotosFailedDialog`, was committed on 4
 * October 2026 — the same day as this hook, in a different commit — so nothing was wrong when it
 * was written and the number was stale by the evening. That is the drift the guard ends.
 *
 * The four:
 *
 * 1. **Focus moves in.** To the element the dialog asked for, else the first focusable thing, else
 *    the container itself — never left behind on the button that opened it.
 * 2. **Tab cycles inside.** Including Shift+Tab backwards off the first element.
 * 3. **Escape closes.** The one gesture every dialog on the web has.
 * 4. **Focus comes back.** To whatever had it before, because otherwise closing a dialog drops a
 *    keyboard user at the top of the document.
 *
 * **Which element is focused first is said in the JSX**, by putting `data-initial-focus` on it.
 * There is no option argument, because the thing being chosen is an element and the place where
 * elements are named in this codebase is the markup. A dialog that asks for nothing gets the first
 * focusable element, which is the right answer only by accident: the proof is `AccountPage`'s
 * deletion dialog, whose own comment claimed focus went to «Cancelar» while the first focusable
 * element in it was «Exportar todo». Nothing destructive sat under a stray Return, so the behaviour
 * was defensible and the record was still false. Now the record is the markup.
 *
 * **`onClose` is read through a ref, and that is a fix rather than a style.** Every one of the
 * eight call sites passes an inline arrow — `onClose={() => setDownloadDialog(null)}` — so it is a
 * new function on every render of its parent, and `Editor.tsx` re-renders on every autosave tick,
 * every notice and every photograph that arrives. With `onClose` in the dependency list, that
 * re-ran this effect on every one of those: the cleanup returned focus and the body re-captured
 * `returnTo` from whatever was focused *now*, which is an element inside the dialog. So focus was
 * yanked back to the first button mid-sentence, and on close it returned to a node that no longer
 * existed instead of to the opener. The dependency list is `[active]` and nothing else.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    // `offsetParent` is null for anything `display: none`, which is how a dialog's own hidden
    // branches stay out of the cycle without having to be enumerated. (It also reads as null for a
    // `position: fixed` element, which is why this asks it of the dialog's contents and never of
    // the dialog, whose own backdrop is fixed.)
    (element) => element.offsetParent !== null,
  );
}

export function useFocusTrap(
  active: boolean,
  onClose: () => void,
): RefObject<HTMLDivElement | null> {
  const container = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  /*
   * The latest `onClose` without making it a trigger. Written in an effect rather than during
   * render so that a render React throws away cannot leave this pointing at a closure from it.
   */
  const latestOnClose = useRef(onClose);
  useEffect(() => {
    latestOnClose.current = onClose;
  });

  useEffect(() => {
    if (!active) return;
    const node = container.current;
    if (!node) return;

    /*
     * Remembered before anything is focused, which is the only moment it is still true.
     *
     * **When the dialog was opened from inside the preview frame, this is the `<iframe>` element**,
     * because that is what the outer document considers focused while something in the frame has
     * focus. Returning focus to it is the right answer and not a consolation: focusing a frame
     * restores the focus its own document still holds, so «Volver a la original» — a chrome button
     * `wireInteractions` draws inside the frame — gets it back. What must not happen is this
     * capturing the frame and then some later render capturing a button inside the dialog instead,
     * which is exactly what the `onClose` dependency used to cause.
     */
    returnTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusable = focusableWithin(node);
    const asked = node.querySelector<HTMLElement>("[data-initial-focus]");
    const index = initialFocusIndex({
      count: focusable.length,
      preferred: asked ? focusable.indexOf(asked) : -1,
    });
    if (index === null) node.focus();
    else focusable[index]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      // Re-read every press. The dialog's own state opens and closes branches while it is open —
      // «Descargar igualmente» appears on one branch of the contrast dialog and not the other — so
      // a list captured when the effect ran would be the wrong list by the time Tab arrives.
      const current = container.current;
      if (!current) return;

      if (event.key === "Escape") {
        event.preventDefault();
        // Stopped as well as prevented: this listener is on the document in the capture phase, so
        // it runs before the panel and in-frame Escape handlers in `Editor.tsx`. While a dialog
        // claims the page is unavailable, Escape belongs to the dialog and to nothing else.
        event.stopPropagation();
        latestOnClose.current();
        return;
      }
      if (event.key !== "Tab") return;

      const inside = focusableWithin(current);
      const focused = document.activeElement;
      const decision = tabDecision({
        count: inside.length,
        // `-1` for focus that is not inside the dialog at all, which `tabDecision` reads as «pull
        // it back in» — a click on the backdrop, or a browser handing focus back from its own
        // chrome after the address bar had it.
        current: focused instanceof HTMLElement ? inside.indexOf(focused) : -1,
        shiftKey: event.shiftKey,
      });
      if (decision.kind === "browser") return;
      event.preventDefault();
      if (decision.kind === "move") inside[decision.index]?.focus();
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Back where it was. Guarded because the element may have been removed while the dialog was
      // open, and focusing a detached node silently does nothing useful.
      const target = returnTo.current;
      if (target?.isConnected) target.focus();
    };
  }, [active]);

  return container;
}
