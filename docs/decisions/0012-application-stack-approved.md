# 0012 — The application stack is approved: Supabase for data, Render for the application

**Status:** accepted · **Date:** 2026-09-23 · **Decided by:** the CEO

> **Nota (24 de septiembre de 2026): se usa el runtime nativo de Node, no Docker.** Render's Node
> services now default to Node 24, so the Dockerfile bought nothing but a build step to maintain.
> Everything else in this decision stands, and `render.yaml` pins `NODE_VERSION` to 24.21.0
> because `engine-strict` plus `^24.21.0` in the root `package.json` rejects Render's own default
> of 24.14.1. The measured cold start in this ADR (1266 ms) was the round trip with the service
> already awake: on the free plan the service sleeps after ~15 minutes and takes about a minute
> to wake.
>
> **A second note, from the first real deploy attempt failing:** `corepack enable`, the obvious
> way to get the pinned pnpm onto a fresh machine, fails on Render's Node image with `EROFS:
> read-only file system, unlink '/usr/bin/pnpm'` — Render ships its own `pnpm` at that path,
> pre-installed, on a filesystem corepack cannot write to. `render.yaml` uses `npx
> pnpm@12.4.2` instead, which fetches the exact pinned release without touching `/usr/bin`.
>
> **A third note (25 September 2026): protocol Part 14's "guardado automático" is met in its
> minimal version, `localStorage`, not this ADR's Supabase.** Accounts and server-side persistence
> are deliberately out of the second sprint's scope — they cost two to three days of work the CEO
> would not see, on a slice the protocol never actually requires an account for. `localStorage`
> satisfies "automatic save" honestly on its own terms: an edit survives a reload of the same
> browser, and the editor's `Guardado` tick says `Guardado en este navegador` rather than a bare
> `Guardado`, precisely so nobody reads a cross-device guarantee into it. Supabase and accounts
> remain this ADR's eventual destination, opened once the editor itself is finished.

## Context

Protocol §3.3 listed the stack as "pendiente de aprobación formal, igual que figura en los
dossiers". The CEO asked for the free tiers to be tried before signing it off, because the whole
cost argument rests on them. The test was run and the result accepted (design session,
`docs/design/HANDOFF.md`, D1).

## Decision

- **The stack of protocol §3.3 is approved,** and stops being a proposal.
- **The application runs on Render,** deployed from GitHub via Docker, in Frankfurt — the same
  region as Supabase, so the two are not talking across Europe.
- **The database is reached through Supabase's transaction pooler (port 6543),** not the direct
  connection. Render's free instances hibernate and wake, and direct connections are exhausted by
  that pattern.

## What was measured

Round trip from Render to Supabase:

| Call | Time |
|---|---|
| first, after inactivity | 1266 ms |
| second | 912 ms |
| once warm | 129 ms |

That shape is Render's free-tier cold start, not a network problem between the two services.

## Operational consequences

- **A free Render service spins down after roughly 15 minutes of inactivity.** Anything demoed
  live — the prototype with the two businesses, a call with the CEO — needs a warm-up request
  first. It is a property of the tier, not a fault to debug.
- **Published client sites are unaffected.** They are static files that the client hosts
  (ADR 0001, ADR 0008), so no client's website depends on our application being awake. This is
  the reason a free tier is tolerable at all.
- Moving off the free tiers is a cost decision, not an architectural one: the same containers and
  the same pooler.

## Consequences

- Protocol §3.3 loses its "pendiente de aprobación formal" note and gains the hosting row.
- Nothing in `packages/` changes. The stack decided here is the application's; the renderer,
  schema, catalog and publisher run anywhere.
