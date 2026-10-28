import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type OwnFont, parseDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  downloadFontFile,
  FONT_BUCKET,
  fetchSiteFonts,
  fontObjectPath,
  listFontObjects,
  reconcileSiteFonts,
  removeFontObjects,
  siteFontFiles,
  storedContentType,
  uploadFontFile,
} from "../src/account/fontStorage.ts";
import type { Client } from "../src/auth/clients.ts";
import { sfnt } from "./fontFixtures.ts";

/**
 * The account's side of an owner's own font (sprint 29 día 6, ADR 0056), against a recorded client
 * — the sibling of `photoStorage.test.ts`.
 *
 * What the bucket's policies allow is SQL and is proven as SQL in
 * `packages/db/test/storage.pg.test.ts`. What is proven here is ours: the path, the content type
 * read from the bytes and never from `File.type` (David's adjustment 7), the sniff on the way
 * back, and what a sync reports — by font, not by file.
 */

interface Recorded {
  method: string;
  args: unknown[];
}

/** Just enough of a Supabase client to answer the storage calls under test. `download` answers by
 * path, so a sync of several files can be told apart. */
function recorder(answers: {
  upload?: (path: string) => { error: unknown };
  download?: (path: string) => { data: Blob | null; error: unknown };
  list?: { data: unknown; error: unknown };
  remove?: { error: unknown };
}): { client: Client; calls: Recorded[]; buckets: string[] } {
  const calls: Recorded[] = [];
  const buckets: string[] = [];
  const api = {
    upload: (...args: unknown[]) => {
      calls.push({ method: "upload", args });
      return Promise.resolve(answers.upload?.(args[0] as string) ?? { error: null });
    },
    download: (...args: unknown[]) => {
      calls.push({ method: "download", args });
      return Promise.resolve(
        answers.download?.(args[0] as string) ?? { data: null, error: { message: "not found" } },
      );
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

function callsOf(calls: Recorded[], method: string): Recorded[] {
  return calls.filter((entry) => entry.method === method);
}

const fixture = (name: string) =>
  new Uint8Array(
    readFileSync(fileURLToPath(new URL(`../../../fixtures/fonts/${name}`, import.meta.url))),
  );

/** Karla 400 as woff2 and Karla 700 as woff — the corpus fixture's real bytes. */
const WOFF2 = fixture("propia-3f9a7c21-regular.woff2");
const WOFF = fixture("propia-3f9a7c21-bold.woff");
const LICENCE = fixture("LICENCIA-propia-3f9a7c21.txt");
/** A TrueType font, built by hand: the import reads its tables, this only its first bytes. */
const TTF = sfnt({});
const PDF = new TextEncoder().encode("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\n");
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

const OWNER = "11111111-1111-4111-8111-111111111111";
const SITE = "22222222-2222-4222-8222-222222222222";
const SITE_ARGS = { ownerId: OWNER, siteId: SITE };

const DOC = parseDocument(
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../../fixtures/documents/letra-propia.json", import.meta.url)),
      "utf8",
    ),
  ),
);
/** «Karla 2»: a regular woff2, a bold woff and an attached licence. */
const KARLA_2 = DOC.fonts?.[0] as OwnFont;
/** A second font of one face and no licence, made from the first. */
const { licenceFile: _, ...karlaBare } = KARLA_2;
const OTRA: OwnFont = {
  ...karlaBare,
  id: "0badc0de",
  family: "Otra Letra",
  faces: [{ role: "regular", format: "woff2" }],
};

const REGULAR = "propia-3f9a7c21-regular.woff2";
const BOLD = "propia-3f9a7c21-bold.woff";
const LICENCE_FILE = "LICENCIA-propia-3f9a7c21.txt";
const OTRA_REGULAR = "propia-0badc0de-regular.woff2";

/** The bytes each minted file holds in this browser, as the editor's object URLs would hand them. */
const HELD: Readonly<Record<string, Uint8Array>> = {
  [REGULAR]: WOFF2,
  [BOLD]: WOFF,
  [LICENCE_FILE]: LICENCE,
  [OTRA_REGULAR]: WOFF2,
};
const blobFor = async (file: string) => {
  const bytes = HELD[file];
  return bytes ? new Blob([new Uint8Array(bytes)]) : undefined;
};

describe("fontObjectPath", () => {
  it("is owner, then site, then the file name this product minted", () => {
    expect(fontObjectPath(OWNER, SITE, REGULAR)).toBe(`${OWNER}/${SITE}/${REGULAR}`);
    expect(fontObjectPath(OWNER, SITE, LICENCE_FILE)).toBe(`${OWNER}/${SITE}/${LICENCE_FILE}`);
  });

  it("refuses a segment that could leave the folder", () => {
    for (const bad of ["", "../propia-3f9a7c21-regular.woff2", "a/b", "a\\b"]) {
      expect(() => fontObjectPath(OWNER, SITE, bad), bad).toThrow(/refusing/);
    }
    expect(() => fontObjectPath("", SITE, REGULAR)).toThrow(/refusing/);
    expect(() => fontObjectPath(OWNER, "", REGULAR)).toThrow(/refusing/);
  });

  it("refuses a file name this product does not mint", () => {
    // The owner's own file name never reaches a path: the name is minted from the record's id and
    // the face's role. Anything else is somebody else's string.
    for (const bad of [
      "Karla-Regular.woff2",
      "propia-3F9A7C21-regular.woff2",
      "propia-3f9a7c21-italic.woff2",
      "propia-3f9a7c21-regular.svg",
      "LICENCIA-propia-3f9a7c21.exe",
    ]) {
      expect(() => fontObjectPath(OWNER, SITE, bad), bad).toThrow();
    }
  });
});

describe("storedContentType", () => {
  it("types each file by its bytes when they agree with its name", () => {
    expect(storedContentType(REGULAR, WOFF2)).toBe("font/woff2");
    expect(storedContentType(BOLD, WOFF)).toBe("font/woff");
    expect(storedContentType("propia-3f9a7c21-regular.ttf", TTF)).toBe("font/ttf");
    expect(storedContentType(LICENCE_FILE, LICENCE)).toBe("text/plain");
    expect(storedContentType("LICENCIA-propia-3f9a7c21.pdf", PDF)).toBe("application/pdf");
  });

  it("refuses bytes that are not what the name says", () => {
    // A TrueType file under a woff2 name would be bundled under a `format()` that lies, and
    // `/api/download` refuses exactly that; so does the store, first.
    expect(storedContentType(REGULAR, TTF)).toBeNull();
    expect(storedContentType(REGULAR, LICENCE)).toBeNull();
    expect(storedContentType(LICENCE_FILE, WOFF2)).toBeNull();
    expect(storedContentType("LICENCIA-propia-3f9a7c21.pdf", LICENCE)).toBeNull();
    expect(storedContentType(REGULAR, SVG)).toBeNull();
  });
});

describe("uploadFontFile", () => {
  it("un .woff2 cuyo File no tiene tipo sube como font/woff2", async () => {
    /**
     * **David's adjustment 7, as a test.** On some systems the browser reports a `.woff2` with an
     * empty `type`, and on others as `application/octet-stream`; the bucket's `allowed_mime_types`
     * would refuse both. The content type comes from the bytes.
     */
    for (const type of ["", "application/octet-stream", "font/ttf"]) {
      const { client, calls, buckets } = recorder({});
      const file = new File([new Uint8Array(WOFF2)], "Karla-Regular.woff2", { type });
      expect(await uploadFontFile(client, `${OWNER}/${SITE}/${REGULAR}`, file), type).toBe(true);
      expect(buckets).toEqual([FONT_BUCKET]);
      const [upload] = callsOf(calls, "upload");
      expect(upload?.args[0]).toBe(`${OWNER}/${SITE}/${REGULAR}`);
      expect(upload?.args[2], type).toMatchObject({ contentType: "font/woff2", upsert: true });
      const body = upload?.args[1] as Blob;
      expect(body.type, type).toBe("font/woff2");
      // Byte for byte what was chosen: stored as it is, never converted.
      expect(new Uint8Array(await body.arrayBuffer())).toEqual(WOFF2);
    }
  });

  it("sends nothing at all when the bytes are not what the name says", async () => {
    const { client, calls } = recorder({});
    const file = new File([new Uint8Array(TTF)], "x.woff2", { type: "font/woff2" });
    expect(await uploadFontFile(client, `${OWNER}/${SITE}/${REGULAR}`, file)).toBe(false);
    expect(callsOf(calls, "upload")).toEqual([]);
  });

  it("types a licence by its bytes as well", async () => {
    const { client, calls } = recorder({});
    const ok = await uploadFontFile(
      client,
      `${OWNER}/${SITE}/${LICENCE_FILE}`,
      new Blob([LICENCE]),
    );
    expect(ok).toBe(true);
    expect(callsOf(calls, "upload")[0]?.args[2]).toMatchObject({ contentType: "text/plain" });
  });

  it("reports a refusal instead of throwing", async () => {
    const { client } = recorder({ upload: () => ({ error: { message: "quota" } }) });
    expect(await uploadFontFile(client, `${OWNER}/${SITE}/${REGULAR}`, new Blob([WOFF2]))).toBe(
      false,
    );
  });
});

describe("downloadFontFile", () => {
  it("returns the bytes of a face", async () => {
    const { client } = recorder({
      download: () => ({ data: new Blob([WOFF2], { type: "font/woff2" }), error: null }),
    });
    expect(await downloadFontFile(client, `${OWNER}/${SITE}/${REGULAR}`)).toEqual(WOFF2);
  });

  it("returns null for bytes that are not what the name says, whatever the bucket was told", async () => {
    // The bucket trusts the content type the uploader declared, so a person could store markup
    // under a font's type in their own folder. Sniffing on the way down is what stops that ever
    // becoming a face.
    const { client } = recorder({
      download: () => ({ data: new Blob([SVG], { type: "font/woff2" }), error: null }),
    });
    expect(await downloadFontFile(client, `${OWNER}/${SITE}/${REGULAR}`)).toBeNull();
  });

  it("returns null when the object is not there", async () => {
    const { client } = recorder({});
    expect(await downloadFontFile(client, `${OWNER}/${SITE}/${REGULAR}`)).toBeNull();
  });
});

describe("listFontObjects and removeFontObjects", () => {
  it("answers full paths under the site's prefix", async () => {
    const { client, calls } = recorder({
      list: { data: [{ name: REGULAR }, { name: BOLD }], error: null },
    });
    expect(await listFontObjects(client, OWNER, SITE)).toEqual([
      `${OWNER}/${SITE}/${REGULAR}`,
      `${OWNER}/${SITE}/${BOLD}`,
    ]);
    expect(callsOf(calls, "list")[0]?.args[0]).toBe(`${OWNER}/${SITE}`);
  });

  it("is empty when the store refuses, or answers something that is not a list", async () => {
    expect(
      await listFontObjects(
        recorder({ list: { data: null, error: { m: 1 } } }).client,
        OWNER,
        SITE,
      ),
    ).toEqual([]);
    expect(
      await listFontObjects(recorder({ list: { data: {}, error: null } }).client, OWNER, SITE),
    ).toEqual([]);
  });

  it("removes by full path, asks nothing for nothing, and reports a refusal", async () => {
    const quiet = recorder({});
    expect(await removeFontObjects(quiet.client, [])).toBe(true);
    expect(quiet.calls).toEqual([]);
    const refused = recorder({ remove: { error: { message: "no" } } });
    expect(await removeFontObjects(refused.client, [`${OWNER}/${SITE}/${REGULAR}`])).toBe(false);
  });
});

describe("siteFontFiles", () => {
  it("names every face and the attached licence, and no licence for a font without one", () => {
    expect(siteFontFiles([KARLA_2, OTRA])).toEqual([REGULAR, BOLD, LICENCE_FILE, OTRA_REGULAR]);
  });
});

describe("reconcileSiteFonts", () => {
  it("sends what the document names and the bucket lacks, removes what it stopped naming", async () => {
    const stale = `${OWNER}/${SITE}/propia-deadbeef-regular.woff2`;
    const { client, calls } = recorder({
      list: { data: [{ name: REGULAR }, { name: "propia-deadbeef-regular.woff2" }], error: null },
    });
    const report = await reconcileSiteFonts(
      client,
      SITE_ARGS,
      [KARLA_2],
      Object.keys(HELD),
      blobFor,
    );
    expect(report.short).toEqual([]);
    // The regular is already up there; the bold and the licence are not.
    expect(callsOf(calls, "upload").map((call) => call.args[0])).toEqual([
      `${OWNER}/${SITE}/${BOLD}`,
      `${OWNER}/${SITE}/${LICENCE_FILE}`,
    ]);
    expect(callsOf(calls, "remove").map((call) => call.args[0])).toEqual([[stale]]);
  });

  it("counts a font once when one of its files was refused — by font, not by file", async () => {
    // The bold and the licence of «Karla 2» both refused: one font short, not two files.
    const { client } = recorder({
      upload: (path) =>
        path.endsWith(BOLD) || path.endsWith(LICENCE_FILE)
          ? { error: { m: "quota" } }
          : { error: null },
    });
    const report = await reconcileSiteFonts(
      client,
      SITE_ARGS,
      [KARLA_2, OTRA],
      Object.keys(HELD),
      blobFor,
    );
    expect(report.short).toEqual(["Karla 2"]);
  });

  it("counts a font no browser and no bucket holds, and does not count one only the bucket has", async () => {
    const { client, calls } = recorder({ list: { data: [{ name: OTRA_REGULAR }], error: null } });
    // This browser holds nothing at all: «Karla 2» was imported somewhere whose upload never
    // landed, and «Otra Letra» is up there, which the opening fetches.
    const report = await reconcileSiteFonts(client, SITE_ARGS, [KARLA_2, OTRA], [], blobFor);
    expect(report.short).toEqual(["Karla 2"]);
    expect(callsOf(calls, "upload")).toEqual([]);
    expect(callsOf(calls, "remove")).toEqual([]);
  });

  it("counts a file whose bytes can no longer be read as short, rather than claiming it", async () => {
    const { client } = recorder({});
    const report = await reconcileSiteFonts(client, SITE_ARGS, [OTRA], [OTRA_REGULAR], async () => {
      throw new Error("revoked");
    });
    expect(report.short).toEqual(["Otra Letra"]);
  });
});

describe("fetchSiteFonts", () => {
  it("brings back what arrives and passes the sniff, and names what does not", async () => {
    const { client } = recorder({
      download: (path) => {
        if (path.endsWith(REGULAR)) return { data: new Blob([WOFF2]), error: null };
        // The bold is up there under a woff name, but what came back is markup.
        if (path.endsWith(BOLD)) return { data: new Blob([SVG]), error: null };
        return { data: null, error: { message: "not found" } };
      },
    });
    const { fetched, failed } = await fetchSiteFonts(client, SITE_ARGS, [
      REGULAR,
      BOLD,
      LICENCE_FILE,
    ]);
    expect(fetched).toEqual([{ file: REGULAR, bytes: WOFF2 }]);
    expect(failed).toEqual([BOLD, LICENCE_FILE]);
  });
});
