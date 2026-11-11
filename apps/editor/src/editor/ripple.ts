/**
 * **The ring from where the press landed** (sprint 36 día 2, applied on día 6).
 *
 * A control wearing `ui-ripple` draws a circle on its `::before` that grows from the point of the
 * press; the stylesheet cannot know where that was, so one listener per shell writes it — `--ui-x`
 * and `--ui-y` as percentages of the control's box — and restarts the animation by taking the
 * `data-ui-press` attribute off and putting it back. One delegated `pointerdown` on the shell's
 * root rather than a handler on every button: the vocabulary is a class, and the class is enough.
 *
 * Touch as much as mouse: a finger's press is the one most worth answering, since the finger
 * covers the control. Under `prefers-reduced-motion` the global block flattens the animation to
 * nothing, so this module has nothing to decide.
 */

export const RIPPLE_CLASS = "ui-ripple";
export const PRESS_ATTRIBUTE = "data-ui-press";

/** Where the press landed, as percentages of the control's box, clamped to it. */
export function ripplePoint(
  pointer: { clientX: number; clientY: number },
  box: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  if (box.width <= 0 || box.height <= 0) return { x: 50, y: 50 };
  return {
    x: clamp(((pointer.clientX - box.left) / box.width) * 100),
    y: clamp(((pointer.clientY - box.top) / box.height) * 100),
  };
}

/** Writes the press point on the control and replays its ring. */
export function press(control: HTMLElement, pointer: { clientX: number; clientY: number }): void {
  const { x, y } = ripplePoint(pointer, control.getBoundingClientRect());
  control.style.setProperty("--ui-x", `${x.toFixed(1)}%`);
  control.style.setProperty("--ui-y", `${y.toFixed(1)}%`);
  // Off and on again in the same task, with a forced style read between, so a second press
  // during the first ring restarts it instead of being swallowed.
  control.removeAttribute(PRESS_ATTRIBUTE);
  void control.offsetWidth;
  control.setAttribute(PRESS_ATTRIBUTE, "");
  control.addEventListener("animationend", () => control.removeAttribute(PRESS_ATTRIBUTE), {
    once: true,
  });
}

/** One listener on a root, for every `ui-ripple` control under it; returns the way to remove it. */
export function wireRipples(root: HTMLElement): () => void {
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Element | null;
    const control = target?.closest?.(`.${RIPPLE_CLASS}`) as HTMLElement | null;
    if (!control || (control as HTMLButtonElement).disabled) return;
    press(control, event);
  };
  root.addEventListener("pointerdown", onPointerDown);
  return () => root.removeEventListener("pointerdown", onPointerDown);
}
