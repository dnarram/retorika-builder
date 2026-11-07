import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  bankFileSchema,
  draftBankFileSchema,
  type ImageRecord,
  isUnderTheFloor,
  MIN_COVER_HEIGHT,
  MIN_COVER_WIDTH,
} from "../src/schema.ts";

/**
 * A reviewed draft takes the place of an approved photograph **under the old one's id and file**
 * (sprint 34, the plan's decision 8, approved by David on 5 November 2026).
 *
 * `photos:approve` mints: the draft keeps the id `photos:intake` gave it and joins the bank beside
 * the others. That is right for a new photograph and wrong for the nine of `restaurante-bar`
 * (ADR 0035), because **a saved document names its photograph by file** — `src:
 * "muestra-restaurante-bar.03.webp"`, `sample: "restaurante-bar.03"` — and the editor fetches the
 * bytes by that id before every download. A regenerated photograph under a new id, with the old one
 * retired, would leave every saved site that used it undownloadable (`photosFailed`). So the record
 * keeps `id` and `file`, and takes everything else from the draft: its size and bytes, its `alt`
 * (ADR 0035: a changed frame is described again), its origin with the new `generated` and prompt,
 * its licence as re-read, and a review with the reviewer's name and today's date.
 *
 * It is the same act as an approval — a person's name, and the bytes moved with `git mv` — and it
 * refuses a picture under the floor **itself**, because the id it writes may be one of the nine the
 * schema still exempts: the exemption is for the photographs that were there, never for the ones
 * that replace them.
 */
export interface ReplaceInput {
  /** The approved photograph whose place is taken. */
  oldId: string;
  /** The draft `photos:intake` minted, reviewed against the list. */
  draftId: string;
  by: string;
  today: string;
  /** `packages/photobank`. */
  root: string;
  /** How the bytes move; `git mv -f` by default, over the old file, so the history shows the
   * draft's bytes arriving at the old name. */
  move?: (from: string, to: string) => void;
}

export interface Replaced {
  record: ImageRecord;
  /** The ids still under the floor in this sector once the replacement is written. */
  underFloor: string[];
}

export class ReplaceRefusal extends Error {
  override readonly name = "ReplaceRefusal";
}

function sectorOf(id: string): string {
  const sector = id.replace(/\.\d+$/, "");
  if (sector === id) throw new ReplaceRefusal(`"${id}" is not <sector>.NN`);
  return sector;
}

export function replace(input: ReplaceInput): Replaced {
  const sector = sectorOf(input.oldId);
  if (sectorOf(input.draftId) !== sector) {
    throw new ReplaceRefusal(
      `"${input.draftId}" is not of "${sector}": a photograph replaces one of its own sector`,
    );
  }
  if (input.by.trim() === "") throw new ReplaceRefusal("the reviewer's name is required");

  const bankPath = join(input.root, "bank", `${sector}.json`);
  const bank = bankFileSchema.parse(JSON.parse(readFileSync(bankPath, "utf8")));
  if (!bank.images.some((image) => image.id === input.oldId)) {
    throw new ReplaceRefusal(`"${input.oldId}" is not in ${bankPath}`);
  }
  const draftPath = join(input.root, "drafts", `${sector}.json`);
  if (!existsSync(draftPath)) throw new ReplaceRefusal(`no drafts for "${sector}" (${draftPath})`);
  const drafts = draftBankFileSchema.parse(JSON.parse(readFileSync(draftPath, "utf8")));
  const draft = drafts.images.find((image) => image.id === input.draftId);
  if (!draft) throw new ReplaceRefusal(`"${input.draftId}" is not in ${draftPath}`);
  if (isUnderTheFloor(draft)) {
    throw new ReplaceRefusal(
      `"${input.draftId}" is ${draft.width}x${draft.height}, under the ` +
        `${MIN_COVER_WIDTH}x${MIN_COVER_HEIGHT} floor (ADR 0035): regenerate it at 1600x1072`,
    );
  }

  const { review: _draftReview, ...fields } = draft;
  const record: ImageRecord = {
    ...fields,
    id: input.oldId,
    file: `${input.oldId}.webp`,
    review: { status: "approved", by: input.by.trim(), date: input.today },
  };
  const images = bank.images.map((image) => (image.id === input.oldId ? record : image));
  const nextBank = bankFileSchema.parse({ ...bank, images });

  const move =
    input.move ??
    ((from: string, to: string) =>
      execFileSync("git", ["mv", "-f", from, to], { cwd: input.root, stdio: "inherit" }));
  move(
    join(input.root, "drafts", "photos", draft.file),
    join(input.root, "bank", "photos", record.file),
  );
  writeFileSync(bankPath, `${JSON.stringify(nextBank, null, 2)}\n`);
  const remaining = drafts.images.filter((image) => image.id !== input.draftId);
  if (remaining.length === 0) unlinkSync(draftPath);
  else writeFileSync(draftPath, `${JSON.stringify({ ...drafts, images: remaining }, null, 2)}\n`);

  const underFloor = images.filter(isUnderTheFloor).map((image) => image.id);
  return { record, underFloor };
}
