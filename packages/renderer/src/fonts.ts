import {
  FONT_GALLERY,
  fontFamilySlug,
  type OwnFont,
  type OwnFontFace,
  type RetorikaDocument,
  TOKEN_KEYS,
} from "@retorika/schema";
import { cssFontFamilyName, cssFontSrc } from "./escape.ts";

/**
 * Which faces a published page may carry, and the `@font-face` rules for them (ADR 0028, option A).
 *
 * **A closed table, and it cannot be derived from the document**, which is the whole safety property
 * — **a document may *choose* a row from this table and can never *name* a file.**
 *
 * It cannot come from `@retorika/tokens`, where the type pairs are declared: `scripts/renderer-deps.ts`
 * admits `@retorika/schema` and `@retorika/catalog` and nothing else, because everything in this
 * package travels to the client's site. Until sprint 29 that made it a second copy of the family names;
 * since ADR 0055 the names live once, in `@retorika/schema`'s `FONT_GALLERY`, and this table is derived
 * from them. `fonts.test.ts` still asserts that every family a type pair asks for first is a row here —
 * a pair naming a face nobody ships is the defect ADR 0028 exists to prevent — and that every row is
 * reachable by a document and brings exactly its own faces.
 *
 * **What it no longer asserts is the other direction**, that every row is named by a pair. Until
 * sprint 24 the table was two rows and both came from a pair, so "shipped but unnamed" meant bytes
 * nobody could ever see. The gallery (ADR 0046) is the decision that a family may be shipped for the
 * owner to choose by its real name, which is exactly a row no pair names first.
 */

export interface ShippableFace {
  /** The weight this file carries, and the one its `@font-face` rule declares. */
  weight: number;
  /**
   * The file's name inside `fonts/`. Chosen here; never read from a document.
   *
   * **Spelled exactly as `@fontsource` ships it**, `-normal` and all, so the name in a published ZIP
   * says out loud which file it is and `fonts.test.ts` can compare the bytes against the package's
   * own. A shortened name here would be the first step towards a file nobody could check.
   *
   * The latin slice is a *Modified Version* under the OFL, so no family in this table may declare a
   * Reserved Font Name (ADR 0045); the condition is asserted over every row rather than remembered.
   */
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
 */
const SHIPPED_WEIGHTS = [400, 700] as const;

/**
 * Every family this product can ship and its two faces, **derived from `FONT_GALLERY`** in
 * `@retorika/schema` (ADR 0055) — the one hand-written list since sprint 29, where this was the second
 * of four parallel copies. The file name is a function of the family's name, `@fontsource`'s own
 * convention, so nothing per row is written here. What this package keeps is the derivation of faces
 * and the only `url()` (`escape.ts`), which is what ADR 0046 §2 gave it.
 *
 * Only the face a stack asks for **first** is shipped for it. A family further down a stack is a
 * fallback, and a fallback that we ship is not a fallback — it is the choice, under another name.
 *
 * **Alphabetical by family**, because the gallery is: the order a published page emits its faces in is
 * the table's, which is why it is a decision rather than the order the rows were added in.
 */
export const SHIPPABLE_FAMILIES: readonly ShippableFamily[] = FONT_GALLERY.map(({ family }) => ({
  family,
  faces: SHIPPED_WEIGHTS.map((weight) => ({
    weight,
    file: `${fontFamilySlug(family)}-latin-${weight}-normal.woff2`,
  })),
}));

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
  const wanted = firstFamilies(doc);
  return SHIPPABLE_FAMILIES.filter((candidate) => wanted.has(candidate.family));
}

function firstFamilies(doc: RetorikaDocument): Set<string> {
  const wanted = new Set<string>();
  for (const key of FONT_KEYS) wanted.add(firstFamily(doc.theme[key]));
  return wanted;
}

/**
 * One face of a font the owner brought (ADR 0056), with the file it is published as.
 *
 * **The file is minted from the record's `id` and the face's `role`, never from the owner's file
 * name and never from the family they typed.** That is what keeps ADR 0046 §2's «a document never
 * names a file» true for a font that did not come from the table: the only two things in the name
 * are eight hex digits the editor minted and one of three words, so `../evil` as a family publishes
 * `propia-3f9a7c21-regular.ttf` — and then fails `cssFontFamilyName`, the second lock, before any
 * rule is emitted.
 */
export interface OwnFace {
  /** `propia-<id>-<role>.<format>`, inside `fonts/`. */
  file: string;
  font: OwnFont;
  face: OwnFontFace;
}

export function ownFaceFile(
  font: Pick<OwnFont, "id">,
  face: Pick<OwnFontFace, "role" | "format">,
): string {
  return `propia-${font.id}-${face.role}.${face.format}`;
}

/**
 * The own fonts this document's theme asks for — those a stack names **first**, by the same exact
 * equality a gallery row is selected by — **ordered by id**, never by the document's array. The
 * owner's order is the chooser's business; the page's order has to be a function of the document's
 * content (`INV_5`), and an array that was reordered by a drag must not move a byte of CSS.
 *
 * A font no stack names is allowed in the record and selects nothing here: it ships no rule and no
 * file, exactly as a gallery row nobody chose.
 */
export function ownFontsFor(doc: RetorikaDocument): OwnFont[] {
  const fonts = doc.fonts ?? [];
  if (fonts.length === 0) return [];
  const wanted = firstFamilies(doc);
  return fonts
    .filter((font) => wanted.has(font.family))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Every own face the page names, in the order the stylesheet emits them. */
export function ownFacesFor(doc: RetorikaDocument): OwnFace[] {
  return ownFontsFor(doc).flatMap((font) =>
    font.faces.map((face) => ({ file: ownFaceFile(font, face), font, face })),
  );
}

/**
 * What a face's `font-weight` descriptor says: the one weight a static face carries, or **the range
 * `fvar` declares** for a variable one — `300 800`, never `100 <max>` (David's adjustment 4, 27
 * October 2026). The browser then matches 400 and 700 inside that range, and a range that starts at
 * 500 has no 400 to match, which `ownFontCovers` in the schema says out loud and día 5 warns about.
 */
function faceWeight(face: OwnFontFace): string {
  if (face.role === "regular") return "400";
  if (face.role === "bold") return "700";
  return `${face.wght[0]} ${face.wght[1]}`;
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
  const own = ownFontsFor(doc);
  if (families.length === 0 && own.length === 0) return [];

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
  // **The table's rows first, then the owner's own, by id** (ADR 0056): a shipped family and an own
  // font cannot share a name — the schema refuses the collision — so the order decides no match; it
  // is stated so that the published bytes are a function of the document and not of a sort nobody
  // wrote down.
  for (const font of own) {
    for (const face of font.faces) {
      lines.push(
        "@font-face {",
        `  font-family: ${cssFontFamilyName(font.family)};`,
        "  font-style: normal;",
        `  font-weight: ${faceWeight(face)};`,
        "  font-display: swap;",
        `  src: ${cssFontSrc(ownFaceFile(font, face))};`,
        "}",
      );
    }
  }
  lines.push("");
  return lines;
}

/** The files of the table's faces a page built from this document needs in `fonts/`, in the
 * table's order — what `readFontBundle` has bytes for. Own faces are the owner's bytes and are
 * listed by `ownFacesFor`; `fontFilesFor` is both together. */
export function shippedFontFilesFor(doc: RetorikaDocument): string[] {
  return shippableFor(doc).flatMap(({ faces }) => faces.map((face) => face.file));
}

/** Every file a page built from this document needs in `fonts/`: the table's faces in the table's
 * order, then the owner's own by id. The channel the publisher writes from — parallel to `assets`,
 * because a font has no element and therefore no `src` for `collectAssets` to find. */
export function fontFilesFor(doc: RetorikaDocument): string[] {
  return [...shippedFontFilesFor(doc), ...ownFacesFor(doc).map((face) => face.file)];
}
