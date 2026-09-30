import { GALLERY_PHOTOS } from "@retorika/catalog";
import { MAX_PAGES, type RetorikaDocument } from "@retorika/schema";
import type { PhotoCounts } from "./photoInventory.ts";
import { type ContrastFinding, reviewStyle } from "./styleReview.ts";

/**
 * What pressing «Descargar» does, decided before the request is ever made.
 *
 * **`MAX_PHOTOS`, a number that used to be a leftover.** The download route's own cap was `10`,
 * set before `packages/catalog/src/gallery.ts`'s eight-photo gallery and
 * `packages/schema/src/conversion.ts`'s five pages existed — a single gallery alone already needs
 * 8, and two, "trivial once a site has pages" per the sprint 6 plan, already need 17. Nobody had
 * revisited it since, so the product's own two shipped features could put a legitimate site over
 * its own download limit.
 *
 * Derived instead of picked: `MAX_PAGES` pages, each with at most one cover (1 photograph) and at
 * most one gallery (`GALLERY_PHOTOS.max`, 8 photographs) — nothing in the catalog stops a page from
 * carrying more than one of either, but nothing in the product asks an owner to, so this is the
 * realistic ceiling rather than the pathological one. 5 × (8 + 1) = 45.
 *
 * (`MAX_SECTIONS` and `MAX_ELEMENTS` in the download route are a different, lower kind of bound —
 * headroom against a request that did not come from this app at all, "never approaches" rather
 * than "a real owner might reach". This one a real owner can reach through ordinary use, which is
 * exactly why it needed a real derivation instead of staying a round number.)
 *
 * Placeholders never count: the catalog's marker is a self-contained `data:` URI needing no file,
 * so it cannot be what makes a request too large. A bank photograph does count — since sprint 6
 * day 4 it travels the same path an upload does, so it is exactly as much "a file this request
 * has to carry" as one.
 */
export const MAX_PHOTOS = MAX_PAGES * (GALLERY_PHOTOS.max + 1);

/**
 * The three things a download attempt can turn out to be, decided from the same counts the
 * «Fotos» panel already shows — so the gate and the panel can never disagree about how many
 * photographs are still not the owner's, or how many files the site is carrying in total.
 *
 * Checked in this order because a document that fails an earlier one is not fit to download at
 * all, regardless of what the later ones say:
 *
 * 1. **`"tooManyPhotos"`** — more real files than `/api/download` will accept. A hard block, the
 *    same kind ADR 0019's dead-destination rule is: the request is going to fail on the server
 *    regardless of what the owner decides, so there is nothing to warn about and nothing to
 *    download past. Discovering this as a bare `413` after the browser has already spent the time
 *    reading every photo off disk is worse than saying so before that starts.
 * 2. **`"unreadable"`** — an exact colour under 3:1 against its own background (sprint 9 day 6,
 *    ADR 0026). The third member of the blocking family, and it joins for the same reason as the
 *    first two: there is nothing to warn about, only something to fix before publishing. **Before
 *    the photo warning**, because a site with text nobody can read is not in a state where "some
 *    of your photographs are still ours" is the useful thing to say.
 * 3. **`"warn"`** — the site would download successfully, but some of what is in it is not the
 *    owner's yet: a bank photograph, an unfilled marker, or both. ADR 0011's warning, and an
 *    outcome the owner can go past on purpose.
 * 4. **`"lowContrast"`** — an exact colour between 3:1 and 4.5:1: legible at a large size, hard at
 *    a normal one. The same warn-or-block line the rest of the product draws, and the same "you
 *    decide" the marker-text warning gives. **After** the photo warning, because that one is about
 *    the whole site and this one about one element somebody deliberately painted.
 * 5. **`"ready"`** — nothing to say; `download()` runs immediately.
 *
 * Two of the five now need the document rather than the counts, which is why this takes it. The
 * counts stay a separate argument rather than being recomputed here, so the gate and the «Fotos»
 * panel go on reading the same numbers.
 *
 * **`accepted` is what makes two warnings two warnings rather than one.** Found by walking the
 * download on day 6: a site can have both an unfilled photo marker and a hard-to-read colour, and
 * pressing «Descargar igualmente» on the first dialog used to call `download()` — so the second
 * warning was never shown at all, and the owner downloaded a site carrying something nobody had
 * told them about. Going past a warning now means going past **that** warning: the gate is asked
 * again, and answers with whatever is still true. A block is never in this set, which is what a
 * block means.
 */
export type AcceptedWarning = "photos" | "contrast";
export type DownloadGate =
  | { kind: "ready" }
  | { kind: "tooManyPhotos"; count: number; max: number }
  | { kind: "unreadable"; findings: ContrastFinding[] }
  | { kind: "warn"; sample: number; empty: number }
  | { kind: "lowContrast"; findings: ContrastFinding[] };

export function downloadGateFor(
  counts: PhotoCounts,
  doc: RetorikaDocument,
  accepted: ReadonlySet<AcceptedWarning> = new Set(),
): DownloadGate {
  const real = counts.own + counts.sample;
  if (real > MAX_PHOTOS) return { kind: "tooManyPhotos", count: real, max: MAX_PHOTOS };

  const review = reviewStyle(doc);
  if (review.blocking.length > 0) return { kind: "unreadable", findings: review.blocking };

  if (!accepted.has("photos") && counts.sample + counts.empty > 0) {
    return { kind: "warn", sample: counts.sample, empty: counts.empty };
  }
  if (!accepted.has("contrast") && review.warning.length > 0) {
    return { kind: "lowContrast", findings: review.warning };
  }
  return { kind: "ready" };
}
