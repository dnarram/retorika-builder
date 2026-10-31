// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  atOrAboveReading,
  keepReadingPoint,
  readingPointOf,
  readingSectionOf,
} from "../src/editor/readingPoint.ts";

/**
 * The reading point of a patch (sprint 31 día 1): what is read before, and what is done after.
 *
 * Geometry is the browser's, so the boxes here are given rather than laid out — `happy-dom` lays
 * nothing out — and the walk «escalar una sección a media página no la mueve en pantalla» is what
 * measures the real thing in Chromium. What is pinned here is the logic around the boxes: which
 * section is the reading one, when there is none, which side of it a bar lands on, and when the
 * scroll is moved and by how much.
 */

function page(tops: readonly number[], height = 300): Document {
  document.body.innerHTML = tops
    .map((_, index) => `<section data-section="sec-${index}"></section>`)
    .join("");
  for (const [index, top] of tops.entries()) {
    const section = document.querySelector<HTMLElement>(`[data-section="sec-${index}"]`);
    if (!section) throw new Error("no section");
    section.getBoundingClientRect = () =>
      ({ top, bottom: top + height, left: 0, right: 100, width: 100, height }) as DOMRect;
  }
  return document;
}

function scrolledTo(y: number): void {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true });
}

describe("the reading point", () => {
  it("is the first section whose bottom is inside the view, with its top", () => {
    scrolledTo(500);
    // The first ends above the view; the second is being read, its start 120 px above the top.
    expect(readingPointOf(page([-500, -120, 180]))).toEqual({ sectionId: "sec-1", top: -120 });
  });

  it("is nothing at the very top of the page, where an arrival is meant to be seen", () => {
    scrolledTo(0);
    expect(readingPointOf(page([0, 300]))).toBeNull();
  });

  it("is nothing when the patch took its section away", () => {
    scrolledTo(500);
    const doc = page([-120, 180]);
    expect(readingSectionOf(doc, { sectionId: "sec-gone", top: -120 })).toBeNull();
    expect(keepReadingPoint(doc, { sectionId: "sec-gone", top: -120 })).toBe(0);
  });
});

describe("a bar arriving at or above the reading point", () => {
  it("is at it, or above it, by the page's order", () => {
    scrolledTo(500);
    const doc = page([-500, -120, 180]);
    const reading = readingSectionOf(doc, { sectionId: "sec-1", top: -120 });
    const [first, second, third] = [...doc.querySelectorAll("[data-section]")];
    expect(atOrAboveReading(first as Element, reading)).toBe(true);
    expect(atOrAboveReading(second as Element, reading)).toBe(true);
    expect(atOrAboveReading(third as Element, reading)).toBe(false);
  });

  it("is nowhere when nothing is being read", () => {
    const doc = page([0]);
    expect(atOrAboveReading(doc.querySelector("[data-section]") as Element, null)).toBe(false);
  });
});

describe("putting the reading point back", () => {
  it("scrolls by however far its section moved", () => {
    scrolledTo(500);
    const doc = page([-500, -120 + 44, 180]);
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    // A 44 px bar arrived above the section being read, which now starts 44 px lower.
    expect(keepReadingPoint(doc, { sectionId: "sec-1", top: -120 })).toBe(44);
    expect(scrollBy).toHaveBeenCalledWith(0, 44);
    scrollBy.mockRestore();
  });

  it("leaves under half a pixel alone, which is rounding and not a move", () => {
    scrolledTo(500);
    const doc = page([-500, -120.3, 180]);
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
    expect(keepReadingPoint(doc, { sectionId: "sec-1", top: -120 })).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
    scrollBy.mockRestore();
  });

  it("does nothing without a point", () => {
    expect(keepReadingPoint(page([0]), null)).toBe(0);
  });
});
