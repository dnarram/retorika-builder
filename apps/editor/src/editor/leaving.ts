/**
 * **What leaves the screen is seen to leave** (sprint 35 día 2).
 *
 * A panel, a dialog and the undo notice used to vanish in the frame React removed them in: open
 * things arrived, closed things blinked out. React has no exit — a component that is gone has no
 * render left to animate — so the exit is drawn by something that is not React's: **a copy of the
 * node, taken in the instant before React removes it, drawn where it was and playing its way out**,
 * then dropped. The real thing is gone at once, which is the half that matters to everything that
 * measures: the canvas takes its room back on the first frame of a closing panel (David's
 * adjustment 2, «el lienzo recupera su ancho de golpe al empezar la salida, no al desmontar»), focus
 * goes back where it came from, and the next panel or dialog is already there.
 *
 * **The copy is decoration and is made unable to be anything else.** Inert, hidden from assistive
 * technology, and blind to the pointer, so a click during its 120 ms lands on what is underneath and
 * a keyboard never reaches it. Every attribute something could find it by — `id`, `data-testid`,
 * `name`, `role`, the ARIA references, a placeholder — is taken off, its words are painted rather
 * than written (`wordsAsPaint`), and a landmark root (`<aside>`, a named `<section>`) is rebuilt as
 * a `<div>`, so for the length of the exit there is never a second panel, a second dialog, a second
 * «Descargar igualmente» or a second «Spectral» to be found. That last one is not
 * hypothetical: a walk in `critical-flows.e2e.test.ts` passes the download warnings by pressing
 * that button whenever it is visible (the inventory of sprint 35 día 1).
 *
 * **No copy for somebody who asked for less movement.** The thing simply goes, as it always did —
 * the preference removes the travel and never the destination, and an exit is nothing but travel.
 *
 * **Only if the node really left.** React's development mode rehearses an unmount on every mount
 * (`StrictMode`), and the cleanup this is called from runs then too, with the node staying where it
 * is. So the copy is made at once — the node's size and scroll are only true while it is still on
 * the page — and drawn a microtask later, after the commit, if and only if the original is gone.
 * A microtask runs before the browser paints, so the original's last frame and the copy's first
 * are the same frame.
 *
 * **It always ends.** On its own `animationend`, or after `LEAVING_FALLBACK_MS` if the animation
 * never runs — a tab in the background, a stylesheet that did not load — so a copy can never be
 * left standing over the editor.
 */

/**
 * What is leaving. The first three are the editor's (`globals.css` styles their exits); `popup`
 * and `zone` are the canvas chrome's (sprint 35 día 3), styled by the sheet the editor injects into
 * the frame, which `globals.css` cannot reach: a menu, a bar or a ghost shrinking away, and the zone
 * that received a menu acknowledging it once. `rail` is the editor's again (sprint 37 día 2): the
 * rail in the layout the owner just switched away from, fading where it stood while the other one
 * rises in its place (ADR 0072).
 */
export type LeavingKind = "panel" | "dialog" | "toast" | "popup" | "zone" | "rail";

/**
 * **What leaves from the body, `fixed` over the box it had**: a panel, and the rail. Both are items
 * of a flex row, and a copy put back in the row would hold room the canvas is taking back — or, for
 * the rail, push the new rail aside for the length of the exit.
 */
const OVER_THE_ROW: ReadonlySet<LeavingKind> = new Set(["panel", "rail"]);

/** Longer than the longest exit (`--ui-fast`, 120 ms) with room for a slow frame, and short enough
 * that a copy left by an animation that never ran is gone before anybody could act on it. */
export const LEAVING_FALLBACK_MS = 250;

/**
 * **A whole screen leaving before the next one is asked for** (sprint 36 día 3): the landing, when
 * «Crear mi web» is pressed. Not a copy: there is no React exit to stand in for, because the screen
 * is still here until the navigation replaces it — so the real element is marked
 * `data-leaving="screen"`, fades on `--ui-fast` (`globals.css`, and takes no pointer meanwhile), and
 * `then` runs on its own `animationend` or after `LEAVING_FALLBACK_MS`, once. For somebody who asked
 * for less movement `then` runs at once and nothing is marked: the navigation is the exit.
 *
 * Returns the way to take the mark off, for a screen that comes back without being rebuilt (a
 * back navigation that restores the page as it was).
 */
export function leaveScreen(screen: HTMLElement, then: () => void): () => void {
  const view = screen.ownerDocument.defaultView;
  const unmark = () => {
    if (screen.getAttribute("data-leaving") === "screen") screen.removeAttribute("data-leaving");
  };
  if (!view || view.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    then();
    return unmark;
  }
  let gone = false;
  const go = () => {
    if (gone) return;
    gone = true;
    view.clearTimeout(fallback);
    screen.removeEventListener("animationend", onEnd);
    then();
  };
  const onEnd = (event: Event) => {
    if (event.target === screen) go();
  };
  screen.addEventListener("animationend", onEnd);
  const fallback = view.setTimeout(go, LEAVING_FALLBACK_MS);
  screen.setAttribute("data-leaving", "screen");
  return unmark;
}

/** The attributes something could find a node by, or point at it with. */
const FINDABLE = [
  "id",
  "data-testid",
  "name",
  "for",
  "role",
  "aria-modal",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-label",
  "autofocus",
  "tabindex",
  "data-initial-focus",
  "placeholder",
  "alt",
  "title",
];

/**
 * **The canvas's copies live in a closed shadow root** (sprint 35 día 3, found by the full e2e). In
 * the canvas the chrome is found by its classes — by the walks (`.rb-menu-search`, `.rb-zone`) and,
 * more to the point, by the editor itself: `drawGaps` looks for «the open menu» as `.rb-gap .rb-menu`
 * to reopen it after a redraw, and would have reopened a closing menu's copy. A copy keeps its
 * classes to be drawn, so here it is drawn where nothing can query it: inside a closed shadow root,
 * on a host that takes no box (`display: contents`), styled by the frame's own chrome sheet adopted
 * as a constructed stylesheet. The editor's copies (panel, dialog, notice) are found by roles and
 * landmarks, which the attributes taken off already hide.
 */
// Not the zone: nothing in the editor queries a zone once the drop is done, and its one pulse is
// what has to be measured from outside (an animation in a closed shadow root is in no
// `document.getAnimations()`).
const SHADOWED: ReadonlySet<LeavingKind> = new Set(["popup"]);

const adopted = new WeakMap<Document, { text: string; sheet: CSSStyleSheet }>();

/** The document's chrome stylesheets as one constructed sheet, rebuilt only when they change. */
function chromeSheetOf(doc: Document): CSSStyleSheet {
  const text = [...doc.querySelectorAll<HTMLStyleElement>("style[data-rb-chrome]")]
    .map((style) => style.textContent ?? "")
    .join("\n");
  const cached = adopted.get(doc);
  if (cached?.text === text) return cached.sheet;
  // The frame's own constructor: a document adopts only sheets made in its own realm.
  const realm = doc.defaultView as unknown as { CSSStyleSheet: typeof CSSStyleSheet };
  const sheet = new realm.CSSStyleSheet();
  sheet.replaceSync(text);
  adopted.set(doc, { text, sheet });
  return sheet;
}

function shadowHost(doc: Document, ghost: HTMLElement, kind: LeavingKind): HTMLElement {
  const host = doc.createElement("div");
  // Chrome, so a patch arriving during the exit keeps it (`patchCanvas` never discards chrome).
  host.setAttribute("data-rb-chrome", "1");
  host.setAttribute("data-leaving-host", kind);
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("inert", "");
  host.style.display = "contents";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.adoptedStyleSheets = [chromeSheetOf(doc)];
  shadow.append(ghost);
  return host;
}

/** Where a text node is content rather than words on the page, and must stay a text node. */
const RAW_TEXT = new Set(["TEXTAREA", "OPTION", "SCRIPT", "STYLE", "TITLE"]);

/**
 * **The copy carries no text, and still shows every word** (sprint 35 día 2, found by the full
 * e2e). `aria-hidden` keeps a copy out of every role a reader or a test asks for, but not out of the
 * page's *text*: a locator by text, a label found by its words, the browser's own find-in-page all
 * read the DOM's text nodes, and for the copy's 120 ms the font the owner had just chosen was on the
 * page twice — «Spectral» in the panel and «Spectral» in the chooser leaving it. So every text node
 * of the copy becomes an empty `<span>` that paints its words with `::before` (`globals.css`): drawn
 * the same, found by nothing that reads text.
 */
function wordsAsPaint(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node as Text);
  for (const text of texts) {
    const parent = text.parentElement;
    if (!parent || text.data.trim() === "") continue;
    if (RAW_TEXT.has(parent.tagName) || parent.namespaceURI !== root.namespaceURI) continue;
    const paint = doc.createElement("span");
    paint.setAttribute("data-leaving-text", text.data);
    text.replaceWith(paint);
  }
}

interface Scrolled {
  copy: Element;
  top: number;
  left: number;
}

/**
 * The copy of `node` that plays its exit: inert, unfindable, its entrance class taken off and the
 * `data-leaving` hook its exit is styled by put on. Exported for its unit tests.
 */
export function ghostOf(
  node: HTMLElement,
  kind: LeavingKind,
): { ghost: HTMLElement; scrolled: Scrolled[] } {
  const doc = node.ownerDocument;
  const copy = node.cloneNode(true) as HTMLElement;

  // Every scrolled box, paired with its copy before anything is removed from the copy: a panel
  // scrolled down to its last block must leave from there, not from its top.
  const originals = [node, ...node.querySelectorAll("*")];
  const copies = [copy, ...copy.querySelectorAll("*")];
  const scrolled: Scrolled[] = [];
  originals.forEach((original, index) => {
    const twin = copies[index];
    if (twin && (original.scrollTop > 0 || original.scrollLeft > 0)) {
      scrolled.push({ copy: twin, top: original.scrollTop, left: original.scrollLeft });
    }
  });

  // A landmark root is rebuilt as a `<div>`: two `<aside>`s, even for 120 ms, is a strict locator
  // that finds two things and a screen reader that could have been told of two regions.
  let ghost = copy;
  if (copy.tagName !== "DIV") {
    ghost = doc.createElement("div");
    for (const attribute of ["class", "style"]) {
      const value = copy.getAttribute(attribute);
      if (value !== null) ghost.setAttribute(attribute, value);
    }
    ghost.append(...copy.childNodes);
    for (const entry of scrolled) if (entry.copy === copy) entry.copy = ghost;
  }

  for (const element of [ghost, ...ghost.querySelectorAll("*")]) {
    for (const attribute of FINDABLE) element.removeAttribute(attribute);
  }
  // A frame or a player would load again for an exit nobody is watching it for.
  for (const heavy of ghost.querySelectorAll("iframe, video, audio")) heavy.remove();
  wordsAsPaint(ghost);

  ghost.classList.remove("ui-enter-right", "ui-rise-in", "rb-arrives");
  ghost.setAttribute("data-leaving", kind);
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  ghost.style.pointerEvents = "none";
  return { ghost, scrolled };
}

/**
 * Draw `node`'s exit, if it is leaving. Called from the cleanup that runs in the instant before
 * React removes it; does nothing for a node that turns out to be staying.
 *
 * Where the copy is drawn depends on what it was. **A panel goes to the body, `fixed` over the box
 * it had**: in the row it would be a second child of the row the walks read panels from, and in
 * the flow it would hold the room the canvas is taking back. **A dialog and the notice go back where
 * they were**, beside the place the original had in the tree: both are `fixed` already, and the
 * notice is drawn inside the canvas card, whose scale is its containing block — moving it to the
 * body would move it on the screen.
 */
export function leave(
  node: Element | null | undefined,
  kind: LeavingKind,
  /** Draw nothing unless this is still on the page once the commit is done: the panel's row, so
   * that leaving the editor with a panel open does not draw its exit over the next screen. */
  within?: Element,
): void {
  if (node?.nodeType !== 1 || !node.isConnected) return;
  const element = node as HTMLElement;
  const view = element.ownerDocument.defaultView;
  if (view?.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const parent = element.parentNode;
  const next = element.nextSibling;
  const box = element.getBoundingClientRect();
  const { ghost, scrolled } = ghostOf(element, kind);

  queueMicrotask(() => {
    /** What is on the page for the exit: the copy, or the host whose shadow holds it. */
    let shown: HTMLElement = ghost;
    if (element.isConnected) return; // a rehearsal, or a node that moved rather than left
    if (within && !within.isConnected) return; // the whole screen went, not this node
    if (OVER_THE_ROW.has(kind)) {
      Object.assign(ghost.style, {
        position: "fixed",
        left: `${box.left}px`,
        top: `${box.top}px`,
        right: "auto",
        bottom: "auto",
        width: `${box.width}px`,
        height: `${box.height}px`,
        maxHeight: "none",
        margin: "0",
        // Over the canvas, under the panel arriving in its place (`panelCard`'s layer 11) and under
        // every dialog — a cross shows the new panel, not the old one on top of it.
        zIndex: "10",
      });
      element.ownerDocument.body.append(ghost);
    } else {
      if (!parent?.isConnected) return; // what held it left with it, and took the place with it
      const placed = SHADOWED.has(kind) ? shadowHost(element.ownerDocument, ghost, kind) : ghost;
      shown = placed;
      parent.insertBefore(placed, next && next.parentNode === parent ? next : null);
    }
    for (const entry of scrolled) {
      entry.copy.scrollTop = entry.top;
      entry.copy.scrollLeft = entry.left;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      shown.remove();
    };
    const timer = setTimeout(finish, LEAVING_FALLBACK_MS);
    // Its own end only: a dialog's card ends its exit inside the backdrop's, and that event
    // bubbles up through the backdrop on its way.
    ghost.addEventListener("animationend", (event) => {
      if (event.target === ghost) finish();
    });
  });
}
