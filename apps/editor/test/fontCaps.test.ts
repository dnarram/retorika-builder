import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FONT_MEDIA_TYPES, MAX_FONT_BYTES, MAX_LICENCE_BYTES } from "../src/editor/fontBytes.ts";
import { fontFileType } from "../src/editor/ownFonts.ts";

/**
 * Two numbers that have to be one number, and a list of content types that has to be one list —
 * `photoCaps.test.ts` for the owner's own fonts (sprint 29 día 6, ADR 0056).
 *
 * A face is bounded where the import refuses it, where `/api/download` refuses a `font` part, and
 * where migration `0004`'s bucket refuses to store it. **A font that can be stored and then not
 * bundled is a save that lied**, so this reads the SQL — a migration cannot import TypeScript, and
 * the SQL is what the database is built from.
 *
 * Here and not in `packages/db`, because a package must never depend on an app.
 */

const MIGRATION = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "packages",
  "db",
  "migrations",
  "0004-the-fonts-bucket-and-its-policies.sql",
);

const sql = readFileSync(MIGRATION, "utf8");

/** The bucket's `allowed_mime_types`, read out of the one `array[...]` the migration writes. */
function allowedTypes(): string[] {
  const match = /array\[([^\]]*)\]/.exec(sql);
  if (!match?.[1]) throw new Error("0004 no longer writes an array of content types");
  return [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1] ?? "");
}

describe("the bucket and the download agree about one font", () => {
  it("declares the same size cap the import and the download enforce", () => {
    expect(sql).toContain(String(MAX_FONT_BYTES));
    expect(MAX_FONT_BYTES).toBe(2 * 1024 * 1024);
  });

  it("has room for a licence under the same limit, since a bucket has only one", () => {
    // The licence file is capped at 1 MiB by the editor and travels in the same bucket as the
    // faces. A bucket limit below it would refuse a licence the import accepted.
    expect(MAX_LICENCE_BYTES).toBeLessThanOrEqual(MAX_FONT_BYTES);
  });

  it("admits exactly the types a stored file can be given, and nothing else", () => {
    /**
     * **Two sources, crossed.** The bucket's list is read from the SQL; the other side is what the
     * editor actually types a stored file as, asked of `fontFileType` for one minted name per
     * format — the function the upload's content type is checked against. A format added to the
     * import and not to the bucket would be refused at somebody's upload; one added to the bucket
     * and never produced would be a door nobody meant to open.
     */
    const produced = [
      "propia-3f9a7c21-regular.woff2",
      "propia-3f9a7c21-regular.woff",
      "propia-3f9a7c21-regular.ttf",
      "propia-3f9a7c21-regular.otf",
      "LICENCIA-propia-3f9a7c21.txt",
      "LICENCIA-propia-3f9a7c21.pdf",
    ].map(fontFileType);
    expect(allowedTypes().sort()).toEqual([...new Set(produced)].sort());
    // And every face format the schema admits is among them, by the table the upload reads.
    for (const type of Object.values(FONT_MEDIA_TYPES)) expect(allowedTypes()).toContain(type);
  });

  it("keeps the bucket private, because no published site ever reads from it", () => {
    // ADR 0001: the ZIP carries the face beside the page and works with no service of ours.
    expect(sql).toMatch(/values\s*\(\s*'fuentes'\s*,\s*'fuentes'\s*,\s*false/);
  });

  it("gives the owner all four verbs, and the anonymous role none", () => {
    for (const policy of [
      "fuentes_select_own",
      "fuentes_insert_own",
      "fuentes_update_own",
      "fuentes_delete_own",
    ]) {
      expect(sql, policy).toContain(policy);
    }
    expect(sql).not.toContain("to anon");
  });
});
