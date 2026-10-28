import { ownFaceFile, SHIPPABLE_FAMILIES } from "@retorika/renderer";
import type { FontKind, OwnFont, Theme } from "@retorika/schema";
import {
  type FontKey,
  GALLERY_FAMILIES,
  identifyFamily,
  identifyOwnFont,
  identifyTypePair,
  TYPE_PAIRS,
} from "@retorika/tokens";
import tokensEs from "@retorika/tokens/locales/es" with { type: "json" };
import es from "../locales/es.json" with { type: "json" };

/**
 * The gallery of letters the «Estilo» panel offers, and the faces its specimens are drawn in
 * (ADR 0046).
 *
 * **A module and not JSX, for the reason `menuState.ts` is one**: what the panel has to get right is
 * arithmetic and derivation, not markup — which row is ticked, which file a specimen loads, what the
 * line above the group says — and all of it is asked of the renderer and the tokens rather than
 * copied here. The panel renders what this returns.
 *
 * **Nothing here holds state.** Which family is ticked is deduced from the document's own theme, the
 * way the palette's tick already is: a theme keeps values and not identities, so there is no second
 * copy of the answer to go stale.
 */

/**
 * The weight a specimen is drawn in.
 *
 * 400 and not 700: the specimen's job is to show the letterform, and the regular is the face an
 * owner recognises a family by. It also halves what opening the group fetches — eight faces instead
 * of sixteen — which is the other half of «loaded only when the group opens».
 */
const SPECIMEN_WEIGHT = 400;

/**
 * The shape a family name must have to be written into CSS, which is `escape.ts`'s own pattern.
 *
 * **Deliberately a second lock.** Every name here comes from `SHIPPABLE_FAMILIES`, a closed table in
 * our own source that no document value can reach, and `packages/publisher/test/fonts.test.ts`
 * already asserts this pattern over every row. This is the only place in the editor that writes a
 * family name into a stylesheet of the editor's **own document**, so it checks rather than trusts.
 */
const FAMILY_SHAPE = /^[A-Za-z][A-Za-z0-9]*(?: [A-Za-z0-9]+)*$/;

/** The file name shape the `fonts/[file]` route serves, for the same reason. */
const FILE_SHAPE = /^[a-z0-9-]+\.woff2$/;

export interface GalleryRow {
  /** The family's real name, which is what the row says out loud. */
  family: string;
  kind: FontKind;
  /** The face the specimen is drawn with, served by the editor's own `fonts/[file]` route. */
  file: string;
  /** Whether this is the family the theme's stack for that key begins with. */
  chosen: boolean;
}

/**
 * The rows for one of the two choices, in the gallery's own order.
 *
 * **One row per shipped family, by construction** — this is ADR 0046's condition that «the editor's
 * gallery must offer every row», and it is met by deriving the list instead of writing it. A family
 * in the tokens' gallery with no face in the renderer's table throws: it would be a row the owner
 * could pick and the ZIP could not honour.
 */
export function galleryRows(theme: Theme, key: FontKey): GalleryRow[] {
  const current = identifyFamily(theme, key);
  return GALLERY_FAMILIES.map(({ family, kind }) => {
    const row = SHIPPABLE_FAMILIES.find((candidate) => candidate.family === family);
    const face = row?.faces.find((candidate) => candidate.weight === SPECIMEN_WEIGHT);
    if (!face) throw new Error(`letterGallery: no ${SPECIMEN_WEIGHT} face shipped for "${family}"`);
    return { family, kind, file: face.file, chosen: current?.family === family };
  });
}

/**
 * The `@font-face` rules for the specimens, as a stylesheet for the editor's own document.
 *
 * **`/fonts/…` and not `fonts/…`**, which is the one thing this cannot borrow from the renderer:
 * `cssFontSrc` emits a relative URL because that is what a published page and a `file://` ZIP need,
 * and the panel is a page at `/mis-webs/<id>`, where the same relative URL would ask for
 * `/mis-webs/fonts/…` and get a 404. Same bytes, same route, absolute path.
 *
 * **Only the families it is handed, and all of them by default.** A declared face downloads the
 * moment text is *laid out* in it — not when that text scrolls into view — so a sheet declaring
 * every family would fetch every face the instant a list of forty specimens mounted, inside an
 * `overflow` or not. The chooser (sprint 29 día 1) therefore declares a face only once its row has
 * come near the viewport, and grows the sheet from there; the two rows in the panel declare exactly
 * the one or two faces they draw. The no-argument form is what the tests and the `fonts/[file]`
 * route's own reasoning still rely on.
 *
 * A family that is not in the table is refused rather than skipped: a caller asking for a face this
 * product does not send would otherwise draw a specimen in the system letter and call it the real
 * one, which is the exact lie issue #9 was about.
 */
export function galleryFaceCss(
  families: readonly string[] = GALLERY_FAMILIES.map((row) => row.family),
): string {
  return families
    .map((family) => {
      const row = SHIPPABLE_FAMILIES.find((candidate) => candidate.family === family);
      const face = row?.faces.find((candidate) => candidate.weight === SPECIMEN_WEIGHT);
      if (!face)
        throw new Error(`letterGallery: no ${SPECIMEN_WEIGHT} face shipped for "${family}"`);
      if (!FAMILY_SHAPE.test(family))
        throw new Error(`letterGallery: unwritable family "${family}"`);
      if (!FILE_SHAPE.test(face.file))
        throw new Error(`letterGallery: unwritable file "${face.file}"`);
      return (
        `@font-face{font-family:'${family}';` +
        `src:url("/fonts/${face.file}") format("woff2");` +
        `font-weight:${SPECIMEN_WEIGHT};font-style:normal;font-display:swap}`
      );
    })
    .join("\n");
}

/** What an object URL may look like before it is written into the editor's own stylesheet. */
const OBJECT_URL = /^blob:[A-Za-z0-9:/._-]+$/;

/** The `format()` hint per stored format, as the renderer writes it for the page. */
const FORMAT_HINT: Readonly<Record<string, string>> = {
  woff2: "woff2",
  woff: "woff",
  ttf: "truetype",
  otf: "opentype",
};

/**
 * The `@font-face` rules that draw the owner's own fonts **in the editor's own document** — the
 * chooser's rows and the panel's — from the object URLs of their bytes (sprint 29 día 5).
 *
 * One face per font, the one a specimen is drawn in: the regular, or the variable file with the
 * range `fvar` gave it. A font whose bytes have not arrived is left out rather than pointed at
 * nothing, so its row draws the fallback — what the canvas does too. The family is checked
 * against the pattern and the URL against `blob:` before either is written, the second lock this
 * file keeps for the gallery's own sheet: the record was parsed, the URL was minted here, and
 * neither is trusted on that account.
 */
export function ownFaceCss(
  fonts: readonly OwnFont[],
  fontUrls: ReadonlyMap<string, string>,
): string {
  return fonts
    .flatMap((font) => {
      const face = font.faces.find((candidate) => candidate.role !== "bold");
      if (face === undefined) return [];
      const url = fontUrls.get(ownFaceFile(font, face));
      if (url === undefined) return [];
      if (!FAMILY_SHAPE.test(font.family)) {
        throw new Error(`letterGallery: unwritable family "${font.family}"`);
      }
      if (!OBJECT_URL.test(url)) throw new Error(`letterGallery: "${url}" is not an object URL`);
      const weight = face.role === "variable" ? `${face.wght[0]} ${face.wght[1]}` : "400";
      return [
        `@font-face{font-family:'${font.family}';` +
          `src:url("${url}") format("${FORMAT_HINT[face.format]}");` +
          `font-weight:${weight};font-style:normal;font-display:swap}`,
      ];
    })
    .join("\n");
}

/**
 * What one of the panel's two rows — «Titulares», «Texto» — says and is drawn in.
 *
 * Three honest states, and the row shows each in the letter it is actually about:
 *
 * - **A gallery family** is named outright, drawn in its own shipped face, and the chooser can be
 *   opened to change it. `family` is set, which is also what tells the row to declare that face.
 * - **A type pair's own letter** — Georgia on «Sobria y legible», Charter on «Clásica y seria» —
 *   is named by the pair, never by the font, because the ZIP ships no file for it and the visitor
 *   gets whatever their machine has (issue #9). Drawn in the theme's own stack, so what the row shows
 *   is what that machine gives. **Each half on its own** since sprint 29 día 3: a site on «Clásica y
 *   seria» whose headings were changed to a gallery family still has the pair's Charter in its text,
 *   and until then that row said «una letra que no está en esta lista» about a letter the product
 *   itself had put there. Where two pairs share the half's stack — the system sans of «Sobria y
 *   legible» and «Moderna y neutra» — the first in `TYPE_PAIRS` names it, which is true of both.
 * - **A letter nobody here produced** — a hand-edited document — is said to be off the list, in the
 *   same words the pairs group uses for the whole theme.
 *
 * `modern-sans` heads in Inter, which this product sends, so a brand-new site reads «Inter» in its
 * first row before anybody has chosen anything. That is the truth of the document and not a quirk:
 * the pair *is* Inter over the system sans.
 */
export interface FamilyRow {
  /** The shipped family, when the stack begins with one; otherwise `undefined`. */
  family: string | undefined;
  /** The owner's own font, when the stack begins with one (sprint 29 día 5): named outright and
   * drawn from its bytes, like a gallery family, because its face travels like one. */
  own: OwnFont | undefined;
  /** What the row says. */
  text: string;
  /** The `font-family` the row's text is drawn in. */
  stack: string;
}

export function familyRowFor(
  theme: Theme,
  key: FontKey,
  fonts: readonly OwnFont[] = [],
): FamilyRow {
  const own = identifyOwnFont(theme, key, fonts);
  if (own !== undefined) {
    return { family: undefined, own, text: own.family, stack: `'${own.family}'` };
  }
  const family = identifyFamily(theme, key)?.family;
  if (family !== undefined) return { family, own: undefined, text: family, stack: `'${family}'` };
  const pair =
    identifyTypePair(theme) ?? TYPE_PAIRS.find((candidate) => candidate.fonts[key] === theme[key]);
  if (pair !== undefined) {
    const name = tokensEs[pair.nameKey as keyof typeof tokensEs] ?? pair.nameKey;
    return {
      family: undefined,
      own: undefined,
      text: es["editor.style.pairLetter"].replace("{pair}", name),
      stack: theme[key],
    };
  }
  return {
    family: undefined,
    own: undefined,
    text: es["editor.style.unknownLetter"],
    stack: theme[key],
  };
}

/**
 * The help line under the two rows, with the count read from the table rather than written into
 * the sentence — «Las ocho letras…» was the copy until sprint 29, and eight stopped being true on
 * día 2 of it.
 */
export function familiesHelpText(): string {
  return es["editor.style.familiesHelp"].replace("{n}", String(GALLERY_FAMILIES.length));
}

/**
 * What the pairs group says when no pair matches the theme.
 *
 * **Two different true sentences, and telling them apart is the point.** The existing note —
 * «ahora mismo tu web usa una letra que no está en esta lista» — was written when the only way to
 * leave the three pairs was a hand-edited document. From ADR 0046 on, the ordinary way is to choose
 * a family below by its name, and then that sentence would be telling an owner their letter is
 * nowhere while it sits ticked a few rows down.
 */
export function typePairNoteText(theme: Theme, fonts: readonly OwnFont[] = []): string {
  // An own font is chosen by name too (sprint 29 día 5): telling its owner the letter is «not in
  // this list» while it sits ticked in the chooser would be the sentence this function exists to
  // avoid.
  const chosen = (["font.heading", "font.body"] as const).some(
    (key) =>
      identifyFamily(theme, key) !== undefined || identifyOwnFont(theme, key, fonts) !== undefined,
  );
  return chosen ? es["editor.style.fromGallery"] : es["editor.style.noTypePair"];
}

/**
 * The accessible name of one «Letra» button in the floating toolbar.
 *
 * **The role word stays, and the family joins it in the name only** (ADR 0032, ADR 0046). The
 * visible label is still «Titular» or «Texto»: a bar inside a section has the width a section gives
 * it, and «Titular (EB Garamond)» is not a button that fits. But the question an owner asks
 * here is which letter they are about to apply, so the name and the tooltip answer it — and only
 * when the family is one we send. A theme heading in Georgia gets the role word alone, because
 * naming a face we do not ship is the promise issue #9 forbade.
 */
export function toolbarFamilyLabel(theme: Theme, ref: FontKey): string {
  const role = es[`editor.toolbar.familyOf.${ref}` as keyof typeof es];
  const family = identifyFamily(theme, ref)?.family;
  const label = family === undefined ? role : `${role} (${family})`;
  return `${es["editor.toolbar.family"]} — ${label}`;
}
