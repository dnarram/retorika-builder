# Runbook

What to do when something breaks, written before it happens (protocol Part 17). Part 17 names
four foreseeable cases. **Three of them are here**, and **two more** have been added that Part 17
could not have named because the stack they belong to did not exist when it was written: a paused
or unreachable database, and an account deleted that should not have been. Five cases in total —
counted rather than estimated, because the first draft of this very paragraph said "a fifth" and
there were two.

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
- **`Guardado en tu cuenta · fotos solo en este navegador`** — the account has it.
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
  document and can be opened in the editor.
- **The audit log keeps that a deletion happened and when, and not who.** `actor_id` is
  `on delete set null`, so the row survives the cascade. Part 17 asks for the «quién»; Part 15
  asks for a real deletion. Part 15 wins, and that is a decision rather than an oversight.
