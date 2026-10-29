import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Sql } from "../src/connect.ts";
import { asAnonymous, asUser, createUser, freshDatabase } from "./bootstrap.ts";

/**
 * «Solo ves tus propias fotos», asserted rather than reviewed — the sibling of
 * `policies.pg.test.ts` for the bucket migration `0003` creates (ADR 0037), and since sprint 29
 * día 6 for the `fuentes` bucket migration `0004` creates beside it (ADR 0056). **Every case runs
 * once per bucket**: the fonts' policies are the photographs' with the bucket changed, and a copy
 * that drifted — a missing `with check`, a policy over `owner_id` — is exactly what a suite run
 * over only one of them would never see.
 *
 * The object's name is `<owner uuid>/<site uuid>/<src>`, so every policy is one expression over
 * the first path segment. That makes the whole of «whose photograph is this» a property of the
 * name, which is cheap to enforce and cheap to get subtly wrong: a folder whose first segment
 * merely *starts with* somebody's id, a photograph moved into another person's folder by an
 * update, an owner column that says one thing while the path says another. Each of those is a case
 * below.
 *
 * Runs against a real Postgres, gated behind RETORIKA_DB=1 for the same reason the rest of this
 * directory is: a plain `pnpm test` must not need infrastructure it cannot start.
 */

let sql: Sql;
let alice: string;
let bob: string;
let aliceSite: string;
let bobSite: string;

/**
 * The two buckets, each with the file the editor would store first and the content types its
 * migration admits. Photographs: JPEG, because `preparePhoto` re-encodes every upload, and PNG
 * since migration `0005`, because the logo is one (ADR 0059; `photoCaps.test.ts` ties both to the
 * editor). Fonts: the four formats a face travels as and the two a licence may (`fontCaps.test.ts`
 * ties them to `FONT_MEDIA_TYPES`).
 */
const BUCKETS = [
  {
    bucket: "fotos",
    migration: "0003 (and 0005 for the types)",
    file: "foto-sec-cover-el-image.jpg",
    types: ["image/jpeg", "image/png"],
  },
  {
    bucket: "fuentes",
    migration: "0004",
    file: "propia-3f9a7c21-regular.woff2",
    types: ["font/woff2", "font/woff", "font/ttf", "font/otf", "text/plain", "application/pdf"],
  },
] as const;

/** The name the editor builds: owner, then site, then the document's own file name. */
function objectName(owner: string, site: string, file: string): string {
  return `${owner}/${site}/${file}`;
}

beforeAll(async () => {
  sql = await freshDatabase();
  alice = await createUser(sql, "alice@example.com");
  bob = await createUser(sql, "bob@example.com");
  aliceSite = "11111111-1111-4111-8111-111111111111";
  bobSite = "22222222-2222-4222-8222-222222222222";

  // Alice's own photograph and her own font, each stored as her browser would store it.
  for (const { bucket, file } of BUCKETS) {
    await asUser(
      sql,
      alice,
      (tx) => tx`
        insert into storage.objects (bucket_id, name, owner_id)
        values (${bucket}, ${objectName(alice, aliceSite, file)}, ${alice})`,
    );
  }
}, 60_000);

afterAll(async () => {
  await sql?.end();
});

describe.each(BUCKETS)("the $bucket bucket", ({ bucket, migration, file, types }) => {
  describe("the bucket itself", () => {
    it("is private, and carries the two caps the editor depends on", async () => {
      const [row] = await sql<
        { public: boolean; file_size_limit: string | number; allowed_mime_types: string[] }[]
      >`select public, file_size_limit, allowed_mime_types from storage.buckets where id = ${bucket}`;
      expect(row, `migration ${migration} did not create the bucket`).toBeDefined();
      if (!row) return;
      // Private: a published site never reads from here (ADR 0001), so the only reader is the editor
      // with the owner's own session.
      expect(row.public).toBe(false);
      // 2 MiB in both: `MAX_PHOTO_BYTES` and `MAX_FONT_BYTES` are each this number, and each has a
      // test in `apps/editor` that reads its migration and says so.
      expect(Number(row.file_size_limit)).toBe(2 * 1024 * 1024);
      expect(row.allowed_mime_types).toEqual(types);
    });
  });

  describe("a second person with a valid session of their own", () => {
    it("cannot see Alice's photograph", async () => {
      const rows = await asUser(
        sql,
        bob,
        (tx) =>
          tx`select name from storage.objects where name = ${objectName(alice, aliceSite, file)}`,
      );
      expect(rows).toHaveLength(0);
    });

    it("cannot list anything of Alice's, not even to learn her site ids", async () => {
      // The whole bucket, from Bob's side. A policy that leaked the names would leak the ids of
      // every site she has, which is what the second path segment is.
      const rows = await asUser(
        sql,
        bob,
        (tx) => tx`select name from storage.objects where bucket_id = ${bucket}`,
      );
      expect(rows).toHaveLength(0);
    });

    it("cannot write into Alice's folder", async () => {
      await expect(
        asUser(
          sql,
          bob,
          (tx) => tx`
          insert into storage.objects (bucket_id, name, owner_id)
          values (${bucket}, ${objectName(alice, aliceSite, `robada-${file}`)}, ${bob})`,
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("cannot write into Alice's folder by claiming to be her in the owner column", async () => {
      // The path is what the policy reads, so an `owner_id` that agrees with the folder changes
      // nothing. This is the case that would pass if a policy had been written over `owner_id`
      // instead — which is tempting, because the column is right there.
      await expect(
        asUser(
          sql,
          bob,
          (tx) => tx`
          insert into storage.objects (bucket_id, name, owner_id)
          values (${bucket}, ${objectName(alice, aliceSite, `suplantada-${file}`)}, ${alice})`,
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("cannot delete Alice's photograph", async () => {
      const rows = await asUser(
        sql,
        bob,
        (tx) => tx`
        delete from storage.objects where name = ${objectName(alice, aliceSite, file)} returning name`,
      );
      // No error and no row: a delete that matches nothing is not an error, which is exactly why the
      // assertion is on what came back. The row is still there afterwards, checked below.
      expect(rows).toHaveLength(0);
    });

    it("cannot rename Alice's photograph into his own folder", async () => {
      const rows = await asUser(
        sql,
        bob,
        (tx) => tx`
        update storage.objects set name = ${objectName(bob, bobSite, file)}
        where name = ${objectName(alice, aliceSite, file)} returning name`,
      );
      expect(rows).toHaveLength(0);
    });

    it("leaves Alice's photograph exactly where it was, after all of that", async () => {
      const rows = await asUser(
        sql,
        alice,
        (tx) => tx`select name from storage.objects where bucket_id = ${bucket}`,
      );
      expect(rows.map((row) => row.name)).toEqual([objectName(alice, aliceSite, file)]);
    });
  });

  describe("a folder that only looks like somebody else's", () => {
    it("is refused when the first segment merely starts with the writer's own id", async () => {
      /**
       * **Bob's own id with one character appended, which is nobody's folder.**
       *
       * The comparison is an equality, so this is refused. A policy written as
       * `like auth.uid()::text || '%'` would permit it, and that is worse than it sounds: the folder
       * belongs to no account, so Bob could fill the bucket with objects that the account purge —
       * which finds a person's objects by `(storage.foldername(name))[1] = <their id>`, day 5 — would
       * never see. Rubbish nobody can reach and nothing removes.
       *
       * **Written the other way round first, as Alice's id with a character appended, and the
       * sabotage is what caught it**: a prefix policy keyed on the *writer's* id refuses that one for
       * an unrelated reason, so the test passed against the broken policy and proved nothing. The
       * case a prefix match actually opens is the writer extending their own id, which is this one.
       */
      await expect(
        asUser(
          sql,
          bob,
          (tx) => tx`
          insert into storage.objects (bucket_id, name, owner_id)
          values (${bucket}, ${`${bob}x/${bobSite}/${file}`}, ${bob})`,
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("is refused when another person's folder is nested inside the writer's own", async () => {
      // The segment the policy reads is the first one, so a name that puts Alice's id second is
      // Bob's own folder and perfectly legitimate — but one that puts *his* id second and hers
      // first is hers, whatever follows. Both directions, because `foldername` returns every
      // segment and reading the wrong index would pass one of them.
      await expect(
        asUser(
          sql,
          bob,
          (tx) => tx`
          insert into storage.objects (bucket_id, name, owner_id)
          values (${bucket}, ${`${alice}/${bob}/${file}`}, ${bob})`,
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("is refused when there is no folder at all", async () => {
      // A bare file name has no segments, so `(storage.foldername(name))[1]` is null and the
      // comparison is null — which is not true, and a policy only permits what is true. This is the
      // shape a caller that forgot the prefix would send.
      await expect(
        asUser(
          sql,
          bob,
          (tx) => tx`
          insert into storage.objects (bucket_id, name, owner_id)
          values (${bucket}, ${file}, ${bob})`,
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  describe("the owner", () => {
    it("may not move a file of her own into somebody else's folder", async () => {
      /**
       * The row is hers, so the `update` policy's `using` lets her touch it; what refuses the new
       * name is checked against the row as it would be after. **Measured on 28 October 2026, it is
       * guarded twice**: by the policy's `with check`, and by Postgres checking the new row against
       * the `select` policy too, which it does whenever the statement reads the row (a `where`, a
       * `returning`). Weakening either one alone left this green; weakening both turned it red. So
       * this asserts the property, not one mechanism — and neither half may be dropped on the
       * strength of the other, because a statement that does not read the row has only the first.
       * Stored and moved inside one transaction, so a refusal leaves nothing behind.
       */
      const name = objectName(alice, aliceSite, `movida-${file}`);
      await expect(
        asUser(sql, alice, async (tx) => {
          await tx`
            insert into storage.objects (bucket_id, name, owner_id)
            values (${bucket}, ${name}, ${alice})`;
          return tx`
            update storage.objects set name = ${objectName(bob, bobSite, `movida-${file}`)}
            where name = ${name}`;
        }),
      ).rejects.toThrow(/row-level security/i);
    });

    it("may store, read, replace and remove a photograph of her own", async () => {
      const name = objectName(alice, aliceSite, `segunda-${file}`);
      await asUser(
        sql,
        alice,
        (tx) => tx`
        insert into storage.objects (bucket_id, name, owner_id)
        values (${bucket}, ${name}, ${alice})`,
      );
      const read = await asUser(
        sql,
        alice,
        (tx) => tx`select name from storage.objects where name = ${name}`,
      );
      expect(read).toHaveLength(1);

      // Replacing a photograph in a slot writes the same key — `photoSrcFor` is stable per slot on
      // purpose — so `update` is a verb the owner needs and not a nicety.
      const replaced = await asUser(
        sql,
        alice,
        (tx) => tx`
        update storage.objects set updated_at = now() where name = ${name} returning name`,
      );
      expect(replaced).toHaveLength(1);

      // And removing one, which is what day 4's reconciliation does when a section is deleted.
      const removed = await asUser(
        sql,
        alice,
        (tx) => tx`delete from storage.objects where name = ${name} returning name`,
      );
      expect(removed).toHaveLength(1);
    });

    it("may not store a photograph in a bucket this migration did not create", async () => {
      // Every policy names its own bucket (`bucket_id = 'fotos'`, `= 'fuentes'`), so a bucket
      // somebody adds later is not covered by them — it has no policies at all, which means no
      // access, rather than inheriting these.
      await sql`
      insert into storage.buckets (id, name, public) values ('otro', 'otro', false)
      on conflict (id) do nothing`;
      await expect(
        asUser(
          sql,
          alice,
          (tx) => tx`
          insert into storage.objects (bucket_id, name, owner_id)
          values ('otro', ${objectName(alice, aliceSite, file)}, ${alice})`,
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  describe("a visitor who has not signed in", () => {
    it("sees nothing, because there is no folder that is theirs", async () => {
      // The same test `policies.pg.test.ts` keeps for `public.sites`, and for the same reason: it is
      // what proves `auth.uid()` returning null is handled rather than throwing, and that the role
      // is doing the work instead of a table owner's bypass.
      const rows = await asAnonymous(
        sql,
        (tx) => tx`select name from storage.objects where bucket_id = ${bucket}`,
      );
      expect(rows).toHaveLength(0);
    });

    it("cannot store anything", async () => {
      await expect(
        asAnonymous(
          sql,
          (tx) => tx`
          insert into storage.objects (bucket_id, name) values (${bucket}, ${`cualquiera/cosa/${file}`})`,
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });
});
