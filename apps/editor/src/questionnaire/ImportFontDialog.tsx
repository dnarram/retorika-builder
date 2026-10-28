"use client";

import { FONT_KINDS, type FontKind, type OwnFont, type OwnLicenceFormat } from "@retorika/schema";
import type { FontKey } from "@retorika/tokens";
import { useId, useMemo, useRef, useState } from "react";
import {
  ACCEPTED_FONT_ACCEPT,
  MAX_FONT_FILES,
  MAX_LICENCE_BYTES,
  sniffLicence,
} from "../editor/fontBytes.ts";
import {
  DEFAULT_KIND,
  fileRefusalText,
  type InspectedFile,
  nameProblem,
  noteText,
  planImport,
  refusalText,
  requestInspection,
} from "../editor/fontImport.ts";
import { faceFileFor, mintFontId, type StoredFontFile } from "../editor/ownFonts.ts";
import { useFocusTrap } from "../editor/useFocusTrap.ts";
import es from "../locales/es.json" with { type: "json" };
import { TextField } from "./ui.tsx";

/**
 * «Subir mi fuente» — the owner's brand letter, brought in from their own files (ADR 0056, sprint 29
 * día 5).
 *
 * **Opened from the letter chooser, for the half it was choosing**, in the shell's `overlay` like
 * every dialog since sprint 28 día 6 — the chooser gives way to it and comes back when it closes,
 * with the new font chosen. It is a short sequence, not a form: the files first, then what the
 * server read from them — the name it will travel under, editable; its character; every note the
 * owner is owed about weights and size — then the licence, and «Añadir» only once the declaration is
 * ticked. Nothing reaches the document before «Añadir».
 *
 * **The checkbox is David's condition 4, word for word**, and its sentence goes to the CEO before
 * this merges: the product carries the owner's declaration and checks nothing behind it, and the
 * line under it says so rather than letting a checkbox pass for a check.
 *
 * **The bytes are read once.** Each file is read into memory when chosen, sent to the inspection
 * route, and the same bytes are what `onAdd` hands back for storage — never re-read from the `File`,
 * which a browser may have let go of.
 */
export interface ImportFontDialogProps {
  /** The half the chooser was open for: the new font is chosen there on «Añadir». */
  fontKey: FontKey;
  /** The document's own fonts, for the name the new one must not share. */
  existing: readonly OwnFont[];
  onAdd: (font: OwnFont, files: StoredFontFile[]) => void;
  onCancel: () => void;
}

interface Chosen {
  files: InspectedFile[];
  bytes: Uint8Array[];
}

interface Licence {
  name: string;
  format: OwnLicenceFormat;
  bytes: Uint8Array;
}

const KB = 1024;

export function ImportFontDialog({ fontKey, existing, onAdd, onCancel }: ImportFontDialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const nameId = `${id}-name`;
  const declareId = `${id}-declare`;
  const container = useFocusTrap(true, onCancel);
  const fontInput = useRef<HTMLInputElement>(null);
  const licenceInput = useRef<HTMLInputElement>(null);

  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [kind, setKind] = useState<FontKind>(DEFAULT_KIND);
  const [licence, setLicence] = useState<Licence | null>(null);
  const [licenceProblem, setLicenceProblem] = useState<string | null>(null);
  const [declared, setDeclared] = useState(false);

  const plan = useMemo(
    () => (chosen === null ? null : planImport(chosen.files, existing)),
    [chosen, existing],
  );
  const ready = plan?.ok === true ? plan.plan : null;
  const name = typedName ?? ready?.family ?? "";
  const nameIssue = ready === null ? undefined : nameProblem(name, existing);
  const canAdd = ready !== null && nameIssue === undefined && declared && !reading;

  async function choose(list: FileList | null) {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    setProblem(null);
    setChosen(null);
    setTypedName(null);
    if (files.length > MAX_FONT_FILES) {
      setProblem(es["editor.font.import.refuse.tooMany"]);
      return;
    }
    setReading(true);
    try {
      const inspected: InspectedFile[] = [];
      const bytes: Uint8Array[] = [];
      for (const file of files) {
        const data = new Uint8Array(await file.arrayBuffer());
        const answer = await requestInspection(data);
        if (!answer.ok) {
          setProblem(fileRefusalText(answer.refusal, file.name));
          return;
        }
        inspected.push({ name: file.name, inspection: answer.inspection });
        bytes.push(data);
      }
      const result = planImport(inspected, existing);
      if (!result.ok) {
        setProblem(refusalText(result.refusal));
        return;
      }
      setChosen({ files: inspected, bytes });
    } finally {
      setReading(false);
    }
  }

  async function chooseLicence(list: FileList | null) {
    const file = list?.[0];
    if (file === undefined) return;
    setLicenceProblem(null);
    if (file.size > MAX_LICENCE_BYTES) {
      setLicenceProblem(es["editor.font.import.licenceTooLarge"].replace("{file}", file.name));
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    // The format is the one the bytes are, whatever the file was called: a PDF named `.txt` travels
    // as the PDF it is (David's adjustment 3), and `/api/download` sniffs it again.
    const format = sniffLicence(bytes);
    if (format === null) {
      setLicenceProblem(es["editor.font.import.licenceRefused"].replace("{file}", file.name));
      return;
    }
    setLicence({ name: file.name, format, bytes });
  }

  function add() {
    if (!canAdd || ready === null || chosen === null) return;
    const fontId = mintFontId(existing);
    const font: OwnFont = {
      id: fontId,
      family: name,
      kind,
      faces: ready.faces.map(({ face }) => face),
      licence: { declared: true, at: new Date().toISOString() },
      ...(licence === null ? {} : { licenceFile: licence.format }),
    };
    const files: StoredFontFile[] = ready.faces.map(({ face, from }) => ({
      file: faceFileFor(fontId, face),
      bytes: chosen.bytes[from] as Uint8Array,
    }));
    if (licence !== null) {
      files.push({ file: `LICENCIA-propia-${fontId}.${licence.format}`, bytes: licence.bytes });
    }
    onAdd(font, files);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0F172A]/45 p-5 phone:items-end phone:p-0">
      <div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-font-key={fontKey}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-[520px] flex-col gap-4 rounded-ui-xl bg-ui-surface p-6 shadow-ui-3 phone:max-h-[85dvh] phone:rounded-b-none"
      >
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="m-0 text-[17px] font-bold text-ui-ink">
            {es["editor.font.import.title"]}
          </h2>
          <p className="m-0 text-[13px] leading-snug text-ui-muted">
            {es["editor.font.import.intro"]}
          </p>
        </div>

        {/* `min-h-0`, so the body scrolls inside the box and the two buttons stay on screen — the
            lesson `DownloadGateDialogs.tsx` records. */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <section
            aria-label={es["editor.font.import.pick"]}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void choose(event.dataTransfer.files);
            }}
            className={
              "flex flex-col items-center gap-2 rounded-ui border border-dashed px-4 py-5 text-center " +
              (dragging ? "border-ui-brand bg-ui-brand-surface" : "border-ui-border-strong")
            }
          >
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                data-initial-focus
                disabled={reading}
                onClick={() => fontInput.current?.click()}
                className="ui-interactive h-10 cursor-pointer rounded-ui-sm border border-ui-border bg-ui-surface px-4 text-[14px] font-semibold text-ui-ink hover:border-ui-border-strong disabled:cursor-default disabled:opacity-60"
              >
                {es["editor.font.import.pick"]}
              </button>
              <span className="text-[13px] text-ui-muted">{es["editor.font.import.drop"]}</span>
            </div>
            <p className="m-0 text-[12px] leading-snug text-ui-muted">
              {es["editor.font.import.formats"]}
            </p>
            <input
              ref={fontInput}
              type="file"
              accept={ACCEPTED_FONT_ACCEPT}
              multiple
              className="hidden"
              data-font-files
              onChange={(event) => {
                void choose(event.target.files);
                // The same file chosen twice in a row must still fire `change`.
                event.target.value = "";
              }}
            />
          </section>

          <p aria-live="polite" className="m-0 text-[13px] leading-snug text-ui-ink empty:hidden">
            {reading ? es["editor.font.import.reading"] : (problem ?? "")}
          </p>

          {ready !== null && chosen !== null ? (
            <>
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-ui-muted">
                {chosen.files.map((file) => (
                  <li key={file.name}>
                    {es["editor.font.import.file"]
                      .replace("{file}", file.name)
                      .replace("{kb}", String(Math.round(file.inspection.bytes / KB)))}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-1.5">
                {/* The field's own visible label, whose `-12px` foot expects this gap — the shape
                    the sign-in screens use for the same reason. */}
                <div className="flex flex-col gap-[18px]">
                  <TextField
                    id={nameId}
                    label={es["editor.font.import.name"]}
                    labelHidden={false}
                    value={name}
                    onChange={(event) => setTypedName(event.target.value)}
                    height={44}
                    autoComplete="off"
                    spellCheck={false}
                    variant={nameIssue === undefined ? "muted" : "error"}
                    aria-describedby={`${nameId}-help`}
                  />
                </div>
                <p id={`${nameId}-help`} className="m-0 text-[12px] leading-snug text-ui-muted">
                  {nameIssue ??
                    (ready.family !== ready.original && typedName === null
                      ? es["editor.font.import.nameRenamed"]
                          .replace("{original}", ready.original)
                          .replace("{name}", ready.family)
                      : es["editor.font.import.nameHelp"])}
                </p>
              </div>

              <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
                <legend className="mb-1.5 p-0 text-[13px] font-semibold text-ui-ink">
                  {es["editor.font.import.kind"]}
                </legend>
                {FONT_KINDS.map((option) => {
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

              {ready.notes.length > 0 ? (
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {ready.notes.map((note) => (
                    <li
                      key={`${note.kind}-${"file" in note ? note.file : ""}`}
                      className="rounded-ui-sm bg-ui-brand-surface px-3 py-2 text-[13px] leading-snug text-ui-ink"
                    >
                      {noteText(note)}
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-ui-ink">
                  {es["editor.font.import.licence"]}
                </span>
                <p className="m-0 text-[12px] leading-snug text-ui-muted">
                  {es["editor.font.import.licenceHelp"]}
                </p>
                {licence === null ? (
                  <button
                    type="button"
                    onClick={() => licenceInput.current?.click()}
                    className="ui-interactive h-9 self-start cursor-pointer rounded-ui-sm border border-ui-border bg-ui-surface px-3 text-[13px] font-semibold text-ui-ink hover:border-ui-border-strong"
                  >
                    {es["editor.font.import.licencePick"]}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-[13px] text-ui-ink">
                    <span className="min-w-0 truncate">
                      {es["editor.font.import.licenceAttached"].replace("{file}", licence.name)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLicence(null)}
                      className="ui-interactive h-8 shrink-0 cursor-pointer rounded-ui-sm border border-ui-border bg-ui-surface px-3 text-[13px] font-semibold text-ui-ink hover:border-ui-border-strong"
                    >
                      {es["editor.font.import.licenceRemove"]}
                    </button>
                  </div>
                )}
                {licenceProblem === null ? null : (
                  <p role="alert" className="m-0 text-[12px] leading-snug text-ui-ink">
                    {licenceProblem}
                  </p>
                )}
                <input
                  ref={licenceInput}
                  type="file"
                  accept=".txt,.pdf"
                  className="hidden"
                  data-font-licence
                  onChange={(event) => {
                    void chooseLicence(event.target.files);
                    event.target.value = "";
                  }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor={declareId} className="flex cursor-pointer items-start gap-2.5">
                  <input
                    id={declareId}
                    type="checkbox"
                    checked={declared}
                    onChange={(event) => setDeclared(event.target.checked)}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--ui-brand)]"
                  />
                  <span className="text-[14px] font-semibold leading-snug text-ui-ink">
                    {es["editor.font.import.declare"]}
                  </span>
                </label>
                <p className="m-0 pl-[28px] text-[12px] leading-snug text-ui-muted">
                  {es["editor.font.import.declareHelp"]}
                </p>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="ui-interactive h-10 cursor-pointer rounded-ui-sm border border-ui-border bg-ui-surface px-4 text-[14px] font-semibold text-ui-ink hover:border-ui-border-strong"
          >
            {es["editor.font.import.cancel"]}
          </button>
          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            className="h-10 cursor-pointer rounded-ui-sm border-0 bg-ui-brand px-4 text-[14px] font-semibold text-white disabled:cursor-default disabled:opacity-50"
          >
            {es["editor.font.import.add"]}
          </button>
        </div>
      </div>
    </div>
  );
}
