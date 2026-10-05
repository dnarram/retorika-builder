-- 0002 — every `auth.users` row gets its `public.accounts` row, and the ones that missed out get it now.
--
-- **The defect this closes, found by auditing the whole project on 5 October 2026.** Migration
-- `0001` created `public.accounts` with `id` referencing `auth.users`, and then **nothing ever
-- inserted into it.** Supabase Auth creates the `auth.users` row on sign-up; no trigger and no
-- line of application code created the matching row here. Only `test/bootstrap.ts` did, which is
-- why every test passed while production had no accounts at all.
--
-- What that cost, in the order somebody would have hit it:
--
--   1. `/cuenta` → «Borrar mi cuenta» → the `update` matched **zero rows**. PostgREST answers that
--      with no error, so the screen said «Se borrará el …» and **nothing had been written**. One
--      reload and the request had evaporated. That is the single clause protocol Part 15 wrote
--      specifically about accounts, and it was a sentence on a screen with nothing behind it.
--   2. The design-tools switch reported itself saved to the account and was not, so it silently
--      stopped following the person between machines while claiming to.
--   3. `dueForDeletion` could never find anybody, because the timestamp it looks for had no row to
--      live in.
--
-- WHY A TRIGGER AND NOT A LINE OF APPLICATION CODE. There are three ways into an account — the
-- dialog's sign-up, the same dialog's Google button, and `/entrar` for somebody who already had
-- one — and a row that only appears on the path somebody remembered to patch is a row that is
-- missing on the other two. The database is where «every user has an account row» is an invariant
-- rather than a convention, which is the same argument ADR 0034 §7 makes about ownership.
--
-- THE ONE STATEMENT HERE THAT TOUCHES A SCHEMA WE DO NOT OWN. The trigger is on `auth.users`,
-- which is Supabase's. This is Supabase's own documented pattern for exactly this, and the role
-- the migrations run as can create it. `test/bootstrap.ts` builds `auth.users` itself, so the
-- trigger is exercised against a real Postgres like everything else in `0001`.

-- ---------------------------------------------------------------------------------------------
-- The function
-- ---------------------------------------------------------------------------------------------
--
-- `security definer`, because the role that inserts into `auth.users` is Supabase's auth service
-- and it has no business holding rights on `public.accounts`. `search_path = ''` with every name
-- written out in full, which is what stops a `security definer` function from being redirected at
-- a table somebody else put earlier on a search path.
--
-- **`on conflict do nothing`, and that is not defensiveness for its own sake: if this function
-- raises, the sign-up it is attached to fails.** Somebody would be unable to create an account at
-- all because a row they never asked about already existed. The body is deliberately one
-- statement that cannot fail for any reason worth propagating.

create or replace function public.account_row_for_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $fn$
begin
  insert into public.accounts (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------------------------
-- The trigger
-- ---------------------------------------------------------------------------------------------
--
-- Dropped first so this migration is safe to run against a database where an earlier attempt got
-- halfway — which is case 3 of `docs/runbook.md`, and the one case a migration can make easier on
-- itself for free.

drop trigger if exists account_row_on_signup on auth.users;

create trigger account_row_on_signup
  after insert on auth.users
  for each row execute function public.account_row_for_new_user();

-- ---------------------------------------------------------------------------------------------
-- And the accounts that were created before the trigger existed
-- ---------------------------------------------------------------------------------------------
--
-- A trigger fires on insert, so it does nothing for anybody who signed up while `0001` was the
-- newest migration. Every one of those people currently has an account that cannot be deleted and
-- a switch that cannot be remembered. The affected set is small and known — this application has
-- had accounts for one day and one tester — but it is counted by the statement rather than
-- asserted by this comment, which is the difference between a backfill and a hope.

insert into public.accounts (id)
select id from auth.users
on conflict (id) do nothing;
