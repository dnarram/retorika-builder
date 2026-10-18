import { SHIPPABLE_FAMILIES } from "@retorika/renderer";
import type { Theme } from "@retorika/schema";
import { type FontKey, GALLERY_FAMILIES, identifyFamily, identifyTypePair } from "@retorika/tokens";
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
  kind: "sans" | "serif";
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
 * **Mounted by the group and not by the panel**, so the faces are fetched when an owner opens the
 * gallery and never «just in case»: a declared `@font-face` downloads nothing until something is
 * drawn in it, and the specimens are the only things that are.
 */
export function galleryFaceCss(): string {
  return GALLERY_FAMILIES.map(({ family }) => {
    const row = SHIPPABLE_FAMILIES.find((candidate) => candidate.family === family);
    const face = row?.faces.find((candidate) => candidate.weight === SPECIMEN_WEIGHT);
    if (!face) throw new Error(`letterGallery: no ${SPECIMEN_WEIGHT} face shipped for "${family}"`);
    if (!FAMILY_SHAPE.test(family)) throw new Error(`letterGallery: unwritable family "${family}"`);
    if (!FILE_SHAPE.test(face.file))
      throw new Error(`letterGallery: unwritable file "${face.file}"`);
    return (
      `@font-face{font-family:'${family}';` +
      `src:url("/fonts/${face.file}") format("woff2");` +
      `font-weight:${SPECIMEN_WEIGHT};font-style:normal;font-display:swap}`
    );
  }).join("\n");
}

/**
 * What the line beside the group says about the two choices as they stand.
 *
 * Said out loud because the group is closed until an owner opens it, and a choice nobody can see is
 * a choice they cannot undo. The four cases are the four real states, and «ninguna» names the type
 * pair as the thing in charge rather than leaving a blank.
 */
export function chosenFamilyText(theme: Theme): string {
  const heading = identifyFamily(theme, "font.heading")?.family;
  const body = identifyFamily(theme, "font.body")?.family;
  if (heading !== undefined && body !== undefined) {
    return es["editor.style.familyBoth"].replace("{heading}", heading).replace("{body}", body);
  }
  if (heading !== undefined) return es["editor.style.familyHeading"].replace("{family}", heading);
  if (body !== undefined) return es["editor.style.familyBody"].replace("{family}", body);
  return es["editor.style.familyNeither"];
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
export function typePairNoteText(theme: Theme): string {
  const chosen =
    identifyFamily(theme, "font.heading") !== undefined ||
    identifyFamily(theme, "font.body") !== undefined;
  return chosen ? es["editor.style.fromGallery"] : es["editor.style.noTypePair"];
}

/**
 * Whether the gallery is open the moment the panel appears.
 *
 * **Closed by default**, because the three pairs are the answer for the owner who wants one click,
 * and sixteen more rows above the fold would make the panel look like a font list rather than a
 * style panel. **Open when the owner has already left the pairs for a family of their own**: a
 * ticked row inside a collapsed group is a choice they cannot see and therefore cannot take back.
 *
 * The test is the pair's absence **and** a family chosen, not just a family chosen: `modern-sans`
 * heads in Inter, which this product sends, so «a gallery family is named» is true of the default
 * theme and would open the group for every site.
 */
export function galleryStartsOpen(theme: Theme): boolean {
  if (identifyTypePair(theme) !== undefined) return false;
  return (
    identifyFamily(theme, "font.heading") !== undefined ||
    identifyFamily(theme, "font.body") !== undefined
  );
}

/**
 * The accessible name of one «Letra» button in the floating toolbar.
 *
 * **The role word stays, and the family joins it in the name only** (ADR 0032, ADR 0046). The
 * visible label is still «Titular» or «Texto»: a bar inside a section has the width a section gives
 * it, and «Titular (Libre Baskerville)» is not a button that fits. But the question an owner asks
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
