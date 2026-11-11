/**
 * **A control that leans toward the pointer** (sprint 36 día 2, applied on día 6 to «Descargar»
 * and nothing else — `test/motionBudget.test.ts` counts).
 *
 * At most `MAGNET_REACH_PX` in each direction, toward where the pointer is over the control, and
 * back to rest with the spring when it leaves. Decorative, and said so in REVIEW: nothing is
 * behind it that is not also without it. Only where there is a pointer that hovers, and nothing at
 * all for somebody who asked for less movement — checked here before the first listener, besides
 * the stylesheet's own rule.
 */

export const MAGNET_REACH_PX = 4;

/** How far the control leans, from where the pointer is relative to the control's centre. */
export function magnetOffset(
  pointer: { clientX: number; clientY: number },
  box: { left: number; top: number; width: number; height: number },
  reach = MAGNET_REACH_PX,
): { x: number; y: number } {
  if (box.width <= 0 || box.height <= 0) return { x: 0, y: 0 };
  const dx = (pointer.clientX - (box.left + box.width / 2)) / (box.width / 2);
  const dy = (pointer.clientY - (box.top + box.height / 2)) / (box.height / 2);
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  return {
    x: Math.round(clamp(dx) * reach * 10) / 10,
    y: Math.round(clamp(dy) * reach * 10) / 10,
  };
}

/** Whether this window has a hovering pointer and no request for less movement. */
export function magnetAllowed(view: Window): boolean {
  return (
    view.matchMedia("(hover: hover)").matches &&
    !view.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Leans `control` toward the pointer while it is over it; returns the way to stop. */
export function wireMagnet(control: HTMLElement): () => void {
  const view = control.ownerDocument.defaultView;
  if (!view || !magnetAllowed(view)) return () => {};
  const lean = (event: PointerEvent) => {
    const { x, y } = magnetOffset(event, control.getBoundingClientRect());
    control.style.setProperty("--ui-mx", `${x}px`);
    control.style.setProperty("--ui-my", `${y}px`);
  };
  const rest = () => {
    control.style.setProperty("--ui-mx", "0px");
    control.style.setProperty("--ui-my", "0px");
  };
  control.addEventListener("pointermove", lean);
  control.addEventListener("pointerleave", rest);
  return () => {
    control.removeEventListener("pointermove", lean);
    control.removeEventListener("pointerleave", rest);
    rest();
  };
}
