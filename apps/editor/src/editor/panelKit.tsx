"use client";

import { panelShell } from "./EditorShell.tsx";

/**
 * The vocabulary the six rail panels share, because they did not share one.
 *
 * **What was actually wrong, counted rather than felt.** Three of the six drew themselves as a card
 * (`Estilo`, `Compartir`, `Diseño`) and three drew nothing at all, leaving their rows loose on the
 * grey (`Páginas`, `Fotos`, `Listas`) — so opening two different rail items gave two different
 * kinds of object. Row corners came in four radii depending on which panel you were in: 10px, 11px,
 * 9px and Tailwind's `rounded-md`. Two separate `SmallButton` components existed, disagreeing on
 * font size, weight, colour and whether `disabled` was even a prop. And four distinct reds were in
 * play across the chrome where one token existed.
 *
 * None of that was a decision. It is what happens when six screens are built in six sprints and
 * nothing holds them to each other, and it is most of what «años 2000» turned out to mean when the
 * panels were looked at side by side.
 *
 * This file is that missing thing. It is deliberately strings and one tiny component rather than a
 * `<Panel>` wrapper: the six differ in their *content* in ways no single wrapper would survive, and
 * the project's own rule is no abstraction until the third use — the shape is shared, the structure
 * is not.
 */

/**
 * A panel is a card, whatever is inside it.
 *
 * **It arrives rather than appearing.** `ui-enter-right` is a keyframe rather than a transition
 * because each of the six is a different component: switching rail items unmounts one and mounts
 * another, so there is no previous state to transition from and an entrance is the only thing that
 * can run. It costs nothing in layout — `translateX` and `opacity` — so the room opens at once and
 * the panel's contents travel into it.
 *
 * The caller still owns its width, which is the one measurement that is genuinely per-panel —
 * `Estilo` needs 372px for a row of swatches and a label, `Diseño` 288px — and `test/…` asserts
 * each stays constant across window sizes.
 */
export const panelCard = `ui-enter-right flex shrink-0 flex-col rounded-ui-lg border border-ui-border bg-ui-surface shadow-ui-1 ${panelShell}`;

/**
 * A row, and the hover that leads the eye along it.
 *
 * The resting border is `--ui-border`, a hairline that only separates. On hover it becomes
 * `--ui-border-strong`, which clears 3:1 — so the row the pointer is on is the one row whose edge
 * is genuinely visible, which is the whole trick of using hover to point.
 */
export const panelRow =
  "ui-interactive rounded-ui border border-ui-border bg-ui-surface hover:border-ui-border-strong";

/** The same row when it is the chosen one. Brand surface and brand border together, so it does not
 * depend on either alone. */
export const panelRowSelected =
  "ui-interactive rounded-ui border border-ui-brand bg-ui-brand-surface";

/**
 * The small verb that sits inside a row — «Subir», «Quitar esta ficha», «Cambiar el nombre».
 *
 * One component where there were two. `PagesPanel`'s was 12px semibold muted and knew about
 * `disabled`; `CollectionsPanel`'s was 11px medium ink and carried its own `#B91C1C` instead of the
 * danger token. This is the first one's treatment — the more legible of the two — with the second
 * one's callers gaining a disabled state they never had.
 */
export function SmallButton({
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`ui-interactive rounded-ui-sm px-2 py-1 text-[12px] font-semibold ${
        danger ? "text-ui-danger" : "text-ui-muted"
      } ${disabled ? "opacity-40" : "cursor-pointer hover:bg-ui-bg hover:text-ui-ink"}`}
    >
      {label}
    </button>
  );
}
