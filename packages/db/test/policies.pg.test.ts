import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, SCHEMA_VERSION } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sql } from "../src/connect.ts";
import { asAnonymous, asUser, createUser, freshDatabase } from "./bootstrap.ts";

/**
 * «Solo ves tus propias webs», asserted rather than reviewed.
 *
 * This is the suite ADR 0034 §7 exists for, and the reason Supabase was chosen over hand-rolled
 * authentication: the rule lives in the database, so it can be tested as the database. Every case
 * here is a thing a second person's browser could try with a perfectly valid session of their own.
 *
 * It runs against a real Postgres, gated behind RETORIKA_DB=1 for the same reason `test:a11y` and
 * `e2e` are gated: a plain `pnpm test` must not need infrastructure it cannot start.
 */

let sql: Sql;
let alice: string;
let bob: string;
let aliceSite: string;

const document = () =>
  JSON.parse(
    readFileSync(
      join(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "fixtures",
        "documents",
        "cover-and-services.json",
      ),
      "utf8",
    ),
  );

beforeAll(async () => {
  sql = await freshDatabase();
  alice = await createUser(sql, "alice@example.com");
  bob = await createUser(sql, "bob@example.com");

  const [row] = await asUser(
    sql,
    alice,
    (tx) =>
      tx<{ id: string }[]>`
      insert into public.sites (owner_id, name, document, schema_version)
      values (${alice}, 'La web de Alice', ${sql.json(document())}, ${SCHEMA_VERSION})
      returning id`,
  );
  if (!row) throw new Error("Alice could not insert her own site");
  aliceSite = row.id;
}, 60_000);

afterAll(async () => {
  await sql?.end();
});

describe("a second person with a valid session of their own", () => {
  it("cannot read Alice's site", async () => {
    const rows = await asUser(
      sql,
      bob,
      (tx) => tx`select id from public.sites where id = ${aliceSite}`,
    );
    expect(rows).toHaveLength(0);
  });

  it("cannot list it among their own", async () => {
    const rows = await asUser(sql, bob, (tx) => tx`select id from public.sites`);
    expect(rows).toHaveLength(0);
  });

  it("cannot update it — the row simply is not there to update", async () => {
    const result = await asUser(
      sql,
      bob,
      (tx) => tx`update public.sites set name = 'secuestrada' where id = ${aliceSite}`,
    );
    expect(result.count).toBe(0);

    // And it is unchanged when its owner looks.
    const [row] = await asUser(
      sql,
      alice,
      (tx) => tx<{ name: string }[]>`select name from public.sites where id = ${aliceSite}`,
    );
    expect(row?.name).toBe("La web de Alice");
  });

  it("cannot delete it", async () => {
    const result = await asUser(
      sql,
      bob,
      (tx) => tx`delete from public.sites where id = ${aliceSite}`,
    );
    expect(result.count).toBe(0);
    const rows = await asUser(
      sql,
      alice,
      (tx) => tx`select id from public.sites where id = ${aliceSite}`,
    );
    expect(rows).toHaveLength(1);
  });

  it("cannot create a site owned by somebody else", async () => {
    await expect(
      asUser(
        sql,
        bob,
        (tx) => tx`
          insert into public.sites (owner_id, name, document, schema_version)
          values (${alice}, 'regalo envenenado', ${sql.json(document())}, ${SCHEMA_VERSION})`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("cannot read Alice's account row", async () => {
    const rows = await asUser(
      sql,
      bob,
      (tx) => tx`select id from public.accounts where id = ${alice}`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe("the owner", () => {
  it("cannot hand a site to somebody else by rewriting owner_id", async () => {
    // The transfer of ownership is the advanced dossier §8 and happens on a delivery screen with
    // a decision behind it. It is not an UPDATE, and the `with check` is what makes that true.
    await expect(
      asUser(
        sql,
        alice,
        (tx) => tx`update public.sites set owner_id = ${bob} where id = ${aliceSite}`,
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("reads back exactly the document that was stored", async () => {
    const [row] = await asUser(
      sql,
      alice,
      (tx) => tx<{ document: unknown; schema_version: string }[]>`
        select document, schema_version from public.sites where id = ${aliceSite}`,
    );
    expect(row?.schema_version).toBe(SCHEMA_VERSION);
    // The proof that storing it whole loses nothing: it goes back through the same gate every
    // document passes through, and that gate runs the invariants.
    expect(() => parseDocument(row?.document)).not.toThrow();
    expect(parseDocument(row?.document)).toEqual(parseDocument(document()));
  });
});

describe("a visitor who has not signed in", () => {
  it("sees no sites at all", async () => {
    const rows = await asAnonymous(sql, (tx) => tx`select id from public.sites`);
    expect(rows).toHaveLength(0);
  });

  // This is the test that proves the suite is not lying. A superuser and a table's owner both
  // bypass row-level security, so if `asUser` had forgotten to change role, every assertion above
  // would pass while enforcing nothing — and this one would fail, because without a claim the
  // policies deny everything.
  it("cannot read a site even by naming its id", async () => {
    const rows = await asAnonymous(
      sql,
      (tx) => tx`select id from public.sites where id = ${aliceSite}`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe("the audit log", () => {
  it("cannot be written from a browser at all", async () => {
    await expect(
      asUser(
        sql,
        bob,
        (tx) => tx`insert into public.audit_log (operation, actor_id) values ('payment', ${bob})`,
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it("cannot be edited or erased, which is what makes it a log", async () => {
    await sql`
      insert into public.audit_log (operation, actor_id, site_id)
      values ('publication', ${alice}, ${aliceSite})`;

    await expect(
      asUser(sql, alice, (tx) => tx`update public.audit_log set operation = 'payment'`),
    ).rejects.toThrow(/permission denied/i);
    await expect(asUser(sql, alice, (tx) => tx`delete from public.audit_log`)).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("lets a person read what was recorded about them, and nothing about anyone else", async () => {
    const mine = await asUser(sql, alice, (tx) => tx`select operation from public.audit_log`);
    expect(mine).toHaveLength(1);
    const theirs = await asUser(sql, bob, (tx) => tx`select operation from public.audit_log`);
    expect(theirs).toHaveLength(0);
  });

  it("keeps a publication with no actor, because the download needs no session", async () => {
    // Part 16's first rule, and ADR 0034 §18: the export works even with no account at all. So a
    // null actor is a real value here, not a missing one.
    await sql`insert into public.audit_log (operation, site_id) values ('publication', ${aliceSite})`;
    const [row] = await sql<{ count: string }[]>`
      select count(*) from public.audit_log where actor_id is null`;
    expect(Number(row?.count)).toBe(1);
  });

  it("outlives the site it describes", async () => {
    const [site] = await asUser(
      sql,
      alice,
      (tx) => tx<{ id: string }[]>`
        insert into public.sites (owner_id, name, document, schema_version)
        values (${alice}, 'efímera', ${sql.json(document())}, ${SCHEMA_VERSION}) returning id`,
    );
    if (!site) throw new Error("the ephemeral site was not created");
    await sql`insert into public.audit_log (operation, actor_id, site_id) values ('publication', ${alice}, ${site.id})`;
    await asUser(sql, alice, (tx) => tx`delete from public.sites where id = ${site.id}`);

    const rows = await sql<{ site_id: string | null }[]>`
      select site_id from public.audit_log where actor_id = ${alice} and site_id is null`;
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe("the stale write ADR 0034 §8 refuses", () => {
  it("refuses a second write that carried the version the first one replaced", async () => {
    const [before] = await asUser(
      sql,
      alice,
      (tx) => tx<{ version: number }[]>`select version from public.sites where id = ${aliceSite}`,
    );
    const read = before?.version ?? 0;

    const first = await asUser(
      sql,
      alice,
      (tx) => tx`
        update public.sites set name = 'primera', version = version + 1
        where id = ${aliceSite} and version = ${read}`,
    );
    expect(first.count).toBe(1);

    // The second tab writes with the version it read before the first one landed.
    const second = await asUser(
      sql,
      alice,
      (tx) => tx`
        update public.sites set name = 'segunda', version = version + 1
        where id = ${aliceSite} and version = ${read}`,
    );
    expect(second.count).toBe(0);

    const [row] = await asUser(
      sql,
      alice,
      (tx) => tx<{ name: string }[]>`select name from public.sites where id = ${aliceSite}`,
    );
    expect(row?.name).toBe("primera");
  });
});
