"use client";

import {
  type ElementAddress,
  type MarkRun,
  marksAfterTrim,
  type SlotAddress,
  type SlotFill,
  shiftMarks,
} from "@retorika/schema";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { menuLineFor, type SectionRow } from "../editor/headerState.ts";
import { Note, PanelHeader, panelCard, panelFrame } from "../editor/panelKit.tsx";
import {
  type FieldRow,
  fieldCommitFor,
  fieldValueFor,
  groupedFields,
} from "../editor/sectionFields.ts";
import { fieldEditFor } from "../editor/textEdits.ts";
import es from "../locales/es.json" with { type: "json" };
import type { MenuFocusBlock } from "./MenuPanel.tsx";

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
  /** Drawn after the rows: the section's background with motifs (ADR 0081, sprint 40 día 6). */
  footer?: ReactNode;
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
  /**
   * This section as the sections menu of «Menú» sees it (sprint 39 día 1, ADR 0078): whether it is
   * in the menu and what the menu reads it as, or why it lends no entry — a cover, a footer, an
   * avance, the one carrying the page's `<h1>`. From sprint 23 to 38 the switch itself was drawn
   * here, the same `setSectionInMenu` as the row in «Menú»; now this panel reads the state in a line
   * and opens «Menú» at the row with a door. `undefined` only for a section «Menú» does not list.
   */
  menuRow?: SectionRow | undefined;
  /** Open «Menú» at this section's row, with the keyboard on its switch, or on the row when it has
   * none. */
  onOpenMenuFor: (target: MenuFocusBlock) => void;
}

/** What a row's two boxes become in the document. A link keeps both halves together: changing a
 * label must not drop the destination, and changing the destination must not drop the label. */

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
  menuRow,
  onOpenMenuFor,
  footer,
}: FieldsPanelProps) {
  const headingId = useId();

  const { sectionRows, lines } = groupedFields(rows);
  const line = menuRow ? menuLineFor(menuRow) : undefined;

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
      value: fieldValueFor(row, text.trim(), href.trim()),
      slotOrder: row.item ? itemSlotOrder : slotOrder,
    });
  }

  /**
   * The keyboard follows the panel across the frame boundary (sprint 17 day 5).
   *
   * «Campos de esta sección» is pressed on a button drawn **inside** the preview iframe and opens
   * a panel in the editor's own document. Nothing moved focus, so a keyboard user pressed the verb
   * and stayed where they were, with a form they had no way of knowing had appeared — the one case
   * in this sprint where the two documents make a difference rather than an inconvenience.
   *
   * Focused on open rather than on every render, so typing in a field cannot be interrupted by the
   * panel re-rendering under it, which it does on every keystroke.
   */
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    panel.current?.focus();
  }, []);

  return (
    <aside
      ref={panel}
      // Focusable as a container, so the keyboard has somewhere to land that is the panel itself
      // rather than its first field: a form that opens with the caret already in a text box has
      // skipped past its own heading, and the heading is what says which section this is.
      tabIndex={-1}
      onKeyDown={(event) => {
        /*
         * **Escape closes it, and it is not a modal.** `useFocusTrap` is deliberately not used
         * here: this panel claims nothing about the rest of the page, Tab leaves it for the canvas
         * and comes back, and trapping the keyboard in a form somebody opened to fill in would be
         * the opposite of helpful. What Escape owes is a way out, which is all it does.
         *
         * Not stopped from propagating: nothing above this listens for Escape, and a key this
         * panel has finished with is not a key it should hide.
         */
        if (event.key === "Escape") onClose();
      }}
      aria-labelledby={headingId}
      /**
       * **Beside the canvas, not over it** (sprint 24 día 3, David's own words: «el menú desplegado
       * tras pulsar "Campos" debería seguir la misma lógica que todas las herramientas de diseño
       * avanzadas y **no ocultar elementos que van a ser editados**»).
       *
       * This was the last panel `fixed` to the viewport. It painted 340 pixels of itself across the
       * page being edited at every window width, which is the one thing a panel for editing a
       * section must not do. It is now in `EditorShell`'s own `panel` slot, like the six rail
       * panels and like `SharePanel` before it: a flex sibling of the canvas area, so the preview
       * narrows, re-measures through the `ResizeObserver` that already exists, and stays visible.
       * No geometry is written here — losing `fixed` is what buys all of it.
       *
       * **The objection this used to carry has dissolved with the move.** It said a `panelCard`
       * would hand it `panelShell`'s desktop `max-h-full self-start`, «which this `fixed` element
       * does not want». In the row it does want them: that is how the other six size themselves
       * against a scrolling column. And the reason given for being fixed — that the canvas card
       * narrows to 400px in the mobile device view, so a form docked **inside the card** would
       * leave the page a sliver — was always about the card and never about the row.
       *
       * On a phone `panelCard` is the sheet from the bottom that ADR 0042 §2 asks for, and it is
       * now the same sheet as the other six rather than a second transcription of its numbers.
       */
      className={panelFrame}
    >
      <PanelHeader
        id={headingId}
        title={sectionName}
        help={es["editor.fields.help"]}
        close={{ label: es["editor.fields.close"], onClick: onClose }}
      />

      {/**
       * **Whether this section is in the menu, read** (ADR 0043 §3 as ADR 0078 amends it) — in
       * its own block, above the fields and ruled off from them, because it is not a field: the
       * fields are what the section says, and this is where it is announced. The words the menu
       * reads it by are in the line: a derived menu is the one thing the owner cannot otherwise
       * see the wording of. The door opens «Menú» at this section's row — on its switch, or on the
       * row when it has none, whose note says why.
       */}
      {line === undefined || menuRow === undefined ? null : (
        <div className="flex items-center gap-2 rounded-ui border border-ui-border bg-ui-bg p-3">
          <Note as="span" className="min-w-0 flex-1 text-[13px] text-ui-ink">
            {line.text}
          </Note>
          <button
            type="button"
            onClick={() => onOpenMenuFor({ block: "section", sectionId })}
            aria-label={es[
              line.door === "change" ? "editor.menu.door.changeLabel" : "editor.menu.door.seeLabel"
            ].replace("{name}", menuRow.name)}
            className="ui-interactive shrink-0 cursor-pointer rounded-ui-sm px-2 py-1 text-[12px] font-semibold text-ui-brand-deep hover:bg-ui-brand-surface"
          >
            {es[line.door === "change" ? "editor.menu.door.change" : "editor.menu.door.see"]}
          </button>
        </div>
      )}

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

      {/* What the panel holds beyond the section's words — its background with motifs (ADR 0081),
          drawn by `BackgroundBlock` — after everything the section says. */}
      {footer}
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
  const hrefBox = useRef<HTMLInputElement>(null);

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

  /**
   * The box follows the document when the document moves **underneath** it.
   *
   * **Found by sprint 12's day-7 walk, and it was a trap rather than a blemish.** These inputs are
   * uncontrolled — `defaultValue` is read once and never again — so pressing «Deshacer» with the
   * panel open reverted the page and left the box showing the text that had just been undone. Then
   * the owner only had to *click into that box and click away*, typing nothing, for the undone
   * edit to be written back: the panel commits on blur, and an untouched blur is still a commit.
   * Measured: the card came back, and «Rehacer» went dark.
   *
   * It is the same *class* sprint 11 day 2 fixed — «a blur that had changed nothing at all» — one
   * step further out. That fix stopped an untouched blur from destroying marks; it could not stop
   * one from re-applying a value the document no longer had. The other half of the repair is in
   * `documentHistory`'s `alreadySays`, which refuses the step; this half is what stops the box
   * showing something the page does not.
   *
   * **Written as an assignment rather than by keying the input on its text**, which would also work
   * and would remount it. The rule this expresses is narrower and is the one that matters: *never
   * touch the box somebody is typing in*. A remount keyed on `row.text` would be correct only
   * because the undo shortcut already refuses to fire inside an `<input>` (`keepsItsOwnUndo`) — a
   * second rule, in another file, holding this one up.
   */
  useEffect(() => {
    for (const [input, value] of [
      [box.current, row.text],
      [hrefBox.current, row.href ?? ""],
    ] as const) {
      if (!input || input === input.ownerDocument.activeElement) continue;
      if (input.value !== value) input.value = value;
    }
  }, [row.text, row.href]);

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
        placeholder={
          row.kind === "link"
            ? es["editor.fields.labelHint"]
            : row.kind === "map"
              ? es["editor.fields.map.placeholder"]
              : ""
        }
        onFocus={(event) => {
          anchor.current = { marks: row.marks ?? [], text: event.target.value, anchored: true };
        }}
        onBlur={(event) => onCommit(row, event.target.value, row.href ?? "", anchoredMarks())}
        className="h-9 w-full rounded-lg border border-ui-border bg-white px-2.5 text-[13px] phone:text-base text-ui-ink"
      />
      {row.kind === "link" ? (
        <>
          <label htmlFor={hrefId} className="mt-1 text-[12px] text-ui-muted">
            {es["editor.fields.destination"]}
          </label>
          <input
            id={hrefId}
            ref={hrefBox}
            type="text"
            defaultValue={row.href ?? ""}
            placeholder={es["editor.fields.destinationHint"]}
            onBlur={(event) => onCommit(row, row.text, event.target.value)}
            className={`h-9 w-full rounded-lg border bg-white px-2.5 text-[13px] phone:text-base text-ui-ink ${
              row.dead ? "border-[#DC2626]" : "border-ui-border"
            }`}
          />
          {row.dead ? (
            <p className="m-0 text-[12px] leading-snug text-ui-danger-deep">
              {es["editor.fields.deadDestination"]}
            </p>
          ) : null}
        </>
      ) : null}
      {row.kind === "map" ? (
        /*
         * **«Cómo llegar»** (ADR 0080, sprint 40 día 4): its words above, and where it leads said in a
         * line — the address of this section, read when the page is drawn, or a place written here on
         * purpose. Emptying the place goes back to the address; emptying the words takes the link off
         * the page, as every row of this panel does. Only the place is typed: the address is the
         * section's own row, and the link follows it.
         */
        <>
          {row.text !== "" && !row.dead ? (
            <Note>
              {(row.href ?? "") === ""
                ? es["editor.fields.map.followsAddress"]
                : es["editor.fields.map.followsPlace"]}
            </Note>
          ) : null}
          <label htmlFor={hrefId} className="mt-1 text-[12px] text-ui-muted">
            {es["editor.fields.map.place"]}
          </label>
          <input
            id={hrefId}
            ref={hrefBox}
            type="text"
            defaultValue={row.href ?? ""}
            placeholder={es["editor.fields.map.placeHint"]}
            onBlur={(event) => onCommit(row, row.text, event.target.value)}
            className={`h-9 w-full rounded-lg border bg-white px-2.5 text-[13px] phone:text-base text-ui-ink ${
              row.dead ? "border-[#DC2626]" : "border-ui-border"
            }`}
          />
          {row.dead ? (
            <p className="m-0 text-[12px] leading-snug text-ui-danger-deep">
              {es["editor.fields.map.dead"]}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
