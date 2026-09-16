import { z } from "zod";
import { roleSchema } from "./roles.ts";
import { styleValueSchema, themeSchema } from "./tokens.ts";

/**
 * Semver rather than an integer so the asymmetry of ADR 0004 is expressible: adding a
 * role or a token is additive and bumps the minor; removing or renaming one breaks and
 * bumps the major.
 */
export const SCHEMA_VERSION = "1.0.0";

const idSchema = z.string().min(1).max(128);

/** Every schema here is strict: an unknown key is rejected, never quietly carried. */

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/**
 * Phase-3 collections reference. Declared from day one because the advanced dossier
 * §11 requires the document to support collection references before the interface
 * exposes them — deciding it later means rewriting the editor.
 */
export const collectionRefSchema = z.strictObject({
  collectionId: idSchema,
  field: z.string().min(1),
});
export type CollectionRef = z.infer<typeof collectionRefSchema>;

const contentValueSchema = z.union([
  z.strictObject({ kind: z.literal("text"), text: z.string() }),
  z.strictObject({
    kind: z.literal("image"),
    /** Relative path or URL. The publisher rewrites it; the renderer escapes it. */
    src: z.string(),
    alt: z.string(),
  }),
  z.strictObject({
    kind: z.literal("link"),
    text: z.string(),
    href: z.string(),
  }),
  z.strictObject({
    kind: z.literal("map"),
    /** Published as a static image plus a link to the maps application (ADR 0004). */
    label: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  }),
  z.strictObject({
    kind: z.literal("embed"),
    /** Never emitted unless embeds are explicitly enabled. See ADR 0004. */
    payload: z.string(),
    label: z.string(),
  }),
  z.strictObject({
    kind: z.literal("field"),
    name: z.string().min(1),
    label: z.string(),
  }),
]);
export type ContentValue = z.infer<typeof contentValueSchema>;

export interface ContentElement {
  id: string;
  role: z.infer<typeof roleSchema>;
  /** Rule 3: within a section a role hides, it is never deleted. */
  hidden: boolean;
  slot: string;
  // Written as `| undefined` because exactOptionalPropertyTypes is on and the Zod
  // schema below produces optionals that may be present-and-undefined.
  value?: ContentValue | undefined;
  /** Only meaningful for the `list` container. */
  items?: { id: string; elements: ContentElement[] }[] | undefined;
  binding?: CollectionRef | undefined;
  style?: Record<string, z.infer<typeof styleValueSchema>> | undefined;
}

export const contentElementSchema: z.ZodType<ContentElement> = z.lazy(() =>
  z.strictObject({
    id: idSchema,
    role: roleSchema,
    hidden: z.boolean(),
    /** Which of the preset's declared slots this element fills. */
    slot: z.string().min(1),
    value: contentValueSchema.optional(),
    items: z
      .array(z.strictObject({ id: idSchema, elements: z.array(contentElementSchema) }))
      .optional(),
    binding: collectionRefSchema.optional(),
    style: z.record(z.string(), styleValueSchema).optional(),
  }),
);

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const GRID_COLUMNS = 12;

/**
 * Rule 4: positions are relative to the section's grid, never absolute on the page.
 * Rule 1: a placement references an element by id and never contains it.
 */
export const placementSchema = z.strictObject({
  elementId: idSchema,
  column: z.number().int().min(1).max(GRID_COLUMNS),
  columnSpan: z.number().int().min(1).max(GRID_COLUMNS),
  row: z.number().int().min(1),
  rowSpan: z.number().int().min(1),
});
export type Placement = z.infer<typeof placementSchema>;

/**
 * Rule 7: mobile is a patch over the automatic derivation, not a parallel tree.
 *
 * A patch may do exactly three things — hide, reorder, resize — and the type says so
 * rather than accepting a free-form object. Those are the three adjustments the concept
 * dossier promises on screen 5 ("Ocultar en móvil, cambiar el orden y reducir una foto.
 * Nada más"), and a closed shape is what stops the mobile view from quietly growing
 * into the second design this rule exists to prevent.
 */
export const breakpointPatchSchema = z.strictObject({
  elementId: idSchema,
  hidden: z.boolean().optional(),
  order: z.number().int().optional(),
  columnSpan: z.number().int().min(1).max(GRID_COLUMNS).optional(),
});
export type BreakpointPatch = z.infer<typeof breakpointPatchSchema>;

export const sectionLayoutSchema = z.strictObject({
  grid: z.strictObject({ columns: z.literal(GRID_COLUMNS) }),
  placements: z.array(placementSchema),
  breakpoints: z.strictObject({
    tablet: z.array(breakpointPatchSchema).optional(),
    mobile: z.array(breakpointPatchSchema).optional(),
  }),
});
export type SectionLayout = z.infer<typeof sectionLayoutSchema>;

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

export const sectionSchema = z.strictObject({
  id: idSchema,
  preset: z.strictObject({ catalogId: idSchema, variantId: idSchema }),
  /**
   * Advanced dossier §5: a section being free "no es un modo ni una casilla aparte: es
   * un dato, y por eso no puede desincronizarse de la realidad".
   */
  source: z.enum(["catalog", "free"]),
  content: z.array(contentElementSchema),
  /** null means "use the catalog preset's layout". */
  layout: sectionLayoutSchema.nullable(),
});
export type Section = z.infer<typeof sectionSchema>;

export const pageSchema = z.strictObject({
  id: idSchema,
  slug: z.string().min(1),
  title: z.string(),
  sections: z.array(sectionSchema),
});
export type Page = z.infer<typeof pageSchema>;

export const collectionSchema = z.strictObject({
  id: idSchema,
  name: z.string().min(1),
  entries: z.array(z.strictObject({ id: idSchema, fields: z.record(z.string(), z.string()) })),
});
export type Collection = z.infer<typeof collectionSchema>;

/**
 * The document describes a website. It does not describe who owns it, who paid for it,
 * or what they may do with it — see "What never enters the document" in
 * docs/document-rules.md. Strictness here is what makes that enforceable: a designTools
 * key is rejected rather than quietly carried, so depth cannot become a property of the
 * site instead of the person looking at it.
 */
export const documentSchema = z.strictObject({
  schemaVersion: z.string().min(1),
  id: idSchema,
  siteName: z.string(),
  theme: themeSchema,
  pages: z.array(pageSchema).min(1),
  collections: z.array(collectionSchema),
});
export type RetorikaDocument = z.infer<typeof documentSchema>;

/** Keys that must never appear in a document, each with where it belongs instead. */
export const FORBIDDEN_DOCUMENT_KEYS = {
  designTools: "the account — depth is a property of the person, never of the site",
  ownerId: "the database",
  locked: "the database",
  paymentStatus: "the database",
  subscription: "the database",
} as const;
