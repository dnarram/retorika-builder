import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LOGO_CONTENT_TYPE,
  MAX_PHOTO_BYTES,
  PHOTO_CONTENT_TYPE,
  PHOTO_CONTENT_TYPES,
} from "../src/editor/downloadGate.ts";

/**
 * Two numbers that have to be one number, and a content type that has to be one content type.
 *
 * Since ADR 0037 a photograph is bounded in two places that never see each other: migration
 * `0003`'s bucket row, which decides what Supabase will store, and `downloadGate.ts`, which decides
 * what `/api/download` will bundle. **A photograph that can be stored and then not bundled is a
 * save that lied** — the owner is told it worked, and the download refuses it — which is exactly
 * the failure `MAX_PHOTOS` was moved into `downloadGate.ts` to stop in sprint 6.
 *
 * So this reads the SQL. A test that imported a constant from both sides would prove the two
 * constants agree with each other and nothing about the database; the SQL is what the database is
 * built from, so the SQL is what gets read.
 *
 * **It lives here and not in `packages/db`** because a package must never depend on an app, and
 * the numbers it checks belong to the editor. The path below is the only thing that crosses, and
 * it fails loudly if the migration is renamed.
 */

const MIGRATIONS = join(import.meta.dirname, "..", "..", "..", "packages", "db", "migrations");
const sql = readFileSync(join(MIGRATIONS, "0003-the-photos-bucket-and-its-policies.sql"), "utf8");
/** The row's types were rewritten once, by the migration that let the logo in (ADR 0059). */
const typesSql = readFileSync(
  join(MIGRATIONS, "0005-the-photos-bucket-admits-the-logo.sql"),
  "utf8",
);

describe("the bucket and the download agree about one photograph", () => {
  it("declares the same size cap the download route enforces", () => {
    // Written as a literal in the SQL, because a migration cannot import TypeScript. This is the
    // line that makes the literal safe to write.
    expect(sql).toContain(String(MAX_PHOTO_BYTES));
    expect(MAX_PHOTO_BYTES).toBe(2 * 1024 * 1024);
  });

  it("accepts only the content types the editor actually produces", () => {
    // `preparePhoto` re-encodes every upload through a canvas to JPEG whatever the picker
    // accepted, and `prepareLogo` to PNG (ADR 0059), so the bucket is narrower than the picker on
    // purpose. Changing an output format has to fail here rather than at somebody's upload. 0003
    // wrote the first list; 0005 rewrote it, and the rewrite is what the database has.
    expect(sql).toContain(`array['${PHOTO_CONTENT_TYPE}']`);
    expect(typesSql).toContain(
      `set allowed_mime_types = array['${PHOTO_CONTENT_TYPES.join("', '")}']`,
    );
    expect(typesSql).toMatch(/where id = 'fotos'/);
    expect(PHOTO_CONTENT_TYPE).toBe("image/jpeg");
    expect(LOGO_CONTENT_TYPE).toBe("image/png");
  });

  it("keeps the bucket private, because no published site ever reads from it", () => {
    // ADR 0001: a downloaded ZIP works with no server and no service of ours. A public bucket
    // would be a way for a published page to depend on us without anybody deciding that it should.
    expect(sql).toMatch(/values\s*\(\s*'fotos'\s*,\s*'fotos'\s*,\s*false/);
  });

  it("gives the owner all four verbs, and the anonymous role none", () => {
    // `update` is what replacing a photograph in a slot needs, and `delete` is what day 4's
    // reconciliation needs. Asserted by name so a policy dropped in a later edit is noticed here
    // as well as in the policy suite.
    for (const policy of [
      "fotos_select_own",
      "fotos_insert_own",
      "fotos_update_own",
      "fotos_delete_own",
    ]) {
      expect(sql, policy).toContain(policy);
    }
    expect(sql).not.toContain("to anon");
  });
});
