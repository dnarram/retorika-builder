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

/** The four sections the catalog has today. A text knows exactly where it goes. */
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

export type SectorFile = z.infer<typeof sectorFileSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Suggestion = z.infer<typeof suggestionSchema>;
