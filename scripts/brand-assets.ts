import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decode, encode, type Image } from "./png.ts";

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
      `perfil ${image.profile.map((c) => c.name).join("+") || "ninguno"}, ` +
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
