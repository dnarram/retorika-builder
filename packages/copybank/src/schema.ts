import { z } from "zod";

/**
 * The shape of one sector's file, and the rules of ADR 0009 made checkable.
 *
 * The binding part of that ADR is that no text reaches a client's site without a person having
 * read it. `review.status` is how a file says that happened, and the schema refuses to load a
 * file that does not say it — so an unreviewed text cannot be published by accident, only by
 * someone writing "approved" over their own name.
 */

/** The closed placeholder list of ADR 0010. Nothing else may appear in a bank text. */
export const PLACEHOLDERS = ["negocio", "ciudad"] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

/**
 * The sections a bank text can be written for. A text knows exactly where it goes.
 *
 * Four, where the catalog now has six. The two it leaves out are not an oversight: `testimonials`
 * is born carrying instructions to the owner rather than copy (a plausible-looking invented review
 * is the one thing that section must never ship), and `footer` is built from question 1 and the
 * owner's own details, so there is nothing for a sector to say differently.
 */
export const SECTIONS = ["cover", "services", "location", "contact"] as const;

const reviewSchema = z.object({
  status: z.literal("approved"),
  /** The person who approved it, not the tool that drafted it. */
  by: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
});

const entrySchema = z
  .object({
    id: z.string().min(1),
    section: z.enum(SECTIONS),
    slot: z.string().min(1),
    text: z.string().min(1),
    placeholders: z.array(z.enum(PLACEHOLDERS)),
  })
  .refine(
    (entry) => entry.placeholders.every((name) => entry.text.includes(`{${name}}`)),
    "declares a placeholder its text does not use",
  )
  .refine((entry) => {
    const used = [...entry.text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
    return used.every((name) => entry.placeholders.includes(name as Placeholder));
  }, "uses a placeholder it does not declare");

const suggestionSchema = z.object({
  id: z.string().min(1),
  /** Shown as a tick box in question 3, and published as a card title. The same words. */
  title: z.string().min(1),
  /** Optional on purpose: a card with nothing true to add is better than an invented line. */
  description: z.string().min(1).optional(),
});

export const sectorFileSchema = z.object({
  sector: z.string().min(1),
  review: reviewSchema,
  entries: z.array(entrySchema),
  suggestions: z.array(suggestionSchema),
  /** The main button's words, by the action id question 5 collects. */
  actions: z.record(z.string(), z.string()),
});

/**
 * The same file before anyone has signed it — what lives in `drafts/`.
 *
 * It exists so that approving a draft is a one-word change that cannot fail: everything except the
 * signature is checked here, at the same strictness, by the test that walks `drafts/`. Without it
 * a draft would be an unvalidated blob and its first real parse would happen on the day someone
 * wrote "approved" over their own name, which is the worst possible moment to discover a
 * placeholder it declares but never uses.
 *
 * **No loader reads this.** `src/index.ts` imports from `bank/` only, and a test asserts it.
 *
 * There is no `by` field, and that is the point: nobody has approved it, so there is nobody to
 * name. ADR 0009's binding half is that a person reads the text before it ships, and an empty
 * signature line is how a draft says that has not happened yet.
 */
export const draftFileSchema = sectorFileSchema.extend({
  review: z.object({
    status: z.literal("draft"),
    drafted: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
  }),
});

export type SectorFile = z.infer<typeof sectorFileSchema>;
export type DraftFile = z.infer<typeof draftFileSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
