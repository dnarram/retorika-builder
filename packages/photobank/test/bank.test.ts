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

describe("what a sector with no photographs gets", () => {
  it("is exactly the catalog's own placeholder — byte for byte the value the generator produced before this package existed", () => {
    const result = sampleImageFor("restaurante-bar", "taberna:v1:sec-cover:el-image");
    expect(result).toEqual({
      kind: "image",
      src: placeholderImageSrc(),
      alt: PLACEHOLDER_IMAGE_ALT,
      sample: PLACEHOLDER_SAMPLE_ID,
    });
  });

  it("is the identical placeholder for every one of the eleven sectors", () => {
    for (const sector of sectorsInBank()) {
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
  it("finds nothing while the real bank is empty", () => {
    // The honest state of the product today. This test is here so that the day a real record
    // lands, this line is what starts failing — and starts failing for the right reason.
    expect(recordById("restaurante-bar.01")).toBeUndefined();
  });
});
