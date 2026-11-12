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
/** Every control the ring answers: each button of the chrome that answers the press, and anything
 * that opts in (sprint 36 día 6, David's decision 4). */
export const RIPPLE_SELECTOR = `.${RIPPLE_CLASS}, button.ui-interactive`;
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
  // Let go on the ring's own end — the control's `::before` — and on nothing else: a child's
  // animation keyed to the same press (undo's arrow turning) would end it early and cut the ring.
  const done = (event: Event) => {
    if (event.target !== control || (event as AnimationEvent).pseudoElement !== "::before") return;
    control.removeEventListener("animationend", done);
    control.removeAttribute(PRESS_ATTRIBUTE);
  };
  control.addEventListener("animationend", done);
}

/** One listener on a root, for every `ui-ripple` control under it; returns the way to remove it. */
export function wireRipples(root: HTMLElement): () => void {
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Element | null;
    /*
     * The control itself, or — for a button whose visible part is one piece of it, like the rail's
     * items, whose chip is the icon's square and whose word sits below it — that piece, marked
     * `.ui-ripple`: a press anywhere on the button rings the part that looks like the button.
     */
    const control = (target?.closest?.(RIPPLE_SELECTOR) ??
      target?.closest?.("button")?.querySelector(`.${RIPPLE_CLASS}`) ??
      null) as HTMLElement | null;
    if (!control || (control as HTMLButtonElement).disabled) return;
    press(control, event);
  };
  root.addEventListener("pointerdown", onPointerDown);
  return () => root.removeEventListener("pointerdown", onPointerDown);
}
