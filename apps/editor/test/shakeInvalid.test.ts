// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { shakeInvalid } from "../src/questionnaire/ui.tsx";

/**
 * The questionnaire's one answer to an invalid press (sprint 36 día 3): what shakes, what does not,
 * and that a second press shakes again. That it moves four pixels and comes back inside 180 ms is the
 * stylesheet's (`ui-shake`, held by `motionBudget.test.ts`) and the walk's.
 */

afterEach(() => {
  document.body.innerHTML = "";
});

function card(): HTMLElement {
  document.body.innerHTML = `
    <div data-rb-card="">
      <input id="nombre" aria-invalid="true" />
      <span data-field-error="invalid" class="ui-fade-in">Escribe el nombre de tu negocio.</span>
      <span data-field-error="notice" class="ui-fade-in">Ese archivo no es una imagen.</span>
      <input id="logo" />
    </div>`;
  return document.querySelector("[data-rb-card]") as HTMLElement;
}

describe("an invalid press", () => {
  it("shakes the invalid field and its error, and nothing else", () => {
    const root = card();
    shakeInvalid(root);
    const shaken = [...root.querySelectorAll(".ui-shake")].map(
      (el) => el.id || el.getAttribute("data-field-error"),
    );
    expect(shaken).toEqual(["nombre", "invalid"]);
  });

  it("keeps an error's own entrance class, so the shake never replays it", () => {
    const root = card();
    shakeInvalid(root);
    const error = root.querySelector('[data-field-error="invalid"]') as HTMLElement;
    expect(error.classList.contains("ui-fade-in")).toBe(true);
    // Never taken off at the end: off, the error's own entrance would play again.
    error.dispatchEvent(new Event("animationend"));
    expect(error.classList.contains("ui-shake")).toBe(true);
  });

  it("shakes again on a second press", () => {
    const root = card();
    shakeInvalid(root);
    const field = root.querySelector("#nombre") as HTMLElement;
    const removed: boolean[] = [];
    const original = field.classList.remove.bind(field.classList);
    field.classList.remove = (...tokens: string[]) => {
      removed.push(tokens.includes("ui-shake"));
      original(...tokens);
    };
    shakeInvalid(root);
    expect(removed, "the second press did not restart the shake").toEqual([true]);
    expect(field.classList.contains("ui-shake")).toBe(true);
  });

  it("does nothing for a card that has already left the page", () => {
    const root = card();
    root.remove();
    shakeInvalid(root);
    expect(root.querySelectorAll(".ui-shake")).toHaveLength(0);
    shakeInvalid(null);
  });
});
