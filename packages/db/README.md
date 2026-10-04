# `@retorika/db`

The application's database: accounts, sites and the audit log, with the policies that decide who
sees what. Decided by [ADR 0034](../../docs/decisions/0034-the-account-arrives-at-the-end.md); the
stack is [ADR 0012](../../docs/decisions/0012-application-stack-approved.md)'s.

**Server only.** Protocol Part 15: «La clave de servicio de la base de datos no se usa nunca desde
el navegador.» Nothing here may be imported from a client component.

## The SQL is the source of truth

`migrations/` holds numbered SQL files, applied in order, each in its own transaction, each
recorded so it runs once — the same convention `packages/schema/migrations/` already uses for the
document's own migrations.

They are SQL and not a generated schema because the row-level security policies are the half that
matters: they are the enforcement point for «solo ves tus propias webs», and the reason Supabase
was chosen over hand-rolled authentication at all. A generator that emitted tables but not
policies would leave them hand-written anyway, and then one set of tables would have two sources
of truth. Drizzle arrives with the first typed query and reads these tables rather than defining
them.

## Running the tests

```sh
pnpm test        # the pure logic: the pooler guard, the migration listing
pnpm test:db     # the policy suite, against a real Postgres
```

`pnpm test:db` needs a Postgres it can create and drop a database on, and **no Docker** — protocol
Part 18 rules it out on this machine by name. A native Postgres is enough; on this laptop it is
Postgres.app, and `RETORIKA_DB_MAINTENANCE_URL` points elsewhere if needed.

`test/bootstrap.ts` creates what Supabase provides and a plain Postgres does not: `auth.users`,
`auth.uid()` and the `anon`/`authenticated`/`service_role` roles. It **reproduces** Supabase's
contract rather than approximating it, because the point is that the policies under test are
character-for-character the policies that ship. Its `auth.uid()` is Supabase's own definition,
including the detail that the setting is null-checked *before* the cast — written the other way
round first, and the anonymous-visitor test caught it.

## What is deliberately not here

`locked`, `paymentStatus` and `subscription` are three of the five keys
`docs/document-rules.md` sends to «the database», and ADR 0034 §6 refuses to create them: a column
with no verb is an invalid state waiting. Locking and the transfer of ownership are the advanced
dossier §8 and get their own sprint.
