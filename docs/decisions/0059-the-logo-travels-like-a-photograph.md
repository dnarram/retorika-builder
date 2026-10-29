# 0059 — The logo travels like a photograph, rasterised, and the header shows it

**Status:** proposed · **Date:** 2026-10-29 · **Decided by:** David, 28 de octubre de 2026, al
planificar el sprint 30 — his decision 3, *«marca con nombre y logo»*, with its two conditions: *(a)
este sprint el logo entra solo rasterizado (PNG/JPEG/WebP); un SVG subido es un vector de XSS sin
sanear y queda para la ADR siguiente con su sanitizador; (b) alto máximo en cabecera, `alt` con el
nombre del negocio, enlaza a Inicio»* — and, at approval, his adjustments 4 (*«el logo sobre fondo
oscuro»*: the luminance warning), 5 (*«el `alt` del logo se deriva, no se guarda»*) and 6 (*«la
etiqueta del botón por sector»*). · **Recorded by development at his instruction, with the standing
note that development does not sign.** · **Amends:** [ADR 0018](0018-own-cover-photo-before-phase-2.md)
(what a re-encode is for, read for a second format) · **Relates to:**
[ADR 0057](0057-the-header-is-the-owners.md) (the brand it fills), [ADR 0037](0037-the-photos-travel-with-the-account.md)
(the path it travels), [ADR 0056](0056-an-own-font-travels-like-a-photograph.md) (the minting rule),
[ADR 0054](0054-a-published-site-carries-its-own-icon.md) (noted), [ADR 0010](0010-sectors-and-palettes.md)
(the palette the logo still chooses) · **Touches:** `packages/schema`, `packages/renderer`,
`packages/publisher`, `packages/generator`, `packages/db` (migration `0005`), `apps/editor`,
`scripts/size-budget.ts`. **One golden moves — `cabecera-con-marca`, by the one `<img>` line.**

## Context

Question 1 has asked for a logo since the first sprint — «Sube tu logo, si lo tienes» — and has done
exactly one thing with it: decode it to 64×64, read which palette its colour chooses (sprint 6,
`logoPalette.ts`), and **discard it**. `autosave.ts` drops the `File`; the generator consumes a
palette id; ADR 0054 wrote, choosing a letter for the favicon, «a client's site has no logo the
renderer can draw yet». An owner who brought their mark saw its colours on the site and the mark
nowhere.

ADR 0057 gave the header a brand — `brand: { name?, logo?: { src } }` — and left how the logo gets
there to this ADR, in the same sentence it refused to store the `alt`. The schema already refuses
anything but a raster file name in `logo.src`. What was missing is the pipe: from the picker to the
document, to the canvas, to the ZIP, to the account, and back on another computer.

**There is already a pipe.** A photograph takes it: sniffed by its bytes, re-encoded through a
canvas, named by the document, kept in IndexedDB under the card's scope, swapped for an object URL in
the preview, sent as a `photo` part the download route re-sniffs, stored in the `fotos` bucket under
`<owner>/<site>/<src>`, reconciled after every accepted save, fetched back when the site opens
elsewhere (ADR 0018, ADR 0037). ADR 0056 put the owner's font through the same pipe last sprint. The
logo is the third thing to travel this way, and the one that differs least from a photograph.

## Decision

### 1. The logo is a `src` the header carries — the first outside `sections[].content`

`header.brand.logo.src` is the name of the file the bytes are kept under, as a photograph's `src` is
— and it is the **first image a document names outside a section's content**. Rule 5 is untouched: the
logo is no element and lives in no section, and ADR 0057 §1 already read the header as a set of
references rather than content. What this changes is every place that walks a document for its
images.

**Twelve readers walked `pages → sections → flattenElements` on their own**, and twelve copies of
one walk were already one defect each time a photograph moved into a list item (sprint 5 found
three in a day). A logo that twelve walks each had to learn would have been twelve chances to forget
— and the walk that forgets in `listOwnPhotoSrcs` makes the account's reconciliation **delete the
logo from the bucket on the save after the one that uploaded it**, because `photoSyncPlan` removes
what the document does not name. So the walk is written once, `imageSourcesOf` in
`packages/schema/src/images.ts`, the logo first and the elements after it in reading order, with
`rewriteImageSources` beside it for the two places that rewrite a `src` (the publisher's bundle and
the preview's object URLs). Thirteen callers: the renderer's `collectAssets`, the publisher's
`buildSite`, the download route's `referencedPhotoSrcs`, the editor's `referencedPhotos`,
`withPhotoUrls`, `listOwnPhotoSrcs` (and through it `photoSources` and the reconciliation),
`listPhotos`, `size-budget.ts`'s two loops, `build-sample-site.ts`, and the publisher's five test
suites. The third use is what makes an abstraction worth having; there are thirteen, and the test
that would go red if the logo left `listOwnPhotoSrcs` is written against that function by name.

### 2. Raster only — and PNG out, whatever came in

**An SVG does not enter** (David's condition 3a): it is a document that can carry a script, a
bundled file is opened with the page's own origin, and no sanitiser exists here. The schema's
`LOGO_SRC_PATTERN` refuses the name; `sniffImage` now **names markup** (`image/svg+xml`, read off
the first bytes after an optional byte-order mark and whitespace, case-insensitively — `<?xml`,
`<svg`, `<!doctype`, `<!--`) so that the refusal can say «Un SVG no vale aún; exporta tu logo en PNG»
to the one person most likely to be holding a vector, instead of «ese archivo no es una foto»; and
the download route re-sniffs, so an SVG renamed `.png` is refused by its bytes whatever the browser
let through. HTML is reported as markup too: the one sentence is the one that helps, and
`isAcceptedImage` is false either way.

**What is kept is a PNG, always** — the plan said «PNG/WebP se guardan tal cual si ≤ 512 px de lado y
≤ 300 KB, si no se reescala a PNG; nunca JPEG», and this departs from its first clause for a reason
the plan itself gave for photographs. `prepareLogo` draws the file onto a canvas of at most 512px a
side and writes `image/png`:

- **Never JPEG** (the plan's own clause): a JPEG has no alpha channel, and a logo with a transparent
  ground flattened to white is a white box on a `primary` or `ink` bar — the one thing a brand mark
  must not be. PNG is lossless and keeps the alpha.
- **Through the canvas rather than byte for byte**, because that is where ADR 0018's property comes
  from: a canvas draws pixels and nothing else, so what comes out carries **no metadata** — no
  author, no software, no coordinates. A PNG or WebP kept as it was would keep its `tEXt`, `eXIf` and
  XMP chunks, and the property «nothing in a stranger's ZIP says where it was made» would have held
  for photographs and not for the logo.
- **One output type** means one extension, one content type for the bucket (`LOGO_CONTENT_TYPE`,
  `image/png`; migration `0005`), and one branch less in every reader.

**What it costs is named rather than glossed**: a canvas's PNG is not an optimised PNG. A small,
palette-indexed file can come out larger than it went in; a 512px logo is bounded by the arithmetic
at about a megabyte of raw pixels and comes out at tens of kilobytes in practice (the fixture's 96px
disc is 429 bytes). It is on the owner's line of the weight budget, like a photograph, never ours
(§7). 512px is the bound because the bar draws the logo at 40px tall: a 3x screen asks for 120, and a
wide wordmark at 512 has room to spare.

### 3. The name is minted, and minted anew on every upload

`logo-<8 hex>.png`, the eight hex digits from `crypto.getRandomValues` — the rule ADR 0056 §3 set for
a font: the only thing of the owner's that enters the file name is nothing. `Logo Final (2).PNG` and
`../evil.png` both publish as `logo-3f9a7c21.png`, and the owner's file name is never read.

**Unlike `photoSrcFor`, the name is not stable per slot.** A photograph replaces the one in its slot
under the same key, and ADR 0037 §7 pays for that with a zero cache. A logo replaced gets a new
name, so that no cache anywhere — the bucket's, a browser's, a CDN the owner puts in front of their
site — can show the old mark under the new document. The old object is unreferenced the moment the
document stops naming it, and the reconciliation removes it on the next accepted save (§6); the old
bytes in IndexedDB are harmless and go with «Volver a empezar».

### 4. Question 1 keeps it, and the generator is handed a name

The generator stays a pure function of its answers — no canvas, no file, no clock — which `INV_5`,
the golden corpus and «mismas respuestas, misma web» rest on. So, exactly as the logo's palette
travels as `logoPaletteId` and never as a colour, **the logo travels as `logoSrc`**: question 1
prepares the PNG the moment the file is chosen, mints the name, and writes the bytes into this
browser's photo store under each of the three cards' scopes (`v0`, `v1`, `v2`) before any card
exists; the generator writes `header.brand.logo.src` from the name; and when the three cards mount,
the store's records put the bytes back into the preview's object-URL map by the path a reloaded
session's photographs already take. Nothing new carries bytes.

**A store that will not take them keeps the palette and drops the name** (a private window, site
data off): no document ever names a logo nobody holds, and the line under the button says the site
will come out without it and where to add it later. A file that cannot be kept — markup, an
unreadable file — is not kept, and says why.

**The generated site is born with a header** (ADR 0057 left this to today): `brand.name: true`, the
logo if there is one, and `action` pointing at the contact section when the answers produced one.
A site saved before today keeps the header it had — none — because migration `0016` sealed and moved
nothing; what changes is what the five answers produce from now on. The e2e lists that counted the
generated site's entries move with it, and the two fixtures that record a generated site do not,
because they were written at 1.15.0 with no header and that is still a valid site.

### 5. The sector's word for an entry (David's adjustment 6)

The catalog names every entry neutrally — «Precios», «Contacto» — because the catalog does not know
sectors. The generator is the one package that knows both the sector and the section, so it writes
the sector's word **as the destination's own label** (`menuLabel`, ADR 0057 §2) where the bank has
one: `packages/generator/src/locales/es.json` holds «Carta» for a restaurant's prices section,
«Reservar» for its contact section, and «Pedir cita» for the contact section of a salon, a beauty
studio and a physiotherapist. A sector without a word gets no word, and a test says so by name.

The button then reads «Reservar» without the renderer inventing a verb (ADR 0057 §5 stands): it reads
the destination's entry, and the entry is the owner's own label, which the owner can edit or empty
like any other. If the owner takes the button away, the entry returns to the strip as «Reservar».
The editor applies the same word when a section is added later from the pill (`withSectorMenuLabel`
in `Variants.tsx`), so a prices section a restaurant adds reads «Carta» as if the site had been born
with it; and `contactSectionFor` — the contact section the pill puts back — carries it too.

### 6. The bucket admits a PNG, and the content type comes from the bytes

Migration `0005` rewrites the `fotos` bucket's `allowed_mime_types` to `{image/jpeg, image/png}`:
one `update` on the row `0003` created, so a project where `0003` was pasted by hand gets the change
and `select allowed_mime_types from storage.buckets where id = 'fotos'` says whether it did.
Narrower than the picker still, for ADR 0037 §4's reason — the bucket refuses anything that is not
what we produce, and we produce two things now. `photoCaps.test.ts` reads both migrations and asserts
the list is exactly `PHOTO_CONTENT_TYPES`; `storage.pg.test.ts` asserts the row against a real
Postgres.

`uploadPhoto` sniffs and types every upload by its bytes (the rule the fonts bucket set with David's
adjustment 7 of sprint 29), and sends nothing the bucket would refuse. The policies are untouched: a
logo is an object in the owner's folder like any photograph, and `storage.foldername(name)[1] =
auth.uid()` is the whole of ownership for it too. **Migration `0005` is applied by David to both
projects**, like `0003` and `0004`; until it is, every photograph still saves and the logo alone is
refused, which the indicator counts as «· 1 foto sin subir» (`docs/runbook.md` §7 B).

### 7. The renderer draws it, and the download review says when it is hard to see

`<img class="rb-logo" src alt height="40">` as the first child of the brand, through `safeUrl` like
every `src` the page writes, with the `alt` **derived at render time** (David's adjustment 5, ADR
0057 §6): the site name when the name is not written beside it, empty when it is. Forty pixels tall,
width from the image, which with `space.sm` of padding keeps the bar at or under 72px on a 320px
phone (measured, `header.browser.test.ts`). The brand links home from every page but the first.

**The logo on a dark bar (David's adjustment 4).** The same 64×64 sample the palette is read from
gives the logo's mean luminance — the WCAG relative luminance of each pixel, weighted by its alpha,
so a transparent ground counts for nothing. It lives in the editor's session beside the photographs'
object URLs, recomputed from the bytes whenever a logo arrives or a site opens, **never stored**.
`reviewLogo` compares it with the bar's colour (the exact one the owner painted, or the scheme's
token) through the contrast formula over two luminances, and under **3:1 — WCAG 1.4.11's minimum for
a graphical object, not the 4.5:1 text is held to** — the «Menú» panel says «Tu logo se ve poco sobre
este fondo» under the swatch that shows the logo on the bar's own colour, and the download review
says it again, in the contrast dialog, as a warning the owner can go past. A warning and never a
block: it is taste, not a dead link, the owner is looking at it, and what is measured is a mean,
which for a mark of several colours lands in the middle and would fail text's bar while reading
perfectly well. A white PNG on the light `surface` bar warns; the same file on `ink` does not; a logo
whose bytes have not been read is not judged.

### 8. Weighed with the photographs, never against our budget

`pnpm size` lists the logo with the photographs and subtracts it before the 20 KB of ours, as it has
done for photographs since 9 October 2026 and for the owner's fonts since ADR 0056 §7: the ceiling
protects the part we author, and a logo is the owner's bytes. What bounds it is `prepareLogo`'s 512px.

## What is preserved

- **ADR 0001.** The logo is a relative `src` under `assets/`, opened from a disk with no server; the
  sprint 6 walk opens the ZIP from `file://` with the logo in it and counts no failed request.
- **ADR 0018's property**, for a second format: nothing in the ZIP says where or by whom a file was
  made, because everything in it came out of a canvas.
- **ADR 0057 §1**: the header holds references, never content. The one file it names is kept where
  a photograph's is, and the document carries a name.
- **The palette the logo chooses** (ADR 0010, sprint 6): read as before, from the same sample, and
  still an answer rather than a colour.
- **Every stored document, byte for byte.** No schema change, no migration of the document: the
  shape was ADR 0057's. One golden moves, by one line, and the diff was read.
- **Deterministic generation.** The generator is handed a name; the same answers produce the same
  document, logo included (tested).

## What is lost, and it is named

- **A vector logo is not accepted**, and a designer's logo is very often one. The refusal names what
  to export instead. The sanitiser is the next ADR's, by David's condition.
- **A canvas's PNG can be bigger than the owner's file**, on the owner's line of the budget. Measured
  on the fixture only; a real brand kit's PNG is the thing to measure on día 7.
- **The luminance is a mean.** A two-colour logo whose colours straddle the bar's reads as fine. The
  threshold is set where WCAG sets it for graphics, and the warning is the product's whole opinion.
- **The old object stays in the bucket until the next accepted save**, as any replaced photograph's
  would; and the old bytes stay in IndexedDB until «Volver a empezar».

## What this does not decide

- **The logo as the favicon and as `og:image`** (noted in ADR 0054): with the logo stored there is
  now something to draw the icon from, and a PNG beside the SVG needs a rasteriser at build time.
- **An SVG logo**, with its sanitiser.
- **The look of the bar** the logo sits on — día 6 — which is when `transparent` and the four
  coloured schemes become choosable, and when this ADR's warning starts firing for a reason other
  than a white logo on a light page.

## Consequences

- `packages/schema`: `images.ts` (`imageSourcesOf`, `rewriteImageSources`), exported; six tests.
- `packages/renderer`: `collectAssets` through the schema's walk; the logo's `src` through `safeUrl`.
  `fixtures/assets/logo.png` (a 96px ring in the fixture's own primary on a transparent ground) and
  `cabecera-con-marca` names it; its golden gains one line.
- `packages/publisher`: `buildSite` registers every source through the walk and rewrites through
  `rewriteImageSources`; the five corpus suites resolve assets through the walk; a test bundles the
  logo and refuses a bundle without its bytes.
- `packages/generator`: `Answers.logoSrc`; `headerFor`; `menuLabels.ts` and `locales/es.json`;
  `contactSectionFor` carries the word; eleven tests.
- `packages/db`: migration `0005`; `storage.pg.test.ts` asserts the new list.
- `apps/editor`: `prepareLogo`, `logoSrcFor`, `mintLogoId`, `photoType` (`photos.ts`);
  `sniffImage` names markup; `meanLuminance` (`logoPalette.ts`) and `logoLuminanceOf`
  (`logoImage.ts`); `Step1Name` keeps the logo; `Variants` picks, removes and types by bytes;
  `Editor` reads the luminance, owns the logo's input and hands the gate the number; the «Menú»
  panel's **Marca** block; «Fotos» lists the logo first; `reviewLogo`, `headerBarBackground`,
  `LOGO_CONTRAST_WARNS_BELOW` (`styleReview.ts`); the gate's `lowContrast.logo` and the dialog's
  row; `listOwnPhotoSrcs`, `listPhotos`, `withPhotoUrls`, `referencedPhotos` and the route through
  the walk; `menuStateFor` leaves the button's destination out of the counts it says aloud;
  `uploadPhoto` sniffs. Twenty-nine new unit tests; e2e: the sprint 6 logo walk counts the logo, the
  sprint 23 and sprint 30 walks learn the button, and the new walk «sprint 30 día 5».
- `scripts/size-budget.ts`, `scripts/build-sample-site.ts`: through the walk.
- `docs/runbook.md` §7 B, `docs/tasks/el-recorrido-de-la-cuenta.md` step 2 («ahora son cinco»).
- The record is `docs/design/REVIEW.md`, sprint 30 día 5.

## Note — sprint 30 día 7: the logo keeps its size

Día 5 left the logo with `height="40"` and no `width`, because the document did not keep its size:
Lighthouse marked it as an unsized image (`unsized-images`, 0.5) on the fixed-header subject, and §7
promised a width «from the image». The sprint 30 plan had written `<img … width height>` for this
day's renderer, so the close finishes it rather than deciding something new.

**`header.brand.logo` may carry `width` and `height`**, the pixels `prepareLogo` drew it at — whole
numbers from 1 to `LOGO_MAX_EDGE` (512, moved into the schema so the editor and the document read one
constant), **both or neither**, refused at parse otherwise. The renderer writes both as attributes;
the stylesheet still draws the logo 40px tall with `width: auto`, and the browser takes the ratio from
the attributes before a byte of the image arrives. A logo kept between día 5 and today has neither and
publishes as it did, `height="40"`, until its owner uploads it again: the size lives in the bytes, and
migration `0017` (1.15.0 → 1.16.0) seals and moves nothing, as `0016` did — `down` takes the two
numbers off and keeps the file. Question 1 hands the generator `keptLogo` — the name and the size in
one value, so there is no size without a file — and «Menú» and «Fotos» write the size with the name.
So **«Every stored document, byte for byte. No schema change»** under «What is preserved» held for día
5 and no longer describes the sprint: the shape gained two optional numbers, and no stored document
changed.

**Measured, and one thing día 5 got wrong.** With the request for the logo held back 1.5 s, the día 5
markup draws the logo 0px wide and moves the name 40px sideways when it lands (a shift of 0.0005);
today's draws it 40px wide from the first frame and nothing moves. Lighthouse's `unsized-images` is
gone from the subject. **But the CLS of 0.023 that día 5 put down to the logo was not the logo's**:
holding the logo back did not move it, and holding the site's letter back moved it exactly to the
letter's arrival. Lighthouse's own root-cause label named the logo — the one media element in the
header — and the record repeated it. The cause was the bar's `line-height: normal`, which ADR 0057's
note of today fixes.

Consequences of the note: `packages/schema` (`headerLogoSchema`, `LOGO_MAX_EDGE`, `HeaderLogo`;
`rewriteImageSources` keeps the size; migration `0017` with its round trip; snapshot), `packages/renderer`
(`brandNode`), `packages/generator` (`Answers.keptLogo` for `logoSrc`), `apps/editor` (`prepareLogo`'s
edge from the schema and never a side of 0; `Step1Name`, `Variants`), the `cabecera-con-marca` fixture
at 1.16.0 with its 96×96, and the walk «sprint 30 día 5», which now reads both sides off the PNG in the
ZIP for each of the two writers. Day by day in `docs/design/REVIEW.md`, sprint 30 día 7.
