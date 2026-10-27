"use client";

import type { Theme } from "@retorika/schema";
import type { FontKey } from "@retorika/tokens";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  type ChooserRow,
  chooserRows,
  countText,
  initiallyRevealed,
  KIND_FILTERS,
  type KindFilter,
  sampleLine,
} from "../editor/fontChooser.ts";
import { galleryFaceCss } from "../editor/letterGallery.ts";
import { useFocusTrap } from "../editor/useFocusTrap.ts";
import es from "../locales/es.json" with { type: "json" };
import { TextField } from "./ui.tsx";

/**
 * The letter chooser: one half of the site's letter — the headings or the text — chosen from the
 * gallery by its real name (ADR 0046), in a dialog that is navigated rather than scrolled through
 * (sprint 29 día 1).
 *
 * **Why a dialog in `overlay`, and not a popover beside the row or a list inside the panel.** The
 * two alternatives were each measured against what the editor already knows: anything
 * `position: fixed` inside the shell's `children` is captured by the canvas card's
 * `transform: scale(zoom)` — the defect sprint 28 día 6 moved seven dialogs out of — so a popover
 * would have to live in `overlay` anyway, and at 390px it could not show a list of specimens at all.
 * A list inside the panel is a scroll region inside the sheet's own scroll region on a phone, and
 * eighty mounted rows each drawing text in a declared face, which fetches every face on unfold.
 * The dialog is the shape that keeps the panel's height independent of the number of families,
 * which was the whole request.
 *
 * **Choosing is live, and a session is one step.** A radio's `onChange` writes the token at once —
 * the canvas behind the dialog is the preview, and a staged choice with an «Aplicar» would be a
 * second copy of the answer. But forty rows under an arrow key would be forty undo steps, so the
 * history amends the session's step while the dialog is open (`chooseFamily` in
 * `documentHistory.ts`), «Hecho» closes it, and **Escape takes the letter back to what it was when
 * the dialog opened** — previewing is not choosing. The dialog itself knows none of this: it calls
 * `onPick`, `onDone` and `onCancel`, and `Editor.tsx` dispatches.
 *
 * **One radio group**, native, visually hidden inside each `<label>`, exactly as every group in the
 * Estilo panel: Tab enters it at the checked row and the arrows walk it, which is what the keyboard
 * walk in the e2e relies on and what a listbox built from `<div>`s would have to reimplement, worse.
 * Rows the search hides carry the `hidden` attribute — `display: none` — and not the sector grid's
 * `order: 1; visibility: hidden`: here the field sits in a header that does not scroll, so nothing
 * can jump, and a hidden radio is one the arrows skip in Chromium and Firefox, so the arrows walk
 * only the matches. The grid's trick would leave a blank tail at the foot of the list.
 *
 * **Faces arrive as rows come near.** A `@font-face` declared for a row is a download the moment
 * that row's text is laid out, visible or not, so the sheet below declares only the families in
 * `revealed`: the first screen and the chosen one on open, then whatever the `IntersectionObserver`
 * sees approaching. The set only grows, and it unmounts with the dialog — which is why this is a
 * `<style>` and not the `FontFace` API, which would have to be told to forget.
 */
export interface FontChooserDialogProps {
  theme: Theme;
  /** Which half is being chosen. One group per dialog: the two halves are separate choices. */
  fontKey: FontKey;
  /** The business's name, which is what every specimen is set in. */
  siteName: string;
  onPick: (family: string) => void;
  /** «Hecho»: the session's step is closed and the dialog goes. */
  onDone: () => void;
  /** Escape: the letter returns to what it was on open, and the dialog goes. */
  onCancel: () => void;
}

/** How far outside the list a row may be and still have its face declared, so a face is usually
 * loaded by the time its row scrolls in. Three rows. */
const REVEAL_MARGIN = "240px 0px";

export function FontChooserDialog({
  theme,
  fontKey,
  siteName,
  onPick,
  onDone,
  onCancel,
}: FontChooserDialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const searchId = `${id}-search`;
  const container = useFocusTrap(true, onCancel);
  const list = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const rows = useMemo(
    () => chooserRows(theme, fontKey, query, kind),
    [theme, fontKey, query, kind],
  );
  const [revealed, setRevealed] = useState(() => initiallyRevealed(rows));

  useEffect(() => {
    const root = list.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const arriving = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => (entry.target as HTMLElement).dataset.family)
          .filter((family): family is string => family !== undefined);
        if (arriving.length === 0) return;
        setRevealed((current) => {
          if (arriving.every((family) => current.has(family))) return current;
          const next = new Set(current);
          for (const family of arriving) next.add(family);
          return next;
        });
      },
      { root, rootMargin: REVEAL_MARGIN },
    );
    for (const row of root.querySelectorAll<HTMLElement>("[data-family]")) observer.observe(row);
    return () => observer.disconnect();
    // The rows are all mounted on the first render and never change identity, so the observer is
    // made once; what changes under it is `hidden`, which the observer sees as leaving.
  }, []);

  const sample = sampleLine(siteName);
  const title =
    fontKey === "font.heading"
      ? es["editor.style.chooser.title.heading"]
      : es["editor.style.chooser.title.body"];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0F172A]/45 p-5 phone:items-end phone:p-0">
      <div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-[520px] flex-col gap-4 rounded-ui-xl bg-ui-surface p-6 shadow-ui-3 phone:max-h-[85dvh] phone:rounded-b-none"
      >
        <style>{galleryFaceCss([...revealed])}</style>

        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="m-0 text-[17px] font-bold text-ui-ink">
            {title}
          </h2>
          <p className="m-0 text-[13px] leading-snug text-ui-muted">
            {es["editor.style.chooser.travels"]}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <TextField
            id={searchId}
            type="search"
            label={es["editor.style.chooser.search.label"]}
            placeholder={es["editor.style.chooser.search.placeholder"]}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            height={44}
            autoComplete="off"
            data-initial-focus
          />
          {/* The chips are one radio group too: a single Tab stop, and the arrows change the
              filter — the same shape as every other choice in the Estilo panel, so the keyboard
              finds nothing new to learn here. */}
          <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
            <legend className="sr-only">{es["editor.style.chooser.kinds"]}</legend>
            {KIND_FILTERS.map((option) => {
              const selected = kind === option;
              return (
                <label
                  key={option}
                  className={
                    "ui-interactive relative flex h-8 cursor-pointer items-center rounded-ui-sm border px-3 text-[13px] " +
                    (selected
                      ? "border-ui-brand bg-ui-brand-surface font-semibold text-ui-ink"
                      : "border-ui-border bg-ui-surface font-medium text-ui-ink hover:border-ui-border-strong")
                  }
                >
                  <input
                    type="radio"
                    name={`${id}-kind`}
                    checked={selected}
                    onChange={() => setKind(option)}
                    className="absolute h-px w-px opacity-0"
                  />
                  {es[`editor.style.chooser.kind.${option}`]}
                </label>
              );
            })}
          </fieldset>
          <p aria-live="polite" className="m-0 text-[12px] leading-snug text-ui-muted">
            {countText(rows)}
          </p>
        </div>

        {/* `min-h-0` is what lets a flex child shrink below its content and scroll, which is the
            lesson `DownloadGateDialogs.tsx` records: without it the list grows past the box and the
            footer leaves the screen.

            **The scroller is a `div`, never the `fieldset`.** Chromium lays a scrolling fieldset out
            correctly — its box ended at 800px of a 900px window, 1744px of rows inside — and then
            paints its positioned children past the clip: twenty-five rows drew over «Hecho» and took
            its click (sprint 29 día 2, the first time the list outgrew its box; eight rows fitted).
            Each row is `relative` for its hidden radio, so the fieldset keeps the group and the
            legend and the `div` around it does the clipping. It is also the observer's root. */}
        <div ref={list} className="min-h-0 overflow-y-auto">
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="sr-only">{title}</legend>
            {rows.map((row) => (
              <SpecimenRow
                key={row.family}
                row={row}
                group={`${id}-${fontKey}`}
                sample={sample}
                onPick={onPick}
              />
            ))}
          </fieldset>
          {/* David's condition 2: the families an owner may look for and not find are named, with
              the reason. Under the list, where the search for one ends. It does not yet say how to
              bring one in — «Subir mi fuente» is día 5's, and this line gains that clause in the
              same pull request as the button, never before it exists. */}
          <p className="m-0 mt-3 text-[12px] leading-snug text-ui-muted">
            {es["editor.style.chooser.notIncluded"]}
          </p>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onDone}
            className="h-10 cursor-pointer rounded-ui-sm border-0 bg-ui-brand px-4 text-[14px] font-semibold text-white"
          >
            {es["editor.style.chooser.done"]}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One family: its name set in its own face, the business's name under it in the same face, and
 * the species in grey. **The name is the specimen** — there is no `aria-hidden` «Aa» beside it,
 * because a row whose own words are drawn in the letter needs no second sample and the radio's
 * accessible name is simply the label's text.
 */
function SpecimenRow({
  row,
  group,
  sample,
  onPick,
}: {
  row: ChooserRow;
  group: string;
  sample: string;
  onPick: (family: string) => void;
}) {
  return (
    <label
      data-family={row.family}
      hidden={!row.visible}
      className={
        "ui-interactive relative flex h-16 shrink-0 cursor-pointer items-center justify-between gap-3 rounded-ui border px-4 " +
        (row.chosen
          ? "border-ui-brand bg-ui-brand-surface"
          : "border-ui-border bg-ui-surface hover:border-ui-border-strong")
      }
    >
      <input
        type="radio"
        name={group}
        value={row.family}
        checked={row.chosen}
        onChange={() => onPick(row.family)}
        // Visually hidden rather than `display: none`, like every group in the panel: a hidden
        // input leaves the tab order and the group, and the arrows stop.
        className="absolute h-px w-px opacity-0"
      />
      <span className="flex min-w-0 flex-col gap-0.5" style={{ fontFamily: `'${row.family}'` }}>
        <span
          className={
            "truncate text-[18px] leading-tight text-ui-ink " + (row.chosen ? "font-semibold" : "")
          }
        >
          {row.family}
        </span>
        <span aria-hidden="true" className="truncate text-[13px] leading-tight text-ui-muted">
          {sample}
        </span>
      </span>
      {/* Visual only: the radio's name is the family and nothing else, and the species is what
          the chips above already say out loud. */}
      <span
        aria-hidden="true"
        className="shrink-0 text-[11px] font-semibold tracking-[0.06em] text-ui-muted"
      >
        {es[`editor.style.chooser.kind.${row.kind}`]}
      </span>
    </label>
  );
}
