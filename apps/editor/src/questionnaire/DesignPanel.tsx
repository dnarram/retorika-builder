"use client";

import type { Placement, PlacementEdit, RetorikaDocument } from "@retorika/schema";
import { useId, useState } from "react";
import { boundsFor, designRows, selectedRowId, stepTo } from "../editor/designTree.ts";
import es from "../locales/es.json" with { type: "json" };

/**
 * «Diseño» — the fifth rail item, and the only one the switch adds (ADR 0025 §6, mockup 16 band 2).
 *
 * The element tree, and the `Colocación` family that moves and resizes inside the section's grid.
 * Rule 4 is not amended and is the reason this can exist: every number here is a column, a span or
 * a row, and there is no `x` or `y` anywhere.
 *
 * **The families open collapsed.** Dossier §4, in its own words: «encenderlo añade una puerta, no
 * descarga sesenta controles». And **no family is drawn for something that does not exist yet** —
 * a greyed `Tipografía` waiting for sprint 9 would be the dead button this editor has refused since
 * sprint 1 — so today there is exactly one family, and the panel does not pretend otherwise.
 *
 * **This sprint brings no dragging.** Guides that snap are phase 3 of the concept dossier and do not
 * fit in a day; stepping by column, row and width is what a professional reaches for anyway, over
 * the grid the canvas now draws. Saying so by name is what kept day 3 from eating the sprint.
 */

/** One number, with the two arrows that change it. */
function Stepper({
  label,
  placement,
  field,
  onStep,
}: {
  label: string;
  placement: Placement;
  field: keyof Omit<Placement, "elementId">;
  onStep: (edit: PlacementEdit) => void;
}) {
  const bounds = boundsFor(placement)[field];
  const down = stepTo(placement, field, -1);
  const up = stepTo(placement, field, 1);

  /**
   * The arrow is disabled when the press would be refused, never enabled-and-ignored.
   *
   * `setPlacement` returns the same document for the same numbers, so a clamping arrow would look
   * enabled, do nothing, and leave no trace — the dead button in its worst form, the one that looks
   * like it worked. `stepTo` answers `undefined` instead of the limit for exactly this.
   */
  const arrow = (next: number | undefined, direction: "down" | "up", aria: string) => (
    <button
      type="button"
      aria-label={aria}
      disabled={next === undefined}
      onClick={() => next !== undefined && onStep({ [field]: next })}
      className={
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-ui-border " +
        (next === undefined
          ? "text-ui-border"
          : "cursor-pointer text-ui-brand hover:bg-ui-brand-surface")
      }
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={direction === "down" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 flex-1 truncate text-[12px] text-ui-muted">{label}</span>
      <div className="flex items-center gap-1">
        {arrow(down, "down", `${label}: ${es["editor.design.less"]}`)}
        {/* `aria-live` so a screen reader hears the new number rather than only the arrow's label.
            `polite` because two quick presses should not queue two interruptions. */}
        <output
          aria-live="polite"
          className="w-8 text-center text-[13px] font-semibold text-ui-ink tabular-nums"
        >
          {placement[field]}
        </output>
        {arrow(up, "up", `${label}: ${es["editor.design.more"]}`)}
      </div>
      <span className="sr-only">{`${bounds.min}–${bounds.max}`}</span>
    </div>
  );
}

export function DesignPanel({
  document: doc,
  sectionId,
  sectionName,
  selectedElementId,
  onSelectElement,
  onSetPlacement,
  onClose,
}: {
  document: RetorikaDocument;
  /** The section being designed, or `null` when none is selected. */
  sectionId: string | null;
  sectionName: string | null;
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  onSetPlacement: (elementId: string, edit: PlacementEdit) => void;
  onClose: () => void;
}) {
  const headingId = useId();
  /** Collapsed on open, every time the panel opens, and not remembered. The dossier's safeguard is
   * about what encountering the tools feels like, which is a thing that happens on opening. */
  const [placementOpen, setPlacementOpen] = useState(false);

  const rows = sectionId === null ? [] : designRows(doc, sectionId);
  // The same resolution the canvas uses for its outline, from the same function — see
  // `selectedRowId` for what having two of them cost.
  const selectedId = selectedRowId(rows, selectedElementId);
  const selected = rows.find((row) => row.elementId === selectedId);

  return (
    <aside
      aria-labelledby={headingId}
      // Beside the canvas like the style panel, not fixed over it: the grid the canvas draws is
      // the thing being worked against, and a panel covering it would hide the answer.
      className="flex max-h-full w-[288px] shrink-0 flex-col gap-4 self-start overflow-y-auto rounded-[14px] border border-ui-border bg-ui-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={headingId} className="m-0 text-[13px] font-bold text-ui-ink">
            {es["editor.design.title"]}
          </h2>
          {sectionName ? (
            <p className="m-0 truncate text-[12px] text-ui-muted">{sectionName}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={es["editor.design.close"]}
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
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {sectionId === null ? (
        // A sentence saying what to do, not a disabled tree — the shape `PagesPanel` and
        // `PhotosPanel` both use for "you cannot do this from here yet".
        <p className="m-0 text-[12px] leading-snug text-ui-muted">
          {es["editor.design.noSection"]}
        </p>
      ) : rows.length === 0 ? (
        <p className="m-0 text-[12px] leading-snug text-ui-muted">{es["editor.design.notFree"]}</p>
      ) : (
        <>
          <div className="flex flex-col gap-[3px]">
            <span className="text-[11px] font-bold tracking-[0.06em] text-ui-muted">
              {es["editor.design.elements"]}
            </span>
            {rows.map((row) => (
              <button
                key={row.elementId}
                type="button"
                aria-pressed={row.elementId === selectedId}
                onClick={() => onSelectElement(row.elementId)}
                className={
                  "flex cursor-pointer items-center justify-between gap-2 rounded-[7px] border-0 px-2.5 py-1.5 text-left text-[12px] " +
                  (row.elementId === selectedId
                    ? "bg-ui-brand-surface font-semibold text-ui-brand"
                    : "bg-transparent text-ui-ink hover:bg-ui-brand-surface")
                }
              >
                <span className="min-w-0 truncate">{row.label}</span>
                {/* A hidden element keeps its placement (rule 3) and stays in the tree. Losing the
                    row would lose the only way to see where it will come back. */}
                {row.hidden ? (
                  <span className="shrink-0 text-[10px] font-medium text-ui-muted">
                    {es["editor.design.hidden"]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {selected ? (
            <div className="overflow-hidden rounded-[9px] border border-ui-border">
              <button
                type="button"
                aria-expanded={placementOpen}
                onClick={() => setPlacementOpen((open) => !open)}
                className="flex w-full cursor-pointer items-center justify-between border-0 bg-[#F8FAFD] px-3 py-2.5 text-left"
              >
                <span className="text-[12px] font-semibold text-ui-ink">
                  {es["editor.design.placement"]}
                </span>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={"text-ui-muted " + (placementOpen ? "rotate-90" : "")}
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              <div hidden={!placementOpen} className="flex flex-col gap-2.5 p-3">
                <Stepper
                  label={es["editor.design.column"]}
                  placement={selected.placement}
                  field="column"
                  onStep={(edit) => onSetPlacement(selected.elementId, edit)}
                />
                <Stepper
                  label={es["editor.design.width"]}
                  placement={selected.placement}
                  field="columnSpan"
                  onStep={(edit) => onSetPlacement(selected.elementId, edit)}
                />
                <Stepper
                  label={es["editor.design.row"]}
                  placement={selected.placement}
                  field="row"
                  onStep={(edit) => onSetPlacement(selected.elementId, edit)}
                />
                <Stepper
                  label={es["editor.design.height"]}
                  placement={selected.placement}
                  field="rowSpan"
                  onStep={(edit) => onSetPlacement(selected.elementId, edit)}
                />
              </div>
            </div>
          ) : null}

          <p className="m-0 text-[11px] leading-normal text-ui-muted">{es["editor.design.note"]}</p>
        </>
      )}
    </aside>
  );
}
