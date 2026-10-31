/**
 * **The reading point of the canvas across a patch** (sprint 31 día 1): the section at the top of
 * the view, and how far from the frame's top it is.
 *
 * The browser's scroll anchoring was what kept it, and measured, it does not: escalating a section
 * mid-page moved it 49 px once the section fit inside the frame's viewport (see `readingPoint` in
 * `Editor.tsx` for the measurements, and ADR 0061 for why that became every laptop's case). Safari
 * has no scroll anchoring at all. So the editor takes the point before a patch and puts it back
 * after the chrome is drawn.
 */

export interface ReadingPoint {
  sectionId: string;
  /** The section's top against the frame's viewport, in the frame's pixels — negative when its
   * start is above the view, which is the usual case for a section being read. */
  top: number;
}

/**
 * The first section whose bottom is inside the view, and where its top is — or `null` when the page
 * is at its very top, where there is nothing to give and an arrival is meant to be seen.
 */
export function readingPointOf(doc: Document): ReadingPoint | null {
  const view = doc.defaultView;
  if (!view || view.scrollY <= 0) return null;
  for (const section of doc.querySelectorAll<HTMLElement>("[data-section]")) {
    const box = section.getBoundingClientRect();
    const sectionId = section.dataset["section"];
    if (box.bottom > 0 && sectionId) return { sectionId, top: box.top };
  }
  return null;
}

/** The section of a reading point, in this document — `null` when the patch removed it. */
export function readingSectionOf(doc: Document, point: ReadingPoint | null): HTMLElement | null {
  if (!point) return null;
  return doc.querySelector<HTMLElement>(`[data-section="${CSS.escape(point.sectionId)}"]`);
}

/**
 * Whether `element` sits at or above the reading point in the page's order — so that something
 * inserted before it lands above what is being read.
 */
export function atOrAboveReading(element: Element, reading: HTMLElement | null): boolean {
  if (!reading) return false;
  // DOCUMENT_POSITION_FOLLOWING: `reading` comes after `element`. Written as its value because
  // `Node` would be the editor's realm and `element` is the frame's.
  return element === reading || (element.compareDocumentPosition(reading) & 4) !== 0;
}

/**
 * Put the reading point back: scroll by however far its section moved. Returns the distance, for
 * the probe. Under half a pixel is left alone — that is rounding, not a move anybody sees.
 */
export function keepReadingPoint(doc: Document, point: ReadingPoint | null): number {
  const section = readingSectionOf(doc, point);
  const view = doc.defaultView;
  if (!point || !section || !view) return 0;
  const moved = section.getBoundingClientRect().top - point.top;
  if (Math.abs(moved) < 0.5) return 0;
  view.scrollBy(0, moved);
  return Math.round(moved * 10) / 10;
}
