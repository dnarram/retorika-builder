# 0001 — Published sites are static

**Status:** accepted · **Date:** 2026-09-16

## Context

Three promises from the approved dossiers point at the same technical requirement:

- the user can download their files and upload them to any hosting (concept dossier §5, screen
  6, and §8);
- the same price covers both paths — our subdomain or their own hosting — because the cost per
  site is minimal (§8, "Lo único que conviene vigilar");
- nobody is ever locked out of their own site (protocol Part 16).

None of the three survives if what we generate needs a server or a runtime of ours.

## Decision

**The published site is HTML and CSS, and almost nothing else.**

- No React and no runtime framework ships to the client's site. JavaScript appears only in the
  sections that genuinely need it — carousel, accordion, form — and counts against an explicit
  budget.
- Nothing in the published site depends on an API of ours. A downloaded site must work when
  opened by double-clicking it, with no server and no network.
- The editor is a large application, but that is our problem, not the client's.
- One renderer, two targets: `render(doc, "dom")` for the editor and `render(doc, "html")` for
  publishing, from one shared node tree. Two renderers would diverge, and the user would see one
  thing while editing and another once published.

## Consequences

- Layout, grid, tokens and breakpoints live in `packages/renderer` and nowhere else.
- `packages/renderer` carries no external runtime dependency; a pre-commit hook enforces the
  allowlist, because everything that lands there travels to the client's site.
- The renderer must be deterministic — no clock, no randomness, sorted output — so the same
  document always produces the same bytes. Golden tests depend on this.
- Weight is a product feature, not a nicety: HTML and CSS under 60 KB gzipped per published
  page, zero JavaScript when no section needs it.
- Private areas with login (dossier phase 4) do not fit this decision. A login is not a file, so
  such a site cannot be downloaded and must live with us. That phase needs its own ADR and its
  own pricing model.

## Supersedes

Nothing. This is the first ADR, and it is the decision protocol Part 3.1 already fixed.
