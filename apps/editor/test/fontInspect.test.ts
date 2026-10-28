import { readFileSync } from "node:fs";
import * as zlib from "node:zlib";
import { fontDataFor } from "@retorika/publisher";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_FONT_EXPANDED_BYTES } from "../src/editor/fontBytes.ts";
import { inspectFont } from "../src/editor/fontInspect.ts";
import {
  family,
  fvarTable,
  nameTable,
  os2Table,
  sfnt,
  type Tables,
  woff,
  woff2,
} from "./fontFixtures.ts";

/**
 * The decompressors, watched: every buffer they hand back is recorded, so a test can say **how much
 * was ever allocated** on a hostile stream — not only that the file was refused. A bomb without its
 * cap is refused too (the stream comes out the wrong length), so a refusal alone would stay green
 * with `maxOutputLength` deleted; what goes red is the 50 MB the spy then sees returned.
 */
vi.mock("node:zlib", async (importOriginal) => {
  const real = await importOriginal<typeof import("node:zlib")>();
  return {
    ...real,
    brotliDecompressSync: vi.fn(real.brotliDecompressSync),
    inflateSync: vi.fn(real.inflateSync),
  };
});

const brotli = vi.mocked(zlib.brotliDecompressSync);
const inflate = vi.mocked(zlib.inflateSync);

/** The largest buffer either decompressor returned, or 0 when every call threw. */
function largestReturned(): number {
  const sizes = [...brotli.mock.results, ...inflate.mock.results].map((result) =>
    result.type === "return" ? (result.value as Uint8Array).byteLength : 0,
  );
  return Math.max(0, ...sizes);
}

beforeEach(() => {
  brotli.mockClear();
  inflate.mockClear();
});

function fixture(file: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`../../../fixtures/fonts/${file}`, import.meta.url)));
}

function shipped(file: string): Uint8Array {
  const bytes = fontDataFor(file);
  if (bytes === undefined) throw new Error(`no shipped bytes for ${file}`);
  return bytes;
}

const VARIABLE: Tables = {
  name: nameTable([family("Casa Trufa Sans")]),
  fvar: fvarTable([
    { tag: "wdth", min: 75, def: 100, max: 125 },
    { tag: "wght", min: 300, def: 400, max: 800 },
  ]),
  "OS/2": os2Table(400),
};

describe("inspectFont — real files", () => {
  it("reads a real WOFF2 through glyf, loca and hmtx transforms to its name table", () => {
    // A gallery face as it is shipped: brotli, with the transformed tables before `name` in the
    // stream, so finding it proves the directory walk adds `transformLength` and not `origLength`.
    const result = inspectFont(shipped("eb-garamond-latin-400-normal.woff2"));
    expect(result).toEqual({
      ok: true,
      font: {
        format: "woff2",
        name: "EB Garamond",
        sanitised: "EB Garamond",
        hasFvar: false,
        wght: null,
        weight: 400,
        italic: false,
        bytes: shipped("eb-garamond-latin-400-normal.woff2").byteLength,
      },
    });
  });

  it("reads a real WOFF table by table, and tells the bold file by its weight class", () => {
    const result = inspectFont(fixture("propia-3f9a7c21-bold.woff"));
    expect(result.ok && result.font).toMatchObject({
      format: "woff",
      name: "Karla",
      weight: 700,
      hasFvar: false,
    });
    // zlib per table, and only the tables read: `name` and `OS/2` — this static face has no
    // `fvar` — out of the dozen the file carries.
    expect(inflate).toHaveBeenCalledTimes(2);
  });

  it("names the corpus fixture's regular «Karla», which is why the fixture is «Karla 2»", () => {
    const result = inspectFont(fixture("propia-3f9a7c21-regular.woff2"));
    expect(result.ok && result.font.name).toBe("Karla");
    expect(result.ok && result.font.weight).toBe(400);
  });
});

describe("inspectFont — the three containers, with a variable axis", () => {
  it.each([
    ["ttf", sfnt(VARIABLE, "ttf")],
    ["otf", sfnt(VARIABLE, "otf")],
    ["woff", woff(VARIABLE)],
    ["woff2", woff2(VARIABLE)],
  ] as const)("reads name and the wght range from a %s", (format, bytes) => {
    const result = inspectFont(bytes);
    expect(result).toEqual({
      ok: true,
      font: {
        format,
        name: "Casa Trufa Sans",
        sanitised: "Casa Trufa Sans",
        hasFvar: true,
        wght: [300, 800],
        weight: 400,
        italic: false,
        bytes: bytes.byteLength,
      },
    });
  });

  it("rounds a fractional range inwards and keeps it within 1–1000", () => {
    const bytes = sfnt({
      ...VARIABLE,
      fvar: fvarTable([{ tag: "wght", min: 0.5, def: 400, max: 1200.7 }]),
    });
    expect(inspectFont(bytes)).toMatchObject({ ok: true, font: { wght: [1, 1000] } });
  });

  it("is a variable font without a weight range when its only axis is not wght", () => {
    const bytes = woff2({
      ...VARIABLE,
      fvar: fvarTable([{ tag: "wdth", min: 75, def: 100, max: 125 }]),
    });
    expect(inspectFont(bytes)).toMatchObject({ ok: true, font: { hasFvar: true, wght: null } });
  });

  it("prefers the typographic family (ID 16) over ID 1, and Windows English over the rest", () => {
    const bytes = sfnt({
      name: nameTable([
        { platform: 1, encoding: 0, language: 0, nameId: 1, text: "Mac Name" },
        { platform: 3, encoding: 1, language: 0x0c0a, nameId: 1, text: "Nombre Bold" },
        family("Brand Sans Bold"),
        { platform: 3, encoding: 1, language: 0x0c0a, nameId: 16, text: "Marca Sans" },
        family("Brand Sans", 16),
      ]),
    });
    expect(inspectFont(bytes)).toMatchObject({ ok: true, font: { name: "Brand Sans" } });
  });

  it("reads a Mac Roman name when that is all the file has", () => {
    const bytes = sfnt({
      name: nameTable([{ platform: 1, encoding: 0, language: 0, nameId: 1, text: "Old Face" }]),
    });
    expect(inspectFont(bytes)).toMatchObject({ ok: true, font: { name: "Old Face" } });
  });

  it("says an italic file is one", () => {
    const bytes = woff({ name: nameTable([family("Leaning")]), "OS/2": os2Table(400, true) });
    expect(inspectFont(bytes)).toMatchObject({ ok: true, font: { italic: true, weight: 400 } });
  });

  it("returns an empty sanitised name, not a refusal, when the file names nothing writable", () => {
    const bytes = sfnt({ name: nameTable([family("ÅÉ 你好")]) });
    expect(inspectFont(bytes)).toMatchObject({
      ok: true,
      font: { name: "ÅÉ 你好", sanitised: "AE" },
    });
    const none = sfnt({ "OS/2": os2Table(400) });
    expect(inspectFont(none)).toMatchObject({ ok: true, font: { name: "", sanitised: "" } });
  });
});

describe("inspectFont — refusals by the first bytes", () => {
  it("refuses a collection, bare or inside a WOFF or WOFF2", () => {
    expect(inspectFont(new TextEncoder().encode("ttcf\0\x01\0\0"))).toEqual({
      ok: false,
      reason: "collection",
    });
    expect(inspectFont(woff2(VARIABLE, { flavor: 0x74746366 }))).toEqual({
      ok: false,
      reason: "collection",
    });
  });

  it("refuses an SVG and an HTML page renamed .ttf without parsing a byte of them", () => {
    for (const text of ['<svg xmlns="http://www.w3.org/2000/svg">', '﻿  <?xml version="1.0"?>']) {
      expect(inspectFont(new TextEncoder().encode(text))).toEqual({
        ok: false,
        reason: "notAFont",
      });
    }
    expect(brotli).not.toHaveBeenCalled();
  });

  it("refuses a truncated file as not a font, and does not throw", () => {
    const whole = woff2(VARIABLE);
    expect(inspectFont(whole.subarray(0, 60))).toEqual({ ok: false, reason: "notAFont" });
    expect(inspectFont(sfnt(VARIABLE).subarray(0, 30))).toEqual({ ok: false, reason: "notAFont" });
  });
});

describe("inspectFont — the expansion caps (David's adjustment 1)", () => {
  /** 50 MB of zeros, compressed: a few hundred bytes that would become 50 MB. */
  const FIFTY_MB = 50 * 1024 * 1024;

  it("refuses a WOFF2 whose stream declares 1 KB and expands to 50 MB, allocating no more than 1 KB", () => {
    const bomb = woff2(
      { name: new Uint8Array(1024) },
      { stream: new Uint8Array(zlib.brotliCompressSync(new Uint8Array(FIFTY_MB))) },
    );
    expect(bomb.byteLength).toBeLessThan(2048);
    expect(inspectFont(bomb)).toEqual({ ok: false, reason: "notAFont" });
    expect(brotli).toHaveBeenCalledTimes(1);
    expect(brotli.mock.calls[0]?.[1]).toEqual({ maxOutputLength: 1024 });
    expect(largestReturned()).toBeLessThanOrEqual(1024);
  });

  it("refuses a WOFF2 whose header declares more than the absolute ceiling, before decompressing", () => {
    const greedy = woff2(VARIABLE, { totalSfntSize: MAX_FONT_EXPANDED_BYTES + 1 });
    expect(inspectFont(greedy)).toEqual({ ok: false, reason: "notAFont" });
    expect(brotli).not.toHaveBeenCalled();
  });

  it("refuses a WOFF2 whose tables add up to more than its header declares, before decompressing", () => {
    const liar = woff2({ name: new Uint8Array(4096) }, { totalSfntSize: 1024 });
    expect(inspectFont(liar)).toEqual({ ok: false, reason: "notAFont" });
    expect(brotli).not.toHaveBeenCalled();
  });

  it("refuses a WOFF table that declares 100 KB and inflates to 50 MB, allocating no more than 100 KB", () => {
    const declared = 100 * 1024;
    const bomb = woff(
      { name: nameTable([family("Bomb")]) },
      {
        tag: "name",
        stored: new Uint8Array(zlib.deflateSync(new Uint8Array(FIFTY_MB))),
        origLength: declared,
      },
    );
    expect(inspectFont(bomb)).toEqual({ ok: false, reason: "notAFont" });
    expect(inflate).toHaveBeenCalledTimes(1);
    expect(largestReturned()).toBeLessThanOrEqual(declared);
  });

  it("refuses a WOFF table that declares more than the ceiling, without inflating it", () => {
    const bomb = woff(
      { name: nameTable([family("Bomb")]) },
      {
        tag: "name",
        stored: new Uint8Array(zlib.deflateSync(new Uint8Array(1024))),
        origLength: MAX_FONT_EXPANDED_BYTES + 1,
      },
    );
    expect(inspectFont(bomb)).toEqual({ ok: false, reason: "notAFont" });
    expect(inflate).not.toHaveBeenCalled();
  });
});
