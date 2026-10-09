import { z } from "zod";

/**
 * The shape of one sample photograph's record, and ADR 0011 made checkable.
 *
 * The binding part of that ADR is the licence: a sample photo travels inside the client's ZIP and
 * they publish it on their own domain, so a licence that covers only Retorika's own use fails the
 * test however generous it looks. `commercialUse` and `clientsMayPublish` are `z.literal(true)`
 * rather than `z.boolean()` for exactly that reason — the schema refuses a record that says either
 * is false, or omits the field, rather than trusting a runtime check somebody has to remember to
 * call. Same for `review.status`: a file whose licence has not been re-read, or whose photograph
 * nobody has looked at, cannot parse.
 */

/** WebP, longest side 1600px, quality ~75, EXIF and XMP removed. 200KB is the cap; the origin
 * belongs in the record, not the file (ADR 0011). */
export const MAX_IMAGE_BYTES = 200 * 1024;

/**
 * The floor a photograph has to clear, and the exemption that expires (ADR 0035).
 *
 * ADR 0011 wrote «longest side 1600 px» under **Compression**, beside quality and EXIF removal, so
 * it reads as a ceiling and nothing ever checked the other end: a 400 px photograph would have
 * passed review exactly as the nine of `restaurante-bar` did.
 *
 * **Both numbers, not just the longest side.** The cover crops to a declared ratio with
 * `object-fit: cover`, which scales a source `w x h` into a box `W x H` by `max(W/w, H/h)` — so it
 * is upscaled unless `w >= W` *and* `h >= H`. The box is always landscape, so a tall photograph can
 * clear the floor on its height and still be stretched sideways. 1344 x 896 is the full-width cover
 * at a 1440 px window on the default scale (`space.xl` is 48 px, and the page has no maximum width,
 * which is why a floor is a choice of reference width rather than a bound — ADR 0035 has the table).
 */
export const MIN_COVER_WIDTH = 1344;
export const MIN_COVER_HEIGHT = 896;

/**
 * The nine of `restaurante-bar`, approved on 8 October 2026 under the old reading and allowed to
 * stay until they are regenerated at 1600 x 1072 (ADR 0035, David's decision).
 *
 * They stay published in the meantime because a sector holds zero photographs or at least eight:
 * emptying it would put the grey marker back on every restaurante-bar site until the new batch is
 * signed. The regenerated ones take new ids — approving a photograph mints an id and never changes
 * a file in place — so this list is what *permitted* these nine, and it is spent the moment no
 * record in the bank is under the floor.
 */
export const FLOOR_EXEMPT_IDS: ReadonlySet<string> = new Set([
  "restaurante-bar.01",
  "restaurante-bar.02",
  "restaurante-bar.03",
  "restaurante-bar.04",
  "restaurante-bar.05",
  "restaurante-bar.06",
  "restaurante-bar.07",
  "restaurante-bar.08",
  "restaurante-bar.09",
]);

/**
 * The first day the exemption is no longer accepted — `bank.test.ts` fails from this date while any
 * record in the bank is still under the floor.
 *
 * **The clock is deliberately not here.** `src/index.ts` parses all eleven sector files at module
 * load, inside a generator `INV_5` and the golden corpus require to be a pure function of its
 * arguments; a date-dependent parse would make a generated site depend on when it was generated. So
 * the refinement below is clock-free and this constant is read by a test, which is the one place
 * that can fail loudly without changing what the product produces.
 *
 * ADR 0035 names the cost rather than discovering it: on this date the test goes red on whatever
 * pull request is open, which is what a deadline that enforces itself does. The remedy is to
 * regenerate, never to move the date.
 */
export const FLOOR_EXEMPTION_FAILS_FROM = "2026-11-01";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

const originSchema = z.object({
  /** The tool and model, e.g. "Midjourney v6.1" — not just the tool, because a licence can differ
   * by model. */
  tool: z.string().min(1),
  generated: dateSchema,
  prompt: z.string().min(1),
});

const licenceSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  /** The date the terms were read, for **the exact tool and plan used**. Free plans routinely
   * carry different terms from paid ones, and terms themselves change — this is the version we
   * relied on. */
  checked: dateSchema,
  commercialUse: z.literal(true),
  clientsMayPublish: z.literal(true),
});

const approvedReviewSchema = z.object({
  status: z.literal("approved"),
  /** The person who approved it, never the tool that made it. */
  by: z.string().min(1),
  date: dateSchema,
});

const draftReviewSchema = z.object({
  status: z.literal("draft"),
  drafted: dateSchema,
});

/** Every field but `review`, which is where an approved record and a draft one differ — the same
 * split `packages/copybank/src/schema.ts` makes for a bank text. */
const imageFieldsSchema = z.object({
  id: z.string().min(1),
  sector: z.string().min(1),
  /** In Spanish, describing what is really in the photograph — reviewed like any bank text,
   * because it reaches a published page. */
  alt: z.string().min(1),
  file: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  origin: originSchema,
  licence: licenceSchema,
});

/** The three checks every record makes regardless of review status, applied after `.extend` so the
 * approved and draft shapes can each add their own `review` first — a `.refine` result cannot be
 * `.extend`ed afterwards. The floor (ADR 0035) is here rather than only on the approved shape for
 * the reason `draftImageRecordSchema` gives: approving is a `git mv` and nothing else, so a draft
 * that could never be approved has to fail while it is still a draft. */
function withRecordChecks<
  Shape extends z.ZodObject<{
    id: z.ZodString;
    file: z.ZodString;
    bytes: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
  }>,
>(schema: Shape) {
  return (
    schema
      .refine((record) => record.file === `${record.id}.webp`, {
        message: "file must be `<id>.webp`",
        path: ["file"],
      })
      .refine((record) => record.bytes <= MAX_IMAGE_BYTES, {
        message: `bytes exceeds the ${MAX_IMAGE_BYTES}-byte cap`,
        path: ["bytes"],
      })
      // No `path`: the failure can be either dimension, and naming one of them would send a reader to
      // the wrong number half the time. The message carries both.
      .refine(
        (record) =>
          FLOOR_EXEMPT_IDS.has(record.id) ||
          (record.width >= MIN_COVER_WIDTH && record.height >= MIN_COVER_HEIGHT),
        {
          message:
            `smaller than the ${MIN_COVER_WIDTH}x${MIN_COVER_HEIGHT} floor the full-width cover ` +
            `asks for (ADR 0035); regenerate it at 1600x1072`,
        },
      )
  );
}

export const imageRecordSchema = withRecordChecks(
  imageFieldsSchema.extend({ review: approvedReviewSchema }),
);

/**
 * The same record before anyone has signed it — what lives in `drafts/`.
 *
 * Everything except the signature is checked here, at the same strictness, so approving a draft
 * is a `git mv` and nothing else: a placeholder that declares the wrong file name, or a photograph
 * over the byte cap, fails before anyone has to notice by hand.
 */
export const draftImageRecordSchema = withRecordChecks(
  imageFieldsSchema.extend({ review: draftReviewSchema }),
);

/** One sector's file: its own images only. Born as `{ "sector": "…", "images": [] }` and stays
 * that shape however many photographs it eventually holds. */
export const bankFileSchema = z.object({
  sector: z.string().min(1),
  images: z.array(imageRecordSchema),
});

export const draftBankFileSchema = z.object({
  sector: z.string().min(1),
  images: z.array(draftImageRecordSchema),
});

export type ImageRecord = z.infer<typeof imageRecordSchema>;
export type DraftImageRecord = z.infer<typeof draftImageRecordSchema>;
export type BankFile = z.infer<typeof bankFileSchema>;
