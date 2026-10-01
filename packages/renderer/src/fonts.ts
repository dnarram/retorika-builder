import { type RetorikaDocument, TOKEN_KEYS } from "@retorika/schema";
import { cssFontFamilyName, cssFontSrc } from "./escape.ts";

/**
 * Which faces a published page may carry, and the `@font-face` rules for them (ADR 0028, option A).
 *
 * **A closed table, inside the renderer, and both halves of that are forced.**
 *
 * It cannot come from `@retorika/tokens`, where the type pairs are declared: `scripts/renderer-deps.ts`
 * admits `@retorika/schema` and `@retorika/catalog` and nothing else, because everything in this
 * package travels to the client's site. And it cannot be derived from the document, which is the whole
 * safety property — **a document may *choose* a row from this table and can never *name* a file.**
 *
 * So the table is a second copy of two family names, and that is the cost. It is a small one and it is
 * guarded: `fonts.test.ts` checks the names against the stacks the tokens declare, so the copies
 * cannot drift apart silently. The alternative — comparing the theme's whole stack string against a
 * copy of every stack — would have been a far larger copy of exactly the thing day 4 just changed.
 */

export interface ShippableFace {
  /** The weight this file carries, and the one its `@font-face` rule declares. */
  weight: number;
  /** The file's name inside `fonts/`. Chosen here; never read from a document. */
  file: string;
}

export interface ShippableFamily {
  /** The family name, exactly as a type pair's stack spells it, and exactly as the rule emits it. */
  family: string;
  faces: readonly ShippableFace[];
}

/**
 * **Both weights, and that is measured rather than assumed.** `--font-heading` is used by `h1`, `h2`
 * and `h3` — all heading tags, so all **700** by the browser's own default, since `build.ts` sets no
 * `font-weight` — and by `p.rb-subtitle`, the cover's tagline, which is a `<p>` and therefore **400**.
 * Shipping only 700 would leave every tagline synthesising a lighter weight from the bold file, which
 * browsers do badly; shipping only 400 would have them synthesise the bold, which they do worse.
 *
 * Only the two faces a type pair asks for **first** appear here. A family further down a stack is a
 * fallback, and a fallback that we ship is not a fallback — it is the choice, under another name.
 */
export const SHIPPABLE_FAMILIES: readonly ShippableFamily[] = [
  {
    family: "Inter",
    faces: [
      { weight: 400, file: "inter-latin-400.woff2" },
      { weight: 700, file: "inter-latin-700.woff2" },
    ],
  },
  {
    family: "Playfair Display",
    faces: [
      { weight: 400, file: "playfair-display-latin-400.woff2" },
      { weight: 700, file: "playfair-display-latin-700.woff2" },
    ],
  },
];

/**
 * The first family of a CSS font stack, unquoted.
 *
 * **Only the first**, which is the rule that makes the table coherent: the first family is the one the
 * pair asks for and the one the machine may not have, and everything after it exists precisely to be
 * used when the first is missing.
 *
 * It parses a document value, so it is treated as one: nothing it returns is ever emitted. It is only
 * compared, by exact equality, against the table above — so a theme whose first "family" is
 * `url(http://evil/x)` matches no row and produces no rule, rather than producing a mangled one.
 */
function firstFamily(stack: string): string {
  const first = stack.split(",")[0] ?? "";
  return first.trim().replace(/^['"]|['"]$/g, "");
}

/**
 * The theme keys that hold a font stack, derived from the schema's own list rather than written out.
 *
 * `@retorika/tokens` has a `FONT_KEYS` already and this cannot import it — the dependency allowlist
 * stops at schema and catalog, because everything here travels to the client's site. Derived from
 * `TOKEN_KEYS` the same way that one is, so a third font token added to the schema is picked up here
 * without anybody remembering to.
 */
const FONT_KEYS = TOKEN_KEYS.filter((key): key is "font.heading" | "font.body" =>
  key.startsWith("font."),
);

/** The families this document's theme asks for that this product can ship, in the table's own
 * order — never the document's, because the published bytes have to be a function of the document
 * and not of the order its keys happen to be written in (`INV_5`, and the golden corpus). */
export function shippableFor(doc: RetorikaDocument): ShippableFamily[] {
  const wanted = new Set<string>();
  for (const key of FONT_KEYS) wanted.add(firstFamily(doc.theme[key]));
  return SHIPPABLE_FAMILIES.filter((candidate) => wanted.has(candidate.family));
}

/**
 * The `@font-face` rules this document needs, or `[]` when it needs none.
 *
 * The third `string[]` helper in `buildCss`, beside `elementStyleCss` and `breakpointCss`, and for the
 * same reason: **a document that uses none of these families publishes exactly the bytes it published
 * before.** `editorial-serif` names Georgia and `system-ui`, so a site on that pair emits not one rule
 * and carries not one font byte — which is the lightness this product sells, kept rather than claimed.
 *
 * `font-display: swap` so the text is readable before the face arrives and the first paint is never
 * blocked (ADR 0028). `font-style: normal` is stated rather than left out: an italic the page never
 * ships must not be matched by this rule and then synthesised from it.
 *
 * No `unicode-range`. Only one subset is shipped per face, so a range would describe the file rather
 * than select between files, and a browser that reads it would decline to download the font for a page
 * whose first glyphs fall outside it. Left out deliberately, not forgotten.
 */
export function fontFaceCss(doc: RetorikaDocument): string[] {
  const families = shippableFor(doc);
  if (families.length === 0) return [];

  const lines: string[] = [
    "/* Self-hosted faces. Relative to this file, so a double-clicked page finds them. */",
  ];
  for (const { family, faces } of families) {
    for (const face of faces) {
      lines.push(
        "@font-face {",
        `  font-family: ${cssFontFamilyName(family)};`,
        "  font-style: normal;",
        `  font-weight: ${face.weight};`,
        "  font-display: swap;",
        `  src: ${cssFontSrc(face.file)};`,
        "}",
      );
    }
  }
  lines.push("");
  return lines;
}

/** Every file a page built from this document needs in `fonts/`, in the table's order. The channel
 * day 6's publisher writes from — parallel to `assets`, because a font has no element and therefore
 * no `src` for `collectAssets` to find. */
export function fontFilesFor(doc: RetorikaDocument): string[] {
  return shippableFor(doc).flatMap(({ faces }) => faces.map((face) => face.file));
}
