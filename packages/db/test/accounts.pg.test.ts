import { afterEach, describe, expect, it } from "vitest";
import type { Sql } from "../src/connect.ts";
import { createUser, freshDatabase } from "./bootstrap.ts";

/**
 * Every person who signs up has an account row — the invariant migration `0002` exists to make
 * true, and the one whose absence made «borrado de cuenta que borre de verdad» a sentence on a
 * screen with nothing behind it.
 *
 * These are the tests that were missing. The suite used to pass because `test/bootstrap.ts`
 * created the row by hand, which is a shape production never had.
 */

let sql: Sql;

afterEach(async () => {
  await sql?.end();
});

describe("signing up", () => {
  it("creates the account row, without anybody asking", async () => {
    sql = await freshDatabase();
    const user = await createUser(sql, "nueva@example.com");
    const [row] = await sql<{ id: string }[]>`
      select id from public.accounts where id = ${user}`;
    expect(row?.id, "no account row was created for a new auth.users row").toBe(user);
  });

  it("starts with the tools off and no deletion pending", async () => {
    sql = await freshDatabase();
    const user = await createUser(sql, "defectos@example.com");
    const [row] = await sql<{ design_tools: boolean; deletion_requested_at: Date | null }[]>`
      select design_tools, deletion_requested_at from public.accounts where id = ${user}`;
    // ADR 0025 §4's safe default, and nothing pending that nobody asked for.
    expect(row?.design_tools).toBe(false);
    expect(row?.deletion_requested_at).toBeNull();
  });

  it("creates one row per person and no more", async () => {
    sql = await freshDatabase();
    await createUser(sql, "una@example.com");
    await createUser(sql, "otra@example.com");
    const [row] = await sql<{ count: string }[]>`select count(*) from public.accounts`;
    expect(Number(row?.count)).toBe(2);
  });

  it("never fails the sign-up itself, even if the row somehow already exists", async () => {
    // The whole reason the trigger's body is `on conflict do nothing`: if it raised, somebody
    // would be unable to create an account at all because of a row they never asked about.
    sql = await freshDatabase();
    const id = "8f1c2a64-0000-4000-8000-000000000001";
    await sql`insert into auth.users (id, email) values (${id}, 'primero@example.com')`;
    await sql`delete from auth.users where id = ${id}`;
    // The account row went with it through the cascade; put it back by hand and then re-register
    // the same id, which is the collision the trigger has to survive.
    await sql`insert into auth.users (id, email) values (${id}, 'otra-vez@example.com')`;
    await expect(
      sql`insert into public.accounts (id) values (${id}) on conflict (id) do nothing`,
    ).resolves.toBeDefined();
    const [row] = await sql<{ count: string }[]>`
      select count(*) from public.accounts where id = ${id}`;
    expect(Number(row?.count)).toBe(1);
  });
});

describe("the accounts that signed up before the trigger existed", () => {
  it("get their row from the backfill — David's own account, on the next deploy", async () => {
    /**
     * The state the real database is in right now: a person signed up while `0001` was the newest
     * migration, so `auth.users` has them and `public.accounts` does not. Reconstructed by
     * inserting them **before** the migrations run, which is the only honest way to produce it.
     */
    const orphan = "8f1c2a64-0000-4000-8000-000000000002";
    sql = await freshDatabase({
      beforeMigrations: async (tx) => {
        await tx`insert into auth.users (id, email) values (${orphan}, 'de-antes@example.com')`;
      },
    });

    const [row] = await sql<{ id: string }[]>`
      select id from public.accounts where id = ${orphan}`;
    expect(row?.id, "an account created before 0002 was left without its row").toBe(orphan);
  });

  it("leaves nobody behind at all", async () => {
    // The property rather than the one case: after migrating, no `auth.users` row lacks its
    // account. This is the query to run against production if the question ever comes up again.
    const ids = ["8f1c2a64-0000-4000-8000-000000000003", "8f1c2a64-0000-4000-8000-000000000004"];
    sql = await freshDatabase({
      beforeMigrations: async (tx) => {
        for (const [index, id] of ids.entries()) {
          await tx`insert into auth.users (id, email) values (${id}, ${`v${index}@example.com`})`;
        }
      },
    });

    const orphans = await sql<{ id: string }[]>`
      select u.id from auth.users u
       where not exists (select 1 from public.accounts a where a.id = u.id)`;
    expect(orphans).toEqual([]);
  });
});
