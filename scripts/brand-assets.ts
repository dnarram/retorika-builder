import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync, inflateSync } from "node:zlib";

/**
 * Turns the delivered brand logos into the files the application serves.
 *
 * **The originals arrive on a white background**, 100% opaque — measured, not assumed — and the
 * application draws its chrome on `#F5F7FA`. A white rectangle on light grey is a white rectangle,
 * so the background is removed here and the originals are kept untouched in `docs/design/brand/`
 * as what was actually delivered.
 *
 * Re-runnable on purpose: when a new logo arrives, replace the originals and run
 * `pnpm brand:assets` rather than hand-editing anything under `public/`.
 *
 * **How the background is removed, and why this way.** Every near-pure-white pixel becomes
 * transparent, wherever it is — not only the white reachable from the border.
 *
 * The first version did flood-fill inward from the edge, on the reasoning that an enclosed white
 * pixel might be a deliberate white element rather than background. Composited over a dark grey to
 * check, it was obviously wrong: **the counters of the letters stayed white**, so «Retorika
 * Builder» had white blobs inside every `o`, `e`, `a`, `B` and `R`. Measured afterwards, the
 * enclosed near-white is **5158 pixels in the lockup, all of them between x 190 and 842 — the text
 * — and 2 pixels in the mark**, a dot in the hammer that is invisible at any size this is drawn.
 *
 * So the rule that matches the input is simpler: **a logo delivered on an opaque white background
 * uses white only as background.** A deliberate white element could not have been expressed in
 * such a file anyway — it would be indistinguishable from the paper — so a logo that needs one has
 * to arrive with real transparency, and this script would need to be told.
 *
 * The tolerance stays tight, which leaves a hairline of pale pixels along the antialiased edge
 * rather than eating into the artwork. Feathering it would mean guessing the artwork's colour
 * underneath, and a guess on somebody's logo is worse than a hairline — one that is checked, in
 * `.scratch`, at the sizes these are actually drawn rather than at 1:1.
 */

const ROOT = join(import.meta.dirname, "..");
const SOURCE = join(ROOT, "docs", "design", "brand");
const SERVED = join(ROOT, "apps", "editor", "public", "brand");
const ICON = join(ROOT, "apps", "editor", "src", "app");

/** Anything this close to white, and reachable from the border, is background. */
const TOLERANCE = 6;

interface Image {
  width: number;
  height: number;
  data: Buffer;
}

function decode(path: string): Image {
  const buf = readFileSync(path);
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  const idat: Buffer[] = [];
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
  return { width, height, data: out };
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

function encode(image: Image): Buffer {
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
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Every near-white pixel, wherever it sits. See the note above for why connectivity is not used. */
function clearBackground(image: Image): { cleared: number; total: number } {
  const { width, height, data } = image;
  let cleared = 0;
  for (let i = 0; i < width * height; i += 1) {
    const near =
      (data[i * 4] as number) >= 255 - TOLERANCE &&
      (data[i * 4 + 1] as number) >= 255 - TOLERANCE &&
      (data[i * 4 + 2] as number) >= 255 - TOLERANCE;
    if (!near) continue;
    data[i * 4 + 3] = 0;
    cleared += 1;
  }
  return { cleared, total: width * height };
}

mkdirSync(SERVED, { recursive: true });

const jobs = [
  { from: "LogoOficialRetorikaBuilder.png", to: join(SERVED, "retorika-mark.png") },
  { from: "LogoOficialRetorikaBuilderTexto.png", to: join(SERVED, "retorika-lockup.png") },
] as const;

for (const job of jobs) {
  const image = decode(join(SOURCE, job.from));
  const { cleared, total } = clearBackground(image);
  const bytes = encode(image);
  writeFileSync(job.to, bytes);
  console.log(
    `${job.from} → ${job.to.slice(job.to.indexOf("apps/editor"))}  ` +
      `${image.width}×${image.height}, ${((cleared / total) * 100).toFixed(1)}% transparente, ` +
      `${(bytes.length / 1024).toFixed(0)} KB  sha ${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}`,
  );
}

// Next's App Router serves `app/icon.png` as the favicon with no markup at all, which is why the
// mark is written there as well as to `public/brand/`: one file is the tab, the other is the one
// the interface references by path.
const icon = decode(join(SOURCE, jobs[0].from));
clearBackground(icon);
writeFileSync(join(ICON, "icon.png"), encode(icon));
console.log(`${jobs[0].from} → apps/editor/src/app/icon.png  (the tab icon Next serves itself)`);
