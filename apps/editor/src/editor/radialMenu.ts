/**
 * **The radial menu's geometry, and the two times it waits** (ADR 0072, sprint 37 día 2).
 *
 * In the radial layout the rail is a strip `HUB_STRIP` wide at the editor's left edge, and in its
 * vertical middle a hub — a disc showing the tool that is open — around which the rail's tools fan
 * out to the right as pills on an arc. Pure: no DOM, no React, integers rounded once, so a walk can
 * compare the boxes the browser draws with what this returns.
 *
 * **Equal vertical pitch, not equal angles.** On the right half of a disc two word pills always
 * overlap horizontally — they start a few pixels apart and run 130 to the right — so only their
 * vertical distance keeps them apart. Spacing the angles evenly crowds the pills at the ends of the
 * arc, where the sine flattens; spacing their heights evenly keeps every pair exactly one pitch
 * apart, and the pitch is never less than a pill and its gap. The radius is the smallest that gives
 * that pitch inside the arc, floored at `FAN_MIN_RADIUS` so a short ring still curves.
 *
 * **The hull is the fan's hit-test shape**: a circle around the hub's centre that just holds the
 * farthest corner of any pill. The element that draws the fan is clipped to it (`clip-path` clips
 * hit-testing too), so the page beyond the arc stays under the pointer while the fan is open, and
 * crossing from the hull onto the canvas is a `pointerleave` the editor's document can hear — the
 * canvas is an `<iframe>`, and nothing inside it is heard from here.
 */

import { DRAG_THRESHOLD } from "./barPosition.ts";

/** The strip's width: the room the radial layout takes from the canvas, 24 px less than the rail. */
export const HUB_STRIP = 56;
/** The hub's centre, from the strip's left edge. */
export const HUB_CENTER_X = HUB_STRIP / 2;
/** The hub's disc: the open tool's icon on its tint. */
export const HUB_DISC = 44;
/** The static ring of dots around the disc, one per tool, inside the strip. */
export const DOT_RING_RADIUS = 26;
export const DOT_RADIUS = 1.5;
/** The arc runs from straight up-right to straight down-right of the hub, ±70°. */
export const FAN_HALF_ARC_DEG = 70;
export const FAN_MIN_RADIUS = 120;
/** Between two pills, vertically: what keeps two words from touching. */
export const PILL_GAP = 6;
/** A tool's pill: its icon and its word, anchored on the arc by its left edge. */
export const TOOL_PILL = { width: 130, height: 36 } as const;
/** Beyond the farthest pill corner, so the hull never shaves a pill's shadow. */
export const HULL_SLACK = 8;
/** A section's pill: its word alone, on the arc by its left edge (ADR 0073). 150 and not 120: at
 * 120, «Fotos de trabajos» and «Herramientas» were cut in the first screenshot of the day. */
export const SECTION_PILL = { width: 150, height: 28 } as const;
/**
 * The inner arc's pill when there are two arcs: narrower, on the arc by its middle. **The width is
 * what the second arc's 56 px leave**: an inner pill reaches half its width past its arc, and an outer
 * one starts at its own, so half the width and the gap must fit in 56 at the rows nearest the middle —
 * 96 leaves 8 px there. The words that do not fit are cut and said whole in the pill's `title`.
 */
export const INNER_PILL = { width: 96, height: 28 } as const;
/** Eight sections and the way back fit one arc; a ninth section starts the second. */
export const SINGLE_ARC_MAX = 9;
export const INNER_ARC_SECTIONS = 8;
/** How much further out the second arc is (David, 13 November 2026). */
export const SECOND_ARC_GAP = 56;
/** Above this many sections the ring is not offered (David, 13 November 2026). */
export const SECTIONS_CAP = 16;
/** The last pill of the sections ring: «Herramientas», back to the tools. Not a section id: those
 * are the document's, and none of them has a colon. */
export const TOOLS_SPOKE = "rb:tools";

/**
 * **Intent before opening** (David, 13 November 2026): the fan opens after the pointer has rested
 * on the hub this long, within `HUB_INTENT_SLOP` of where it stopped — so a pointer crossing the
 * edge on its way somewhere else opens nothing. The threshold is the drag's own, as he asked.
 */
export const HUB_INTENT_MS = 100;
export const HUB_INTENT_SLOP = DRAG_THRESHOLD;
/** **Grace on leaving**: the fan folds this long after the pointer has left it, so crossing the
 * gap between the hub and a pill, or brushing past the arc, does not close it. */
export const FAN_GRACE_MS = 150;

export interface Spoke {
  id: string;
  /** Where the pill meets the arc, in degrees from straight right of the hub; negative is up. */
  angle: number;
  /** The pill's box in the fan's own coordinates (left edge at the strip's, top at the fan's). */
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Fan {
  radius: number;
  /** The vertical distance from one pill's top to the next one's. */
  pitch: number;
  spokes: Spoke[];
  width: number;
  height: number;
  /** The hub's centre in the fan's coordinates — the point the fan is placed by. */
  hubX: number;
  hubY: number;
  /** The hit-test circle's radius, from the hub's centre. */
  hull: number;
}

const SIN_HALF_ARC = Math.sin((FAN_HALF_ARC_DEG * Math.PI) / 180);

/**
 * The radius and the pitch for `count` pills `pillHeight` tall: the smallest radius at which the
 * whole column fits inside the arc with a pitch of at least a pill and its gap, and the whole-pixel
 * pitch that radius gives — whole so that rounding can never bring two pills closer than the gap.
 */
export function arcRows(count: number, pillHeight: number): { radius: number; pitch: number } {
  if (count <= 1) return { radius: FAN_MIN_RADIUS, pitch: 0 };
  const needed = pillHeight + PILL_GAP;
  const radius = Math.max(FAN_MIN_RADIUS, Math.ceil((needed * (count - 1)) / (2 * SIN_HALF_ARC)));
  const pitch = Math.floor((2 * radius * SIN_HALF_ARC) / (count - 1));
  return { radius, pitch };
}

/** One arc's pills, before the fan's box is known: their boxes from the hub's centre. */
interface ArcPlan {
  ids: readonly string[];
  pill: { readonly width: number; readonly height: number };
  /** Which edge of the pill sits on the arc: its left, or its middle (the inner of two arcs). */
  anchor: "left" | "center";
  radius: number;
  /** Each pill's vertical middle, from the hub's centre. */
  middles: readonly number[];
}

/**
 * **The fan from its arcs**: every pill placed where its height meets its arc, then the whole moved so
 * that its top is the fan's top — which puts the hub's centre at `hubY`, the point the fan is hung by.
 * Every pill of an arc moves by the same amount, so a whole-pixel pitch stays whole.
 */
function fanOf(arcs: readonly ArcPlan[], pitch: number): Fan {
  const placed = arcs.flatMap((arc) =>
    arc.ids.map((id, index) => {
      const middle = arc.middles[index] ?? 0;
      const x = Math.sqrt(Math.max(0, arc.radius * arc.radius - middle * middle));
      const left = HUB_CENTER_X + x - (arc.anchor === "center" ? arc.pill.width / 2 : 0);
      return {
        id,
        angle: Math.round((Math.atan2(middle, x) * 180 * 10) / Math.PI) / 10,
        left: Math.round(left),
        top: middle - arc.pill.height / 2,
        width: arc.pill.width,
        height: arc.pill.height,
      };
    }),
  );
  const hubY = -Math.min(...placed.map((spoke) => spoke.top));
  const spokes = placed.map((spoke) => ({ ...spoke, top: spoke.top + hubY }));
  const width = Math.max(HUB_STRIP, ...spokes.map((spoke) => spoke.left + spoke.width));
  const height = Math.max(...spokes.map((spoke) => spoke.top + spoke.height));
  const farthest = Math.max(
    0,
    ...spokes.flatMap((spoke) =>
      [spoke.left, spoke.left + spoke.width].flatMap((x) =>
        [spoke.top, spoke.top + spoke.height].map((y) => Math.hypot(x - HUB_CENTER_X, y - hubY)),
      ),
    ),
  );
  return {
    radius: Math.max(...arcs.map((arc) => arc.radius)),
    pitch,
    spokes,
    width,
    height,
    hubX: HUB_CENTER_X,
    hubY,
    hull: Math.ceil(farthest) + HULL_SLACK,
  };
}

/** The vertical middles of `count` pills one `pitch` apart, centred on the hub. */
function centred(count: number, pitch: number): number[] {
  return Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * pitch);
}

/** The ring of the rail's tools, top to bottom in the rail's own order. */
export function toolsRing(toolIds: readonly string[]): Fan {
  const { radius, pitch } = arcRows(toolIds.length, TOOL_PILL.height);
  return fanOf(
    [
      {
        ids: toolIds,
        pill: TOOL_PILL,
        anchor: "left",
        radius,
        middles: centred(toolIds.length, pitch),
      },
    ],
    pitch,
  );
}

/**
 * **The second level: the page's sections around «Secciones»** (ADR 0073, sprint 37 día 4; David's
 * decision of 13 November 2026: «tope 8, segundo arco hasta 16, la web de 12 como sujeto»).
 *
 * The sections in the page's order and, always last, `TOOLS_SPOKE` — «Herramientas», the way back to
 * the first ring. **Up to `SINGLE_ARC_MAX` pills (eight sections and the way back) on one arc**, as the
 * tools are. **From ten, two arcs**: the first eight sections on an inner arc whose pills are narrower
 * and sit on it by their middle, and the rest with the way back on an outer arc `SECOND_ARC_GAP`
 * further out. **Above `SECTIONS_CAP` sections, `null`**: the ring is not offered, the hub opens on the
 * tools, and the switch says why.
 *
 * **The outer arc keeps the inner one's rows.** Its pills sit at the heights of the inner arc's
 * bottom rows (one row above the top, at sixteen), so every outer pill shares its height with one
 * inner pill and no other, and the two arcs' radii are what keeps them apart — fifty-six pixels at the
 * middle, more away from it. Spread over the whole height instead, an outer pill came within two
 * pixels of an inner one on the diagonal (measured on paper on 14 November, twelve sections). And the
 * bottom of the outer arc is the bottom of the fan, so the way back is the last pill and the lowest.
 */
export function sectionsRing(sectionIds: readonly string[]): Fan | null {
  const count = sectionIds.length;
  if (count === 0 || count > SECTIONS_CAP) return null;
  const ids = [...sectionIds, TOOLS_SPOKE];
  if (ids.length <= SINGLE_ARC_MAX) {
    const { radius, pitch } = arcRows(ids.length, SECTION_PILL.height);
    return fanOf(
      [{ ids, pill: SECTION_PILL, anchor: "left", radius, middles: centred(ids.length, pitch) }],
      pitch,
    );
  }
  const inner = ids.slice(0, INNER_ARC_SECTIONS);
  const outer = ids.slice(INNER_ARC_SECTIONS);
  const { radius, pitch } = arcRows(inner.length, INNER_PILL.height);
  const rows = centred(inner.length, pitch);
  const lastRow = rows[rows.length - 1] ?? 0;
  return fanOf(
    [
      { ids: inner, pill: INNER_PILL, anchor: "center", radius, middles: rows },
      {
        ids: outer,
        pill: SECTION_PILL,
        anchor: "left",
        radius: radius + SECOND_ARC_GAP,
        // The inner arc's bottom rows, upward from its last: as many as the outer arc has pills.
        middles: outer.map((_, index) => lastRow - (outer.length - 1 - index) * pitch),
      },
    ],
    pitch,
  );
}

/** The fan's `clip-path`: its hull, centred on the hub. */
export function hullClip(fan: Fan): string {
  return `circle(${fan.hull}px at ${fan.hubX}px ${fan.hubY}px)`;
}

/** Whether the fan fits a row this tall with room above and below it, centred on the hub. */
export function fanFits(fan: Fan, rowHeight: number): boolean {
  return fan.height + 16 <= rowHeight;
}

/** Whether two pills come closer than `gap` on both axes — closer, not merely touching. */
export function overlaps(
  a: Pick<Spoke, "left" | "top" | "width" | "height">,
  b: Pick<Spoke, "left" | "top" | "width" | "height">,
  gap = PILL_GAP,
): boolean {
  return (
    a.left < b.left + b.width + gap &&
    b.left < a.left + a.width + gap &&
    a.top < b.top + b.height + gap &&
    b.top < a.top + a.height + gap
  );
}

/** Where the hub's dots sit, one per tool, from straight up and clockwise, around its centre. */
export function dotPositions(count: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(1, count);
    return {
      x: Math.round(DOT_RING_RADIUS * Math.cos(angle) * 100) / 100,
      y: Math.round(DOT_RING_RADIUS * Math.sin(angle) * 100) / 100,
    };
  });
}
