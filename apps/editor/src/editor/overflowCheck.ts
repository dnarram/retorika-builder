import { render } from "@retorika/renderer";
import type { RetorikaDocument } from "@retorika/schema";

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
      const { html } = render(doc, "html", { pageId: page.id });
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
export function findOverflow(inner: Document, width: number): PageFinding[] {
  const findings: PageFinding[] = [];
  const seen = new Set<string>();

  for (const el of inner.querySelectorAll("body *")) {
    const right = el.getBoundingClientRect().right;
    if (right <= width + TOLERANCE) continue;

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
