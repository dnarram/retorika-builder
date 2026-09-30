"use client";

import type { ElementAddress, RetorikaDocument, StyleException } from "@retorika/schema";
import { useId } from "react";
import { listPhotos } from "../editor/photoInventory.ts";
import { type ContrastFinding, formatRatio } from "../editor/styleReview.ts";
import es from "../locales/es.json" with { type: "json" };
import { StateChip } from "./PhotosPanel.tsx";

/**
 * The dialogs `downloadGate.ts` can call for. That module decides *which* — from the same counts
 * the «Fotos» panel reads, and since sprint 9 day 6 from the contrast review as well; these only
 * draw what it decided.
 */

const closeIcon = (
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
);

/**
 * **The hard block.** ADR 0019's dead-destination rule is the precedent: a request that is going
 * to fail on the server regardless of what the owner decides gets no "do it anyway" button,
 * because there is nothing to warn about — only something to fix first. No thumbnails and no list
 * of photographs, unlike the warning below: which specific photographs to remove is the owner's
 * call to make by looking at their own site, not this dialog's to guess by picking some.
 */
export function TooManyPhotosDialog({
  count,
  max,
  onClose,
}: {
  count: number;
  max: number;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#0F172A]/45 p-5">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[440px] rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.28)]"
      >
        <h2 id={titleId} className="m-0 text-[17px] font-bold text-ui-ink">
          {es["editor.download.tooManyPhotos.title"]}
        </h2>
        <p className="mt-2 mb-0 text-[14px] leading-snug text-ui-muted">
          {es["editor.download.tooManyPhotos.body"]
            .replace("{count}", String(count))
            .replace("{max}", String(max))}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 cursor-pointer rounded-[10px] border-0 bg-ui-brand px-5 text-[14px] font-semibold text-white"
          >
            {es["editor.download.tooManyPhotos.close"]}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * **The warning ADR 0011 asked for, doubled.** The ADR wrote one sentence, for a bank photograph;
 * an empty bank made a second one necessary — "no son de tu negocio" describes a photograph, and
 * a grey rectangle reading «Tu foto aquí» is not one. Both can be true of the same site at once
 * (a bank photograph on the cover, an unfilled marker in a gallery), so both render, each only
 * when its count is above zero — never a single sentence trying to cover a state it does not
 * describe.
 *
 * Every listed photograph gets its own «Cambiar», identical to the «Fotos» panel's, because this
 * is the same list under a different door: the owner reached it by pressing «Descargar» instead
 * of opening the rail, and closing over a photograph they just fixed should feel like finishing
 * something, not like starting over in a different screen.
 */
export function DownloadWarningDialog({
  document: doc,
  photoUrls,
  onReplacePhoto,
  onDownloadAnyway,
  onCancel,
}: {
  document: RetorikaDocument;
  /** The same map the canvas and the «Fotos» panel already read — a bundle-relative src resolves
   * against nothing here either. */
  photoUrls: ReadonlyMap<string, string>;
  onReplacePhoto: (address: ElementAddress) => void;
  onDownloadAnyway: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const photos = listPhotos(doc).filter((photo) => photo.state !== "own");
  const sampleCount = photos.filter((photo) => photo.state === "sample").length;
  const emptyCount = photos.filter((photo) => photo.state === "empty").length;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#0F172A]/45 p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[85vh] w-full max-w-[520px] flex-col rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.28)]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="m-0 text-[17px] font-bold text-ui-ink">
            {es["editor.download.warning.title"]}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={es["editor.toast.dismiss"]}
            className="shrink-0 cursor-pointer border-0 bg-transparent text-[#94A3B8]"
          >
            {closeIcon}
          </button>
        </div>

        <div className="mt-1 flex flex-col gap-1.5">
          {sampleCount > 0 ? (
            <p className="m-0 text-[14px] leading-snug text-ui-muted">
              {sampleCount === 1
                ? es["editor.download.warning.sample.one"]
                : es["editor.download.warning.sample.many"].replace("{n}", String(sampleCount))}
            </p>
          ) : null}
          {emptyCount > 0 ? (
            <p className="m-0 text-[14px] leading-snug text-ui-muted">
              {emptyCount === 1
                ? es["editor.download.warning.empty.one"]
                : es["editor.download.warning.empty.many"].replace("{n}", String(emptyCount))}
            </p>
          ) : null}
        </div>

        <ul className="mt-4 flex flex-col gap-1.5 overflow-y-auto">
          {photos.map((photo) => {
            const address = { sectionId: photo.sectionId, elementId: photo.elementId };
            const where = photo.itemNumber
              ? es["editor.photos.whereInList"]
                  .replace("{n}", String(photo.itemNumber))
                  .replace("{section}", photo.sectionName)
              : photo.sectionName;

            return (
              <li
                key={`${photo.sectionId}:${photo.elementId}`}
                className="flex items-center gap-2 rounded-[10px] border border-ui-border bg-white p-1.5"
              >
                {/* Decorative, same as the «Fotos» panel: the row's own words already say which
                    photograph this is. */}
                <img
                  src={photoUrls.get(photo.src) ?? photo.src}
                  alt=""
                  className="h-10 w-14 shrink-0 rounded-md border border-ui-border object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ui-ink">{where}</span>
                <StateChip state={photo.state} />
                <button
                  type="button"
                  onClick={() => onReplacePhoto(address)}
                  className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-[12px] font-semibold text-ui-brand hover:bg-ui-brand-surface"
                >
                  {es["editor.photos.change"]}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex items-center justify-end gap-5">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer border-0 bg-transparent text-[14px] font-medium text-ui-muted"
          >
            {es["editor.download.warning.cancel"]}
          </button>
          <button
            type="button"
            onClick={onDownloadAnyway}
            className="h-10 cursor-pointer rounded-[10px] border-0 bg-ui-brand px-5 text-[14px] font-semibold text-white"
          >
            {es["editor.download.warning.downloadAnyway"]}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The contrast review's two dialogs, which are one component because they differ in exactly two
 * things: whether there is a way past, and what the foot of the dialog says.
 *
 * Writing them separately would have duplicated the list — and the list is the part that matters,
 * because «arreglo en un clic» means each row carries its own fix. The two families they belong to
 * are already in this file: the block reads like `TooManyPhotosDialog` (no way past, because there
 * is nothing to decide) and the warning like `DownloadWarningDialog` (a way past, because there is).
 *
 * **The fix is to drop the exception**, not to pick a colour that would pass. Dropping it returns
 * the element to the reference it overwrote, which is rule 6's own default state rather than a
 * colour this dialog guessed at — so the button says what it does, and it calls the same verb the
 * `Diseño` panel's audit calls.
 */
export function ContrastDialog({
  findings,
  level,
  onFix,
  onDownloadAnyway,
  onCancel,
}: {
  findings: readonly ContrastFinding[];
  level: "block" | "warn";
  onFix: (exception: StyleException) => void;
  /** Absent for the block, which is what makes it a block. */
  onDownloadAnyway?: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const blocking = level === "block";
  const prefix = blocking ? "editor.download.unreadable" : "editor.download.lowContrast";
  const body =
    findings.length === 1
      ? es[`${prefix}.body.one` as keyof typeof es]
      : es[`${prefix}.body.many` as keyof typeof es].replace("{n}", String(findings.length));

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#0F172A]/45 p-5">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-[520px] flex-col rounded-2xl bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.28)]"
      >
        <h2 id={titleId} className="m-0 text-[17px] font-bold text-ui-ink">
          {es[`${prefix}.title` as keyof typeof es]}
        </h2>
        <p className="mt-2 mb-0 text-[14px] leading-snug text-ui-muted">{body}</p>

        <div className="mt-4 flex min-h-0 flex-col gap-2 overflow-y-auto">
          {findings.map((finding) => (
            <div
              key={`${finding.exception.sectionId}/${finding.exception.elementId}`}
              className="flex items-center justify-between gap-3 rounded-[9px] border border-ui-border px-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                {/* The colour itself, beside its words. A ratio alone is a number nobody can match
                    to something on their own screen. */}
                <span
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 rounded-full border border-black/10"
                  style={{ background: finding.exception.exact }}
                />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[13px] text-ui-ink">
                    {finding.exception.label ?? finding.exception.slot}
                  </span>
                  <span className="text-[12px] text-ui-muted">
                    {es["editor.download.contrast.ratio"].replace(
                      "{ratio}",
                      formatRatio(finding.ratio),
                    )}
                  </span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => onFix(finding.exception)}
                className="shrink-0 cursor-pointer rounded-[8px] border-0 bg-ui-brand px-3 py-2 text-[13px] font-semibold text-white"
              >
                {es["editor.download.contrast.fix"]}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-4 mb-0 text-[12px] leading-snug text-ui-muted">
          {es[`${prefix}.foot` as keyof typeof es]}
        </p>

        <div className="mt-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 cursor-pointer rounded-[10px] border border-ui-border bg-white px-4 text-[14px] font-medium text-ui-ink"
          >
            {es["editor.download.contrast.cancel"]}
          </button>
          {/* No way past the block, for the reason `TooManyPhotosDialog` gives: there is nothing
              to warn about, only something to fix first. */}
          {!blocking && onDownloadAnyway ? (
            <button
              type="button"
              onClick={onDownloadAnyway}
              className="h-10 cursor-pointer rounded-[10px] border-0 bg-ui-brand px-5 text-[14px] font-semibold text-white"
            >
              {es["editor.download.warning.downloadAnyway"]}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
