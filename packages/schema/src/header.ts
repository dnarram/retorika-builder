import { z } from "zod";
import { elementStyleSchema } from "./tokens.ts";

/**
 * The header is the owner's (ADR 0057): what sits above the first section of every page.
 *
 * **A set of references and preferences, never content and never a URL.** ADR 0023 made the menu
 * derived chrome because rule 5 — every element belongs to a section, every section to a page —
 * leaves nowhere for a site-wide *element* to live. That is still true, and this object is not an
 * element: it holds which menus are drawn, how the bar is laid out, and at most one destination (the
 * action button) **by id**, exactly as a placement names an element by id. The words a visitor
 * reads are still read off the page and the catalog at render time, so renaming a page is still
 * correct everywhere at once, and the owner still never sees or writes a web address.
 *
 * **Absent is the ordinary state and reproduces the menu every published site already has.** Every
 * key is optional and every default is what the renderer did before this object existed, which is
 * what lets a document written before 1.15.0 publish the same navigation it published before — the
 * two corpus fixtures with a menu move only by the `<header>` wrapper, and the eighteen without one
 * lose a stylesheet block they never used.
 *
 * `look` and `style` are declared here, in the one migration this sprint costs, and read by the
 * renderer from day 2 — see the plan of sprint 30. Declaring them later would have meant a second
 * migration for a shape already decided.
 */

/** Where the brand sits and where the links go. */
export const HEADER_LAYOUTS = ["brand-left", "centered", "stacked"] as const;
export type HeaderLayout = (typeof HEADER_LAYOUTS)[number];

/**
 * The bar's background, as a closed set of pairs the palettes are proved against — never a free
 * colour, which is the same line `StylePanel` draws («no free colour picker»). `transparent` lays the
 * bar over the cover and, over a photograph, is the one pair that cannot be proved; the download
 * review warns about it rather than refusing (sprint 30 plan, «fuera, con nombre»).
 */
export const HEADER_BACKGROUNDS = [
  "surface",
  "primary",
  "secondary",
  "ink",
  "transparent",
] as const;
export type HeaderBackground = (typeof HEADER_BACKGROUNDS)[number];

export const HEADER_ALIGNMENTS = ["start", "center", "end"] as const;
export const HEADER_GAPS = ["sm", "md", "lg"] as const;
export const HEADER_SIZES = ["body", "small"] as const;

/** Whether the sections menu shares the bar with the pages menu or takes a row of its own. */
export const SECTIONS_ROWS = ["shared", "own"] as const;
/** What becomes of the sections menu on a phone: a horizontal row under the bar, or nothing. */
export const SECTIONS_ON_MOBILE = ["row", "hidden"] as const;

/** The parts of the header an owner may dress one by one (rule 6, read by the renderer from day 2). */
export const HEADER_PARTS = ["bar", "brand", "pagesLinks", "sectionsLinks", "action"] as const;
export type HeaderPart = (typeof HEADER_PARTS)[number];

/**
 * The bounds of an owner's own label for a menu entry — David's numbers, 28 October 2026. Two
 * characters is the shortest word a menu reads («Ir»); twenty is where a strip of five stops fitting
 * a phone. Checked on the trimmed text, and the verb trims before it writes.
 */
export const MENU_LABEL_MIN = 2;
export const MENU_LABEL_MAX = 20;

export type MenuLabelIssue = "short" | "long";

/** Why this label is not allowed, or `undefined` when it is. Judged on the trimmed text. */
export function menuLabelIssue(label: string): MenuLabelIssue | undefined {
  const trimmed = label.trim();
  if (trimmed.length < MENU_LABEL_MIN) return "short";
  if (trimmed.length > MENU_LABEL_MAX) return "long";
  return undefined;
}

/**
 * An owner's own label, stored already trimmed. The schema refuses untrimmed text rather than
 * trimming it: a parse that rewrites a value is a parse whose output differs from its input, and
 * every verb in this package relies on `parseDocument` being a gate and not a transformation.
 */
export const menuLabelSchema = z
  .string()
  .refine((label) => label === label.trim() && menuLabelIssue(label) === undefined, {
    message: `a menu label is ${MENU_LABEL_MIN} to ${MENU_LABEL_MAX} characters, with no space at either end`,
  });

/**
 * A logo file the header may show (ADR 0059 decides how it gets there). **Raster only, by the
 * shape of the name**: an SVG is a vector for scripts and styles that `safeUrl` does not read, and
 * David kept it out until a sanitiser exists — so a document cannot even name one. A bundle path
 * (`assets/…`) or a bare file name, which is how photographs are stored before the publisher moves
 * them under `assets/`.
 */
export const LOGO_SRC_PATTERN = /^(?:assets\/)?[A-Za-z0-9][A-Za-z0-9._-]*\.(?:png|jpe?g|webp)$/;

/**
 * The longest edge a logo is kept at, in pixels. The editor draws every logo it keeps onto a canvas
 * of at most this side (`prepareLogo`); it is shown 40px tall in the bar, so 512 is already more
 * than a 2x and a 3x screen will ask for of a wide wordmark.
 */
export const LOGO_MAX_EDGE = 512;

const logoEdgeSchema = z.number().int().min(1).max(LOGO_MAX_EDGE);

/**
 * The logo the header shows: its file, and **the size it was kept at** (sprint 30 día 7, ADR 0059's
 * note). The size is what lets the published `<img>` carry `width` and `height`, so a browser knows
 * the logo's width before its bytes arrive and the business name beside it does not jump sideways
 * when they do — the shift Lighthouse measured on día 5 (`unsized-images`, CLS 0.023). **Both or
 * neither**: a logo kept before the size was stored has neither and publishes as it did, 40px tall
 * and its width found on arrival; one with a single side would be a ratio nobody can draw.
 */
export const headerLogoSchema = z
  .strictObject({
    src: z.string().regex(LOGO_SRC_PATTERN),
    width: logoEdgeSchema.optional(),
    height: logoEdgeSchema.optional(),
  })
  .refine((logo) => (logo.width === undefined) === (logo.height === undefined), {
    message: "a logo carries both its width and its height, or neither",
  });
export type HeaderLogo = z.infer<typeof headerLogoSchema>;

export const headerActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("section"), sectionId: z.string().min(1).max(128) }),
  z.strictObject({ kind: z.literal("page"), pageId: z.string().min(1).max(128) }),
]);
export type HeaderAction = z.infer<typeof headerActionSchema>;

export const headerSchema = z.strictObject({
  /** The pages menu. `shown` absent means the derivation ADR 0043 fixed: the threshold of three,
   * waived once the owner has curated. Present, it is the owner's word and the threshold is silent. */
  pages: z.strictObject({ shown: z.boolean().optional() }).optional(),
  /** The sections menu of the page being drawn — same reading of `shown`. */
  sections: z
    .strictObject({
      shown: z.boolean().optional(),
      row: z.enum(SECTIONS_ROWS).optional(),
      mobile: z.enum(SECTIONS_ON_MOBILE).optional(),
    })
    .optional(),
  /** One destination drawn as a button, with the same words its menu entry would have. The
   * destination leaves the menu it would otherwise sit in: one destination, one place. */
  action: headerActionSchema.optional(),
  layout: z.enum(HEADER_LAYOUTS).optional(),
  /** The business name and its logo, linking home. The logo's `alt` is derived from `siteName` at
   * render time and never stored, so a renamed business does not leave a stale word behind. */
  brand: z
    .strictObject({
      name: z.boolean().optional(),
      logo: headerLogoSchema.optional(),
    })
    .optional(),
  sticky: z.boolean().optional(),
  hairline: z.boolean().optional(),
  look: z
    .strictObject({
      background: z.enum(HEADER_BACKGROUNDS).optional(),
      align: z.enum(HEADER_ALIGNMENTS).optional(),
      gap: z.enum(HEADER_GAPS).optional(),
      uppercase: z.boolean().optional(),
      hoverUnderline: z.boolean().optional(),
      size: z.enum(HEADER_SIZES).optional(),
    })
    .optional(),
  /** Rule 6 for the header's parts: the same five properties an element takes, each a reference
   * or a marked exception. */
  style: z
    .strictObject(
      Object.fromEntries(
        HEADER_PARTS.map((part) => [part, elementStyleSchema.optional()]),
      ) as Record<HeaderPart, z.ZodOptional<typeof elementStyleSchema>>,
    )
    .optional(),
});
export type Header = z.infer<typeof headerSchema>;

/** Where a label lives: on a section, or on a page. */
export type MenuLabelTarget =
  | { kind: "section"; sectionId: string }
  | { kind: "page"; pageId: string };

/** The three kinds of section that never lend a menu entry, so a label on them is a word nobody
 * reads. Written as literals, as `conversion.ts` writes its own three: this package may not import
 * the catalog. */
export const UNLABELLED_SECTIONS: ReadonlySet<string> = new Set(["cover", "footer", "teaser"]);

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The header without an action that points at any of these sections or pages — what `deleteSection`
 * and `deletePage` ask before they hand the document to `parseDocument`, which would otherwise refuse
 * a button pointing at a place that is gone. Returns the same header when the action survives, and
 * `undefined` when there was none.
 */
export function withoutActionTo(
  header: Header | undefined,
  gone: { sectionIds?: ReadonlySet<string>; pageIds?: ReadonlySet<string> },
): Header | undefined {
  const action = header?.action;
  if (!header || !action) return header;
  const dead =
    (action.kind === "section" && (gone.sectionIds?.has(action.sectionId) ?? false)) ||
    (action.kind === "page" && (gone.pageIds?.has(action.pageId) ?? false));
  if (!dead) return header;
  const { action: _, ...rest } = header;
  // A header with nothing left in it is no header: the key goes, so a document whose owner only
  // ever chose a button that is now gone reads exactly like one who never opened «Menú».
  return Object.keys(rest).length === 0 ? undefined : rest;
}

/**
 * The header with its action re-pointed, which is what a conversion owes it: a button at a section
 * that just became a page must follow the section onto the page (`sectionToPage`), and come back
 * when the page folds (`pageToSection`) — the same rewrite `retarget` does for the owner's links.
 */
export function retargetAction(
  header: Header | undefined,
  from: HeaderAction,
  to: HeaderAction,
): Header | undefined {
  if (!header?.action || !same(header.action, from)) return header;
  return { ...header, action: to };
}
