# 0012 — The application stack is approved: Supabase for data, Render for the application

**Status:** accepted · **Date:** 2026-09-23 · **Decided by:** the CEO

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
