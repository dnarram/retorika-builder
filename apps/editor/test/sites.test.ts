import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, SCHEMA_VERSION } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { createSite, listSites, loadSite, renameOf, saveSite } from "../src/account/sites.ts";
import type { Client } from "../src/auth/clients.ts";

/**
 * The site access layer, against a recorded query builder.
 *
 * What these can prove is the *shape of the request*: that a save carries the version it read,
 * that creating is an insert and never an upsert, that a stored document is re-validated on the
 * way out. What they deliberately do not try to prove is that the policies hold — that is SQL,
 * and `packages/db/test/policies.pg.test.ts` proves it against a real Postgres.
 */

const fixture = () =>
  parseDocument(
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
    ),
  );

interface Call {
  method: string;
  args: unknown[];
}

/**
 * A chainable stand-in that records every link in the chain and resolves to `result`.
 *
 * Built by attaching the chain's methods **onto a real Promise** rather than by defining a `then`
 * property: `await client.from("sites").select(...)` has to work with no terminator, and an object
 * that merely declares `then` is a thenable by accident, which is the thing `noThenProperty`
 * exists to catch.
 */
function recorder(result: unknown) {
  const calls: Call[] = [];
  const methods: Record<string, (...args: unknown[]) => unknown> = {};
  const chain = Object.assign(Promise.resolve(result), methods);
  for (const method of ["select", "insert", "update", "eq", "order", "maybeSingle", "single"]) {
    Object.defineProperty(chain, method, {
      value: (...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      },
      writable: true,
    });
  }
  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return chain;
    },
  };
  return { client: client as unknown as Client, calls };
}

/** Narrows a recorded call, so the assertions below do not chain off a possibly-missing one. */
function payloadOf(calls: Call[], method: string): Record<string, unknown> {
  const call = calls.find((entry) => entry.method === method);
  if (!call) throw new Error(`no ${method} call was recorded`);
  return call.args[0] as Record<string, unknown>;
}

describe("creating a site", () => {
  it("inserts, and there is no upsert anywhere in this module", async () => {
    // David's adjustment of 4 October: an anonymous web never overwrites one the account has.
    // The way that is guaranteed is that nothing here can replace a row it did not create.
    const { client, calls } = recorder({ data: { id: "s1", version: 1 }, error: null });
    const result = await createSite(client, {
      ownerId: "u1",
      name: "Taller Ruiz",
      document: fixture(),
    });
    expect(result).toEqual({ ok: true, id: "s1", version: 1 });
    // Asserted on the call that was made, not by scanning the source for the word "upsert" — the
    // first version of this test did that and failed on its own explanatory comment, which is the
    // same prose-versus-code mistake `scripts/secrets-scope.ts` was fixed for an hour earlier.
    expect(calls.map((call) => call.method)).toContain("insert");
    expect(calls.map((call) => call.method)).not.toContain("upsert");
  });

  it("stamps the schema version it was written at", async () => {
    const { client, calls } = recorder({ data: { id: "s1", version: 1 }, error: null });
    await createSite(client, { ownerId: "u1", name: "x", document: fixture() });
    const insert = payloadOf(calls, "insert");
    expect(insert["schema_version"]).toBe(SCHEMA_VERSION);
    // And the owner, because the insert policy checks it against the JWT: a row that names
    // somebody else is refused by the database, not by this code.
    expect(insert["owner_id"]).toBe("u1");
  });

  it("reports a failure rather than pretending the web was saved", async () => {
    const { client } = recorder({ data: null, error: { message: "nope" } });
    expect(await createSite(client, { ownerId: "u1", name: "x", document: fixture() })).toEqual({
      ok: false,
      reason: "unknown",
    });
  });
});

describe("saving an edit", () => {
  it("carries the version it read in the match, not in a prior check", async () => {
    const { client, calls } = recorder({ data: [{ version: 5 }], error: null });
    const result = await saveSite(client, { id: "s1", version: 4, document: fixture() });
    expect(result).toEqual({ ok: true, version: 5 });

    // Two tabs that both read version 4 would both pass a read-then-write check, and the second
    // would silently win. The version has to be in the `where`.
    const eqs = calls.filter((call) => call.method === "eq").map((call) => call.args);
    expect(eqs).toContainEqual(["version", 4]);
    expect(eqs).toContainEqual(["id", "s1"]);

    expect(payloadOf(calls, "update")["version"]).toBe(5);
  });

  it("refuses a stale write instead of overwriting the newer one", async () => {
    // No row matched: somebody wrote since this was read (ADR 0034 §8).
    const { client } = recorder({ data: [], error: null });
    expect(await saveSite(client, { id: "s1", version: 4, document: fixture() })).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  it("leaves the name alone unless a new one was given", async () => {
    const { client, calls } = recorder({ data: [{ version: 2 }], error: null });
    await saveSite(client, { id: "s1", version: 1, document: fixture() });
    expect(payloadOf(calls, "update")).not.toHaveProperty("name");

    const second = recorder({ data: [{ version: 2 }], error: null });
    await saveSite(second.client, {
      id: "s1",
      version: 1,
      document: fixture(),
      name: "Otro nombre",
    });
    expect(payloadOf(second.calls, "update")).toHaveProperty("name", "Otro nombre");
  });
});

describe("loading a site", () => {
  it("returns the document, migrated to the current schema on the way out", async () => {
    const document = fixture();
    // This fixture is stored at 1.0.0, which turned out to be the better test: a row written by an
    // older release has to come back as a document the editor can actually use.
    expect(document.schemaVersion).not.toBe(SCHEMA_VERSION);

    const { client } = recorder({
      data: { id: "s1", name: "Taller", document, version: 3 },
      error: null,
    });
    const loaded = await loadSite(client, "s1");
    expect(loaded?.version).toBe(3);
    expect(loaded?.document.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded?.document.siteName).toBe(document.siteName);
    expect(loaded?.document.pages).toHaveLength(document.pages.length);
  });

  it("refuses a stored document that no longer validates rather than handing it to the editor", async () => {
    const { client } = recorder({
      data: { id: "s1", name: "x", document: { nonsense: true }, version: 1 },
      error: null,
    });
    expect(await loadSite(client, "s1")).toBeNull();
  });

  it("is null for a row that is not there — or not theirs, which looks the same", async () => {
    const { client } = recorder({ data: null, error: null });
    expect(await loadSite(client, "s1")).toBeNull();
  });
});

describe("listing", () => {
  it("asks for the newest first, which is the order the account screen draws", async () => {
    const { client, calls } = recorder({
      data: [{ id: "s1", name: "A", updated_at: "2026-10-04T00:00:00Z" }],
      error: null,
    });
    expect(await listSites(client)).toEqual([
      { id: "s1", name: "A", updatedAt: "2026-10-04T00:00:00Z" },
    ]);
    expect(calls.find((call) => call.method === "order")?.args).toEqual([
      "updated_at",
      { ascending: false },
    ]);
  });

  it("is an empty list, not a throw, when the request fails", async () => {
    const { client } = recorder({ data: null, error: { message: "offline" } });
    expect(await listSites(client)).toEqual([]);
  });
});

describe("the name a site gets", () => {
  it("is the business's own, so nobody names their web twice", () => {
    expect(renameOf(fixture())).toBe(fixture().siteName);
  });

  it("falls back rather than storing an empty name", () => {
    expect(renameOf({ ...fixture(), siteName: "   " })).toBe("Mi web");
  });
});
