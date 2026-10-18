/**
 * Where a shipped face's bytes and its licence come from, and the two rules that govern both
 * (ADR 0028, option A).
 *
 * **Rule one: the file is the package's file, byte for byte.** `@fontsource` already ships each face
 * split by subset and by weight, so choosing the latin file of a weight the stylesheet asks for is
 * using it as it comes — there is no subsetting step of our own to leave out, and the first instinct,
 * to subset further, is the one to resist.
 *
 * **What this used to say, and it was wrong.** It read «the file is the package's file, **unmodified**»
 * and concluded that Playfair Display's Reserved Font Name could therefore travel: «the SIL Open Font
 * License §3 lets that name travel only with an unmodified face… Shipping it whole is the cheap path
 * *and* the compliant one.» The premise is about *our* not modifying the package's file, which is
 * true. **The licence's test is against the Original Version, not against the package**, so the
 * conclusion does not follow. Measured 18 October 2026 (sprint 24 día 4):
 *
 * - The package declares four subsets for this family, and the complete 400-normal face **is four
 *   files** — cyrillic 11.2 KB, latin 21.3, latin-ext 12.0, vietnamese 5.5. We ship one of them. The
 *   package's own `400.css` proves it: four `@font-face` rules, each with its own `unicode-range`.
 * - OFL 1.1's own words, from the licence text we ship beside it: a «Modified Version» is «any
 *   derivative made by **adding to, deleting, or substituting** — in part or in whole — any of the
 *   components of the Original Version, **by changing formats** or by porting the Font Software to a
 *   new environment». A latin slice in woff2 is both of those.
 * - §3: «No Modified Version of the Font Software may use the Reserved Font Name(s) **unless explicit
 *   written permission is granted** by the corresponding Copyright Holder. This restriction only
 *   applies to the primary font name as presented to the users.» The renderer presents
 *   `font-family: 'Playfair Display'`.
 *
 * **It is one family and one family only.** Inter's copyright line declares no Reserved Font Name, so
 * nothing above touches it; Playfair Display's declares «with Reserved Font Name "Playfair Display"»
 * twice.
 *
 * **Nothing is changed here, because the exits are not development's to choose and one of them is not
 * a cure.** Shipping «the whole face» costs +58.9 KB — 107.4 against today's 48.5, which busts the
 * 80 KB bundle budget on its own — **and would still be a format conversion**, so it does not cure
 * the §3 question at all. What is left is renaming the family we present, asking the copyright holder
 * for the written permission §3 provides for, or replacing it with a serif that declares no reserved
 * name. The row in `docs/tasks/backlog.md` carries the three with their costs, and it is David's.
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
