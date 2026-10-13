import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { bankFileSchema, draftBankFileSchema, draftImageRecordSchema } from "../src/schema.ts";
import { approve } from "../tools/approve.ts";
import { IntakeRefusal, intake, nextId } from "../tools/intake.ts";
import { generationFromXmp, readPngInfo } from "../tools/png.ts";

/**
 * The intake circuit as a tool (sprint 19 day 6): PNG → WebP at 1600 px → a draft record with the
 * prompt read off the file → approval as a `git mv`. The PNGs here are written by hand, chunk by
 * chunk, with the XMP in the shape Draw Things writes it (read off a real file on 13 October 2026).
 */

const XMP = (prompt: string, model = "z_image_turbo_1.0_q6p.ckpt") =>
  `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
  `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:exif="http://ns.adobe.com/exif/1.0/">` +
  `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${prompt}&#xA;Steps: 8, Sampler: UniPC Trailing, Seed: 42, Model: ${model}</rdf:li></rdf:Alt></dc:description>` +
  `<xmp:CreatorTool>Draw Things</xmp:CreatorTool>` +
  `<exif:UserComment><rdf:Alt><rdf:li xml:lang="x-default">${JSON.stringify({ c: prompt, uc: "", model, seed: 42, steps: 8 }).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</rdf:li></rdf:Alt></exif:UserComment>` +
  `</rdf:Description></rdf:RDF></x:xmpmeta>`;

function chunk(type: string, body: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([length, typed, crc]);
}

/** A flat-colour PNG, RGB or RGBA, optionally carrying an XMP `iTXt`. */
function png(options: {
  width: number;
  height: number;
  rgba?: [number, number, number, number];
  alpha?: boolean;
  xmp?: string;
}): Buffer {
  const { width, height } = options;
  const alpha = options.alpha ?? false;
  const [r, g, b, a] = options.rgba ?? [200, 40, 40, 255];
  const channels = alpha ? 4 : 3;
  const row = Buffer.alloc(1 + width * channels);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * channels] = r;
    row[2 + x * channels] = g;
    row[3 + x * channels] = b;
    if (alpha) row[4 + x * channels] = a;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = alpha ? 6 : 2;
  const chunks = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
  ];
  if (options.xmp !== undefined) {
    chunks.push(
      chunk(
        "iTXt",
        Buffer.concat([
          Buffer.from("XML:com.adobe.xmp\0\0\0\0\0", "latin1"),
          Buffer.from(options.xmp, "utf8"),
        ]),
      ),
    );
  }
  chunks.push(chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

const PROMPT = "Barra de bar tradicional española, botellas iluminadas & un camarero de espaldas.";
const base = {
  sector: "restaurante-bar",
  alt: "Barra de madera con botellas iluminadas en los estantes.",
  checked: "2026-10-13",
  generated: "2026-10-12",
  today: "2026-10-13",
  taken: ["restaurante-bar.01", "restaurante-bar.09"],
};

describe("reading the PNG", () => {
  it("reads the dimensions, the colour type and the XMP off the chunks", () => {
    const info = readPngInfo(png({ width: 1600, height: 1072, xmp: XMP(PROMPT) }));
    expect(info).toMatchObject({ width: 1600, height: 1072, colourType: 2 });
    expect(info.xmp).toContain("<xmp:CreatorTool>Draw Things</xmp:CreatorTool>");
    expect(readPngInfo(png({ width: 10, height: 10, alpha: true })).colourType).toBe(6);
    expect(readPngInfo(png({ width: 10, height: 10 })).xmp).toBeUndefined();
  });

  it("reads the prompt from exif:UserComment, without the parameter line, and the model and tool", () => {
    const generation = generationFromXmp(XMP(PROMPT));
    expect(generation).toEqual({
      prompt: PROMPT,
      model: "z_image_turbo_1.0_q6p.ckpt",
      seed: 42,
      creatorTool: "Draw Things",
    });
  });

  it("falls back to dc:description cut at the parameter line when there is no UserComment", () => {
    const xmp = XMP(PROMPT).replace(/<exif:UserComment>[\s\S]*<\/exif:UserComment>/, "");
    expect(generationFromXmp(xmp)?.prompt).toBe(PROMPT);
  });
});

describe("the intake", () => {
  it("turns a 1600x1072 PNG into a simple-VP8 WebP under the cap and a draft record the schema accepts", async () => {
    const result = await intake({
      ...base,
      png: png({ width: 1600, height: 1072, xmp: XMP(PROMPT) }),
    });
    expect(result.record.id).toBe("restaurante-bar.10");
    expect(result.record.file).toBe("restaurante-bar.10.webp");
    expect(result.record).toMatchObject({
      width: 1600,
      height: 1072,
      bytes: result.webp.byteLength,
      origin: { prompt: PROMPT, generated: "2026-10-12" },
      licence: { name: "Apache License 2.0", checked: "2026-10-13", commercialUse: true },
      review: { status: "draft", drafted: "2026-10-13" },
    });
    expect(result.record.origin.tool).toBe(
      "Draw Things · z_image_turbo_1.0_q6p.ckpt (Z-Image-Turbo, Tongyi-MAI)",
    );
    expect(() => draftImageRecordSchema.parse(result.record)).not.toThrow();
    // The header `bank.test.ts` reads: RIFF, WEBP, a simple "VP8 " frame with its sync code.
    expect(result.webp.subarray(12, 16).toString("ascii")).toBe("VP8 ");
    expect([...result.webp.subarray(23, 26)]).toEqual([0x9d, 0x01, 0x2a]);
    expect(result.webp.readUInt16LE(26) & 0x3fff).toBe(1600);
    expect(result.webp.readUInt16LE(28) & 0x3fff).toBe(1072);
    expect(result.notes).toEqual([]);
  });

  it("downsizes a larger picture to 1600 px on the longest side, and says so", async () => {
    const result = await intake({
      ...base,
      png: png({ width: 2400, height: 1608, xmp: XMP(PROMPT) }),
    });
    expect(result.record).toMatchObject({ width: 1600, height: 1072 });
    expect(result.notes).toContainEqual(expect.stringContaining("downsized from 2400x1608"));
  });

  it("flattens an alpha channel over white before encoding, and the output is still simple VP8", async () => {
    // Fully transparent red: what comes out must be white, not red and not transparent.
    const result = await intake({
      ...base,
      png: png({
        width: 1600,
        height: 1072,
        alpha: true,
        rgba: [200, 40, 40, 0],
        xmp: XMP(PROMPT),
      }),
    });
    expect(result.notes).toContainEqual("alpha channel flattened over white");
    expect(result.webp.subarray(12, 16).toString("ascii")).toBe("VP8 ");
    const { data, info } = await sharp(result.webp).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    const pixel = [data[0], data[1], data[2]];
    for (const value of pixel) expect(value).toBeGreaterThan(245);
  });

  it("refuses a picture under the floor rather than enlarging it", async () => {
    await expect(
      intake({ ...base, png: png({ width: 1024, height: 1024, xmp: XMP(PROMPT) }) }),
    ).rejects.toThrow(/1024x1024 is under the 1344x896 floor/);
  });

  it("refuses a PNG with no XMP, and one whose model has no licence on record", async () => {
    await expect(intake({ ...base, png: png({ width: 1600, height: 1072 }) })).rejects.toThrow(
      IntakeRefusal,
    );
    await expect(
      intake({
        ...base,
        png: png({ width: 1600, height: 1072, xmp: XMP(PROMPT, "mystery.ckpt") }),
      }),
    ).rejects.toThrow(/"mystery.ckpt" has no licence on record/);
  });

  it("mints the next id above the highest in use, two digits", () => {
    expect(nextId("restaurante-bar", ["restaurante-bar.01", "restaurante-bar.09"])).toBe(
      "restaurante-bar.10",
    );
    expect(nextId("taller", [])).toBe("taller.01");
    expect(nextId("taller", ["taller.03", "restaurante-bar.12"])).toBe("taller.04");
  });
});

describe("the approval", () => {
  /** A photobank root with one empty sector and one draft in it. */
  function rootWith(draftCount: number, bankCount = 0): { root: string; ids: string[] } {
    const root = mkdtempSync(join(tmpdir(), "photobank-"));
    mkdirSync(join(root, "bank", "photos"), { recursive: true });
    mkdirSync(join(root, "drafts", "photos"), { recursive: true });
    const record = (n: number, status: "draft" | "approved") => ({
      id: `taller.${String(n).padStart(2, "0")}`,
      sector: "taller",
      alt: "Un banco de trabajo con herramientas.",
      file: `taller.${String(n).padStart(2, "0")}.webp`,
      width: 1600,
      height: 1072,
      bytes: 100,
      origin: { tool: "t", generated: "2026-10-12", prompt: "p" },
      licence: {
        name: "Apache License 2.0",
        url: "https://example.test",
        checked: "2026-10-12",
        commercialUse: true,
        clientsMayPublish: true,
      },
      review:
        status === "draft"
          ? { status: "draft", drafted: "2026-10-13" }
          : { status: "approved", by: "dnr", date: "2026-10-12" },
    });
    const approved = Array.from({ length: bankCount }, (_u, i) => record(i + 1, "approved"));
    const drafts = Array.from({ length: draftCount }, (_u, i) =>
      record(bankCount + i + 1, "draft"),
    );
    writeFileSync(
      join(root, "bank", "taller.json"),
      JSON.stringify({ sector: "taller", images: approved }),
    );
    writeFileSync(
      join(root, "drafts", "taller.json"),
      JSON.stringify({ sector: "taller", images: drafts }),
    );
    for (const d of drafts)
      writeFileSync(join(root, "drafts", "photos", d.file), Buffer.alloc(100));
    return { root, ids: drafts.map((d) => d.id) };
  }

  it("moves the record into the bank with the reviewer's name and today's date, and the file with it", () => {
    const { root, ids } = rootWith(1, 8);
    const moved: [string, string][] = [];
    const record = approve({
      id: ids[0] ?? "",
      by: "dnr",
      today: "2026-10-13",
      root,
      move: (from, to) => moved.push([from, to]),
    });
    expect(record.review).toEqual({ status: "approved", by: "dnr", date: "2026-10-13" });
    expect(moved).toEqual([
      [
        join(root, "drafts", "photos", "taller.09.webp"),
        join(root, "bank", "photos", "taller.09.webp"),
      ],
    ]);
    const bank = bankFileSchema.parse(
      JSON.parse(readFileSync(join(root, "bank", "taller.json"), "utf8")),
    );
    expect(bank.images.map((image) => image.id)).toContain("taller.09");
    expect(bank.images).toHaveLength(9);
    // The last draft gone, the drafts file goes with it — `drafts/` stays empty between batches.
    expect(() => readFileSync(join(root, "drafts", "taller.json"))).toThrow();
  });

  it("refuses to leave a sector between one and seven, unless the transition is meant", () => {
    const { root, ids } = rootWith(1, 0);
    expect(() =>
      approve({ id: ids[0] ?? "", by: "dnr", today: "2026-10-13", root, move: () => {} }),
    ).toThrow(/would hold 1 photograph/);
    expect(() =>
      approve({
        id: ids[0] ?? "",
        by: "dnr",
        today: "2026-10-13",
        root,
        allowPartial: true,
        move: () => {},
      }),
    ).not.toThrow();
    expect(() => draftBankFileSchema.parse({ sector: "taller", images: [] })).not.toThrow();
  });
});
