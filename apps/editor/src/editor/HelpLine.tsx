"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import es from "../locales/es.json" with { type: "json" };
import type { HelpLineSays } from "./helpLine.ts";
import { leave } from "./leaving.ts";

/**
 * **The help line** (ADR 0071, sprint 36 día 1): the one row of the chrome where an instruction is
 * said, so that none is ever drawn over the page being edited again — on a desktop at the foot of
 * the canvas area, on a phone above the card, in both cases outside the card and its zoom.
 *
 * **32 px, fixed, one line with an ellipsis** (David's condition): a message that changes must not
 * move the canvas by a pixel, so the row never grows and the whole sentence is in `title`.
 *
 * **Two children, both always in the page** (adjustment 1): the live one is a `role="status"` region
 * that exists before anything is said in it — a reader does not announce the contents of a region
 * that has just appeared — and it carries only what the person did not see coming; the quiet one
 * carries what goes with the focus and is `aria-live="off"`. When the live child has text it is
 * the one shown; the quiet one is hidden under it, not emptied, so the sentence it will say when
 * the live one falls silent is already there.
 *
 * The delete notice (ADR 0014) is live text with two buttons beside it, and it still arrives rising
 * and leaves as a copy sinking back (sprint 35 día 2): the behaviour moved with the words.
 */
export function HelpLine({
  live,
  quiet,
  onUndo,
  onDismiss,
  className = "",
  style,
}: {
  live: HelpLineSays;
  quiet: HelpLineSays;
  onUndo: () => void;
  onDismiss: () => void;
  className?: string;
  /** The shell's, for the line's place in the chrome's arrival (sprint 36 día 4). */
  style?: React.CSSProperties | undefined;
}) {
  const shown = live.text !== "" ? live : quiet;

  /**
   * **What arrives reveals itself; what changes cross-fades** (sprint 36 día 5, David's adjustment
   * 2: «el ritmo es para lo que llega, no para lo que cambia»). The live child's sentence — an
   * announcement, the delete notice, an error — arrives word by word (`ui-words`, at most seven
   * steps, the seventh carrying the rest), and once its last word has landed it is plain text again,
   * so the line's ellipsis works on it (an `inline-block` word is clipped, never ellipsised). The
   * quiet child's sentence changes with every Tab and every hovered choice, so it never reveals: the
   * new one fades in over a copy of the old one fading out, in the same box, on `--ui-fast`, with no
   * travel. The copy is outside the quiet child, `aria-hidden`, and takes no pointer, so the child's
   * own text is always exactly the current sentence.
   */
  const [revealed, setRevealed] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<{
    text: string;
    tone: HelpLineSays["tone"];
    n: number;
  } | null>(null);
  const lastQuiet = useRef(quiet);
  const changes = useRef(0);
  useLayoutEffect(() => {
    const before = lastQuiet.current;
    lastQuiet.current = quiet;
    if (before.text === quiet.text) return;
    changes.current += 1;
    setLeaving({ text: before.text, tone: before.tone, n: changes.current });
  }, [quiet]);

  return (
    <div
      data-testid="help-line"
      data-help-tone={shown.tone}
      data-help-child={shown.child}
      className={`flex h-8 shrink-0 items-center gap-3 overflow-hidden px-1 text-[13px] leading-4 ${className}`}
      style={style}
    >
      <p
        data-testid="help-line-live"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        title={live.text || undefined}
        // Never `display: none` while empty: a region a reader cannot see when it is silent is one
        // whose next sentence may not be read. It keeps its place at zero width instead, and takes
        // the row when it has something to say.
        className={`m-0 min-w-0 truncate ${toneClass(live.tone)} ${live.text === "" ? "w-0 flex-none" : "flex-grow"}`}
        // The tone's colour changes on the same 120 ms as everything that answers in this line.
        style={{ transition: "color var(--ui-fast) var(--ui-ease)" }}
      >
        {live.text === "" ? null : (
          <span
            // Keyed by the sentence, so a new one is a new arrival; a notice that goes leaves a
            // copy sinking away (`leaving.ts`). The words are its arrival now, not a rise.
            key={live.text}
            ref={live.notice ? leavesAsNotice : undefined}
            className={revealed === live.text ? undefined : "ui-words"}
            onAnimationEnd={(event) => {
              if ((event.target as HTMLElement).hasAttribute("data-ui-word-last")) {
                setRevealed(live.text);
              }
            }}
          >
            {revealed === live.text ? live.text : wordsOf(live.text)}
          </span>
        )}
      </p>
      <div
        className={`relative min-w-0 flex-grow ${live.text === "" ? "" : "hidden"}`}
        data-help-quiet-box=""
      >
        <p
          // A new sentence is a new node, which is what makes its fade an arrival.
          key={quiet.text}
          data-testid="help-line-quiet"
          aria-live="off"
          title={quiet.text}
          hidden={live.text !== ""}
          className={`ui-cross-in m-0 truncate ${toneClass(quiet.tone)}`}
        >
          {quiet.text}
        </p>
        {leaving && live.text === "" ? (
          <span
            key={leaving.n}
            aria-hidden="true"
            data-help-leaving=""
            // Its words painted, never written (`[data-leaving-text]::before`), like every exit copy
            // since sprint 35: nothing — a search, a locator, axe's contrast — can take a sentence
            // on its way out at half its opacity for the line's own.
            data-leaving-text={leaving.text}
            className={`ui-cross-out pointer-events-none absolute inset-0 truncate ${toneClass(leaving.tone)}`}
            onAnimationEnd={() => setLeaving((now) => (now?.n === leaving.n ? null : now))}
          />
        ) : null}
      </div>
      {live.notice ? (
        <>
          <button
            type="button"
            onClick={onUndo}
            className="ui-interactive h-6 shrink-0 cursor-pointer rounded-[7px] border-0 bg-ui-ink px-3 text-[12px] font-semibold text-white"
          >
            {es["editor.toast.undo"]}
          </button>
          {live.notice.dismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={es["editor.toast.dismiss"]}
              className="ui-interactive flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-[7px] border-0 bg-transparent text-ui-muted"
            >
              <svg
                width="14"
                height="14"
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
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** The cap of the reveal: seven steps of `--ui-stagger`, the proposals' own, so the longest sentence
 * is at rest inside the budget's 600 ms (120 + 6 × 40). */
export const WORD_STEPS = 7;

/**
 * A sentence as the words that arrive: one span per word up to the sixth, and the seventh carrying
 * the rest, so a long notice is still seven steps. Separated by real spaces, so the text the line
 * holds is the sentence exactly; the last span is marked, and its end is when the sentence is plain
 * text again.
 */
export function wordsOf(sentence: string) {
  const all = sentence.split(" ");
  const parts =
    all.length <= WORD_STEPS
      ? all
      : [...all.slice(0, WORD_STEPS - 1), all.slice(WORD_STEPS - 1).join(" ")];
  return parts.map((part, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a word's place is what it is; words repeat
    <Fragment key={index}>
      {index === 0 ? null : " "}
      <span
        data-ui-word=""
        data-ui-word-last={index === parts.length - 1 ? "" : undefined}
        style={{ "--ui-word-delay": `calc(var(--ui-stagger) * ${index})` } as React.CSSProperties}
      >
        {part}
      </span>
    </Fragment>
  ));
}

function toneClass(tone: HelpLineSays["tone"]): string {
  switch (tone) {
    case "error":
      return "text-ui-danger-deep font-medium";
    case "warn":
      return "text-[#92400E] font-medium";
    default:
      return "text-ui-muted";
  }
}

/** A module-level callback so the ref is the same on every render and React runs its cleanup once,
 * in the instant before the notice leaves the page. */
function leavesAsNotice(node: HTMLSpanElement | null): (() => void) | undefined {
  if (!node) return undefined;
  return () => leave(node, "toast");
}
