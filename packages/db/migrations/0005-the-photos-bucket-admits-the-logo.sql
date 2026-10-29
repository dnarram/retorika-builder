-- 0005 — the photos bucket admits a PNG, because the logo is one.
--
-- Decided by ADR 0059 (the logo travels like a photograph, rasterised): the logo of question 1,
-- which the questionnaire used to decode for its palette and then discard, is kept and shown in
-- the header. It travels the path a photograph travels — IndexedDB, the preview's object URL, the
-- multipart form, and this bucket under `<owner>/<site>/<src>` — with one difference in its bytes:
-- a logo is **re-encoded to PNG, never to JPEG**. A JPEG has no alpha channel, and a logo drawn on
-- a coloured bar (`primary`, `ink`) with its transparency flattened to white is a white box with a
-- logo in it. `prepareLogo` in `apps/editor/src/editor/photos.ts` writes a PNG of at most 512px a
-- side; `preparePhoto` goes on writing JPEG for every photograph.
--
-- So `allowed_mime_types` grows by exactly that one type. It stays narrower than the three formats
-- the file picker accepts, for 0003's reason: the bucket refuses anything that is not what we
-- produce, and we produce two things now. `apps/editor/test/photoCaps.test.ts` reads this file and
-- asserts the list is exactly the content types the editor writes (`PHOTO_CONTENT_TYPES`), so a
-- third format added on one side fails on the other.
--
-- The policies of 0003 are untouched: a logo is an object in the owner's own folder like any
-- photograph, and `storage.foldername(name)[1] = auth.uid()` is the whole of ownership for it too.
-- The size cap is untouched as well — a 512px PNG cannot approach 2 MiB.
--
-- `update … where id = 'fotos'` rather than a second `insert … on conflict`, so that a project
-- where 0003 was applied by hand (both of this project's databases, `docs/runbook.md` §3) gets the
-- change and a project where it was not gets nothing silently — and `select allowed_mime_types
-- from storage.buckets where id = 'fotos'` says which happened.

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png']
where id = 'fotos';
