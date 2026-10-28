# 0056 — An own font travels like a photograph

**Status:** proposed · **Date:** 2026-10-27 · **Decided by: David, 27 October 2026**, planning
sprint 29 — his decision 3, *«fuente propia: uno o dos archivos, cuatro formatos (.woff2 .woff .ttf
.otf tal cual, sin convertir)»*, with its five conditions; his decision 4, *«la fuente propia viaja
con la cuenta en este sprint»*; and, at approval, adjustment 4: *«la variable declara su rango real:
`font-weight: <wghtMin> <wghtMax>` leídos de `fvar`, no `100 <max>`»* · **Recorded by development,
which does not sign** · **Relates to:**
[ADR 0028](0028-typography-needs-a-decision-from-direction.md) (reopened by its own third condition),
[ADR 0032](0032-typography-per-element-with-the-faces-that-travel.md) (§2 amended: what the phrase
meant then, and what it means now), [ADR 0046](0046-the-gallery-ships-the-faces-so-the-letter-can-be-named.md)
(§2 amended: a document still never names a file), [ADR 0026](0026-the-switch-is-the-line-between-references-and-exact-values.md)
(read: not behind the switch), [ADR 0037](0037-the-photos-travel-with-the-account.md) (the shape this
copies), [ADR 0011](0011-sample-photos-per-sector.md) (a licence read and dated),
[ADR 0001](0001-static-published-sites.md) · **Touches:** `packages/schema` (1.14.0, migration
`0015`), `packages/renderer`, `packages/tokens`, `packages/publisher`, `scripts/size-budget.ts`; on
días 5 and 6, `apps/editor` and `packages/db`. **One golden moves, and it is the new one.**

## Context

The gallery is forty families (ADR 0055). It is still a list somebody else wrote, and David's
planning note says why that is not enough: *«la fuente es uno de los elementos visuales más
importantes del branding corporativo»* (ADR 0046). A business with a brand kit has a font file — a
`.ttf` from its designer, a `.woff2` bought with a licence, sometimes a variable file with every
weight in it — and no table of ours will contain it.

Three decisions already wrote around this exact thing, and each of them is right about what it was
looking at:

- **ADR 0028**, choosing to ship the faces, listed as its third reopening condition *«someone asking
  for a face we cannot ship — the moment «tipografías propias» becomes a real request rather than a
  line in a dossier»*. This is that moment.
- **ADR 0032 §2** made «tipografías propias» **unexpressible**: `fontFamily` has no exact arm, in the
  type as well as at runtime. Its reason, word for word: *«a name the owner types, a face that does
  not travel, and a letter the visitor may never see»*. All three clauses are about a **name**.
- **ADR 0026**, reading the advanced dossier §4, put «tipografías propias» in the style panel's
  **On** column — behind the design-tools switch — alongside «el sistema».

What none of them considered is a face that **travels**. The phrase has two readings, and the one
every refusal was about is a family name typed into a field. The other reading — a file the owner
uploaded, inspected, declared and shipped in the ZIP beside the page — is **a photograph**: bytes
the owner brought, that the document records and the bundle carries. ADR 0037 built exactly that
for photographs, and this ADR copies its shape rather than inventing one.

## Decision

### 1. An own font is a row the owner added, not a value the owner typed

**ADR 0028 is reopened by its own condition, and widens by one row-shape.** The gallery's property —
*a document chooses a row and never names a file* — is kept. What is new is where a row may come
from: the table, or the owner's own record in the document. Both are selected the same way, by exact
equality of a stack's first family; both ship their faces; both fall back to the species' generic
keyword when the face does not arrive.

**ADR 0032 §2 is amended in its reading, not in its rule.** `fontFamily` still has no exact arm and
an owner still cannot type a family: a stack whose first family is in no table and in no record
ships nothing, exactly as before. What the amendment says is that §2's three clauses do not describe
an own font — its name is read from the file's own `name` table, its face travels, and the visitor
sees it — so refusing it on §2's grounds would be refusing a thing §2 never looked at.

**It does not go behind the switch** (ADR 0026, read rather than amended). The switch is the line
between a reference and an exact value. A font that travels is neither: it is a row, chosen by
reference like any other, and the gallery already offers every row to everybody for that reason —
`StylePanel.tsx` says so in its own comment. A brand's letter is the one thing a small business
owner most wants to match and least needs a professional for. The dossier §4's On column read
«tipografías propias» as typing a name; this is not that.

### 2. The record

`fonts?: OwnFont[]`, at most two, on the document (schema 1.14.0, `packages/schema/src/fonts.ts`):

| | |
|---|---|
| `id` | Eight lower-case hex digits, minted in the editor with `crypto.getRandomValues`. The file names are built from it and from nothing else the owner controls |
| `family` | The name that travels: read from the file's `name` table by the editor's server, sanitised to `FONT_FAMILY_PATTERN`, **shown to the owner** as the name their site will use. Distinct from every gallery row and every other own font, **case-insensitively** — a browser matches `font-family` without regard to case, so `inter` and `Inter` would both match one `@font-face`. Not a CSS keyword. A collision is resolved with a numeral and shown (día 5): the corpus fixture's font is «Karla 2» for exactly that reason |
| `kind` | Its species, for the chooser's chips and for the generic keyword its stack ends in |
| `faces` | `[regular]`, `[regular, bold]` or `[variable]`, **in that order and no other shape**: a bold without a regular is refused (ADR 0046 §4's reason — the family must mean the same thing in a headline and in the line under it), as is a variable beside a static. Each face carries the `format` the server **sniffed** — `woff2`, `woff`, `ttf` or `otf` — never the extension the owner's file had. A variable face carries `wght: [min, max]`, read from `fvar`, `1 ≤ min ≤ max ≤ 1000` |
| `licence` | `{ declared: true, at }` — a **literal** `true`, so a record with `declared: false` is not a font with a problem but a shape the schema refuses to hold. `at` is when the owner said so |
| `licenceFile` | `"txt"` or `"pdf"`, present when the owner attached the licence text; it travels beside the font |

**What the record is not:** bytes. The faces live in the browser (IndexedDB `retorika.fonts`, día 5)
and with the account (the `fuentes` bucket, día 6), as a photograph's do; the document says which
faces exist and what each one is. A font no stack names first is allowed in the record and ships
nothing — a row nobody chose.

**What a variable face covers is derived and never stored.** `ownFontCovers` reads the range:
«Normal» if it includes 400, «Negrita» if it includes 700. A file whose axis starts at 500 has no
«Normal», and the editor says so (día 5: «Esta fuente variable no tiene grosor normal: empieza en
500») rather than letting the browser pick the nearest weight in silence.

### 3. The file is minted from the id and the role, never from a name (amends ADR 0046 §2)

The renderer names each own face `fonts/propia-<id>-<role>.<format>` — `propia-3f9a7c21-regular.woff2`
— from the record's `id`, the face's `role` and the sniffed `format`. The only three things in the
name are eight hex digits the editor minted, one of three words, and one of four extensions. The
owner's file name is never read; the family they were shown is never written into a path. A font
whose family is `../evil` — which the schema refuses, but a renderer test builds by hand — publishes
`propia-3f9a7c21-regular.ttf` and then fails `cssFontFamilyName`, the second lock, before a rule is
emitted.

**ADR 0046 §2's sentence is therefore kept as written**: a document still never names a file. What
§2 could not foresee is a row that is not in the table, and the amendment below says so.

`cssFontSrc`, the one `url()` this renderer can produce, widens its closed set from `.woff2` to
`.woff2 | .woff | .ttf | .otf` — lower case, one dot, no other character admitted — and writes the
`format()` hint from the extension (`truetype`, `opentype`). Its rejection list gains `evil.woff2.ttf`,
`evil.svg`, `evil.ttc`, `evil.eot` and `evil.TTF`. Everything else about the exception — the directory
written inside the function, the characters refused — is as ADR 0028 built it.

### 4. The rules sit after the table's, by id

`fontFaceCss` emits the gallery's rules first, in the table's order, and then the owner's, **by id**,
never by the document's array. A shipped family and an own font cannot share a name, so the order
decides no match; it is stated so that the published bytes are a function of the document's content
and not of a drag that reordered the owner's list (`INV_5`). Each static face is one rule at 400 or
700; a regular alone is one rule, and the browser synthesises the bold — which día 5 warns about
(«Sin un archivo de negrita, los titulares se engrosarán de forma artificial»). `font-display: swap`
and `font-style: normal`, as for the table.

### 5. The variable face declares its real range (David's adjustment 4)

`font-weight: 300 800` — the two numbers from `fvar`, not `100 800`. A browser matches 400 and 700
inside the range it is told; told a range the file does not have, it would synthesise at the edges
and the page would lie about what the file can do. The schema holds `min ≤ max`; the renderer emits
the pair as it is.

### 6. The publisher's rule changes shape for an own font, and checks it itself

«A face never travels without its licence» (ADR 0028) has an OFL to point at for a table row. An own
font has no OFL to send: the bytes are the owner's and the licence is theirs to hold. So the rule is
reformulated:

- **A face of the table needs its OFL in the map** — unchanged.
- **An own face needs `licence.declared` in its record, checked by `buildSite` itself** as data
  rather than trusted as a type: a hand-assembled document that never met `parseDocument` is refused
  for the same reason a parsed one cannot exist. A `fonts/propia-…` the record does not account for is
  refused too.
- **The licence the owner attached travels** at `fonts/LICENCIA-propia-<id>.<txt|pdf>`, and a bundle
  whose record says it exists and was handed no bytes for it is refused — a bundle that lost a file
  the owner put there.

The media type is read from the sniffed format — `font/woff2`, `font/woff`, `font/ttf`, `font/otf`,
`text/plain`, `application/pdf` — the six the `fuentes` bucket will admit (día 6), never from the
extension. `readFontBundle` has none of these bytes; `ownFontKeysFor` lists the keys a caller must
supply, faces by file and licence by path, the same two shapes the table's faces and their OFLs use.
The manifest lists them with the rest.

**David's condition 4, verbatim, is the editor's half (día 5):** *«casilla obligatoria «Confirmo que
tengo licencia para usar esta fuente en mi web»; la ADR dice que la responsabilidad es del cliente y
la interfaz lo hace explícito, texto validado por el CEO antes de fusionar»*. **The responsibility
for the right to publish the font is the client's.** This product checks a declaration and carries
the text they attach; it reads no licence and judges none. The sentence the checkbox shows goes to
the CEO on día 5, before that pull request merges.

### 7. The owner's bytes are weighed on their own line and never against the ceiling

`pnpm size` reports `fonts/propia-*` and `fonts/LICENCIA-propia-*` on a line of their own and subtracts
them before `MAX_FONT_GZIP_BYTES` — the treatment photographs got on 9 October 2026, for the same
reason: the ceiling protects the part we author. What bounds an own font is the editor (David's
condition 2): **a warning above 300 KB per file**, with the suggestion to convert to woff2, and **a
refusal above 2 MB**; conversion in the browser is out by name (a ~1 MB wasm encoder for a step a
brand kit often does not need), and reopens if `.ttf`/`.otf` above the warning are measured frequent.

### 8. Migration `0015`, 1.13.0 → 1.14.0

`up` stamps and moves nothing: the key is optional and absent on every document written before
today. The affected set is counted: no corpus fixture below 1.14.0 carries `fonts`, and the one that
does was written at 1.14.0. **`down` is lossy and says so**: the key goes, and **the family goes out
of every stack that names it first** — leaving it would publish a stack naming a family nobody sends,
the state ADR 0028 prevents and the one 1.13.0 made unexpressible. What is left is the fallback
chain the stack already carried; a stack that was nothing but the family becomes its species'
generic, from a table frozen inside the migration so that the step produces the same document in two
years whatever the live table says.

**What the schema cannot check, and who keeps it instead.** The plan asked for a refinement — *no
stack names first an own family that is not in `fonts`* — and it is not checkable from a stack:
once a record is gone, `'Casa Trufa', system-ui, …` is indistinguishable from `Georgia, Cambria, …`,
a system family nobody sends and a perfectly legal theme. The renderer does not try to tell them
apart; it ships what the document declares and nothing else, and a renderer test says so. The
property is kept by the verb that removes a font (día 5, «Quitar», which warns when the theme names
it and rewrites the stack) and by `down` above. What the schema does check is what it can see: at most
two, each name unique and not a row's and not a keyword, each shape closed.

### 9. The obligation of the templates

The advanced dossier §9 — third-party templates — is phase 3 and nothing extracts one today. When
something does, **a template leaves without the owner's fonts**: the record is the owner's, the bytes
are the owner's, and the licence they declared covers *their* web. A template that carried a
`fonts` record would carry a declaration somebody else made. `document-rules.md` records the
obligation beside the field, so that the extraction, whenever it is written, finds it there rather
than in a sprint note; there is no code for it because there is no caller.

### 10. The inspection route is public, and bounded (amended on día 5, 27 October 2026)

**Decided by David, 27 October 2026, at the opening of día 5**, after development reported that the
plan's adjustment 2 rested on something that is not so. Recorded here because the import is this
ADR's, and because he asked that the limit and the number be written in it.

**Adjustment 2 is not met to the letter, and this says so.** It read: *«la ruta de inspección no es
pública. Exige la misma sesión que `/api/download`, lee `Content-Length` antes de bufferizar y corta
en 2 MB»*. `/api/download` has **no session**: the questionnaire and the download are anonymous by
ADR 0034 §2, and the route has called itself «a public, unauthenticated endpoint» since sprint 3. A
session there would have meant an account before a brand letter — and the e2e runs Supabase on a dead
port, so no walk could have uploaded a font. The second and third halves of the adjustment are met:
`Content-Length` is read before a byte is buffered (411 without one, 413 above 2 MiB), and the body
is read against the same cap as it streams, because a header is a claim.

**What David chose instead: public, like the download, with three conditions.**

1. **Same origin, with a fallback** (`apps/editor/src/app/api/publicGuard.ts`, `isSameOrigin`).
   `Sec-Fetch-Site` decides alone when the browser sends it — `same-origin` passes; `same-site` does
   not, a sibling subdomain being somebody else's page. Without it (Safari before 16.4), `Origin`
   must equal this application's public origin as `publicOrigin` reads it behind Render's proxy.
   Neither header: 403. It keeps another website from spending a visitor's browser on our
   decompressor; it does not stop `curl`, which writes any header it likes. A test per variant.
2. **Twenty requests a minute per address, shared by `/api/download` and this route** (the only two
   public endpoints that do work proportional to a stranger's bytes): a token bucket in the
   process's memory, a 429 with `Retry-After` past it, checked after the origin and before a byte of
   the body is read. **In memory** because the editor is one service on Render's free plan
   (`render.yaml`, `plan: free`); a second instance would allow twenty each. The address is
   `CF-Connecting-IP`, then `True-Client-IP`, then the first entry of `X-Forwarded-For` — Render
   serves through Cloudflare, which overwrites the first two and whose proxy only *appends* to the
   third. **Read from Cloudflare's documentation and Render's community answers, not measured on
   the deployment**; `docs/runbook.md` §9 says how to check it in a minute. A request with none of
   them shares one bucket, `unknown`. At most ten thousand addresses are held; full buckets go first.
3. **The CPU of the worst file the caps admit, measured.** A WOFF2 of 2,038,078 bytes (under
   `MAX_FONT_BYTES`, 2,097,152) whose single stream expands to 8,388,468 bytes (under
   `totalSfntSize` = `MAX_FONT_EXPANDED_BYTES`, 8,388,608): about 1.98 MB of random literals in
   64 KB blocks between runs of zeros, so brotli cannot shorten most of it. Measured on 28 October
   2026 on this project's development laptop, on mains power, against `next dev` started three
   times, first request after each start and five after it, the inspection's own time read from the
   route's `Server-Timing` header:

   | | cold (first request) | warm |
   |---|---|---|
   | run 1 | 19.0 ms | 15.8–17.5 ms |
   | run 2 | 17.4 ms | 15.7–17.8 ms |
   | run 3 | 19.1 ms | 15.5–16.5 ms |

   **Under the 200 ms David set, so the decompression stays in the request** and no `worker_thread`
   is added. **What the number does not cover, said rather than rounded:** Render's free instance is
   0.1 CPU (its pricing page), so the same work may take roughly ten times as long in wall time
   there — an estimate, not a measurement. The route answers `Server-Timing: inspect;dur=…` on every
   request so that the deployed number is one `curl` away; if it is above 200 ms there, the condition
   says a worker, and a worker on a tenth of a CPU still competes for the same tenth.

### 11. What the download reads of the owner's bytes (día 5)

`/api/download` reads two new kinds of part through **one** reader, `readFonts` — David's adjustment
3 is that a licence file is bytes from outside too:

- a `font` part's name must be exactly a face file the stylesheet names (`ownFontKeysFor`), its size
  at most `MAX_FONT_BYTES`, and its bytes **re-sniffed as the format the record declares** — a WOFF2
  sent under a `.ttf` name is refused, never relabelled, because `format()` was written from the
  record; a collection and markup fall to the same sniff;
- a `fontLicence` part's name must be exactly the licence the record names, its size at most
  `MAX_LICENCE_BYTES` (1 MiB), and its bytes a PDF (`%PDF`) or UTF-8 with no NUL, as the record says;
- every key the document names must arrive, and nothing it does not name may.

**The body cap grows by 10 MiB, not the plan's 4**: two fonts, two faces each at 2 MiB, and a licence
of 1 MiB beside each — 4 × 2 + 2 × 1 = 10 MiB, the exact worst case of caps that are hard. Below it,
a document the editor lets an owner build would meet a bare 413, the failure `MAX_PHOTOS` moved into
`downloadGate.ts` to end.

**The gate says it before the request.** A face the stylesheet names whose bytes this browser no
longer holds — a private window reloaded — **blocks** (`fontsMissing`, second after `photosFailed`,
for its reason: the route would refuse, so «Descargar igualmente» could only fail); a face above
300 KB **warns** (`heavyFonts`, last). One dialog draws both, as the contrast dialog draws its two.

### 12. The account carries the fonts (día 6, 28 October 2026)

David's decision 4, *«la fuente propia viaja con la cuenta en este sprint»*, built as ADR 0037 built
it for the photographs, and differing from it in three places, each on purpose:

1. **A second private bucket, `fuentes`** (`packages/db/migrations/0004-*.sql`), with
   `file_size_limit` 2097152 — `MAX_FONT_BYTES`, asserted against the SQL by
   `apps/editor/test/fontCaps.test.ts` — and `allowed_mime_types` the four face formats and the two
   licence formats, the six types the editor can produce, crossed against `fontFileType` by the
   same test. Four policies, 0003's with the bucket changed, over the same `<owner>/<site>/<file>`
   folders; `packages/db/test/storage.pg.test.ts` runs every case over both buckets.
2. **The content type comes from the bytes** (David's adjustment 7): `uploadFontFile` sniffs, and
   stores only when the sniff agrees with the minted name, so a `File` whose `type` is empty or
   `application/octet-stream` is stored as `font/woff2`, and bytes that are not what their name says
   are not stored at all. `downloadFontFile` sniffs again on the way back.
3. **The files go up after every accepted save, the first one included**, through
   `reconcileSiteFonts` — `photoSyncPlan` reused over file names — rather than through the
   «Guardar en mi cuenta» dialog the way the photographs do on the first save. The insert is an
   accepted save by definition, so ADR 0037 §5's rule holds at that moment too. **And the save
   indicator counts by font, not by file**: «· 1 fuente sin subir» for a regular and a bold that did
   not make it, joined after the photographs' count when both are short.

A site opened from the account fetches the files its document names that this browser does not hold,
before anything else is drawn in them, and keeps them in `retorika.fonts` so a reload does not ask
again. One that does not arrive is left to the download gate's `fontsMissing`, which already blocks
and says what to do.

The sweep (`packages/db/src/deletion.ts`) empties `fotos` and then `fuentes` before the transaction
that ends an account, and skips the account if either refuses; `objects.ts` (once `photos.ts`) takes
the bucket as a parameter. `scripts/purge-accounts.ts` counts both on a dry run.

**Found while building it, and fixed with it:** a site saved *from* a session — the ordinary way,
through «Guardar en mi cuenta» — reached the editor's push with no owner id, and the reconciliation
read the owner from the props only a site opened *from* the account has. So since ADR 0037 day 4, a
photograph added after the first save was never uploaded while the indicator said «Guardado en tu
cuenta». The dialog now hands the owner back and the reconciliation reads the site it is given; the
font day needed exactly that path, because the likeliest moment to bring a brand's letter is after
the web exists.

## What is preserved

- **A document chooses a row and never names a file.** Two places a row may come from; one property.
- **ADR 0001.** The face is a relative `url()` inside `fonts/`, like the gallery's; a double-clicked
  page finds it with no server and no network. The editor's inspection route (día 5) is a route of
  the editor, not of the published site.
- **ADR 0032 §2's rule.** No exact arm, no typed family.
- **Every stored document, byte for byte.** `up` moves nothing; no golden moves but the new one.
- **The three pairs and the forty families**, untouched.

## What is lost, and it is named

- **The owner can publish a face they have no right to.** The product carries their declaration and
  nothing more; it cannot read a licence it was not given, and it would be dishonest to pretend a
  checkbox is a check. The interface makes the responsibility explicit; this ADR says where it lies.
- **A 2 MB `.ttf` is a 2 MB page**, on the owner's line of the budget and nowhere else. The warning at
  300 KB is the product's whole opinion.
- **A regular alone gets a synthesised bold**, said in the editor rather than prevented.
- **Nothing is on screen today.** The engine lands first, as the gallery's did on sprint 24 día 5
  before día 6; a document with a `fonts` record cannot be produced by the editor until día 5, and a
  hand-made one handed to `/api/download` is refused by `buildSite` with «missing the owner's font
  bytes», not quietly published without them.

## What this does not decide

- ~~**The import**~~ — día 5, written in §10 and §11 above: the route and what bounds it, and what the
  download reads. The rest is in the code it names and in `REVIEW.md`.
- ~~**The bucket**~~ — día 6, written in §12 above.
- **Converting to woff2 in the browser**, and **shipping the reserved-name families whole** (sprint 30).
- **The CEO's sentence** for the checkbox — «Confirmo que tengo licencia para usar esta fuente en mi
  web», David's own words, and the line under it, «Tener esa licencia es responsabilidad tuya:
  nosotros no la comprobamos.» Sent with the día 5 pull request, which waits for it.

## Consequences

- `packages/schema`: `fonts.ts` (`ownFontSchema`, `ownFontsSchema`, `ownFamilyIssue`, `ownFontCovers`,
  the formats and the id pattern); `fonts?` on `documentSchema`; `SCHEMA_VERSION` 1.14.0; migration
  `0015` with nine tests; `test/fonts.test.ts`; the snapshot regenerated; the corpus fixture
  `letra-propia.json` with its bytes in `fixtures/fonts/` and its golden.
- `packages/renderer`: `cssFontSrc` over four extensions with the format hint; `ownFaceFile`,
  `ownFontsFor`, `ownFacesFor`, `shippedFontFilesFor`; `fontFaceCss` emits the own rules after the
  table's; `fontFilesFor` lists both. Tests for the minting, the order, the range, the exact match and
  the stack that names nobody.
- `packages/tokens`: `ownFontStack`, `withOwnFont`, `identifyOwnFont`.
- `packages/publisher`: `buildSite` writes own faces with their sniffed media type and the attached
  licence, checks the declaration itself, and refuses a face it was handed no bytes for;
  `readFontBundle` reads the table's faces only; `ownFontKeysFor`, `ownLicencePath`,
  `OWN_FACE_TYPES`, `OWN_LICENCE_TYPES`. The corpus tests resolve an own font's bytes from
  `fixtures/fonts/` through `test/fixtureFonts.ts`, as they resolve photographs from
  `fixtures/assets/`.
- `scripts/size-budget.ts`: the owner's line; `scripts/build-sample-site.ts` reads `fonts/` beside
  the document.
- `docs/document-rules.md`: «A font the owner brought», with the templates' obligation.
- `apps/editor` (día 5): `editor/fontBytes.ts` (the sniff and the caps, browser and server),
  `editor/fontInspect.ts` (server only), `app/api/fuentes/inspeccionar/route.ts`,
  `app/api/publicGuard.ts` (origin and limit, shared with `/api/download`), `editor/ownFonts.ts`
  (IndexedDB `retorika.fonts`), `editor/fontImport.ts`, `questionnaire/ImportFontDialog.tsx`, the
  chooser's own rows, `withFontUrls` for the canvas and the 320 px measurement, and the schema's two
  verbs `addOwnFont` and `removeOwnFont`.
- `packages/db` (día 6): migration `0004` (the `fuentes` bucket and four policies), `objects.ts`
  (was `photos.ts`; the bucket a parameter, `ACCOUNT_BUCKETS`), `deletion.ts` over both buckets;
  `scripts/purge-accounts.ts`; `apps/editor/src/account/fontStorage.ts`; `editor/accountSentence.ts`;
  `docs/runbook.md` §6 and §7. **Migration `0004` is applied by David to development and production**,
  like `0003`.
- The record is `docs/design/REVIEW.md`, sprint 29 días 4 to 6, written at the close.
