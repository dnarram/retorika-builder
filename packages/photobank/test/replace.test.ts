import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sampleSrcFor } from "../src/index.ts";
import { bankFileSchema, MIN_COVER_HEIGHT, MIN_COVER_WIDTH } from "../src/schema.ts";
import { readSampleBytes } from "../src/server.ts";
import { ReplaceRefusal, replace } from "../tools/replace.ts";
import { bankCopyWithDraft, DRAFT_BYTES } from "./bank-copy.ts";

/**
 * `photos:replace` (sprint 34 día 7): a reviewed draft takes the place of one of the nine of
 * `restaurante-bar` under the old id and file, so that a saved document — which names the
 * photograph by file — still downloads. Every case runs on a copy of the real bank.
 */

function bankAt(root: string) {
  return bankFileSchema.parse(
    JSON.parse(readFileSync(join(root, "bank", "restaurante-bar.json"), "utf8")),
  ).images;
}

const OLD = "restaurante-bar.03";
const DRAFT = "restaurante-bar.10";

describe("photos:replace", () => {
  it("writes the draft under the old id and file, with its size, alt, origin, licence and a review", () => {
    const { root, bank, draft } = bankCopyWithDraft();
    const moved: [string, string][] = [];
    const { record } = replace({
      oldId: OLD,
      draftId: DRAFT,
      by: "dnr",
      today: "2026-11-06",
      root,
      move: (from, to) => {
        moved.push([from, to]);
        renameSync(from, to);
      },
    });

    expect(record).toEqual({
      id: OLD,
      sector: "restaurante-bar",
      alt: draft.alt,
      file: `${OLD}.webp`,
      width: 1600,
      height: 1067,
      bytes: DRAFT_BYTES.byteLength,
      origin: draft.origin,
      licence: draft.licence,
      review: { status: "approved", by: "dnr", date: "2026-11-06" },
    });
    expect(moved).toEqual([
      [
        join(root, "drafts", "photos", `${DRAFT}.webp`),
        join(root, "bank", "photos", `${OLD}.webp`),
      ],
    ]);
    // The same ids, in the same order, and the one replaced is the record above.
    const after = bankAt(root);
    expect(after.map((image) => image.id)).toEqual(bank.map((image) => image.id));
    expect(after.find((image) => image.id === OLD)).toEqual(record);
    // The draft is spent: no record, no file, and no drafts file once it was the last.
    expect(existsSync(join(root, "drafts", "restaurante-bar.json"))).toBe(false);
    expect(existsSync(join(root, "bank", "photos", `${DRAFT}.webp`))).toBe(false);
  });

  it("leaves a saved document's photograph resolving, by its id and its src, to the new bytes", () => {
    // What a document saved before the replacement carries for the photograph, and what the editor
    // does with it before every download: `/api/muestras/<sample>` — the lookup, then the bytes.
    const saved = { kind: "image", src: "muestra-restaurante-bar.03.webp", sample: OLD } as const;
    const { root } = bankCopyWithDraft();
    replace({ oldId: OLD, draftId: DRAFT, by: "dnr", today: "2026-11-06", root, move: renameSync });

    const bank = bankAt(root);
    const lookup = (id: string) => bank.find((image) => image.id === id);
    const record = lookup(saved.sample);
    expect(record, `${saved.sample} is gone from the bank`).toBeDefined();
    if (!record) return;
    expect(sampleSrcFor(record)).toBe(saved.src);
    expect(
      Buffer.from(readSampleBytes(saved.sample, join(root, "bank", "photos"), lookup)),
    ).toEqual(DRAFT_BYTES);
    // And the draft's own id never reached the bank: nothing saved could name it.
    expect(lookup(DRAFT)).toBeUndefined();
  });

  it("says which photographs are still under the floor, and the replaced one is not among them", () => {
    const { root, bank } = bankCopyWithDraft();
    const { underFloor } = replace({
      oldId: OLD,
      draftId: DRAFT,
      by: "dnr",
      today: "2026-11-06",
      root,
      move: renameSync,
    });
    expect(underFloor).toEqual(
      bank
        .filter((image) => image.width < MIN_COVER_WIDTH || image.height < MIN_COVER_HEIGHT)
        .map((image) => image.id)
        .filter((id) => id !== OLD),
    );
  });

  it("moves the bytes with `git mv -f` over the old file when no `move` is given", () => {
    // A plain `git mv` refuses a destination that exists, and here it always does.
    const { root } = bankCopyWithDraft();
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "user.email=t@example.test", "-c", "user.name=t", ...args], {
        cwd: root,
        stdio: "pipe",
      }).toString();
    git("init", "-q");
    git("add", ".");
    git("commit", "-qm", "the bank before");
    replace({ oldId: OLD, draftId: DRAFT, by: "dnr", today: "2026-11-06", root });
    expect(
      git("status", "--short", "--", "bank/photos", "drafts/photos").split("\n").sort(),
    ).toEqual(["", `D  drafts/photos/${DRAFT}.webp`, `M  bank/photos/${OLD}.webp`].sort());
    expect(readFileSync(join(root, "bank", "photos", `${OLD}.webp`))).toEqual(DRAFT_BYTES);
  });

  it("refuses a picture under the floor even when the id it writes is one the schema exempts", () => {
    // The draft schema lets an exempt id through at 1024 x 1024, so only the tool stands between a
    // hand-written draft under that id and an undersized photograph back in the bank.
    const { root } = bankCopyWithDraft({
      id: OLD,
      file: `${OLD}.webp`,
      width: 1024,
      height: 1024,
    });
    const before = readFileSync(join(root, "bank", "restaurante-bar.json"), "utf8");
    let moved = false;
    expect(() =>
      replace({
        oldId: OLD,
        draftId: OLD,
        by: "dnr",
        today: "2026-11-06",
        root,
        move: () => {
          moved = true;
        },
      }),
    ).toThrow(/1024x1024, under the 1344x896 floor/);
    expect(moved).toBe(false);
    expect(readFileSync(join(root, "bank", "restaurante-bar.json"), "utf8")).toBe(before);
  });

  it("refuses an id the bank does not hold, a draft that is not there, another sector's, and no reviewer", () => {
    const { root } = bankCopyWithDraft();
    const attempt =
      (oldId: string, draftId: string, by = "dnr") =>
      () =>
        replace({ oldId, draftId, by, today: "2026-11-06", root, move: () => {} });
    expect(attempt("restaurante-bar.42", DRAFT)).toThrow(ReplaceRefusal);
    expect(attempt("restaurante-bar.42", DRAFT)).toThrow(/"restaurante-bar.42" is not in/);
    expect(attempt(OLD, "restaurante-bar.11")).toThrow(/"restaurante-bar.11" is not in/);
    expect(attempt(OLD, "taller.01")).toThrow(/replaces one of its own sector/);
    expect(attempt(OLD, DRAFT, "  ")).toThrow(/reviewer's name is required/);
    expect(attempt("restaurante-bar", DRAFT)).toThrow(/is not <sector>.NN/);
  });
});
