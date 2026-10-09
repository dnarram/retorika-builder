import { SCHEMA_VERSION } from "@retorika/schema";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { Sql } from "../src/connect.ts";
import {
  cancelDeletion,
  dueForDeletion,
  exportAccount,
  GRACE_WINDOW_DAYS,
  purgeAccountData,
  purgeDueAccounts,
  requestDeletion,
} from "../src/deletion.ts";
import { photoObjectCountOf, photoObjectsOf, type RemoveObjects } from "../src/photos.ts";
import { asUser, createUser, freshDatabase } from "./bootstrap.ts";

/**
 * «Borrado de cuenta que borre de verdad, con una ventana de gracia razonable» — the one clause in
 * the protocol written specifically about accounts, asserted against a real database.
 *
 * The way to prove something was deleted is to go looking for it and not find it, which is what
 * every case below does.
 *
 * **The photographs are the one part that is not a row** (ADR 0037), so what is asserted about them
 * here is the sweep's decisions rather than the bytes: which paths it asks for, that it asks
 * **before** it ends the account, and that a remover which refuses leaves the account standing. The
 * remover is a function the caller provides, so a test can hand in one that records — or one that
 * throws — and the bucket itself never enters.
 */

/** A remover that records what it was asked to delete. The sweep's own decisions are what these
 * cases are about, so this is all the bucket they need. */
function recordingRemover(): { remove: RemoveObjects; asked: string[][] } {
  const asked: string[][] = [];
  return {
    remove: async (paths) => {
      asked.push([...paths]);
    },
    asked,
  };
}

/** One that refuses, for the case where the bucket is unreachable. */
const refusingRemover: RemoveObjects = async () => {
  throw new Error("storage is unreachable");
};

/** Stores a photograph the way the editor would: `<owner>/<site>/<src>` in the `fotos` bucket. */
async function withPhoto(owner: string, site: string, src = "foto-sec-cover-el-image.jpg") {
  await sql`
    insert into storage.objects (bucket_id, name, owner_id)
    values ('fotos', ${`${owner}/${site}/${src}`}, ${owner})`;
  return `${owner}/${site}/${src}`;
}

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
    const result = await purgeAccountData(sql, user, recordingRemover().remove);
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
    await purgeAccountData(sql, leaving, recordingRemover().remove);

    const [row] = await sql<{ count: string }[]>`
      select count(*) from public.sites where owner_id = ${staying}`;
    expect(Number(row?.count)).toBe(1);
  });

  it("records that it happened, and keeps the fact without keeping the person", async () => {
    const user = await withSite("registro@example.com");
    await purgeAccountData(sql, user, recordingRemover().remove);
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

    await expect(purgeAccountData(sql, user, recordingRemover().remove)).rejects.toThrow(
      /refused on purpose/,
    );

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

describe("the sweep, which is what makes «borre de verdad» true", () => {
  /**
   * `dueForDeletion` and `purgeAccountData` shipped in sprint 15 and **nothing ever called them**
   * — no route, no script, no job. So a window could run out and nothing happened. These are the
   * tests for the sweep that closes that, and the first one is the only one that really matters:
   * afterwards, there is nothing left to sign in with.
   */
  async function overdue(email: string): Promise<string> {
    const user = await withSite(email);
    await requestDeletion(sql, user);
    await sql`
      update public.accounts
         set deletion_requested_at = now() - make_interval(days => ${GRACE_WINDOW_DAYS + 1})
       where id = ${user}`;
    return user;
  }

  it("does nothing at all without confirmation, and says who it would have ended", async () => {
    const user = await overdue("ensayo@example.com");
    const result = await purgeDueAccounts(sql);

    expect(result.due).toEqual([user]);
    expect(result.ended).toEqual([]);
    // The default is a look, not a deletion. Everything is still there.
    const [sites] = await sql<{ count: string }[]>`
      select count(*) from public.sites where owner_id = ${user}`;
    const [users] = await sql<{ count: string }[]>`
      select count(*) from auth.users where id = ${user}`;
    expect(Number(sites?.count)).toBe(1);
    expect(Number(users?.count)).toBe(1);
  });

  it("ends the account for real: no site, no account row, and nothing to sign in with", async () => {
    const user = await overdue("adios-de-verdad@example.com");
    const result = await purgeDueAccounts(sql, {
      confirm: true,
      removeObjects: recordingRemover().remove,
    });

    expect(result.ended).toEqual([user]);
    expect(result.sitesDeleted).toBe(1);

    // Every table that held them, asked one by one. Going to look and not finding it is the only
    // way to prove a deletion happened.
    for (const table of ["public.sites", "public.accounts", "auth.users"]) {
      const [row] = await sql.unsafe<{ count: string }[]>(
        `select count(*) from ${table} where ${table === "public.sites" ? "owner_id" : "id"} = $1`,
        [user],
      );
      expect(Number(row?.count), `${table} still has the account`).toBe(0);
    }
  });

  it("leaves an account whose window has not run out completely alone", async () => {
    const leaving = await overdue("se-va@example.com");
    const staying = await withSite("se-queda@example.com");
    await requestDeletion(sql, staying); // asked, but only just now

    const result = await purgeDueAccounts(sql, {
      confirm: true,
      removeObjects: recordingRemover().remove,
    });
    expect(result.ended).toEqual([leaving]);

    const [row] = await sql<{ count: string }[]>`
      select count(*) from auth.users where id = ${staying}`;
    expect(Number(row?.count)).toBe(1);
  });

  it("touches nobody who never asked", async () => {
    const quiet = await withSite("tranquila@example.com");
    const result = await purgeDueAccounts(sql, {
      confirm: true,
      removeObjects: recordingRemover().remove,
    });
    expect(result.due).toEqual([]);
    expect(result.ended).toEqual([]);
    const [row] = await sql<{ count: string }[]>`
      select count(*) from public.sites where owner_id = ${quiet}`;
    expect(Number(row?.count)).toBe(1);
  });

  it("keeps the record of each ending, with the fact and not the person", async () => {
    await overdue("registrada@example.com");
    await purgeDueAccounts(sql, { confirm: true, removeObjects: recordingRemover().remove });

    const rows = await sql<{ operation: string; actor_id: string | null; detail: unknown }[]>`
      select operation, actor_id, detail from public.audit_log`;
    expect(rows).toHaveLength(1);
    expect(rows[0]?.operation).toBe("account_deleted");
    // The actor was set when the row was written and nulled by the cascade a statement later.
    expect(rows[0]?.actor_id).toBeNull();
    // And the log distinguishes an ending from a mere data purge.
    expect(rows[0]?.detail).toMatchObject({ endedTheAccount: true });
  });

  it("ends several in one run, and each one on its own", async () => {
    const first = await overdue("una@example.com");
    const second = await overdue("dos@example.com");
    const result = await purgeDueAccounts(sql, {
      confirm: true,
      removeObjects: recordingRemover().remove,
    });
    expect(result.ended.sort()).toEqual([first, second].sort());
    expect(result.sitesDeleted).toBe(2);
    const [row] = await sql<{ count: string }[]>`select count(*) from auth.users`;
    expect(Number(row?.count)).toBe(0);
  });

  it("marks a mere data purge as not having ended the account", async () => {
    // `purgeAccountData` is the other half of the pair and must stay distinguishable in the log:
    // it forgets the data and leaves the person able to sign in.
    const user = await withSite("solo-datos@example.com");
    await purgeAccountData(sql, user, recordingRemover().remove);
    const [row] = await sql<{ detail: unknown }[]>`select detail from public.audit_log`;
    expect(row?.detail).toMatchObject({ endedTheAccount: false });
    const [users] = await sql<{ count: string }[]>`
      select count(*) from auth.users where id = ${user}`;
    expect(Number(users?.count)).toBe(1);
  });
});

describe("the photographs, which are the one part that is not a row (ADR 0037)", () => {
  it("finds every object of one account and none of anybody else's", async () => {
    const alice = await withSite("alice-fotos@example.com");
    const bob = await withSite("bob-fotos@example.com");
    const site = "11111111-1111-4111-8111-111111111111";
    const mine = await withPhoto(alice, site);
    await withPhoto(alice, site, "foto-sec-gallery-el-item-1-photo.jpg");
    await withPhoto(bob, "22222222-2222-4222-8222-222222222222");

    const found = await photoObjectsOf(sql, alice);
    expect(found).toHaveLength(2);
    expect(found).toContain(mine);
    for (const path of found) expect(path.startsWith(`${alice}/`)).toBe(true);
    expect(await photoObjectCountOf(sql, alice)).toBe(2);
    // The sweep runs with a connection that bypasses row-level security, so the `where` clause is
    // the only thing scoping this. That is why it is asserted rather than assumed.
    expect(await photoObjectCountOf(sql, bob)).toBe(1);
  });

  it("asks the remover for exactly this account's objects, before ending it", async () => {
    const user = await withSite("con-fotos@example.com");
    const path = await withPhoto(user, "33333333-3333-4333-8333-333333333333");
    await requestDeletion(sql, user);
    await sql`
      update public.accounts
         set deletion_requested_at = now() - make_interval(days => ${GRACE_WINDOW_DAYS + 1})
       where id = ${user}`;

    const remover = recordingRemover();
    const result = await purgeDueAccounts(sql, { confirm: true, removeObjects: remover.remove });

    expect(result.ended).toEqual([user]);
    expect(result.photosDeleted).toBe(1);
    expect(result.skipped).toEqual([]);
    expect(remover.asked).toEqual([[path]]);
  });

  it("skips an account whose photographs could not be removed, and ends the others", async () => {
    /**
     * **The order, and what it buys.** The objects go first and a refusal skips the account, so a
     * failure leaves an account that is past its window with some photographs gone — which the
     * next run finishes. The other order would end the account and leave the files with nothing
     * left that remembers whose they were: the only handle is the owner id in the path, and the row
     * holding that id would be gone.
     *
     * One refusal must not stop the sweep either: the account with no photographs is ended in the
     * same run, because it has nothing the bucket could refuse.
     */
    const withPhotos = await withSite("falla@example.com");
    await withPhoto(withPhotos, "44444444-4444-4444-8444-444444444444");
    const withoutPhotos = await withSite("sin-fotos@example.com");
    for (const id of [withPhotos, withoutPhotos]) {
      await requestDeletion(sql, id);
      await sql`
        update public.accounts
           set deletion_requested_at = now() - make_interval(days => ${GRACE_WINDOW_DAYS + 1})
         where id = ${id}`;
    }

    const result = await purgeDueAccounts(sql, {
      confirm: true,
      removeObjects: refusingRemover,
    });

    expect(result.skipped.map((entry) => entry.userId)).toEqual([withPhotos]);
    expect(result.skipped[0]?.reason).toMatch(/unreachable/);
    expect(result.ended).toEqual([withoutPhotos]);

    // Still there, with its site and its account row, for the next run to try again.
    const [account] = await sql<{ count: string }[]>`
      select count(*) from public.accounts where id = ${withPhotos}`;
    expect(Number(account?.count), "a skipped account was ended anyway").toBe(1);
    const [site] = await sql<{ count: string }[]>`
      select count(*) from public.sites where owner_id = ${withPhotos}`;
    expect(Number(site?.count)).toBe(1);
    const [authUser] = await sql<{ count: string }[]>`
      select count(*) from auth.users where id = ${withPhotos}`;
    expect(Number(authUser?.count)).toBe(1);
    // And no audit row claiming it ended.
    const [audit] = await sql<{ count: string }[]>`
      select count(*) from public.audit_log where actor_id = ${withPhotos}`;
    expect(Number(audit?.count)).toBe(0);
  });

  it("refuses a confirmed sweep that was given no way to remove them", async () => {
    /**
     * Carrying on without a remover is the one outcome nobody can repair: the account is gone, so
     * nothing records whose bytes those were, and no later sweep can find an owner who no longer
     * exists. A caller that reaches this has forgotten something, and finding out now is cheaper
     * than finding out from the storage bill.
     */
    const user = await withSite("sin-remover@example.com");
    await requestDeletion(sql, user);
    await sql`
      update public.accounts
         set deletion_requested_at = now() - make_interval(days => ${GRACE_WINDOW_DAYS + 1})
       where id = ${user}`;

    await expect(purgeDueAccounts(sql, { confirm: true })).rejects.toThrow(/removeObjects/);

    const [account] = await sql<{ count: string }[]>`
      select count(*) from public.accounts where id = ${user}`;
    expect(Number(account?.count), "the refusal still ended somebody").toBe(1);
  });

  it("still lists who is due without a remover, because a dry run deletes nothing", async () => {
    // The look must stay safe and must stay possible: `--confirm` is what needs the key, not the
    // question «who is past the window».
    const user = await withSite("ensayo@example.com");
    await requestDeletion(sql, user);
    await sql`
      update public.accounts
         set deletion_requested_at = now() - make_interval(days => ${GRACE_WINDOW_DAYS + 1})
       where id = ${user}`;

    const result = await purgeDueAccounts(sql);
    expect(result.due).toEqual([user]);
    expect(result.ended).toEqual([]);
    expect(result.photosDeleted).toBe(0);
  });

  it("removes the objects of an account whose data is forgotten without ending it", async () => {
    // `purgeAccountData` is the other half of the pair. It leaves the login alone, and it must not
    // leave the photographs either.
    const user = await withSite("solo-datos@example.com");
    const path = await withPhoto(user, "55555555-5555-4555-8555-555555555555");
    const remover = recordingRemover();
    const result = await purgeAccountData(sql, user, remover.remove);
    expect(result.photosDeleted).toBe(1);
    expect(remover.asked).toEqual([[path]]);
  });
});
