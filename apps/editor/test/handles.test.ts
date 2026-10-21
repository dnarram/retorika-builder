import { describe, expect, it } from "vitest";
import { HANDLE_TOUCH, handlesFor } from "../src/editor/handles.ts";

/**
 * Where the touch handles go (ADR 0050 §6, sprint 25 día 7), as arithmetic.
 *
 * Both of David's adjustments about them are here, and both are about a handle that would
 * otherwise be unusable: a small element gets corners only, and at the section's edge they are
 * drawn inward rather than clipped away.
 */

/** A section of the editor's canvas at a window of 1440: 1168 wide, and tall enough. */
const host = { width: 1168, height: 600 };

/** Every spot, by the edge it pulls, for reading an assertion out loud. */
const byEdge = (spots: ReturnType<typeof handlesFor>) =>
  Object.fromEntries(spots.map((spot) => [spot.edge, { left: spot.left, top: spot.top }]));

describe("handlesFor", () => {
  it("gives a roomy element eight, centred on its corners and its sides", () => {
    const box = { left: 200, top: 100, width: 400, height: 200 };
    const spots = handlesFor({ box, host });
    expect(spots).toHaveLength(8);
    const half = HANDLE_TOUCH / 2;
    expect(byEdge(spots)).toEqual({
      nw: { left: 200 - half, top: 100 - half },
      ne: { left: 600 - half, top: 100 - half },
      sw: { left: 200 - half, top: 300 - half },
      se: { left: 600 - half, top: 300 - half },
      top: { left: 400 - half, top: 100 - half },
      bottom: { left: 400 - half, top: 300 - half },
      left: { left: 200 - half, top: 200 - half },
      right: { left: 600 - half, top: 200 - half },
    });
  });

  /**
   * **A small element gets corners only** — David's adjustment 6. Eight targets of 44 px on a
   * button of 60 × 30 would overlap each other and bury the button: the midpoint of each side
   * would sit on top of both of its corners.
   */
  it("gives a button of 60×30 its four corners and nothing else", () => {
    const spots = handlesFor({ box: { left: 48, top: 400, width: 60, height: 30 }, host });
    expect(spots.map((spot) => spot.edge)).toEqual(["nw", "ne", "sw", "se"]);
  });

  /**
   * **Room in one direction is not room**, and this is the assertion the suite had to teach.
   *
   * A version that asked each side about its own length gave a text of 528 × 52 a top and a bottom
   * midpoint — both forty-four pixels tall, centred on edges fifty-two apart, so between them they
   * covered the element and a finger aiming at its middle landed on a handle instead. The element
   * stopped being draggable, which the sprint 24 touch walk found by asking for a drag and getting
   * nothing. Neither shape below gets a midpoint.
   */
  it("gives nothing but corners to a box that is roomy in one direction only", () => {
    const tall = handlesFor({ box: { left: 100, top: 50, width: 60, height: 300 }, host });
    expect(tall.map((spot) => spot.edge)).toEqual(["nw", "ne", "sw", "se"]);
    const wide = handlesFor({ box: { left: 100, top: 50, width: 528, height: 52 }, host });
    expect(wide.map((spot) => spot.edge)).toEqual(["nw", "ne", "sw", "se"]);
  });

  it("takes a box of exactly two targets each way, and refuses one pixel less", () => {
    const exact = handlesFor({
      box: { left: 0, top: 0, width: HANDLE_TOUCH * 2, height: HANDLE_TOUCH * 2 },
      host,
    });
    expect(exact).toHaveLength(8);
    // One pixel short in **either** direction is short: what the midpoints leave in the middle of
    // the box has to be a target too.
    for (const box of [
      { left: 0, top: 0, width: HANDLE_TOUCH * 2 - 1, height: HANDLE_TOUCH * 2 },
      { left: 0, top: 0, width: HANDLE_TOUCH * 2, height: HANDLE_TOUCH * 2 - 1 },
    ]) {
      expect(handlesFor({ box, host }).map((spot) => spot.edge)).toEqual(["nw", "ne", "sw", "se"]);
    }
  });

  /**
   * **And the middle of the box stays free**, which is what the rule above is actually protecting:
   * a chosen element is dragged by its middle on touch (ADR 0049 §7 — tap to choose, then drag), so
   * a handle over that point takes the gesture away from the element it belongs to.
   */
  it("leaves the middle of the box clear of every handle", () => {
    for (const box of [
      { left: 200, top: 100, width: 400, height: 200 },
      { left: 100, top: 50, width: 528, height: 52 },
      { left: 48, top: 400, width: 272, height: 36 },
      { left: 100, top: 50, width: 60, height: 300 },
    ]) {
      const middle = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      for (const spot of handlesFor({ box, host })) {
        const over =
          middle.x >= spot.left &&
          middle.x <= spot.left + HANDLE_TOUCH &&
          middle.y >= spot.top &&
          middle.y <= spot.top + HANDLE_TOUCH;
        expect(over, `el asa ${spot.edge} tapa el centro de ${JSON.stringify(box)}`).toBe(false);
      }
    }
  });

  /**
   * **At the section's edge they are drawn inward** — the other half of adjustment 6. The canvas
   * clips what leaves the page, so a target centred on an element's left border, which is often the
   * section's own left edge, would lose half of itself.
   */
  it("draws a handle inward instead of letting the canvas clip it", () => {
    const spots = handlesFor({ box: { left: 0, top: 0, width: 400, height: 200 }, host });
    for (const spot of spots) {
      expect(spot.left, spot.edge).toBeGreaterThanOrEqual(0);
      expect(spot.top, spot.edge).toBeGreaterThanOrEqual(0);
    }
    expect(byEdge(spots).nw).toEqual({ left: 0, top: 0 });
  });

  it("draws the far side inward too, so nothing hangs off the right or the bottom", () => {
    const spots = handlesFor({
      box: { left: host.width - 400, top: host.height - 200, width: 400, height: 200 },
      host,
    });
    for (const spot of spots) {
      expect(spot.left + HANDLE_TOUCH, spot.edge).toBeLessThanOrEqual(host.width);
      expect(spot.top + HANDLE_TOUCH, spot.edge).toBeLessThanOrEqual(host.height);
    }
  });

  it("survives a section smaller than a handle rather than placing one outside it", () => {
    // Nothing in the product makes a section this small; the clamp must not invert when it is.
    const spots = handlesFor({
      box: { left: 0, top: 0, width: 10, height: 10 },
      host: { width: 20, height: 20 },
    });
    for (const spot of spots) {
      expect(spot.left).toBe(0);
      expect(spot.top).toBe(0);
    }
  });

  it("is forty-four pixels, which is the number WCAG 2.5.5 and both platforms agree on", () => {
    expect(HANDLE_TOUCH).toBe(44);
  });
});
