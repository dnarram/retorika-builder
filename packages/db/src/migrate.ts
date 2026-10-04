import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "./connect.ts";

/**
 * The migration runner.
 *
 * Numbered SQL files, applied in order, each in its own transaction, each recorded so it is
 * applied once. The same shape as `packages/schema/migrations/`, which numbers and documents the
 * document's own migrations — one convention in this repository, not two.
 *
 * The SQL is the source of truth for these tables, for the reason the first migration's header
 * gives: the row-level security policies are the half that matters, and a generator that emits
 * tables but not policies would leave them hand-written anyway.
 */

const DIR = join(import.meta.dirname, "..", "migrations");

export interface Migration {
  id: string;
  sql: string;
}

/** The migrations on disk, in the order their names sort. */
export function migrations(dir: string = DIR): Migration[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql") && !name.endsWith(".down.sql"))
    .sort()
    .map((name) => ({
      id: name.replace(/\.sql$/, ""),
      sql: readFileSync(join(dir, name), "utf8"),
    }));
}

/**
 * Applies whatever has not been applied, and returns the ids it applied.
 *
 * A half-applied migration is one of the four cases `docs/runbook.md` has to describe (protocol
 * Part 17), so each file runs inside a transaction: it lands whole or not at all, and the ledger
 * row is written in the same transaction as the statements it describes. A file that fails leaves
 * no ledger row, so the next run retries it rather than skipping it.
 */
export async function migrate(sql: Sql, dir: string = DIR): Promise<string[]> {
  await sql`
    create table if not exists public.schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )`;

  const applied = new Set(
    (await sql<{ id: string }[]>`select id from public.schema_migrations`).map((r) => r.id),
  );

  const ran: string[] = [];
  for (const migration of migrations(dir)) {
    if (applied.has(migration.id)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(migration.sql);
      await tx`insert into public.schema_migrations (id) values (${migration.id})`;
    });
    ran.push(migration.id);
  }
  return ran;
}
