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
/**
 * **One width for every rail panel, and the reason is the person editing rather than the layout.**
 *
 * They were three: 372 for «Estilo», 288 for «Diseño», 340 for the other four. Each was sensible on
 * its own and together they meant the canvas resized on every change of tool — measured at 1440,
 * the editing area took three widths (916, 948, 1000) and jumped up to **84px** between one tool
 * and the next. Worse than the jump: the preview is a live page, so each of those widths is a
 * different viewport and the whole site re-laid-out every time somebody reached for a different
 * tool.
 *
 * Direction asked for it to stop, in those terms: «limitar la fatiga ocular de la persona que edita
 * su página web cambiando constantemente de herramientas».
 *
 * **340 rather than the widest, measured both ways.** At 340 and at 372 the canvas stops moving
 * entirely — 0px between tools — and no panel overflows horizontally at either. 340 wins on the
 * only thing left: it leaves the editing area 32px wider, and it is the width four of the six
 * already used, so it is the smallest change that buys the whole of it.
 */
export const PANEL_WIDTH = "w-[340px] phone:w-auto";

/**
 * **A sheet from the bottom on a phone, a card beside the canvas everywhere else (ADR 0042 §2,
 * sprint 21 day 4).** Below 720 the panel is `fixed`, pinned to **exactly** the room the rail's own
 * bottom bar reserves — `calc(56px + env(safe-area-inset-bottom))`, the same expression
 * `EditorShell`'s canvas row uses to leave the bar its space — so it sits flush above the bar
 * rather than guessing its height as a round number. Capped at 70% of the dynamic viewport so
 * there is always canvas showing above it: a panel that could cover the whole screen would be
 * indistinguishable from a second page. `rounded-b-none` because a sheet's bottom edge is the
 * screen's own edge, not a corner.
 *
 * `ui-enter-right` still runs on a phone — `translateX` under a `scale()`-free sheet reads as a
 * slide up its own short travel, not sideways, because the sheet's starting position (off past the
 * bar) is below the fold either way. Nothing here depends on the direction reading correctly; only
 * that something enters rather than appearing.
 */
export const panelCard = `ui-enter-right flex shrink-0 flex-col rounded-ui-lg border border-ui-border bg-ui-surface shadow-ui-1 ${panelShell} phone:fixed phone:inset-x-0 phone:bottom-[calc(56px+env(safe-area-inset-bottom))] phone:z-20 phone:max-h-[70dvh] phone:rounded-b-none phone:border-b-0 phone:shadow-ui-3`;

/**
 * The X that closes a panel, which five of the six rail panels and the fields panel all drew by
 * hand — the same 16×16 two-stroke cross, differing only in whether the diagonal paths were
 * written `M6 6l12 12M18 6L6 18` or `M18 6L6 18M6 6l12 12`, which draw the same cross. One
 * component past the third use (`PagesPanel` and `PhotosPanel` joined it on sprint 21 day 4, when
 * a sheet that cannot be closed became a trap rather than a layout oddity). `CollectionsPanel`
 * keeps its own text «Cerrar» at the foot of the list, which is a different decision about where
 * the exit belongs and not an omission this component fixes.
 */
export function PanelClose({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="shrink-0 cursor-pointer border-0 bg-transparent text-ui-muted"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

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
        danger ? "text-ui-danger-deep" : "text-ui-muted"
      } ${disabled ? "opacity-40" : "cursor-pointer hover:bg-ui-bg hover:text-ui-ink"}`}
    >
      {label}
    </button>
  );
}
