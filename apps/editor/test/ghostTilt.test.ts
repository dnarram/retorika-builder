// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ghostTilt, TILT_STILL_MS, tiltOf } from "../src/editor/ghostTilt.ts";

/**
 * **What the hand carries leans the way it is carried** (sprint 36 día 7). That the lean is drawn
 * as 2° of `rotate`, and turns back over `--ui-fast`, is the sheet's and the walk's; what is here is
 * when a ghost leans and when it stands straight, which is where it could flicker or stay crooked.
 */

let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  window.matchMedia = ((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" && reduced,
  })) as typeof window.matchMedia;
});
afterEach(() => {
  vi.useRealTimers();
});

const ghost = () => document.createElement("div");

describe("which way a ghost leans", () => {
  it("toward the hand's sideways travel, and not for a hand going straight", () => {
    expect(tiltOf(6)).toBe("right");
    expect(tiltOf(-6)).toBe("left");
    expect(tiltOf(0.4)).toBeNull();
    expect(tiltOf(-0.4)).toBeNull();
  });
});

describe("one gesture's lean", () => {
  it("leans from the second move on, the way the hand goes, and turns when the hand turns", () => {
    const tilt = ghostTilt(window);
    const el = ghost();
    tilt.follow(el, 100);
    expect(el.dataset["tilt"], "one move says nothing about a direction").toBeUndefined();
    tilt.follow(el, 110);
    expect(el.dataset["tilt"]).toBe("right");
    tilt.follow(el, 104);
    expect(el.dataset["tilt"]).toBe("left");
  });

  it("stands straight once the hand has not gone sideways for a while, and a wobble does not", () => {
    const tilt = ghostTilt(window);
    const el = ghost();
    tilt.follow(el, 100);
    tilt.follow(el, 110);
    vi.advanceTimersByTime(TILT_STILL_MS - 20);
    // Mostly up the page: under a pixel sideways keeps the lean rather than flickering it off.
    tilt.follow(el, 110.5);
    expect(el.dataset["tilt"]).toBe("right");
    vi.advanceTimersByTime(20);
    expect(el.dataset["tilt"], "the hand stopped going sideways").toBeUndefined();
  });

  it("stands straight the moment the hand lets go, and starts again from nothing", () => {
    const tilt = ghostTilt(window);
    const el = ghost();
    tilt.follow(el, 100);
    tilt.follow(el, 90);
    expect(el.dataset["tilt"]).toBe("left");
    tilt.end();
    expect(el.dataset["tilt"]).toBeUndefined();
    tilt.follow(el, 300);
    expect(el.dataset["tilt"], "the last gesture's place is not this one's").toBeUndefined();
  });

  it("straightens one ghost before leaning another", () => {
    const tilt = ghostTilt(window);
    const first = ghost();
    const second = ghost();
    tilt.follow(first, 100);
    tilt.follow(first, 120);
    tilt.follow(second, 140);
    expect(first.dataset["tilt"]).toBeUndefined();
    expect(second.dataset["tilt"]).toBe("right");
  });

  it("writes nothing at all for somebody who asked for less movement", () => {
    reduced = true;
    const tilt = ghostTilt(window);
    const el = ghost();
    tilt.follow(el, 100);
    tilt.follow(el, 140);
    expect(el.dataset["tilt"]).toBeUndefined();
  });
});
