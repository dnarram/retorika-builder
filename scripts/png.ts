import { readFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

/**
 * The two halves of a PNG reader and writer that `brand-assets.ts` carried on its own since the
 * logo arrived, so that `brand-vector.ts` can read the same originals without a second copy of
 * the filter arithmetic. **8-bit RGBA only**, on purpose: that is what the delivered logos are,
 * and the error below says so rather than quietly decoding something else.
 */

export interface Image {
  width: number;
  height: number;
  data: Buffer;
  /**
   * The colour-profile chunks the file carried (`iCCP`, `cICP`), raw, so `encode` can write them
   * back. The delivered logos are tagged Display P3, and a PNG written without the tag is read as
   * sRGB: the same bytes, a visibly paler blue. Found on 13 October 2026 while tracing the logo,
   * when the served mark measured sixteen levels per channel away from the delivered one on screen.
   */
  profile: { name: string; body: Buffer }[];
}

export function decode(path: string): Image {
  const buf = readFileSync(path);
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  const idat: Buffer[] = [];
  const profile: { name: string; body: Buffer }[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const name = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8] as number;
      colour = data[9] as number;
    } else if (name === "IDAT") idat.push(data);
    else if (name === "iCCP" || name === "cICP") profile.push({ name, body: Buffer.from(data) });
    else if (name === "IEND") break;
    pos += 12 + len;
  }
  if (depth !== 8 || colour !== 6) {
    throw new Error(`${path}: expected 8-bit RGBA, got depth ${depth} colour type ${colour}`);
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const out = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p++] as number;
    const line = raw.subarray(p, p + stride);
    p += stride;
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= 4 ? (cur[x - 4] as number) : 0;
      const b = prev[x] as number;
      const c = x >= 4 ? (prev[x - 4] as number) : 0;
      let v = line[x] as number;
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const guess = a + b - c;
        const da = Math.abs(guess - a);
        const db = Math.abs(guess - b);
        const dc = Math.abs(guess - c);
        v += da <= db && da <= dc ? a : db <= dc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { width, height, data: out, profile };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(name: string, body: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const named = Buffer.concat([Buffer.from(name, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(named));
  return Buffer.concat([head, named, crc]);
}

export function encode(image: Image): Buffer {
  const stride = image.width * 4;
  // Filter 0 on every scanline: these are flat-colour logos, so the clever filters buy little and
  // a reader that can be checked by eye is worth more here than a few kilobytes.
  const raw = Buffer.alloc(image.height * (stride + 1));
  for (let y = 0; y < image.height; y += 1) {
    raw[y * (stride + 1)] = 0;
    image.data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    ...image.profile.map((c) => chunk(c.name, c.body)),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
