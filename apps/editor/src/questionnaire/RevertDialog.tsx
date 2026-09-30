"use client";

import type { RevertImpact, SurplusDecision } from "@retorika/schema";
import { useId, useState } from "react";
import es from "../locales/es.json" with { type: "json" };

/**
 * «Volver a la original» — the dialog the advanced dossier §5 asks for, and mockup 16 band 3 draws.
 *
 * **This is what Wix does not have.** The engine has been able to do it losslessly since phase 0 and
 * nothing has ever called it: `planRevert` reports what does not fit and whether the mobile
 * adjustments go, and `applyRevert` **refuses** to run when an element the preset cannot place
 * arrives without an explicit decision. That refusal is the guarantee, and it stays: this dialog is
 * where the decision is made, not where the guarantee lives.
 *
 * Three things that do not move:
 *
 * - **Nothing is deleted in silence.** Every surplus element arrives with its box already ticked,
 *   which means «se queda oculta» — rule 3, and the literal promise of the dossier. Deleting takes
 *   an act.
 * - **The mobile adjustments are named before they go.** «El diálogo lo advierte, porque si no parece
 *   un fallo.» `dropsBreakpointAdjustments` has existed since phase 0 for exactly this line.
 * - **It only appears when there is something to say.** `revertImpact`'s `lossless` decides: a
 *   section escalated and left alone loses nothing by coming back, and «Volver es un clic, no
 *   destruye nada» is the promise this dialog serves — a confirmation over nothing destroyed would
 *   be friction defending against itself.
 *
 * **Its surplus branch cannot be reached by clicking, today.** No control in this editor produces an
 * element the preset has nowhere to put: the fields panel offers one more row only while
 * `existing.length < slot.max`. It *is* reachable through `packages/schema` — `fillSlot` enforces
 * "the next occurrence" but not the preset's maximum — so the state is one missing check away rather
 * than impossible, which is why the branch is built rather than deferred. Said out loud here instead
 * of implied by a screenshot that would suggest otherwise.
 */
export function RevertDialog({
  sectionName,
  impact,
  labelFor,
  onCancel,
  onConfirm,
}: {
  sectionName: string;
  impact: RevertImpact;
  /** The Spanish name of an element, from the same catalog locale the panels use — so the dialog
   * cannot come to call an element something the fields panel calls something else. */
  labelFor: (elementId: string) => string;
  onCancel: () => void;
  onConfirm: (decisions: Record<string, SurplusDecision>) => void;
}) {
  const titleId = useId();
  /**
   * Which surplus elements are being kept. Ticked for every one of them on open, and that default is
   * the decision rather than a convenience: `document-rules.md` says «The interface's default for
   * that decision is "hide"», and the decision still travels to `applyRevert` either way.
   */
  const [kept, setKept] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(impact.surplus.map((item) => [item.elementId, true])),
  );

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0F172A]/45 p-5">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-[460px] flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.28)]"
      >
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="m-0 text-[17px] font-bold text-ui-ink">
            {es["editor.revert.title"]}
          </h2>
          <p className="m-0 text-[14px] leading-snug text-ui-muted">
            {es["editor.revert.body"].replace("{section}", sectionName)}
          </p>
        </div>

        {/* The layout goes, and that is correct by rule 1 — but only worth a line when somebody
            actually moved something, which is what `dropsPlacements` distinguishes. */}
        {impact.dropsPlacements ? (
          <p className="m-0 text-[13px] leading-snug text-ui-muted">
            {es["editor.revert.dropsPlacements"]}
          </p>
        ) : null}

        {impact.surplus.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-xl border border-ui-border p-3">
            <span className="text-[12px] font-bold tracking-[0.04em] text-ui-muted">
              {es["editor.revert.surplusTitle"]}
            </span>
            {impact.surplus.map((item) => (
              <label
                key={item.elementId}
                className="flex cursor-pointer items-start gap-2.5 text-left"
              >
                <input
                  type="checkbox"
                  checked={kept[item.elementId] ?? true}
                  onChange={(event) =>
                    setKept((current) => ({
                      ...current,
                      [item.elementId]: event.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#156FE7]"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-ui-ink">
                    {labelFor(item.elementId)}
                  </span>
                  <span className="text-[12px] leading-snug text-ui-muted">
                    {(kept[item.elementId] ?? true)
                      ? es["editor.revert.willHide"]
                      : es["editor.revert.willDelete"]}
                  </span>
                </span>
              </label>
            ))}
            <span className="text-[12px] leading-snug text-ui-muted">
              {es["editor.revert.surplusNote"]}
            </span>
          </div>
        ) : null}

        {impact.dropsBreakpointAdjustments ? (
          <p className="m-0 rounded-xl bg-[#FFF4E5] p-3 text-[13px] leading-snug text-[#8A5A08]">
            {es["editor.revert.dropsMobile"]}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 cursor-pointer rounded-[10px] border border-ui-border bg-white px-4 text-[14px] font-medium text-ui-ink"
          >
            {es["editor.revert.cancel"]}
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm(
                Object.fromEntries(
                  impact.surplus.map((item) => [
                    item.elementId,
                    ((kept[item.elementId] ?? true) ? "hide" : "delete") satisfies SurplusDecision,
                  ]),
                ),
              )
            }
            className="h-10 cursor-pointer rounded-[10px] border-0 bg-ui-brand px-4 text-[14px] font-semibold text-white"
          >
            {es["editor.revert.confirm"]}
          </button>
        </div>
      </div>
    </div>
  );
}
