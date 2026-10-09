-- 0003 — the photos bucket, and the policies that make it the owner's own.
--
-- Decided by ADR 0037, which amends ADR 0034 §5: the documents travelled in sprint 15 and the
-- photographs stayed in the browser, so a site opened on another computer appeared without them.
-- This is where a photograph starts belonging to somebody rather than to a browser.
--
-- WHY A BUCKET AND NOT A `bytea` COLUMN. Read on supabase.com/pricing on 9 October 2026, the free
-- plan gives 500 MB of database and 1 GB of file storage. A photograph is a few hundred kilobytes
-- and a document is a few; in one 500 MB pool the thing that fills it is photographs, and the
-- thing that stops working is saving a site. Storage also hands back a Blob, which is exactly the
-- shape the bank's photographs already travel in (`/api/muestras/[id]` → IndexedDB → object URL →
-- the multipart form the download reads), so an account photograph needs no second path.
--
-- WHAT THIS COSTS, SAID HERE BECAUSE IT IS EASY TO FORGET AT THE WRONG MOMENT. **Files are not
-- rows.** `delete from storage.objects` removes the bookkeeping and leaves the bytes in the
-- object store, so the account purge of `packages/db/src/deletion.ts` cannot stay pure SQL: it
-- has to ask the Storage API to remove the objects, with a key that can, before it ends the
-- account. And a `pg_dump` does not contain this bucket, so protocol Part 16's backup question
-- grows a second half. Both are named in ADR 0037's consequences and neither is silent.
--
-- WHAT THIS FILE ASSUMES EXISTS. `storage.buckets`, `storage.objects` and
-- `storage.foldername(text)` are Supabase's, like `auth.users` and `auth.uid()` before them.
-- Against a plain Postgres they are created by `test/bootstrap.ts`, which reproduces Supabase's
-- documented contract and nothing more — so the policies below run in the tests character for
-- character as they ship.

-- ---------------------------------------------------------------------------------------------
-- The bucket.
-- ---------------------------------------------------------------------------------------------
--
-- `public => false`: there is no unauthenticated read. A published site never reads from here —
-- ADR 0001 says the downloaded ZIP works with no server and no service of ours — so the only
-- reader is the editor, with the owner's own session.
--
-- `file_size_limit` is 2 MiB, the same number as `MAX_PHOTO_BYTES` in
-- `apps/editor/src/editor/downloadGate.ts`, which `/api/download` has enforced since sprint 6.
-- Two numbers that must be one number, so `apps/editor/test/photoCaps.test.ts` reads this file and
-- asserts they are. A client that could store what the download would then refuse to bundle is
-- exactly the invalid state the shared `MAX_PHOTOS` was introduced to stop.
--
-- `allowed_mime_types` is JPEG and nothing else, which is narrower than the three formats the file
-- picker accepts, and deliberately so: `preparePhoto` re-encodes every upload through a canvas to
-- JPEG whatever went in. The picker's job is to recognise what a person chose; the bucket's is to
-- refuse anything that is not what we produce. The same test ties this to `PHOTO_CONTENT_TYPE`, so
-- changing the output format fails here rather than at somebody's upload.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Row-level security on the objects. This is the half that matters.
-- ---------------------------------------------------------------------------------------------
--
-- The object's name is `<owner uuid>/<site uuid>/<src>`, so the first path segment is the owner
-- and every policy below is one line that reads the same as `sites_select_own` does on
-- `public.sites`. `storage.foldername(name)` is Supabase's own helper and returns the path
-- segments without the file name, so `[1]` is that first segment.
--
-- Four verbs, not three. `update` is what `upsert: true` needs when an owner replaces the
-- photograph in a slot they already filled — the key is stable per slot on purpose
-- (`photoSrcFor`), so replacing is an overwrite rather than a second file — and `delete` is what
-- day 4's reconciliation needs when a section is deleted and its photograph stops being
-- referenced.
--
-- Both `using` and `with check` on `update`, for the reason migration `0001` wrote out at length
-- for `sites_update_own`: `using` refuses touching somebody else's object, `with check` refuses
-- moving your own object into their folder. The second is the one that will still be doing work
-- the day a collaborator may read a site that is not theirs.
--
-- No policy for `anon`. A visitor who has not signed in has no folder, and a bucket that is not
-- public has nothing for them to read.

create policy fotos_select_own on storage.objects
  for select using (
    bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fotos_insert_own on storage.objects
  for insert with check (
    bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fotos_update_own on storage.objects
  for update using (
    bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fotos_delete_own on storage.objects
  for delete using (
    bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------------------------
-- Grants. Belt and braces, the same pairing migration `0001` explains.
-- ---------------------------------------------------------------------------------------------
-- Row-level security decides which rows; a grant decides whether the verb exists at all. On a
-- real Supabase project `authenticated` already holds these on `storage.objects`; the grant is
-- written anyway so the tests exercise the same pair of mechanisms the production database has,
-- and so this file does not depend on a default somebody could tighten.

grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
