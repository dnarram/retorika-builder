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
>
> **This note is discharged. 4 October 2026, sprint 15
> ([ADR 0034](0034-the-account-arrives-at-the-end.md)).** Sprint 14 closed the editor, which is the
> condition written above, and this ADR's destination was reached: `packages/db` holds the schema
> and its row-level security policies, and `apps/editor` signs people in with the anon key that
> those policies constrain. Two things about the note are worth keeping rather than overwriting:
>
> - **The `Guardado en este navegador` wording was tied to the guarantee on purpose**, «precisely
>   so nobody reads a cross-device guarantee into it». The guarantee changed, so the wording did:
>   with an account it reads «Guardado en tu cuenta · fotos solo en este navegador», because the
>   document travels and the photographs do not (ADR 0034 §5, §10). **Without an account it is
>   unchanged**, since the anonymous journey survived.
> - **`localStorage` was not replaced.** It is the only storage for somebody with no account, and a
>   cache for somebody with one — and a site opened *from* the account deliberately does not write
>   to it at all, because the session slot is one per browser and taking it would overwrite an
>   anonymous web nobody was asked about.
>
> The stack decisions themselves were re-checked rather than assumed when the sprint was planned —
> both platforms, and why neither replaces the other — and the reasoning is in ADR 0034's context
> rather than repeated here. The pooler on port 6543 is now enforced in code:
> `packages/db/src/connect.ts` refuses a hosted URL on any other port, with this ADR's own reason
> in the error.

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
