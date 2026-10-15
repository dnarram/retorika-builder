import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { decode, encode, type Image } from "./png.ts";

/**
 * Puts the brand files the application serves where it serves them from.
 *
 * **Since 15 October 2026 the application serves the vectors**, which `pnpm brand:vector` traced
 * from the delivered PNGs and which live beside them in `docs/design/brand/`. This copies them into
 * `public/brand/` and writes the favicon, and that division is deliberate: `brand-vector.ts` owns
 * what the logo *is* and knows nothing about where the app keeps its files; this one owns where the
 * app keeps its files and knows nothing about tracing. **Two scripts writing one directory is the
 * drift the README warns about**, so there is one writer of `apps/editor/public/`, and it is here.
 *
 * The lockup went from 137 KB of PNG to 44 KB of SVG — 21 KB on the wire — and the mark from 41 to
 * 18; both are now drawn from shapes rather than from pixels four to eight times larger than the
 * box they are painted into.
 *
 * **The favicon is the exception and stays a PNG.** Safari does not render an SVG favicon, and at
 * 32 pixels there is nothing a vector would win. It is the one file here still made rather than
 * copied, which is why the background removal below is still needed:
 *
 * **The originals arrive on a white background**, 100% opaque — measured, not assumed — and a tab
 * icon with a white rectangle behind it is a white rectangle. The originals are kept untouched in
 * `docs/design/brand/` as what was actually delivered.
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

/**
 * The two vectors, copied rather than made: `pnpm brand:vector` is what writes them, from the
 * delivered PNGs, and re-tracing them here would be a second opinion about the same logo.
 *
 * The gzipped size is logged because it is the number that reaches a reader — `next start`
 * compresses, and an SVG is text, so the file on disk is roughly twice what travels.
 */
const VECTORS = ["retorika-mark.svg", "retorika-lockup.svg"] as const;

for (const name of VECTORS) {
  const from = join(SOURCE, name);
  copyFileSync(from, join(SERVED, name));
  const bytes = readFileSync(from);
  console.log(
    `${name} → apps/editor/public/brand/${name}  ` +
      `${(bytes.length / 1024).toFixed(1)} KB, ${(gzipSync(bytes).length / 1024).toFixed(1)} KB comprimido  ` +
      `sha ${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}`,
  );
}

/*
 * Next's App Router serves `app/icon.png` as the favicon with no markup at all. It is the only
 * pixels the application still serves of this logo, and it stays pixels on purpose: Safari does not
 * render an SVG favicon, and 32 is not a size a vector wins at.
 */
const ORIGINAL_MARK = "LogoOficialRetorikaBuilder.png";
const icon = decode(join(SOURCE, ORIGINAL_MARK));
const { cleared, total } = clearBackground(icon);
const bytes = encode(icon);
writeFileSync(join(ICON, "icon.png"), bytes);
console.log(
  `${ORIGINAL_MARK} → apps/editor/src/app/icon.png  ` +
    `${icon.width}×${icon.height}, ${((cleared / total) * 100).toFixed(1)}% transparente, ` +
    `perfil ${icon.profile.map((c) => c.name).join("+") || "ninguno"}, ` +
    `${(bytes.length / 1024).toFixed(0)} KB  sha ${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}` +
    "  (el icono de la pestaña, que Next sirve por convención)",
);
