import { crc32, deflateRawSync } from "node:zlib";
import { assertSafePath, type SiteBundle } from "./site.ts";

/**
 * Written by hand against node:zlib. This archive is handed to clients, so a hundred lines of
 * headers are a better trade than a supply chain.
 *
 * Deterministic by construction, for INV_5: a fixed timestamp, entries in sorted path order,
 * no extra fields, and a fixed deflate level. Two builds of the same document produce the
 * same bytes.
 */

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

/** 2.0: deflate. Nothing here needs ZIP64 or encryption. */
const VERSION_NEEDED = 20;
/**
 * High byte 3 says the external attributes carry a Unix mode, and they do: a regular file,
 * rw-r--r--. Declaring Unix with attributes of 0 is the classic mistake — unzip then
 * extracts every file as mode 000, unreadable until someone runs chmod.
 */
const VERSION_MADE_BY = (3 << 8) | VERSION_NEEDED;
const EXTERNAL_ATTRIBUTES = (0o100644 << 16) >>> 0;

/** 1980-01-01 00:00, the DOS epoch. A real clock here would break INV_5. */
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;

const STORED = 0;
const DEFLATED = 8;

/** No ZIP64: a site is nowhere near either limit, and hitting one should fail loudly. */
const MAX_ENTRIES = 0xffff;
const MAX_BYTES = 0xffffffff;

interface Entry {
  name: Buffer;
  method: number;
  crc: number;
  size: number;
  data: Uint8Array;
  offset: number;
}

/** A ZIP of bundle.files. The manifest is not in it. Deterministic for the same bundle. */
export function bundleToZip(bundle: SiteBundle): Uint8Array {
  const files = [...bundle.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (files.length > MAX_ENTRIES) throw new Error(`bundleToZip: too many files (${files.length})`);

  const chunks: Uint8Array[] = [];
  const entries: Entry[] = [];
  let offset = 0;
  let previous: string | undefined;

  for (const file of files) {
    // Checked here as well as in buildSite: a "../" entry is a zip-slip on the client's
    // machine, and a hand-assembled bundle never went through buildSite.
    assertSafePath(file.path);
    if (file.path === previous) throw new Error(`bundleToZip: duplicate path "${file.path}"`);
    previous = file.path;

    const deflated = deflateRawSync(file.contents, { level: 9 });
    const method = deflated.length < file.contents.length ? DEFLATED : STORED;
    const data = method === DEFLATED ? deflated : file.contents;
    const entry: Entry = {
      name: Buffer.from(file.path, "ascii"),
      method,
      crc: crc32(file.contents),
      size: file.contents.length,
      data,
      offset,
    };

    const header = Buffer.alloc(30);
    header.writeUInt32LE(LOCAL_HEADER, 0);
    header.writeUInt16LE(VERSION_NEEDED, 4);
    header.writeUInt16LE(0, 6); // flags
    header.writeUInt16LE(entry.method, 8);
    header.writeUInt16LE(DOS_TIME, 10);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(entry.crc, 14);
    header.writeUInt32LE(entry.data.length, 18);
    header.writeUInt32LE(entry.size, 22);
    header.writeUInt16LE(entry.name.length, 26);
    header.writeUInt16LE(0, 28); // extra field length

    chunks.push(header, entry.name, entry.data);
    offset += header.length + entry.name.length + entry.data.length;
    entries.push(entry);
  }

  const centralOffset = offset;
  for (const entry of entries) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(CENTRAL_HEADER, 0);
    header.writeUInt16LE(VERSION_MADE_BY, 4);
    header.writeUInt16LE(VERSION_NEEDED, 6);
    header.writeUInt16LE(0, 8); // flags
    header.writeUInt16LE(entry.method, 10);
    header.writeUInt16LE(DOS_TIME, 12);
    header.writeUInt16LE(DOS_DATE, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.data.length, 20);
    header.writeUInt32LE(entry.size, 24);
    header.writeUInt16LE(entry.name.length, 28);
    header.writeUInt16LE(0, 30); // extra field length
    header.writeUInt16LE(0, 32); // comment length
    header.writeUInt16LE(0, 34); // disk number
    header.writeUInt16LE(0, 36); // internal attributes
    header.writeUInt32LE(EXTERNAL_ATTRIBUTES, 38);
    header.writeUInt32LE(entry.offset, 42);

    chunks.push(header, entry.name);
    offset += header.length + entry.name.length;
  }
  if (offset > MAX_BYTES) throw new Error("bundleToZip: archive exceeds 4 GB, which needs ZIP64");

  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(0, 4); // this disk
  end.writeUInt16LE(0, 6); // disk with the central directory
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(offset - centralOffset, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20); // comment length
  chunks.push(end);

  // A plain Uint8Array rather than a Buffer, which may be a view into a shared pool.
  return new Uint8Array(Buffer.concat(chunks));
}
