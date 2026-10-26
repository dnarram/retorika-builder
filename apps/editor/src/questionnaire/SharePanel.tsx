"use client";

import {
  type RetorikaDocument,
  readSiteUrl,
  shareDescriptionOf,
  shareImageIssue,
  shareImageOf,
} from "@retorika/schema";
import { useEffect, useId, useState } from "react";
import { PANEL_WIDTH, PanelClose, panelCard } from "../editor/panelKit.tsx";
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
      // **Beside the canvas, not over it**, which is what `EditorShell`'s own `panel` prop has
      // always said it would be: «rendered beside the canvas rather than over it… the preview
      // narrows and stays visible». This was the one rail panel still `fixed` to the viewport, and
      // it painted 316px of itself across the page being edited at every window width measured.
      // Losing `border-l` and the drawer shadow is what that change means: it is a card beside the
      // preview now, like «Estilo» and «Diseño», not an edge pulled over it.
      className={`${PANEL_WIDTH} gap-4 p-5 ${panelCard}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="m-0 text-[15px] font-bold text-ui-ink">
            {es["editor.share.title"]}
          </h2>
          <p className="m-0 text-[12px] leading-snug text-ui-muted">{es["editor.share.help"]}</p>
        </div>
        {/* `editor.share.close`, not `editor.fields.close` — this button announced «Cerrar los
            campos» until sprint 21 day 4 found it while extracting the shared close button, which
            is what reading five near-identical copies side by side is good for. Nobody had heard
            it: a sighted press never reaches the label. */}
        <PanelClose onClick={onClose} label={es["editor.share.close"]} />
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
          className="h-9 w-full rounded-lg border border-ui-border bg-white px-2.5 text-[13px] phone:text-base text-ui-ink"
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
        {/* `phone:text-base`, here and on every text field and `<select>` the rail's six panels
            and the fields drawer draw (sprint 21 day 4, ADR 0042 §7): Safari on iOS zooms the
            whole page into a focused field whose text is under 16px, and 13px — this row's own
            desktop size — is what the day's phone walk caught it on. `text-[13px]` stays for the
            studio and tablet classes; a field that read comfortably at 340px desktop was never
            the one that needed the floor. */}
        <input
          id={urlId}
          type="text"
          defaultValue={doc.siteUrl ?? ""}
          placeholder={es["editor.share.url.placeholder"]}
          onBlur={(event) => commitUrl(event.target.value)}
          className={`h-9 w-full rounded-lg border bg-white px-2.5 text-[13px] phone:text-base text-ui-ink ${
            urlIssue ? "border-ui-danger" : "border-ui-border"
          }`}
        />
        <p className="m-0 text-[12px] leading-snug text-ui-muted">{es["editor.share.url.help"]}</p>
        {urlIssue ? (
          <p className="m-0 text-[12px] leading-snug text-ui-danger-deep">{urlIssue}</p>
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
