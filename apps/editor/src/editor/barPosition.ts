import type { KeyPress } from "./shortcuts.ts";

/**
 * Where a floating bar sits inside the section it belongs to — decided without a DOM.
 *
 * **Why there is anything to decide.** The section's verbs have sat at the top-right corner of
 * their section since sprint 2, eight pixels in, by two lines of CSS and no arithmetic at all. That
 * is fine until the corner is where the owner's own photograph is, or their logo, or the heading
 * they came to edit — and then eight buttons are standing on the thing the person is trying to
 * reach. David, 14 October 2026: «que la barra flotante del editor sea arrastrable para moverla de
 * posición cuando la posición actual oculta elementos visuales que el usuario quiere editar».
 *
 * So the corner becomes a starting place rather than the only place, and this file is the half of
 * that worth testing: where a point lands, which corner comes next, what an arrow means. The
 * listeners live in `Editor.tsx`, which has the iframe, the pointer events and the rebuild; a
 * listener needs a browser and a rule does not. The same division `sectionKeys.ts` made for the
 * keys and `overflowCheck.ts` for the width.
 *
 * **Nothing here is ever written to the document.** A bar's position is the editor's state, not the
 * site's: it changes nothing a visitor would see, it must not make the document re-serialise
 * (`INV_4`), and it must not cost an undo step — pressing Ctrl+Z after moving a toolbar should take
 * back the last thing typed, not the toolbar. `Editor.tsx` keeps the positions in a ref, keyed by
 * section id, for as long as the session lasts, and they die on reload by David's own decision:
 * «por sección, mientras editas».
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** The bar and the section it is being placed inside, both already measured. */
export interface Bounds {
  readonly hostWidth: number;
  readonly hostHeight: number;
  readonly barWidth: number;
  readonly barHeight: number;
}

/**
 * From the section's own edge, and it is the number the stylesheet has always used for this corner.
 *
 * Inset rather than hung outside, which is a decision sprint 17 day 2 wrote down and this keeps:
 * the cover is the first section with no room above it, and a bar above the top of the page would
 * sit outside the iframe's visible area — covered by whatever the editor draws above the frame, and
 * unclickable. Every section has room inside it.
 */
export const BAR_INSET = 8;

/**
 * One arrow press.
 *
 * Half a verb's width (`VERB_SCALE.size` is 32), which is the size that makes the choice: a press
 * has to move the bar visibly off whatever it was covering, and it has to be small enough that
 * somebody can land it where they meant. Sixteen crosses a button in two presses and a section in
 * about twenty — and `Home` is there for when twenty is too many.
 */
export const BAR_STEP = 16;

/**
 * Below this much travel, a press on the grip was a click rather than a drag.
 *
 * The grip does two things with one pointer: held and moved it drags, pressed and released it sends
 * the bar to the next corner. Without a threshold the second would be impossible — a hand that
 * moves one pixel between `pointerdown` and `pointerup` would have dragged, and the corner would
 * never come. Three pixels is the smallest number that is reliably not a tremor.
 */
export const DRAG_THRESHOLD = 3;

/**
 * How much room the word under a verb needs: six pixels of gap and about twenty-two of pill.
 *
 * Only used to decide which side of the bar the word goes on, so it is deliberately approximate —
 * being a few pixels out flips the word early, which is harmless, where measuring it exactly would
 * mean this file knowing about fonts.
 */
export const TIP_ROOM = 28;

export type Corner = "top-right" | "bottom-right" | "bottom-left" | "top-left";

/**
 * The order the grip walks, starting where the bar is born.
 *
 * Clockwise from the top-right, which is arbitrary in the way that a direction has to be — what is
 * not arbitrary is that it starts at the corner the bar has always been in, so the first press of
 * the grip moves it somewhere and the fourth brings it home. Four corners rather than a free-form
 * nudge because the keyboard needs a destination it can reach in one press: the arrows are for
 * placing it exactly, the corners for getting it out of the way.
 */
export const CORNERS: readonly Corner[] = ["top-right", "bottom-right", "bottom-left", "top-left"];

/**
 * The point, moved as little as it takes to put the whole bar inside its section.
 *
 * **A bar wider than its section sits at the inset rather than at a negative left**, which is the
 * one case worth stating: at 320px the verbs are 248 of the 304 available, and the day a ninth verb
 * arrives they will be wider than the room. Clamping to a negative number would push the bar under
 * the frame's own `overflow-x: clip`, where it is on the screen and cannot be pressed — the dead
 * control this repository keeps finding. Clamping to the inset leaves it reachable and sticking
 * out, which is visible and therefore fixable.
 */
export function clampToHost(point: Point, bounds: Bounds, inset = BAR_INSET): Point {
  const right = Math.max(inset, bounds.hostWidth - bounds.barWidth - inset);
  const bottom = Math.max(inset, bounds.hostHeight - bounds.barHeight - inset);
  return {
    x: Math.min(Math.max(point.x, inset), right),
    y: Math.min(Math.max(point.y, inset), bottom),
  };
}

export function cornerPoint(corner: Corner, bounds: Bounds, inset = BAR_INSET): Point {
  const right = bounds.hostWidth - bounds.barWidth - inset;
  const bottom = bounds.hostHeight - bounds.barHeight - inset;
  const at: Record<Corner, Point> = {
    "top-right": { x: right, y: inset },
    "bottom-right": { x: right, y: bottom },
    "bottom-left": { x: inset, y: bottom },
    "top-left": { x: inset, y: inset },
  };
  return clampToHost(at[corner], bounds, inset);
}

/** Where the bar sits when nobody has moved it: the corner it has been in since sprint 2. */
export function defaultPoint(bounds: Bounds, inset = BAR_INSET): Point {
  return cornerPoint("top-right", bounds, inset);
}

/**
 * The corner a point is closest to, so that a bar somebody dragged into the middle still has a
 * «next» one. Ties go to whichever comes first in `CORNERS`, which only happens on a section small
 * enough for two corners to coincide.
 */
export function nearestCorner(point: Point, bounds: Bounds, inset = BAR_INSET): Corner {
  let best = CORNERS[0] as Corner;
  let shortest = Number.POSITIVE_INFINITY;
  for (const corner of CORNERS) {
    const at = cornerPoint(corner, bounds, inset);
    const distance = Math.hypot(at.x - point.x, at.y - point.y);
    if (distance < shortest) {
      shortest = distance;
      best = corner;
    }
  }
  return best;
}

/** The corner after the one this point is nearest, wrapping. */
export function nextCorner(point: Point, bounds: Bounds, inset = BAR_INSET): Corner {
  const from = CORNERS.indexOf(nearestCorner(point, bounds, inset));
  return CORNERS[(from + 1) % CORNERS.length] as Corner;
}

/**
 * What a key press means while the grip has the keyboard.
 *
 * - `step` — move the bar by `BAR_STEP` in that direction.
 * - `home` — back to where it starts, which is also «forget that I moved it».
 * - `ignore` — not ours; the press reaches whatever it was for.
 *
 * **`Enter` and `Space` are deliberately absent.** The grip is a `<button>`, so both of them fire a
 * `click` on it, and the corner cycle lives in the click handler — which means a press and a mouse
 * press take the same path through the same code rather than two paths that have to be kept
 * agreeing. Handling them here would run the cycle twice for one press.
 *
 * **Only a bare press**, the rule `sectionKeyAction` states at length and for the same reasons:
 * `Meta+Arrow` is «end of document» everywhere, `Shift+Arrow` is a selection gesture everywhere,
 * and a shortcut that fires on a superset of what it claims is how an editor eats a keystroke that
 * was meant for something else.
 */
export type GripKeyAction =
  | { kind: "step"; dx: number; dy: number }
  | { kind: "home" }
  | { kind: "ignore" };

const IGNORED: GripKeyAction = { kind: "ignore" };

export function gripKeyAction(press: KeyPress): GripKeyAction {
  if (press.altKey || press.metaKey || press.ctrlKey || press.shiftKey) return IGNORED;
  switch (press.key) {
    case "ArrowUp":
      return { kind: "step", dx: 0, dy: -BAR_STEP };
    case "ArrowDown":
      return { kind: "step", dx: 0, dy: BAR_STEP };
    case "ArrowLeft":
      return { kind: "step", dx: -BAR_STEP, dy: 0 };
    case "ArrowRight":
      return { kind: "step", dx: BAR_STEP, dy: 0 };
    case "Home":
      return { kind: "home" };
    default:
      return IGNORED;
  }
}

/** One arrow press applied, and stopped at the edge rather than past it. */
export function stepped(
  point: Point,
  action: { readonly dx: number; readonly dy: number },
  bounds: Bounds,
  inset = BAR_INSET,
): Point {
  return clampToHost({ x: point.x + action.dx, y: point.y + action.dy }, bounds, inset);
}

/**
 * Has the pointer travelled far enough for this to be a drag?
 *
 * Chebyshev rather than Euclidean — the larger of the two axes — because the question is «did this
 * move», not «how far»; it makes a three-pixel diagonal a click, as a three-pixel horizontal is,
 * and nobody has ever meant one and not the other.
 */
export function isDrag(from: Point, to: Point): boolean {
  return Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) > DRAG_THRESHOLD;
}

/**
 * Where the bar goes while a pointer drags it: where it started, plus how far the pointer has come
 * since it was pressed, clamped into the section.
 *
 * **Travel rather than «under the pointer», and the difference is the whole of it.** Following the
 * pointer's own position would make the bar jump so its corner met the cursor the instant the drag
 * began; a delta keeps the grip exactly where it was grabbed, which is what a hand expects of
 * anything it has picked up.
 */
export function dragged(start: Point, from: Point, to: Point, bounds: Bounds, inset = BAR_INSET) {
  return clampToHost({ x: start.x + (to.x - from.x), y: start.y + (to.y - from.y) }, bounds, inset);
}

/**
 * Which side of the bar its words go on.
 *
 * The verbs say their name in a pill under the button, which is right in the corner the bar starts
 * in and wrong the moment it is dragged to the bottom of a section, where the word would be drawn
 * past the edge — or on top of the next section. Asked of the position rather than measured in the
 * browser, so the answer is known before the bar is drawn and the word never flickers from one side
 * to the other on arrival.
 */
export function tipSide(point: Point, bounds: Bounds): "below" | "above" {
  return point.y + bounds.barHeight + TIP_ROOM > bounds.hostHeight ? "above" : "below";
}

/**
 * Between the text being edited and the bar that acts on it.
 *
 * Eight, the same number the cluster is inset by, and a different meaning: this is the air between
 * a bar and the words it belongs to, not a margin from the section's edge. Kept apart so that
 * changing one never silently changes the other.
 */
export const TOOLBAR_GAP = 8;

/** An element being edited, the bar that acts on it, and the section both are inside. */
export interface ToolbarGeometry {
  /** The element's offset inside its section, summed up the `offsetParent` chain. */
  readonly elementTop: number;
  readonly elementLeft: number;
  readonly elementHeight: number;
  readonly barWidth: number;
  readonly barHeight: number;
  readonly hostWidth: number;
  readonly gap?: number;
}

/**
 * Where the floating text bar goes: above the words it acts on, or below them when there is no room.
 *
 * **This arithmetic is not new — it is `wireToolbar`'s own, moved here so that something can ask it
 * questions.** It has been four lines inside a 400-line function since sprint 9, and the one time it
 * was wrong it was wrong in a way that read as right: the first version measured the element against
 * the page instead of against its section, and the error pushed every bar into the flip branch,
 * which pushed it back up by roughly the same amount. Two mistakes cancelling, found by a walk on
 * the second section and not by anything that could be unit-tested, because there was nothing to
 * call.
 *
 * `side` asks for one or lets the room decide. **An «above» with no room above comes back «below»**
 * rather than drawn off the top of the frame: that is mockup 08's unconditional `top: -52px`, which
 * for the first element of a page lands outside the iframe's visible area and cannot be clicked.
 * Mockup 17 draws the flip this returns.
 *
 * The horizontal clamp keeps a bar anchored to an element far across the grid from running off the
 * other side; `max-width` in the stylesheet is what handles a bar wider than its section, and this
 * is what handles one that merely starts too far right.
 */
export function toolbarPoint(
  geometry: ToolbarGeometry,
  side: "auto" | "above" | "below" = "auto",
): { point: Point; side: "above" | "below" } {
  const gap = geometry.gap ?? TOOLBAR_GAP;
  const above = geometry.elementTop - geometry.barHeight - gap;
  const below = geometry.elementTop + geometry.elementHeight + gap;
  const wanted = side === "auto" ? (above < 0 ? "below" : "above") : side;
  const settled = wanted === "above" && above < 0 ? "below" : wanted;
  const rightmost = Math.max(geometry.hostWidth - geometry.barWidth - gap, 0);
  return {
    point: {
      x: Math.min(Math.max(geometry.elementLeft, 0), rightmost),
      y: settled === "above" ? above : below,
    },
    side: settled,
  };
}

/** How far one point is from another — what «the person moved it to here» is remembered as. */
export function offsetBetween(computed: Point, placed: Point): Point {
  return { x: placed.x - computed.x, y: placed.y - computed.y };
}

/**
 * The computed place, plus whatever displacement this section is remembering.
 *
 * **A displacement and not a position, which is the decision this makes possible.** The text bar is
 * computed afresh for every element it opens on — it flips, it clamps, it follows a different
 * paragraph each time — so remembering «it was at 340, 96» would mean re-dragging it for each of a
 * cover's five texts, and would freeze a bar that is supposed to keep flipping. A displacement says
 * what the person actually meant: *in this section, keep it further right and lower down than it
 * would otherwise go*, and the same words apply to the next text they touch.
 *
 * **An untouched bar is returned untouched**, deliberately: clamping a computed position that
 * nobody has moved would change where the bar sits for everyone, including the people this feature
 * is not for. Only a displaced one is held inside its section.
 */
export function withOffset(computed: Point, offset: Point, bounds: Bounds): Point {
  if (offset.x === 0 && offset.y === 0) return computed;
  return clampToHost({ x: computed.x + offset.x, y: computed.y + offset.y }, bounds);
}
