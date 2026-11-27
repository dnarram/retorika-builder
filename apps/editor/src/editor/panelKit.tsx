"use client";

import {
  type ComponentProps,
  type PointerEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";
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
 * **Positioned, one layer over the canvas and under every dialog** (`relative z-[11]` beside the
 * dialogs' 20 and 30; sprint 35 día 2). A panel replaced by another is seen to go by a copy drawn
 * where it was, at layer 10 (`editor/leaving.ts`): over the canvas, so a closing panel is seen
 * leaving across the room the canvas has just taken back, and under the panel arriving in its place,
 * which in a cross is the one that has to be read. An unpositioned panel is painted under every
 * positioned thing, the copy included, which is how the first version drew the old panel over the
 * new. On a phone the sheet is `fixed` at 20 already, which keeps the same order.
 *
 * `ui-enter-right` still runs on a phone — `translateX` under a `scale()`-free sheet reads as a
 * slide up its own short travel, not sideways, because the sheet's starting position (off past the
 * bar) is below the fold either way. Nothing here depends on the direction reading correctly; only
 * that something enters rather than appearing.
 */
export const panelCard = `ui-enter-right ui-scroll-shade relative z-[11] flex shrink-0 flex-col rounded-ui-lg border border-ui-border bg-ui-surface shadow-ui-1 ${panelShell} phone:fixed phone:inset-x-0 phone:bottom-[calc(56px+env(safe-area-inset-bottom))] phone:z-20 phone:max-h-[70dvh] phone:rounded-b-none phone:border-b-0 phone:shadow-ui-3`;

/**
 * **The frame of every right-hand panel, whole** (sprint 38 día 5): the width, the card, and the one
 * padding and gap. Seven panels wrote `PANEL_WIDTH gap-4 p-5 panelCard` and «Estilo» wrote its own
 * `gap-[18px] p-6`, which put its title four pixels off every other panel's; from today the eight
 * take their frame from here and cannot drift apart again.
 */
export const panelFrame = `${PANEL_WIDTH} gap-4 p-5 ${panelCard}`;

/**
 * The X that closes a panel, which five of the six rail panels and the fields panel all drew by
 * hand — the same 16×16 two-stroke cross, differing only in whether the diagonal paths were
 * written `M6 6l12 12M18 6L6 18` or `M18 6L6 18M6 6l12 12`, which draw the same cross. One
 * component past the third use (`PagesPanel` and `PhotosPanel` joined it on sprint 21 day 4, when
 * a sheet that cannot be closed became a trap rather than a layout oddity). `CollectionsPanel` kept
 * its own text «Cerrar» at the foot of the list until sprint 39 día 2, when it took the cross the
 * other seven have.
 */
export function PanelClose({
  onClick,
  label,
  className = "",
}: {
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // A round target of 32 px around the 16 px cross (sprint 38 día 5): the cross was its own
      // hit area, a 16 px square at the panel's corner — the smallest control of the chrome. The
      // ripple and the hover ground are the vocabulary's; the negative margin keeps the cross where
      // it always sat beside the title.
      className={`ui-interactive -mt-1.5 -mr-1.5 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ui-muted hover:bg-ui-bg hover:text-ui-ink ${className}`}
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
  "ui-interactive rounded-ui border border-ui-brand bg-ui-brand-surface ring-[3px] ring-ui-brand-surface";

/**
 * **A row that is chosen by pressing it** — a palette, a letter, a scale, a segment (sprint 38 día 5):
 * the row and its selected twin, with the vocabulary's ripple from where the press landed. Apart from
 * `panelRow` because most rows are not this: a page's row in «Páginas» holds buttons, and a ring
 * spreading across a whole row that answers no press of its own would say something false.
 */
export const panelChoice = `${panelRow} ui-ripple`;
export const panelChoiceSelected = `${panelRowSelected} ui-ripple`;

/**
 * **A picture comes into focus as it arrives** (sprint 39 día 6, David's half of P5): the thumbnails
 * of «Fotos» and the logo's swatch in «Menú» take `ui-blur-in` when their bytes have arrived — on
 * `load`, not on mounting, or an image still loading would run its arrival empty. Written on the node,
 * so a re-render that keeps the same picture keeps it sharp and does not arrive again.
 */
export function arriveSharp(event: { currentTarget: HTMLImageElement }): void {
  event.currentTarget.classList.add("ui-blur-in");
}

/**
 * **The box a card is pressed by** (sprint 39 día 6): transparent, still, the focus ring's. On a
 * `label` around a hidden radio, `ui-choice` draws the ring on the box, since the radio is one pixel.
 * Everything the eye reads as the card is its `Face`.
 */
export const pressBox = "relative block w-full cursor-pointer rounded-ui text-left";
export const pressLabel = `${pressBox} ui-choice`;

/**
 * **The face of a card** (sprint 39 día 6, David's P4 with his adjustment 2): border, background, the
 * chosen ring and the shadow, which rise together under the mouse while the box stays where it is
 * (`ui-face`). The ripple is the face's too, so the press rings where the card is drawn. `className`
 * is the card's own inside: its layout and padding, which used to sit on the box.
 */
export function Face({
  chosen,
  className = "",
  children,
}: {
  chosen: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      data-ui-face=""
      {...(chosen ? { "data-chosen": "" } : {})}
      className={`ui-face ui-ripple rounded-ui border ${
        chosen
          ? "border-ui-brand bg-ui-brand-surface ring-[3px] ring-ui-brand-surface"
          : "border-ui-border bg-ui-surface"
      } ${className}`}
    >
      {children}
    </span>
  );
}

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
  name,
  expanded,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** The accessible name, where the visible word repeats down a list («Subir «Galería»»). */
  name?: string;
  /** For a button that unfolds what follows it. */
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...(name === undefined ? {} : { "aria-label": name })}
      {...(expanded === undefined ? {} : { "aria-expanded": expanded })}
      className={`ui-interactive rounded-ui-sm px-2 py-1 text-[12px] font-semibold ${
        danger ? "text-ui-danger-deep" : "text-ui-muted"
      } ${disabled ? "opacity-40" : "cursor-pointer hover:bg-ui-bg hover:text-ui-ink"}`}
    >
      {label}
    </button>
  );
}

/**
 * **The head of every right-hand panel** (sprint 38 día 5, David's P8: «el rediseño entra por las
 * piezas compartidas»). The title at one size for all eight — they were 20, 15 and 13 px, three
 * sizes for one role — a sentence of help under it when the panel has one, and the cross. The `h2`
 * keeps the id the panel's landmark is labelled by, so no landmark, role or name changes.
 */
export function PanelHeader({
  id,
  title,
  help,
  close,
}: {
  id: string;
  title: ReactNode;
  help?: ReactNode;
  close?: { label: string; onClick: () => void };
}) {
  // A grid rather than a row with a column inside it: the help runs the panel's whole width under
  // the title instead of beside the cross, which took a third of a line from every sentence of help
  // once the cross became a 32 px target. Placed by the grid, not moved in the markup: the title, the
  // help and the cross are read in the order they always were.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1">
      <h2
        id={id}
        className="col-start-1 row-start-1 m-0 text-[20px] font-bold leading-tight tracking-[-0.02em] text-ui-ink"
      >
        {title}
      </h2>
      {help === undefined ? null : <Note className="col-span-2 row-start-2">{help}</Note>}
      {close ? (
        <PanelClose
          onClick={close.onClick}
          label={close.label}
          className="col-start-2 row-start-1"
        />
      ) : null}
    </div>
  );
}

/**
 * **A group of a panel**: a `fieldset` and its legend in small capitals, ruled off from what is above
 * it by a hairline (sprint 38 día 5). The legend floats so the rule runs whole above it — a legend in
 * a bordered fieldset otherwise sits *on* the border and cuts it — which is the trick «Menú» already
 * used for its boxed blocks. The legend's words are the document's, unchanged: small capitals are
 * drawn by the stylesheet, so the group's accessible name is what it always was.
 */
export function PanelSection({
  legend,
  children,
  className = "",
  ...rest
}: { legend: ReactNode } & ComponentProps<"fieldset">) {
  return (
    <fieldset
      {...rest}
      className={`m-0 flex min-w-0 flex-col gap-[9px] border-0 border-t border-solid border-ui-border p-0 pt-4 ${className}`}
    >
      <legend className="float-left mb-1 w-full p-0 text-[11px] font-bold uppercase tracking-[0.09em] text-ui-muted">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * **Whether a note's sentence fades in** (sprint 39 día 5, David's P2): when it differs from the one
 * the note was first drawn with. The first sentence is drawn as it is — the panel's rows already arrive
 * (`data-ui-rows`), and a note that faded on opening would be a second arrival on the same row — and a
 * sentence the hand changed by moving a control beside it comes in on `ui-cross-in`, opacity alone,
 * `--ui-fast`. Back to the first sentence, nothing fades: the first one is the panel's own.
 */
export function noteFades(first: ReactNode, text: string): boolean {
  return text !== first;
}

/**
 * **A panel's note**: the sentence beside a control that says what it does or why it cannot (sprint
 * 38 día 5). One size and one grey, written by hand in four panels before, and one amber for the
 * notes that warn, which `--ui-warn-deep` now holds instead of a hex in each file.
 *
 * **Its sentence fades when it changes** (sprint 39 día 5): keyed by its text, so a new sentence is a
 * new node that arrives on `ui-cross-in`, and a re-render with the same sentence is the same node and
 * moves nothing. Only a plain sentence — a note that holds markup is drawn as it is. The height still
 * jumps when the new sentence has more lines than the old: only opacity moves, never the layout.
 */
export function Note({
  tone = "muted",
  as = "p",
  className = "",
  children,
  ...rest
}: { tone?: "muted" | "warn"; as?: "p" | "span" } & ComponentProps<"p">) {
  const first = useRef<ReactNode>(children);
  const body =
    typeof children === "string" && noteFades(first.current, children) ? (
      <span key={children} className="ui-cross-in">
        {children}
      </span>
    ) : (
      children
    );
  const colour = tone === "warn" ? "text-ui-warn-deep" : "text-ui-muted";
  // A `span` for the second line of a label — a checkbox's «Se verá como…» — where a paragraph would
  // be invalid HTML; drawn as a block so it sits under the first line exactly as a paragraph would.
  if (as === "span") {
    return (
      <span {...rest} className={`block text-[12px] leading-snug ${colour} ${className}`}>
        {body}
      </span>
    );
  }
  return (
    <p {...rest} className={`m-0 text-[12px] leading-snug ${colour} ${className}`}>
      {body}
    </p>
  );
}

/**
 * What previews a choice before it is pressed: shown while the pointer is over an option, put back
 * when it leaves, forgotten when it is pressed (sprint 35 día 7 for the header's bar). Generic here
 * since the segments moved out of «Menú» (sprint 38 día 5): the header's previewer is one, and the
 * palette's will be another.
 */
export interface Previewer<P> {
  show(preview: P): void;
  end(mode: "restore" | "keep"): void;
}

/**
 * A closed choice as a row of segments. **With `preview` and a `previewer`, each option under the
 * mouse shows itself on the canvas's bar before it is pressed** (David's adjustment 3 on sprint 35):
 * the attribute it is drawn by, written as chrome and put back on leaving; a press forgets the
 * preview and writes the document. Only for a mouse — a touch has no hover, and a press there is the
 * choice — and never from the keyboard, where the arrows already choose.
 */
export function Segments<T extends string, P = never>({
  name,
  label,
  options,
  value,
  labelOf,
  onSelect,
  preview,
  previewer,
}: {
  name: string;
  label: string;
  options: readonly T[];
  value: T;
  labelOf: (option: T) => string;
  onSelect: (option: T) => void;
  preview?: (option: T) => P | null;
  previewer?: Previewer<P> | undefined;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const ghost = useRef<HTMLSpanElement>(null);
  /*
   * **The shadow of the mark, under the hand** (sprint 39 día 6, David's P3): the option the mouse is
   * on shows where the mark would go, at a third of its strength, following on `ui-follow`; the chosen
   * option has no shadow, since the mark is there; leaving the group or pressing takes it away, and
   * the mark itself lands on its spring. Written on the node, like the mark, so following the mouse is
   * no render. Appearing, it is placed before it is shown, so it fades in where it is instead of
   * gliding over from the last option it was under.
   */
  const under = (option: T | null) => {
    const host = grid.current;
    const shade = ghost.current;
    if (!host || !shade) return;
    const index = option === null || option === value ? -1 : options.indexOf(option);
    const segment = index < 0 ? null : host.querySelectorAll<HTMLElement>(":scope > label")[index];
    if (!segment) {
      shade.style.opacity = "0";
      return;
    }
    const box = segment.getBoundingClientRect();
    const from = host.getBoundingClientRect();
    const hidden = shade.style.opacity !== "0.3";
    if (hidden) shade.style.transitionProperty = "opacity";
    shade.style.width = `${box.width - 16}px`;
    shade.style.transform = `translate(${box.left - from.left + 8}px, ${box.bottom - from.top - 4}px)`;
    if (hidden) {
      void shade.offsetWidth;
      shade.style.transitionProperty = "";
    }
    shade.style.opacity = "0.3";
  };
  /*
   * **A mark slides under the chosen option** (sprint 35 día 7), as the page tabs' indicator does:
   * one bar for the group, placed under the checked segment's box and moved on `ui-slide` when the
   * choice changes, so the eye follows the choice from where it was. Written on the node rather than
   * through state, so the first placing happens before the first paint and nothing travels in from
   * the corner; a resize of the group — the sheet on a phone — places it again. Under reduced motion
   * the global block flattens `ui-slide`, and the mark is simply there.
   */
  useLayoutEffect(() => {
    const host = grid.current;
    const bar = mark.current;
    if (!host || !bar) return;
    const place = () => {
      // The segment of the option chosen, by its place among the options: what the mark follows.
      const chosen = host.querySelectorAll<HTMLElement>(":scope > label")[options.indexOf(value)];
      if (!chosen) {
        bar.style.opacity = "0";
        return;
      }
      bar.style.opacity = "1";
      // Read off the boxes and not `offsetLeft`, which rounds to whole pixels: three columns of a
      // 300-pixel group are not whole, and the mark sat most of a pixel off its segment.
      const box = chosen.getBoundingClientRect();
      const from = host.getBoundingClientRect();
      bar.style.width = `${box.width - 16}px`;
      bar.style.transform = `translate(${box.left - from.left + 8}px, ${box.bottom - from.top - 4}px)`;
    };
    place();
    const resized = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    resized?.observe(host);
    return () => resized?.disconnect();
  }, [value, options]);
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="m-0 mb-1 text-[12px] font-semibold text-ui-ink" aria-hidden="true">
        {label}
      </p>
      <div
        ref={grid}
        className={`relative grid gap-1.5 ${options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
      >
        <span
          ref={mark}
          data-testid="segment-mark"
          aria-hidden="true"
          className="ui-slide pointer-events-none absolute top-0 left-0 z-[1] h-[2px] rounded-full bg-ui-brand"
          style={{ opacity: 0 }}
        />
        <span
          ref={ghost}
          data-testid="segment-ghost"
          aria-hidden="true"
          className="ui-follow pointer-events-none absolute top-0 left-0 z-[1] h-[2px] rounded-full bg-ui-brand"
          style={{ opacity: 0 }}
        />
        {options.map((option) => (
          <Segment
            key={option}
            name={name}
            label={labelOf(option)}
            checked={value === option}
            onSelect={() => {
              under(null);
              previewer?.end("keep");
              onSelect(option);
            }}
            onHover={(on: boolean) => {
              under(on ? option : null);
              if (!previewer || !preview) return;
              const shown = on ? preview(option) : null;
              if (shown) previewer.show(shown);
              else previewer.end("restore");
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** One option of a short row of radios, drawn as a segment. */
export function Segment({
  name,
  label,
  checked,
  onSelect,
  onHover,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
  onHover?: (on: boolean) => void;
}) {
  // Whether the mouse is over this segment by a move of its own (the palette cards' rule, sprint 38
  // día 7): a segment can arrive under a mouse that has not moved — a block above it opens or closes
  // — and the browser says so with an entry and no move. The preview waits for the hand. Sprint 38
  // left the segments on `pointerenter`; this is that defect closed (sprint 39 día 6, P3).
  const hovering = useRef(false);
  return (
    <label
      {...(onHover
        ? {
            onPointerMove: (event: PointerEvent) => {
              if (event.pointerType !== "mouse" || hovering.current) return;
              hovering.current = true;
              onHover(true);
            },
            onPointerLeave: (event: PointerEvent) => {
              if (event.pointerType !== "mouse" || !hovering.current) return;
              hovering.current = false;
              onHover(false);
            },
          }
        : {})}
      className={`relative flex min-h-9 cursor-pointer items-center justify-center px-1.5 py-1 text-center text-[12px] leading-tight ${
        checked
          ? `${panelChoiceSelected} font-semibold text-ui-brand-deep`
          : `${panelChoice} text-ui-ink`
      }`}
    >
      {/* Visually hidden rather than `display: none`, so the arrows still move along the group. */}
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="absolute h-px w-px opacity-0"
      />
      {label}
    </label>
  );
}
