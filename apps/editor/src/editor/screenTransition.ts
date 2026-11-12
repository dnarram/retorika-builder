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

/** The root's second attribute while one of the two scenes is in flight (sprint 36 día 4): the
 * stylesheet names the two ends of the scene only under it. */
export const SCENE_ATTRIBUTE = "data-rb-scene";

/**
 * **The longest a scene may hold the page** (David's adjustment 3 of 11 November 2026). While the
 * update callback's promise is pending the document is frozen — no scroll, no clicks — so a scene
 * waiting for its destination to paint waits this long and no longer: at the cap the transition is
 * skipped, rendering resumes and the destination appears without the scene. «Medio segundo se lee
 * como una transición; un segundo, como un cuelgue.»
 */
export const SCENE_WAIT_CAP_MS = 500;

interface TransitionLike {
  finished: Promise<unknown>;
  ready: Promise<unknown>;
  updateCallbackDone: Promise<unknown>;
  skipTransition?: () => void;
}

type WithTransitions = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => TransitionLike;
};

export interface ScreenOptions {
  direction: ScreenDirection;
  /** One of the two scenes of the second register, named on the root while it runs. */
  scene?: "canvas";
  /**
   * **The scene does not start until the destination is painted** (David's condition 1): a promise
   * the update awaits before the browser captures the new screen, so the old one stays on screen,
   * frozen, until the destination exists — never 400 ms of hole. Raced against `SCENE_WAIT_CAP_MS`.
   */
  settled?: () => Promise<unknown>;
  cap?: number;
}

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
  { direction, scene, settled, cap = SCENE_WAIT_CAP_MS }: ScreenOptions,
  doc: Document = document,
): boolean {
  const start = (doc as WithTransitions).startViewTransition;
  if (typeof start !== "function") {
    update();
    return false;
  }
  const root = doc.documentElement;
  const view = doc.defaultView;
  serial += 1;
  const mine = serial;
  owner.set(doc, mine);
  root.setAttribute(SCREEN_ATTRIBUTE, direction);
  if (scene) root.setAttribute(SCENE_ATTRIBUTE, scene);
  let transition: TransitionLike | undefined;
  transition = start.call(doc, async () => {
    flushSync(update);
    if (!settled) return;
    // The destination, or the cap — whichever comes first. At the cap the scene is skipped: the
    // page is shown as it is, and the destination finishes arriving in plain sight.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const capped = new Promise<"cap">((resolve) => {
      timer = (view ?? globalThis).setTimeout(() => resolve("cap"), cap);
    });
    const first = await Promise.race([settled().then(() => "painted" as const), capped]);
    if (timer !== undefined) (view ?? globalThis).clearTimeout(timer);
    if (first === "cap") transition?.skipTransition?.();
  });
  const done = () => {
    if (owner.get(doc) !== mine) return;
    owner.delete(doc);
    root.removeAttribute(SCREEN_ATTRIBUTE);
    root.removeAttribute(SCENE_ATTRIBUTE);
  };
  transition.finished.then(done, done);
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);
  return true;
}
