import { FONT_KINDS, type OwnFont, type Theme } from "@retorika/schema";
import { type FontKey, GALLERY_FAMILIES, identifyOwnFont } from "@retorika/tokens";
import es from "../locales/es.json" with { type: "json" };
import { fold } from "./fold.ts";
import { type GalleryRow, galleryRows } from "./letterGallery.ts";

/**
 * What the letter chooser shows (sprint 29 día 1), derived rather than held.
 *
 * **A module and not JSX, for the reason `letterGallery.ts` is one**: the dialog's questions are
 * arithmetic — which rows match the words typed, how many that is, which faces are worth declaring
 * before anybody scrolls — and every answer is asked of the gallery and the theme rather than kept
 * in the component. The dialog holds exactly two things of its own: the query and the kind chip,
 * which are about this screen and say nothing about the site; and a third that is about the
 * network, the set of families whose face has been declared so far.
 *
 * **Why the chooser exists at all.** The panel used to unfold two radio lists, one row per family
 * per half: sixteen rows of forty-eight pixels for eight families, eighty for the forty that sprint
 * 29 día 2 and 3 bring. David's condition for growing the gallery was that it «se navega, no se
 * recorre»: a search, a filter by character, a specimen set in the business's own name, and faces
 * fetched per family as their row comes into view — never the whole table on open. None of that
 * fits in a 340px panel that also has to show the colours and the pairs, so the list became a
 * dialog and the panel keeps two rows that say what is chosen.
 */

/** The kinds a chip can narrow to. `"all"` first, then the gallery's own species in their order;
 * `"own"` narrows to the fonts the owner brought (sprint 29 día 5). */
export type KindFilter = "all" | "own" | GalleryRow["kind"];

/**
 * «Todas», then **every species the gallery actually has**, in `FONT_KINDS`'s order — derived, so a
 * chip never narrows to an empty list and the next species gets its chip the day its first family
 * enters: «Remates gruesos» with the slabs on sprint 29 día 2, «De cartel» on día 3.
 */
export const KIND_FILTERS: readonly KindFilter[] = [
  "all",
  ...FONT_KINDS.filter((kind) => GALLERY_FAMILIES.some((row) => row.kind === kind)),
];

/**
 * The chips for a document: the gallery's, with «Propias» after «Todas» once the owner has brought
 * a font — and not before, because a chip that narrows to nothing is the one `KIND_FILTERS` exists
 * not to offer.
 */
export function kindFiltersFor(fonts: readonly OwnFont[]): readonly KindFilter[] {
  if (fonts.length === 0) return KIND_FILTERS;
  const [all, ...species] = KIND_FILTERS;
  return [all as KindFilter, "own", ...species];
}

export interface ChooserRow extends Omit<GalleryRow, "file"> {
  /** Whether the row matches the words typed and the chip pressed. The row stays mounted either
   * way — see `chooserRows`. */
  visible: boolean;
  /** The owner's own font this row is, or `undefined` for a gallery row. */
  own: OwnFont | undefined;
}

/**
 * The rows of the list, every one of them, with `visible` saying which the search has not hidden.
 *
 * **Every row stays mounted**, the same decision the sector search made in sprint 28 día 3 and for
 * a sharper reason here: the rows are one radio group, and a group whose members come and go as
 * somebody types loses the checked one — and with it the place the arrows start from. Keeping them
 * all and marking the misses lets the dialog hide a row without unmounting its radio, and lets the
 * faces already declared stay declared.
 *
 * Matching is on the family's name, folded, against the query folded: «garamond» finds
 * «EB Garamond», «Garamónd» finds it too. The chip narrows by species before the words do, so an
 * empty query under «Con remates» is every serif.
 */
export function chooserRows(
  theme: Theme,
  key: FontKey,
  query: string,
  kind: KindFilter,
  fonts: readonly OwnFont[] = [],
): ChooserRow[] {
  const needle = fold(query.trim());
  const matches = (family: string) => fold(family).includes(needle);
  // **The owner's own fonts first** (sprint 29 día 5): a brand's letter is the one row an owner who
  // uploaded it is looking for, and at most two of them cannot push the gallery out of reach. They
  // answer their species' chip as well as «Propias», since a serif the owner brought is a serif.
  const chosenOwn = identifyOwnFont(theme, key, fonts);
  const own: ChooserRow[] = fonts.map((font) => ({
    family: font.family,
    kind: font.kind,
    chosen: chosenOwn?.id === font.id,
    visible: (kind === "all" || kind === "own" || font.kind === kind) && matches(font.family),
    own: font,
  }));
  const gallery = galleryRows(theme, key).map(({ file: _, ...row }) => ({
    ...row,
    visible: (kind === "all" || row.kind === kind) && matches(row.family),
    own: undefined,
  }));
  return [...own, ...gallery];
}

export function visibleCount(rows: readonly ChooserRow[]): number {
  return rows.filter((row) => row.visible).length;
}

/**
 * What the live count under the search says: «8 letras», «1 letra», or the sentence for none —
 * which is the one case that has to be a sentence, because a bare «0 letras» under an empty list
 * reads as the list being broken rather than the words being wrong.
 */
export function countText(rows: readonly ChooserRow[]): string {
  const count = visibleCount(rows);
  if (count === 0) return es["editor.style.chooser.none"];
  if (count === 1) return es["editor.style.chooser.one"];
  return es["editor.style.chooser.count"].replace("{n}", String(count));
}

/**
 * The line each specimen row draws under the family's name, in that family's own face.
 *
 * **The business's own name, which is David's condition and the whole point of a specimen**: an
 * owner choosing a letter for «Taberna Santo Domingo» wants to see those words in it, not «Aa» and
 * not a pangram about a fox. A site with no name yet — the questionnaire's first field left blank —
 * gets the neutral sentence instead of an empty line, because a row with nothing under the name
 * would look like a row that failed to load.
 */
export function sampleLine(siteName: string): string {
  const trimmed = siteName.trim();
  return trimmed === "" ? es["editor.style.chooser.sample"] : trimmed;
}

/**
 * How many rows' faces are declared before the list has been scrolled at all.
 *
 * Eight is one screen of 64px rows in the dialog's tallest configuration, so the first paint shows
 * real letters rather than a column of system-font names that swap in one by one. With eight
 * families it is the whole table; the number earns its keep on día 2.
 */
const FIRST_SCREEN = 8;

/**
 * The families whose face is declared the moment the dialog opens: the first screen of visible
 * rows, plus the chosen one wherever it sits.
 *
 * **The chosen family is always in**, and that is not a courtesy. Its row is the one the radio group
 * puts the keyboard on and the one an owner reads first to confirm what they have; a chosen row
 * drawing in the fallback for a frame while its face arrives would show the letter *changing* on
 * open, for a site whose letter did not change. Everything else is revealed by the observer as it
 * comes near.
 */
export function initiallyRevealed(rows: readonly ChooserRow[]): Set<string> {
  const revealed = new Set<string>();
  for (const row of rows) {
    // An own font's face is in memory already and declared by `ownFaceCss`, never by the gallery's
    // sheet, which would refuse a family it does not ship.
    if (row.own !== undefined) continue;
    if (row.visible && revealed.size < FIRST_SCREEN) revealed.add(row.family);
    if (row.chosen) revealed.add(row.family);
  }
  return revealed;
}
