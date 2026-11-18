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
  INNER_ARC_SECTIONS,
  INNER_PILL,
  overlaps,
  PILL_GAP,
  SECOND_ARC_GAP,
  SECTION_PILL,
  SECTIONS_CAP,
  SINGLE_ARC_MAX,
  sectionsRing,
  TOOL_PILL,
  TOOLS_SPOKE,
  toolsRing,
} from "../src/editor/radialMenu.ts";
import { RAIL_ORDER, STUDIO_TOOLS } from "../src/editor/railLayout.ts";

/**
 * The radial menu's geometry (ADR 0072, sprint 37 día 2). What the walks compare the drawn boxes
 * with, so every property is asserted here from the boxes themselves — no number of the table in
 * the plan is copied in: a copied number agrees with a wrong module.
 */

/** The rail's tools as the shell lists them: six, and eight with the design tools on — read from
 * `RAIL_ORDER` and never copied (sprint 39 día 2): a copied order agrees with a wrong rail. */
const SIX: string[] = [...RAIL_ORDER];
const EIGHT: string[] = [...RAIL_ORDER, ...STUDIO_TOOLS];

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

/** `count` section ids, as a page would give them. */
const sections = (count: number) => Array.from({ length: count }, (_, i) => `sec-${i + 1}`);

/** Every pair of pills closer than their gap, by id — empty is the only passing answer. */
function crowded(fan: {
  spokes: { id: string; left: number; top: number; width: number; height: number }[];
}) {
  const out: string[] = [];
  for (const [i, a] of fan.spokes.entries()) {
    for (const b of fan.spokes.slice(i + 1)) if (overlaps(a, b)) out.push(`${a.id} × ${b.id}`);
  }
  return out;
}

/** The `index`-th of a list, or a failure that says which: no `!` that would pass on `undefined`. */
function nth<T>(list: readonly T[], index: number): T {
  const found = list[index];
  if (found === undefined) throw new Error(`nothing at ${index} of ${list.length}`);
  return found;
}

/** The hub's own box, from its centre: the 44 px disc and the word under it, the strip's width. */
const HUB_BOX = { left: 0, top: -HUB_DISC / 2, width: HUB_STRIP, height: 66 };

describe("the sections ring (sprint 37 día 4, ADR 0073)", () => {
  describe("on the subject David named: a page of twelve sections", () => {
    const fan = sectionsRing(sections(12));

    it("is two arcs: eight inside, four and the way back outside, 56 px further out", () => {
      expect(fan).not.toBeNull();
      if (!fan) return;
      expect(fan.spokes).toHaveLength(13);
      const inner = fan.spokes.slice(0, INNER_ARC_SECTIONS);
      const outer = fan.spokes.slice(INNER_ARC_SECTIONS);
      expect(inner.map((s) => s.id)).toEqual(sections(8));
      expect(outer.map((s) => s.id)).toEqual([...sections(12).slice(8), TOOLS_SPOKE]);
      for (const spoke of inner)
        expect([spoke.width, spoke.height]).toEqual([INNER_PILL.width, INNER_PILL.height]);
      for (const spoke of outer)
        expect([spoke.width, spoke.height]).toEqual([SECTION_PILL.width, SECTION_PILL.height]);
      // The two radii, read back from the pills themselves rather than from the module's numbers:
      // an inner pill sits on its arc by its middle, an outer one by its left edge.
      const from = (x: number, top: number, h: number) =>
        Math.hypot(x - fan.hubX, top + h / 2 - fan.hubY);
      const inRadius = from(
        nth(inner, 3).left + nth(inner, 3).width / 2,
        nth(inner, 3).top,
        nth(inner, 3).height,
      );
      const outRadius = from(nth(outer, 0).left, nth(outer, 0).top, nth(outer, 0).height);
      expect(Math.abs(outRadius - inRadius - SECOND_ARC_GAP)).toBeLessThanOrEqual(1);
    });

    it("puts the way back last, and lowest", () => {
      if (!fan) throw new Error("no fan");
      const last = nth(fan.spokes, fan.spokes.length - 1);
      expect(last.id).toBe(TOOLS_SPOKE);
      for (const spoke of fan.spokes) expect(last.top).toBeGreaterThanOrEqual(spoke.top);
    });

    it("never brings two pills closer than their gap, across the two arcs, nor onto the hub", () => {
      if (!fan) throw new Error("no fan");
      expect(crowded(fan), JSON.stringify(fan.spokes)).toEqual([]);
      const hub = { ...HUB_BOX, top: HUB_BOX.top + fan.hubY };
      for (const spoke of fan.spokes) expect(overlaps(spoke, hub), spoke.id).toBe(false);
    });

    it("keeps every pill inside its box and its hull, in whole pixels, the same every time", () => {
      if (!fan) throw new Error("no fan");
      for (const spoke of fan.spokes) {
        expect(spoke.left).toBeGreaterThanOrEqual(0);
        expect(spoke.top).toBeGreaterThanOrEqual(0);
        expect(spoke.left + spoke.width).toBeLessThanOrEqual(fan.width);
        expect(spoke.top + spoke.height).toBeLessThanOrEqual(fan.height);
        for (const n of [spoke.left, spoke.top]) expect(Number.isInteger(n), spoke.id).toBe(true);
        for (const [x, y] of [
          [spoke.left + spoke.width, spoke.top],
          [spoke.left + spoke.width, spoke.top + spoke.height],
        ] as const) {
          expect(Math.hypot(x - fan.hubX, y - fan.hubY)).toBeLessThan(fan.hull);
        }
      }
      expect(sectionsRing(sections(12))).toEqual(fan);
      expect(fanFits(fan, 542)).toBe(true);
      console.log(
        `[radialMenu] 12 sections: radius ${fan.radius}, pitch ${fan.pitch}, box ${fan.width} × ${fan.height}, hull ${fan.hull}`,
      );
    });
  });

  it("is one arc up to eight sections, and two from nine", () => {
    for (const count of [1, 4, 8]) {
      const fan = sectionsRing(sections(count));
      expect(fan?.spokes).toHaveLength(count + 1);
      expect(count + 1).toBeLessThanOrEqual(SINGLE_ARC_MAX);
      expect(new Set(fan?.spokes.map((s) => s.width))).toEqual(new Set([SECTION_PILL.width]));
    }
    const nine = sectionsRing(sections(9));
    expect(
      nine?.spokes.slice(0, INNER_ARC_SECTIONS).every((s) => s.width === INNER_PILL.width),
    ).toBe(true);
  });

  it("never crowds, from one section to sixteen, and always ends with the way back, lowest", () => {
    for (let count = 1; count <= SECTIONS_CAP; count += 1) {
      const fan = sectionsRing(sections(count));
      expect(fan, `${count}`).not.toBeNull();
      if (!fan) continue;
      expect(crowded(fan), `${count} sections`).toEqual([]);
      const last = nth(fan.spokes, fan.spokes.length - 1);
      expect(last.id, `${count}`).toBe(TOOLS_SPOKE);
      for (const spoke of fan.spokes)
        expect(last.top, `${count}`).toBeGreaterThanOrEqual(spoke.top);
      expect(fanFits(fan, 542), `${count} sections in the shortest studio row`).toBe(true);
    }
    const sixteen = sectionsRing(sections(16));
    if (sixteen) {
      console.log(
        `[radialMenu] 16 sections: box ${sixteen.width} × ${sixteen.height}, hull ${sixteen.hull}`,
      );
    }
  });

  it("is not offered above sixteen sections, nor for a page with none", () => {
    expect(sectionsRing(sections(SECTIONS_CAP + 1))).toBeNull();
    expect(sectionsRing(sections(40))).toBeNull();
    expect(sectionsRing([])).toBeNull();
  });
});
