import { describe, expect, it } from "vitest";
import {
  downloadPhoto,
  listPhotoObjects,
  PHOTO_BUCKET,
  photoObjectPath,
  removePhotos,
  uploadPhoto,
  uploadSitePhotos,
} from "../src/account/photoStorage.ts";
import type { Client } from "../src/auth/clients.ts";

/**
 * The account's side of a photograph (ADR 0037), against a recorded client.
 *
 * What the policies allow is SQL and is proven as SQL, in
 * `packages/db/test/storage.pg.test.ts` against a real Postgres. What is proven here is the half
 * that is ours: the path a photograph is stored under, that the bytes are handed over untouched,
 * that something which is not an image never becomes one on the way back, and that a failure is
 * reported rather than swallowed.
 */

interface Recorded {
  method: string;
  args: unknown[];
}

/** Just enough of a Supabase client to answer the storage calls under test. */
function recorder(answers: {
  upload?: { error: unknown };
  download?: { data: Blob | null; error: unknown };
  list?: { data: { name: string }[] | null; error: unknown };
  remove?: { error: unknown };
}): { client: Client; calls: Recorded[]; buckets: string[] } {
  const calls: Recorded[] = [];
  const buckets: string[] = [];
  const api = {
    upload: (...args: unknown[]) => {
      calls.push({ method: "upload", args });
      return Promise.resolve(answers.upload ?? { error: null });
    },
    download: (...args: unknown[]) => {
      calls.push({ method: "download", args });
      return Promise.resolve(answers.download ?? { data: null, error: null });
    },
    list: (...args: unknown[]) => {
      calls.push({ method: "list", args });
      return Promise.resolve(answers.list ?? { data: [], error: null });
    },
    remove: (...args: unknown[]) => {
      calls.push({ method: "remove", args });
      return Promise.resolve(answers.remove ?? { error: null });
    },
  };
  const client = {
    storage: {
      from: (bucket: string) => {
        buckets.push(bucket);
        return api;
      },
    },
  };
  return { client: client as unknown as Client, calls, buckets };
}

function call(calls: Recorded[], method: string): Recorded {
  const found = calls.find((entry) => entry.method === method);
  if (!found) throw new Error(`no ${method} call was recorded`);
  return found;
}

/** A JPEG's first bytes, which is all `sniffImage` reads. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

const OWNER = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222222";

describe("photoObjectPath", () => {
  it("is owner, then site, then the document's own src", () => {
    // The first segment is the whole of ownership: every policy in migration 0003 compares it
    // against `auth.uid()`. The second makes a site's photographs a listable prefix.
    expect(photoObjectPath(OWNER, SITE, "foto-sec-cover-el-image.jpg")).toBe(
      `${OWNER}/${SITE}/foto-sec-cover-el-image.jpg`,
    );
  });

  it("refuses a src that could climb out of the folder", () => {
    // Defence in depth rather than a live worry — `photoSrcFor` builds the name from ids the
    // schema controls — and the reason it is here is that this function turns a string into a
    // path. `readSampleBytes` earned the same guard for the same reason.
    for (const bad of ["../otra/foto.jpg", "a/b.jpg", "..", "a\\b.jpg", ""]) {
      expect(() => photoObjectPath(OWNER, SITE, bad), bad).toThrow(/refusing/);
    }
  });

  it("refuses an empty owner or site, which would shift every segment left", () => {
    // An empty first segment makes the site id the folder, which would put one person's
    // photographs in a folder named after a site and outside every policy's reach.
    expect(() => photoObjectPath("", SITE, "foto.jpg")).toThrow(/refusing/);
    expect(() => photoObjectPath(OWNER, "", "foto.jpg")).toThrow(/refusing/);
  });
});

describe("uploadPhoto", () => {
  it("sends the bytes it was given, byte for byte, and says which bucket", async () => {
    /**
     * **This is the transport half of David's instruction about metadata**, and the reason it is
     * worth a test of its own.
     *
     * `preparePhoto` re-encodes every upload through a canvas, so the bytes in the editor's
     * `photoUrls` map carry no EXIF and no GPS — a canvas draws pixels and nothing else. That is
     * proven end to end by the walk that uploads a photograph carrying coordinates and opens the
     * ZIP. What this asserts is the step in between: nothing here re-wraps, re-encodes or appends
     * anything, so whatever that pipeline produced is what is stored.
     */
    const { client, calls, buckets } = recorder({});
    const ok = await uploadPhoto(client, `${OWNER}/${SITE}/foto.jpg`, JPEG);
    expect(ok).toBe(true);
    expect(buckets).toEqual([PHOTO_BUCKET]);

    const upload = call(calls, "upload");
    expect(upload.args[0]).toBe(`${OWNER}/${SITE}/foto.jpg`);
    const body = upload.args[1] as Blob;
    expect(new Uint8Array(await body.arrayBuffer())).toEqual(JPEG);
    expect(body.type).toBe("image/jpeg");
  });

  it("replaces the object in a slot rather than failing on it", async () => {
    // `photoSrcFor` is stable per slot, so changing the cover photograph writes the same key.
    // Without `upsert` the second upload would fail and the owner would be told their own
    // replacement did not work.
    const { client, calls } = recorder({});
    await uploadPhoto(client, `${OWNER}/${SITE}/foto.jpg`, JPEG);
    expect(call(calls, "upload").args[2]).toMatchObject({ upsert: true });
  });

  it("asks for no caching, because the key does not change when the picture does", async () => {
    // ADR 0037 §7. A cached copy would show somebody their old photograph after they replaced it,
    // which is the interface lying about their own work.
    const { client, calls } = recorder({});
    await uploadPhoto(client, `${OWNER}/${SITE}/foto.jpg`, JPEG);
    expect(call(calls, "upload").args[2]).toMatchObject({ cacheControl: "0" });
  });

  it("reports a refusal instead of throwing, so the indicator can say «No guardado»", async () => {
    const { client } = recorder({ upload: { error: { message: "quota" } } });
    expect(await uploadPhoto(client, `${OWNER}/${SITE}/foto.jpg`, JPEG)).toBe(false);
  });
});

describe("downloadPhoto", () => {
  it("returns the bytes of a photograph", async () => {
    const { client } = recorder({
      download: { data: new Blob([JPEG], { type: "image/jpeg" }), error: null },
    });
    expect(await downloadPhoto(client, `${OWNER}/${SITE}/foto.jpg`)).toEqual(JPEG);
  });

  it("returns null for bytes that are not an image, whatever the bucket was told", async () => {
    /**
     * The bucket's `allowed_mime_types` trusts the content type the uploader declares, so a
     * person could store a text file under a JPEG's content type in their own folder. Sniffing on
     * the way down is what stops that ever becoming an `<img>` — the same division `/api/download`
     * draws for the bytes the browser already checked: one side is the convenience, the other is
     * the guarantee.
     */
    const notAnImage = new Uint8Array([0x3c, 0x73, 0x76, 0x67]); // "<svg"
    const { client } = recorder({
      download: { data: new Blob([notAnImage], { type: "image/jpeg" }), error: null },
    });
    expect(await downloadPhoto(client, `${OWNER}/${SITE}/foto.jpg`)).toBeNull();
  });

  it("returns null when the object is not there", async () => {
    const { client } = recorder({ download: { data: null, error: { message: "not found" } } });
    expect(await downloadPhoto(client, `${OWNER}/${SITE}/foto.jpg`)).toBeNull();
  });
});

describe("listPhotoObjects", () => {
  it("answers full paths, because every other caller works in those", async () => {
    // Supabase answers `list` with names relative to the prefix. Returning them as they come would
    // hand day 4's reconciliation names it cannot delete.
    const { client, calls } = recorder({
      list: {
        data: [{ name: "foto-sec-cover-el-image.jpg" }, { name: "foto-b.jpg" }],
        error: null,
      },
    });
    expect(await listPhotoObjects(client, OWNER, SITE)).toEqual([
      `${OWNER}/${SITE}/foto-sec-cover-el-image.jpg`,
      `${OWNER}/${SITE}/foto-b.jpg`,
    ]);
    expect(call(calls, "list").args[0]).toBe(`${OWNER}/${SITE}`);
  });

  it("is empty when the store refuses, rather than throwing into a save", async () => {
    const { client } = recorder({ list: { data: null, error: { message: "no" } } });
    expect(await listPhotoObjects(client, OWNER, SITE)).toEqual([]);
  });
});

describe("removePhotos", () => {
  it("does not call the store for an empty list", async () => {
    // Reconciliation runs after every save, and most saves have nothing to remove.
    const { client, calls } = recorder({});
    expect(await removePhotos(client, [])).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("reports a refusal", async () => {
    const { client } = recorder({ remove: { error: { message: "no" } } });
    expect(await removePhotos(client, [`${OWNER}/${SITE}/foto.jpg`])).toBe(false);
  });
});

describe("uploadSitePhotos", () => {
  it("stores every photograph the site references, under its own path", async () => {
    const { client, calls } = recorder({});
    const report = await uploadSitePhotos(
      client,
      { ownerId: OWNER, siteId: SITE, srcs: ["a.jpg", "b.jpg"] },
      async () => JPEG,
    );
    expect(report).toEqual({ uploaded: ["a.jpg", "b.jpg"], failed: [] });
    expect(
      calls.filter((entry) => entry.method === "upload").map((entry) => entry.args[0]),
    ).toEqual([`${OWNER}/${SITE}/a.jpg`, `${OWNER}/${SITE}/b.jpg`]);
  });

  it("reports by src, which is what the panel and the gate are keyed by", async () => {
    const { client } = recorder({ upload: { error: { message: "quota" } } });
    const report = await uploadSitePhotos(
      client,
      { ownerId: OWNER, siteId: SITE, srcs: ["a.jpg"] },
      async () => JPEG,
    );
    expect(report).toEqual({ uploaded: [], failed: ["a.jpg"] });
  });

  it("skips a src this browser holds no bytes for, and does not call it a failure", async () => {
    /**
     * A photograph the document names and this browser does not have is not a refusal: it is a
     * site opened somewhere its photographs have not been fetched into. Counting it as failed
     * would put a site into the blocking «photosFailed» gate for something no retry here can fix,
     * and counting it as uploaded would be a lie. It is neither, and day 4's indicator is what
     * says how many are still missing.
     */
    const { client, calls } = recorder({});
    const report = await uploadSitePhotos(
      client,
      { ownerId: OWNER, siteId: SITE, srcs: ["a.jpg", "sin-bytes.jpg"] },
      async (src) => (src === "a.jpg" ? JPEG : undefined),
    );
    expect(report).toEqual({ uploaded: ["a.jpg"], failed: [] });
    expect(calls.filter((entry) => entry.method === "upload")).toHaveLength(1);
  });

  it("asks for nothing at all when the site references no photograph of the owner's", async () => {
    // Which is every generated site before the first upload: its one photograph is the bank's.
    const { client, calls } = recorder({});
    const report = await uploadSitePhotos(
      client,
      { ownerId: OWNER, siteId: SITE, srcs: [] },
      async () => JPEG,
    );
    expect(report).toEqual({ uploaded: [], failed: [] });
    expect(calls).toHaveLength(0);
  });
});
