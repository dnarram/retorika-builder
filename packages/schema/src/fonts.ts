import { z } from "zod";
import type { RetorikaDocument } from "./document.ts";
import { FONT_FAMILY_PATTERN, FONT_GALLERY, FONT_KINDS, GENERIC_OF } from "./fontGallery.ts";

/**
 * A font the owner brought: the record of a face that travels in the ZIP as a photograph does
 * (ADR 0056).
 *
 * **What this is, and what it is not.** ADR 0032 §2 made «tipografías propias» unexpressible because
 * the phrase then meant *typing a family name* — a face nobody ships, a letter the visitor may never
 * see. This is the other thing the phrase can mean: a file the owner uploaded, sniffed and inspected
 * by the editor's server, that leaves in the ZIP beside the page. The visitor receives it, so naming
 * it is honest for the same reason naming a gallery family is (ADR 0046 §1). A theme still holds a
 * stack and never a file: the stack names the family, and the renderer mints the file's name from
 * this record's `id` and the face's `role`, never from anything the owner typed.
 *
 * **Shape, not bytes.** The bytes live in the browser (IndexedDB, día 5) and with the account (the
 * `fuentes` bucket, día 6), the way a photograph's do. The document says which faces exist, what
 * format each one is, and that the owner declared a licence — and nothing about where the bytes are.
 */

/** The four formats a file may be, as uploaded, never converted. The server sniffs the bytes and
 * writes the format it found; the extension the owner's file had is not consulted. */
export const OWN_FONT_FORMATS = ["woff2", "woff", "ttf", "otf"] as const;
export type OwnFontFormat = (typeof OWN_FONT_FORMATS)[number];

/** A licence text the owner attached beside the font, optional, in one of two formats. */
export const OWN_LICENCE_FORMATS = ["txt", "pdf"] as const;
export type OwnLicenceFormat = (typeof OWN_LICENCE_FORMATS)[number];

/** Minted in the editor with `crypto.getRandomValues`: eight lower-case hex digits. The file names
 * are built from it, so it has exactly the alphabet `escape.ts`'s file pattern admits. */
export const OWN_FONT_ID_PATTERN = /^[0-9a-f]{8}$/;

/** One or two faces — a regular, a regular and a bold, or one variable file — and never more:
 * `--font-heading` and `--font-body` are the only two readers, and ADR 0046 §4's argument that a
 * family means the same thing in a headline and in the line under it is what rules out a bold alone. */
export const MAX_OWN_FONTS = 2;

const weightSchema = z.number().int().min(1).max(1000);

const regularFaceSchema = z.strictObject({
  role: z.literal("regular"),
  format: z.enum(OWN_FONT_FORMATS),
});

const boldFaceSchema = z.strictObject({
  role: z.literal("bold"),
  format: z.enum(OWN_FONT_FORMATS),
});

/**
 * A variable face declares the range `fvar`'s `wght` axis actually has — `[min, max]`, both read
 * from the file — and the renderer emits exactly that (`font-weight: 300 800`), never `100 <max>`
 * (David, 27 October 2026). What the face *covers* is derived from the range rather than stored:
 * see `ownFontCovers`.
 */
const variableFaceSchema = z.strictObject({
  role: z.literal("variable"),
  format: z.enum(OWN_FONT_FORMATS),
  wght: z
    .tuple([weightSchema, weightSchema])
    .refine(([min, max]) => min <= max, { message: "wght must be [min, max] with min <= max" }),
});

/** Discriminated on `role`, so a refusal names the field that is wrong rather than «invalid input». */
export const ownFontFaceSchema = z.discriminatedUnion("role", [
  regularFaceSchema,
  boldFaceSchema,
  variableFaceSchema,
]);
export type OwnFontFace = z.infer<typeof ownFontFaceSchema>;

/** The three shapes `faces` may take, as the sequence of roles. Closed: a bold without a regular,
 * a variable beside a static, or the same role twice are all refused rather than interpreted. */
const FACE_SHAPES = ["regular", "regular,bold", "variable"] as const;

/**
 * The CSS generic families and the keywords a stack may end in. A font named `serif` would be
 * written as `'serif'`, which CSS reads as a family and not as the generic, and every reader of the
 * stack would have to know that. Refused at the name, case-insensitively, as CSS matches names.
 */
const CSS_GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "inherit",
  "initial",
  "unset",
  "revert",
  "default",
]);

const GALLERY_NAMES = new Set(FONT_GALLERY.map((row) => row.family.toLowerCase()));

/**
 * Why a family name cannot be an own font's, or `undefined` when it can.
 *
 * **Case-insensitive on purpose**: a browser matches `font-family` names without regard to case, so
 * an own font called `inter` would be matched by the gallery's `@font-face` for `Inter` — or the
 * other way round — and which face a visitor got would depend on rule order. The editor (día 5) asks
 * this before writing the record and resolves a taken name with a numeral, shown to the owner.
 */
export function ownFamilyIssue(
  family: string,
  others: readonly Pick<OwnFont, "family">[] = [],
): string | undefined {
  if (!FONT_FAMILY_PATTERN.test(family)) {
    return "a family name is ASCII letters and digits in space-separated words";
  }
  const lower = family.toLowerCase();
  if (CSS_GENERIC_FAMILIES.has(lower)) return `"${family}" is a CSS keyword, not a family name`;
  if (GALLERY_NAMES.has(lower)) return `"${family}" is a family this product already ships`;
  if (others.some((other) => other.family.toLowerCase() === lower)) {
    return `"${family}" is already another own font's name`;
  }
  return undefined;
}

export const ownFontSchema = z.strictObject({
  id: z.string().regex(OWN_FONT_ID_PATTERN, "an own font id is eight lower-case hex digits"),
  /**
   * The name that travels: read from the file's `name` table by the editor's server, sanitised to
   * `FONT_FAMILY_PATTERN`, and shown to the owner as the name their site will use. It is what the
   * theme's stack names first, so it is compared with the gallery exactly as the renderer compares
   * a stack with a row — which is why it may not be a row's name.
   */
  family: z
    .string()
    .min(1)
    .max(64)
    .superRefine((family, ctx) => {
      const issue = ownFamilyIssue(family);
      if (issue !== undefined) ctx.addIssue({ code: "custom", message: issue });
    }),
  /** Its species, for the chooser's chips and for the generic keyword its stack falls back to. */
  kind: z.enum(FONT_KINDS),
  faces: z
    .array(ownFontFaceSchema)
    .min(1)
    .max(2)
    .refine(
      (faces) => (FACE_SHAPES as readonly string[]).includes(faces.map((f) => f.role).join(",")),
      {
        message: "faces are [regular], [regular, bold] or [variable], in that order",
      },
    ),
  /**
   * The owner's declaration, and it is a literal `true` rather than a boolean: a record with
   * `declared: false` is not a font with a problem, it is a font the product may not publish, so the
   * shape that admits it is refused (David's condition 4, 27 October 2026). `at` is when they said
   * so. The publisher checks this again on its own (ADR 0056 §6), because a bundle built from a
   * hand-assembled document must refuse for the same reason a parsed one does.
   */
  licence: z.strictObject({
    declared: z.literal(true),
    at: z.iso.datetime(),
  }),
  /** Whether a licence text the owner attached travels beside the font, and in which format. */
  licenceFile: z.enum(OWN_LICENCE_FORMATS).optional(),
});
export type OwnFont = z.infer<typeof ownFontSchema>;

/**
 * The document's own fonts: at most two, each with a name no other has.
 *
 * Uniqueness is checked here rather than in `checkInvariants` because it is a property of this
 * array alone, and the gallery collision is checked per font above for the same reason.
 */
export const ownFontsSchema = z
  .array(ownFontSchema)
  .max(MAX_OWN_FONTS)
  .superRefine((fonts, ctx) => {
    // Each font's own name was judged above; what only the array can see is two of them colliding.
    for (const [index, font] of fonts.entries()) {
      const before = fonts.slice(0, index);
      if (before.some((other) => other.family.toLowerCase() === font.family.toLowerCase())) {
        ctx.addIssue({
          code: "custom",
          path: [index, "family"],
          message: `"${font.family}" is already another own font's name`,
        });
      }
    }
    const ids = new Set(fonts.map((font) => font.id));
    if (ids.size !== fonts.length) {
      ctx.addIssue({ code: "custom", message: "two own fonts share an id" });
    }
  });

/**
 * Which of the two weights the page reads a font covers, **derived from the faces and never
 * stored**: a regular is 400, a bold is 700, and a variable face covers a weight only if its `wght`
 * range includes it (David's adjustment 4). A font that starts at 500 has no «Normal», and the
 * editor says so rather than letting the browser pick the nearest.
 */
export function ownFontCovers(font: Pick<OwnFont, "faces">): { regular: boolean; bold: boolean } {
  let regular = false;
  let bold = false;
  for (const face of font.faces) {
    if (face.role === "regular") regular = true;
    else if (face.role === "bold") bold = true;
    else {
      const [min, max] = face.wght;
      if (min <= 400 && 400 <= max) regular = true;
      if (min <= 700 && 700 <= max) bold = true;
    }
  }
  return { regular, bold };
}

/**
 * The document with one more font the owner brought, checked as the parser would check it: at most
 * two, each name free (sprint 29 día 5). It throws rather than returning the document unchanged —
 * a caller that offered a third font, or a taken name, has a bug the owner must not discover in the
 * ZIP. The theme is not touched: choosing the font for a half is `setTheme`'s, and the editor makes
 * the two one step.
 */
export function addOwnFont(doc: RetorikaDocument, font: OwnFont): RetorikaDocument {
  const fonts = [...(doc.fonts ?? []), ownFontSchema.parse(font)];
  const parsed = ownFontsSchema.safeParse(fonts);
  if (!parsed.success) {
    throw new Error(`addOwnFont: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  return { ...doc, fonts: parsed.data };
}

const FONT_TOKENS = ["font.heading", "font.body"] as const;

/** The first family of a stack, unquoted: the renderer's own reading. */
function firstFamilyOf(stack: string): string {
  return (stack.split(",")[0] ?? "").trim().replace(/^['"]|['"]$/g, "");
}

/**
 * The document without one of its own fonts — «Quitar» in the letter chooser (sprint 29 día 5).
 *
 * **Every stack that names it first loses it**, which is the property ADR 0056 §8 says the schema
 * cannot check and the verb that removes a font must keep: a stack naming a family nobody ships is
 * the state ADR 0028 prevents. What is left is the fallback chain the stack already carried — the
 * same rule as migration `0015`'s `down`, with the live table here because this is not a frozen
 * step — and the species' generic keyword when nothing followed the family. The key goes when the
 * last font goes, so a document that never had one and one that had one and lost it are the same
 * shape. An id the document does not have is a caller's bug, and throws.
 */
export function removeOwnFont(doc: RetorikaDocument, id: string): RetorikaDocument {
  const font = doc.fonts?.find((candidate) => candidate.id === id);
  if (font === undefined) throw new Error(`removeOwnFont: no own font "${id}" in the document`);
  const theme = { ...doc.theme };
  for (const key of FONT_TOKENS) {
    const stack = theme[key];
    if (firstFamilyOf(stack) !== font.family) continue;
    const tail = stack.slice(stack.indexOf(",") + 1).trim();
    theme[key] = stack.includes(",") && tail !== "" ? tail : GENERIC_OF[font.kind];
  }
  const { fonts: _, ...rest } = doc;
  const remaining = (doc.fonts ?? []).filter((candidate) => candidate.id !== id);
  return remaining.length === 0 ? { ...rest, theme } : { ...rest, theme, fonts: remaining };
}
