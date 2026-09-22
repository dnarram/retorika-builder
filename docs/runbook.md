# Runbook

What to do when something breaks, written before it happens (protocol Part 17). Part 17 names
four foreseeable cases; this file holds the first. The other three — a payment charged with no
site published, the editor not saving, a half-applied migration — arrive with the code they
concern.

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
