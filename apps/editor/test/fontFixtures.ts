import { brotliCompressSync, deflateSync } from "node:zlib";

/**
 * Fonts built by hand for the inspection tests: the smallest sfnt, WOFF and WOFF2 that carry a
 * `name`, an `fvar` and an `OS/2` table — and nothing a browser would need to draw a glyph.
 *
 * **Why build them rather than ship them.** The repository has real static faces (the gallery's
 * woff2 and the corpus fixture's woff) and no variable font under a licence it could carry, and the
 * cases that matter most — a stream that lies about its size, a `name` table in Mac Roman, an axis
 * that starts at 500 — are not cases anyone ships. The containers below follow the specifications
 * closely enough that the real files and these walk the same code.
 */

export interface NameRecord {
  platform: number;
  encoding: number;
  language: number;
  nameId: number;
  text: string;
}

function utf16be(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 2);
  for (let index = 0; index < text.length; index += 1) {
    out[index * 2] = text.charCodeAt(index) >> 8;
    out[index * 2 + 1] = text.charCodeAt(index) & 0xff;
  }
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}

/** A `name` table, format 0. Mac Roman records are written as Latin-1, which is the same bytes for
 * the ASCII these tests use. */
export function nameTable(records: readonly NameRecord[]): Uint8Array {
  const strings = records.map((record) =>
    record.platform === 1 ? new TextEncoder().encode(record.text) : utf16be(record.text),
  );
  const header = new DataView(new ArrayBuffer(6 + records.length * 12));
  header.setUint16(2, records.length);
  header.setUint16(4, 6 + records.length * 12);
  let offset = 0;
  records.forEach((record, index) => {
    const at = 6 + index * 12;
    header.setUint16(at, record.platform);
    header.setUint16(at + 2, record.encoding);
    header.setUint16(at + 4, record.language);
    header.setUint16(at + 6, record.nameId);
    header.setUint16(at + 8, strings[index]?.byteLength ?? 0);
    header.setUint16(at + 10, offset);
    offset += strings[index]?.byteLength ?? 0;
  });
  return concat([new Uint8Array(header.buffer), ...strings]);
}

/** The usual family record: Windows, Unicode BMP, US English. */
export function family(text: string, nameId = 1): NameRecord {
  return { platform: 3, encoding: 1, language: 0x0409, nameId, text };
}

export interface Axis {
  tag: string;
  min: number;
  def: number;
  max: number;
}

/** An `fvar` table with these axes and no named instances. */
export function fvarTable(axes: readonly Axis[]): Uint8Array {
  const table = new DataView(new ArrayBuffer(16 + axes.length * 20));
  table.setUint16(0, 1);
  table.setUint16(4, 16);
  table.setUint16(8, axes.length);
  table.setUint16(10, 20);
  table.setUint16(14, 0);
  axes.forEach((axis, index) => {
    const at = 16 + index * 20;
    for (let char = 0; char < 4; char += 1) table.setUint8(at + char, axis.tag.charCodeAt(char));
    table.setInt32(at + 4, Math.round(axis.min * 65536));
    table.setInt32(at + 8, Math.round(axis.def * 65536));
    table.setInt32(at + 12, Math.round(axis.max * 65536));
  });
  return new Uint8Array(table.buffer);
}

/** An `OS/2` table, version 0's 78 bytes: the weight class and the italic bit are all it says. */
export function os2Table(weight: number, italic = false): Uint8Array {
  const table = new DataView(new ArrayBuffer(78));
  table.setUint16(4, weight);
  table.setUint16(62, italic ? 0x1 : 0x40);
  return new Uint8Array(table.buffer);
}

export type Tables = Readonly<Record<string, Uint8Array>>;

function tagBytes(tag: string): Uint8Array {
  return Uint8Array.from(tag, (char) => char.charCodeAt(0));
}

/** A TrueType (`0x00010000`) or OpenType (`OTTO`) file: the directory, then each table 4-aligned. */
export function sfnt(tables: Tables, flavor: "ttf" | "otf" = "ttf"): Uint8Array {
  const tags = Object.keys(tables).sort();
  const head = new DataView(new ArrayBuffer(12 + tags.length * 16));
  head.setUint32(0, flavor === "otf" ? 0x4f54544f : 0x00010000);
  head.setUint16(4, tags.length);
  let offset = 12 + tags.length * 16;
  const bodies: Uint8Array[] = [];
  tags.forEach((tag, index) => {
    const body = tables[tag] as Uint8Array;
    const at = 12 + index * 16;
    for (const [char, byte] of tagBytes(tag).entries()) head.setUint8(at + char, byte);
    head.setUint32(at + 8, offset);
    head.setUint32(at + 12, body.byteLength);
    const padded = new Uint8Array(Math.ceil(body.byteLength / 4) * 4);
    padded.set(body);
    bodies.push(padded);
    offset += padded.byteLength;
  });
  return concat([new Uint8Array(head.buffer), ...bodies]);
}

/** A WOFF 1.0 file: each table zlib-compressed on its own, or stored when that is not smaller.
 * `override` replaces one table's stored bytes and declared length, to build a lie. */
export function woff(
  tables: Tables,
  override?: { tag: string; stored: Uint8Array; origLength: number },
): Uint8Array {
  const tags = Object.keys(tables).sort();
  const head = new DataView(new ArrayBuffer(44 + tags.length * 20));
  head.setUint32(0, 0x774f4646);
  head.setUint32(4, 0x00010000);
  head.setUint16(12, tags.length);
  let offset = 44 + tags.length * 20;
  const bodies: Uint8Array[] = [];
  tags.forEach((tag, index) => {
    const original = tables[tag] as Uint8Array;
    const compressed = new Uint8Array(deflateSync(original));
    let stored = compressed.byteLength < original.byteLength ? compressed : original;
    let origLength = original.byteLength;
    if (override?.tag === tag) {
      stored = override.stored;
      origLength = override.origLength;
    }
    const at = 44 + index * 20;
    for (const [char, byte] of tagBytes(tag).entries()) head.setUint8(at + char, byte);
    head.setUint32(at + 4, offset);
    head.setUint32(at + 8, stored.byteLength);
    head.setUint32(at + 12, origLength);
    const padded = new Uint8Array(Math.ceil(stored.byteLength / 4) * 4);
    padded.set(stored);
    bodies.push(padded);
    offset += padded.byteLength;
  });
  head.setUint32(8, offset);
  return concat([new Uint8Array(head.buffer), ...bodies]);
}

const KNOWN = ["cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post"];

function base128(value: number): Uint8Array {
  const bytes: number[] = [value & 0x7f];
  let rest = Math.floor(value / 128);
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80);
    rest = Math.floor(rest / 128);
  }
  return Uint8Array.from(bytes);
}

/**
 * A WOFF2 file with every table untransformed, in one brotli stream. `fvar` is index 47 of the
 * specification's known tags; the rest of the eight above by their own index; anything else by an
 * explicit tag. `stream` and `totalSfntSize` replace what would be computed, to build a lie.
 */
export function woff2(
  tables: Tables,
  lie: { stream?: Uint8Array; totalSfntSize?: number; flavor?: number } = {},
): Uint8Array {
  const tags = Object.keys(tables);
  const directory: Uint8Array[] = [];
  for (const tag of tags) {
    const index = tag === "fvar" ? 47 : KNOWN.indexOf(tag);
    directory.push(
      index >= 0 ? Uint8Array.of(index) : concat([Uint8Array.of(63), tagBytes(tag)]),
      base128((tables[tag] as Uint8Array).byteLength),
    );
  }
  const plain = concat(tags.map((tag) => tables[tag] as Uint8Array));
  const stream = lie.stream ?? new Uint8Array(brotliCompressSync(plain));
  const dir = concat(directory);
  const head = new DataView(new ArrayBuffer(48));
  head.setUint32(0, 0x774f4632);
  head.setUint32(4, lie.flavor ?? 0x00010000);
  head.setUint32(8, 48 + dir.byteLength + stream.byteLength);
  head.setUint16(12, tags.length);
  head.setUint32(16, lie.totalSfntSize ?? 12 + tags.length * 16 + plain.byteLength + 64);
  head.setUint32(20, stream.byteLength);
  return concat([new Uint8Array(head.buffer), dir, stream]);
}
