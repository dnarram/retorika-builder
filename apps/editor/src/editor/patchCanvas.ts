import morphdom from "morphdom";

/**
 * **An edit is a patch** (ADR 0051, sprint 26 día 2): the live preview document is brought in step
 * with what `render(doc, "dom")` painted, node by node, instead of being thrown away and parsed
 * again. This module is the rules; morphdom is the walk.
 *
 * **Why morphdom and not a morph of our own** — David's adjustment 1 to the plan was to read it
 * before writing one, and it holds: a keyed walk with positional fallback, text updated by
 * `nodeValue` in place, attributes removed when the fresh node lacks them, and the three hooks the
 * ADR's rules need (`getNodeKey`, `onBeforeElUpdated`, `onBeforeNodeDiscarded`), plus the one the
 * focused element needs (`onBeforeElChildrenUpdated`). MIT, no dependencies, a dependency of the
 * editor and never of the published page. **What it does not cover, and this file does:**
 *
 * - It moves a keyed node with `insertBefore`, which detaches it, so focus inside a moved node is
 *   lost — `patchCanvas` puts it back synchronously. (`moveBefore` is not in morphdom; the ADR
 *   leaves it undecided.)
 * - It knows nothing of the chrome. A chrome `div` sitting next to a renderer `div` would be
 *   *morphed into* the renderer's — so every chrome node gets a key of its own here, and is never
 *   discarded.
 * - It has no notion of which attributes the editor owns: the preserved lists below are copied
 *   from the live node onto the fresh one before morphdom compares them.
 * - It will happily rewrite the words someone is typing: the focused editable's children are
 *   refused unless the change comes from the history (adjustment 2).
 *
 * **Pure of React and of editor state.** It takes the live document, the fresh fragment, the
 * page's CSS and the rules, mutates the live document, and reports what it did. When to call it —
 * never in the middle of a gesture (adjustment 3) — is the editor's business.
 */

/** The attribute every node the editor draws into the page carries, set by one helper. */
export const CHROME_ATTRIBUTE = "data-rb-chrome";

/**
 * What the chrome may keep on a **renderer** node across a patch. Everything else on the live node
 * that the fresh node lacks is removed — the renderer's attributes are authoritative (ADR 0051 §2).
 * `style` is deliberately absent: a placement is the document's, and the chrome never writes
 * `style` onto a renderer node (adjustment 3).
 */
export const CHROME_ATTRIBUTES: ReadonlySet<string> = new Set([
  "tabindex",
  "contenteditable",
  "draggable",
  "title",
  "aria-describedby",
]);

/**
 * Kept on a `[data-section]` only. The renderer puts `role`, `aria-label` and `aria-current` on
 * the teaser's and the menu's own links, where the fresh value must win; on a section they are
 * the editor's group name and current mark.
 */
export const SECTION_CHROME_ATTRIBUTES: ReadonlySet<string> = new Set([
  "role",
  "aria-label",
  "aria-current",
]);

/** The classes the chrome may keep on a renderer node, named one by one. */
export const CHROME_CLASSES: ReadonlySet<string> = new Set([
  "rb-selected",
  "rb-chosen",
  "rb-photo",
  "rb-photo-host",
  "rb-line",
  "rb-designing",
  "rb-placing",
  "rb-resizing",
  "rb-moving",
]);

/** And one family of them: the border cursor, one class per edge, in place of `style.cursor`. */
export const CHROME_CLASS_PREFIXES: readonly string[] = ["rb-cursor-"];

/** The `<style>` that holds the page's own CSS, marked once so a patch can find it. */
export const PAGE_CSS_ATTRIBUTE = "data-rb-page-css";

/** Set on a focused editable whose words a history patch rewrote, so its `blur` does not commit
 * the words the person had before the undo back over the undo. */
export const HISTORY_TOUCHED_ATTRIBUTE = "data-rb-history-touched";

/**
 * The `<style>` that holds the page's `@font-face` rules alone (día 4). The html target writes one
 * stylesheet with the faces inside it, and rewriting that sheet re-declares the faces: measured as
 * one `loadingdone` per palette change, ten in ten, with no request behind any of them — the files
 * are cached — but a face re-declared is a face the browser may paint its fallback for while it
 * re-resolves. So the first patch moves the faces into a sheet of their own, before the page's, and
 * from then on a change of palette or spacing rewrites the page's sheet and never the faces'.
 */
export const FONT_CSS_ATTRIBUTE = "data-rb-font-css";

/** The page stylesheet split at the `@font-face` blocks `fontFaceCss` writes — its own format, the
 * comment line included — into the faces and everything else. */
export function splitFontFaces(css: string): { fonts: string; page: string } {
  const fonts: string[] = [];
  const page: string[] = [];
  let inFace = false;
  for (const line of css.split("\n")) {
    if (line.startsWith("@font-face {")) inFace = true;
    if (inFace) {
      fonts.push(line);
      if (line === "}") inFace = false;
      continue;
    }
    if (line.startsWith("/* Self-hosted faces.")) {
      fonts.push(line);
      continue;
    }
    page.push(line);
  }
  return { fonts: fonts.join("\n").trim(), page: page.join("\n").trim() };
}

/**
 * The words a history patch put into a focused editable, so its `blur` can compare what the
 * person leaves behind with what the document last said — and commit only the difference
 * (adjustment 2). Read once and cleared, by `wireEditing`'s blur.
 */
const historyText = new WeakMap<Element, string>();

export function takeHistoryText(el: Element): string | undefined {
  const text = historyText.get(el);
  historyText.delete(el);
  el.removeAttribute(HISTORY_TOUCHED_ATTRIBUTE);
  return text;
}

/**
 * **The one way the editor makes a node for the page** (ADR 0051 §2, rule 1). Every piece of
 * chrome — a verb cluster, a gap pill, a handle, a bar — is born here and carries the attribute
 * the patch keys on; `chromeGuard.test.ts` holds `Editor.tsx` to it, because a chrome node made
 * any other way would be matched against the renderer's and morphed into one.
 */
export function chrome<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
): HTMLElementTagNameMap[K] {
  const el = doc.createElement(tag);
  el.setAttribute(CHROME_ATTRIBUTE, "1");
  return el;
}

/**
 * Where a patch comes from, which decides what it may do to the editable with focus (rule 3).
 *
 * - `edit`: anything else — the focused editable's children are left alone, the rest is patched.
 * - `history`: undo or redo (adjustment 2) — applied to the focused editable too, the selection put
 *   back by its plain-text offsets, and the words left behind for the `blur` to compare against.
 * - `mark`: a mark set from the text's **own** floating toolbar while writing in it (día 4). The
 *   change is the person's own act on these very words, so refusing it would be refusing what they
 *   just asked for — measured on día 3's patch run as five walks whose `<strong>` never appeared.
 *   Applied exactly like `history`: the words do not change, the selection stays on them, and the
 *   bar sees its mark lit the way it did when the document was rebuilt around it.
 */
export type PatchCause = "edit" | "history" | "mark";

export interface PatchRules {
  /** Why the document changed. A change from the history is applied to the focused text too. */
  readonly cause: PatchCause;
  /** The element with focus in the live document, or `null`. Passed in rather than read, so a
   * test can say what is focused without a real focus. */
  readonly focused: Element | null;
}

export type PatchReport =
  | {
      readonly ok: true;
      /** Elements that arrived. */
      readonly inserted: number;
      /** Elements that left. */
      readonly removed: number;
      /** Keyed elements that changed place. */
      readonly moved: number;
      readonly textChanges: number;
      readonly attributeChanges: number;
      readonly cssChanged: boolean;
      /** Whether the faces' own sheet was rewritten — on the first patch, which makes it, and then
       * only when the document names other faces (día 4). */
      readonly fontsChanged: boolean;
      /** Keys of focused editables whose children were left alone this time. */
      readonly deferred: readonly string[];
      /** Whether the keyed skeleton changed: something came, went or moved (día 3). */
      readonly structural: boolean;
    }
  | {
      readonly ok: false;
      /** `no-body`: the live document has nothing to patch into. */
      readonly reason: "no-body";
    };

export function isChrome(node: Node | null | undefined): boolean {
  return (
    node !== null &&
    node !== undefined &&
    node.nodeType === node.ELEMENT_NODE &&
    (node as Element).hasAttribute(CHROME_ATTRIBUTE)
  );
}

/**
 * A renderer node's own key, without its ancestors: what the renderer itself put on it.
 *
 * Elements inside a card drawn from a collection all share the template's `data-id`, so a flat
 * key would collide — `keyOf` below prefixes it with the keyed ancestors' chain.
 */
function ownKey(el: Element): string | null {
  const section = el.getAttribute("data-section");
  if (section !== null) return `s:${section}`;
  const entry = el.getAttribute("data-entry");
  const item = el.getAttribute("data-item");
  const id = el.getAttribute("data-id");
  if (entry !== null && id !== null) return `n:${entry}/e:${id}`;
  if (entry !== null) return `n:${entry}`;
  if (item !== null) return `i:${item}`;
  if (id !== null) return `e:${id}`;
  // **The menu, by strip and by list** (día 4). The renderer draws every link twice — once in the
  // wide strip and once in the narrow `<details>` — and each strip holds up to two `<nav>`s, pages
  // and sections. A link keyed by `href` alone therefore had two or four twins with the same key;
  // morphdom keeps one entry per key, matched a fresh link to a twin in the other strip, and the
  // link the document had dropped stayed on the page. Measured on día 3's patch run as «Qué
  // ponemos» twice in one strip, `#sec-services` beside `./que-ponemos.html`. With the strip and
  // the list in the chain, `m:wide/nav:Páginas/a:./que-ponemos.html` names exactly one node.
  if (el.classList.contains("rb-nav-wide")) return "m:wide";
  if (el.classList.contains("rb-nav-narrow")) return "m:narrow";
  if (el.tagName === "NAV") {
    const label = el.getAttribute("aria-label");
    return label === null ? null : `nav:${label}`;
  }
  if (el.tagName === "A" && el.hasAttribute("href") && el.closest("nav") !== null) {
    return `a:${el.getAttribute("href")}`;
  }
  return null;
}

/** The chrome's own keys: one per node, never equal to a renderer key, so morphdom can neither
 * match a chrome node to a fresh one nor mistake it for an unkeyed sibling. */
const chromeKeys = new WeakMap<Element, string>();
let chromeSerial = 0;

/**
 * The key morphdom matches on: the chain of keyed ancestors plus the node's own, in document
 * order — `s:sec-cover/e:el-headline`, or `s:sec-list/n:3/e:el-title` inside a card.
 */
export function keyOf(node: Node): string | undefined {
  if (node.nodeType !== node.ELEMENT_NODE) return undefined;
  const el = node as Element;
  if (isChrome(el)) {
    let key = chromeKeys.get(el);
    if (key === undefined) {
      chromeSerial += 1;
      key = `chrome:${chromeSerial}`;
      chromeKeys.set(el, key);
    }
    return key;
  }
  const own = ownKey(el);
  if (own === null) return undefined;
  const parts = [own];
  let up = el.parentElement;
  while (up) {
    const above = ownKey(up);
    if (above !== null) parts.unshift(above);
    up = up.parentElement;
  }
  return parts.join("/");
}

/**
 * The keyed skeleton of a tree, chrome excluded, in document order. Two trees with the same
 * skeleton differ only in text, attributes and unkeyed inline structure. A different skeleton is a
 * section, an item or an element that came, went or moved — patched since día 3, and reported as
 * `structural` so the editor knows the chrome has new ground to draw on.
 */
export function skeletonOf(root: ParentNode): string {
  const keys: string[] = [];
  const walk = (node: Node) => {
    if (isChrome(node)) return;
    if (node.nodeType === node.ELEMENT_NODE) {
      const key = keyOf(node);
      if (key !== undefined) keys.push(key);
    }
    for (const child of node.childNodes) walk(child);
  };
  for (const child of root.childNodes) walk(child);
  return keys.join("\n");
}

/**
 * The selection's offsets in the element's plain text — a caret has `start === end` — or `null`
 * when the selection is not inside it.
 *
 * **Exported for the test that pins the shape** (sprint 27 día 3, David's adjustment 2): the
 * editor's own record of the chosen words is `{ element, start, end }` in characters and never a
 * live `Range`, and the reason is this function's own patch — applying a mark splits one text node
 * into three, so every node reference taken before it is meaningless after, while the offsets still
 * name the same letters. `patchCanvas.test.ts` records, patches and restores, and holds a `Range`
 * across the same patch to show what the other shape would have cost.
 */
export function selectionOffsetsIn(el: Element): { start: number; end: number } | null {
  const selection = el.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
  const before = range.cloneRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { start, end: start + range.toString().length };
}

/** The text node and offset a plain-text offset falls in, clamped to what the element now holds. */
function pointAt(el: Element, offset: number): { node: Node; offset: number } {
  const walker = el.ownerDocument.createTreeWalker(el, 0x4 /* NodeFilter.SHOW_TEXT */);
  let remaining = offset;
  let node = walker.nextNode();
  let last: Node | null = null;
  while (node) {
    const length = node.nodeValue?.length ?? 0;
    if (remaining <= length) return { node, offset: remaining };
    remaining -= length;
    last = node;
    node = walker.nextNode();
  }
  return last ? { node: last, offset: last.nodeValue?.length ?? 0 } : { node: el, offset: 0 };
}

/** Put the selection back on the same plain-text offsets — a caret, or the words a mark was set on. */
function setSelectionOffsets(el: Element, offsets: { start: number; end: number }): void {
  const doc = el.ownerDocument;
  const selection = doc.getSelection();
  if (!selection) return;
  const from = pointAt(el, offsets.start);
  const to = pointAt(el, offsets.end);
  const range = doc.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Carry what the chrome owns from the live node onto the fresh one, so morphdom's attribute pass
 * — which removes what the fresh node lacks — leaves it in place. Everything else on the live node
 * is the renderer's to overwrite, inline `style` included.
 */
function carryChrome(from: Element, to: Element): void {
  const isSection = from.hasAttribute("data-section");
  for (const attr of [...from.attributes]) {
    const keep =
      CHROME_ATTRIBUTES.has(attr.name) ||
      attr.name.startsWith("data-rb-") ||
      (isSection && SECTION_CHROME_ATTRIBUTES.has(attr.name));
    if (keep && !to.hasAttribute(attr.name)) to.setAttribute(attr.name, attr.value);
  }
  const kept = [...from.classList].filter(
    (name) => CHROME_CLASSES.has(name) || CHROME_CLASS_PREFIXES.some((p) => name.startsWith(p)),
  );
  for (const name of kept) to.classList.add(name);
}

/**
 * Bring `live` in step with `fresh`, and say what changed.
 *
 * **The first patch of a session is never a no-op**: a document parsed from the html target
 * carries the pretty-printer's whitespace text nodes and the dom target has none, so the first
 * walk strips them and rewrites every block's text once. From then on an unchanged document
 * patches to nothing, which `patchCanvas.test.ts` asserts on the second pass and not the first.
 *
 * `fresh` is consumed: its roots become the fresh body's children. `css` is the page's stylesheet
 * as `buildCss` gives it; the `<style>` marked `data-rb-page-css` is rewritten only when the text
 * differs, which is what keeps the faces from being asked for again on an edit that changed no
 * rule (the measurement is día 4's).
 */
export function patchCanvas(
  live: Document,
  fresh: DocumentFragment,
  css: string,
  rules: PatchRules,
): PatchReport {
  const body = live.body;
  if (!body) return { ok: false, reason: "no-body" };

  const to = fresh.ownerDocument.createElement("body");
  to.append(...fresh.childNodes);

  // Whether the keyed skeleton changed — a section, an item or a placed element that came, went
  // or moved. Día 2 refused those and left them to the old route; since día 3 the chrome is drawn
  // again after every patch, so they are patched like anything else and the report says so.
  const structural = skeletonOf(body) !== skeletonOf(to);

  const deferred: string[] = [];
  const touchedByHistory: Element[] = [];
  const focused = rules.focused;
  const offsets = focused && rules.cause !== "edit" ? selectionOffsetsIn(focused) : null;
  const active = live.activeElement;

  /**
   * **The chrome is taken out of the tree for the duration of the walk, and put back where it
   * was.** Invisible to the diff means exactly that: morphdom, meeting a keyed node the fresh tree
   * does not have, inserts the fresh node before it and so pushes it down its parent — measured
   * on a `.rb-actions` cluster that went from first child to third. Parked, the walk never sees
   * it; afterwards each piece goes back after the renderer sibling it followed, which persists
   * because keyed renderer nodes keep their identity. Only top-level chrome is parked; what is
   * inside it travels with it.
   */
  const parked = [...body.querySelectorAll(`[${CHROME_ATTRIBUTE}]`)]
    .filter((el) => el.parentElement !== null && !isChrome(el.parentElement))
    .map((el) => {
      let anchor = el.previousElementSibling;
      while (anchor && isChrome(anchor)) anchor = anchor.previousElementSibling;
      return { el, parent: el.parentElement as Element, anchor };
    });
  for (const { el } of parked) el.remove();

  const view = live.defaultView;
  const observer = view ? new view.MutationObserver(() => {}) : null;
  observer?.observe(body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });

  morphdom(body, to, {
    childrenOnly: true,
    getNodeKey: keyOf,
    onBeforeNodeAdded: (node) => node,
    onBeforeElUpdated: (fromEl, toEl) => {
      if (isChrome(fromEl)) return false;
      carryChrome(fromEl, toEl);
      return true;
    },
    onBeforeElChildrenUpdated: (fromEl) => {
      // **The editable with focus, and only an editable.** A chosen headline has focus too — it is
      // a Tab stop — and its words are nobody's draft: an edit from elsewhere must show on it. The
      // first version protected any focused element and would have stopped that silently; the
      // día 2 walk that could not run is what found it.
      if (focused !== null && fromEl === focused && (focused as HTMLElement).isContentEditable) {
        if (rules.cause === "edit") {
          deferred.push(keyOf(fromEl) ?? fromEl.tagName.toLowerCase());
          return false;
        }
        touchedByHistory.push(fromEl);
      }
      return true;
    },
    onBeforeNodeDiscarded: (node) => !isChrome(node),
  });

  const records = observer?.takeRecords() ?? [];
  observer?.disconnect();

  for (const { el, parent, anchor } of parked) {
    if (!parent.isConnected) continue;
    const next = anchor?.isConnected ? anchor.nextSibling : parent.firstChild;
    parent.insertBefore(el, next);
  }

  let inserted = 0;
  let removed = 0;
  let textChanges = 0;
  let attributeChanges = 0;
  const added = new Set<Node>();
  const gone = new Set<Node>();
  for (const record of records) {
    if (record.type === "characterData") textChanges += 1;
    else if (record.type === "attributes") attributeChanges += 1;
    else {
      for (const node of record.addedNodes)
        if (node.nodeType === node.ELEMENT_NODE) added.add(node);
      for (const node of record.removedNodes) {
        if (node.nodeType === node.ELEMENT_NODE) gone.add(node);
      }
    }
  }
  let moved = 0;
  for (const node of added) {
    if (gone.has(node)) moved += 1;
    else inserted += 1;
  }
  for (const node of gone) if (!added.has(node)) removed += 1;

  // A keyed node morphdom moved was detached on the way, and focus does not survive that.
  if (active && active !== live.activeElement && active.isConnected) {
    (active as HTMLElement).focus?.({ preventScroll: true });
  }
  for (const el of touchedByHistory) {
    el.setAttribute(HISTORY_TOUCHED_ATTRIBUTE, "1");
    historyText.set(el, el.textContent ?? "");
    if (offsets !== null) setSelectionOffsets(el, offsets);
  }

  // The html target writes one stylesheet as `\n{css.trimEnd()}\n` (`pageToHtml`), faces inside.
  // Here it is two: the faces' sheet, made on the first patch and rewritten only when the faces
  // change, and the page's, compared and rewritten on its trimmed text. The split costs one
  // re-declaration of the faces at the first patch — right after the first paint, while they are
  // still arriving — and saves one on every change of style after it.
  let cssChanged = false;
  let fontsChanged = false;
  const style =
    live.querySelector(`style[${PAGE_CSS_ATTRIBUTE}]`) ?? live.head?.querySelector("style");
  if (style) {
    if (!style.hasAttribute(PAGE_CSS_ATTRIBUTE)) style.setAttribute(PAGE_CSS_ATTRIBUTE, "1");
    const split = splitFontFaces(css);
    let fontStyle = live.querySelector(`style[${FONT_CSS_ATTRIBUTE}]`);
    if (split.fonts !== "" && !fontStyle) {
      fontStyle = live.createElement("style");
      fontStyle.setAttribute(FONT_CSS_ATTRIBUTE, "1");
      style.before(fontStyle);
    }
    if (fontStyle && (fontStyle.textContent ?? "").trim() !== split.fonts) {
      fontStyle.textContent = `\n${split.fonts}\n`;
      fontsChanged = true;
    }
    if ((style.textContent ?? "").trim() !== split.page) {
      style.textContent = `\n${split.page}\n`;
      cssChanged = true;
    }
  }

  return {
    ok: true,
    inserted,
    removed,
    moved,
    textChanges,
    attributeChanges,
    cssChanged,
    fontsChanged,
    deferred,
    structural,
  };
}
