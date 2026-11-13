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

/** The ring of the rail's tools, top to bottom in the rail's own order. */
export function toolsRing(toolIds: readonly string[]): Fan {
  const count = toolIds.length;
  const { width, height } = TOOL_PILL;
  const { radius, pitch } = arcRows(count, height);
  const fanHeight = pitch * Math.max(0, count - 1) + height;
  const hubY = fanHeight / 2;
  const spokes = toolIds.map((id, index) => {
    const top = index * pitch;
    // The pill's vertical middle, from the hub's centre, and where that height meets the arc.
    const y = top + height / 2 - hubY;
    const x = Math.sqrt(Math.max(0, radius * radius - y * y));
    return {
      id,
      angle: Math.round((Math.atan2(y, x) * 180 * 10) / Math.PI) / 10,
      left: Math.round(HUB_CENTER_X + x),
      top,
      width,
      height,
    };
  });
  const fanWidth = Math.max(HUB_STRIP, ...spokes.map((spoke) => spoke.left + spoke.width));
  const farthest = Math.max(
    0,
    ...spokes.flatMap((spoke) =>
      [spoke.top, spoke.top + spoke.height].map((edge) =>
        Math.hypot(spoke.left + spoke.width - HUB_CENTER_X, edge - hubY),
      ),
    ),
  );
  return {
    radius,
    pitch,
    spokes,
    width: fanWidth,
    height: fanHeight,
    hubX: HUB_CENTER_X,
    hubY,
    hull: Math.ceil(farthest) + HULL_SLACK,
  };
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
