import { type RefObject, useEffect, useRef } from "react";

/**
 * The four things a modal dialog owes a keyboard, which this application has never done.
 *
 * Sprint 14's closing sweep counted it: `.focus()` and `autoFocus` appeared **zero** times in
 * `apps/editor/src`, and five dialogs carried `aria-modal="true"` while taking focus nowhere,
 * trapping nothing, returning nothing and ignoring Escape. `aria-modal` is a promise to a screen
 * reader that the rest of the page is unavailable; a dialog that makes that claim and then lets
 * Tab walk out of it into a page the reader has been told to ignore is worse than one that never
 * claimed it.
 *
 * David's adjustment of 4 October scoped the fix to this sprint's new screens. So this is written
 * for the account dialog and written to be reusable — **the five existing dialogs are untouched
 * and still owed this**, which is a backlog row and not a silent omission.
 *
 * The four:
 *
 * 1. **Focus moves in.** To the first focusable thing, or to the container itself if a dialog has
 *    nothing to focus — never left behind on the button that opened it.
 * 2. **Tab cycles inside.** Including Shift+Tab backwards off the first element.
 * 3. **Escape closes.** The one gesture every dialog on the web has.
 * 4. **Focus comes back.** To whatever had it before, because otherwise closing a dialog drops a
 *    keyboard user at the top of the document.
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
    // branches stay out of the cycle without having to be enumerated.
    (element) => element.offsetParent !== null || element === container,
  );
}

export function useFocusTrap(
  active: boolean,
  onClose: () => void,
): RefObject<HTMLDivElement | null> {
  const container = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const node = container.current;
    if (!node) return;

    // Remembered before anything is focused, which is the only moment it is still true.
    returnTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const first = focusableWithin(node)[0];
    if (first) first.focus();
    else node.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableWithin(node as HTMLElement);
      if (focusable.length === 0) {
        // Nothing to move to, so Tab must not take focus out of a dialog that claims to be modal.
        event.preventDefault();
        return;
      }
      const edge = event.shiftKey ? focusable[0] : focusable[focusable.length - 1];
      if (document.activeElement === edge) {
        event.preventDefault();
        const wrap = event.shiftKey ? focusable[focusable.length - 1] : focusable[0];
        wrap?.focus();
        return;
      }
      // Focus may be outside the dialog entirely — a click on the backdrop, or a browser's own
      // address bar handing it back. Tab from there belongs inside, not onward through the page.
      if (!node?.contains(document.activeElement)) {
        event.preventDefault();
        focusable[0]?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      // Back where it was. Guarded because the element may have been removed while the dialog was
      // open, and focusing a detached node silently does nothing useful.
      const target = returnTo.current;
      if (target?.isConnected) target.focus();
    };
  }, [active, onClose]);

  return container;
}
