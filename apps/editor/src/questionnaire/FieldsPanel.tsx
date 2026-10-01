"use client";

import type { ContentValue, ElementAddress, SlotAddress, SlotFill } from "@retorika/schema";
import { useId } from "react";
import { type FieldRow, fieldCommitFor } from "../editor/sectionFields.ts";
import es from "../locales/es.json" with { type: "json" };

/**
 * The fields of the selected section, as boxes.
 *
 * It lives in the parent document rather than injected into the preview frame, unlike every
 * other piece of chrome in this editor. The reason is that this one is a form: controlled
 * inputs, values that have to survive a re-render, and a commit on blur. Hand-wiring that inside
 * an iframe would be re-implementing React badly, and the rule the design hands down — "never a
 * list in a side panel" — is about **inserting sections**, which still happens in the gap.
 *
 * Every box commits on blur, not on keystroke, exactly as click-to-edit does. One history step
 * per field left, not one per letter.
 */

export interface FieldsPanelProps {
  sectionName: string;
  rows: readonly FieldRow[];
  slotOrder: readonly string[];
  sectionId: string;
  onFill: (fill: SlotFill) => void;
  onClear: (address: SlotAddress) => void;
  /** The same commit the canvas uses, so a text edit here moves the field's marks with it instead of
   * replacing the whole value and dropping them (`fieldCommitFor`). */
  onEditText: (address: ElementAddress, text: string) => void;
  onClose: () => void;
}

/** What a row's two boxes become in the document. A link keeps both halves together: changing a
 * label must not drop the destination, and changing the destination must not drop the label. */
function valueFor(row: FieldRow, text: string, href: string): ContentValue {
  return row.kind === "link" ? { kind: "link", text, href } : { kind: "text", text };
}

export function FieldsPanel({
  sectionName,
  rows,
  slotOrder,
  sectionId,
  onFill,
  onClear,
  onEditText,
  onClose,
}: FieldsPanelProps) {
  const headingId = useId();

  function commit(row: FieldRow, text: string, href: string) {
    const address: SlotAddress = { sectionId, slot: row.slot, occurrence: row.occurrence };
    const what = fieldCommitFor(row, text, href);
    if (what.kind === "clear") {
      onClear(address);
      return;
    }
    // Only the words changed, so only the words are written — and `setElementText` carries the
    // field's marks across. Sending a rebuilt value here is what used to strip the bold off a
    // field, on a blur that had changed nothing at all.
    if (what.kind === "text") {
      onEditText({ sectionId, elementId: what.elementId }, what.text);
      return;
    }
    onFill({
      ...address,
      role: row.role,
      value: valueFor(row, text.trim(), href.trim()),
      slotOrder,
    });
  }

  return (
    <aside
      aria-labelledby={headingId}
      // Fixed to the right of the viewport rather than placed inside the canvas card: the card
      // narrows to 400px in the mobile device view, and a form docked inside it would leave the
      // page it is meant to be editing a sliver wide.
      className="fixed top-[58px] right-0 bottom-0 z-20 flex w-[340px] flex-col gap-4 overflow-y-auto border-l border-ui-border bg-ui-surface p-5 shadow-[-8px_0_24px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="m-0 text-[15px] font-bold text-ui-ink">
            {sectionName}
          </h2>
          <p className="m-0 text-[12px] leading-snug text-ui-muted">{es["editor.fields.help"]}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={es["editor.fields.close"]}
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
      </div>

      {rows.length === 0 ? (
        <p className="m-0 text-[13px] text-ui-muted">{es["editor.fields.none"]}</p>
      ) : null}

      {rows.map((row) => (
        <FieldRowInputs
          // By slot and occurrence: the element id is absent for a slot the document does not
          // have yet, and appears the moment it is filled — which would remount the input
          // mid-edit and throw away what was typed.
          key={`${row.slot}:${row.occurrence}`}
          row={row}
          onCommit={commit}
        />
      ))}
    </aside>
  );
}

function FieldRowInputs({
  row,
  onCommit,
}: {
  row: FieldRow;
  onCommit: (row: FieldRow, text: string, href: string) => void;
}) {
  const textId = useId();
  const hrefId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={textId} className="text-[12px] font-semibold text-ui-ink">
        {row.label}
        {row.required ? null : (
          <span className="ml-1.5 font-normal text-ui-muted">{es["editor.fields.optional"]}</span>
        )}
      </label>
      <input
        id={textId}
        type="text"
        defaultValue={row.text}
        placeholder={row.kind === "link" ? es["editor.fields.labelHint"] : ""}
        onBlur={(event) => onCommit(row, event.target.value, row.href ?? "")}
        className="h-9 w-full rounded-lg border border-ui-border bg-white px-2.5 text-[13px] text-ui-ink"
      />
      {row.kind === "link" ? (
        <>
          <label htmlFor={hrefId} className="mt-1 text-[12px] text-ui-muted">
            {es["editor.fields.destination"]}
          </label>
          <input
            id={hrefId}
            type="text"
            defaultValue={row.href ?? ""}
            placeholder={es["editor.fields.destinationHint"]}
            onBlur={(event) => onCommit(row, row.text, event.target.value)}
            className={`h-9 w-full rounded-lg border bg-white px-2.5 text-[13px] text-ui-ink ${
              row.dead ? "border-[#DC2626]" : "border-ui-border"
            }`}
          />
          {row.dead ? (
            <p className="m-0 text-[12px] leading-snug text-[#B91C1C]">
              {es["editor.fields.deadDestination"]}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
