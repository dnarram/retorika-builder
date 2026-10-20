import type { Edge } from "./resizeBox.ts";

/**
 * **Where the touch handles go** (ADR 0050 §6, sprint 25 día 7), decided without a DOM.
 *
 * David's fourth condition when he chose the fine grid: «Redimensionar en táctil: asas solo sobre
 * el elemento elegido». A mouse needs none — a zone of six pixels around the border and a cursor
 * that changes in it is what Word does, and it keeps the canvas free of eight squares nobody asked
 * for (día 4). A finger cannot use a six-pixel zone at all: it is about eleven millimetres wide, so
 * the gesture has to be given something it can actually hit.
 *
 * **Forty-four pixels, which is the number the platforms agree on** (WCAG 2.5.5 asks for 44 × 44
 * and both Apple and Google say the same). The dot that is *drawn* is much smaller; what is 44 px
 * is the thing a finger has to land on.
 *
 * Two of David's adjustments live here, and both are about a handle that would otherwise be
 * unusable:
 *
 * - **A small element gets corners only.** Eight targets of 44 px on a button of 60 × 30 overlap
 *   each other and bury the button: the midpoint of a side would sit on top of both its corners. So
 *   a side offers its midpoint only when it is long enough to hold one between them.
 * - **At the section's edge they are drawn inward.** The canvas clips what leaves the page
 *   (`html, body { overflow-x: clip }`), so a handle centred on an element's left border — which is
 *   often the section's own left edge — would lose half of itself. Each target is clamped into the
 *   section, which moves it in rather than letting it vanish.
 */

/** The touch target, in CSS pixels. WCAG 2.5.5's number, and the platforms' own. */
export const HANDLE_TOUCH = 44;

/** One handle: which edge it pulls, and where its target's top-left sits inside the section. */
export interface HandleSpot {
  readonly edge: Edge;
  readonly left: number;
  readonly top: number;
}

/** A box inside the section's own border box, which is what `getBoundingClientRect` differences
 * give and what an absolutely positioned child is placed in. */
export interface HandleBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

/**
 * The handles for one element, in a fixed order: the four corners first, then the sides that have
 * room for a midpoint.
 *
 * The order is deterministic because the keyboard walks the chrome in document order and a set that
 * reshuffled itself would make Tab land somewhere different on every rebuild.
 */
export function handlesFor(args: {
  readonly box: HandleBox;
  /** The section's own border box, which the targets are clamped into. */
  readonly host: { readonly width: number; readonly height: number };
  readonly target?: number;
}): HandleSpot[] {
  const { box, host } = args;
  const size = args.target ?? HANDLE_TOUCH;
  const half = size / 2;

  /** A target centred on a point, then moved inward so none of it is clipped away. */
  const at = (edge: Edge, x: number, y: number): HandleSpot => ({
    edge,
    left: clamp(x - half, 0, Math.max(0, host.width - size)),
    top: clamp(y - half, 0, Math.max(0, host.height - size)),
  });

  const left = box.left;
  const right = box.left + box.width;
  const top = box.top;
  const bottom = box.top + box.height;
  const middleX = box.left + box.width / 2;
  const middleY = box.top + box.height / 2;

  const spots: HandleSpot[] = [
    at("nw", left, top),
    at("ne", right, top),
    at("sw", left, bottom),
    at("se", right, bottom),
  ];

  /**
   * **The midpoints need room in both directions, and the suite is what taught this.**
   *
   * The first version asked each side about its own length: a side offered its midpoint when it was
   * at least two targets long, so a text 528 × 52 got a top and a bottom one. Both are forty-four
   * pixels tall and centred on edges fifty-two apart, so between them they covered the box — and a
   * finger aiming at the middle of the element landed on a handle. **The element could no longer be
   * dragged at all, only resized**, which the sprint 24 touch walk caught by asking for a drag of
   * one column and getting nothing.
   *
   * So the test is the box's size and not one side's, which is also David's own sentence read
   * properly — «por debajo de un tamaño, solo esquinas» — and the number is the same forty-four
   * twice over: a midpoint pair takes a target's width off the middle of the box, so the box has to
   * be two targets across for what is left to still be a target the hand can hit.
   *
   * Below that, the four corners, which leave the middle of the box clear whenever it is wider than
   * one target. Smaller than that and the corners necessarily meet over it: a very small element is
   * moved from “Colocación” or with the arrows, and that is said in the ADR rather than solved by
   * withdrawing the only handles it has.
   */
  if (box.width >= size * 2 && box.height >= size * 2) {
    spots.push(
      at("top", middleX, top),
      at("bottom", middleX, bottom),
      at("left", left, middleY),
      at("right", right, middleY),
    );
  }
  return spots;
}
