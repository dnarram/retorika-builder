/**
 * Where a shipped face's bytes and its licence come from, and the two rules that govern both
 * (ADR 0028, option A).
 *
 * **Rule one: the file is the package's file, unmodified.** `@fontsource` already ships each face
 * split by subset and by weight, so choosing the latin file of a weight the stylesheet asks for **is**
 * using it as it comes — there is no subsetting step to leave out. Conditions «only the weights the
 * pairs use, and only the latin subset» and «the woff2 exactly as they come» look like they pull
 * against each other and do not, and that is worth saying because the first instinct is to subset.
 *
 * It is also a licence matter, not only tidiness. Playfair Display is published **with Reserved Font
 * Name "Playfair Display"**, and the SIL Open Font License §3 lets that name travel only with an
 * unmodified face — a Modified Version has to be renamed. So subsetting would force us to ship a
 * differently-named family, which would then have to be renamed in the renderer's table, in the theme
 * stacks and in the editor's specimen. Shipping it whole is the cheap path *and* the compliant one.
 *
 * **Rule two: a face never travels without its licence.** The OFL requires the licence text to
 * accompany the Font Software, and our clients publish these files on their own domains — the same
 * test ADR 0011 applies to a photograph. `licencePath` is per package, so two faces from one family
 * carry one licence file between them, and a test refuses a ZIP with a `woff2` and no licence beside
 * it.
 */

export interface FontSource {
  /** The npm package the bytes come from, pinned in the root `package.json`. */
  package: string;
  /** The file inside that package's `files/`, which is also the name used in `fonts/`. */
  file: string;
  /** Where that package's licence text is written in the bundle. */
  licencePath: string;
}

/**
 * Keyed by the name the renderer puts in `url("fonts/…")`, so the two tables meet at one point and
 * `fonts.test.ts` asserts they agree. The renderer cannot import this — it must not depend on the
 * publisher, and nothing in `packages/renderer` may read a file — so one guarded seam is the floor.
 */
export const FONT_SOURCES: Readonly<Record<string, FontSource>> = {
  "inter-latin-400-normal.woff2": {
    package: "@fontsource/inter",
    file: "inter-latin-400-normal.woff2",
    licencePath: "fonts/OFL-Inter.txt",
  },
  "inter-latin-700-normal.woff2": {
    package: "@fontsource/inter",
    file: "inter-latin-700-normal.woff2",
    licencePath: "fonts/OFL-Inter.txt",
  },
  "playfair-display-latin-400-normal.woff2": {
    package: "@fontsource/playfair-display",
    file: "playfair-display-latin-400-normal.woff2",
    licencePath: "fonts/OFL-PlayfairDisplay.txt",
  },
  "playfair-display-latin-700-normal.woff2": {
    package: "@fontsource/playfair-display",
    file: "playfair-display-latin-700-normal.woff2",
    licencePath: "fonts/OFL-PlayfairDisplay.txt",
  },
};

/** The licence files the given faces oblige the bundle to carry, de-duplicated and sorted. */
export function licencesFor(files: readonly string[]): string[] {
  const paths = new Set<string>();
  for (const file of files) {
    const source = FONT_SOURCES[file];
    if (source === undefined) throw new Error(`buildSite: no source for font file "${file}"`);
    paths.add(source.licencePath);
  }
  return [...paths].sort();
}
