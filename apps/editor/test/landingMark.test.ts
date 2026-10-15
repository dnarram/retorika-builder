import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LANDING_LOCKUP_WIDTH,
  LOCKUP,
  MARK_IN_LOCKUP,
  markHeight,
  markOverlay,
} from "../src/app/landingMark.ts";
import { MARK_HEIGHT, MARK_WIDTH } from "../src/editor/buildingMarkPaths.ts";

/**
 * **The claim the landing's animated logo rests on, checked against the files rather than against
 * the sentence in the README** (sprint 22 day 3).
 *
 * The landing draws the delivered lockup and animates the mark half of it, by hiding that half and
 * putting `BuildingMark` exactly where it was. That only works because the two traced vectors are
 * the same drawing ten pixels and four pixels apart. Both files are **generated** — `pnpm
 * brand:vector` writes them from the delivered PNGs — so «the same drawing» is a property that a
 * retrace could quietly end, and the symptom would be two overlapping «R»s on the one page whose
 * whole job is to say who this is.
 */

const BRAND = join(import.meta.dirname, "..", "..", "..", "docs", "design", "brand");

function svg(name: string): string {
  return readFileSync(join(BRAND, name), "utf8");
}

/** The first `moveto` of the file's first clipped path — the same curve in both drawings. */
function firstCurve(source: string): { x: number; y: number } {
  const found = source.match(/<clipPath id="rb-r"><path d="M([\d.]+) ([\d.]+)/);
  if (!found) throw new Error("the traced SVG has no `rb-r` clip path to compare");
  return { x: Number(found[1]), y: Number(found[2]) };
}

describe("the mark inside the lockup", () => {
  it("is the same drawing, moved by the offset the landing uses", () => {
    const mark = firstCurve(svg("retorika-mark.svg"));
    const lockup = firstCurve(svg("retorika-lockup.svg"));
    expect(lockup.x - mark.x).toBeCloseTo(MARK_IN_LOCKUP.x, 6);
    expect(lockup.y - mark.y).toBeCloseTo(MARK_IN_LOCKUP.y, 6);
  });

  it("is drawn at the sizes this module states", () => {
    // Read off the `viewBox`, so a retrace at another size is a failure here rather than a logo
    // drawn at the wrong scale on a public page.
    expect(svg("retorika-mark.svg")).toContain(`viewBox="0 0 ${MARK_WIDTH} ${MARK_HEIGHT}"`);
    expect(svg("retorika-lockup.svg")).toContain(`viewBox="0 0 ${LOCKUP.width} ${LOCKUP.height}"`);
  });
});

describe("the landing's composition", () => {
  const overlay = markOverlay(LANDING_LOCKUP_WIDTH);

  it("puts the animated mark exactly where the drawn one was", () => {
    const scale = LANDING_LOCKUP_WIDTH / LOCKUP.width;
    expect(overlay.left).toBeCloseTo(MARK_IN_LOCKUP.x * scale, 6);
    expect(overlay.top).toBeCloseTo(MARK_IN_LOCKUP.y * scale, 6);
    expect(overlay.markWidth).toBeCloseTo(MARK_WIDTH * scale, 6);
    // 66px at 232 wide, which is the height `page.tsx` has always reserved for the lockup.
    expect(Math.round(overlay.lockupHeight)).toBe(66);
  });

  it("hides exactly the mark, and cuts in the gap before the wordmark", () => {
    // The seam is the right edge of the mark's drawing. Everything to its right is whitespace
    // until «Retorika» starts, so a sub-pixel error lands on nothing.
    expect(overlay.hideLeft).toBeGreaterThan(overlay.left + overlay.markWidth - 0.001);
    expect(overlay.hideLeft).toBeLessThan(LANDING_LOCKUP_WIDTH / 2);
  });

  it("keeps the mark's own proportions", () => {
    expect(markHeight(MARK_WIDTH)).toBe(MARK_HEIGHT);
    expect(markHeight(overlay.markWidth) / overlay.markWidth).toBeCloseTo(
      MARK_HEIGHT / MARK_WIDTH,
      6,
    );
  });
});
