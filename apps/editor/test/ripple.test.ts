// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { PRESS_ATTRIBUTE, press, ripplePoint, wireRipples } from "../src/editor/ripple.ts";

/**
 * The press point and the replay (sprint 36 día 2). What a browser alone shows — the ring growing
 * from that point and ending inside the control — is día 6's walk; what is here is the arithmetic
 * and the one listener, which a walk would only find by luck.
 */

afterEach(() => {
  document.body.innerHTML = "";
});

const BOX = { left: 100, top: 50, width: 200, height: 40 };

describe("where the press landed", () => {
  it("is a percentage of the control's box", () => {
    expect(ripplePoint({ clientX: 100, clientY: 50 }, BOX)).toEqual({ x: 0, y: 0 });
    expect(ripplePoint({ clientX: 200, clientY: 70 }, BOX)).toEqual({ x: 50, y: 50 });
    expect(ripplePoint({ clientX: 300, clientY: 90 }, BOX)).toEqual({ x: 100, y: 100 });
  });

  it("never leaves the box, and is the centre of a box with no size", () => {
    expect(ripplePoint({ clientX: 0, clientY: 0 }, BOX)).toEqual({ x: 0, y: 0 });
    expect(ripplePoint({ clientX: 900, clientY: 900 }, BOX)).toEqual({ x: 100, y: 100 });
    expect(ripplePoint({ clientX: 10, clientY: 10 }, { ...BOX, width: 0 })).toEqual({
      x: 50,
      y: 50,
    });
  });
});

describe("the one listener", () => {
  function shell(): { root: HTMLElement; button: HTMLButtonElement; plain: HTMLButtonElement } {
    document.body.innerHTML = `
      <div id="root">
        <button type="button" class="ui-interactive"><span>Descargar</span><svg></svg></button>
        <button type="button" id="plain">Volver</button>
      </div>`;
    const root = document.getElementById("root") as HTMLElement;
    return {
      root,
      button: root.querySelector("button") as HTMLButtonElement,
      plain: document.getElementById("plain") as HTMLButtonElement,
    };
  }

  it("writes the point on the control that wears the class, from a press on its child", () => {
    const { root, button } = shell();
    wireRipples(root);
    button.getBoundingClientRect = () =>
      ({ ...BOX, right: 300, bottom: 90, x: 100, y: 50 }) as DOMRect;
    const child = button.querySelector("span") as HTMLElement;
    child.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, clientX: 150, clientY: 60 }) as PointerEvent,
    );
    expect(button.style.getPropertyValue("--ui-x")).toBe("25.0%");
    expect(button.style.getPropertyValue("--ui-y")).toBe("25.0%");
    expect(button.hasAttribute(PRESS_ATTRIBUTE)).toBe(true);
  });

  it("rings on every button of the chrome, and leaves a plain one and a disabled one alone", () => {
    const { root, plain, button } = shell();
    wireRipples(root);
    plain.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }) as PointerEvent);
    expect(plain.hasAttribute(PRESS_ATTRIBUTE)).toBe(false);
    button.disabled = true;
    button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }) as PointerEvent);
    expect(button.hasAttribute(PRESS_ATTRIBUTE)).toBe(false);
  });

  it("replays on a second press and lets go on the ring's own end, not a child's", () => {
    const { button } = shell();
    const end = (pseudoElement: string) =>
      Object.assign(new Event("animationend", { bubbles: true }), { pseudoElement });
    press(button, { clientX: 0, clientY: 0 });
    expect(button.hasAttribute(PRESS_ATTRIBUTE)).toBe(true);
    press(button, { clientX: 0, clientY: 0 });
    expect(button.hasAttribute(PRESS_ATTRIBUTE)).toBe(true);
    // Undo's arrow turning on the same press ends first sometimes; it must not cut the ring.
    button.querySelector("svg")?.dispatchEvent(end(""));
    expect(button.hasAttribute(PRESS_ATTRIBUTE), "a child's end let the ring go").toBe(true);
    button.dispatchEvent(end("::after"));
    expect(button.hasAttribute(PRESS_ATTRIBUTE), "another pseudo-element's end").toBe(true);
    button.dispatchEvent(end("::before"));
    expect(button.hasAttribute(PRESS_ATTRIBUTE)).toBe(false);
  });

  it("rings the part of a button that looks like one, from a press anywhere on the button", () => {
    document.body.innerHTML = `
      <div id="root"><button type="button">
        <span class="ui-interactive ui-ripple" data-rail-tile=""><svg></svg></span>
        <span class="ui-interactive" id="word">Estilo</span>
      </button></div>`;
    wireRipples(document.getElementById("root") as HTMLElement);
    const tile = document.querySelector("[data-rail-tile]") as HTMLElement;
    document
      .getElementById("word")
      ?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }) as PointerEvent);
    expect(tile.hasAttribute(PRESS_ATTRIBUTE), "a press on the word did not ring the tile").toBe(
      true,
    );
  });

  it("is removed by what it returns", () => {
    const { root, button } = shell();
    const off = wireRipples(root);
    off();
    button.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }) as PointerEvent);
    expect(button.hasAttribute(PRESS_ATTRIBUTE)).toBe(false);
  });
});
