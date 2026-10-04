import { SCHEMA_VERSION } from "@retorika/schema";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "../src/connect.ts";
import {
  cancelDeletion,
  dueForDeletion,
  exportAccount,
  GRACE_WINDOW_DAYS,
  purgeAccountData,
  requestDeletion,
} from "../src/deletion.ts";
import { asUser, createUser, freshDatabase } from "./bootstrap.ts";

/**
 * «Borrado de cuenta que borre de verdad, con una ventana de gracia razonable» — the one clause in
 * the protocol written specifically about accounts, asserted against a real database.
 *
 * The way to prove something was deleted is to go looking for it and not find it, which is what
 * every case below does. The one step these cannot cover is removing the Supabase Auth user, which
 * needs the admin API and the service key; `deletion.ts` says so and the runbook names it.
 */

let sql: Sql;

beforeEach(async () => {
  sql = await freshDatabase();
}, 60_000);

afterAll(async () => {
  await sql?.end();
});

async function withSite(email: string): Promise<string> {
  const id = await createUser(sql, email);
  await asUser(
    sql,
    id,
    (tx) =>
      tx`insert into public.sites (owner_id, name, document, schema_version)
       values (${id}, 'La web', '{"siteName":"La web"}'::jsonb, ${SCHEMA_VERSION})`,
  );
  return id;
}

describe("asking for the account to be deleted", () => {
  it("records when it was asked, and nothing is gone yet", async () => {
    const user = await withSite("va@example.com");
    const { requestedAt } = await requestDeletion(sql, user);
    expect(requestedAt).toBeInstanceOf(Date);

    // The grace window is a window, not a delay before a confirmation: the site is still there.
    const [row] = await sql<{ count: string }[]>`
      select count(*) from public.sites where owner_id = ${user}`;
    expect(Number(row?.count)).toBe(1);
  });

  it("does not restart the clock when asked twice", async () => {
    // Somebody who clicks it again a week later meant the first click, and restarting the window
    // would quietly give them thirty more days they did not ask for.
    const user = await withSite("dos@example.com");
    const first = await requestDeletion(sql, user);
    await sql`update public.accounts set deletion_requested_at = now() - interval '10 days' where id = ${user}`;
    const second = await requestDeletion(sql, user);
    expect(second.requestedAt.getTime()).toBeLessThan(first.requestedAt.getTime());
  });

  it("can be changed back, which is the entire point of a window", async () => {
    const user = await withSite("vuelta@example.com");
    await requestDeletion(sql, user);
    await cancelDeletion(sql, user);
    const [row] = await sql<{ deletion_requested_at: Date | null }[]>`
      select deletion_requested_at from public.accounts where id = ${user}`;
    expect(row?.deletion_requested_at).toBeNull();
  });
});

describe("the window, which is 30 days", () => {
  it("is the number ADR 0034 §12 chose", () => {
    expect(GRACE_WINDOW_DAYS).toBe(30);
  });

  it("leaves an account alone one day before it runs out", async () => {
    const user = await withSite("casi@example.com");
    await requestDeletion(sql, user);
    await sql`
      update public.accounts
         set deletion_requested_at = now() - make_interval(days => ${GRACE_WINDOW_DAYS - 1})
       where id = ${user}`;
    expect(await dueForDeletion(sql)).toEqual([]);
  });

  it("picks it up one day after", async () => {
    const user = await withSite("pasado@example.com");
    await requestDeletion(sql, user);
    await sql`
      update public.accounts
         set deletion_requested_at = now() - make_interval(days => ${GRACE_WINDOW_DAYS + 1})
       where id = ${user}`;
    expect(await dueForDeletion(sql)).toEqual([user]);
  });

  it("never picks up an account that did not ask", async () => {
    await withSite("tranquila@example.com");
    expect(await dueForDeletion(sql)).toEqual([]);
  });
});

describe("the purge itself", () => {
  it("leaves no site and no account row behind", async () => {
    const user = await withSite("adios@example.com");
    const result = await purgeAccountData(sql, user);
    expect(result.sitesDeleted).toBe(1);

    const [sites] = await sql<{ count: string }[]>`
      select count(*) from public.sites where owner_id = ${user}`;
    const [accounts] = await sql<{ count: string }[]>`
      select count(*) from public.accounts where id = ${user}`;
    expect(Number(sites?.count)).toBe(0);
    expect(Number(accounts?.count)).toBe(0);
  });

  it("touches nobody else's account", async () => {
    const leaving = await withSite("se-va@example.com");
    const staying = await withSite("se-queda@example.com");
    await purgeAccountData(sql, leaving);

    const [row] = await sql<{ count: string }[]>`
      select count(*) from public.sites where owner_id = ${staying}`;
    expect(Number(row?.count)).toBe(1);
  });

  it("records that it happened, and keeps the fact without keeping the person", async () => {
    const user = await withSite("registro@example.com");
    await purgeAccountData(sql, user);
    // Written before the delete, then stripped of its actor by the cascade. Part 17 wants the
    // «quién»; Part 15 wants a real deletion. Part 15 wins and the row keeps the event.
    await sql`delete from auth.users where id = ${user}`;
    const rows = await sql<{ operation: string; actor_id: string | null }[]>`
      select operation, actor_id from public.audit_log where operation = 'account_deleted'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.actor_id).toBeNull();
  });

  it("is all or nothing", async () => {
    /**
     * The audit insert and both deletes share one transaction, so a failure cannot leave an
     * account with no sites — which would be the «migración a medias» case wearing another hat.
     *
     * **This test started by passing an invalid uuid, and it proved nothing.** That failed on the
     * cast in the *first* statement, so nothing had happened yet and removing the transaction
     * changed no outcome — the sabotage run is what exposed it. To test atomicity the failure has
     * to come *after* something succeeded, so a trigger refuses the last of the three statements.
     */
    const user = await withSite("atomica@example.com");
    await sql.unsafe(`
      create or replace function refuse_account_delete() returns trigger
        language plpgsql as $fn$ begin raise exception 'refused on purpose'; end $fn$;
      create trigger refuse_delete before delete on public.accounts
        for each row execute function refuse_account_delete();
    `);

    await expect(purgeAccountData(sql, user)).rejects.toThrow(/refused on purpose/);

    // The sites delete had already succeeded when the accounts delete raised. If these three
    // statements were not one transaction, the sites would be gone and the audit row would stand.
    const [sites] = await sql<{ count: string }[]>`
      select count(*) from public.sites where owner_id = ${user}`;
    expect(Number(sites?.count), "a site was deleted by a purge that failed").toBe(1);
    const [audit] = await sql<{ count: string }[]>`select count(*) from public.audit_log`;
    expect(Number(audit?.count), "an audit row survived a purge that failed").toBe(0);
  });
});

describe("the export that has to work first", () => {
  it("hands back every site with the version it was written at", async () => {
    const user = await withSite("export@example.com");
    const exported = await exportAccount(sql, user);
    expect(exported.sites).toHaveLength(1);
    expect(exported.sites[0]?.schemaVersion).toBe(SCHEMA_VERSION);
    expect(exported.sites[0]?.document).toEqual({ siteName: "La web" });
  });

  it("works while a deletion is already pending, because Part 16 says it always works", async () => {
    // «La exportación siempre funciona, incluso con la cuenta caducada o en disputa», and that
    // rule beats everything else in ADR 0034 if they ever collide.
    const user = await withSite("en-disputa@example.com");
    await requestDeletion(sql, user);
    await sql`
      update public.accounts
         set deletion_requested_at = now() - make_interval(days => ${GRACE_WINDOW_DAYS + 5})
       where id = ${user}`;
    expect((await exportAccount(sql, user)).sites).toHaveLength(1);
  });
});
