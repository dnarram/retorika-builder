# Runbook

What to do when something breaks, written before it happens (protocol Part 17). Part 17 names
four foreseeable cases. **Three of them are here**, and **three more** have been added that Part 17
could not have named because the stack they belong to did not exist when it was written: a paused
or unreachable database, an account deleted that should not have been, and running the sweep that
ends accounts. **Six cases in total** — counted against the headings each time this file grows,
because the first draft of this paragraph said "a fifth" when there were two, and the second said
"five" the day a sixth was added.

Case 6 is the odd one out and says so in its own words: it is not a failure to recover from but an
operation somebody has to perform, and it is here because the code that needs it pointed at this
file for who runs it and this file did not say.

The one still missing is **a payment charged with no site published**, and it has nothing to
describe: [ADR 0021](decisions/0021-charging-waits-for-a-sellable-product.md) defers charging and
[ADR 0034](decisions/0034-the-account-arrives-at-the-end.md) released accounts without touching
that, so there is no payment path to go wrong. It arrives with the code it concerns, like the
other two did.

Each case follows the same shape: the first question to ask, what to check in order, and what
not to touch.

---

## 1. A published site is not being served

> **Does not apply today ([ADR 0008](decisions/0008-hosted-publishing-has-no-plan.md)).** Retorika
> serves no client site and has no plan to: each site lives on its client's own hosting. The case
> is kept as reference.

### First question: one site, or all of them?

Load two sites that should be up: the one reported, and the sample site the external check
watches (Part 17). Then:

- **Only the reported site fails.** The Worker and the storage are fine. The problem is that
  site's own files, which almost always means its last deploy.
- **Every site fails.** No single site's files are to blame. It is the Worker, its route or
  configuration, or R2.

Everything below depends on that answer, so do not skip it.

### If it is one site

Read the status code first, with `curl -sI https://<id>.<domain>/`.

1. **404.** The Worker answers the same 404 for every miss, on purpose, so the code alone does
   not say which one. Check, in order:
   - **The host.** The site id is the single subdomain label: lowercase ASCII letters, digits and
     inner hyphens, at most 63 characters. `Lua.<domain>`, `lu_a.<domain>` or `a.b.<domain>`
     never match any site.
   - **The objects exist.** Look for `sites/<id>/index.html` in the bucket. The key is exactly
     `sites/<id>/<path>`: a bundle uploaded under a different prefix, or without the `sites/`
     part, is invisible to the Worker.
   - **The path.** `/about` is served from `about.html` and `/about/` from `about/index.html`. A
     path with `..`, an encoded slash or backslash, a hidden file, or non-ASCII characters is
     refused before storage is ever read.
2. **500 "Stored object has no content type".** The upload wrote the object without its
   `Content-Type` metadata. The Worker refuses to guess one. Re-upload the file with the content
   type publisher assigned to it (`SiteFile.contentType`).
3. **200, but the page looks old.** Pages are revalidated on every visit and assets after five
   minutes. Wait five minutes, then check that the object in the bucket is really the new one:
   its ETag changes when its bytes change.

### If it is all of them

1. **500 "Server misconfigured"** means `SITES_DOMAIN` is empty in the deployed Worker. Check the
   deployed variables. The value in `apps/serve/wrangler.toml` is only a placeholder until the
   domain is decided.
2. **Every site answers 404, including the sample.** Check that `SITES_DOMAIN` is exactly the
   apex the wildcard hangs off: no scheme, no trailing dot, and a port only in local development.
   A domain that does not match turns every host into "not a site host".
3. **Cloudflare's own error page, or no answer at all.** The request never reached the Worker.
   Check that the wildcard route `*.<domain>/*` is still attached, what the last Worker deploy
   was, and whether it coincides with the start of the outage. Then check Cloudflare's status
   page for R2 and Workers.
4. **Errors that mention the bucket.** Check that the `SITES` binding points at the right bucket
   in the deployed configuration.

### What not to touch

- **Do not delete or overwrite objects to "clean up".** There are no versions yet (Part 16's
  pointer has not been built), so a deleted file is gone until someone republishes it.
- **Do not point one site at another's files,** not even for a moment "to check". That is
  exactly the failure the Worker exists to prevent.
- **Do not disable the route to test something.** It takes every site down, not just the broken
  one.
- **Do not add a fallback to the Worker** — a default site, a content type guessed from the
  extension, a redirect. Each one turns a visible failure into a silent wrong answer.

---

## 2. The editor does not save

> **New with [ADR 0034](decisions/0034-the-account-arrives-at-the-end.md).** Until sprint 15 the
> editor saved to `localStorage` and nothing else, so "it does not save" had no server to blame.
> Now it has two places to fail and they fail differently.

### First question: which save?

The indicator in the editor's top bar says where the last one went, and that is the answer:

- **`Guardado en este navegador`** — the browser copy landed. If there is an account, the push to
  it did **not**, and the label dropped back on purpose (ADR 0034 §10).
- **`Guardado en tu cuenta`** — the account has the document. **Since ADR 0037 it also has the
  photographs**, uploaded when the site was first saved; this label stopped reading «· fotos solo
  en este navegador» the day that became false. What it still does not tell you is whether a
  photograph added *after* that first save is up there — an edit pushes the document and not yet
  the photographs. So a site whose cover is missing on another computer is not this label lying:
  look in Supabase → Storage → `fotos/<owner id>/<site id>/`, and if the object is absent, the
  photograph was added after the save that uploaded them.
- **`No guardado`** — nothing landed. This is the browser's own storage refusing
  ([ADR 0018](decisions/0018-own-cover-photo-before-phase-2.md)).
- **Nothing at all** — no save has been attempted yet. On a page just opened this is normal;
  after an edit it is not.

### If it says `No guardado`

The browser is refusing to store, and the editor is right to say so rather than show a tick.

1. **A private window, or site data blocked.** `localStorage` throws instead of writing. Nothing
   to fix on our side; the honest answer to the owner is to download the site now.
2. **Quota.** Photographs live in `IndexedDB`, not in the session, but a full disk takes both
   down. Clearing other sites' data is the owner's call, not ours.
3. **It never recovers.** Download the ZIP. The download needs no storage and no session
   (Part 16's first rule, asserted by the suite), so it is always the way out.

### If the label dropped from the account back to the browser

The push to the account was refused, and nothing was overwritten. In order:

1. **A stale write** (ADR 0034 §8) — the usual cause, and it means something else wrote that site
   since this editor read it: another tab, or another device. The browser's copy is current and
   the account's is not. **Reopen the site from `/mis-webs`** to continue from what is stored. Do
   not "force" a save; there is deliberately no way to.
2. **The session expired.** `/mis-webs` will redirect to `/entrar`. Signing in again is enough;
   the browser copy is intact while that happens.
3. **The project is paused.** See case 4.

### What not to touch

- **Do not clear the browser's site data to "reset" it.** For an owner with no account that is
  their only copy.
- **Do not add a way to overwrite a stale write.** It exists as a refusal on purpose: the only
  thing it can achieve is throwing away somebody else's edit.

---

## 3. A migration applied halfway

> **New with sprint 15**, which brought this project its first database migration.

### First question: which ledger says what?

```sh
psql "$DATABASE_URL" -c 'select id, applied_at from public.schema_migrations order by id'
```

Compare that list with `packages/db/migrations/*.sql`. Each file runs **inside one transaction**
together with its own ledger row (`packages/db/src/migrate.ts`), so the two cannot disagree about
a file that finished.

- **A file is missing from the ledger.** It did not finish, and it left nothing behind. Run
  `migrate` again; it will retry exactly that one.
- **The ledger has a row for a file that is not on disk.** Somebody ran a migration from a branch
  that was then rewritten. Do not delete the row. Find the file in git history and decide, with
  the schema in front of you, whether the database is ahead of `main`.
- **Both agree but the schema looks wrong.** The migration is not the problem. Stop here and read
  case 2 instead.

### Checking one landed, when the ledger cannot say

**The ledger above is not evidence for a migration pasted into the Supabase SQL editor**, which is
how both of this project's migrations are applied (`docs/tasks/el-recorrido-de-la-cuenta.md`, step 2
of «Antes de empezar»). Only `migrate()` writes `schema_migrations`, and the only thing that calls it
is the test bootstrap. So an empty ledger says nothing either way, and this is the gap that left
migration `0002` in doubt for days.

**Run every check in both projects.** Part 15 requires separate keys for development and production,
so having applied a migration to one says nothing about the other.

#### The twenty-second check, no SQL

**With a test account, never a real one.** The free plan has no backup (`docs/tasks/copias.md`) and
the sweep has no undo, so a check that ends with a live deletion request is not a check worth running
on somebody's own account.

Sign in as the test account, go to `/cuenta`, press «Borrar mi cuenta» and confirm:

| What the screen says | What it means |
|---|---|
| «Has pedido borrar la cuenta. Se borrará a partir del …» | **`0002` landed.** Press «Cancelar el borrado» — see below |
| «No hemos podido registrar la petición. Vuelve a intentarlo.» | It did not. `public.accounts` has no row for that person |

Then **press «Cancelar el borrado», and confirm the screen goes back to offering the deletion rather
than announcing it.** That is the other half of the promise and it exercises the write in the other
direction (`cancelAccountDeletion`, `apps/editor/src/account/sites.ts`). Leaving a pending request
behind on a test account is how a sweep later ends something nobody meant to end.

This works because a deletion request is a timestamp in a column, not a row of its own: every stage
is an `update … where id = <person>` against a row that has to exist already. Before `0002` the
update matched nothing, PostgREST answered 204 with no error, and the screen said it had saved. Since
#181 the failure is reported instead of assumed, which is what makes the first row above readable.

#### The three queries, for *why* it failed

**All three are read-only** — no `insert`, no `update`, no `delete` — so they are safe to paste into
either project's SQL editor.

```sql
-- 1. Nobody without a row. Expected: 0 rows.
select u.id from auth.users u
 where not exists (select 1 from public.accounts a where a.id = u.id);

-- 2. The trigger exists. Expected: 1 row.
select tgname from pg_trigger where tgname = 'account_row_on_signup';

-- 3. One row per person. Expected: the two numbers equal.
select (select count(*) from public.accounts) as rows,
       (select count(*) from auth.users)     as users;
```

Query 1 is the one `packages/db/test/accounts.pg.test.ts` already calls «the query to run against
production if the question ever comes up again». It was in the repository and nowhere in this runbook,
which is most of why this section exists.

**Re-pasting `0002` is safe**: `create or replace function`, `drop trigger if exists` before the
`create`, and `on conflict (id) do nothing` on both inserts. **Re-pasting `0001` is not** — its nine
`create policy` statements carry no guard and the second run errors on the first policy that already
exists. If `0001` needs re-running, read case 3 above first.

### What not to touch

- **Do not edit a migration that has already run anywhere.** Write the next one. A file whose
  bytes change after it is applied makes the ledger a lie.
- **Do not delete rows from `schema_migrations`** to "re-run" something. That is how a migration
  gets applied twice.
- **Do not reach for a restore first.** See case 4: on the free plan there is nothing to restore
  from, which is exactly why this case has to be solvable by reading.

---

## 4. The database is unreachable, or the project is paused

> **New with sprint 15.** Measured while planning it, not assumed: the Supabase free plan
> **pauses a project after one week without activity**, and it has **zero days of backup
> retention**. `docs/tasks/copias.md` has the sources and the proposal.

### First question: paused, asleep, or down?

1. **Open the Supabase dashboard.** A paused project says so, with a button to restore it. Pausing
   **freezes** the volume rather than erasing it, and there is roughly a year to bring it back.
2. **If it is not paused, wake the application.** Render's free service sleeps after ~15 minutes
   and takes about a minute to answer
   ([ADR 0012](decisions/0012-application-stack-approved.md)). A slow first request is the tier,
   not a fault.
3. **If both are awake,** check that `DATABASE_URL` is still the **transaction pooler on port
   6543** and not the direct connection. `packages/db/src/connect.ts` refuses the wrong port for a
   hosted host, so a wrong value fails loudly rather than exhausting connections quietly.

### What an owner can still do while it is down

**Everything that matters, and this is by design.** No published site depends on us (ADR 0001), the
download needs no session (Part 16's first rule), and an owner with no account was never reaching
the database at all. What is unavailable is signing in, the saved list, and pushing an edit to the
account — and the browser's own copy keeps the edits meanwhile.

### What not to touch

- **Do not create a second project "to get going".** The keys in Render point at one project; a
  second one is an empty database and a support case about vanished sites.
- **Do not assume there is a backup.** On the free plan there is not. Decide
  `docs/tasks/copias.md` before this case arrives rather than during it.

---

## 5. An account was deleted and should not have been

> New with ADR 0034 §12, and the honest answer is short.

- **Inside the 30-day window**, nothing has been removed. `/cuenta` shows the pending deletion and
  cancels it; `cancelDeletion` in `packages/db/src/deletion.ts` is the same thing from a shell.
- **After the sweep has run, it is gone.** That is what «borre de verdad» means (Part 15), and on
  the free plan there is no backup to go back to. The export was offered twice before the deletion
  and once more inside the confirmation; if the owner took it, `retorika-mis-webs.json` has every
  document and can be opened in the editor. The sweep is §6 below — **it does not run by itself.**
- **The audit log keeps that a deletion happened and when, and not who.** `actor_id` is
  `on delete set null`, so the row survives the cascade. Part 17 asks for the «quién»; Part 15
  asks for a real deletion. Part 15 wins, and that is a decision rather than an oversight.

---

## 6. Running the sweep that ends accounts

> **It does not run by itself, and that is the honest state of it.** Nothing schedules this: Render's
> cron jobs are a paid feature and ADR 0034's whole stack decision was 0 €. Until something does,
> the thirty days are a **floor** rather than a promise of the exact moment, which is why the
> account screen says «se borrará **a partir del**» and not «el».
>
> This section exists because `packages/db/src/deletion.ts` pointed at the runbook «for who runs
> it» and the runbook did not say. Found auditing the project, 5 October 2026.

### How to run it

```sh
# Says who is past the thirty days, how many photographs each has, and ends nobody.
# Safe, the default, and it needs no secret beyond the database.
DATABASE_URL="<el pooler, puerto 6543>" pnpm accounts:purge

# Ends them. There is no undo and no backup on the free plan.
DATABASE_URL="<el pooler, puerto 6543>" \
NEXT_PUBLIC_SUPABASE_URL="<la URL del proyecto>" \
SUPABASE_SERVICE_ROLE_KEY="<la clave de servicio>" \
  pnpm accounts:purge --confirm
```

**A confirmed run needs the service key as well as `DATABASE_URL`, and that changed on 9 October
2026** (ADR 0037). This section used to say «only `DATABASE_URL` is needed — no service key, no
admin API», which was true when it was written and is now half true:

- **The rows still need nothing but SQL.** Deleting the `auth.users` row cascades through
  `public.sites`, `public.accounts` and Supabase's own `auth.identities`, `auth.sessions` and
  `auth.refresh_tokens`, so one statement finishes them.
- **The photographs are not rows.** They are files in the private `fotos` bucket, and
  `delete from storage.objects` removes the bookkeeping while the bytes stay in the object store.
  Removing a file needs the Storage API, and reaching past the bucket's own policies needs the key
  that bypasses them.

**A dry run still needs neither**, deliberately: asking «who is past the window» destroys nothing
and should not require a key that could.

`packages/db` finds the objects in SQL — testable like everything else there — and the removing is
in `scripts/purge-accounts.ts`, where a secret is allowed to be.
`packages/db/test/deletion.pg.test.ts` runs this code path against a real Postgres with a remover
that records, so the order of operations is asserted without a bucket.

### If it says some accounts were NOT ended

The sweep removes an account's photographs **before** it ends the account, and skips the account if
that fails. The exit code is 1 and each one is named with the reason.

**That order is the decision, and it is the recoverable half of a choice between two failures.** A
skipped account is past its window, has lost some of its photographs, and is ended by the next run:
hours of an account that was leaving anyway. The other order — rows first — would end the account
and leave the files with **nothing left that remembers whose they were**, because the only handle on
those bytes is the owner id in their path and the row holding that id would be gone.

So: read the reason, fix what it names — usually a missing or wrong `SUPABASE_SERVICE_ROLE_KEY`, or
Supabase being unreachable — and run it again. **Do not end the account by hand to clear it.**

### How often

**Once a week is enough and once a month is defensible.** The window is thirty days, so a weekly
run means somebody waits between thirty and thirty-seven days — which is what «a partir del» on
the screen already says. What is *not* defensible is never: an account that asked to be deleted and
was not is the one failure Part 15 wrote a clause about.

### What to check before confirming

1. **Read the ids the dry run prints.** They are the only thing it prints, because that is all it
   needs — a uuid is not a name or an address.
2. **If the number is surprising, stop.** More accounts due than you expected means either a bug in
   `dueForDeletion` or somebody's deletion request that nobody expected, and both are worth a look
   before anything is destroyed.
3. **Check `public.audit_log` afterwards.** One `account_deleted` row per account, with
   `endedTheAccount: true` in its `detail` and a null `actor_id` — the fact kept, the person not
   (Part 17 against Part 15, and Part 15 wins; see `deletion.ts`).
4. **Check the bucket afterwards.** Supabase → Storage → `fotos`. No folder named after an ended
   account's id should be left. A folder that is still there with an account that is gone means the
   sweep reported it ended while the removal did not happen, which the code is arranged to make
   impossible — so it is worth a look rather than a tidy-up.

### What not to touch

- **Do not run `--confirm` to "see what happens".** There is no backup on the free plan
  (`docs/tasks/copias.md`) and no undo in the code, on purpose.
- **Do not delete rows from `public.accounts` by hand** to tidy up a stuck request. That leaves an
  `auth.users` row with no account row — somebody who can sign in and whose deletion request can
  never be recorded again, because the trigger in migration `0002` only fires on insert. Run the
  sweep, or clear `deletion_requested_at` and let the owner decide again.

## 7. A saved web opens without one of its photographs

> New with ADR 0037, sprint 16: the photographs travel with the account now, so there is a way for
> a web to come back incomplete that did not exist before. The owner is told — the download is
> blocked and the «Fotos» panel says what to do — so this section is for working out *which* of
> four things happened, not for discovering that something did.

### First question: does the object exist?

Supabase → Storage → `fotos` → the folder named after the owner's id, then the site's id. The file
names are the document's own: `foto-<section>-<element>.jpg`.

- **The folder is there and the file is there.** The upload worked and the download did not. Go to
  «the download is refused» below.
- **The folder is there and the file is not.** The upload never happened, which is almost always
  case A.
- **There is no folder at all.** Either nothing was ever uploaded for this site — case A for every
  photograph — or migration `0003` was never applied to this project, which is case C.

### A. The web was saved before the photographs travelled

**The commonest one, and not a fault.** Every web saved during sprint 15 has its document in the
account and its photographs only in the browser they were chosen in. Nothing can fetch what was
never uploaded.

The editor says so: «Guardado en tu cuenta · N fotos sin subir» in the top bar, and the «Fotos»
panel explains the remedy — upload the photograph again from there, and from then on it travels.
**Nothing to repair in the database.** Opening that web in the browser that still has the bytes and
editing anything also uploads them, because every accepted save reconciles.

### B. The upload was refused at the time

The indicator said «· N fotos sin subir» when it was saved. Usually the bucket's own caps: a file
over 2 MiB, or a content type that is not `image/jpeg`. The editor re-encodes every upload to JPEG
under those limits, so this means something else reached the bucket, or the bucket's row was edited
by hand.

Check the bucket's row: `select file_size_limit, allowed_mime_types from storage.buckets where id =
'fotos'`. It should be `2097152` and `{image/jpeg}` — the same two numbers
`apps/editor/test/photoCaps.test.ts` asserts against migration `0003`.

### C. Migration `0003` was never applied here

No bucket, no policies, and every upload is refused. `select id from storage.buckets where id =
'fotos'` answers nothing. Apply it — §3's own method — and ask the owner to upload again.

This is the case to suspect on a **new** project: development and production are two projects and
the migrations are applied to each by hand.

### D. The download is refused

The object is there and the editor cannot read it. Two causes worth separating:

- **The policies.** `fotos_select_own` compares the first path segment with `auth.uid()`, so an
  object stored under the wrong prefix is invisible to its own owner. `select name from
  storage.objects where bucket_id = 'fotos'` and look at whether the first segment is really the
  owner's id.
- **The bytes are not an image.** `downloadPhoto` sniffs before it makes an `<img>` and answers
  nothing when the first bytes are not a JPEG, PNG or WebP, whatever the stored content type says.
  That is deliberate and the photograph stays unreadable until it is replaced.

### What not to touch

- **Never `delete from storage.objects`.** It removes the bookkeeping and leaves the bytes in the
  object store — files nobody can list and nothing will ever remove, because the sweep finds an
  account's objects through exactly those rows. If a file has to go, remove it through the Storage
  API, from the dashboard or with `scripts/purge-accounts.ts`'s own remover.
- **Do not make the bucket public** to «see if that fixes it». The published ZIP never reads from
  it (ADR 0001) and the only reader is the editor with the owner's session; public would make every
  owner's photographs readable by anybody holding a URL.
- **Do not re-upload somebody's photograph on their behalf** from the dashboard. The document names
  the file and the owner is the only one who knows which picture belongs there.
