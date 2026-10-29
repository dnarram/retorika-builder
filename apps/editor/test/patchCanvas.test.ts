// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCss, render } from "@retorika/renderer";
import { applyMark, pageToSection, parseDocument, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  CHROME_ATTRIBUTE,
  FONT_CSS_ATTRIBUTE,
  HISTORY_TOUCHED_ATTRIBUTE,
  keyOf,
  PAGE_CSS_ATTRIBUTE,
  patchCanvas,
  selectionOffsetsIn,
  skeletonOf,
  splitFontFaces,
} from "../src/editor/patchCanvas.ts";

/**
 * **The rules of ADR 0051 §2, each one asserted on a real page and sabotaged by its opposite.**
 *
 * The live document is what the editor has today — the html target parsed into an iframe — and the
 * fresh fragment is what the dom target paints in an inert document; both come from the same
 * fixture, so a test that changes one word in the document is testing exactly what one keystroke
 * will do in the editor. Under happy-dom, which the renderer's own tests already use.
 */

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "..", "..", "..", "fixtures", "documents", "cover-and-services.json");
const MENU_FIXTURE = join(here, "..", "..", "..", "fixtures", "documents", "menu-y-paginas.json");

function fixture(): RetorikaDocument {
  return parseDocument(JSON.parse(readFileSync(FIXTURE, "utf8")));
}

/** A site with a menu: a home page and two pages converted from sections, each drawn in both strips. */
function menuFixture(): RetorikaDocument {
  return parseDocument(JSON.parse(readFileSync(MENU_FIXTURE, "utf8")));
}

/**
 * A live document the way the editor gets its first one: parsed from the html target — and
 * **installed as the real document**, root and all, because the editor's live document is an
 * iframe's, with a window. A `DOMParser` document has none: no `MutationObserver` to count what a
 * patch did, no selection to keep a caret in. Each test installs its own; happy-dom's global
 * document is the one that has both.
 */
function liveFrom(doc: RetorikaDocument): Document {
  const { html } = render(doc, "html");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  // Removed first, then appended: happy-dom's `replaceChild` on a document inserts before it
  // removes, and a document may hold one root.
  document.removeChild(document.documentElement);
  document.appendChild(document.importNode(parsed.documentElement, true));
  return document;
}

/** A document patched once already, so the pretty-printer's whitespace is gone and what follows
 * measures the edit alone. */
function settled(doc: RetorikaDocument): Document {
  const live = liveFrom(doc);
  const first = patchCanvas(live, freshFrom(doc), buildCss(doc), { cause: "edit", focused: null });
  if (!first.ok) throw new Error(`the first patch was refused: ${first.reason}`);
  return live;
}

/** A fresh fragment the way the editor will build every edit: in a document that loads nothing. */
function freshFrom(doc: RetorikaDocument): DocumentFragment {
  const inert = document.implementation.createHTMLDocument("");
  return render(doc, "dom", { document: inert });
}

/** The fixture with one text changed, through the document and not through the DOM. */
function withHeadline(doc: RetorikaDocument, text: string): RetorikaDocument {
  const copy = structuredClone(doc);
  const cover = copy.pages[0]?.sections[0];
  const headline = cover?.content.find((el) => el.slot === "headline");
  if (!headline || headline.value?.kind !== "text") throw new Error("fixture has no headline");
  headline.value.text = text;
  return parseDocument(copy);
}

const rules = { cause: "edit" as const, focused: null };

describe("patchCanvas — an edit is a patch", () => {
  it("changes a word in place: same element, new text, nothing inserted or removed", () => {
    const doc = fixture();
    const live = settled(doc);
    const before = live.querySelector('[data-id="el-headline"]');
    expect(before).not.toBeNull();

    const next = withHeadline(doc, "Otra cosa");
    const report = patchCanvas(live, freshFrom(next), buildCss(next), rules);

    expect(report.ok).toBe(true);
    if (!report.ok) return;
    const after = live.querySelector('[data-id="el-headline"]');
    expect(after).toBe(before);
    expect(after?.textContent?.trim()).toBe("Otra cosa");
    expect(report.textChanges).toBeGreaterThan(0);
    expect(report.inserted).toBe(0);
    expect(report.removed).toBe(0);
    expect(report.moved).toBe(0);
  });

  it("strips the pretty-printer's whitespace once, and is then a no-op on an unchanged document", () => {
    const doc = fixture();
    const live = liveFrom(doc);
    // The first patch normalises: the html target's indentation goes, and that is work.
    const first = patchCanvas(live, freshFrom(doc), buildCss(doc), rules);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.textChanges + first.removed).toBeGreaterThan(0);
    const html = live.body.innerHTML;
    // The second finds nothing to do, and says so in every number.
    const second = patchCanvas(live, freshFrom(doc), buildCss(doc), rules);
    expect(second).toMatchObject({
      ok: true,
      inserted: 0,
      removed: 0,
      moved: 0,
      textChanges: 0,
      attributeChanges: 0,
      cssChanged: false,
    });
    expect(live.body.innerHTML).toBe(html);
  });

  it("leaves the chrome where it is, even a chrome div sitting first among renderer nodes", () => {
    const doc = fixture();
    // **Unsettled on purpose.** The first patch strips the pretty-printer's text nodes, and that is
    // the walk in which morphdom, meeting a keyed node the fresh tree lacks, inserts the fresh
    // node before it — measured as an `.rb-actions` cluster pushed from first child to third. A
    // settled document never displaces it, and a test on one passed with the parking removed.
    const live = liveFrom(doc);
    const section = live.querySelector('[data-section="sec-cover"]');
    if (!section) throw new Error("no cover");
    // Two kinds of chrome: a cluster inside the section, and a bar appended to the body.
    const cluster = live.createElement("div");
    cluster.setAttribute(CHROME_ATTRIBUTE, "1");
    cluster.className = "rb-actions";
    section.prepend(cluster);
    const bar = live.createElement("div");
    bar.setAttribute(CHROME_ATTRIBUTE, "1");
    bar.className = "rb-toolbar";
    live.body.append(bar);

    const next = withHeadline(doc, "Sigue el cromo");
    const report = patchCanvas(live, freshFrom(next), buildCss(next), rules);
    expect(report).toMatchObject({ ok: true, inserted: 0, removed: 0, moved: 0 });
    // Same nodes, same places: first in the section, last in the body.
    expect(section.firstElementChild).toBe(cluster);
    expect(live.body.lastElementChild).toBe(bar);
    expect(live.querySelector('[data-id="el-headline"]')?.textContent?.trim()).toBe(
      "Sigue el cromo",
    );
  });

  it("keeps what the chrome owns on a renderer node, and the renderer's own style wins over the chrome's", () => {
    const doc = fixture();
    const live = settled(doc);
    const headline = live.querySelector<HTMLElement>('[data-id="el-headline"]');
    const section = live.querySelector<HTMLElement>('[data-section="sec-cover"]');
    if (!headline || !section) throw new Error("fixture shape");
    headline.setAttribute("contenteditable", "true");
    headline.setAttribute("tabindex", "0");
    headline.classList.add("rb-chosen", "rb-cursor-ew");
    // What the chrome must not do (adjustment 3), done here on purpose to prove the fresh value wins.
    headline.setAttribute("style", "cursor: ew-resize");
    section.setAttribute("role", "group");
    section.setAttribute("aria-label", "Portada");

    const next = withHeadline(doc, "Conservado");
    const fresh = freshFrom(next);
    const placement = fresh.querySelector('[data-id="el-headline"]')?.getAttribute("style");
    expect(placement, "the fixture's headline carries a placement style").toContain("grid-column");
    const report = patchCanvas(live, fresh, buildCss(next), rules);
    expect(report.ok).toBe(true);
    expect(headline.getAttribute("contenteditable")).toBe("true");
    expect(headline.getAttribute("tabindex")).toBe("0");
    expect(headline.classList.contains("rb-chosen")).toBe(true);
    expect(headline.classList.contains("rb-cursor-ew")).toBe(true);
    // The renderer's placement, exactly, and not a trace of the cursor the chrome wrote.
    expect(headline.getAttribute("style")).toBe(placement);
    expect(section.getAttribute("role")).toBe("group");
    expect(section.getAttribute("aria-label")).toBe("Portada");
  });

  it("never rewrites the words of the focused editable on an ordinary edit, and says it deferred", () => {
    const doc = fixture();
    const live = settled(doc);
    const headline = live.querySelector<HTMLElement>('[data-id="el-headline"]');
    if (!headline) throw new Error("no headline");
    headline.setAttribute("contenteditable", "true");
    headline.textContent = "Lo que la persona está escribiendo";

    const next = withHeadline(doc, "Lo que llegó de fuera");
    const report = patchCanvas(live, freshFrom(next), buildCss(next), {
      cause: "edit",
      focused: headline,
    });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(headline.textContent).toBe("Lo que la persona está escribiendo");
    expect(report.deferred).toEqual(["s:sec-cover/e:el-headline"]);
  });

  it("patches a focused element that is not editable: a chosen headline is nobody's draft", () => {
    const doc = fixture();
    const live = settled(doc);
    const headline = live.querySelector<HTMLElement>('[data-id="el-headline"]');
    if (!headline) throw new Error("no headline");
    // Chosen: a Tab stop with focus, and not being written in.
    headline.setAttribute("tabindex", "0");
    headline.classList.add("rb-chosen");

    const next = withHeadline(doc, "Llegó de fuera y se ve");
    const report = patchCanvas(live, freshFrom(next), buildCss(next), {
      cause: "edit",
      focused: headline,
    });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.deferred).toEqual([]);
    expect(headline.textContent?.trim()).toBe("Llegó de fuera y se ve");
  });

  it("applies a change from the history to the focused editable, keeps the caret, and marks it", () => {
    const doc = fixture();
    const live = settled(doc);
    const headline = live.querySelector<HTMLElement>('[data-id="el-headline"]');
    if (!headline) throw new Error("no headline");
    headline.setAttribute("contenteditable", "true");
    headline.textContent = "Taberna del Puerto";
    // The caret after «Taberna» — offset 7 in the plain text.
    const range = live.createRange();
    const textNode = headline.firstChild;
    if (!textNode) throw new Error("no text node");
    range.setStart(textNode, 7);
    range.collapse(true);
    live.getSelection()?.removeAllRanges();
    live.getSelection()?.addRange(range);

    const next = withHeadline(doc, "Taberna Santo Domingo");
    const report = patchCanvas(live, freshFrom(next), buildCss(next), {
      cause: "history",
      focused: headline,
    });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.deferred).toEqual([]);
    expect(headline.textContent?.trim()).toBe("Taberna Santo Domingo");
    expect(headline.getAttribute(HISTORY_TOUCHED_ATTRIBUTE)).toBe("1");
    const selection = live.getSelection();
    const after = selection?.getRangeAt(0);
    expect(after && headline.contains(after.startContainer)).toBe(true);
    expect(after?.startOffset).toBe(7);
  });

  it("applies the text's own mark to the focused editable, keeps the words selected, and marks it", () => {
    const doc = fixture();
    const live = settled(doc);
    const headline = live.querySelector<HTMLElement>('[data-id="el-headline"]');
    if (!headline) throw new Error("no headline");
    const text = headline.textContent ?? "";
    expect(text.length).toBeGreaterThan(6);
    headline.setAttribute("contenteditable", "true");
    // The first word, selected — the way the toolbar reads the words a mark is pressed on.
    const end = text.indexOf(" ") > 0 ? text.indexOf(" ") : text.length;
    const range = live.createRange();
    const textNode = headline.firstChild;
    if (!textNode) throw new Error("no text node");
    range.setStart(textNode, 0);
    range.setEnd(textNode, end);
    live.getSelection()?.removeAllRanges();
    live.getSelection()?.addRange(range);

    const next = applyMark(
      doc,
      { sectionId: "sec-cover", elementId: "el-headline" },
      { from: 0, to: end },
      "strong",
    );
    // Día 3's rule defers it: the headline has focus and is editable, and this is «an edit».
    const asEdit = patchCanvas(live, freshFrom(next), buildCss(next), {
      cause: "edit",
      focused: headline,
    });
    expect(asEdit.ok && asEdit.deferred.length).toBe(1);
    expect(headline.querySelector("strong")).toBeNull();

    // Named as the text's own mark, it goes through.
    const headline2 = headline;
    const report = patchCanvas(live, freshFrom(next), buildCss(next), {
      cause: "mark",
      focused: headline2,
    });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.deferred).toEqual([]);
    expect(headline2.querySelector("strong")?.textContent).toBe(text.slice(0, end));
    expect(headline2.textContent).toBe(text);
    expect(headline2.getAttribute(HISTORY_TOUCHED_ATTRIBUTE)).toBe("1");
    // The words are still the selection: the bar's own refresh will find them and light the mark.
    const selection = live.getSelection();
    expect(selection?.rangeCount).toBe(1);
    expect(selection?.toString()).toBe(text.slice(0, end));
    expect(headline2.contains(selection?.getRangeAt(0).startContainer ?? null)).toBe(true);
  });

  /**
   * **Why the chosen words are remembered as offsets and never as a `Range`** (David's adjustment 2
   * to the sprint 27 plan, día 3).
   *
   * The toolbar has to put the person's selection back after the patch its own press caused, and
   * the two shapes it could hold it in are not equally good: the patch that applies a mark splits
   * the text node those words live in, so a `Range` taken before it points at a node the document
   * no longer has, while `{ start, end }` in characters still names the same letters. This records,
   * patches, and asks both.
   */
  it("keeps the chosen words as offsets across a patch that replaces the text nodes, where a live Range loses them", () => {
    const doc = fixture();
    const live = settled(doc);
    const headline = live.querySelector<HTMLElement>('[data-id="el-headline"]');
    if (!headline) throw new Error("no headline");
    const text = headline.textContent ?? "";
    // The first seven letters, rather than the first word: the fixture's headline opens with a
    // two-letter one, and what this measures is the node under the offsets, not a word boundary.
    const end = Math.min(7, text.length);
    const word = text.slice(0, end);
    expect(word.length).toBe(7);
    headline.setAttribute("contenteditable", "true");
    const textNode = headline.firstChild;
    if (!textNode) throw new Error("no text node");
    const range = live.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, end);
    live.getSelection()?.removeAllRanges();
    live.getSelection()?.addRange(range);

    // Recorded the way `refresh()` records it, and held the way it must not be held.
    const recorded = selectionOffsetsIn(headline);
    expect(recorded).toEqual({ start: 0, end });
    const held = range.cloneRange();

    const next = applyMark(
      doc,
      { sectionId: "sec-cover", elementId: "el-headline" },
      { from: 0, to: end },
      "strong",
    );
    const report = patchCanvas(live, freshFrom(next), buildCss(next), {
      cause: "mark",
      focused: headline,
    });
    expect(report.ok).toBe(true);

    // The node those offsets were read from is gone — one text node became a `<strong>` and a
    // remainder — and the offsets still name the same letters.
    expect(headline.querySelector("strong")?.textContent).toBe(word);
    expect(headline.firstChild).not.toBe(textNode);
    expect(selectionOffsetsIn(headline)).toEqual(recorded);
    expect(live.getSelection()?.toString()).toBe(word);

    // And the `Range` that was held across it does not: either its container left the element or
    // it no longer covers the words. This is the sabotage of adjustment 2, run rather than argued.
    const stillThere = headline.contains(held.startContainer) && held.toString() === word;
    expect(stillThere, "a live Range survived the patch, so the offsets are not load-bearing").toBe(
      false,
    );
  });

  it("moves the faces into their own sheet on the first patch, and a change of palette never touches it", () => {
    // The menu fixture's theme names two shippable faces; `cover-and-services` names none.
    const doc = menuFixture();
    const live = liveFrom(doc);
    const css = buildCss(doc);
    expect(css).toContain("@font-face {");
    expect(live.querySelectorAll("head style").length).toBe(1);

    const first = patchCanvas(live, freshFrom(doc), css, rules);
    expect(first).toMatchObject({ ok: true, fontsChanged: true, cssChanged: true });
    const fonts = live.querySelector(`style[${FONT_CSS_ATTRIBUTE}]`);
    const page = live.querySelector(`style[${PAGE_CSS_ATTRIBUTE}]`);
    if (!fonts || !page) throw new Error("the two sheets are not there");
    // The faces' sheet comes first, holds every face and nothing else; the page's holds no face.
    expect(fonts.nextElementSibling).toBe(page);
    expect((fonts.textContent ?? "").match(/@font-face \{/g)?.length).toBe(
      css.match(/@font-face \{/g)?.length,
    );
    expect(page.textContent).not.toContain("@font-face");
    expect(page.textContent).toContain(":root {");
    const facesText = fonts.textContent;

    // A different palette: the page's sheet is rewritten, the faces' is not touched.
    const recoloured = parseDocument({
      ...structuredClone(doc),
      theme: { ...doc.theme, "color.primary": "#123456" },
    });
    const second = patchCanvas(live, freshFrom(recoloured), buildCss(recoloured), rules);
    expect(second).toMatchObject({ ok: true, cssChanged: true, fontsChanged: false });
    expect(fonts.textContent).toBe(facesText);
    expect(page.textContent).toContain("#123456");
    // Split and rebuilt, the two sheets together say exactly what one sheet said.
    const { fonts: wantFonts, page: wantPage } = splitFontFaces(buildCss(recoloured));
    expect((fonts.textContent ?? "").trim()).toBe(wantFonts);
    expect((page.textContent ?? "").trim()).toBe(wantPage);

    // The same document again: neither sheet moves.
    const third = patchCanvas(live, freshFrom(recoloured), buildCss(recoloured), rules);
    expect(third).toMatchObject({ ok: true, cssChanged: false, fontsChanged: false });
  });

  it("drops the menu's links the document dropped: folding a page back leaves one «Qué ponemos», in each strip", () => {
    const doc = menuFixture();
    const live = settled(doc);
    const before = [
      ...live.querySelectorAll(".rb-nav-wide a, .rb-nav-narrow a, .rb-nav-row a"),
    ].map((a) => a.getAttribute("href"));
    expect(before).toContain("./que-ponemos.html");
    // Every menu link keyed apart from its twins: the strip and the list are in the chain.
    const keys = [...live.querySelectorAll("nav a")].map((a) => keyOf(a));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toMatch(/^m:(wide|narrow)\/nav:[^/]+\/a:/);

    const folded = pageToSection(doc, "page-que-ponemos");
    const report = patchCanvas(live, freshFrom(folded), buildCss(folded), rules);
    expect(report).toMatchObject({ ok: true, structural: true });

    const expected = [
      ...freshFrom(folded).querySelectorAll(".rb-nav-wide a, .rb-nav-narrow a, .rb-nav-row a"),
    ].map((a) => a.getAttribute("href"));
    const after = [...live.querySelectorAll(".rb-nav-wide a, .rb-nav-narrow a, .rb-nav-row a")].map(
      (a) => a.getAttribute("href"),
    );
    expect(after).toEqual(expected);
    expect(after).not.toContain("./que-ponemos.html");
    // Twice: once in the wide bar and once in the phone's row (ADR 0057 — the sections no longer
    // fold into the disclosure, which holds the pages alone).
    expect(after.filter((href) => href === "#sec-services")).toHaveLength(2);
    // And the texts: the folded section is back in the bar once, under its kind's name («Servicios»,
    // ADR 0057 — the menu names a section by what it is, never by its heading), and the page it was
    // («Qué ponemos») is gone from the bar rather than kept beside it.
    const wide = [...live.querySelectorAll(".rb-nav-wide a")].map((a) => a.textContent?.trim());
    expect(wide.filter((label) => label === "Servicios")).toHaveLength(1);
    expect(wide).not.toContain("Qué ponemos");
  });

  it("patches a changed skeleton too and says so: a section gone, the chrome beside it kept", () => {
    const doc = fixture();
    const live = settled(doc);
    const sections = [...live.querySelectorAll("[data-section]")];
    expect(sections.length).toBeGreaterThan(1);
    const kept = sections[0] as Element;
    const gone = sections[sections.length - 1] as Element;
    // Chrome inside the section that stays, which a structural patch must leave where it is.
    const cluster = live.createElement("div");
    cluster.setAttribute(CHROME_ATTRIBUTE, "1");
    kept.prepend(cluster);

    const copy = structuredClone(doc);
    copy.pages[0]?.sections.pop();
    const next = parseDocument(copy);
    expect(skeletonOf(live.body)).not.toBe(skeletonOf(freshFrom(next)));

    const report = patchCanvas(live, freshFrom(next), buildCss(next), rules);
    expect(report).toMatchObject({ ok: true, structural: true, inserted: 0 });
    if (!report.ok) return;
    expect(report.removed).toBeGreaterThan(0);
    expect(gone.isConnected, "the removed section is still on the page").toBe(false);
    expect(kept.isConnected).toBe(true);
    expect(kept.firstElementChild).toBe(cluster);
    expect(live.querySelectorAll("[data-section]").length).toBe(sections.length - 1);
    expect(skeletonOf(live.body)).toBe(skeletonOf(freshFrom(next)));
  });

  it("inserts what the document gained, in its place, and reports it", () => {
    const doc = fixture();
    const fewer = structuredClone(doc);
    // The page starts one section short; the patch brings the full document back.
    const [dropped] = fewer.pages[0]?.sections.splice(0, 1) ?? [];
    if (!dropped) throw new Error("fixture shape");
    const live = settled(parseDocument(fewer));
    const before = live.querySelectorAll("[data-section]").length;

    const report = patchCanvas(live, freshFrom(doc), buildCss(doc), rules);
    expect(report).toMatchObject({ ok: true, structural: true });
    if (!report.ok) return;
    expect(report.inserted).toBeGreaterThan(0);
    const now = [...live.querySelectorAll("[data-section]")].map((el) =>
      el.getAttribute("data-section"),
    );
    expect(now.length).toBe(before + 1);
    expect(now[0]).toBe(dropped.id);
    expect(skeletonOf(live.body)).toBe(skeletonOf(freshFrom(doc)));
    // A second patch of the same document is a no-op: the structure settled in one.
    const again = patchCanvas(live, freshFrom(doc), buildCss(doc), rules);
    expect(again).toMatchObject({ ok: true, structural: false, inserted: 0, removed: 0 });
  });

  it("reports a plain text edit as not structural", () => {
    const doc = fixture();
    const live = settled(doc);
    const next = withHeadline(doc, "Otro titular");
    const report = patchCanvas(live, freshFrom(next), buildCss(next), rules);
    expect(report).toMatchObject({ ok: true, structural: false });
  });

  it("rewrites the page's stylesheet only when it changed, and marks it the first time", () => {
    const doc = fixture();
    const live = liveFrom(doc);
    const css = buildCss(doc);
    // The html target wrote `\n{css}\n`; the same css, trimmed, is no change.
    const first = patchCanvas(live, freshFrom(doc), css, rules);
    expect(first).toMatchObject({ ok: true, cssChanged: false });
    const style = live.querySelector(`style[${PAGE_CSS_ATTRIBUTE}]`);
    expect(style).not.toBeNull();

    const second = patchCanvas(live, freshFrom(doc), `${css}\n/* changed */`, rules);
    expect(second).toMatchObject({ ok: true, cssChanged: true });
    expect(style?.textContent?.trim().endsWith("/* changed */")).toBe(true);
    const third = patchCanvas(live, freshFrom(doc), `${css}\n/* changed */`, rules);
    expect(third).toMatchObject({ ok: true, cssChanged: false });
  });

  it("adds no empty text node, which the html target never has", () => {
    const doc = fixture();
    const live = settled(doc);
    const next = withHeadline(doc, "Sin nodos vacíos");
    patchCanvas(live, freshFrom(next), buildCss(next), rules);
    const walker = live.createTreeWalker(live.body, 0x4 /* SHOW_TEXT */);
    let node = walker.nextNode();
    while (node) {
      expect(node.nodeValue, "an empty text node").not.toBe("");
      node = walker.nextNode();
    }
  });
});
