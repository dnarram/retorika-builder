import { brotliDecompressSync, inflateSync } from "node:zlib";
import type { OwnFontFormat } from "@retorika/schema";
import {
  type FontKind,
  isOwnFontFormat,
  MAX_FONT_EXPANDED_BYTES,
  sanitiseFamily,
  sniffFont,
} from "./fontBytes.ts";

/**
 * What a font file the owner uploaded says about itself: the family its `name` table gives, the
 * weight range its `fvar` axis declares, and the format it really is (ADR 0056, sprint 29 día 5).
 *
 * **Server-only, and that is the reason it exists apart from `fontBytes.ts`.** A WOFF2 keeps every
 * table — `name` and `fvar` among them — inside one brotli stream, and a browser has no brotli to
 * hand a script; a WOFF compresses each table with zlib. Node has both. The route
 * `/api/fuentes/inspeccionar` is the only caller, and `scripts/secrets-scope.ts` would say so if a
 * `"use client"` module ever reached this file through an import.
 *
 * **Every expansion is bounded before it starts**, which is David's adjustment 1 (27 October 2026):
 *
 * - **WOFF2**: the whole stream is decompressed at once — the tables are not separable inside it —
 *   with `maxOutputLength` set to the exact length the directory adds up to, which must itself fit
 *   inside the header's `totalSfntSize` and inside `MAX_FONT_EXPANDED_BYTES`. A stream that asks for
 *   more stops at the cap and the file is «no es una fuente»; nothing past the cap is ever allocated
 *   (`fontInspect.test.ts` watches the decompressor's own output on a stream that declares 1 KB and
 *   expands to 50 MB).
 * - **WOFF**: each table is its own zlib stream, and only `name`, `fvar` and `OS/2` are inflated,
 *   each with `maxOutputLength` equal to the `origLength` its directory entry declares.
 * - **TrueType and OpenType** are read in place: nothing is compressed.
 *
 * **Reading foreign bytes, every read is bounds-checked** and a read past the end is a
 * `MalformedFont`, which is the one exception `inspectFont` turns into a refusal. Anything else that
 * throws is a defect of this file and is let through, so a bug cannot hide as «no es una fuente».
 */

export interface FontInspection {
  format: OwnFontFormat;
  /** The family as the file names it: `name` ID 16 (Typographic Family) when present, else ID 1. */
  name: string;
  /** That name made writable into CSS (`sanitiseFamily`), `""` when nothing survives. */
  sanitised: string;
  /** Whether the file is a variable font at all — an `fvar` table — whatever its axes. */
  hasFvar: boolean;
  /** The `wght` axis' range, `[min, max]` in whole weights within 1–1000, or `null` without one. */
  wght: [number, number] | null;
  /** `OS/2.usWeightClass`, which tells a regular file from a bold one; `null` without the table. */
  weight: number | null;
  /** `OS/2.fsSelection` bit 0: the file is an italic, and every line set in it would lean. */
  italic: boolean;
  bytes: number;
}

export type InspectionRefusal = "notAFont" | "collection";

export type InspectionResult =
  | { ok: true; font: FontInspection }
  | { ok: false; reason: InspectionRefusal };

/** A read the file's own structure does not support: past its end, a length that cannot be, a
 * stream that expands beyond what it declared. */
export class MalformedFont extends Error {}

/** The three tables the inspection reads. Everything else stays compressed, or unread. */
const WANTED = ["name", "fvar", "OS/2"] as const;
type Wanted = (typeof WANTED)[number];
type Tables = Partial<Record<Wanted, Uint8Array>>;

function isWanted(tag: string): tag is Wanted {
  return (WANTED as readonly string[]).includes(tag);
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function need(bytes: Uint8Array, offset: number, length: number): void {
  if (offset < 0 || length < 0 || offset + length > bytes.byteLength) {
    throw new MalformedFont(`read of ${length} at ${offset} past ${bytes.byteLength}`);
  }
}

function u8(bytes: Uint8Array, at: number): number {
  need(bytes, at, 1);
  return bytes[at] as number;
}

function u16(bytes: Uint8Array, at: number): number {
  need(bytes, at, 2);
  return view(bytes).getUint16(at);
}

function u32(bytes: Uint8Array, at: number): number {
  need(bytes, at, 4);
  return view(bytes).getUint32(at);
}

/** OpenType's `Fixed`: a signed 16.16 number. */
function fixed(bytes: Uint8Array, at: number): number {
  need(bytes, at, 4);
  return view(bytes).getInt32(at) / 65536;
}

function tag(bytes: Uint8Array, at: number): string {
  need(bytes, at, 4);
  return String.fromCharCode(...bytes.subarray(at, at + 4));
}

function slice(bytes: Uint8Array, offset: number, length: number): Uint8Array {
  need(bytes, offset, length);
  return bytes.subarray(offset, offset + length);
}

// ---------------------------------------------------------------------------
// The three containers
// ---------------------------------------------------------------------------

/** TrueType and OpenType: a directory of `(tag, checksum, offset, length)` and the tables in place. */
function sfntTables(bytes: Uint8Array): Tables {
  const count = u16(bytes, 4);
  const tables: Tables = {};
  for (let index = 0; index < count; index += 1) {
    const at = 12 + index * 16;
    const name = tag(bytes, at);
    if (isWanted(name)) tables[name] = slice(bytes, u32(bytes, at + 8), u32(bytes, at + 12));
  }
  return tables;
}

/**
 * Inflate one table, refusing to produce a byte more than it declared. `inflateSync` stops at
 * `maxOutputLength` with `ERR_BUFFER_TOO_LARGE` rather than allocating the rest — measured on
 * 27 October 2026 against a stream of 50 MB of zeros: no allocation past the cap.
 */
function inflateTable(compressed: Uint8Array, origLength: number): Uint8Array {
  if (origLength > MAX_FONT_EXPANDED_BYTES) {
    throw new MalformedFont(`a table declares ${origLength} bytes`);
  }
  let out: Uint8Array;
  try {
    out = inflateSync(compressed, { maxOutputLength: Math.max(origLength, 1) });
  } catch (error) {
    throw new MalformedFont(`a table does not inflate to its length: ${String(error)}`);
  }
  if (out.byteLength !== origLength) {
    throw new MalformedFont(`a table inflated to ${out.byteLength}, declared ${origLength}`);
  }
  return out;
}

/** WOFF 1.0: a 44-byte header, then entries of `(tag, offset, compLength, origLength, checksum)`;
 * a table whose `compLength` equals its `origLength` is stored as it is. */
function woffTables(bytes: Uint8Array): Tables {
  const count = u16(bytes, 12);
  const tables: Tables = {};
  for (let index = 0; index < count; index += 1) {
    const at = 44 + index * 20;
    const name = tag(bytes, at);
    if (!isWanted(name)) continue;
    const offset = u32(bytes, at + 4);
    const compLength = u32(bytes, at + 8);
    const origLength = u32(bytes, at + 12);
    const stored = slice(bytes, offset, compLength);
    if (compLength === origLength) tables[name] = stored;
    else if (compLength < origLength) tables[name] = inflateTable(stored, origLength);
    else throw new MalformedFont(`"${name}" is longer compressed than whole`);
  }
  return tables;
}

/**
 * The 63 tags a WOFF2 directory names by index, in the order the specification lists them
 * (W3C WOFF2 §5.1, «Known Table Tags»). Index 63 means the tag follows as four bytes.
 */
// biome-ignore format: 63 tags read best in the specification's own rows of twelve
const WOFF2_KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca",
  "prep", "CFF ", "VORG", "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea",
  "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL",
  "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat",
  "Gloc", "Feat", "Sill",
] as const;

/** WOFF2's variable-length integer: up to five bytes, seven bits each, no leading zero byte, and
 * nothing that overflows 32 bits. */
function base128(bytes: Uint8Array, at: number): { value: number; next: number } {
  let value = 0;
  for (let index = 0; index < 5; index += 1) {
    const byte = u8(bytes, at + index);
    if (index === 0 && byte === 0x80) throw new MalformedFont("UIntBase128 with a leading zero");
    if (value >= 2 ** 25) throw new MalformedFont("UIntBase128 overflows 32 bits");
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: at + index + 1 };
  }
  throw new MalformedFont("UIntBase128 longer than five bytes");
}

/**
 * WOFF2: a 48-byte header, a directory of variable-length entries, and then **one brotli stream
 * holding every table**, concatenated in directory order with no padding — each one
 * `transformLength` long where it is transformed (only `glyf`, `loca` and `hmtx` ever are), else
 * `origLength`. So the stream is decompressed whole, and the directory walk accumulates those
 * lengths to find where `name` and `fvar` begin (David's adjustment 1).
 */
function woff2Tables(bytes: Uint8Array): Tables {
  const count = u16(bytes, 12);
  const totalSfntSize = u32(bytes, 16);
  const totalCompressedSize = u32(bytes, 20);
  if (totalSfntSize > MAX_FONT_EXPANDED_BYTES) {
    throw new MalformedFont(`declares ${totalSfntSize} bytes uncompressed`);
  }

  const entries: { tag: string; start: number; length: number; transformed: boolean }[] = [];
  let at = 48;
  let streamLength = 0;
  for (let index = 0; index < count; index += 1) {
    const flags = u8(bytes, at);
    at += 1;
    const known = flags & 0x3f;
    const version = flags >> 6;
    let name: string;
    if (known === 63) {
      name = tag(bytes, at);
      at += 4;
    } else {
      const fromTable = WOFF2_KNOWN_TAGS[known];
      if (fromTable === undefined) throw new MalformedFont(`unknown table index ${known}`);
      name = fromTable;
    }
    const orig = base128(bytes, at);
    at = orig.next;
    // `glyf` and `loca` are transformed unless their version is 3; every other table is
    // transformed unless its version is 0 (WOFF2 §5.1).
    const transformed = name === "glyf" || name === "loca" ? version !== 3 : version !== 0;
    let length = orig.value;
    if (transformed) {
      const transform = base128(bytes, at);
      at = transform.next;
      length = transform.value;
    }
    entries.push({ tag: name, start: streamLength, length, transformed });
    streamLength += length;
  }

  // The tightest bound the file itself gives: the stream is exactly the tables it lists, and those
  // must fit in what the header declared — which is itself under the absolute ceiling above.
  if (streamLength > totalSfntSize) {
    throw new MalformedFont(`its tables add up to ${streamLength}, beyond ${totalSfntSize}`);
  }
  let stream: Uint8Array;
  try {
    stream = brotliDecompressSync(slice(bytes, at, totalCompressedSize), {
      maxOutputLength: Math.max(streamLength, 1),
    });
  } catch (error) {
    throw new MalformedFont(`the table stream does not decompress to its length: ${String(error)}`);
  }
  if (stream.byteLength !== streamLength) {
    throw new MalformedFont(`the stream is ${stream.byteLength} bytes, declared ${streamLength}`);
  }

  const tables: Tables = {};
  for (const entry of entries) {
    if (!isWanted(entry.tag)) continue;
    // `name`, `fvar` and `OS/2` have no transform defined; one that claims to be transformed is a
    // file nothing could decode.
    if (entry.transformed) throw new MalformedFont(`"${entry.tag}" claims a transform`);
    tables[entry.tag] = slice(stream, entry.start, entry.length);
  }
  return tables;
}

// ---------------------------------------------------------------------------
// The three tables
// ---------------------------------------------------------------------------

const UTF16BE = new TextDecoder("utf-16be");
const MAC_ROMAN = new TextDecoder("macintosh");

/** Which record of a name to prefer: Windows Unicode in US English, then any Windows Unicode, then
 * the Unicode platform, then Mac Roman in English. Lower is better; `undefined` is not read. */
function preference(platform: number, encoding: number, language: number): number | undefined {
  if (platform === 3 && (encoding === 1 || encoding === 10)) return language === 0x0409 ? 0 : 1;
  if (platform === 0) return 2;
  if (platform === 1 && encoding === 0 && language === 0) return 3;
  return undefined;
}

/** The family the `name` table gives: ID 16 (Typographic Family, which keeps «Bold» out of a
 * family's name in a file with more than four weights) when present, else ID 1. */
function readFamily(table: Uint8Array | undefined): string {
  if (table === undefined) return "";
  const count = u16(table, 2);
  const strings = u16(table, 4);
  const best = new Map<number, { score: number; text: string }>();
  for (let index = 0; index < count; index += 1) {
    const at = 6 + index * 12;
    const nameId = u16(table, at + 6);
    if (nameId !== 1 && nameId !== 16) continue;
    const score = preference(u16(table, at), u16(table, at + 2), u16(table, at + 4));
    if (score === undefined) continue;
    const current = best.get(nameId);
    if (current !== undefined && current.score <= score) continue;
    const raw = slice(table, strings + u16(table, at + 10), u16(table, at + 8));
    const text = (u16(table, at) === 1 ? MAC_ROMAN : UTF16BE).decode(raw).trim();
    if (text !== "") best.set(nameId, { score, text });
  }
  return best.get(16)?.text ?? best.get(1)?.text ?? "";
}

/**
 * The `wght` axis' range, as whole weights a `font-weight` descriptor can hold: the minimum rounded
 * up and the maximum down, inside 1–1000. A variable font without that axis — width only, say — has
 * `fvar` and no range, and is treated as the static face its default instance is.
 */
function readWght(table: Uint8Array | undefined): [number, number] | null {
  if (table === undefined) return null;
  const axesAt = u16(table, 4);
  const count = u16(table, 8);
  const size = u16(table, 10);
  if (size < 20) throw new MalformedFont(`an fvar axis record of ${size} bytes`);
  for (let index = 0; index < count; index += 1) {
    const at = axesAt + index * size;
    if (tag(table, at) !== "wght") continue;
    const min = Math.max(1, Math.ceil(fixed(table, at + 4)));
    const max = Math.min(1000, Math.floor(fixed(table, at + 12)));
    return min <= max ? [min, max] : null;
  }
  return null;
}

function readOs2(table: Uint8Array | undefined): { weight: number | null; italic: boolean } {
  if (table === undefined) return { weight: null, italic: false };
  return { weight: u16(table, 4), italic: (u16(table, 62) & 0x1) === 1 };
}

// ---------------------------------------------------------------------------

function tablesOf(bytes: Uint8Array, format: OwnFontFormat): Tables {
  switch (format) {
    case "woff2":
      return woff2Tables(bytes);
    case "woff":
      return woffTables(bytes);
    case "ttf":
    case "otf":
      return sfntTables(bytes);
  }
}

/**
 * The inspection, or the refusal. The sniff runs first and nothing is decompressed before it says
 * the bytes are one of the four formats: a collection and markup are refused on their first bytes.
 */
export function inspectFont(bytes: Uint8Array): InspectionResult {
  const kind: FontKind = sniffFont(bytes);
  if (kind === "collection") return { ok: false, reason: "collection" };
  if (!isOwnFontFormat(kind)) return { ok: false, reason: "notAFont" };
  try {
    const tables = tablesOf(bytes, kind);
    const name = readFamily(tables.name);
    const { weight, italic } = readOs2(tables["OS/2"]);
    return {
      ok: true,
      font: {
        format: kind,
        name,
        sanitised: sanitiseFamily(name),
        hasFvar: tables.fvar !== undefined,
        wght: readWght(tables.fvar),
        weight,
        italic,
        bytes: bytes.byteLength,
      },
    };
  } catch (error) {
    if (error instanceof MalformedFont) return { ok: false, reason: "notAFont" };
    throw error;
  }
}
