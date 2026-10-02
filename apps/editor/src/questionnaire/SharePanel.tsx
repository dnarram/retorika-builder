"use client";

import {
  type RetorikaDocument,
  readSiteUrl,
  shareDescriptionOf,
  shareImageIssue,
  shareImageOf,
} from "@retorika/schema";
import { useEffect, useId, useState } from "react";
import es from "../locales/es.json" with { type: "json" };

/**
 * What a shared link shows: a sentence and, if the owner knows it, where the site will live
 * (ADR 0029).
 *
 * **A rail item rather than a step in the download, and that was asked and answered.** The download
 * path is where the ten-minute criterion is measured, and every gate on it today exists to stop or
 * warn about something wrong. An empty address is explicitly neither — it «no es error y no bloquea
 * nada» — so a form there would be the first thing to interrupt a download that is already correct.
 * The assessment, and the drawing it was made from, are mockup 19 and the entry in `REVIEW.md`.
 *
 * Both boxes commit on blur, like every other box in this editor.
 */

/** Past this, a preview card is slow to fill in. Orientative and said so: it is a warning, never a
 * block, which is this product's standing line — the placeholder text warns, the dead link blocks. */
const HEAVY_PREVIEW_BYTES = 300_000;

export interface SharePanelProps {
  doc: RetorikaDocument;
  /** The object URL each photograph is showing under, so a heavy one can be measured rather than
   * guessed at. Absent for a photograph the owner has not uploaded. */
  photoUrls: ReadonlyMap<string, string>;
  onSetDescription: (text: string) => void;
  onSetUrl: (url: string | undefined) => void;
  onClose: () => void;
}

export function SharePanel({
  doc,
  photoUrls,
  onSetDescription,
  onSetUrl,
  onClose,
}: SharePanelProps) {
  const headingId = useId();
  const descriptionId = useId();
  const urlId = useId();
  const [urlIssue, setUrlIssue] = useState<string | null>(null);

  const image = shareImageOf(doc);
  // **The same question the renderer asks**, so the panel cannot promise a card the ZIP will not
  // carry. A picture that is a `data:` URI, an SVG or the grey marker publishes no `og:image`, and
  // before this read that it said nothing at all and the owner found out by sharing the link.
  const willShowImage = image !== undefined && shareImageIssue(image.src) === undefined;
  const heavyKb = useHeavyPreview(willShowImage ? image?.src : undefined, photoUrls);

  // What the renderer will publish when the box is empty — asked by giving it a document with no
  // description, rather than by a second copy of the fallback rule living here. One definition
  // (`shareDescriptionOf`), so the preview and the published page cannot disagree.
  const fallback = shareDescriptionOf({ ...doc, siteDescription: undefined });

  function commitUrl(typed: string) {
    const reading = readSiteUrl(typed);
    if (reading.kind === "empty") {
      setUrlIssue(null);
      onSetUrl(undefined);
      return;
    }
    if (reading.kind === "issue") {
      setUrlIssue(es[`editor.share.url.${reading.issue}` as keyof typeof es]);
      return;
    }
    setUrlIssue(null);
    onSetUrl(reading.url);
  }

  return (
    <aside
      aria-labelledby={headingId}
      className="fixed top-[58px] right-0 bottom-0 z-20 flex w-[340px] flex-col gap-4 overflow-y-auto border-l border-ui-border bg-ui-surface p-5 shadow-[-8px_0_24px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="m-0 text-[15px] font-bold text-ui-ink">
            {es["editor.share.title"]}
          </h2>
          <p className="m-0 text-[12px] leading-snug text-ui-muted">{es["editor.share.help"]}</p>
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor={descriptionId} className="text-[12px] font-semibold text-ui-ink">
          {es["editor.share.description.label"]}
        </label>
        <input
          id={descriptionId}
          type="text"
          maxLength={300}
          defaultValue={doc.siteDescription ?? ""}
          // **A placeholder, never a value.** Pre-filling it with the subheadline would make the
          // two drift the first time somebody edited the cover, and then there would be two
          // sentences and neither of them in charge.
          placeholder={fallback ?? ""}
          onBlur={(event) => onSetDescription(event.target.value)}
          className="h-9 w-full rounded-lg border border-ui-border bg-white px-2.5 text-[13px] text-ui-ink"
        />
        {fallback ? (
          <p className="m-0 text-[12px] leading-snug text-ui-muted">
            {es["editor.share.description.hint"]} <span className="italic">«{fallback}»</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-ui-border pt-4">
        <label htmlFor={urlId} className="text-[12px] font-semibold text-ui-ink">
          {es["editor.share.url.label"]}
          <span className="ml-1.5 font-normal text-ui-muted">
            {es["editor.share.url.optional"]}
          </span>
        </label>
        <input
          id={urlId}
          type="text"
          defaultValue={doc.siteUrl ?? ""}
          placeholder={es["editor.share.url.placeholder"]}
          onBlur={(event) => commitUrl(event.target.value)}
          className={`h-9 w-full rounded-lg border bg-white px-2.5 text-[13px] text-ui-ink ${
            urlIssue ? "border-[#DC2626]" : "border-ui-border"
          }`}
        />
        <p className="m-0 text-[12px] leading-snug text-ui-muted">{es["editor.share.url.help"]}</p>
        {urlIssue ? (
          <p className="m-0 text-[12px] leading-snug text-[#B91C1C]">{urlIssue}</p>
        ) : null}
        {/* What was actually stored, shown back: «midominio.es» becomes «https://midominio.es» and
            the owner sees the address their visitors will.

            **Shown even while the box is reporting a problem**, which a browser walk is what caught.
            The two lines answer different questions — «what you just typed is not an address» and
            «this is what your site will publish» — and the second stays true, because a refused
            entry changes nothing. Hiding it at the moment the owner is confused was the panel
            going quiet exactly when it had something useful to say. */}
        {doc.siteUrl ? (
          <p className="m-0 text-[12px] leading-snug text-ui-muted">
            {es["editor.share.url.saved"].replace("{url}", doc.siteUrl)}
          </p>
        ) : null}
        {!willShowImage ? (
          <p className="m-0 text-[12px] leading-snug text-ui-muted">
            {es["editor.share.url.noPhoto"]}
          </p>
        ) : null}
        {heavyKb !== undefined ? (
          <p className="m-0 text-[12px] leading-snug text-ui-muted">
            {es["editor.share.url.heavy"].replace("{kb}", String(heavyKb))}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

/**
 * How many KB the preview photograph weighs, when that is worth saying.
 *
 * **Measured off the blob the browser already has**, rather than carried through the three places
 * photo bytes enter this app. `fetch` on an object URL hands back the very Blob it was made from,
 * so this is the real size of the file that will travel — no second accounting to keep in step.
 *
 * `undefined` means «nothing to say»: no photograph, no upload behind it, or a size under the line.
 */
function useHeavyPreview(
  src: string | undefined,
  photoUrls: ReadonlyMap<string, string>,
): number | undefined {
  const url = src ? photoUrls.get(src) : undefined;
  const [kb, setKb] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!url) {
      setKb(undefined);
      return;
    }
    let cancelled = false;
    void fetch(url)
      .then((response) => response.blob())
      .then((blob) => {
        if (cancelled) return;
        setKb(blob.size > HEAVY_PREVIEW_BYTES ? Math.round(blob.size / 1000) : undefined);
      })
      // A size that cannot be read says nothing, which is the honest answer: a warning invented
      // from a failed measurement is worse than no warning.
      .catch(() => {
        if (!cancelled) setKb(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return kb;
}
