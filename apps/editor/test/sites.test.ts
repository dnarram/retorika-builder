import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument, SCHEMA_VERSION } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { loadAccountDesignTools, saveAccountDesignTools } from "../src/account/designTools.ts";
import {
  cancelAccountDeletion,
  createSite,
  exportSites,
  listSites,
  loadSite,
  renameOf,
  requestAccountDeletion,
  saveSite,
} from "../src/account/sites.ts";
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
 * A chainable stand-in that records every link in the chain and resolves to the next `response`.
 *
 * Built by attaching the chain's methods **onto a real Promise** rather than by defining a `then`
 * property: `await client.from("sites").select(...)` has to work with no terminator, and an object
 * that merely declares `then` is a thenable by accident, which is the thing `noThenProperty`
 * exists to catch — it caught a second, worse copy of this helper that was briefly hand-rolled
 * further down this file.
 *
 * **Several responses are answered in order**, one per `from(...)`, which is what a function that
 * reads after a write needs. Passing one response keeps the old behaviour exactly: it is clamped,
 * so every query sees the same answer.
 */
function recorder(...responses: unknown[]) {
  const calls: Call[] = [];
  let answered = 0;

  function chainFor(): Promise<unknown> {
    const response = responses[Math.min(answered++, responses.length - 1)];
    const chain = Promise.resolve(response);
    for (const method of [
      "select",
      "insert",
      "update",
      "eq",
      "is",
      "order",
      "maybeSingle",
      "single",
    ]) {
      Object.defineProperty(chain, method, {
        value: (...args: unknown[]) => {
          calls.push({ method, args });
          return chain;
        },
        writable: true,
      });
    }
    return chain;
  }

  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return chainFor();
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

describe("the copy an owner takes with them", () => {
  it("carries every site's document and the version it was written at", async () => {
    const { client } = recorder({
      data: [
        { id: "s1", name: "Taller", document: { siteName: "Taller" }, schema_version: "1.8.0" },
      ],
      error: null,
    });
    const exported = await exportSites(client);
    expect(exported.sites).toEqual([
      { id: "s1", name: "Taller", document: { siteName: "Taller" }, schemaVersion: "1.8.0" },
    ]);
    expect(exported.schemaVersion).toBe(SCHEMA_VERSION);
    expect(Date.parse(exported.exportedAt)).not.toBeNaN();
  });

  it("is an empty export rather than a throw when the request fails", async () => {
    // Part 16 says the export always works. It cannot always *find* something, but it must never
    // be the thing that breaks on the way out.
    const { client } = recorder({ data: null, error: { message: "offline" } });
    expect((await exportSites(client)).sites).toEqual([]);
  });
});

describe("asking for the account to be deleted, from the browser", () => {
  it("writes the timestamp on the owner's own row and nobody else's", async () => {
    const stored = "2026-10-05T10:00:00.000Z";
    const { client, calls } = recorder({ data: [{ deletion_requested_at: stored }], error: null });
    expect(await requestAccountDeletion(client, "u1")).toEqual({
      ok: true,
      // The date the database stored, not the one this browser's clock happened to say.
      requestedAt: stored,
    });
    const eqs = calls.filter((call) => call.method === "eq").map((call) => call.args);
    expect(eqs).toContainEqual(["id", "u1"]);
    expect(payloadOf(calls, "update")["deletion_requested_at"]).toBeTruthy();
  });

  it("does not restart the clock on a second press", async () => {
    // `.is(..., null)` is what makes this idempotent: a row that already has a timestamp matches
    // nothing, so asking twice cannot quietly grant thirty more days.
    const { client, calls } = recorder({ data: [{ deletion_requested_at: "x" }], error: null });
    await requestAccountDeletion(client, "u1");
    expect(calls.filter((call) => call.method === "is").map((call) => call.args)).toContainEqual([
      "deletion_requested_at",
      null,
    ]);
  });

  it("reports the original date when a request was already pending", async () => {
    // The update matches nothing because the row already has a timestamp, and the owner should be
    // shown the date their window actually runs from rather than a failure. Two responses in
    // order: the update that matched nothing, then the read that finds out why.
    const already = "2026-10-01T09:30:00.000Z";
    const { client } = recorder(
      { data: [], error: null },
      { data: { deletion_requested_at: already }, error: null },
    );
    expect(await requestAccountDeletion(client, "u1")).toEqual({ ok: true, requestedAt: already });
  });

  it("reports a failure when there is no account row to write to", async () => {
    // The defect this whole change exists for: until migration 0002 there was no row for anybody,
    // the update matched nothing, PostgREST answered 204 with no error, and this said yes.
    const { client } = recorder({ data: [], error: null }, { data: null, error: null });
    expect(await requestAccountDeletion(client, "u1")).toEqual({ ok: false, reason: "missing" });
  });

  it("can be undone, which is the point of a window", async () => {
    const { client, calls } = recorder({ data: [{ id: "u1" }], error: null });
    expect(await cancelAccountDeletion(client, "u1")).toBe(true);
    expect(payloadOf(calls, "update")["deletion_requested_at"]).toBeNull();
  });

  it("reports a cancellation that matched no row rather than claiming it worked", async () => {
    const { client } = recorder({ data: [], error: null });
    expect(await cancelAccountDeletion(client, "u1")).toBe(false);
  });

  it("reports a failure rather than claiming the request landed", async () => {
    const { client } = recorder({ error: { message: "no" } });
    expect(await requestAccountDeletion(client, "u1")).toEqual({ ok: false, reason: "unknown" });
  });
});

describe("the grace window, which is written in two places", () => {
  it("says the same number in the editor as in the sweep", () => {
    // `AccountPage.tsx` cannot import the value: `@retorika/db` is server-only and pulling it into
    // a client component is what `scripts/secrets-scope.ts` refuses. So the number is restated,
    // and this is the assertion that keeps the sentence an owner reads and the interval the sweep
    // uses from drifting apart.
    const fromDb = readFileSync(
      join(import.meta.dirname, "..", "..", "..", "packages", "db", "src", "deletion.ts"),
      "utf8",
    ).match(/GRACE_WINDOW_DAYS = (\d+)/);
    const fromEditor = readFileSync(
      join(import.meta.dirname, "..", "src", "account", "AccountPage.tsx"),
      "utf8",
    ).match(/GRACE_WINDOW_DAYS = (\d+)/);

    expect(fromDb?.[1], "packages/db/src/deletion.ts no longer declares GRACE_WINDOW_DAYS").toBe(
      "30",
    );
    expect(fromEditor?.[1], "AccountPage.tsx drifted from the sweep's grace window").toBe(
      fromDb?.[1],
    );
  });
});

describe("the design-tools switch in the account", () => {
  it("reads the stored preference", async () => {
    const { client, calls } = recorder({ data: { design_tools: true }, error: null });
    expect(await loadAccountDesignTools(client, "u1")).toBe(true);
    expect(calls.filter((call) => call.method === "eq").map((call) => call.args)).toContainEqual([
      "id",
      "u1",
    ]);
  });

  it("says off when it is off", async () => {
    const { client } = recorder({ data: { design_tools: false }, error: null });
    expect(await loadAccountDesignTools(client, "u1")).toBe(false);
  });

  it("says null — not false — when it could not ask", async () => {
    // The distinction that matters: `false` is «this person has them off», `null` is «we could not
    // ask». Collapsing them would overwrite an account preference with a browser one the first
    // time the network hiccupped, and the person did not change their mind.
    const { client } = recorder({ data: null, error: { message: "offline" } });
    expect(await loadAccountDesignTools(client, "u1")).toBeNull();
  });

  it("writes only the switch, and only on the owner's own row", async () => {
    const { client, calls } = recorder({ data: [{ design_tools: true }], error: null });
    expect(await saveAccountDesignTools(client, "u1", true)).toBe(true);
    // Nothing else may ride along on this update: the switch is a property of the person and the
    // row also carries the deletion request.
    expect(payloadOf(calls, "update")).toEqual({ design_tools: true });
    expect(calls.filter((call) => call.method === "eq").map((call) => call.args)).toContainEqual([
      "id",
      "u1",
    ]);
  });

  it("reports a refused write, so the editor's «no lo recordamos» notice stays honest", async () => {
    const { client } = recorder({ error: { message: "no" } });
    expect(await saveAccountDesignTools(client, "u1", true)).toBe(false);
  });

  it("reports a write that matched no row, which is what a missing account row looks like", async () => {
    // Same defect as the deletion request: no error, no row, and the editor used to believe it.
    const { client } = recorder({ data: [], error: null });
    expect(await saveAccountDesignTools(client, "u1", true)).toBe(false);
  });
});
