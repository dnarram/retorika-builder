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

/** The two checks every record makes regardless of review status, applied after `.extend` so the
 * approved and draft shapes can each add their own `review` first — a `.refine` result cannot be
 * `.extend`ed afterwards. */
function withRecordChecks<
  Shape extends z.ZodObject<{ id: z.ZodString; file: z.ZodString; bytes: z.ZodNumber }>,
>(schema: Shape) {
  return schema
    .refine((record) => record.file === `${record.id}.webp`, {
      message: "file must be `<id>.webp`",
      path: ["file"],
    })
    .refine((record) => record.bytes <= MAX_IMAGE_BYTES, {
      message: `bytes exceeds the ${MAX_IMAGE_BYTES}-byte cap`,
      path: ["bytes"],
    });
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
