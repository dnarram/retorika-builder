import { MARK_HEIGHT, MARK_WIDTH } from "../editor/buildingMarkPaths.ts";

/**
 * Where the mark sits inside the lockup, so the landing can animate that half of its own logo
 * (sprint 22 day 3).
 *
 * **The two traced vectors are the same drawing.** `docs/design/brand/README.md`: «La marca dentro
 * del lockup es píxel a píxel la misma que la suelta, desplazada (10, 4), comprobado antes de
 * reutilizar el trazado» — and it is literally true in the files, which is what makes this
 * possible at all: the first curve of `retorika-mark.svg` begins `M178.5 113.68` and the same
 * curve in `retorika-lockup.svg` begins `M188.5 117.68`. Identical Béziers, moved ten right and
 * four down. So an animated mark drawn at this offset and scale lands exactly on the lockup's own,
 * with no registration to eyeball and nothing to drift when somebody re-runs `pnpm brand:vector`.
 *
 * `test/landingMark.test.ts` reads both SVGs and fails if that ever stops being true, because the
 * failure would otherwise be a logo with two overlapping «R»s on the one page whose whole job is
 * to say who this is.
 */

/** The delivered lockup's own pixels, which are its `viewBox` and its intrinsic size. */
export const LOCKUP = { width: 898, height: 254 } as const;

/** The offset of the mark's drawing inside that lockup. */
export const MARK_IN_LOCKUP = { x: 10, y: 4 } as const;

/** What the landing draws the lockup at — the figure `test/brandAssets.test.ts` knows. */
export const LANDING_LOCKUP_WIDTH = 232;

export interface MarkOverlay {
  /** The lockup's drawn height at this width, so the box reserves its space exactly. */
  lockupHeight: number;
  /** The animated mark's drawn width; its height follows from the mark's own ratio. */
  markWidth: number;
  /** Where to put it, in drawn pixels from the lockup box's top left. */
  left: number;
  top: number;
  /**
   * How much of the lockup to hide from the left, in drawn pixels: everything up to the right edge
   * of the mark's drawing. Past this point is the gap before «Retorika», so a fraction of a pixel
   * either way falls in whitespace rather than on a glyph.
   */
  hideLeft: number;
}

/** The composition, at whatever width the lockup is drawn. */
export function markOverlay(lockupWidth: number): MarkOverlay {
  const scale = lockupWidth / LOCKUP.width;
  return {
    lockupHeight: LOCKUP.height * scale,
    markWidth: MARK_WIDTH * scale,
    left: MARK_IN_LOCKUP.x * scale,
    top: MARK_IN_LOCKUP.y * scale,
    hideLeft: (MARK_IN_LOCKUP.x + MARK_WIDTH) * scale,
  };
}

/** The mark's own aspect, for a drawn height from a drawn width. */
export function markHeight(markWidth: number): number {
  return (markWidth * MARK_HEIGHT) / MARK_WIDTH;
}
