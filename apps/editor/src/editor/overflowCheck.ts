import { render } from "@retorika/renderer";
import type { RetorikaDocument } from "@retorika/schema";
import { withFontUrls } from "./previewDocument.ts";

/**
 * The other half of the advanced dossier §4's pre-publish review: «una revisión avisa de contraste
 * insuficiente **o de desbordes por debajo de 320 píxeles**».
 *
 * Sprint 9 day 6 built the contrast half (`styleReview.ts`). This is the one that was left, and
 * ADR 0026 names it as the reason an exact `fontSize` was refused: «a size is the one value in this
 * vocabulary that can cause an overflow, and offering it behind a gate that cannot see what it
 * would cause is the shape of promise ADR 0026 exists to refuse». The gate can see it now.
 *
 * **This is not the browser harness, and the difference is the whole point.**
 * `packages/renderer/test/overflow.browser.test.ts` has measured overflow since sprint 2 — over
 * the *corpus*, in CI, at 320, 768 and 1280. That answers «do the compositions we ship fit». It
 * cannot answer «does **this owner's** document fit, **before this download**», which is what the
 * dossier promises and what a gate needs. `a11y.md` has carried that distinction since sprint 9.
 */

/** The number the dossier promises, so it is not negotiable downward. */
export const NARROWEST_WIDTH = 320;

/**
 * The renderer's only breakpoint: at or below this, a page is showing its phone layout.
 *
 * Restated here rather than imported because `packages/renderer` writes it into CSS text and
 * exports no constant, and `test/canvasZoom.test.ts` reads that source and fails if the two ever
 * disagree — the same way `AccountPage` restates the grace window and a test pins the pair.
 *
 * The editor needs it because the canvas *is* the viewport the preview's own media query reads:
 * a card narrower than this shows the phone layout while the device toggle still says desktop.
 */
export const PHONE_BREAKPOINT = 720;

/**
 * The narrowest the desktop canvas may be laid out at — one pixel past the breakpoint.
 *
 * This is «la mayor área de edición dentro de las posibilidades» as an actual number: the least
 * the preview has to be zoomed out to still be the desktop page. Anything wider zooms out more
 * than necessary; anything narrower is not the desktop page any more.
 */
export const NARROWEST_DESKTOP = PHONE_BREAKPOINT + 1;

/**
 * The width the desktop canvas lays out at, whatever the window (ADR 0061, sprint 31 día 1).
 *
 * It used to be «whatever room the panels leave, floored at `NARROWEST_DESKTOP`» — so the same
 * document was a different page at every window size and with every panel: at a 1440 window the
 * frame was 1168 wide with no panel and 948 with one, and a header rail that folds below 1024 would
 * have folded in the canvas the moment the owner chose it (measured 30 October 2026, the sprint 31
 * plan's table). The published site is measured at 1280 — the overflow suite, Lighthouse — so the
 * canvas shows that page and scales it to the room there is.
 */
export const DESKTOP_LAYOUT_WIDTH = 1280;

/**
 * The least the preview may be zoomed out to and still be read: David's floor, set on 26 October
 * 2026 while approving sprint 28 («fija un suelo de legibilidad, propongo 0,6»). Under it the canvas
 * gives up width rather than legibility (`desktopLayoutWidth`), and says so on the card.
 */
export const CANVAS_ZOOM_FLOOR = 0.6;

/**
 * The layout width for the room a desktop canvas has: `DESKTOP_LAYOUT_WIDTH` wherever that still
 * zooms at or above `CANVAS_ZOOM_FLOOR` (768 px of room and up), narrower where it would not — down
 * to the width the floor allows, never under `NARROWEST_DESKTOP`, which is the page still being the
 * desktop page. The two floors meet at 433 px of room; below that the desktop floor wins and the
 * zoom goes under 0.6, as it did before this function existed (a 768 tablet with a panel open).
 *
 * Measured on 30 October 2026 in Chromium before this was written: room 1008 / 788 at a 1280
 * window (no panel / «Menú»), 1168 / 948 at 1440, 1408 / 1188 at 1680, 752 / 532 at 1024 — so the
 * zooms this gives are 0.79 / 0.62, 0.91 / 0.74, 1 / 0.93, and 0.6 / 0.6 with the width lowered to
 * 1253 and 887.
 */
export function desktopLayoutWidth(available: number): number {
  return Math.min(DESKTOP_LAYOUT_WIDTH, Math.max(available / CANVAS_ZOOM_FLOOR, NARROWEST_DESKTOP));
}

/**
 * Half a pixel, and never more — the same tolerance the browser harness uses.
 *
 * Sub-pixel rounding puts a box a few hundredths past its parent on perfectly ordinary layouts,
 * and a gate that fires on that is a gate people learn to click through.
 */
const TOLERANCE = 0.5;

export interface OverflowFinding {
  pageId: string;
  /** The section the offending element sits in, when it is inside one. */
  sectionId?: string;
  /** What the person recognises it by: the words, when it has any. The audit in the «Fuera del
   * sistema» list earned this reasoning first — a finding that says `el-body-3` is one nobody can
   * act on. */
  label?: string;
  /** How far past the right edge, in pixels, rounded to a tenth. */
  over: number;
}

export interface OverflowProbe {
  /** The host document to build the hidden frame in. Injected rather than reached for, so the
   * measurement is testable and so nothing here assumes it runs in the top window. */
  hostDocument: Document;
  /**
   * The object URLs of the owner's own faces, by file (sprint 29 día 5). **The page is measured in
   * the letter it will be read in**: without them the frame asks the editor for
   * `fonts/propia-…`, gets a 404, and lays the page out in the fallback — a narrower or wider letter
   * than the owner's, so a heading that overflows in their font could be measured as fitting.
   */
  fontUrls?: ReadonlyMap<string, string>;
}

/**
 * Every page of this document, measured at 320 pixels.
 *
 * **One frame, reused for every page**, because creating and tearing one down per page is the
 * slowest part by a wide margin and this runs between a press and a download.
 *
 * **What is measured is an element's own right edge against the viewport**, not
 * `scrollWidth > clientWidth`. Sprint 8 day 7 paid to learn the difference: `scrollWidth` is
 * rounded to an integer and reports a page as fitting when a box is a fraction past the edge, and
 * it says nothing about *which* element is the problem — and a warning that cannot name the
 * element is one the owner cannot act on. The harness has measured it this way since sprint 2;
 * this is the same measurement, pointed at the owner's own document.
 */
export async function measureOverflow(
  doc: RetorikaDocument,
  probe: OverflowProbe,
): Promise<OverflowFinding[]> {
  const { hostDocument } = probe;
  const frame = hostDocument.createElement("iframe");
  // Off-screen rather than `display: none`: a frame that is not displayed does not lay out, and a
  // layout is the entire thing being asked for. The same reason the thumbnail frame is scaled
  // rather than hidden.
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = [
    `width: ${NARROWEST_WIDTH}px`,
    "height: 800px",
    "position: fixed",
    "left: -10000px",
    "top: 0",
    "border: 0",
    "visibility: hidden",
  ].join("; ");
  hostDocument.body.appendChild(frame);

  try {
    const findings: OverflowFinding[] = [];
    for (const page of doc.pages) {
      const html = withFontUrls(
        render(doc, "html", { pageId: page.id }).html,
        probe.fontUrls ?? new Map(),
      );
      const measured = await measureOne(frame, html);
      for (const one of measured) findings.push({ pageId: page.id, ...one });
    }
    return findings;
  } finally {
    frame.remove();
  }
}

type PageFinding = Omit<OverflowFinding, "pageId">;

function measureOne(frame: HTMLIFrameElement, html: string): Promise<PageFinding[]> {
  return new Promise((resolve) => {
    const done = () => {
      frame.removeEventListener("load", done);
      const inner = frame.contentDocument;
      // No document means the frame was torn down mid-measurement — a page change, or the editor
      // unmounting. Nothing to report is the honest answer; refusing the download would be a
      // warning about the editor rather than about the site.
      resolve(inner ? findOverflow(inner, NARROWEST_WIDTH) : []);
    };
    frame.addEventListener("load", done);
    frame.srcdoc = html;
  });
}

/**
 * Exported for the tests, which run this against a real page in a real browser rather than
 * against a mock of one — the only way to check a claim about layout.
 */
/** Whether an ancestor below `<body>` clips this element's sideways overflow by scrolling it. */
export function insideScroller(el: Element, inner: Document): boolean {
  const view = inner.defaultView;
  if (!view) return false;
  for (let node = el.parentElement; node && node !== inner.body; node = node.parentElement) {
    const overflowX = view.getComputedStyle(node).overflowX;
    if (overflowX === "auto" || overflowX === "scroll") return true;
  }
  return false;
}

export function findOverflow(inner: Document, width: number): PageFinding[] {
  const findings: PageFinding[] = [];
  const seen = new Set<string>();

  for (const el of inner.querySelectorAll("body *")) {
    const right = el.getBoundingClientRect().right;
    if (right <= width + TOLERANCE) continue;
    // **Inside a strip that scrolls sideways on purpose, nothing is past the edge** (ADR 0057): the
    // header's row of sections on a phone is `overflow-x: auto`, its entries run past 320px by
    // design and the visitor drags them in, and the page itself does not scroll — the row clips
    // them. Measured before this clause: a generated site's four entries put the row's last link at
    // 380px and the gate refused the download of a page that scrolled nowhere. The container
    // itself is still judged, so a strip wider than the screen is still a finding.
    if (insideScroller(el, inner)) continue;

    const section = el.closest("[data-section]")?.getAttribute("data-section") ?? undefined;
    // One finding per section, not per element: a section that overflows usually overflows in
    // several of its children at once, and a dialog listing nine rows for one cause is a dialog
    // nobody reads. The first one is the one named, which is the outermost in document order.
    const key = section ?? `#${findings.length}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");
    findings.push({
      ...(section === undefined ? {} : { sectionId: section }),
      ...(text === "" ? {} : { label: text.length > 60 ? `${text.slice(0, 57)}…` : text }),
      over: Math.round((right - width) * 10) / 10,
    });
  }

  return findings;
}
