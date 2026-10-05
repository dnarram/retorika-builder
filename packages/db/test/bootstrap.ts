import postgres from "postgres";
import type { Sql } from "../src/connect.ts";
import { migrate } from "../src/migrate.ts";

/**
 * A real Postgres for the policy tests, with no Docker.
 *
 * Protocol Part 18 rules Docker out on this machine by name — «Base de datos gestionada en lugar
 * de Docker Desktop. Docker en esta máquina se come 2 o 3 GB para no aportar nada que no dé
 * Supabase» — so there is no local Supabase stack to start. What there is, is Postgres itself.
 *
 * **What this file creates is Supabase's contract and nothing more.** `auth.users`, `auth.uid()`
 * and the three roles are Supabase's, documented, and small enough to reproduce exactly:
 * `auth.uid()` reads the `sub` claim out of `request.jwt.claims`, which is how Supabase's own
 * definition reads it. That matters because it is what lets the policies in `migrations/` run
 * here **character for character as they ship**. If this shim drifted from Supabase, the tests
 * would be verifying a different database than production — so it reproduces rather than
 * approximates, and it lives in `test/` so it can never be mistaken for something that deploys.
 */

const MAINTENANCE = process.env["RETORIKA_DB_MAINTENANCE_URL"] ?? "postgres:///postgres";
const TEST_DB = "retorika_db_test";

/** Supabase provides these. A plain Postgres does not. */
const SUPABASE_CONTRACT = `
  create schema if not exists auth;

  create table if not exists auth.users (
    id uuid primary key,
    email text unique
  );

  -- Supabase's own definition, and the shape of it matters. The setting is null-checked BEFORE
  -- the cast, not after: an unset GUC comes back as the empty string, and ''::jsonb throws
  -- rather than yielding null. Written the other way round first, and the "visitor who has not
  -- signed in" test below is what caught it — which is the whole reason that test exists.
  create or replace function auth.uid() returns uuid
    language sql stable
    as $fn$
      select coalesce(
        nullif(current_setting('request.jwt.claim.sub', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      )::uuid
    $fn$;
`;

/** Roles are cluster-wide, so they outlive the test database and are created only if absent. */
const ROLES = `
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end
  $$;
`;

/**
 * Drops and recreates the test database, installs the contract, runs the migrations.
 *
 * It is dropped rather than cleaned between runs because a test that starts from whatever the
 * last one left is a test whose failures depend on its neighbours.
 */
export async function freshDatabase(
  options: {
    /**
     * Runs after Supabase's contract exists but **before** the migrations, which is the only
     * window in which a database can be put into the state a previous release left behind.
     * `accounts.pg.test.ts` uses it to create the one thing migration `0002` has to repair: a
     * person who signed up while `0001` was the newest migration and therefore has no account row.
     */
    beforeMigrations?: (sql: Sql) => Promise<void>;
  } = {},
): Promise<Sql> {
  const admin = postgres(MAINTENANCE, { prepare: false, max: 1 });
  try {
    await admin.unsafe(ROLES);
    await admin.unsafe(`drop database if exists ${TEST_DB} with (force)`);
    await admin.unsafe(`create database ${TEST_DB}`);
  } finally {
    await admin.end();
  }

  // The database name is an option rather than a rewritten path. `postgres:///postgres` has an
  // empty host, so editing its pathname promotes the database name to a hostname — which is
  // exactly what it did the first time this was written.
  const sql = postgres(MAINTENANCE, { prepare: false, database: TEST_DB });

  await sql.unsafe(SUPABASE_CONTRACT);
  await sql.unsafe(ROLES);
  if (options.beforeMigrations) await options.beforeMigrations(sql);
  await migrate(sql);
  return sql;
}

/**
 * Registers a person the way Supabase Auth would — and **only** that.
 *
 * This used to insert the `public.accounts` row by hand on the next line, and that one helpful
 * line is what hid a defect for a whole sprint: in production nothing created that row at all,
 * so every test here ran against a database shaped differently from the real one. Migration
 * `0002` puts a trigger on `auth.users` where the invariant belongs, and removing the manual
 * insert is what makes these tests exercise the path production actually takes.
 *
 * If the trigger ever stops firing, the suite now says so loudly rather than papering over it:
 * half the cases below do nothing but read or write that row.
 */
export async function createUser(sql: Sql, email: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into auth.users (id, email) values (gen_random_uuid(), ${email}) returning id`;
  if (!row) throw new Error("auth.users insert returned no row");
  return row.id;
}

/**
 * Runs `body` as that person, exactly as a request from their browser would arrive: the
 * `authenticated` role, carrying their id as the `sub` claim.
 *
 * `set local` is why this is a transaction — it reverts on commit, so one test cannot leak its
 * identity into the next. And it has to be `authenticated` rather than the owner of the tables:
 * **a superuser and a table's owner both bypass row-level security**, so a test that forgot to
 * change role would pass while enforcing nothing. That is the one way this suite could lie, so
 * `asAnonymous` below exists to prove the role is doing the work.
 */
export async function asUser<T>(
  sql: Sql,
  userId: string,
  body: (tx: Sql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role authenticated`);
    await tx.unsafe(`set local request.jwt.claims = '${JSON.stringify({ sub: userId })}'`);
    return body(tx as unknown as Sql);
  }) as Promise<T>;
}

/** The same, with no claim at all: a visitor who has not signed in. */
export async function asAnonymous<T>(sql: Sql, body: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role authenticated`);
    return body(tx as unknown as Sql);
  }) as Promise<T>;
}
