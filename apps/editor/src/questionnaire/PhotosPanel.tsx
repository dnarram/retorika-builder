"use client";

import type { ElementAddress, RetorikaDocument } from "@retorika/schema";
import { useId } from "react";
import { countPhotos, listPhotos, type PhotoState } from "../editor/photoInventory.ts";
import es from "../locales/es.json" with { type: "json" };

/**
 * «Fotos» — the rail's fourth item, and the last one that was still a `FASE 2` badge.
 *
 * **What earns it the icon is not "change a photo".** The canvas already does that: click the
 * photograph you can see. This is the only place in the product that sees the *whole site at once*,
 * and that only became necessary when sprint 5 shipped pages — with five pages, a gallery of eight
 * and a cover, an owner has no way to answer «which of my photographs are still not mine» without
 * visiting every page and remembering. The panel is the delayed second half of pages.
 *
 * It is also the answer the sessions actually need. Both owners said the site looked visually poor;
 * the product cannot hand them photographs it does not have, but it can stop them having to hunt
 * for the holes.
 */
export function PhotosPanel({
  document: doc,
  onReplacePhoto,
  onGoToPhoto,
  photoUrls,
}: {
  document: RetorikaDocument;
  /** Open the file picker for this image. `Editor` owns the one hidden input the canvas already
   * uses, so this is the same upload path and not a second one. */
  onReplacePhoto: (address: ElementAddress) => void;
  /** Show the page this photograph is on and scroll it into view, so the panel is also a way of
   * finding one. */
  onGoToPhoto: (photo: { pageId: string; sectionId: string }) => void;
  /** Object URLs for photographs already uploaded, keyed by the `src` the document carries —
   * the same map the preview needs, for the same reason: a bundle-relative path resolves against
   * the parent page inside a `srcDoc` iframe and 404s. */
  photoUrls: ReadonlyMap<string, string>;
}) {
  const headingId = useId();
  const photos = listPhotos(doc);
  const counts = countPhotos(doc);
  const missing = counts.empty + counts.sample;
  // The page only tells one photograph from another once there is more than one page. On a
  // single-page site it is the same words under every row, which is noise wearing the costume of
  // information — and the rows are narrow enough that the space is worth more than the repetition.
  const showsPage = doc.pages.length > 1;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 p-4">
      <h2 id={headingId} className="text-[13px] font-bold text-ui-ink">
        {es["editor.photos.title"]}
      </h2>

      {photos.length === 0 ? (
        // Reachable: a cover can be deleted, and nothing else a generated site carries holds an
        // image. A sentence saying what to do, not a disabled control — the shape `PagesPanel`
        // already uses for "you cannot make a page from here".
        <p className="text-[12px] leading-snug text-ui-muted">{es["editor.photos.none"]}</p>
      ) : (
        <>
          {/* The panel's whole argument in one line, and the reason the icon is worth having. */}
          <p className="text-[12px] leading-snug text-ui-muted">
            {missing === 0
              ? es["editor.photos.allYours"]
              : es["editor.photos.summary"]
                  .replace("{missing}", String(missing))
                  .replace("{total}", String(counts.total))}
          </p>

          <ul className="flex flex-col gap-1.5">
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
                  <button
                    type="button"
                    onClick={() => onGoToPhoto(photo)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left"
                  >
                    {/* Decorative here: the row's own words already say which photograph this is,
                        and the document's alt describes the picture rather than its place. */}
                    <img
                      src={photoUrls.get(photo.src) ?? photo.src}
                      alt=""
                      className="h-10 w-14 shrink-0 rounded-md border border-ui-border object-cover"
                    />
                    <span className="flex min-w-0 flex-col">
                      {/* Wrapped rather than truncated: this is the label that says which
                          photograph the row is, and «Foto 1 de Fotos de tra…» is worse than two
                          short lines. The page below it truncates, because it repeats. */}
                      <span className="text-[13px] leading-snug text-ui-ink">{where}</span>
                      {showsPage && (
                        <span className="truncate text-[11px] text-ui-muted">
                          {photo.pageTitle}
                        </span>
                      )}
                    </span>
                  </button>

                  <StateChip state={photo.state} />

                  <button
                    type="button"
                    onClick={() => onReplacePhoto(address)}
                    className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-ui-brand hover:bg-ui-brand-surface"
                  >
                    {es["editor.photos.change"]}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

/** Three states, three sentences. «Foto de ejemplo» over the grey marker that already reads «Tu
 * foto aquí» would be a label on a label, so the marker gets its own word. */
function StateChip({ state }: { state: PhotoState }) {
  const label = es[`editor.photos.state.${state}` as keyof typeof es];
  const tone =
    state === "own" ? "bg-ui-bg text-ui-muted" : "bg-[#FEF3C7] text-[#92400E] font-semibold";
  return <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] ${tone}`}>{label}</span>;
}
