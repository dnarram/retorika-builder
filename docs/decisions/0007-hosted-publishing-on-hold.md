# 0007 — Hosted publishing is on hold; at launch the client receives the files

**Status:** superseded by [ADR 0008](0008-hosted-publishing-has-no-plan.md) (2026-09-22) · **Date:** 2026-09-22 · **Decided by:** the CEO

> Superseded: hosted publishing no longer waits for a domain and an account; it has no plan and
> no date (ADR 0008). The reactivation checklist below is kept as reference only.

## Context

The concept dossier promises two ways for a site to live, at the same price:
- on a Retorika subdomain;
- or downloaded and uploaded to the client's own hosting.

That promise appears in §4 step 6, §5 screen 6 and §8. The protocol builds on it: phase 0's
acceptance criterion requires publishing on a real subdomain, and `apps/serve` was built to
serve those subdomains from object storage.

Hosted publishing needs two company decisions that have not been made:
- **which domain** the client sites hang off;
- **which Cloudflare account** holds them.

The first means buying a domain, and the second means where client sites will live. The CEO has
decided not to block the product on them.

## Decision

**Until the reactivation event below, the product does not publish sites on any Retorika
domain or subdomain.** At launch, the app creates the site and hands it to the client as files,
the ZIP that `packages/publisher` produces, and the client publishes it on their own domain.

This is a decision of the CEO, taken on 2026-09-22. **It is temporary.** It lasts until the CEO
chooses the domain and the Cloudflare account. This ADR is then superseded by a new one, not
edited.

## What this overrides

Per CLAUDE.md, an ADR wins over the dossiers where it says so. For the duration of this decision
it says so for:
- **Concept dossier §4, step 6, and §5, screen 6:** the user does not choose where the site
  lives. There is one way, the download.
- **Concept dossier §8:**
  - the hosted option of "el mismo precio tanto si se aloja en el subdominio de Retorika como si
    se descarga";
  - the preview link "con una marca discreta de Retorika", which needs hosting too.

  The price itself, the paywall and how the preview works at launch are money and product
  questions for the CEO. This ADR decides none of them.
- **Protocol:** phase 0's criterion, the meaning of "publicar" in phase 2, and the published-site
  parts of "Despliegue", "Copias" and Part 17. These are amended in `docs/protocolo.md`, with a
  note in each place pointing here.

The dossiers themselves are not edited. They remain the record of the approved product, and this
ADR is the record of what is set aside and why.

## What stays

- **ADR 0001 and protocol Part 16 become the core of the launch product:**
  - the site is static and opens by double-clicking;
  - "la exportación siempre funciona";
  - no site depends on an API of ours.
- **`apps/serve` stays in `main`, built and tested, and is not deployed.**
  - CI keeps running its tests, including the contract test that every path
    `packages/publisher` writes is served at exactly that path.
  - So the sleeping module cannot drift from the files it will one day serve.
- There is no deploy workflow. `wrangler.toml` keeps its placeholder domain and bucket, so a
  deploy fails loudly instead of attaching to anything.
- No credential, account id or bucket name enters the repository. The repository is public.

## Constraint on the editor, when it is built

Hosted publishing must be **off by default and enforced on the server**, not merely hidden in the
interface.
- Screen 6 offers only the download.
- There is no entry point, button or API route that publishes to a Retorika domain until the flag
  is switched on by the reactivation below.

Two things the editor can already offer without hosting:
- **The client's own domain, optionally, at download time:** `buildSite` accepts a `baseUrl`, so
  the bundle can carry a `sitemap.xml` and a `robots.txt` pointing at the client's domain.
- **A short guide, in Spanish and in a translation file, to uploading the files** to a typical
  hosting provider.

## Reactivation

**The event:** the CEO chooses the domain and the Cloudflare account. Everything below then has to
be done before the first client site is served. Each item is its own task, reviewed like any
other.

- [ ] **The domain,** separate from Retorika's main one, so that the `*.<domain>` wildcard
      cannot capture `www`, `api` or the app.
- [ ] **A company Cloudflare account, not a personal one,** and the R2 bucket.
- [ ] **Secrets** in GitHub Actions secrets and Cloudflare's secret store. Never in the
      repository.
- [ ] **The first-deploy task:**
  - `wrangler` as a pinned devDependency;
  - the `allowBuilds` decision for `esbuild` and `workerd`, which pnpm 12 refused;
  - the alpha `miniflare` that `wrangler` 4.131.2 pulled in.
- [ ] **The upload flow that writes a bundle to R2.**
  - Every object is stored with the content type from `SiteFile.contentType`. `apps/serve`
    answers 500 for an object without one, by design.
  - Every publish is kept as a version, and rollback is moving a pointer (protocol Part 16).
  - That changes `objectKeyFor` and makes `fetch` read the current version first, as
    `apps/serve/src/routing.ts` already notes.
- [ ] **The list of reserved subdomains** (`www`, `api`, `admin`, and whatever the product
      needs), and the rule that refuses them as site ids.
- [ ] **Content-hashed asset names in `packages/publisher`,** so that `apps/serve` can cache
      assets as `immutable` instead of today's five-minute revalidation.
- [ ] **The manual acceptance of `docs/tasks/serve.md`:**
  - a bundle uploaded under `sites/<id>/`;
  - the page served at `https://<id>.<domain>/`;
  - a traversal request answered 404.
- [ ] **Part 17's external check** on a sample published site, and the first case of
      `docs/runbook.md` back in force.
- [ ] **The editor's hosted-publishing flag switched on,** and screen 6 offering both ways again.
- [ ] **A new ADR superseding this one.**

## Consequences

- Phase 0 closes on the download path. Its criterion checks the same thing the subdomain checked
  — that the files work when served over HTTP, not only when opened from disk — but uses any
  generic static server instead of infrastructure of ours.
- The launch product has one delivery path. The support burden of a client's hosting is the
  client's.
- `apps/serve` costs a few seconds of CI and nothing else. Keeping it tested is what makes
  reactivation a checklist instead of a rewrite.
- `docs/tasks/serve.md` and the first case of `docs/runbook.md` carry a status line pointing
  here, so nobody executes them by mistake.
