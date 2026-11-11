// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAGNET_REACH_PX, magnetAllowed, magnetOffset, wireMagnet } from "../src/editor/magnet.ts";

/**
 * The lean toward the pointer (sprint 36 día 2). The arithmetic, its reach, and the two conditions
 * under which there is no lean at all — a screen that is touched, a person who asked for less.
 */

const BOX = { left: 100, top: 100, width: 200, height: 40 };
let hover = true;
let reduced = false;

beforeEach(() => {
  hover = true;
  reduced = false;
  window.matchMedia = ((query: string) => ({
    matches:
      (query === "(hover: hover)" && hover) ||
      (query === "(prefers-reduced-motion: reduce)" && reduced),
  })) as typeof window.matchMedia;
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("the lean", () => {
  it("is nothing at the centre and the full reach at an edge, never more", () => {
    expect(magnetOffset({ clientX: 200, clientY: 120 }, BOX)).toEqual({ x: 0, y: 0 });
    expect(magnetOffset({ clientX: 300, clientY: 140 }, BOX)).toEqual({
      x: MAGNET_REACH_PX,
      y: MAGNET_REACH_PX,
    });
    expect(magnetOffset({ clientX: 900, clientY: -900 }, BOX)).toEqual({
      x: MAGNET_REACH_PX,
      y: -MAGNET_REACH_PX,
    });
    expect(magnetOffset({ clientX: 150, clientY: 120 }, BOX)).toEqual({ x: -2, y: 0 });
  });

  it("reaches four pixels, which is what the plan and the budget say", () => {
    expect(MAGNET_REACH_PX).toBe(4);
  });
});

describe("when there is a lean at all", () => {
  it("needs a pointer that hovers and no request for less movement", () => {
    expect(magnetAllowed(window)).toBe(true);
    hover = false;
    expect(magnetAllowed(window)).toBe(false);
    hover = true;
    reduced = true;
    expect(magnetAllowed(window)).toBe(false);
  });

  it("writes the two variables while the pointer is over, and rests when it leaves", () => {
    document.body.innerHTML = '<button type="button" class="ui-magnet">Descargar</button>';
    const button = document.querySelector("button") as HTMLButtonElement;
    button.getBoundingClientRect = () =>
      ({ ...BOX, right: 300, bottom: 140, x: 100, y: 100 }) as DOMRect;
    const off = wireMagnet(button);
    button.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 300, clientY: 120 }) as PointerEvent,
    );
    expect(button.style.getPropertyValue("--ui-mx")).toBe("4px");
    expect(button.style.getPropertyValue("--ui-my")).toBe("0px");
    button.dispatchEvent(new MouseEvent("pointerleave") as PointerEvent);
    expect(button.style.getPropertyValue("--ui-mx")).toBe("0px");
    off();
    button.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 300, clientY: 120 }) as PointerEvent,
    );
    expect(button.style.getPropertyValue("--ui-mx")).toBe("0px");
  });

  it("listens to nothing for somebody who asked for less movement", () => {
    reduced = true;
    document.body.innerHTML = '<button type="button" class="ui-magnet">Descargar</button>';
    const button = document.querySelector("button") as HTMLButtonElement;
    wireMagnet(button);
    button.dispatchEvent(
      new MouseEvent("pointermove", { clientX: 300, clientY: 120 }) as PointerEvent,
    );
    expect(button.style.getPropertyValue("--ui-mx")).toBe("");
  });
});
