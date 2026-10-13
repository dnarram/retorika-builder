"use client";

import { useEffect, useRef } from "react";
import es from "../locales/es.json" with { type: "json" };
import { BuildingMark } from "./BuildingMark.tsx";

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
 */
export function BuildingScreen({ returnFocusTo }: { returnFocusTo: string }) {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    card.current?.focus();
    return () => {
      const button = document.querySelector<HTMLElement>(
        `[data-building-return="${returnFocusTo}"]`,
      );
      button?.focus();
    };
  }, [returnFocusTo]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-[#0F172A]/45 p-5"
      data-testid="building-screen"
    >
      <div
        ref={card}
        role="status"
        aria-live="polite"
        aria-busy="true"
        tabIndex={-1}
        className="ui-fade-in flex w-full max-w-[420px] flex-col items-center gap-4 rounded-2xl bg-white px-6 py-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.28)] outline-none"
      >
        <BuildingMark size={120} />
        <h2 className="m-0 text-[20px] font-bold tracking-[-0.02em] text-ui-ink">
          {es["editor.building.title"]}
        </h2>
        <p className="m-0 max-w-[320px] text-[14px] leading-snug text-ui-muted">
          {es["editor.building.body"]}
        </p>
      </div>
    </div>
  );
}
