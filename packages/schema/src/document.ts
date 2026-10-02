import { z } from "zod";
import { type MarkRun, marksSchema, markTextIssue } from "./marks.ts";
import { roleSchema } from "./roles.ts";
import { siteUrlIssue } from "./siteUrl.ts";
import { SLUG_PATTERN } from "./slug.ts";
import { type ElementStyle, elementStyleSchema, themeSchema } from "./tokens.ts";

/**
 * Semver rather than an integer so the asymmetry of ADR 0004 is expressible: adding a
 * role or a token is additive and bumps the minor; removing or renaming one breaks and
 * bumps the major.
 */
export const SCHEMA_VERSION = "1.6.0";

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

/**
 * The bounds check for marked runs, applied to every value that carries a `text`.
 *
 * **A plain text and a link both get it, and that is ADR 0027 §6 rather than an oversight.** A mark
 * is a property of the value, not of the role, so the renderer splits every text the same way and
 * there is exactly one path through the one piece of this product that escapes a string in pieces.
 * Forbidding marks on a button's label would buy a second path through that code, which is a worse
 * trade than an unused capability. The editor draws `B` and `I` only where they mean something,
 * which is an interface choice and reversible.
 */
function withinText(
  value: { text: string; marks?: MarkRun[] | undefined },
  ctx: z.RefinementCtx,
): void {
  const issue = markTextIssue(value.text, value.marks);
  if (issue) ctx.addIssue({ code: "custom", message: `Marks do not fit this text: ${issue}.` });
}

const contentValueSchema = z.union([
  z
    .strictObject({
      kind: z.literal("text"),
      text: z.string(),
      /** Rule 6's neighbour: emphasis inside a text, as offsets beside it rather than markup in
       * it (ADR 0024, ADR 0027). Absent on every document written before 1.3.0. */
      marks: marksSchema.optional(),
    })
    .superRefine(withinText),
  z.strictObject({
    kind: z.literal("image"),
    /** Relative path or URL. The publisher rewrites it; the renderer escapes it. */
    src: z.string(),
    alt: z.string(),
    /**
     * Which sample this photograph is, when it is not the owner's own (ADR 0011).
     *
     * Absent means the owner put it there. Present means nobody did: it is the catalog's grey
     * marker (`"marcador"`) or, once `packages/photobank` has images, that image's bank id. The
     * editor reads it to label the photo, to count what is still missing and to warn before a
     * download; **the renderer never emits it**, so a published page is byte for byte the same
     * with it or without it, and nothing marks a sample photo inside the downloaded site.
     *
     * A field rather than a thing deduced from `src`, because the document saying what it carries
     * is what survives a src convention changing underneath it — and because the obligation is
     * one line and enforceable: replacing the photo removes the field (`setElementImageSrc`,
     * with its own test). ADR 0011 asked for exactly this, and for the migration it costs.
     */
    sample: z.string().min(1).optional(),
  }),
  z
    .strictObject({
      kind: z.literal("link"),
      text: z.string(),
      href: z.string(),
      marks: marksSchema.optional(),
    })
    .superRefine(withinText),
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
  /** Rule 6: references to the system, and a marked exception where somebody left it. */
  style?: ElementStyle | undefined;
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
    style: elementStyleSchema.optional(),
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
  /**
   * One bucket, and that is the decision rather than the current state of things (ADR 0030).
   *
   * **`tablet` was accepted here and the renderer threw on it**, so a document carrying a tablet
   * patch could be built, stored and autosaved, and then refused at the one moment it mattered —
   * the download. A shape that admits what nothing can publish is an invalid state the schema was
   * holding open, and closing it is cheaper than teaching four places to step around it.
   *
   * The advanced dossier §4 promises «Escritorio, tablet y móvil, editables». This does not keep
   * that promise and does not pretend to: it belongs with «control por dispositivo» in phase 3, and
   * ADR 0030 says so where somebody will find it.
   */
  breakpoints: z.strictObject({
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
  /**
   * What this page's file is called, and the one thing about a page the owner never sees
   * (ADR 0022). Checked here rather than in the publisher, which is where these rules used to
   * live: a slug becomes a file name at the very end, so a bad one surfaced as a 500 at the
   * moment of download instead of as a validation error where it was written.
   */
  slug: z
    .string()
    .regex(SLUG_PATTERN, "a slug is lowercase letters, digits and hyphens, and starts with one"),
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
  /**
   * The sentence a shared link shows, when the owner wrote one (ADR 0029).
   *
   * **Absent is the ordinary state and not a gap.** The renderer falls back to the cover's
   * subheadline, so this holds a sentence only when somebody chose a different one — derived rather
   * than copied, which is ADR 0022's principle and means there is nothing to keep in step.
   *
   * Bounded rather than free, because every stored string in this document is: no scraper shows
   * anything near 300 characters, so the cap is about what the document may hold and not about what
   * reads well, which is the editor's business.
   */
  siteDescription: z.string().max(300).optional(),
  /**
   * The origin the owner says their site will be served from, which is what makes an absolute
   * `og:image` and `og:url` possible from a ZIP (ADR 0029).
   *
   * **Not `buildSite`'s `baseUrl`, and the two must not be conflated.** That one says where *this
   * build* is being served from and is omitted for a download; this one says where the owner is
   * going to put the files. Reading one as the other would put a sitemap in a ZIP.
   */
  siteUrl: z
    .string()
    .optional()
    .refine((value) => value === undefined || siteUrlIssue(value) === undefined, {
      message: "siteUrl must be an https origin and nothing else, e.g. https://midominio.es",
    }),
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
