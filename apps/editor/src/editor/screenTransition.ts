import { flushSync } from "react-dom";

/**
 * **One screen hands over to the next** (sprint 36 día 3): a question to the next question, the
 * fifth to the three proposals — and, from día 4, a proposal to the editor's canvas.
 *
 * The cut between two of the application's screens becomes a view transition of the document
 * (`document.startViewTransition`), the pattern `sectionSlide.ts` uses inside the canvas: the real
 * DOM is in its final state from the first frame and the motion is a layer of pseudo-elements, so
 * nothing that measures — a walk, the overflow check, focus — ever reads a half-moved box. The
 * stylesheet (`globals.css`) names what travels and how, by the attribute this module writes on the
 * root while a transition is in flight; this module only decides *that* there is one, and makes sure
 * the update is the new state the browser captures.
 *
 * **`flushSync`, because the capture does not wait for React.** The browser calls `update` a frame
 * after it captured the old screen, and captures the new one when `update` returns. A React state
 * update made there outside `flushSync` is scheduled, not rendered — the new capture would be the
 * old screen again and the transition would animate nothing into nothing (the sabotage in
 * `screenTransition.test.ts`).
 *
 * **Under `prefers-reduced-motion` the transition still runs**, and the stylesheet makes it a fade of
 * `--ui-fast` with no travel: «retirar el recorrido, no la continuidad» (David, 11 November 2026).
 * Where the engine has no view transitions the update is applied at once, which is what it was.
 *
 * **Only what a person does goes through here.** A session restored on mount, a letter typed, a
 * choice ticked: none of them is a screen handing over, and none of them comes here.
 */

export type ScreenDirection = "forward" | "back";

/** The root's attribute while a screen transition is in flight; its value is the direction. */
export const SCREEN_ATTRIBUTE = "data-rb-screen";

interface TransitionLike {
  finished: Promise<unknown>;
  ready: Promise<unknown>;
  updateCallbackDone: Promise<unknown>;
}

type WithTransitions = Document & {
  startViewTransition?: (update: () => void) => TransitionLike;
};

/** Whether this document can hand one screen over to the next: asked of the function itself. */
export function canTransition(doc: Document): boolean {
  return typeof (doc as WithTransitions).startViewTransition === "function";
}

/** Which transition owns the root's attribute now, per document, so that one a newer transition
 * skipped does not take the attribute away from the newer one when its own promise settles. */
const owner = new WeakMap<Document, number>();
let serial = 0;

/**
 * Apply `update` as the new screen, inside a view transition when the document has them. Returns
 * whether a transition was started. Every promise the transition hands back is answered, so a
 * transition a newer one skips is not an unhandled rejection in the console.
 */
export function transitionScreen(
  update: () => void,
  { direction }: { direction: ScreenDirection },
  doc: Document = document,
): boolean {
  const start = (doc as WithTransitions).startViewTransition;
  if (typeof start !== "function") {
    update();
    return false;
  }
  const root = doc.documentElement;
  serial += 1;
  const mine = serial;
  owner.set(doc, mine);
  root.setAttribute(SCREEN_ATTRIBUTE, direction);
  const transition = start.call(doc, () => {
    flushSync(update);
  });
  const done = () => {
    if (owner.get(doc) !== mine) return;
    owner.delete(doc);
    root.removeAttribute(SCREEN_ATTRIBUTE);
  };
  transition.finished.then(done, done);
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);
  return true;
}
