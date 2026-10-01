"use client";

import {
  type ContentValue,
  type ElementAddress,
  type MarkRun,
  marksAfterTrim,
  type SlotAddress,
  type SlotFill,
  shiftMarks,
} from "@retorika/schema";
import { useEffect, useId, useRef } from "react";
import { type FieldRow, fieldCommitFor, groupedFields } from "../editor/sectionFields.ts";
import { fieldEditFor } from "../editor/textEdits.ts";
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
  /** The slots of one **line**, in the order the preset declares them — where a slot created inside
   * a line gets placed, the same way `slotOrder` decides it for the section. Empty for a section
   * whose preset has no list. */
  itemSlotOrder: readonly string[];
  sectionId: string;
  onFill: (fill: SlotFill) => void;
  onClear: (address: SlotAddress) => void;
  /** The same commit the canvas uses, so a text edit here moves the field's marks with it instead of
   * replacing the whole value and dropping them (`fieldCommitFor`). `marks` are the ones the box
   * anchored, or absent for the diff fallback — the same contract the canvas has (ADR 0027 §4b). */
  onEditText: (address: ElementAddress, text: string, marks?: readonly MarkRun[]) => void;
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
  itemSlotOrder,
  sectionId,
  onFill,
  onClear,
  onEditText,
  onClose,
}: FieldsPanelProps) {
  const headingId = useId();

  const { sectionRows, lines } = groupedFields(rows);

  function commit(row: FieldRow, text: string, href: string, anchored?: readonly MarkRun[]) {
    // A line's row carries its own address, and the order a created slot is placed by is the
    // **line's**, not the section's. `fieldCommitFor` needs no say in this: a text edit is addressed
    // by element id, and `setElementText` has always recursed into a line's elements — which is why
    // the panel's words-only path already reached inside a line before today, and only creating or
    // clearing one did not.
    const address: SlotAddress = {
      sectionId,
      slot: row.slot,
      occurrence: row.occurrence,
      ...(row.item ? { item: row.item } : {}),
    };
    const what = fieldCommitFor(row, text, href);
    if (what.kind === "clear") {
      onClear(address);
      return;
    }
    // Only the words changed, so only the words are written — and `setElementText` carries the
    // field's marks across. Sending a rebuilt value here is what used to strip the bold off a
    // field, on a blur that had changed nothing at all.
    if (what.kind === "text") {
      onEditText({ sectionId, elementId: what.elementId }, what.text, anchored);
      return;
    }
    onFill({
      ...address,
      role: row.role,
      value: valueFor(row, text.trim(), href.trim()),
      slotOrder: row.item ? itemSlotOrder : slotOrder,
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

      {sectionRows.map((row) => (
        <FieldRowInputs
          // By slot and occurrence: the element id is absent for a slot the document does not
          // have yet, and appears the moment it is filled — which would remount the input
          // mid-edit and throw away what was typed.
          key={`${row.slot}:${row.occurrence}`}
          row={row}
          onCommit={commit}
        />
      ))}

      {lines.map((line) => (
        // Grouped and headed, never mixed in with the section's rows. A row labelled «Descripción»
        // with nothing saying which dish it belongs to is a guess, not a field — and with twelve
        // lines there would be twelve of them. The group's key is the line's id, so the rows inside
        // it keep their own slot-and-occurrence key: React only needs those unique among siblings,
        // and a line's pair repeats on every line.
        <div key={line.id} className="flex flex-col gap-3 border-t border-ui-border pt-4">
          {/* 14px bold, between the panel's own `h2` at 15 and a field's label at 12. A browser walk
              is what settled this: at 13px the heading and the labels read as one level however they
              were weighted, and «Descripción» under nothing is the guess this grouping exists to
              stop. Size is what separates them; weight alone did not. */}
          <h3 className="m-0 text-[14px] font-bold text-ui-ink">{line.name}</h3>
          {line.rows.map((row) => (
            <FieldRowInputs key={`${row.slot}:${row.occurrence}`} row={row} onCommit={commit} />
          ))}
        </div>
      ))}
    </aside>
  );
}

/**
 * One row's boxes, with the label box anchored in the range the browser is about to replace.
 *
 * **This closes the cut line sprint 11 day 2 wrote for itself.** The capture ADR 0027 §4b describes
 * lived only in the canvas's `wireEditing`; this panel committed through the same `setElementText`
 * chokepoint without ever having watched a keystroke, so a mark on a field edited here moved by
 * `textEditBetween`'s guess — the mechanism sprint 11 day 1 measured losing a mark whose own word
 * was never touched.
 *
 * **A native listener rather than React's `onBeforeInput`**, which is a synthetic event that does
 * not carry `inputType`, and `inputType` is the whole table.
 */
function FieldRowInputs({
  row,
  onCommit,
}: {
  row: FieldRow;
  onCommit: (row: FieldRow, text: string, href: string, anchored?: readonly MarkRun[]) => void;
}) {
  const textId = useId();
  const hrefId = useId();
  const box = useRef<HTMLInputElement>(null);

  /**
   * The marks after every edit this focus has seen, the text they believe in, and whether every one
   * of those edits was anchored — the canvas's three values, kept in a ref for the same reason it
   * keeps them in closure variables: nothing React renders depends on them, so a re-render for
   * each keystroke would buy nothing and cost the input's own selection.
   */
  const anchor = useRef<{ marks: readonly MarkRun[]; text: string; anchored: boolean }>({
    marks: [],
    text: "",
    anchored: false,
  });

  useEffect(() => {
    const input = box.current;
    if (!input) return;
    const onBeforeInput = (event: Event) => {
      const intent = event as InputEvent;
      const state = anchor.current;
      if (!state.anchored) return;
      // The previous edit's result is in `value` by now, so this is where it gets verified. A
      // mismatch means something changed the box that this listener never saw, and every offset it
      // holds is about a string that is not in front of the person any more.
      if (input.value !== state.text) {
        state.anchored = false;
        return;
      }
      const captured = fieldEditFor(
        {
          value: input.value,
          selectionStart: input.selectionStart,
          selectionEnd: input.selectionEnd,
        },
        {
          inputType: intent.inputType,
          data: intent.data,
          pastedText: intent.dataTransfer?.getData("text/plain") ?? null,
        },
      );
      if (!captured) {
        state.anchored = false;
        return;
      }
      state.marks = shiftMarks([...state.marks], captured.edit);
      state.text =
        state.text.slice(0, captured.edit.from) +
        captured.inserted +
        state.text.slice(captured.edit.to);
    };
    input.addEventListener("beforeinput", onBeforeInput);
    return () => input.removeEventListener("beforeinput", onBeforeInput);
  }, []);

  /**
   * The captured marks, or nothing — which is the documented fallback and not a lesser answer.
   *
   * Two conditions. Every edit was anchored, because one unmapped input type is enough to make the
   * running offsets wrong and there is no repairing them halfway; and the box still holds the text
   * the listener believes it does, which is what verifies the **last** edit — the one no later
   * `beforeinput` was ever going to check. `marksAfterTrim` then reconciles the live text with the
   * trimmed string `fieldCommitFor` actually stores.
   */
  const anchoredMarks = (): readonly MarkRun[] | undefined => {
    const state = anchor.current;
    if (!state.anchored || box.current?.value !== state.text) return undefined;
    return marksAfterTrim(state.text, state.marks);
  };

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
        ref={box}
        type="text"
        defaultValue={row.text}
        placeholder={row.kind === "link" ? es["editor.fields.labelHint"] : ""}
        onFocus={(event) => {
          anchor.current = { marks: row.marks ?? [], text: event.target.value, anchored: true };
        }}
        onBlur={(event) => onCommit(row, event.target.value, row.href ?? "", anchoredMarks())}
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
