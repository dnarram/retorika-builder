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
import { type MenuState, menuNoteText, sectionsLeftText } from "../editor/menuState.ts";
import { PANEL_WIDTH, PanelClose, panelCard } from "../editor/panelKit.tsx";
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
  /**
   * The words this section would be called by in the menu, or `undefined` when it lends no entry
   * at all — a cover, a footer, an avance, a section with no visible heading, or the one carrying
   * the page's `<h1>`. The switch is **absent** rather than disabled in that case, which is the
   * rule «Convertir esta sección en página» already follows: a control that cannot do anything is
   * worse than no control.
   */
  menuLabel?: string | undefined;
  /** What the document says today. `undefined` is «nobody has decided», which shows as in. */
  inMenu?: boolean | undefined;
  onSetInMenu: (sectionId: string, inMenu: boolean) => void;
  /**
   * How much menu is left, said out loud beside the switch (ADR 0043 §5).
   *
   * **The count belongs where the decision is made**, which is here. A derived menu gives the
   * owner nothing else to look at: they cannot see the strip from this panel, and the published
   * page is the first place the result would otherwise appear. Computed once in `menuState.ts` and
   * read identically by «Páginas», so the two panels cannot tell them different numbers.
   */
  menu: MenuState;
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
  menuLabel,
  inMenu,
  menu,
  onSetInMenu,
}: FieldsPanelProps) {
  const headingId = useId();

  const { sectionRows, lines } = groupedFields(rows);
  const note = menuNoteText(menu);

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
      className={`${PANEL_WIDTH} gap-4 p-5 ${panelCard}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="m-0 text-[15px] font-bold text-ui-ink">
            {sectionName}
          </h2>
          <p className="m-0 text-[12px] leading-snug text-ui-muted">{es["editor.fields.help"]}</p>
        </div>
        <PanelClose onClick={onClose} label={es["editor.fields.close"]} />
      </div>

      {/**
       * **Whether this section is in the menu** (ADR 0043 §3) — in its own block, above the
       * fields and ruled off from them, because it is not a field: the fields are what the
       * section says, and this is where it is announced.
       *
       * **The words the menu would use are shown beside it.** A derived menu is the one thing
       * the owner cannot otherwise see the wording of — it is their own heading, read when the
       * page is drawn — and this is the single place in the application where that becomes
       * visible.
       */}
      {menuLabel === undefined ? null : (
        <div className="flex flex-col gap-1.5 rounded-ui border border-ui-border bg-ui-bg p-3">
          <label className="ui-interactive flex items-start gap-2.5">
            <input
              type="checkbox"
              checked={inMenu !== false}
              onChange={(event) => onSetInMenu(sectionId, event.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[var(--ui-brand)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold text-ui-ink">
                {es["editor.menu.toggle"]}
              </span>
              <span className="text-[12px] leading-snug text-ui-muted">
                {es["editor.menu.as"].replace("{label}", menuLabel)}
              </span>
            </span>
          </label>

          {/**
           * The count of what is left, and then — only when there is one — the sentence about the
           * site's own menu: that it is not drawn yet, or that it is drawn small because this
           * owner decided so. Said rather than implied, which is the half of «nada de interfaz que
           * prometa más de lo que hay» that cuts the other way: a switch beside a count, on a site
           * publishing no menu at all, promises a strip nobody will see.
           *
           * **Outside the `<label>`, deliberately.** Everything inside a label is the control's
           * accessible name, and these sentences are about the site rather than about this switch.
           * Left in, the name read aloud on focus would be four sentences long and would change
           * every time another section left the menu.
           */}
          <p className="m-0 text-[12px] leading-snug text-ui-muted">{sectionsLeftText(menu)}</p>
          {note === undefined ? null : (
            <p className="m-0 text-[12px] leading-snug text-ui-muted">{note}</p>
          )}
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
        placeholder={row.kind === "link" ? es["editor.fields.labelHint"] : ""}
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
            <p className="m-0 text-[12px] leading-snug text-[#B91C1C]">
              {es["editor.fields.deadDestination"]}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
