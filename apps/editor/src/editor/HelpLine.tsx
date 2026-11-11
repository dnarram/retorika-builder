"use client";

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
}: {
  live: HelpLineSays;
  quiet: HelpLineSays;
  onUndo: () => void;
  onDismiss: () => void;
  className?: string;
}) {
  const shown = live.text !== "" ? live : quiet;
  return (
    <div
      data-testid="help-line"
      data-help-tone={shown.tone}
      data-help-child={shown.child}
      className={`flex h-8 shrink-0 items-center gap-3 overflow-hidden px-1 text-[13px] leading-4 ${className}`}
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
      >
        {live.text === "" ? null : (
          <span
            // Keyed by the sentence so a new notice is a new arrival, and a notice that goes
            // leaves a copy sinking the eight pixels it rose (`leaving.ts`).
            key={live.text}
            ref={live.notice ? leavesAsNotice : undefined}
            className={live.notice ? "ui-rise-in inline-block" : undefined}
          >
            <span>{live.text}</span>
          </span>
        )}
      </p>
      <p
        data-testid="help-line-quiet"
        aria-live="off"
        title={quiet.text}
        hidden={live.text !== ""}
        className={`m-0 min-w-0 flex-grow truncate ${toneClass(quiet.tone)}`}
      >
        {quiet.text}
      </p>
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
