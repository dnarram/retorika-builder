import {
  PLACEHOLDER_IMAGE_ALT,
  PLACEHOLDER_SAMPLE_ID,
  placeholderImageSrc,
} from "@retorika/catalog";
import academiaJson from "../bank/academia.json" with { type: "json" };
import asesoriaJson from "../bank/asesoria.json" with { type: "json" };
import esteticaJson from "../bank/estetica.json" with { type: "json" };
import fisioterapiaJson from "../bank/fisioterapia.json" with { type: "json" };
import fotografiaJson from "../bank/fotografia.json" with { type: "json" };
import otroJson from "../bank/otro.json" with { type: "json" };
import peluqueriaBarberiaJson from "../bank/peluqueria-barberia.json" with { type: "json" };
import reformasJson from "../bank/reformas.json" with { type: "json" };
import restauranteBarJson from "../bank/restaurante-bar.json" with { type: "json" };
import tallerJson from "../bank/taller.json" with { type: "json" };
import tiendaJson from "../bank/tienda.json" with { type: "json" };
import { bankFileSchema, type ImageRecord } from "./schema.ts";

/**
 * Reading the bank (ADR 0011), and the one photograph a caller always gets back.
 *
 * **The generator runs in the browser** — `Variants.tsx` calls it client-side, the same reason
 * `packages/copybank` gives for importing its files rather than reading them off disk: "the
 * generator runs inside a bundled application, and a filesystem path would work on a laptop and
 * fail once deployed." That is what shapes this file. The eleven sector files are imported
 * statically, one line each, rather than discovered by reading a directory — a loader that lists
 * files needs `node:fs`, which this module must never touch. `src/server.ts` is the separate
 * module that does; see the note there and `test/browser-safe.test.ts`, which guards the boundary.
 *
 * **Eleven files exist from day one, every one of them `{ "sector": "…", "images": [] }`.** That
 * is what lets the first photograph of a sector be a data change and not a code one: if a sector's
 * file only appeared once it had an image, adding the first image to any sector would mean adding
 * an import line, which is exactly the coupling this design exists to avoid.
 */

export const GENERIC_SECTOR = "otro";

const FILES: readonly unknown[] = [
  academiaJson,
  asesoriaJson,
  esteticaJson,
  fisioterapiaJson,
  fotografiaJson,
  otroJson,
  peluqueriaBarberiaJson,
  reformasJson,
  restauranteBarJson,
  tallerJson,
  tiendaJson,
];

/**
 * Sorted by id at load time, so the choice below never depends on the order a sector's file
 * happens to list its images in — only on the id, which is stable once an image is approved.
 */
const BANK: ReadonlyMap<string, readonly ImageRecord[]> = new Map(
  FILES.map((file) => {
    const parsed = bankFileSchema.parse(file);
    return [parsed.sector, [...parsed.images].sort((a, b) => a.id.localeCompare(b.id))];
  }),
);

/** Every image record in the bank, across every sector, keyed by id. `src/server.ts` uses this to
 * turn a `sample` field back into bytes — the id is looked up here, in the parsed and validated
 * bank, and the filename comes from the record it finds. The caller's string is never turned
 * straight into a path. */
const BY_ID: ReadonlyMap<string, ImageRecord> = new Map(
  [...BANK.values()].flatMap((images) => images.map((image) => [image.id, image] as const)),
);

export function recordById(id: string): ImageRecord | undefined {
  return BY_ID.get(id);
}

/**
 * A stable index into a list of `count` items, from a text seed.
 *
 * FNV-1a over the seed's characters — no clock, no randomness, sorted input on the caller's side —
 * because the generator this feeds is deterministic by design (no clock, no randomness): the
 * golden corpus and `INV_5` both depend on "same answers, same site" staying true. `>>> 0` folds
 * the signed 32-bit hash into an unsigned one before the modulo, which is what keeps this correct
 * at the one input that would otherwise misbehave (`Math.abs` on the minimum 32-bit integer
 * returns itself, still negative).
 *
 * Exported on its own so it is testable without a bank at all.
 */
export function pickIndex(seed: string, count: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % count;
}

export interface SampleImage {
  kind: "image";
  src: string;
  alt: string;
  sample: string;
}

/**
 * The name a bank photograph takes **inside the published bundle**, which is what the document
 * carries as its `src`.
 *
 * **Relative, with no leading slash, and that is not a detail.** ADR 0001: a downloaded site has to
 * work when opened by double-clicking, with no server. Under `file://` an absolute `/muestras/x.webp`
 * resolves against the filesystem root and the photograph is simply missing — on the owner's
 * machine, after the download, where nothing of ours is watching. The first version of this file
 * wrote exactly that, and it was harmless only because the bank was empty; the first approved
 * photograph would have shipped broken sites.
 *
 * Same shape as an uploaded photo's name (`photoSrcFor` in `apps/editor`), for the same reasons: a
 * flat file beside the HTML, stable so the same photograph used twice is one file and not two, and
 * prefixed so the two kinds can never collide. The bank's id is already unique across every sector,
 * and the record's own `file` is `<id>.webp`, so this is unique by construction.
 */
export function sampleSrcFor(record: ImageRecord): string {
  return `muestra-${record.file}`;
}

/**
 * The photograph a sector should show, for a given seed — **and it never answers "nothing"**.
 *
 * That is the whole point of the design: with an empty bank this falls back to the catalog's own
 * placeholder, byte for byte the value `packages/generator` already produced before this package
 * existed. The day real images land in `bank/<sector>.json`, no call site changes — the fallback
 * moved *inside* the bank instead of living in whoever asks, which is what makes "images arrive as
 * data" true rather than aspirational.
 *
 * An unknown sector falls through to `"otro"`'s file, the same cascade `packages/copybank` uses.
 *
 * The seed is the caller's to compose, and it is meant to include everything that already has to
 * be a pure input: which variant (`"v1"`/`"v2"`/`"v3"`, so the three do not repeat each other),
 * which section, which element — so a gallery's eight photographs are eight different ones rather
 * than the same one eight times.
 */
export function sampleImageFor(sector: string, seed: string): SampleImage {
  const images = BANK.get(sector) ?? BANK.get(GENERIC_SECTOR) ?? [];
  if (images.length === 0) {
    return {
      kind: "image",
      src: placeholderImageSrc(),
      alt: PLACEHOLDER_IMAGE_ALT,
      sample: PLACEHOLDER_SAMPLE_ID,
    };
  }
  const record = images[pickIndex(seed, images.length)];
  if (!record) throw new Error(`sampleImageFor: index out of range for sector "${sector}"`);
  return { kind: "image", src: sampleSrcFor(record), alt: record.alt, sample: record.id };
}

/**
 * Whether this sector's owner will actually be shown sample photographs.
 *
 * The question the interface has to ask before it says anything about photographs, and the
 * counterpart of `packages/copybank`'s `servesSector` — asked of the bank that is *loaded*, which
 * is `bank/` and never `drafts/`, so a sector whose photographs are generated but unsigned still
 * answers `false`. What its owner would get is the empty marker, and that is what the screen has
 * to describe.
 *
 * **It resolves the sector exactly as `sampleImageFor` does**, generic fallback included, rather
 * than looking the sector up directly. That is deliberate: these two must never be able to
 * disagree, because every disagreement is a sentence on screen contradicting the picture beside
 * it. An unknown sector falls through to «otro» in both, so both answer for the same file.
 */
export function hasSamplePhotos(sector: string): boolean {
  const images = BANK.get(sector) ?? BANK.get(GENERIC_SECTOR) ?? [];
  return images.length > 0;
}

/** Every sector the bank has a file for, mostly for tests. */
export function sectorsInBank(): readonly string[] {
  return [...BANK.keys()];
}

export type { BankFile, DraftImageRecord, ImageRecord } from "./schema.ts";
export {
  bankFileSchema,
  draftBankFileSchema,
  draftImageRecordSchema,
  imageRecordSchema,
  MAX_IMAGE_BYTES,
} from "./schema.ts";
