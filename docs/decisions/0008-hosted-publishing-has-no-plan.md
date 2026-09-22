# 0008 — Publishing on a Retorika domain has no plan; the download is the only delivery path

**Status:** accepted · **Date:** 2026-09-22 · **Decided by:** the CEO · **Supersedes:** [ADR 0007](0007-hosted-publishing-on-hold.md)

## Context

ADR 0007 put hosted publishing on hold "until the CEO chooses the domain and the Cloudflare
account", with a reactivation checklist for that day. The CEO has now answered: **there is no such
day planned.**

## Decision

- **Publishing a site on a Retorika domain or subdomain has no plan.** There is no reactivation
  event and no date, and it may never be built. If it is ever reconsidered, a new ADR decides it
  from scratch.
- **At launch there is one way a site is delivered: the download,** the ZIP that
  `packages/publisher` produces. The client publishes it on their own domain.
- **One price.** The promise of "el mismo precio tanto si se aloja en el subdominio de Retorika
  como si se descarga" is **withdrawn**, because there is only one way. The amount itself is not
  decided here.
- **The preview with the Retorika mark is seen only inside the app.** There is no public preview
  URL, and nothing is hosted to show a site before payment.

## What this overrides

It overrides the same passages ADR 0007 did, but **no longer for the launch only: until a future
ADR says otherwise.**
- **Concept dossier §4, step 6, and §5, screen 6:** the user does not choose where the site
  lives.
- **Concept dossier §8:**
  - the hosted option;
  - the same-price promise across two paths;
  - the preview link "con una marca discreta de Retorika" as a shareable link.
- **Protocol:** the notes added by ADR 0007 in phase 0, phase 2, "Despliegue" and Part 17 now
  point here and say there is no plan and no date.

ADR 0001's decision (the site is static and opens by double-clicking) stands. Its context
mentions the two paths at one price, and that is history: an ADR is not edited.

## `apps/serve`

- **It stays in `main`, dormant and tested.** CI keeps running its tests, including the contract
  test that every path `packages/publisher` writes is served at exactly that path. It is not
  deployed, and `wrangler.toml` keeps its placeholders.
- **If it ever demands maintenance, it is archived, not maintained.** That covers:
  - its tests breaking because of a change elsewhere;
  - a dependency or toolchain upgrade that needs changes inside it;
  - its CI time or its wiring getting in the way of other work.
- **Archiving is its own PR:**
  1. Tag the last `main` commit where it is green as `archive/apps-serve`.
  2. Remove `apps/serve` and its wiring: the `tsconfig.json` reference and the `serve` project in
     `vitest.config.ts`. `apps/*` stays in the workspace, for `apps/editor`.
  3. Point the README row, `docs/tasks/serve.md` and the runbook's first case at the tag.

## ADR 0007's reactivation checklist

It is **kept in ADR 0007, as reference only.** It is not a plan. If hosted publishing is ever
reconsidered, it is a starting point for the new ADR, not a list waiting to be worked through.

## The dossier

The concept dossier (`docs/dossiers/Retorika_Builder_Dossier_v1.docx`) is **not edited now.** It
will be updated to **v1.2** together with the detailed phase 1 screens. Until then, this ADR is
the record of what the dossier says that no longer holds.

## Consequences

- Phase 0's criterion, as amended by ADR 0007, stands unchanged. It was already written for the
  download path.
- **The editor gets no hosted-publishing entry point at all:** no button, no API route, no flag.
  Screen 6 is the download.
- The support burden of hosting is the client's.
