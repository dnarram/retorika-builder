"use client";

import { useEffect, useRef } from "react";
import es from "../locales/es.json" with { type: "json" };
import { BuildingMark } from "./BuildingMark.tsx";
import { LEAVING_FALLBACK_MS } from "./leaving.ts";

/**
 * «Estamos construyendo tu web» — the screen between «Descargar» and the ZIP (13 October 2026).
 *
 * It covers real work: the overflow measurement, the photographs gathered, the request, the ZIP
 * — and then holds for `MIN_BUILDING_MS` (David's decision, `buildingScreen.ts`). What it says
 * promises no duration: not «unos segundos», not «no cierres esta ventana» — the two claims
 * mockup 06 and mockup 11 taught this product not to make.
 *
 * **A status, not a dialog.** It asks nothing and cannot be dismissed, so it is `role="status"`
 * with `aria-live` and `aria-busy`, never `aria-modal` — `modalTrap.test.ts` counts the dialogs
 * and this is not one. The card takes the keyboard when it appears, because the button that had
 * it is disabled and would drop the focus on the body; the shell beneath is `inert` meanwhile
 * (David's adjustment: nothing that could change the document is reachable while it is being
 * built), and when the screen goes the keyboard returns to «Descargar», active again.
 *
 * The veil is the gate dialogs' own line, so the two read as one family; it never overlaps them,
 * because `requestDownload` lets this screen go before it opens a dialog.
 *
 * **It says the stage it is in, and only a stage that is running** (sprint 36 día 4): «Midiendo la
 * página en un móvil…» while the overflow is measured, «Reuniendo las fotos y las letras…» while they
 * are gathered, «Preparando los archivos…» while the request runs — each written by the download
 * the moment that stage starts, never by a timer, so the line never says a thing that is not
 * happening. The words arrive one after another (`ui-words`): this is what arrives, not what changes.
 *
 * **And it leaves toward «Descargar»** (`ui-scene-build`, the second of the two scenes of the
 * register): once the hold ends and the ZIP is handed over, the card contracts toward the button the
 * keyboard is about to return to, over `--ui-scene`, while the veil fades on `--ui-fast`. The exit is
 * the real card, not a copy: the screen is still a status until it is gone, and the shell stays
 * `inert` meanwhile. `onLeft` runs on the card's own `animationend` or after the fallback, once.
 */

export type BuildingStage = "measuring" | "photos" | "preparing";

/** The scene is `--ui-scene` (400 ms); the fallback has room for a slow frame on top. */
export const BUILD_LEAVE_FALLBACK_MS = 400 + LEAVING_FALLBACK_MS;

/** A sentence as its words, each with a key of its own: a word that repeats («las», «y») is told
 * apart by how many times it has appeared before it. */
function words(line: string): { word: string; key: string }[] {
  const seen = new Map<string, number>();
  return line.split(" ").map((word) => {
    const times = seen.get(word) ?? 0;
    seen.set(word, times + 1);
    return { word, key: `${word}-${times}` };
  });
}

export function BuildingScreen({
  returnFocusTo,
  stage = null,
  leaving = false,
  onLeft,
}: {
  returnFocusTo: string;
  stage?: BuildingStage | null;
  leaving?: boolean;
  onLeft?: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);

  useEffect(() => {
    card.current?.focus();
    return () => {
      const button = document.querySelector<HTMLElement>(
        `[data-building-return="${returnFocusTo}"]`,
      );
      button?.focus();
    };
  }, [returnFocusTo]);

  /** The keyboard goes back the moment the exit begins, not when it ends: a screen on its way out
   * must not hold it (sprint 36 día 4, the rule of every exit since sprint 35). */
  useEffect(() => {
    if (!leaving) return;
    document.querySelector<HTMLElement>(`[data-building-return="${returnFocusTo}"]`)?.focus();
  }, [leaving, returnFocusTo]);

  /**
   * The exit: the card's `transform-origin` is where «Descargar» is, measured the instant the exit
   * begins and written in the card's own pixels, so the contraction heads for the button whatever
   * the window. One `animationend` of the card itself, or the fallback — never both.
   */
  const left = useRef(onLeft);
  left.current = onLeft;
  useEffect(() => {
    const node = card.current;
    if (!leaving || !node) return;
    const button = document.querySelector<HTMLElement>(`[data-building-return="${returnFocusTo}"]`);
    const box = node.getBoundingClientRect();
    const target = button?.getBoundingClientRect();
    if (target) {
      node.style.transformOrigin = `${target.left + target.width / 2 - box.left}px ${
        target.top + target.height / 2 - box.top
      }px`;
    }
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      clearTimeout(fallback);
      node.removeEventListener("animationend", onEnd);
      left.current?.();
    };
    const onEnd = (event: AnimationEvent) => {
      if (event.target === node) go();
    };
    node.addEventListener("animationend", onEnd);
    const fallback = setTimeout(go, BUILD_LEAVE_FALLBACK_MS);
    return () => {
      clearTimeout(fallback);
      node.removeEventListener("animationend", onEnd);
    };
  }, [leaving, returnFocusTo]);

  const line = stage ? es[`editor.building.stage.${stage}`] : null;

  return (
    <div
      ref={veil}
      className="fixed inset-0 z-20 flex items-center justify-center bg-[#0F172A]/45 p-5"
      data-testid="building-screen"
      data-leaving={leaving ? "build" : undefined}
      data-stage={stage ?? undefined}
    >
      <div
        ref={card}
        role="status"
        aria-live="polite"
        aria-busy="true"
        tabIndex={-1}
        className={`${leaving ? "ui-scene-build" : "ui-fade-in"} flex w-full max-w-[420px] flex-col items-center gap-4 rounded-2xl bg-white px-6 py-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.28)] outline-none`}
      >
        <BuildingMark size={120} />
        <h2 className="m-0 text-[20px] font-bold tracking-[-0.02em] text-ui-ink">
          {es["editor.building.title"]}
        </h2>
        <p className="m-0 max-w-[320px] text-[14px] leading-snug text-ui-muted">
          {es["editor.building.body"]}
        </p>
        {/* Keyed by the stage, so each stage's words arrive afresh; `min-height` so the card does
            not grow when the first stage is written. */}
        <p
          key={stage ?? "none"}
          data-testid="building-stage"
          className="ui-words m-0 min-h-[20px] text-[13px] font-medium text-ui-brand-deep"
        >
          {line === null
            ? null
            : words(line).map(({ word, key }, index, all) => (
                <span
                  key={key}
                  data-ui-word=""
                  style={
                    {
                      "--ui-word-delay": `calc(var(--ui-stagger) * ${Math.min(index, 7)})`,
                    } as React.CSSProperties
                  }
                >
                  {word}
                  {index < all.length - 1 ? "\u00a0" : ""}
                </span>
              ))}
        </p>
      </div>
    </div>
  );
}
