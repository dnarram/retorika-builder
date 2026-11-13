/**
 * **What the hand carries leans the way it is carried** (sprint 36 día 7).
 *
 * Three things follow a hand across the canvas: the label of a menu being dragged (`.rb-menu-ghost`),
 * the row a phone's drag would move an element to (`.rb-ghost`), and the element picked up on a
 * desktop (`.rb-moving`). Each leans 2° toward where the hand is going — the sign of its horizontal
 * travel between two moves — and stands straight again once the hand has not travelled sideways for
 * `TILT_STILL_MS`, or lets go. The lean is a `data-tilt` the canvas's sheet draws as `rotate`, so it
 * composes with the `transform` a drag writes and the `translate` a drop settles by, and it is
 * chrome: taken off the element the moment the gesture ends.
 *
 * Nothing at all for somebody who asked for less movement — checked here, before anything is
 * written, besides the sheet's own reduced-motion rule.
 */

/** How long a ghost keeps leaning after the hand last travelled sideways: one `--ui-fast`. */
export const TILT_STILL_MS = 120;

/** Below this many pixels of sideways travel between two moves, the hand is not going sideways. */
export const TILT_DEAD_PX = 1;

export type Tilt = "left" | "right";

/** The way a ghost leans for a sideways travel of `dx` pixels, or none for a hand going straight. */
export function tiltOf(dx: number): Tilt | null {
  if (dx >= TILT_DEAD_PX) return "right";
  if (dx <= -TILT_DEAD_PX) return "left";
  return null;
}

export interface GhostTilt {
  /** The hand is at `x`, carrying `el`. */
  follow(el: HTMLElement, x: number): void;
  /** The gesture is over: whatever was leaning stands straight. */
  end(): void;
}

/**
 * One gesture's lean. A small sideways wobble keeps the lean it has — it is the still timer that
 * stands a ghost straight, not every move that is not sideways — so a hand going mostly up a phone's
 * page does not flicker its row between two angles.
 */
export function ghostTilt(view: Window | null | undefined): GhostTilt {
  const allowed =
    view !== null &&
    view !== undefined &&
    !view.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  let lastX: number | null = null;
  let leaning: HTMLElement | null = null;
  let still: number | undefined;
  const straighten = () => {
    if (still !== undefined) view?.clearTimeout(still);
    still = undefined;
    if (leaning) delete leaning.dataset["tilt"];
    leaning = null;
  };
  return {
    follow(el, x) {
      if (!allowed || !view) return;
      if (leaning && leaning !== el) straighten();
      const tilt = lastX === null ? null : tiltOf(x - lastX);
      lastX = x;
      if (tilt === null) return;
      el.dataset["tilt"] = tilt;
      leaning = el;
      if (still !== undefined) view.clearTimeout(still);
      still = view.setTimeout(straighten, TILT_STILL_MS);
    },
    end() {
      straighten();
      lastX = null;
    },
  };
}
