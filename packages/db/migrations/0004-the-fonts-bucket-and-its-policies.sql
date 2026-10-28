-- 0004 — the fonts bucket, and the policies that make it the owner's own.
--
-- Decided by ADR 0056 (an own font travels like a photograph), and planned for sprint 29 día 6:
-- a font the owner brought lived only in the browser that imported it (`retorika.fonts` in
-- IndexedDB), so a saved site opened on another computer named a face nobody could send, and its
-- download was blocked with «Falta el archivo de tu fuente». This is where a font starts belonging
-- to somebody rather than to a browser — the same step migration `0003` took for the photographs.
--
-- EVERYTHING 0003 SAYS ABOUT FILES STILL HOLDS, and is not repeated here at length: a bucket rather
-- than a `bytea` column because of the free plan's two pools; files are not rows, so the account
-- purge has to ask the Storage API to remove them before it ends the account
-- (`packages/db/src/deletion.ts` now empties `fotos` and then `fuentes`); and a `pg_dump` does not
-- contain this bucket either.
--
-- WHAT THIS FILE ASSUMES EXISTS: `storage.buckets`, `storage.objects` and
-- `storage.foldername(text)`, Supabase's, reproduced for the tests by `test/bootstrap.ts`.

-- ---------------------------------------------------------------------------------------------
-- The bucket.
-- ---------------------------------------------------------------------------------------------
--
-- `public => false`, for 0003's reason: a published site never reads from here (ADR 0001 — the
-- ZIP carries the face beside the page), so the only reader is the editor with the owner's session.
--
-- `file_size_limit` is 2 MiB, the same number as `MAX_FONT_BYTES` in
-- `apps/editor/src/editor/fontBytes.ts`: the import refuses above it and `/api/download` refuses a
-- `font` part above it. A face that could be stored and then not bundled would be a save that lied,
-- so `apps/editor/test/fontCaps.test.ts` reads this file and asserts the two are one number. The
-- licence file the owner may attach is capped lower, at 1 MiB, by the editor; one bucket limit
-- covers both because the bucket has only one.
--
-- `allowed_mime_types` is the four formats a face may travel as and the two a licence may, and
-- nothing else. **The content type every upload declares comes from the bytes**, never from
-- `File.type` (David's adjustment 7, 27 October 2026): a browser reports a `.woff2` as
-- `application/octet-stream` or as nothing at all on some systems, and this list would refuse it.
-- `apps/editor/src/account/fontStorage.ts` sniffs and sets the type; the same test ties this list
-- to `FONT_MEDIA_TYPES` and the licence types, so a format added in one place fails in the other.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fuentes',
  'fuentes',
  false,
  2097152,
  array['font/woff2', 'font/woff', 'font/ttf', 'font/otf', 'text/plain', 'application/pdf']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Row-level security on the objects.
-- ---------------------------------------------------------------------------------------------
--
-- The object's name is `<owner uuid>/<site uuid>/<file>`, where `<file>` is the name the renderer
-- mints — `propia-<id>-<role>.<format>`, or `LICENCIA-propia-<id>.<txt|pdf>` — so ownership is the
-- first path segment exactly as it is for a photograph, and each policy is 0003's with the bucket
-- changed. Copied rather than widened to `bucket_id in ('fotos', 'fuentes')`: a policy per bucket
-- is one that can be dropped, tightened or read without reasoning about the other bucket, and the
-- pg suite runs the same cases over both.
--
-- Four verbs, as for the photographs. `update` is what `upsert: true` needs when a face whose
-- upload half-landed is sent again under the same name; `delete` is what the reconciliation after
-- an accepted save needs when a font is taken out of the document.
--
-- No policy for `anon`.

create policy fuentes_select_own on storage.objects
  for select using (
    bucket_id = 'fuentes' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fuentes_insert_own on storage.objects
  for insert with check (
    bucket_id = 'fuentes' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fuentes_update_own on storage.objects
  for update using (
    bucket_id = 'fuentes' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'fuentes' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fuentes_delete_own on storage.objects
  for delete using (
    bucket_id = 'fuentes' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The grants 0003 wrote already cover `storage.objects` for every bucket: a grant decides whether
-- the verb exists, and these policies decide which rows. Nothing to add.
