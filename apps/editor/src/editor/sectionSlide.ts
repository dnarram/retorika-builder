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
 * nothing. Another page does not slide either: a page shown is a page drawn, not a page rearranged —
 * since sprint 36 día 7 it crosses over instead (`PAGING_CLASS`), through the same transition.
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

/**
 * **Another page fades in, and the bar stays** (sprint 36 día 7): the chrome mirrors what ADR 0062 §3
 * gives the published site between two of its pages — the document crossing over in `--ui-fast`, the
 * bar named so it is not part of the crossing — without a byte of it travelling: the published sheet
 * names the bar for a navigation, this names it inside the canvas, for one transition, from the
 * editor's own stylesheet. The root's class while the page crosses over; the sheet reads it.
 */
export const PAGING_CLASS = "rb-paging";

/** The bar's name for the crossing: in the names sheet only while a page crosses over. */
export const HEADER_PAGE_RULE = ".rb-header { view-transition-name: rb-header; }";

/**
 * **Which movement a patch is drawn with**, kept pure so it can be held to it. Another page is a
 * crossing, whatever its sections are: it is not a page rearranged, and nothing on it slides. On the
 * page already drawn, a change of the sections' order slides them and a brand that moved settles;
 * everything else — a typed letter first of all — is patched at once.
 */
export type CanvasMotion =
  | { kind: "page" }
  | { kind: "slide"; sections: boolean; brand: boolean }
  | { kind: "none" };

export function canvasMotion(
  before: readonly string[],
  after: readonly string[],
  samePage: boolean,
  brand: boolean,
): CanvasMotion {
  if (!samePage) return { kind: "page" };
  const sections = shouldSlide(before, after, samePage);
  if (sections || brand) return { kind: "slide", sections, brand };
  return { kind: "none" };
}

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
export function namesSheet(ids: readonly string[], extra = ""): string {
  return [
    ...ids.map(
      (id, index) =>
        `[data-section="${id.replace(/["\\]/g, "\\$&")}"] { view-transition-name: rb-s-${index}; }`,
    ),
    ...(extra === "" ? [] : [extra]),
  ].join("\n");
}

/**
 * **The brand settles into its place** (sprint 35 día 6, ADR 0070 §5): a patch that moves the bar's
 * brand — its place, or its logo's size — names the brand for the transition, so it glides from
 * where it was rather than appearing there. Read off the two bars' attributes, which is what the
 * renderer draws the place and the size by; a brand that went to a rail or came back is a layout
 * change of the bar, and is not named.
 */
export const BRAND_SLIDE_RULE = ".rb-header > .rb-brand { view-transition-name: rb-brand; }";

export function brandMoved(live: ParentNode, fresh: ParentNode): boolean {
  const read = (root: ParentNode) => {
    const header = root.querySelector("header.rb-header");
    if (!header) return null;
    return `${header.getAttribute("data-brand-place") ?? ""}/${header.getAttribute("data-logo-size") ?? ""}/${header.getAttribute("data-layout") ?? ""}`;
  };
  const before = read(live);
  const after = read(fresh);
  return before !== null && after !== null && before !== after;
}

/**
 * Apply `update` inside the document's view transition, with `ids` named for it and `rootClass` on
 * the root while it runs (`SLIDING_CLASS` for sections and the brand, `PAGING_CLASS` for another
 * page). The caller has already asked `canSlide`. Every promise the transition hands back is
 * answered, so a transition a newer one skips is not an unhandled rejection in the console.
 *
 * **A newer transition takes the root whole** (sprint 36 día 7): it clears both classes and the
 * names before its own, and a skipped one's end touches nothing that is no longer its own — a page
 * crossing that skipped a slide must not leave the slide's class behind, which hides every gap.
 */
export function slide(
  doc: Document,
  ids: readonly string[],
  update: () => void,
  extra = "",
  rootClass: typeof SLIDING_CLASS | typeof PAGING_CLASS = SLIDING_CLASS,
): void {
  const root = doc.documentElement;
  doc.getElementById(SLIDE_NAMES_ID)?.remove();
  root.classList.remove(SLIDING_CLASS, PAGING_CLASS);
  const names = chrome(doc, "style");
  names.id = SLIDE_NAMES_ID;
  names.textContent = namesSheet(ids, extra);
  doc.head.append(names);
  const start = (doc as WithTransitions).startViewTransition;
  if (!start) {
    update();
    names.remove();
    return;
  }
  const transition = start.call(doc, () => {
    // A transition a newer one skipped still has its update called, and after the newer one has
    // cleared the root: it patches, but it no longer owns the root's class.
    if (names.isConnected) root.classList.add(rootClass);
    update();
  });
  const done = () => {
    if (!names.isConnected) return;
    names.remove();
    root.classList.remove(rootClass);
  };
  transition.finished.then(done, done);
  transition.ready.catch(() => undefined);
  transition.updateCallbackDone.catch(() => undefined);
}
