import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bankFileSchema,
  type DraftImageRecord,
  draftImageRecordSchema,
  type ImageRecord,
} from "../src/schema.ts";

const PHOTOBANK = join(import.meta.dirname, "..");

/** Real bytes at 1600 x 1067 — over the floor, and a file the WebP parsers here can read. */
export const DRAFT_BYTES = readFileSync(join(import.meta.dirname, "fixtures", "prueba.01.webp"));

/**
 * A photobank root in a temporary directory: **a copy of the real `restaurante-bar` bank** and its
 * files, plus one reviewed draft whose bytes are `DRAFT_BYTES`.
 *
 * The real bank rather than a stand-in, because what `photos:replace` has to keep true is a fact
 * about the real one — a saved document names `muestra-restaurante-bar.03.webp` — and the editor's
 * download test (`apps/editor/test/download.test.ts`) builds on this root too. It is a copy, so the
 * tool's writes and moves never touch the repository.
 */
export function bankCopyWithDraft(draft: Partial<DraftImageRecord> = {}): {
  root: string;
  bank: ImageRecord[];
  draft: DraftImageRecord;
} {
  const root = mkdtempSync(join(tmpdir(), "photobank-replace-"));
  mkdirSync(join(root, "bank", "photos"), { recursive: true });
  mkdirSync(join(root, "drafts", "photos"), { recursive: true });

  const bank = bankFileSchema.parse(
    JSON.parse(readFileSync(join(PHOTOBANK, "bank", "restaurante-bar.json"), "utf8")),
  );
  writeFileSync(join(root, "bank", "restaurante-bar.json"), JSON.stringify(bank));
  for (const image of bank.images) {
    copyFileSync(
      join(PHOTOBANK, "bank", "photos", image.file),
      join(root, "bank", "photos", image.file),
    );
  }

  const first = bank.images[0];
  if (!first) throw new Error("bankCopyWithDraft: the real restaurante-bar bank is empty");
  const record = draftImageRecordSchema.parse({
    id: "restaurante-bar.10",
    sector: "restaurante-bar",
    alt: "Terraza con mesas redondas, sillas de mimbre y sombrillas abiertas, a la luz del atardecer.",
    file: "restaurante-bar.10.webp",
    width: 1600,
    height: 1067,
    bytes: DRAFT_BYTES.byteLength,
    origin: {
      tool: first.origin.tool,
      generated: "2026-11-06",
      prompt: "Terraza exterior con sillas de mimbre y sombrillas, luz de atardecer.",
    },
    licence: { ...first.licence, checked: "2026-11-06" },
    review: { status: "draft", drafted: "2026-11-06" },
    ...draft,
  });
  writeFileSync(
    join(root, "drafts", "restaurante-bar.json"),
    JSON.stringify({ sector: "restaurante-bar", images: [record] }),
  );
  writeFileSync(join(root, "drafts", "photos", record.file), DRAFT_BYTES);
  return { root, bank: bank.images, draft: record };
}
