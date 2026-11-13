import { describe, expect, it } from "vitest";
import { DRAG_THRESHOLD } from "../src/editor/barPosition.ts";
import {
  arcRows,
  DOT_RADIUS,
  DOT_RING_RADIUS,
  dotPositions,
  FAN_GRACE_MS,
  FAN_HALF_ARC_DEG,
  FAN_MIN_RADIUS,
  fanFits,
  HUB_CENTER_X,
  HUB_DISC,
  HUB_INTENT_MS,
  HUB_INTENT_SLOP,
  HUB_STRIP,
  hullClip,
  overlaps,
  PILL_GAP,
  TOOL_PILL,
  toolsRing,
} from "../src/editor/radialMenu.ts";

/**
 * The radial menu's geometry (ADR 0072, sprint 37 día 2). What the walks compare the drawn boxes
 * with, so every property is asserted here from the boxes themselves — no number of the table in
 * the plan is copied in: a copied number agrees with a wrong module.
 */

/** The rail's tools as the shell lists them: six, and eight with the design tools on. */
const SIX = ["sections", "style", "pages", "menu", "share", "photos"];
const EIGHT = [...SIX, "design", "collections"];

describe("the tools ring", () => {
  for (const ids of [SIX, EIGHT]) {
    describe(`with ${ids.length} tools`, () => {
      const fan = toolsRing(ids);

      it("keeps the rail's order, top to bottom", () => {
        expect(fan.spokes.map((spoke) => spoke.id)).toEqual(ids);
        for (let i = 1; i < fan.spokes.length; i += 1) {
          expect(fan.spokes[i]?.top).toBeGreaterThan(fan.spokes[i - 1]?.top ?? Infinity);
        }
      });

      it("never brings two pills closer than their gap", () => {
        const close: string[] = [];
        for (const [i, a] of fan.spokes.entries()) {
          for (const b of fan.spokes.slice(i + 1)) {
            if (overlaps(a, b)) close.push(`${a.id} × ${b.id}`);
          }
        }
        expect(close, JSON.stringify(fan.spokes)).toEqual([]);
        expect(fan.pitch).toBeGreaterThanOrEqual(TOOL_PILL.height + PILL_GAP);
      });

      it("sits every pill on the arc, inside ±70°, symmetric about the hub", () => {
        for (const spoke of fan.spokes) {
          const y = spoke.top + spoke.height / 2 - fan.hubY;
          const x = spoke.left - fan.hubX;
          // On the arc, within the half pixel the left edge was rounded by.
          expect(Math.abs(Math.hypot(x, y) - fan.radius), spoke.id).toBeLessThanOrEqual(0.5);
          expect(Math.abs(spoke.angle), spoke.id).toBeLessThanOrEqual(FAN_HALF_ARC_DEG);
        }
        const angles = fan.spokes.map((spoke) => spoke.angle);
        expect(angles.map((a) => -a).reverse()).toEqual(angles);
        expect(fan.radius).toBeGreaterThanOrEqual(FAN_MIN_RADIUS);
      });

      it("keeps every pill right of the hub's disc and inside the fan's box", () => {
        for (const spoke of fan.spokes) {
          expect(spoke.left, spoke.id).toBeGreaterThan(HUB_CENTER_X + HUB_DISC / 2);
          expect(spoke.left + spoke.width).toBeLessThanOrEqual(fan.width);
          expect(spoke.top).toBeGreaterThanOrEqual(0);
          expect(spoke.top + spoke.height).toBeLessThanOrEqual(fan.height);
        }
        expect(fan.hubX).toBe(HUB_CENTER_X);
        expect(fan.hubY).toBe(fan.height / 2);
      });

      it("draws its hull around every corner of every pill, and clips by it", () => {
        for (const spoke of fan.spokes) {
          for (const [x, y] of [
            [spoke.left, spoke.top],
            [spoke.left + spoke.width, spoke.top],
            [spoke.left, spoke.top + spoke.height],
            [spoke.left + spoke.width, spoke.top + spoke.height],
          ] as const) {
            expect(Math.hypot(x - fan.hubX, y - fan.hubY), spoke.id).toBeLessThan(fan.hull);
          }
        }
        expect(hullClip(fan)).toBe(`circle(${fan.hull}px at ${fan.hubX}px ${fan.hubY}px)`);
        // And it leaves the box's far corners out: outside the hull is the page, not the fan.
        expect(Math.hypot(fan.width - fan.hubX, fan.hubY)).toBeGreaterThan(fan.hull);
      });

      it("is the same fan every time, in whole pixels", () => {
        expect(toolsRing(ids)).toEqual(fan);
        for (const spoke of fan.spokes) {
          for (const n of [spoke.left, spoke.top, spoke.width, spoke.height]) {
            expect(Number.isInteger(n)).toBe(true);
          }
        }
        expect(Number.isInteger(fan.width) && Number.isInteger(fan.height)).toBe(true);
        expect(Number.isInteger(fan.hull)).toBe(true);
        console.log(
          `[radialMenu] ${ids.length} tools: radius ${fan.radius}, pitch ${fan.pitch}, box ${fan.width} × ${fan.height}, hull ${fan.hull}`,
        );
      });
    });
  }

  it("needs a larger radius for more tools, and never less than the floor", () => {
    expect(toolsRing(EIGHT).radius).toBeGreaterThan(toolsRing(SIX).radius);
    expect(arcRows(1, TOOL_PILL.height).radius).toBe(FAN_MIN_RADIUS);
  });

  it("fits the eight-tool fan in the shortest studio row there is, and says when one does not", () => {
    const fan = toolsRing(EIGHT);
    // A 1024 × 600 window leaves the row 542 px under the header (sprint 37 plan).
    expect(fanFits(fan, 542)).toBe(true);
    expect(fanFits(fan, fan.height + 15)).toBe(false);
  });
});

describe("the hub", () => {
  it("draws its dots inside the strip, clear of its disc, one per tool", () => {
    for (const count of [6, 8]) {
      const dots = dotPositions(count);
      expect(dots).toHaveLength(count);
      for (const dot of dots) {
        const from = Math.hypot(dot.x, dot.y);
        expect(from - DOT_RADIUS).toBeGreaterThan(HUB_DISC / 2);
        expect(Math.abs(dot.x) + DOT_RADIUS).toBeLessThanOrEqual(HUB_STRIP / 2);
      }
      expect(dots[0]).toEqual({ x: 0, y: -DOT_RING_RADIUS });
    }
  });

  it("waits for intent and grants grace inside the interaction cap, with the drag's own slop", () => {
    // Named here, and read by name by the shell (`motionBudget.test.ts`), never written as numbers.
    expect(HUB_INTENT_MS).toBe(100);
    expect(FAN_GRACE_MS).toBe(150);
    expect(HUB_INTENT_MS).toBeLessThanOrEqual(200);
    expect(FAN_GRACE_MS).toBeLessThanOrEqual(200);
    expect(HUB_INTENT_SLOP).toBe(DRAG_THRESHOLD);
  });
});
