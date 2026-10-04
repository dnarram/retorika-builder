import { describe, expect, it } from "vitest";
import { assertPooled } from "../src/connect.ts";
import { migrations } from "../src/migrate.ts";

/**
 * The two pieces of logic in this package that need no database, so they are covered by a plain
 * `pnpm test` rather than only by `pnpm test:db`.
 */

describe("the pooler guard ADR 0012 requires", () => {
  it("refuses a hosted URL on the direct-connection port", () => {
    expect(() => assertPooled("postgres://user:pw@db.abcdefgh.supabase.com:5432/postgres")).toThrow(
      /transaction pooler on port 6543/,
    );
  });

  it("refuses a hosted URL with no port at all, which defaults to the direct one", () => {
    expect(() => assertPooled("postgres://user:pw@db.abcdefgh.supabase.com/postgres")).toThrow(
      /transaction pooler/,
    );
  });

  it("accepts the pooler", () => {
    expect(() =>
      assertPooled("postgres://user:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"),
    ).not.toThrow();
  });

  it("leaves a local Postgres alone, which is where the tests run", () => {
    expect(() => assertPooled("postgres://localhost:5432/retorika_db_test")).not.toThrow();
    expect(() => assertPooled("postgres:///postgres")).not.toThrow();
  });

  it("covers .supabase.co as well as .supabase.com, because both are issued", () => {
    expect(() => assertPooled("postgres://user:pw@db.abcdefgh.supabase.co:5432/postgres")).toThrow(
      /transaction pooler/,
    );
  });
});

describe("the migration list", () => {
  it("is ordered by name, which is what makes the numbers meaningful", () => {
    const ids = migrations().map((m) => m.id);
    expect(ids).toEqual([...ids].sort());
  });

  it("finds the first migration and carries its SQL", () => {
    const [first] = migrations();
    expect(first?.id).toBe("0001-accounts-sites-and-the-audit-log");
    expect(first?.sql).toContain("enable row level security");
  });
});
