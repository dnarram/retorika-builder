# 0037 — The photos travel with the account

**Status:** **accepted** · **Date:** 2026-10-09 · **Accepted:** 2026-10-10 ·
**Proposed by:** development, sprint 16 day 2, under the instruction ADR 0034 §5 left behind ·
**Accepted by:** **David, 10 October 2026** — «Firma los ADR 0036 y 0037 por mi», opening sprint 17
day 3. **Recorded by development at his instruction, which is said out loud because the standing
rule is that development does not sign.** The decision is his; the keystrokes are not, and anybody
reading this later should be able to tell the difference without asking. ·
**Amends:** [ADR 0034](0034-the-account-arrives-at-the-end.md) §5 and §10 ·
**Built:** sprint 16 days 2 to 7, before the signature.

## Context

ADR 0034 §5 recorded David's answer and its consequence in one breath:

> **The documents travel; the photos stay** — David's answer, with photos scheduled for sprint 16.
> That has a consequence that must be **shown and not discovered**: if the document travels and the
> photos do not, **a site opened on another computer appears without its photos.** So the interface
> says what is where (§10).

Three sentences in `apps/editor/src/locales/es.json` say it today, and one of them says it with a
date attached: «Las fotos se quedan en este navegador… **eso llega en el próximo sprint**». This is
that sprint. The sentences become false in the other direction the moment the capability ships, so
they move in the same pull request as the code — the project's standing rule that no control or
indicator claims more than is true.

**What exists to build on, and it is more than it looks.** A bank photograph has travelled from the
server to the preview to the ZIP since sprint 6: `Variants.tsx` fetches its bytes from
`/api/muestras/<id>`, writes them into IndexedDB, holds an object URL in `photoUrls`, and
`Editor.tsx` puts that blob into the multipart form `/api/download` reads. The module that lists
them says what that makes a bank photograph: «an upload the app made on the owner's behalf». **An
account photograph is the same shape with a different source**, and nothing downstream needs a
third case.

## Decision

### 1. Supabase Storage, one private bucket, not `bytea` in Postgres

Protocol §3.3 «Stack propuesto» already names the platform as «Supabase (Postgres + Auth +
**Storage**)», so this is not a platform choice; it is a choice of where inside it the bytes go.

Read on supabase.com/pricing on **9 October 2026**, the free plan gives **500 MB of database per
project** and **1 GB of file storage**, with **5 GB of egress** and a **50 MB** maximum file size.
Three things follow:

- **A photograph in the database competes with the documents for the smaller of the two limits.** A
  document is kilobytes; a re-encoded photograph is a few hundred. Putting them in the same 500 MB
  means the thing that fills it is photographs, and what stops working when it is full is saving a
  site. What exactly Supabase does to a project that reaches its database limit is **not stated on
  the pricing page**, and not knowing is itself a reason not to find out with clients' documents
  inside.
- **The transfer shape is already the bank's.** `upload(path, Blob)` and `download(path) → Blob` are
  the two calls the existing path is built out of. PostgREST sends `bytea` as hexadecimal text,
  which doubles the bytes on the wire and would have the editor decoding strings into images.
- **The bucket carries its own caps.** `file_size_limit` and `allowed_mime_types` are columns on the
  bucket row, so the size and type limits exist in the database rather than only in TypeScript.

What this costs, paid in the open rather than discovered: **the deletion sweep can no longer be only
SQL** (files are not rows, so `delete from` leaves them orphaned — day 5), and **a `pg_dump` does
not contain the bucket**, so protocol Part 16's backup question grows a second half (day 7).

### 2. The object's name is `<owner>/<site>/<src>`

- The first segment is the owner, so every policy is one line and reads the same as the ones on
  `public.sites`: `(storage.foldername(name))[1] = auth.uid()::text`.
- The second is the site, so a site's photographs are a listable prefix — which is what
  reconciliation, «delete this web» and the account purge each need.
- The third is the document's own `src` (`foto-<section>-<element>.jpg`), unchanged. **So the
  document does not change**: no new field, no migration, no round-trip test, and `src` is both the
  name in the ZIP and the key in the bucket. `photoSrcFor` is already stable per slot, so replacing
  a photograph overwrites one object instead of accumulating two.
- **Bank photographs are never uploaded.** They are our bytes, immutable, already served by
  `/api/muestras/[id]` with a year's caching, and identical for every owner. The document already
  tells the two apart: `sample` absent means the owner's own, `sample` naming a bank id means ours.

### 3. The browser uploads with the person's own session, never the service key

No route of ours is involved in an upload, so there is nothing new to sniff server-side: the
guarantee that no non-image reaches a ZIP stays where it already is, in `/api/download`'s own
re-sniff. **The editor sniffs on the way down instead** — bytes fetched from the bucket are checked
with `sniffImage` before an object URL is made of them — so something that is not an image, in
one's own folder, renders nowhere. `scripts/secrets-scope.ts` keeps this honest by construction:
the account modules import `auth/clients.ts`, which holds the anon key and nothing else.

### 4. The bucket accepts only what the editor actually produces

`preparePhoto` re-encodes every upload through a canvas to **JPEG at 0.82**, whatever went in. So
the bucket's `allowed_mime_types` is `{image/jpeg}` and not the three formats the *picker* accepts:
the picker's job is to recognise what a person chose, and the bucket's is to refuse anything that is
not what we make. A test ties the two together, so changing the output format fails loudly here
rather than silently at a person's upload.

**The re-encode is also what keeps a photograph from carrying where it was taken.** A canvas draws
pixels and nothing else: no EXIF, no timestamp, no GPS. That was ADR 0018's decision and it is now
load-bearing for a second reason — those bytes leave the owner's machine and are stored. **Verified
rather than assumed**, at David's instruction: the object URL in `photoUrls` is made from
`preparePhoto`'s output and never from the `File`, the upload reads that object URL, and
`uploadPhoto` sends the bytes it is given without touching them. A walk uploads a JPEG carrying GPS
coordinates and asserts the bytes that come out the other end carry none.

### 5. Replacement, orphans and the version check

Replacing a photograph writes the same key with `upsert`, so there is no orphan. Orphans come from
deleting a section, which ADR 0003 makes permanent. **Reconciliation runs after a save, never
before**, and only after a save that passed the version check of ADR 0034 §8 — David's instruction,
and the reason is a tab left open: a document that lost the race names photographs the current
document may have replaced, and letting it tidy up would delete the photographs of the version that
won. That is day 4's work; this ADR fixes the rule it is built on.

### 6. Honesty, and what the interface says now

> **Amended on 9 October 2026, sprint 16 day 4, by the work this section describes.** The first
> bullet below said a refused upload moves the indicator to `No guardado`. Building it showed that
> to be false in the other direction: the document *is* in the account and its version was
> accepted, so «No guardado» would tell somebody their words were lost when only a photograph did
> not make it. **What ships is a third sentence** — «Guardado en tu cuenta · N fotos sin subir» —
> which is true about both halves and is the one the owner can act on. ADR 0018's rule is
> untouched: no tick claims more than it earned, and the count is what stops it doing so.

- A refused upload moves the save indicator to `No guardado` and says so. Never a tick it has not
  earned.
- A photograph the browser cannot fetch back enters the `photosFailed` gate that already exists,
  with its retry — the same treatment a bank photograph gets, because by then they are the same
  kind of thing.
- **Sites saved before this shipped genuinely have no photographs on the server.** They say so, per
  site, rather than appearing mysteriously incomplete.
- **The privacy notice shown when an account is created says the photographs are stored too**
  (David's instruction). It named the email address and nothing else, which stopped being the whole
  truth the moment a photograph left the browser.

### 7. Caching is deliberately short

A stored photograph is mutable: the owner replaces the picture and the key stays the same, because
`photoSrcFor` is stable per slot. A long `cacheControl` would show them the old photograph after
they replaced it, which is the interface lying about their own work. So the objects are stored with
caching off and **the egress cost of that is measured and written down on day 7** rather than traded
away now. Correctness first, in a product with no clients yet; the number is what would reopen it.

> **Measured on 9 October 2026, sprint 16 day 7, which is the day this section promised.** Three
> sources uploaded through the real editor in Chromium, and the bytes read back out of the object
> URL the preview is showing:
>
> | Source | In | Out | Final size |
> |---|---|---|---|
> | 1024 × 1088 PNG | 2.0 MB | **193.5 KB** | 1024 × 1088 |
> | 3024 × 4032 JPEG, a phone photo | 2.4 MB | **269.3 KB** | 1200 × 1600 |
> | 3024 × 4032 PNG, the same picture | 13.1 MB | **271.0 KB** | 1200 × 1600 |
>
> **The input format barely matters and the re-encode decides everything**: 2.4 MB of JPEG and
> 13.1 MB of PNG both come out at about 270 KB, because both are redrawn through a canvas at a
> 1600 px long edge and quality 0.82. A photograph never approaches `MAX_PHOTO_BYTES`: the margin is
> 7.5×.
>
> **So the free plan's numbers, against 270 KB a photograph:** 1 GB of storage is about **3,800
> photographs**, and 5 GB of monthly egress is about **19,400 downloads** — which, at one photograph
> per site, is 19,400 openings of an account site a month. A site at the 45-photograph ceiling
> weighs about 12 MB and 5 GB would be about 430 openings of it.
>
> **Nothing here reopens the caching decision.** The product has no clients, 19,400 openings a month
> is not a constraint it is anywhere near, and correctness was the thing being bought. What would
> reopen it is a site with a gallery being opened daily by somebody — which is a measurement to take
> when it exists rather than a cache to add now.

## Alternatives, and why not

**`bytea` in `public.sites` or a photos table.** §1 above: the same 500 MB as the documents, hex on
the wire, and no bucket-level caps. It wins on exactly one thing — the purge stays pure SQL — and
that is day 5's work either way.

**A route of ours in front of the bucket**, uploading with the service key. It would put a secret in
reach of a request path for no gain: the policies already express «your own folder» and the browser
already holds a session that satisfies them. Part 15's rule is that the service key is never used
from the browser, and the shortest way to keep it is for the browser to need nothing but its own
session.

**One object per document version.** It would make caching safe and history free, and it multiplies
the stored bytes by the number of edits, against a 1 GB limit, for a product whose undo is in the
browser.

## Consequences

- `packages/db/migrations/0003-*.sql` creates the bucket and four policies on `storage.objects`.
  **It is applied by David to development and production**, like `0001` and `0002`; the
  account-journey document grows a line.
- `packages/db/test/bootstrap.ts` reproduces Supabase's `storage` schema — `buckets`, `objects` and
  `storage.foldername(text)` — the way it already reproduces `auth.users` and `auth.uid()`, so the
  storage policies run in the tests character for character as they ship.
- `MAX_PHOTO_BYTES` moves from `/api/download`'s route into `downloadGate.ts` beside `MAX_PHOTOS`,
  and a test reads the SQL and asserts the bucket's `file_size_limit` is that same number. Two
  numbers that must be one number, the way `MAX_PHOTOS` already is.
- Nothing about the browser-only journey changes. An owner with no account keeps their photographs
  in IndexedDB and downloads the same ZIP.
- The document schema does not change, so `pnpm schema:guard` stays quiet and there is no migration
  to write.

## What this does not decide

- **Photographs shared between sites**, or the same photograph reused in two webs. Each site's
  prefix holds its own copy, which is what keeps «delete this web» and the purge simple.
- **A gallery of eight photographs from the bank.** A generated site carries exactly one photograph;
  when a section carries several, the upload loop is already a loop.
- **Backups of the bucket.** Named as a consequence above and sent to `docs/tasks/copias.md`, which
  is waiting on David with three priced options and nothing executed.
- **The collaborator role**, which ADR 0034 deferred and which would make «your own folder» the
  wrong rule. The policies here are deliberately the narrow version; widening them is a decision
  with a screen behind it.
