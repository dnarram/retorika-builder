"use client";

import type {
  MobilePatchEdit,
  Placement,
  PlacementEdit,
  RetorikaDocument,
  StyleException,
} from "@retorika/schema";
import { listStyleExceptions } from "@retorika/schema";
import { useId, useState } from "react";
import {
  boundsFor,
  designPanelState,
  designRows,
  mobileControlsFor,
  selectedRowId,
  stepTo,
} from "../editor/designTree.ts";
import { panelShell } from "../editor/EditorShell.tsx";
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
 * a greyed `Tipografía` waiting for a sprint that might bring it would be the dead button this
 * editor has refused since sprint 1.
 *
 * **Three families now, and each one arrived with the thing it controls**, which is the whole
 * point of that rule: `Colocación` on sprint 8 day 3, `Ajustar solo en móvil` on day 6, and
 * `Fuera del sistema` — the audit of rule 6's marked exceptions — on sprint 9 day 5.
 *
 * **There is still no `Tipografía` family here, and the reason this paragraph used to give expired.**
 * It said «not meant to be until issue #9 is answered»: #9 closed on 1 October 2026 and
 * [ADR 0032](../../../../docs/decisions/0032-typography-per-element-with-the-faces-that-travel.md)
 * shipped per-element typeface the next day. **It shipped in the floating toolbar, not here**, and
 * that is the rule the bar follows rather than an oversight: the bar is what acts on **the element
 * you have selected**, and a family is a property of one element. This panel's two section families
 * are position and the mobile patch; its third asks the whole document a question. A `Tipografía`
 * family here would be a fourth door to a control that already has the right one.
 *
 * So the rule the paragraph above states is intact and its example is gone. Kept rather than deleted,
 * because «no family is drawn for something that does not exist yet» is still the rule, and a reader
 * who finds a typeface control in the bar and no family here deserves to be told it was deliberate.
 *
 * **The last of the three is not about the selected section**, unlike the other two: it asks the
 * whole document «what in this web no longer follows the system», which is why it sits outside the
 * branches below and why this panel now says something useful with nothing selected at all.
 *
 * **No dragging, still.** Guides that snap are phase 3 of the concept dossier and did not fit in a
 * day; stepping by column, row and width is what a professional reaches for anyway, over the grid
 * the canvas draws. Saying so by name is what kept sprint 8 day 3 from eating that sprint.
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

/**
 * A collapsible family.
 *
 * Extracted at two uses rather than three, against this project's own rule, for one reason worth
 * stating: the header ties `aria-expanded` and a chevron rotation to the same boolean, and two
 * hand-written copies of that pairing is how a panel ends up announcing "collapsed" while looking
 * open. The rule is about concepts; this is a widget.
 */
function Family({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[9px] border border-ui-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between border-0 bg-[#F8FAFD] px-3 py-2.5 text-left"
      >
        <span className="text-[12px] font-semibold text-ui-ink">{title}</span>
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
          className={"text-ui-muted " + (open ? "rotate-90" : "")}
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      <div hidden={!open} className="flex flex-col gap-2.5 p-3">
        {children}
      </div>
    </div>
  );
}

/** One of the three mobile adjustments. `aria-pressed` only for «Ocultar aquí», which is the one
 * that has a state to be in; the other two are acts, and a pressed state would claim otherwise. */
function MobileButton({
  label,
  pressed,
  disabled,
  onPress,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled === true}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      onClick={onPress}
      className={
        "h-10 flex-grow rounded-[9px] border text-[13px] font-medium " +
        (disabled === true
          ? "border-ui-border bg-ui-surface text-ui-border"
          : pressed === true
            ? "cursor-pointer border-ui-brand bg-ui-brand-surface text-ui-brand"
            : "cursor-pointer border-ui-border bg-ui-surface text-ui-ink hover:bg-ui-brand-surface")
      }
    >
      {label}
    </button>
  );
}

export function DesignPanel({
  document: doc,
  sectionId,
  sectionName,
  selectedElementId,
  onSelectElement,
  onSetPlacement,
  onSetMobilePatch,
  onMoveUpOnMobile,
  onPreviewMobile,
  onClearException,
  onEscalate,
  onClose,
}: {
  document: RetorikaDocument;
  /** The section being designed, or `null` when none is selected. */
  sectionId: string | null;
  sectionName: string | null;
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  onSetPlacement: (elementId: string, edit: PlacementEdit) => void;
  /** Rule 7's first and third adjustments. `undefined` for a field takes that adjustment away, which
   * is how «Ocultar aquí» turns itself back off. */
  onSetMobilePatch: (elementId: string, edit: MobilePatchEdit) => void;
  /** The second, as one step: the two elements trade places, because patching one to a lower number
   * would only tie it with the element above and lose that tie to the markup. */
  onMoveUpOnMobile: (elementId: string) => void;
  /** Show the mobile preview, so the three adjustments are made while looking at what they change. */
  onPreviewMobile: () => void;
  /** Drop one exception and let the system show through again — the whole of the «arreglo en un
   * clic», and the same act day 6's contrast review will offer from its own dialog. */
  onClearException: (exception: StyleException) => void;
  /**
   * «Diseñar a mano», offered from here as well as from the section's own header (ADR 0025's
   * amendment, accepted 1 October 2026).
   *
   * **The second door, not a second decision.** Until today this panel told a catalog-placed section's
   * owner to go and find the offer «desde su cabecera» and did not offer it — a dead end that names
   * its own exit. Session 3 found an owner who turned the tools on, was told by this very panel that
   * the grid was there, and still asked for «más libertad en la posición».
   *
   * It is the **same** act as the header's: the same label, the same `escalateSection`, and §7 is
   * untouched — escalation stays per section and `escalate` copies the preset's own layout in, so
   * nothing moves when it is pressed. That is precisely what makes a second door safe.
   */
  onEscalate: () => void;
  onClose: () => void;
}) {
  const headingId = useId();
  /** Collapsed on open, every time the panel opens, and not remembered. The dossier's safeguard is
   * about what encountering the tools feels like, which is a thing that happens on opening. */
  const [placementOpen, setPlacementOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [exceptionsOpen, setExceptionsOpen] = useState(false);

  /**
   * Every exact value in the whole site — the audit `packages/schema/src/tokens.ts` promised in
   * phase 0 and nothing had ever built: «what lets a **future** audit list every place that opted
   * out of the system».
   *
   * **Asked of the document and not of the section**, which is why it sits outside the
   * section-dependent branches below. The question is «what in this web no longer follows the
   * system», and an answer that changed depending on which section happened to be selected would
   * not be an audit. It is also why the panel now shows something useful with no section chosen at
   * all, where before it showed only a sentence telling you to choose one.
   *
   * Hidden elements included, deliberately. `listStyleExceptions` marks them and day 6's download
   * gate is the reader that skips them — the renderer drops a hidden element, so blocking a
   * download over a colour nobody can see would be wrong. Here the opposite is true: rule 3 keeps a
   * hidden element precisely so the place to fill it in still exists, and an exception that
   * vanished from this list when somebody hid its element is one that comes back unannounced.
   */
  const exceptions = listStyleExceptions(doc);

  const rows = sectionId === null ? [] : designRows(doc, sectionId);
  /** Which of the four things this panel has to say. Decided in `designTree.ts` so it can be tested
   * without a DOM, and so the «Diseñar a mano» case is a named state rather than a row count. */
  const state = designPanelState(doc, sectionId);
  // The same resolution the canvas uses for its outline, from the same function — see
  // `selectedRowId` for what having two of them cost.
  const selectedId = selectedRowId(rows, selectedElementId);
  const selected = rows.find((row) => row.elementId === selectedId);
  const mobile =
    sectionId !== null && selectedId !== null
      ? mobileControlsFor(doc, sectionId, selectedId)
      : undefined;

  return (
    <aside
      aria-labelledby={headingId}
      // Beside the canvas like the style panel, not fixed over it: the grid the canvas draws is
      // the thing being worked against, and a panel covering it would hide the answer.
      className={`flex w-[288px] shrink-0 flex-col gap-4 rounded-[14px] border border-ui-border bg-ui-surface p-5 ${panelShell}`}
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

      {state === "noSection" ? (
        // A sentence saying what to do, not a disabled tree — the shape `PagesPanel` and
        // `PhotosPanel` both use for "you cannot do this from here yet".
        <p className="m-0 text-[12px] leading-snug text-ui-muted">
          {es["editor.design.noSection"]}
        </p>
      ) : state === "offerEscalate" ? (
        // The paragraph says what it costs and promises the return in the same breath, which is what
        // ADR 0025 §7 asks of the offer wherever it appears — and then the door is right here,
        // instead of naming a place to go and find it. See `designPanelState` for why this is a
        // state and not a row count.
        <div className="flex flex-col items-start gap-2.5">
          <p className="m-0 text-[12px] leading-snug text-ui-muted">
            {es["editor.design.notFree"]}
          </p>
          <button
            type="button"
            onClick={onEscalate}
            className="cursor-pointer rounded-lg border-0 bg-ui-ink px-3 py-2 text-[12px] font-semibold text-white"
          >
            {es["editor.section.escalate.yes"]}
          </button>
        </div>
      ) : state === "noPlaceable" ? (
        <p className="m-0 text-[12px] leading-snug text-ui-muted">
          {es["editor.design.noPlaceable"]}
        </p>
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
            <Family
              title={es["editor.design.placement"]}
              open={placementOpen}
              onToggle={() => setPlacementOpen((value) => !value)}
            >
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
            </Family>
          ) : null}

          {/*
            The second family — the last one sprint 8 added, and no longer the last in the panel:
            sprint 9 day 5 put «Fuera del sistema» below, outside this branch because it is about
            the document rather than about the selected section. Rule 7's three adjustments and not
            a fourth, under the promise mockup 14 makes in its own heading: «El escritorio no se
            toca.»
          */}
          {selected && mobile ? (
            <Family
              title={es["editor.design.mobile"]}
              open={mobileOpen}
              onToggle={() => {
                const next = !mobileOpen;
                setMobileOpen(next);
                // Opening it shows the mobile preview. Adjusting something you cannot see is the
                // dead-button problem wearing a different coat, and ADR 0025 §5 is explicit that
                // these three are made «while looking at the mobile preview». Collapsing does not
                // switch back: nobody asked to leave.
                if (next) onPreviewMobile();
              }}
            >
              <p className="m-0 text-[12px] leading-snug text-ui-muted">
                {es["editor.design.mobileHelp"]}
              </p>
              <div className="flex gap-2">
                <MobileButton
                  label={
                    mobile.hidden ? es["editor.design.mobileShow"] : es["editor.design.mobileHide"]
                  }
                  pressed={mobile.hidden}
                  onPress={() =>
                    onSetMobilePatch(selected.elementId, {
                      hidden: mobile.hidden ? undefined : true,
                    })
                  }
                />
                <MobileButton
                  label={es["editor.design.mobileUp"]}
                  disabled={!mobile.canMoveUp}
                  onPress={() => onMoveUpOnMobile(selected.elementId)}
                />
                <MobileButton
                  label={es["editor.design.mobileSmaller"]}
                  disabled={mobile.narrowerTo === undefined}
                  onPress={() =>
                    mobile.narrowerTo !== undefined &&
                    onSetMobilePatch(selected.elementId, { columnSpan: mobile.narrowerTo })
                  }
                />
              </div>
              <p className="m-0 text-[11px] leading-snug text-ui-muted">
                {mobile.narrowerTo === undefined
                  ? es["editor.design.mobileNarrowest"]
                  : es["editor.design.mobileWidth"].replace("{span}", String(mobile.span))}
              </p>
            </Family>
          ) : null}

          <p className="m-0 text-[11px] leading-normal text-ui-muted">{es["editor.design.note"]}</p>
        </>
      )}

      {/*
        Outside the branches above, because it is about the site and not about the selected
        section — and because it is the one thing this panel can say when nothing is selected.
      */}
      <Family
        title={`${es["editor.design.exceptions"]}${exceptions.length > 0 ? ` (${exceptions.length})` : ""}`}
        open={exceptionsOpen}
        onToggle={() => setExceptionsOpen((value) => !value)}
      >
        {exceptions.length === 0 ? (
          // Not an empty box. The sentence says what being empty *means*, which is the promise
          // rule 6 makes and the reason somebody would want it to stay empty.
          <p className="m-0 text-[12px] leading-snug text-ui-muted">
            {es["editor.design.exceptionsEmpty"]}
          </p>
        ) : (
          <>
            <p className="m-0 text-[12px] leading-snug text-ui-muted">
              {es["editor.design.exceptionsHelp"]}
            </p>
            {exceptions.map((exception) => (
              <div
                key={`${exception.sectionId}/${exception.elementId}/${exception.property}`}
                className="flex items-center justify-between gap-2 rounded-[7px] border border-ui-border px-2.5 py-2"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[12px] text-ui-ink">
                    {/* The words a person recognises, never the element id. An audit nobody can
                        match to something on the screen is an audit nobody can act on. */}
                    {exception.label ?? exception.slot}
                    {exception.hidden ? (
                      <span className="ml-1.5 text-[10px] font-medium text-ui-muted">
                        {es["editor.design.exceptionHidden"]}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[11px] text-ui-muted">
                    {es[`editor.design.exceptionOf.${exception.property}` as keyof typeof es]}:{" "}
                    <code className="font-mono">{exception.exact}</code>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onClearException(exception)}
                  className="shrink-0 cursor-pointer rounded-[6px] border border-ui-border bg-white px-2 py-1 text-[11px] font-medium text-ui-ink hover:border-ui-brand hover:bg-ui-brand-surface"
                >
                  {es["editor.design.exceptionBack"]}
                </button>
              </div>
            ))}
          </>
        )}
      </Family>
    </aside>
  );
}
