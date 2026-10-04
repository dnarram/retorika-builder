-- 0001 — accounts, sites, and the audit log.
--
-- The first database migration of this project. Everything before it stored a document in
-- `localStorage` (ADR 0012's third note) and a photo in `IndexedDB` (ADR 0018); this is where a
-- site starts belonging to somebody. Decided by ADR 0034.
--
-- WHY THIS IS SQL AND NOT A GENERATED SCHEMA. The row-level security policies below are the
-- enforcement point for "you only see your own sites" (ADR 0034 §7), and they are the reason
-- Supabase was chosen over hand-rolled authentication at all. A generator that emits tables but
-- not policies would leave the half that matters hand-written anyway, and then the same tables
-- would have two sources of truth. So the SQL is the source of truth. Drizzle arrives with the
-- first typed query, which is day 4's work, and reads these tables rather than defining them.
--
-- WHAT THIS FILE ASSUMES EXISTS. `auth.users`, `auth.uid()` and the `anon`/`authenticated`/
-- `service_role` roles are Supabase's, not ours. Against a plain Postgres they are created by
-- `test/bootstrap.ts`, which reproduces Supabase's documented contract and nothing more — so the
-- policies that run in the tests are character-for-character the policies that ship.
--
-- WHAT IS DELIBERATELY NOT HERE. `locked`, `paymentStatus` and `subscription` are three of the
-- five keys `docs/document-rules.md:374-387` sends to "the database", and ADR 0034 §6 refuses to
-- create them: a column with no verb is an invalid state waiting for someone to write to it.
-- Locking and the transfer of ownership are the advanced dossier §8 and get their own sprint.

-- ---------------------------------------------------------------------------------------------
-- accounts — one row per person, holding what belongs to the person rather than to a site.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,

  -- The design-tools switch. ADR 0025 stored it in the browser and said, before there was
  -- anywhere else to put it: "when accounts arrive, that module is the one file that moves".
  -- Depth is a property of the person looking, never of the site (ADR 0034 §11).
  design_tools boolean not null default false,

  -- The 30-day grace window of ADR 0034 §12, which is Part 15's "ventana de gracia razonable"
  -- given a number for the first time. Null means no deletion is pending. The row is not deleted
  -- here: a request is a timestamp, and the deletion itself removes the `auth.users` row, which
  -- cascades to this one.
  deletion_requested_at timestamptz,

  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- sites — one row per website, with the document stored whole.
-- ---------------------------------------------------------------------------------------------

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,

  -- Stored whole, as jsonb, and not shredded into tables. `document-rules.md` forbids database
  -- concerns from entering the document; the symmetry is that the database does not take the
  -- document apart (ADR 0034 §6). The document model is the source of truth for its own shape,
  -- and `parseDocument` is the gate it passes through.
  document jsonb not null,

  -- Beside it, so the migrations already in packages/schema/migrations/ keep running on read.
  -- A row written at 1.8.0 and read after 1.9.0 ships is migrated by the code that already
  -- exists for exactly this, rather than by a column default nobody maintains.
  schema_version text not null,

  -- The stale-write refusal of ADR 0034 §8. The advanced dossier assumes two people can open one
  -- site at once, and two tabs of one person are enough to cause it. A write carries the version
  -- it read; the update matches on it and bumps it, so a stale write matches no row and is
  -- refused rather than silently winning.
  version integer not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The list the account screen draws: this person's sites, newest first.
create index if not exists sites_owner_updated_idx on public.sites (owner_id, updated_at desc);

-- ---------------------------------------------------------------------------------------------
-- audit_log — protocol Part 17: "quién, cuándo y sobre qué web".
-- ---------------------------------------------------------------------------------------------

-- Part 17 names four operations that matter: publicación, pago, transferencia de propiedad,
-- desbloqueo. All four are reserved here; only one of them can happen this sprint, because since
-- ADR 0008 "publicar" means delivering the files, which is the download. The account lifecycle is
-- added because "borrado de cuenta que borre de verdad" (Part 15) needs a record that it happened.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'audit_operation') then
    create type public.audit_operation as enum (
      'publication',
      'payment',
      'ownership_transfer',
      'unlock',
      'account_created',
      'account_deleted'
    );
  end if;
end
$$;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  operation public.audit_operation not null,

  -- Null is a real value here and not a missing one: the download must work with no session at
  -- all (Part 16's first rule, and ADR 0034 §18), so a publication row can have no actor. And
  -- `on delete set null` rather than cascade, because an audit row that disappears with the
  -- account it records is not an audit log.
  actor_id uuid references auth.users (id) on delete set null,
  site_id uuid references public.sites (id) on delete set null,

  occurred_at timestamptz not null default now(),
  detail jsonb
);

create index if not exists audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);

-- ---------------------------------------------------------------------------------------------
-- Row-level security. This is the half that matters.
-- ---------------------------------------------------------------------------------------------
--
-- Part 15: "la clave de servicio de la base de datos no se usa nunca desde el navegador". The
-- browser holds a key that can only act as `authenticated`, and these policies are what that key
-- is allowed to do. Written here rather than in a route handler because one forgotten
-- `where owner_id = ...` in TypeScript leaks another person's site, and no demo reveals it.

alter table public.accounts enable row level security;
alter table public.sites enable row level security;
alter table public.audit_log enable row level security;

-- accounts: your own row, and no other.
create policy accounts_select_own on public.accounts
  for select using (id = auth.uid());
create policy accounts_insert_own on public.accounts
  for insert with check (id = auth.uid());
create policy accounts_update_own on public.accounts
  for update using (id = auth.uid()) with check (id = auth.uid());
-- No delete policy, deliberately: an account row goes when its `auth.users` row goes, through the
-- cascade above. Deleting the profile while the login survives is the invalid state.

-- sites: your own sites, and no other.
--
-- Rewriting `owner_id` to somebody else is blocked by TWO of these policies, and which one does
-- the work is worth knowing, because it was measured rather than assumed. **Postgres applies the
-- SELECT policy's USING expression to the NEW row of an UPDATE** — you cannot update a row into a
-- state you would not be allowed to see — so `sites_select_own` alone refuses the rewrite, and
-- the `with check` on `sites_update_own` refuses it a second time. Verified by neutralising each
-- in turn: with either one in place the rewrite is refused, and only with both neutralised does
-- it succeed.
--
-- **So the redundant clause is the one that matters later, and it stays.** The moment a future
-- sprint loosens `sites_select_own` to let a collaborator read a site — which is exactly what the
-- advanced dossier §8's collaborator role asks for — the SELECT policy stops guarding writes, and
-- `with check` becomes the only thing standing between a reader and an ownership rewrite. The
-- transfer of ownership happens on a delivery screen with a decision behind it (§8), never as a
-- side effect of an update, and this is the line that will still be true when the rest changes.
create policy sites_select_own on public.sites
  for select using (owner_id = auth.uid());
create policy sites_insert_own on public.sites
  for insert with check (owner_id = auth.uid());
create policy sites_update_own on public.sites
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy sites_delete_own on public.sites
  for delete using (owner_id = auth.uid());

-- audit_log: you may read what was recorded about you, and nothing writes it from a browser.
-- There is no insert, update or delete policy here on purpose. An audit log a client can write is
-- a log of what the client felt like claiming, and one it can edit is not a log at all.
create policy audit_select_own on public.audit_log
  for select using (actor_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Grants. Belt and braces: RLS decides which rows, a grant decides whether the verb exists.
-- ---------------------------------------------------------------------------------------------
-- Both are needed. RLS with a blanket grant is one `create policy` away from leaking; a grant
-- with no RLS leaks immediately. The audit log gets `select` and nothing else, so the absent
-- insert policy above is backed by an absent privilege rather than resting on it alone.

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.sites to authenticated;
grant select, insert, update on public.accounts to authenticated;
grant select on public.audit_log to authenticated;
