import { GALLERY_PHOTOS } from "@retorika/catalog";
import { ownFontsFor } from "@retorika/renderer";
import {
  MAX_PAGES,
  type OverlappingTexts,
  overlappingTexts,
  type RetorikaDocument,
} from "@retorika/schema";
import { HEAVY_FONT_BYTES } from "./fontBytes.ts";
import type { OverflowFinding } from "./overflowCheck.ts";
import { ownFontFiles } from "./ownFonts.ts";
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
 * How large one photograph may be, in the one place both sides of it can read.
 *
 * It lived in `/api/download`'s route since sprint 6, where it was the only thing that enforced it.
 * ADR 0037 gives the bucket a `file_size_limit`, and a client that could store what the download
 * would then refuse to bundle is exactly the invalid state `MAX_PHOTOS` moved here to stop — a
 * person uploads a photograph, the save says it worked, and the download says no.
 *
 * So it is one number in one file, read by the route, and `apps/editor/test/photoCaps.test.ts`
 * reads migration `0003`'s SQL and asserts the bucket agrees. 2 MiB is headroom, not a target: the
 * browser has already resized and re-encoded to a 1600px JPEG at 0.82 (ADR 0018), which lands in
 * the low hundreds of kilobytes.
 */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

/**
 * The content type every stored photograph has, because `preparePhoto` re-encodes to it whatever
 * the picker accepted. The bucket's `allowed_mime_types` is this and nothing else, and the same
 * test ties them together — so changing the output format fails loudly there rather than silently
 * at somebody's upload.
 *
 * Named here rather than imported from `photos.ts` so that nothing which only needs the *number*
 * has to load a module built around `document.createElement`.
 */
export const PHOTO_CONTENT_TYPE = "image/jpeg";

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
 * 5. **`"overflows"`** — something runs past the right edge at 320 pixels, which is the narrowest
 *    phone the dossier names. **A warning and not a block, and that is a decision rather than a
 *    default.** The dossier's own word for both halves of this review is «avisa», and the contrast
 *    half blocks below 3:1 only because ADR 0026 escalated it deliberately. Overflow is different
 *    in the way that matters: the owner can *see* it — the canvas has a mobile preview — and the
 *    commonest cause is a long word they typed, which is theirs to decide about. A colour at 2:1
 *    is invisible to the person who chose it, which is why that one blocks. **Last of the three
 *    warnings**, because it is the least likely to be a surprise.
 * 6. **`"textOverText"`** — two texts of a hand-designed section sitting on top of each other
 *    (ADR 0050 §6, sprint 25 día 5). **A warning and never a block, which is David's own condition
 *    for allowing overlaps at all**: «Texto sobre texto avisa […] no un bloqueo». **Last of the
 *    warnings**, because it is the only one the owner made with a gesture of their own hand — they
 *    dragged one text onto another and the canvas showed it happening — so it is the least likely
 *    of the four to be news. A photograph under a heading says nothing here: that is design, and
 *    the renderer even draws a panel behind the words to keep them legible.
 * 7. **`"heavyFonts"`** — a face of the owner's own font above 300 KB (sprint 29 día 5). A slower
 *    page and not a broken one, so a warning; **last**, because the import dialog said it already
 *    when the file came in. Its block twin, `"fontsMissing"`, is checked with `"photosFailed"`.
 * 8. **`"ready"`** — nothing to say; `download()` runs immediately.
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
export type AcceptedWarning = "photos" | "contrast" | "overflow" | "layout" | "fonts";
export type DownloadGate =
  | { kind: "ready" }
  /**
   * A bank photograph the browser could not fetch, so the document references bytes nobody has.
   *
   * **A block, and first, because the download cannot succeed — not merely should not.**
   * `/api/download` refuses with «the document references "…", which was not sent», and the editor
   * used to answer that with «Vuelve a intentarlo», which produced the identical 400 every time: a
   * site that could never be downloaded again, with a message telling the owner to keep doing the
   * one thing that could not work. Found by the sprint-14 sweep — `Variants.tsx` swallowed the
   * failure in two places — and fixed here, where the decision belongs.
   */
  | { kind: "photosFailed"; srcs: string[] }
  /**
   * A font the owner brought that the site's stylesheet names, and whose bytes this browser no
   * longer has (sprint 29 día 5) — a private window reloaded, a store that would not take them.
   * **A block, second, for `photosFailed`'s reason**: `/api/download` refuses a document that names
   * a face it was not sent, so «Descargar igualmente» could only ever fail. The dialog says how out:
   * remove the font and upload it again, or choose another letter.
   */
  | { kind: "fontsMissing"; families: string[] }
  | { kind: "tooManyPhotos"; count: number; max: number }
  | { kind: "unreadable"; findings: ContrastFinding[] }
  | { kind: "warn"; sample: number; empty: number }
  | { kind: "lowContrast"; findings: ContrastFinding[] }
  | { kind: "overflows"; findings: OverflowFinding[] }
  | { kind: "textOverText"; findings: OverlappingTexts[] }
  /**
   * A face of the owner's own font above 300 KB (David's condition 2): a slower page, not a broken
   * one, so a warning and the last of them — the import dialog already said so when the file came
   * in, and this says it again only because the ZIP is the moment it starts costing visitors.
   */
  | { kind: "heavyFonts"; files: { family: string; kb: number; woff2: boolean }[] };

/** Size, by file name, of the owner's own font files the browser holds — what the gate weighs. */
export type FontFileSizes = ReadonlyMap<string, { size: number }>;

/**
 * **This stays pure and synchronous, and the measurement arrives as data.**
 *
 * Measuring a page at 320 pixels needs a browser and a frame to load, so the obvious move was to
 * make this `async`. It is the wrong one: the gate is the piece that decides what happens to a
 * download, it is exercised to the corner in `downloadGate.test.ts` with no browser anywhere, and
 * an `await` in here would drag a layout engine into every one of those tests. The measurement
 * happens before the call — `measureOverflow` in `overflowCheck.ts` — and comes in like the photo
 * counts do.
 *
 * `[]` means «measured, and nothing overflows». There is deliberately no third state for «not
 * measured»: a caller that cannot measure should not be calling a gate that is about to tell
 * somebody their site fits on a phone.
 */
export function downloadGateFor(
  counts: PhotoCounts,
  doc: RetorikaDocument,
  accepted: ReadonlySet<AcceptedWarning> = new Set(),
  overflow: readonly OverflowFinding[] = [],
  /**
   * Bank photographs whose fetch failed, by the `src` the document carries.
   *
   * Not derivable from the document — it is what happened at runtime — so it arrives as data, the
   * same way the overflow measurement does. Empty is «none failed», and there is deliberately no
   * state for «not asked»: a caller that has not tried to load the photographs has no business
   * opening a gate that is about to start a download.
   */
  failedSamples: readonly string[] = [],
  /** The owner's own font files this browser holds, by name — runtime state like the two above. */
  fontFiles: FontFileSizes = new Map(),
): DownloadGate {
  // First, and before even the photo count: this one makes the request impossible rather than
  // unwise, and no amount of «Descargar igualmente» can get past it.
  if (failedSamples.length > 0) return { kind: "photosFailed", srcs: [...failedSamples] };

  // The same kind of impossibility for a font: only the ones the stylesheet names travel, so only
  // those can be missing — every face, and the licence the record says was attached.
  const fonts = ownFontsFor(doc);
  const missing = fonts.filter((font) => {
    const { faces, licence } = ownFontFiles(font);
    return [...faces, ...(licence === undefined ? [] : [licence])].some(
      (file) => !fontFiles.has(file),
    );
  });
  if (missing.length > 0) {
    return { kind: "fontsMissing", families: missing.map((font) => font.family) };
  }

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
  if (!accepted.has("overflow") && overflow.length > 0) {
    return { kind: "overflows", findings: [...overflow] };
  }
  if (!accepted.has("layout")) {
    // Asked of the document, like the contrast review and unlike the overflow measurement: two
    // placements on top of each other is a fact the document holds, with no browser needed.
    const stacked = overlappingTexts(doc);
    if (stacked.length > 0) return { kind: "textOverText", findings: stacked };
  }
  if (!accepted.has("fonts")) {
    const heavy = fonts.flatMap((font) =>
      ownFontFiles(font).faces.flatMap((file) => {
        const size = fontFiles.get(file)?.size ?? 0;
        if (size <= HEAVY_FONT_BYTES) return [];
        return [
          { family: font.family, kb: Math.round(size / 1024), woff2: file.endsWith(".woff2") },
        ];
      }),
    );
    if (heavy.length > 0) return { kind: "heavyFonts", files: heavy };
  }
  return { kind: "ready" };
}

/**
 * Every gate kind that is not `"ready"` must have a dialog, and this makes forgetting one a type
 * error rather than a silent nothing.
 *
 * `Editor.tsx` renders the dialogs as a chain of `kind === "…"` checks with no exhaustiveness, so
 * adding a case to the union above and nothing else produced a «Descargar» button that opened
 * nothing at all — which is precisely the dead-control failure sprint 13 spent a week removing.
 * Found while adding `photosFailed`: `tsc` was perfectly happy.
 *
 * So the kinds with a dialog are listed, and the line below fails to compile if the union ever
 * grows past the list. Keep them in the order the gate returns them.
 */
export const DIALOG_KINDS = [
  "photosFailed",
  "fontsMissing",
  "tooManyPhotos",
  "unreadable",
  "warn",
  "lowContrast",
  "overflows",
  "textOverText",
  "heavyFonts",
] as const;

type KindWithDialog = (typeof DIALOG_KINDS)[number];
type Uncovered = Exclude<Exclude<DownloadGate["kind"], "ready">, KindWithDialog>;

/** If this line is red, a gate kind has no dialog. Add it to `DIALOG_KINDS` *and* to `Editor.tsx`. */
export const EVERY_KIND_HAS_A_DIALOG: Uncovered extends never ? true : Uncovered = true;
