import { describe, expect, it } from "vitest";
import { afterAcceptedSave, photoSyncPlan } from "../src/account/photoSync.ts";

/**
 * The arithmetic that decides what the account's copy of a site's photographs is missing, and what
 * it is still keeping (ADR 0037 §5).
 *
 * This is the half that can delete somebody's photograph, so it is pure and exhausted here rather
 * than reasoned about in an effect. The round trips are the caller's; what is proven is the
 * decision.
 */

const OWNER = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222222";
const pathFor = (src: string) => `${OWNER}/${SITE}/${src}`;

function plan(state: { wanted?: string[]; remote?: string[]; local?: string[] }) {
  return photoSyncPlan({
    wanted: state.wanted ?? [],
    remote: state.remote ?? [],
    local: state.local ?? [],
    pathFor,
  });
}

describe("photoSyncPlan", () => {
  it("uploads a photograph the document names, the bucket lacks and this browser holds", () => {
    expect(plan({ wanted: ["a.jpg"], local: ["a.jpg"] })).toEqual({
      upload: ["a.jpg"],
      remove: [],
      missing: [],
    });
  });

  it("asks for nothing when the bucket already has it", () => {
    expect(plan({ wanted: ["a.jpg"], remote: ["a.jpg"], local: ["a.jpg"] })).toEqual({
      upload: [],
      remove: [],
      missing: [],
    });
  });

  it("counts as missing what neither the bucket nor this browser has", () => {
    // A photograph uploaded from another computer, or a site saved before the photographs
    // travelled. Nothing here can fix it, and the only honest thing is to count it.
    expect(plan({ wanted: ["a.jpg"] })).toEqual({ upload: [], remove: [], missing: ["a.jpg"] });
  });

  it("removes an object the document no longer names, as a full path", () => {
    // The orphan case: a section was deleted, which ADR 0003 makes permanent.
    expect(plan({ wanted: [], remote: ["vieja.jpg"] })).toEqual({
      upload: [],
      remove: [pathFor("vieja.jpg")],
      missing: [],
    });
  });

  it("never removes a photograph the document still names, whatever else is true of it", () => {
    /**
     * The property that matters most, because this is the half that loses work. A photograph can
     * be referenced, in the bucket, and absent from this browser all at once — a site opened on a
     * second computer before its photographs were fetched — and in that state an eager tidy-up
     * would delete the only copy.
     */
    for (const local of [[], ["a.jpg"]]) {
      const result = plan({ wanted: ["a.jpg"], remote: ["a.jpg"], local });
      expect(result.remove, JSON.stringify(local)).toEqual([]);
    }
  });

  it("never asks to upload and remove the same photograph", () => {
    // Two instructions about one file, in whichever order they ran, is a photograph whose fate
    // depends on luck. The sets are disjoint by construction and this says so.
    const result = plan({
      wanted: ["a.jpg", "b.jpg"],
      remote: ["b.jpg", "c.jpg"],
      local: ["a.jpg", "b.jpg"],
    });
    expect(result.upload).toEqual(["a.jpg"]);
    expect(result.remove).toEqual([pathFor("c.jpg")]);
    for (const src of result.upload) expect(result.remove).not.toContain(pathFor(src));
  });

  it("keeps the document's order, so a failure is reported against a stable list", () => {
    const result = plan({ wanted: ["z.jpg", "a.jpg"], local: ["z.jpg", "a.jpg"] });
    expect(result.upload).toEqual(["z.jpg", "a.jpg"]);
  });

  it("does nothing at all for a site with no photographs of its own", () => {
    // Every generated site before the first upload: its one photograph is the bank's, and
    // `listOwnPhotoSrcs` hands this an empty list.
    expect(plan({ remote: [] })).toEqual({ upload: [], remove: [], missing: [] });
  });
});

describe("afterAcceptedSave", () => {
  it("reconciles after a save the database accepted", async () => {
    let reconciled = 0;
    const result = await afterAcceptedSave(
      async () => ({ ok: true as const, version: 4 }),
      async () => {
        reconciled += 1;
      },
    );
    expect(result).toEqual({ ok: true, version: 4 });
    expect(reconciled).toBe(1);
  });

  it("does not reconcile after a save the version check refused", async () => {
    /**
     * **David's condition, asserted by name**: «una pestaña con un documento desactualizado no
     * puede borrar fotos del bucket».
     *
     * A stale tab names the photographs of a document somebody else has already replaced. If it
     * reconciled, `photoSyncPlan` would faithfully compute that the winning document's new
     * photograph is «not wanted» and delete it. The version check is what tells the two apart, so
     * a refused save reconciles nothing — not one upload and not one delete.
     */
    let reconciled = 0;
    const result = await afterAcceptedSave(
      async () => ({ ok: false as const, reason: "stale" as const }),
      async () => {
        reconciled += 1;
      },
    );
    expect(result).toEqual({ ok: false, reason: "stale" });
    expect(reconciled, "a stale tab reconciled the bucket").toBe(0);
  });

  it("returns the save's own answer either way, so the caller still decides what to say", async () => {
    const refused = await afterAcceptedSave(
      async () => ({ ok: false as const, reason: "unknown" as const }),
      async () => undefined,
    );
    expect(refused.ok).toBe(false);
  });
});
