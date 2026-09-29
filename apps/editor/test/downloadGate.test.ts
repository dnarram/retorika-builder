import { GALLERY_PHOTOS } from "@retorika/catalog";
import { MAX_PAGES } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { downloadGateFor, MAX_PHOTOS } from "../src/editor/downloadGate.ts";
import type { PhotoCounts } from "../src/editor/photoInventory.ts";

/**
 * `downloadGateFor` — what pressing «Descargar» does, and `MAX_PHOTOS` — the number that used to
 * be a leftover `10`, tested against the two named cases sprint 6 day 5 exists to fix.
 */

function counts(overrides: Partial<PhotoCounts>): PhotoCounts {
  const base: PhotoCounts = { empty: 0, sample: 0, own: 0, total: 0 };
  return { ...base, ...overrides };
}

describe("MAX_PHOTOS", () => {
  it("is derived from MAX_PAGES and the gallery's own item range, not a round number picked by feel", () => {
    expect(MAX_PHOTOS).toBe(MAX_PAGES * (GALLERY_PHOTOS.max + 1));
  });

  it("comfortably covers two galleries — the case the sprint 6 plan named as already broken", () => {
    // "Dos galerías — trivial desde que hay páginas — son 17 y la descarga se niega con un 413."
    // The old cap was 10; a single gallery alone already needed 8.
    expect(MAX_PHOTOS).toBeGreaterThan(2 * GALLERY_PHOTOS.max);
  });

  it("is well above the old value of 10 — the number this replaced", () => {
    expect(MAX_PHOTOS).toBeGreaterThan(10);
  });
});

describe("downloadGateFor", () => {
  it("is ready when nothing needs saying — an empty document", () => {
    expect(downloadGateFor(counts({}))).toEqual({ kind: "ready" });
  });

  it("is ready when every photograph is already the owner's", () => {
    expect(downloadGateFor(counts({ own: 5, total: 5 }))).toEqual({ kind: "ready" });
  });

  it("warns about sample photographs alone", () => {
    expect(downloadGateFor(counts({ sample: 3, total: 3 }))).toEqual({
      kind: "warn",
      sample: 3,
      empty: 0,
    });
  });

  it("warns about unfilled markers alone", () => {
    expect(downloadGateFor(counts({ empty: 2, total: 2 }))).toEqual({
      kind: "warn",
      sample: 0,
      empty: 2,
    });
  });

  it("warns about both at once, and reports both counts — the case a mixed site produces", () => {
    expect(downloadGateFor(counts({ sample: 1, empty: 1, own: 1, total: 3 }))).toEqual({
      kind: "warn",
      sample: 1,
      empty: 1,
    });
  });

  it("does not warn about photographs already the owner's, mixed in with the rest", () => {
    const gate = downloadGateFor(counts({ own: 10, sample: 1, total: 11 }));
    expect(gate.kind).toBe("warn");
    expect(gate).not.toHaveProperty("own");
  });

  it("blocks once the real files exceed MAX_PHOTOS, regardless of state", () => {
    const gate = downloadGateFor(counts({ own: MAX_PHOTOS + 1, total: MAX_PHOTOS + 1 }));
    expect(gate).toEqual({ kind: "tooManyPhotos", count: MAX_PHOTOS + 1, max: MAX_PHOTOS });
  });

  it("blocking wins over warning: over the cap and carrying sample photographs still blocks", () => {
    const gate = downloadGateFor(counts({ own: MAX_PHOTOS, sample: 2, total: MAX_PHOTOS + 2 }));
    expect(gate.kind).toBe("tooManyPhotos");
  });

  it("is ready at exactly the cap — the boundary is inclusive, not exclusive", () => {
    expect(downloadGateFor(counts({ own: MAX_PHOTOS, total: MAX_PHOTOS })).kind).not.toBe(
      "tooManyPhotos",
    );
  });

  it("never counts empty markers toward the cap — a marker needs no file", () => {
    // A document with more placeholder holes than MAX_PHOTOS is unusual but not a real bound
    // violation: nothing about an unfilled marker makes a request larger.
    const gate = downloadGateFor(counts({ empty: MAX_PHOTOS + 5, total: MAX_PHOTOS + 5 }));
    expect(gate.kind).not.toBe("tooManyPhotos");
  });

  it("reproduces the case the sprint 6 plan named: two full galleries, no longer blocked", () => {
    const twoGalleries = 2 * GALLERY_PHOTOS.max; // 17 with a cover, per the plan's own count
    const gate = downloadGateFor(counts({ own: twoGalleries, total: twoGalleries }));
    expect(gate.kind).not.toBe("tooManyPhotos");
  });
});
