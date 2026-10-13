import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bankFileSchema, draftBankFileSchema, type ImageRecord } from "../src/schema.ts";

/**
 * The review, as the act ADR 0009 and ADR 0011 name it: the record moves from `drafts/` to
 * `bank/` with a person's name on it, and the file moves with `git mv`.
 *
 * It refuses to leave a sector with between one and seven photographs, because `bank.test.ts`
 * would — a sector holds zero or at least eight — unless `allowPartial` is set for the one case
 * that needs it: the nine of `restaurante-bar` leaving as nine new ones arrive (ADR 0035).
 */
export interface ApproveInput {
  id: string;
  by: string;
  today: string;
  /** `packages/photobank`. */
  root: string;
  allowPartial?: boolean;
  /** How the bytes move; `git mv` by default, so the history shows a rename and not a delete. */
  move?: (from: string, to: string) => void;
}

export class ApproveRefusal extends Error {
  override readonly name = "ApproveRefusal";
}

export function approve(input: ApproveInput): ImageRecord {
  const sector = input.id.replace(/\.\d+$/, "");
  if (sector === input.id) throw new ApproveRefusal(`"${input.id}" is not <sector>.NN`);
  const draftPath = join(input.root, "drafts", `${sector}.json`);
  if (!existsSync(draftPath)) throw new ApproveRefusal(`no drafts for "${sector}" (${draftPath})`);
  const drafts = draftBankFileSchema.parse(JSON.parse(readFileSync(draftPath, "utf8")));
  const draft = drafts.images.find((image) => image.id === input.id);
  if (!draft) throw new ApproveRefusal(`"${input.id}" is not in ${draftPath}`);
  if (input.by.trim() === "") throw new ApproveRefusal("the reviewer's name is required");

  const bankPath = join(input.root, "bank", `${sector}.json`);
  const bank = bankFileSchema.parse(JSON.parse(readFileSync(bankPath, "utf8")));
  const { review: _draftReview, ...fields } = draft;
  const approved: ImageRecord = {
    ...fields,
    review: { status: "approved", by: input.by.trim(), date: input.today },
  };
  const images = [...bank.images, approved].sort((a, b) => a.id.localeCompare(b.id));
  if (!input.allowPartial && images.length > 0 && images.length < 8) {
    throw new ApproveRefusal(
      `"${sector}" would hold ${images.length} photograph(s): a sector holds zero or at least eight. ` +
        "Approve the batch together, or pass --allow-partial for a transition you mean",
    );
  }
  const nextBank = bankFileSchema.parse({ ...bank, images });

  const move =
    input.move ??
    ((from: string, to: string) => execFileSync("git", ["mv", from, to], { stdio: "inherit" }));
  move(
    join(input.root, "drafts", "photos", draft.file),
    join(input.root, "bank", "photos", draft.file),
  );
  writeFileSync(bankPath, `${JSON.stringify(nextBank, null, 2)}\n`);
  const remaining = drafts.images.filter((image) => image.id !== input.id);
  if (remaining.length === 0) unlinkSync(draftPath);
  else writeFileSync(draftPath, `${JSON.stringify({ ...drafts, images: remaining }, null, 2)}\n`);
  return approved;
}
