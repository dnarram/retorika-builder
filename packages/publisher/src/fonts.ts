import { ownFacesFor, ownFontsFor, SHIPPABLE_FAMILIES } from "@retorika/renderer";
import {
  fontFamilySlug,
  type OwnFont,
  type OwnFontFormat,
  type OwnLicenceFormat,
  type RetorikaDocument,
} from "@retorika/schema";

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
 *
 * **Rule three, since sprint 29: the licence is the holders', not the package's.** The text that
 * travels is google/fonts' `OFL.txt`, kept in `packages/publisher/licences/` with the commit it was
 * read at. `@fontsource`'s `LICENSE` rebuilds its copyright line from the fonts' name tables and can
 * drop a Reserved Font Name the holder declares — it dropped Libre Baskerville's, which shipped for
 * two sprints because the filter read that line (ADR 0045, amended 27 October 2026).
 */

export interface FontSource {
  /**
   * The npm package the bytes come from, pinned exactly — never a range — in **this package's own
   * `package.json` and in the root's**: the publisher's, because `test/fonts.test.ts` resolves these
   * packages from here; the root's, because `scripts/generate-font-data.ts` resolves them from there.
   * A range would let a different face in under the same licence reading, and the reading is dated.
   */
  package: string;
  /** The file inside that package's `files/`, which is also the name used in `fonts/`. */
  file: string;
  /** Where that package's licence text is written in the bundle. */
  licencePath: string;
}

/**
 * Keyed by the name the renderer puts in `url("fonts/…")`, and **derived from the renderer's own
 * table** since sprint 29 (ADR 0055): every name here is a function of the family's — the package is
 * `@fontsource/<slug>`, the licence `fonts/OFL-<Name>.txt` — so the third of the four parallel copies
 * becomes a derivation and the two tables cannot disagree. What stays hand-written is the pin of each
 * package in this package's `package.json` and the root's, which a test reads.
 */
export const FONT_SOURCES: Readonly<Record<string, FontSource>> = Object.fromEntries(
  SHIPPABLE_FAMILIES.flatMap(({ family, faces }) =>
    faces.map(({ file }): [string, FontSource] => [
      file,
      {
        package: `@fontsource/${fontFamilySlug(family)}`,
        file,
        licencePath: `fonts/OFL-${family.replaceAll(" ", "")}.txt`,
      },
    ]),
  ),
);

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

/**
 * **A font the owner brought travels as it was uploaded, with the licence they attached** (ADR 0056).
 *
 * Rule two above has a different shape for it: there is no OFL to put beside the file, because the
 * bytes are the owner's and the licence is theirs to hold. What travels instead is their declaration
 * — `licence.declared` in the record, which `buildSite` checks itself and does not leave to the
 * parser — and, when they attached one, the licence text, named from the record's `id` so that a
 * document still names no file. The media types are the four the `fuentes` bucket admits (día 6),
 * read from the format the server sniffed and never from the extension the owner's file had.
 */
export const OWN_FACE_TYPES: Readonly<Record<OwnFontFormat, string>> = {
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  otf: "font/otf",
};

export const OWN_LICENCE_TYPES: Readonly<Record<OwnLicenceFormat, string>> = {
  txt: "text/plain; charset=utf-8",
  pdf: "application/pdf",
};

/** Where the licence the owner attached is written in the bundle, or `undefined` when they
 * attached none. The key `BuildSiteOptions.fonts` wants it under — a path, as an OFL's is. */
export function ownLicencePath(font: Pick<OwnFont, "id" | "licenceFile">): string | undefined {
  return font.licenceFile === undefined
    ? undefined
    : `fonts/LICENCIA-propia-${font.id}.${font.licenceFile}`;
}

/**
 * Every key a caller has to supply in `BuildSiteOptions.fonts` for the owner's own fonts this
 * document names: each face by its file name, each attached licence by its bundle path — the same
 * two shapes `readFontBundle` uses for the table's faces and their OFLs. Nothing here is read from
 * disk: the bytes are the owner's, held by the browser or the account, and resolving them is the
 * caller's job exactly as it is for a photograph.
 */
export function ownFontKeysFor(doc: RetorikaDocument): string[] {
  const keys = ownFacesFor(doc).map((face) => face.file);
  for (const font of ownFontsFor(doc)) {
    const licence = ownLicencePath(font);
    if (licence !== undefined) keys.push(licence);
  }
  return keys;
}
