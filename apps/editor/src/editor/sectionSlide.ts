import { chrome } from "./patchCanvas.ts";

/**
 * **Sections slide into their new places** (sprint 35 día 3, David's adjustment 1).
 *
 * Moving a section up or down, duplicating, inserting or deleting one used to redraw the page in
 * one frame: the section was simply somewhere else. Now the patch that changes the order of a
 * page's sections is applied inside the canvas document's own view transition
 * (`document.startViewTransition`), and each section on screen glides from where it was to where it
 * is. David's three reasons, in his words of 10 November 2026: the real DOM is in its final place
 * from the first frame and the animation is a layer of pseudo-elements, so the verbs, the handles,
 * the gaps and the reading point measure the right thing during the 180 ms; it covers inserting,
 * deleting and duplicating, not only moving; and it is a handful of lines, not a measurement before
 * and after.
 *
 * **What the transition does not change.** A view transition calls its update a frame later — the
 * browser has to capture the page as it was first — so the caller puts the whole patch, chrome
 * redraw included, inside `update`, and nothing reads the canvas in between. Text edits and every
 * patch that leaves the order of the sections as it was never come here: a letter typed animates
 * nothing. Neither does another page: a page shown is a page drawn, not a page rearranged.
 *
 * **Named only for the transition, and only what is worth naming**: the sections on screen when it
 * starts and every section that is new. Each gets a `view-transition-name` from a stylesheet of the
 * editor's own (never an inline style on the page's markup, which belongs to the patch), taken off
 * when the transition finishes. A section far off screen is not captured at all, which is most of
 * what keeps the cost of a twenty-section page inside a frame.
 */

export const SLIDE_NAMES_ID = "rb-slide-names";

/** The root's class while sections are on their way: the gaps between them wait (see the sheet). */
export const SLIDING_CLASS = "rb-sliding";

/** A page's sections, in order, by id — read from the live page or from a freshly rendered tree. */
export function sectionOrder(root: ParentNode): string[] {
  return [...root.querySelectorAll<HTMLElement>("[data-section]")].map(
    (section) => section.dataset["section"] ?? "",
  );
}

export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => b[index] === id);
}

/**
 * **The one decision, kept pure so it can be held to it**: a patch slides when it is on the page
 * already drawn and it changes the order of that page's sections — a section moved, inserted,
 * duplicated or deleted. A typed letter, a colour, a photograph: the order is the same, and the
 * patch is applied at once, as it always was.
 */
export function shouldSlide(
  before: readonly string[],
  after: readonly string[],
  samePage: boolean,
): boolean {
  return samePage && !sameOrder(before, after);
}

type WithTransitions = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<unknown>;
    ready: Promise<unknown>;
    updateCallbackDone: Promise<unknown>;
  };
};

/**
 * Whether this document can slide its sections: the engine has same-document view transitions, and
 * the person reading has not asked for less movement — for whom the sections are where they go at
 * once, as they always were. Asked of the function itself, not through `@supports`.
 */
export function canSlide(doc: Document): boolean {
  if (typeof (doc as WithTransitions).startViewTransition !== "function") return false;
  return !doc.defaultView?.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The sections that take part: every one on screen as the transition starts, and every one that is
 * new in the order to come (an insert, a duplicate). Ids, in the order they will be named.
 */
export function slidingIds(
  doc: Document,
  before: readonly string[],
  after: readonly string[],
): string[] {
  const height = doc.defaultView?.innerHeight ?? 0;
  const onScreen = [...doc.querySelectorAll<HTMLElement>("[data-section]")]
    .filter((section) => {
      const box = section.getBoundingClientRect();
      return box.bottom > 0 && box.top < height;
    })
    .map((section) => section.dataset["section"] ?? "");
  const arriving = after.filter((id) => !before.includes(id));
  return [...new Set([...onScreen, ...arriving])].filter((id) => id !== "");
}

/**
 * The names, as a stylesheet: one rule per section, named by its place in the list rather than by
 * its id, so the name is always a valid identifier whatever an id holds.
 */
export function namesSheet(ids: readonly string[]): string {
  return ids
    .map(
      (id, index) =>
        `[data-section="${id.replace(/["\\]/g, "\\$&")}"] { view-transition-name: rb-s-${index}; }`,
    )
    .join("\n");
}

/**
 * Apply `update` inside the document's view transition, with `ids` named for it. The caller has
 * already asked `canSlide`. Every promise the transition hands back is answered, so a transition a
 * newer one skips is not an unhandled rejection in the console.
 */
export function slide(doc: Document, ids: readonly string[], update: () => void): void {
  doc.getElementById(SLIDE_NAMES_ID)?.remove();
  const names = chrome(doc, "style");
  names.id = SLIDE_NAMES_ID;
  names.textContent = namesSheet(ids);
  doc.head.append(names);
  const root = doc.documentElement;
  const start = (doc as WithTransitions).startViewTransition;
  if (!start) {
    update();
    names.remove();
    return;
  }
  const transition = start.call(doc, () => {
    root.classList.add(SLIDING_CLASS);
    update();
  });
  const done = () => {
    if (names.isConnected) names.remove();
    if (doc.getElementById(SLIDE_NAMES_ID) === null) root.classList.remove(SLIDING_CLASS);
  };
  transition.finished.then(done, done);
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);
}
