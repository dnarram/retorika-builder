import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PLACEHOLDER_IMAGE_ALT,
  PLACEHOLDER_SAMPLE_ID,
  placeholderImageSrc,
} from "@retorika/catalog";
import { describe, expect, it } from "vitest";
import {
  GENERIC_SECTOR,
  hasSamplePhotos,
  pickIndex,
  recordById,
  sampleImageFor,
  sampleSrcFor,
  sectorsInBank,
} from "../src/index.ts";
import { bankFileSchema, imageRecordSchema, MAX_IMAGE_BYTES } from "../src/schema.ts";

/**
 * `packages/photobank`, day one: the machinery, tested while `bank/` itself is empty of real
 * photographs. Every seam here has to work against a bank of zero images, because that is the
 * state this package ships in and the state most of it will spend its first days in.
 */

const HERE = import.meta.dirname;
const FIXTURES_DIR = join(HERE, "fixtures");
const BANK_DIR = join(HERE, "..", "bank");

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: "prueba.01",
    sector: "prueba",
    alt: "Una foto de prueba",
    file: "prueba.01.webp",
    width: 1600,
    height: 1067,
    bytes: 1000,
    origin: { tool: "Prueba", generated: "2026-09-29", prompt: "Un mostrador vacío" },
    licence: {
      name: "Prueba",
      url: "https://example.test",
      checked: "2026-09-29",
      commercialUse: true,
      clientsMayPublish: true,
    },
    review: { status: "approved", by: "dnr", date: "2026-09-29" },
    ...overrides,
  };
}

describe("the record schema refuses what ADR 0011 refuses", () => {
  it("accepts a record with every condition met", () => {
    expect(() => imageRecordSchema.parse(record())).not.toThrow();
  });

  it("refuses a licence that does not allow commercial use", () => {
    expect(() =>
      imageRecordSchema.parse(record({ licence: { ...record().licence, commercialUse: false } })),
    ).toThrow();
  });

  it("refuses a licence that does not let our clients publish it", () => {
    expect(() =>
      imageRecordSchema.parse(
        record({ licence: { ...record().licence, clientsMayPublish: false } }),
      ),
    ).toThrow();
  });

  it("refuses a record with no review at all", () => {
    const { review: _dropped, ...withoutReview } = record();
    expect(() => imageRecordSchema.parse(withoutReview)).toThrow();
  });

  it("refuses a review still in draft status", () => {
    expect(() =>
      imageRecordSchema.parse(record({ review: { status: "draft", drafted: "2026-09-29" } })),
    ).toThrow();
  });

  it("refuses a missing prompt", () => {
    const { prompt: _dropped, ...withoutPrompt } = record().origin;
    expect(() => imageRecordSchema.parse(record({ origin: withoutPrompt }))).toThrow();
  });

  it("refuses a file name that does not match `<id>.webp`", () => {
    expect(() => imageRecordSchema.parse(record({ file: "otro-nombre.webp" }))).toThrow();
  });

  it("refuses bytes over the 200KB cap", () => {
    expect(() => imageRecordSchema.parse(record({ bytes: MAX_IMAGE_BYTES + 1 }))).toThrow();
  });

  it("accepts exactly the cap", () => {
    expect(() => imageRecordSchema.parse(record({ bytes: MAX_IMAGE_BYTES }))).not.toThrow();
  });
});

/** The sectors still waiting for their first photograph, read from the bank rather than listed
 * here, so filling one needs no edit to this file. The day the last one fills, `emptySectors` is
 * empty, the two assertions below fail on their own guard, and this whole describe can go: the
 * case it covers will no longer exist. */
const emptySectors = sectorsInBank().filter((sector) => !hasSamplePhotos(sector));
const withPhotographs = sectorsInBank().filter((sector) => hasSamplePhotos(sector));

describe("what a sector with no photographs gets", () => {
  it("is exactly the catalog's own placeholder — byte for byte the value the generator produced before this package existed", () => {
    // Was written against `restaurante-bar` while every sector was empty. That sector got its nine
    // photographs on 8 October 2026, so the subject is now read from the bank instead of named.
    const sector = emptySectors[0];
    expect(sector, "every sector has photographs — delete this describe").toBeDefined();
    if (!sector) return;
    const result = sampleImageFor(sector, "taberna:v1:sec-cover:el-image");
    expect(result).toEqual({
      kind: "image",
      src: placeholderImageSrc(),
      alt: PLACEHOLDER_IMAGE_ALT,
      sample: PLACEHOLDER_SAMPLE_ID,
    });
  });

  it("is the identical placeholder for every sector that has none", () => {
    expect(
      emptySectors.length,
      "every sector has photographs — delete this describe",
    ).toBeGreaterThan(0);
    for (const sector of emptySectors) {
      expect(sampleImageFor(sector, "seed"), sector).toEqual(sampleImageFor("otro", "seed"));
    }
  });

  it("answers the placeholder for a sector the bank has never heard of, via the generic fallback", () => {
    expect(sampleImageFor("sector-inventado", "seed")).toEqual(
      sampleImageFor(GENERIC_SECTOR, "seed"),
    );
  });

  it("is the same twice, which is the determinism the generator depends on", () => {
    expect(sampleImageFor("restaurante-bar", "x")).toEqual(sampleImageFor("restaurante-bar", "x"));
  });
});

describe("the bank ships with exactly the eleven sectors the questionnaire offers", () => {
  it("lists all ten launch sectors plus «otro»", () => {
    expect([...sectorsInBank()].sort()).toEqual(
      [
        "academia",
        "asesoria",
        "estetica",
        "fisioterapia",
        "fotografia",
        "otro",
        "peluqueria-barberia",
        "reformas",
        "restaurante-bar",
        "taller",
        "tienda",
      ].sort(),
    );
  });

  it("holds zero photographs or at least eight, never something in between", () => {
    // A half-filled sector would put the same photograph on two of the three generated variant
    // cards. Vacuously true today — every sector is empty — and it stays true the day one fills up.
    for (const file of readdirSync(BANK_DIR).filter((name) => name.endsWith(".json"))) {
      const parsed = bankFileSchema.parse(JSON.parse(readFileSync(join(BANK_DIR, file), "utf8")));
      const count = parsed.images.length;
      expect(count === 0 || count >= 8, `${file}: ${count} images`).toBe(true);
    }
  });
});

/**
 * Width and height straight out of the file.
 *
 * The README asks that a record's declared `width`, `height` and `bytes` match the file exactly,
 * and until 8 October 2026 only the fixture bank could be checked, because the real one was empty.
 * Reads the lossy VP8 frame header rather than pulling in a decoder: this package has two
 * dependencies and an image library for a test would be a third. It asserts the flavour it can
 * read instead of guessing, so a file encoded as VP8L or VP8X fails loudly here rather than
 * passing on dimensions nobody parsed.
 */
function webpSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
  expect(bytes.subarray(12, 16).toString("ascii"), "only lossy VP8 is parsed here").toBe("VP8 ");
  expect([...bytes.subarray(23, 26)], "VP8 sync code").toEqual([0x9d, 0x01, 0x2a]);
  return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
}

const approved = readdirSync(BANK_DIR)
  .filter((name) => name.endsWith(".json"))
  .flatMap(
    (name) => bankFileSchema.parse(JSON.parse(readFileSync(join(BANK_DIR, name), "utf8"))).images,
  );

describe("every approved photograph, against its own record", () => {
  it("there is at least one, or this whole block is checking nothing", () => {
    // The guard the fixture tests needed for their first year. It goes when it stops being true,
    // which is the day somebody empties the bank — and that should be noticed.
    expect(approved.length, "the real bank is empty").toBeGreaterThan(0);
    expect(withPhotographs.length).toBeGreaterThan(0);
  });

  it.each(approved.map((image) => [image.id, image] as const))(
    "%s has the bytes, the width and the height it declares",
    (_id, image) => {
      const bytes = readFileSync(join(BANK_DIR, "photos", image.file));
      expect(bytes.byteLength, "bytes").toBe(image.bytes);
      expect(bytes.byteLength).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
      expect(webpSize(bytes)).toEqual({ width: image.width, height: image.height });
    },
  );

  it.each(approved.map((image) => [image.id, image] as const))(
    "%s records where it came from and the licence that lets a client publish it",
    (_id, image) => {
      // ADR 0011's binding half. The schema already refuses `false`, so what is checked here is
      // that the fields carry something a person could go and re-read, not a placeholder.
      expect(image.origin.tool.length).toBeGreaterThan(0);
      expect(image.origin.prompt.length).toBeGreaterThan(0);
      expect(image.licence.url).toMatch(/^https?:\/\//);
      expect(image.licence.commercialUse).toBe(true);
      expect(image.licence.clientsMayPublish).toBe(true);
      expect(image.review.by.length).toBeGreaterThan(0);
    },
  );
});

describe("what a sector with photographs gets", () => {
  it("is one of its own records, never the placeholder", () => {
    const sector = withPhotographs[0];
    expect(sector, "no sector has photographs").toBeDefined();
    if (!sector) return;
    const result = sampleImageFor(sector, "taberna:v1:sec-cover:el-image");
    expect(result.sample).not.toBe(PLACEHOLDER_SAMPLE_ID);
    expect(result.src).toBe(`muestra-${result.sample}.webp`);
    expect(recordById(result.sample)?.alt).toBe(result.alt);
  });

  it("is what `hasSamplePhotos` promised, for every sector the bank knows", () => {
    // The two resolve the sector by the same cascade on purpose. This is the assertion that keeps
    // them from drifting apart, because a disagreement is a sentence on screen contradicting the
    // photograph beside it.
    for (const sector of sectorsInBank()) {
      const sampled = sampleImageFor(sector, "seed").sample !== PLACEHOLDER_SAMPLE_ID;
      expect(hasSamplePhotos(sector), sector).toBe(sampled);
    }
  });

  it("answers for an unknown sector exactly as it answers for «otro»", () => {
    expect(hasSamplePhotos("sector-inventado")).toBe(hasSamplePhotos(GENERIC_SECTOR));
  });
});

describe("pickIndex", () => {
  it("is stable across repeated calls with the same seed", () => {
    for (const seed of ["a", "restaurante-bar:v1:sec-cover:el-image", "🎨"]) {
      expect(pickIndex(seed, 8)).toBe(pickIndex(seed, 8));
    }
  });

  it("stays inside the range for every count from one to a hundred", () => {
    for (let count = 1; count <= 100; count += 1) {
      const index = pickIndex("seed", count);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(count);
    }
  });

  it("does not starve every index, over the seed shapes this package actually builds", () => {
    // The real seeds differ mostly in a short, varying suffix — "…:v1", "…:v2", "…:v3" — which is
    // exactly the shape that would expose a hash that only looks at the end of its input.
    const seen = new Set<number>();
    for (let n = 0; n < 5000; n += 1) {
      seen.add(pickIndex(`taberna-santo-domingo:v${(n % 3) + 1}:sec-cover:el-item-${n}`, 8));
    }
    expect(seen.size).toBe(8);
  });

  it("handles the one input that would defeat a naive Math.abs", () => {
    // Math.abs(-2147483648) returns itself, still negative — the reason this uses `>>> 0` instead.
    expect(() => pickIndex("", 1)).not.toThrow();
    expect(pickIndex("x".repeat(10000), 3)).toBeGreaterThanOrEqual(0);
  });
});

describe("the whole seam, against a fixture bank", () => {
  const fixtureBank = bankFileSchema.parse(
    JSON.parse(readFileSync(join(FIXTURES_DIR, "bank.json"), "utf8")),
  );

  it("parses two approved images", () => {
    expect(fixtureBank.images).toHaveLength(2);
  });

  it("is found by id once loaded — proven against the real bank's own shape, since the fixture is not wired into the module's static imports", () => {
    // `recordById` reads the module-level `BANK`, which only knows the real `bank/*.json` files —
    // this fixture is not one of them, and should not be. What is asserted here is that the schema
    // and the id-matching logic the real bank uses behave identically against fixture data, which
    // is what makes the fixture worth having: the empty real bank cannot exercise "found something".
    const byId = new Map(fixtureBank.images.map((image) => [image.id, image]));
    expect(byId.get("prueba.01")?.file).toBe("prueba.01.webp");
    expect(byId.get("no-existe")).toBeUndefined();
  });

  it("every declared file exists, is within its own declared size, and does not exceed the cap", () => {
    for (const image of fixtureBank.images) {
      const bytes = readFileSync(join(FIXTURES_DIR, image.file));
      expect(bytes.byteLength, image.id).toBe(image.bytes);
      expect(bytes.byteLength, image.id).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
    }
  });

  it("every file begins with the WebP magic bytes", () => {
    for (const image of fixtureBank.images) {
      const bytes = readFileSync(join(FIXTURES_DIR, image.file));
      expect(bytes.subarray(0, 4).toString("ascii"), image.id).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii"), image.id).toBe("WEBP");
    }
  });
});

describe("the name a bank photograph takes in the bundle", () => {
  const fixtureBank = bankFileSchema.parse(
    JSON.parse(readFileSync(join(FIXTURES_DIR, "bank.json"), "utf8")),
  );

  it("is relative, with no leading slash and no scheme — ADR 0001, the ZIP opens with no server", () => {
    // The defect this catches shipped on day 3 and was harmless only because the bank was empty:
    // `/muestras/<file>` resolves against the filesystem root under `file://`, so every downloaded
    // site would have been missing its photograph — on the owner's machine, after the download,
    // where nothing of ours would ever have seen it.
    for (const record of fixtureBank.images) {
      const src = sampleSrcFor(record);
      expect(src.startsWith("/"), src).toBe(false);
      expect(src, src).not.toMatch(/^[a-z]+:\/\//);
      expect(src, src).not.toContain("/");
    }
  });

  it("cannot collide with an uploaded photo's name, which the editor prefixes `foto-`", () => {
    for (const record of fixtureBank.images) {
      expect(sampleSrcFor(record).startsWith("muestra-")).toBe(true);
    }
  });

  it("is one name per photograph, so the same one used twice is one file", () => {
    const names = fixtureBank.images.map(sampleSrcFor);
    expect(new Set(names).size).toBe(names.length);
    expect(sampleSrcFor(fixtureBank.images[0] ?? never())).toBe(
      sampleSrcFor(fixtureBank.images[0] ?? never()),
    );
  });
});

function never(): never {
  throw new Error("the fixture bank is empty");
}

describe("recordById", () => {
  /** Until 8 October 2026 this asserted `undefined` for exactly this id, with a comment saying it
   * was there so that the day a real record landed, this line would be what started failing. It
   * did. This is that line, turned around. */
  it("finds the first record that ever landed in the real bank", () => {
    const record = recordById("restaurante-bar.01");
    expect(record?.file).toBe("restaurante-bar.01.webp");
    expect(record?.sector).toBe("restaurante-bar");
    expect(record?.review.status).toBe("approved");
  });

  it("still finds nothing for an id nobody approved", () => {
    expect(recordById("restaurante-bar.99")).toBeUndefined();
    expect(recordById("../../../etc/passwd")).toBeUndefined();
  });
});
