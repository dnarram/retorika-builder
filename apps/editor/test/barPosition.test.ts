import { describe, expect, it } from "vitest";
import {
  BAR_INSET,
  BAR_STEP,
  type Bounds,
  CORNERS,
  clampToHost,
  cornerPoint,
  DRAG_THRESHOLD,
  defaultPoint,
  dragged,
  gripKeyAction,
  isDrag,
  isDragBeyond,
  isToolbarShortcut,
  nearestCorner,
  nextCorner,
  offsetBetween,
  type Point,
  stepped,
  TOOLBAR_GAP,
  type ToolbarGeometry,
  textGripKeyAction,
  tipSide,
  toolbarIndex,
  toolbarKeyAction,
  toolbarPoint,
  toolbarShortcutFor,
  withOffset,
} from "../src/editor/barPosition.ts";

/**
 * Where a floating bar lands, and what a press on its grip means.
 *
 * Measured against a section the size of a real one: a restaurant's «Comidas» at 1200 × 600 with
 * the eight verbs' 284 × 32 cluster in it. The numbers below are worked from those two rectangles
 * rather than written as constants, so a test cannot agree with itself while the arithmetic drifts.
 */
const SECTION: Bounds = { hostWidth: 1200, hostHeight: 600, barWidth: 284, barHeight: 32 };

/** The far edges of that section, which almost every expectation is one of. */
const RIGHT = SECTION.hostWidth - SECTION.barWidth - BAR_INSET; // 908
const BOTTOM = SECTION.hostHeight - SECTION.barHeight - BAR_INSET; // 560

const press = (
  key: string,
  held: Partial<Record<"altKey" | "metaKey" | "ctrlKey" | "shiftKey", boolean>> = {},
) => ({
  key,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  ...held,
});

describe("where a bar starts, and where it is allowed to be", () => {
  it("starts in the corner it has been in since sprint 2, eight pixels in", () => {
    expect(defaultPoint(SECTION)).toEqual({ x: RIGHT, y: BAR_INSET });
    expect(defaultPoint(SECTION)).toEqual(cornerPoint("top-right", SECTION));
  });

  it("names the four corners with the inset on every edge", () => {
    expect(cornerPoint("top-left", SECTION)).toEqual({ x: BAR_INSET, y: BAR_INSET });
    expect(cornerPoint("top-right", SECTION)).toEqual({ x: RIGHT, y: BAR_INSET });
    expect(cornerPoint("bottom-right", SECTION)).toEqual({ x: RIGHT, y: BOTTOM });
    expect(cornerPoint("bottom-left", SECTION)).toEqual({ x: BAR_INSET, y: BOTTOM });
  });

  it("brings a point outside the section back in, on both axes and in both directions", () => {
    expect(clampToHost({ x: -400, y: -400 }, SECTION)).toEqual({ x: BAR_INSET, y: BAR_INSET });
    expect(clampToHost({ x: 9_000, y: 9_000 }, SECTION)).toEqual({ x: RIGHT, y: BOTTOM });
    // And leaves alone one that was already inside.
    expect(clampToHost({ x: 100, y: 100 }, SECTION)).toEqual({ x: 100, y: 100 });
  });

  /**
   * At 320px the eight verbs are 248 of the 304 there is room for, so this is one verb away from
   * being the ordinary case rather than the edge one. A negative left would push the bar under the
   * frame's own `overflow-x: clip`, where it is on the screen and cannot be pressed.
   */
  it("leaves a bar wider than its section at the inset, rather than at a negative left", () => {
    const narrow: Bounds = { hostWidth: 200, hostHeight: 400, barWidth: 284, barHeight: 32 };
    expect(clampToHost({ x: -50, y: 10 }, narrow).x).toBe(BAR_INSET);
    expect(clampToHost({ x: 500, y: 10 }, narrow).x).toBe(BAR_INSET);
    expect(cornerPoint("top-right", narrow).x).toBe(BAR_INSET);
  });
});

describe("the corner the grip sends it to next", () => {
  it("walks clockwise from where the bar is born and comes home on the fourth press", () => {
    let at: Point = defaultPoint(SECTION);
    const walked = CORNERS.map(() => {
      const corner = nextCorner(at, SECTION);
      at = cornerPoint(corner, SECTION);
      return corner;
    });
    expect(walked).toEqual(["bottom-right", "bottom-left", "top-left", "top-right"]);
    expect(at).toEqual(defaultPoint(SECTION));
  });

  it("starts from the nearest corner, so a bar dragged into the middle still has a next one", () => {
    // Nearer the bottom-left than any other: a third across, three quarters down.
    const middling: Point = { x: 60, y: 500 };
    expect(nearestCorner(middling, SECTION)).toBe("bottom-left");
    expect(nextCorner(middling, SECTION)).toBe("top-left");
  });

  it("knows each corner as its own nearest", () => {
    for (const corner of CORNERS) {
      expect(nearestCorner(cornerPoint(corner, SECTION), SECTION)).toBe(corner);
    }
  });
});

describe("what a press on the grip means", () => {
  const steps: [string, number, number][] = [
    ["ArrowUp", 0, -BAR_STEP],
    ["ArrowDown", 0, BAR_STEP],
    ["ArrowLeft", -BAR_STEP, 0],
    ["ArrowRight", BAR_STEP, 0],
  ];

  for (const [key, dx, dy] of steps) {
    it(`${key} is a step of ${BAR_STEP} and nothing else`, () => {
      expect(gripKeyAction(press(key))).toEqual({ kind: "step", dx, dy });
    });
  }

  it("Home means back to where it starts", () => {
    expect(gripKeyAction(press("Home"))).toEqual({ kind: "home" });
  });

  /**
   * Enter and Space fire a `click` on a `<button>`, and the corner cycle lives in the click
   * handler — so a key press and a mouse press take one path rather than two that have to be kept
   * agreeing. Taking them here would run the cycle twice for one press.
   */
  it("leaves Enter and Space to the button, which is what fires the corner cycle", () => {
    expect(gripKeyAction(press("Enter"))).toEqual({ kind: "ignore" });
    expect(gripKeyAction(press(" "))).toEqual({ kind: "ignore" });
  });

  it("is not ours for any other key", () => {
    for (const key of ["Escape", "Tab", "a", "PageDown", "End"]) {
      expect(gripKeyAction(press(key)), `«${key}» was taken`).toEqual({ kind: "ignore" });
    }
  });

  it("refuses any modifier, Shift included", () => {
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home"]) {
      for (const held of ["altKey", "metaKey", "ctrlKey", "shiftKey"] as const) {
        expect(gripKeyAction(press(key, { [held]: true })), `${held}+${key} was taken`).toEqual({
          kind: "ignore",
        });
      }
    }
  });
});

/**
 * The text bar's own keys (ADR 0052 §3, sprint 27 día 4): its grip keeps ↑ ↓, and ← → Inicio Fin
 * walk between its controls, because the bar has become a toolbar and the grip is where a keyboard
 * arrives.
 */
describe("what a press means on the text bar's grip", () => {
  it("↑ and ↓ still move the bar, by the same step as the cluster's", () => {
    expect(textGripKeyAction(press("ArrowUp"))).toEqual({ kind: "step", dx: 0, dy: -BAR_STEP });
    expect(textGripKeyAction(press("ArrowDown"))).toEqual({ kind: "step", dx: 0, dy: BAR_STEP });
  });

  it("leaves ← → and Inicio to the toolbar, which the cluster's grip does not", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "Home"]) {
      expect(gripKeyAction(press(key)).kind, `the cluster lost «${key}»`).not.toBe("ignore");
      expect(textGripKeyAction(press(key)), `the text bar's grip kept «${key}»`).toEqual({
        kind: "ignore",
      });
    }
  });

  it("refuses a modifier the same way the cluster's grip does", () => {
    for (const held of ["altKey", "metaKey", "ctrlKey", "shiftKey"] as const) {
      expect(textGripKeyAction(press("ArrowUp", { [held]: true }))).toEqual({ kind: "ignore" });
    }
  });
});

describe("what a press means anywhere in the text bar", () => {
  it("← → Inicio Fin move between its controls", () => {
    expect(toolbarKeyAction(press("ArrowLeft"))).toEqual({ kind: "focus", to: "previous" });
    expect(toolbarKeyAction(press("ArrowRight"))).toEqual({ kind: "focus", to: "next" });
    expect(toolbarKeyAction(press("Home"))).toEqual({ kind: "focus", to: "first" });
    expect(toolbarKeyAction(press("End"))).toEqual({ kind: "focus", to: "last" });
  });

  it("Escape goes back to the words", () => {
    expect(toolbarKeyAction(press("Escape"))).toEqual({ kind: "words" });
  });

  it("Tab and Shift+Tab leave the bar, forwards and back", () => {
    expect(toolbarKeyAction(press("Tab"))).toEqual({ kind: "leave", forward: true });
    expect(toolbarKeyAction(press("Tab", { shiftKey: true }))).toEqual({
      kind: "leave",
      forward: false,
    });
  });

  /**
   * ↑ and ↓ belong to the control — a `<select>` opens, a number steps, the grip moves the bar —
   * and Intro and Espacio are a button's own click, the one path a mouse press also takes.
   */
  it("leaves ↑ ↓ Intro Espacio and everything else to the control", () => {
    for (const key of ["ArrowUp", "ArrowDown", "Enter", " ", "a", "PageDown", "F10"]) {
      expect(toolbarKeyAction(press(key)), `«${key}» was taken`).toEqual({ kind: "ignore" });
    }
  });

  it("refuses Alt, Cmd and Ctrl on every key it claims, and Shift on all but Tab", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End", "Escape", "Tab"]) {
      for (const held of ["altKey", "metaKey", "ctrlKey"] as const) {
        expect(toolbarKeyAction(press(key, { [held]: true })), `${held}+${key}`).toEqual({
          kind: "ignore",
        });
      }
      if (key === "Tab") continue;
      expect(toolbarKeyAction(press(key, { shiftKey: true })), `Shift+${key}`).toEqual({
        kind: "ignore",
      });
    }
  });
});

describe("which control a press lands on", () => {
  it("wraps at both ends, so → from the grip — the last control — comes round to the first", () => {
    expect(toolbarIndex(5, 4, "next")).toBe(0);
    expect(toolbarIndex(5, 0, "previous")).toBe(4);
    expect(toolbarIndex(5, 2, "next")).toBe(3);
    expect(toolbarIndex(5, 2, "previous")).toBe(1);
  });

  it("goes to the ends from anywhere", () => {
    expect(toolbarIndex(5, 3, "first")).toBe(0);
    expect(toolbarIndex(5, 1, "last")).toBe(4);
  });

  it("reads focus on none of them as standing just outside both ends", () => {
    expect(toolbarIndex(5, -1, "next")).toBe(0);
    expect(toolbarIndex(5, -1, "previous")).toBe(4);
    expect(toolbarIndex(5, 9, "next")).toBe(0);
  });

  it("has nowhere to land with no controls", () => {
    for (const to of ["previous", "next", "first", "last"] as const) {
      expect(toolbarIndex(0, -1, to)).toBe(-1);
    }
  });
});

describe("the shortcut to the bar, and how the legend names it", () => {
  it("is Alt+F10 and nothing more", () => {
    expect(isToolbarShortcut(press("F10", { altKey: true }))).toBe(true);
    expect(isToolbarShortcut(press("F10"))).toBe(false);
    for (const held of ["metaKey", "ctrlKey", "shiftKey"] as const) {
      expect(isToolbarShortcut(press("F10", { altKey: true, [held]: true })), held).toBe(false);
    }
    expect(isToolbarShortcut(press("F9", { altKey: true }))).toBe(false);
  });

  /**
   * The strings are the ones the browsers actually report — «macOS» from `userAgentData` in
   * Chromium, «MacIntel» from `navigator.platform` in every browser on a Mac, Intel or not.
   */
  it("says the Mac's sentence on a Mac, by either source, and the other one elsewhere", () => {
    expect(toolbarShortcutFor({ userAgentData: { platform: "macOS" } })).toBe("mac");
    expect(toolbarShortcutFor({ platform: "MacIntel" })).toBe("mac");
    expect(toolbarShortcutFor({ userAgentData: { platform: "" }, platform: "MacIntel" })).toBe(
      "mac",
    );
    expect(toolbarShortcutFor({ userAgentData: { platform: "Windows" } })).toBe("other");
    expect(toolbarShortcutFor({ platform: "Win32" })).toBe("other");
    expect(toolbarShortcutFor({ platform: "Linux x86_64" })).toBe("other");
    expect(toolbarShortcutFor({})).toBe("other");
  });
});

describe("moving it", () => {
  it("takes one step and stops at the edge instead of leaving the section", () => {
    const from: Point = { x: 100, y: 100 };
    expect(stepped(from, { dx: -BAR_STEP, dy: 0 }, SECTION)).toEqual({ x: 100 - BAR_STEP, y: 100 });

    // Pressed against the left edge, the next press changes nothing rather than going negative.
    const edge: Point = { x: BAR_INSET, y: 100 };
    expect(stepped(edge, { dx: -BAR_STEP, dy: 0 }, SECTION)).toEqual(edge);
  });

  it("is a click under four pixels of travel and a drag over it", () => {
    const from: Point = { x: 500, y: 500 };
    expect(isDrag(from, { x: 503, y: 503 })).toBe(false);
    expect(isDrag(from, { x: 504, y: 500 })).toBe(true);
    expect(isDrag(from, { x: 500, y: 496 })).toBe(true);
    expect(isDrag(from, from)).toBe(false);
  });

  it("follows the pointer's travel rather than the pointer, so the grip stays where it was grabbed", () => {
    const start: Point = { x: 400, y: 200 };
    // The pointer went down at (1000, 900) — nowhere near the bar's own coordinates — and moved
    // 60 left and 25 down. The bar does the same, from where *it* was.
    expect(dragged(start, { x: 1000, y: 900 }, { x: 940, y: 925 }, SECTION)).toEqual({
      x: 340,
      y: 225,
    });
  });

  it("clamps a drag that would take it out of the section", () => {
    const start: Point = { x: 400, y: 200 };
    expect(dragged(start, { x: 0, y: 0 }, { x: -9_000, y: 9_000 }, SECTION)).toEqual({
      x: BAR_INSET,
      y: BOTTOM,
    });
  });
});

describe("which side the words go on", () => {
  it("below while the bar is anywhere there is room for one", () => {
    expect(tipSide(defaultPoint(SECTION), SECTION)).toBe("below");
    expect(tipSide({ x: 100, y: 100 }, SECTION)).toBe("below");
  });

  it("above once the bar is low enough that a word under it would be drawn past the edge", () => {
    expect(tipSide(cornerPoint("bottom-right", SECTION), SECTION)).toBe("above");
    expect(tipSide(cornerPoint("bottom-left", SECTION), SECTION)).toBe("above");
  });
});

/**
 * The floating text bar's own placement, which until today was four lines inside a four-hundred
 * line function and had never been called by anything but itself.
 *
 * A paragraph 120px down its section, 30px tall, with a 400 × 44 bar for it in a section 1200 wide.
 */
const TEXT: ToolbarGeometry = {
  elementTop: 120,
  elementLeft: 40,
  elementHeight: 30,
  barWidth: 400,
  barHeight: 44,
  hostWidth: 1200,
};

describe("where the floating text bar goes", () => {
  it("sits above the words it acts on when there is room", () => {
    expect(toolbarPoint(TEXT)).toEqual({
      point: { x: TEXT.elementLeft, y: TEXT.elementTop - TEXT.barHeight - TOOLBAR_GAP },
      side: "above",
    });
  });

  /**
   * The cover's headline under a tight scale, where the section's own padding is all the room there
   * is. Mockup 08 puts the bar at `top: -52px` unconditionally, which there lands outside the
   * iframe's own visible area and cannot be clicked; mockup 17 draws this flip.
   */
  it("flips below when there is no room above it", () => {
    const tight: ToolbarGeometry = { ...TEXT, elementTop: 20 };
    expect(toolbarPoint(tight)).toEqual({
      point: { x: tight.elementLeft, y: 20 + tight.elementHeight + TOOLBAR_GAP },
      side: "below",
    });
  });

  it("gives the side it can when asked for one it cannot", () => {
    const tight: ToolbarGeometry = { ...TEXT, elementTop: 20 };
    expect(toolbarPoint(tight, "above").side).toBe("below");
    // And obeys the ask where there is room for it.
    expect(toolbarPoint(TEXT, "below")).toEqual({
      point: { x: TEXT.elementLeft, y: TEXT.elementTop + TEXT.elementHeight + TOOLBAR_GAP },
      side: "below",
    });
  });

  it("clamps the left edge at both ends of the section", () => {
    expect(toolbarPoint({ ...TEXT, elementLeft: -200 }).point.x).toBe(0);
    expect(toolbarPoint({ ...TEXT, elementLeft: 5_000 }).point.x).toBe(
      TEXT.hostWidth - TEXT.barWidth - TOOLBAR_GAP,
    );
  });

  it("starts a bar wider than its section at zero rather than at a negative left", () => {
    expect(toolbarPoint({ ...TEXT, barWidth: 2_000, elementLeft: 300 }).point.x).toBe(0);
  });
});

/**
 * **Where the bar goes when the canvas is scrolled** (sprint 27 día 3, ADR 0052 §4's own cause).
 *
 * The numbers are the defect's, measured in Chromium on 23 October 2026 at 1440 × 900: the cover's
 * headline 204 pixels down its section, 52 tall, a 580 × 38 bar for it, the frame 1168 × 774 and
 * scrolled 189 — which is what choosing another section first leaves behind, because choosing
 * focuses and focus scrolls. Above the words is 158, inside the section and 31 pixels above the top
 * of what is on screen, and a press there lands outside the frame: the words lose the focus, the
 * deferred blur closes the bar, «B» marks nothing. The bar that dies, in arithmetic.
 */
const SCROLLED: ToolbarGeometry = {
  elementTop: 204,
  elementLeft: 48,
  elementHeight: 52,
  barWidth: 580,
  barHeight: 38,
  hostWidth: 1168,
  view: { top: 189, height: 774 },
};

describe("the band of the section that is on screen", () => {
  it("puts the bar below the words when above them is off the top of the frame", () => {
    const { point, side } = toolbarPoint(SCROLLED);
    expect(side).toBe("below");
    expect(point.y).toBe(SCROLLED.elementTop + SCROLLED.elementHeight + TOOLBAR_GAP);
    // On screen, which is the whole point: the band starts at 189 and is 774 tall.
    expect(point.y).toBeGreaterThanOrEqual(SCROLLED.view?.top ?? 0);
    expect(point.y + SCROLLED.barHeight).toBeLessThanOrEqual(
      (SCROLLED.view?.top ?? 0) + (SCROLLED.view?.height ?? 0),
    );
  });

  /** The same geometry with the band taken away — the answer this file gave until día 3, kept here
   * so the difference the band makes is a number and not a story: 158, which is 31 above the edge. */
  it("said «above» for that same text while it was only asked about the section", () => {
    const { view: _band, ...blind } = SCROLLED;
    const { point, side } = toolbarPoint(blind);
    expect(side).toBe("above");
    expect(point.y).toBe(158);
    expect(point.y - (SCROLLED.view?.top ?? 0)).toBe(-31);
  });

  it("leaves a bar that fits exactly where it was", () => {
    const roomy: ToolbarGeometry = { ...TEXT, view: { top: 0, height: 900 } };
    expect(toolbarPoint(roomy)).toEqual(toolbarPoint(TEXT));
  });

  it("gives «below» when «above» is asked for and is off the band", () => {
    expect(toolbarPoint(SCROLLED, "above").side).toBe("below");
  });

  /**
   * A text taller than the frame: nothing above it is on screen and nothing below it is either. The
   * side is reported as it was decided and the place is pinned to the band, because a bar nobody can
   * reach is the one outcome worse than a bar in the way.
   */
  it("pins the bar inside the band when neither side is on screen", () => {
    const tall: ToolbarGeometry = {
      ...SCROLLED,
      elementTop: 0,
      elementHeight: 2_000,
      view: { top: 400, height: 500 },
    };
    const { point } = toolbarPoint(tall);
    expect(point.y).toBeGreaterThanOrEqual(400);
    expect(point.y + tall.barHeight).toBeLessThanOrEqual(900);
    expect(point.y).toBe(900 - tall.barHeight);
  });

  /**
   * **A section whose own top is on screen**, which is most of them: the band starts above the
   * section, at a negative offset, and that is not room for the bar. The section's top is still the
   * floor — the rule this file had before the band — and the first version of the band forgot it,
   * drawing the bar over the section above (found by the sprint 9 walk on «Contacto», whose
   * paragraph the bar's blank space has to reach).
   */
  it("keeps the section's own top as the floor when the section starts below the top of the frame", () => {
    const onScreen: ToolbarGeometry = { ...TEXT, elementTop: 20, view: { top: -300, height: 900 } };
    expect(toolbarPoint(onScreen)).toEqual(toolbarPoint({ ...TEXT, elementTop: 20 }));
    expect(toolbarPoint(onScreen).side).toBe("below");
    expect(toolbarPoint(onScreen, "above").side).toBe("below");
  });

  it("never asks for a place above the band, even when the band is taller than the bar is", () => {
    const short: ToolbarGeometry = { ...SCROLLED, elementTop: 190, view: { top: 189, height: 20 } };
    expect(toolbarPoint(short).point.y).toBe(189);
  });
});

describe("remembering where a bar was put, as a displacement", () => {
  const BOUNDS: Bounds = { hostWidth: 1200, hostHeight: 600, barWidth: 400, barHeight: 44 };

  it("leaves an untouched bar exactly where it was computed", () => {
    const computed = toolbarPoint(TEXT).point;
    expect(withOffset(computed, { x: 0, y: 0 }, BOUNDS)).toBe(computed);
  });

  it("comes back to where it was dropped", () => {
    const computed = toolbarPoint(TEXT).point;
    const placed: Point = { x: computed.x + 120, y: computed.y + 40 };
    expect(withOffset(computed, offsetBetween(computed, placed), BOUNDS)).toEqual(placed);
  });

  /**
   * The point of a displacement rather than a position: the same «further right and lower down»
   * applies to the next text in the section, which is computed somewhere else entirely.
   */
  it("applies the same displacement to a different element's computed place", () => {
    const first = toolbarPoint(TEXT).point;
    const nudge = offsetBetween(first, { x: first.x + 120, y: first.y + 40 });
    const second = toolbarPoint({ ...TEXT, elementTop: 300, elementLeft: 90 }).point;
    expect(withOffset(second, nudge, BOUNDS)).toEqual({ x: second.x + 120, y: second.y + 40 });
  });

  it("holds a displacement that would take the bar out of its section", () => {
    const computed = toolbarPoint(TEXT).point;
    const far = withOffset(computed, { x: 9_000, y: 9_000 }, BOUNDS);
    expect(far.x).toBe(BOUNDS.hostWidth - BOUNDS.barWidth - BAR_INSET);
    expect(far.y).toBe(BOUNDS.hostHeight - BOUNDS.barHeight - BAR_INSET);
  });
});

describe("isDragBeyond — three pixels of the screen, not of the frame", () => {
  /**
   * **David's adjustment 3, as arithmetic.** Everything inside the canvas is in the frame's own
   * pixels and the card is scaled from outside it, so a gesture that armed at three *frame* pixels
   * armed sooner than a hand meant it: with the panel open at 1024 the canvas sits at a zoom of
   * 0.74, where three frame pixels are 2.2 under the hand. The element drag divides the threshold
   * by the zoom (`zoomOf` in `Editor.tsx`) and this is the function that takes it.
   */
  const from = { x: 100, y: 100 };

  it("takes the threshold it is given, on the larger of the two axes", () => {
    expect(isDragBeyond(from, { x: 104, y: 100 }, 3)).toBe(true);
    expect(isDragBeyond(from, { x: 103, y: 100 }, 3)).toBe(false);
    expect(isDragBeyond(from, { x: 100, y: 96 }, 3)).toBe(true);
    expect(isDragBeyond(from, { x: 103, y: 103 }, 3)).toBe(false);
  });

  it("is what `isDrag` is, with the default threshold", () => {
    for (const to of [
      { x: 103, y: 100 },
      { x: 104, y: 100 },
      { x: 100, y: 112 },
    ]) {
      expect(isDragBeyond(from, to, DRAG_THRESHOLD), `${to.x},${to.y}`).toBe(isDrag(from, to));
    }
  });

  it("arms a zoomed canvas at three pixels of the screen rather than at two", () => {
    // The zoom the shell reaches with the panel open at 1024: 721 of layout inside 532 of card.
    const zoom = 532 / 721;
    const threshold = DRAG_THRESHOLD / zoom;
    // A hand that moved three screen pixels has moved 4.07 frame pixels, which is the threshold…
    expect(isDragBeyond(from, { x: 100 + 3 / zoom, y: 100 }, threshold)).toBe(false);
    // …and four screen pixels is 5.4, which is a drag. Under the old threshold of three frame
    // pixels, 2.3 screen pixels would already have armed it.
    expect(isDragBeyond(from, { x: 100 + 4 / zoom, y: 100 }, threshold)).toBe(true);
    expect(isDragBeyond(from, { x: 100 + 2.3 / zoom, y: 100 }, DRAG_THRESHOLD)).toBe(true);
  });
});
