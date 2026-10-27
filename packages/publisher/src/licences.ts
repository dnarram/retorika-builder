/**
 * Reading a font licence's copyright notice for the one question this product asks of it: **does it
 * reserve the name we present?** (ADR 0045, amended sprint 29.)
 *
 * Three readers, which is why this is a module: `scripts/survey-fonts.ts` asks it of every candidate,
 * `scripts/fetch-font-licences.ts` asks it before it writes a licence into the repository, and
 * `test/fonts.test.ts` asks it of every shipped row, offline, against the texts that script wrote.
 *
 * **Why the reserved name is compared rather than the phrase searched for.** Until sprint 29 the
 * filter asked whether the copyright line contained «Reserved Font Name» at all. Two things were wrong
 * with that, and the second is the one that shipped a reserved name for two sprints:
 *
 * - The phrase is not the question. Bitter's holders reserve «Bitter Pro» and Google publishes the
 *   family as «Bitter», which is the name we present; Lexend reserves «RevReading Lexend». §3 of the
 *   OFL restricts the Reserved Font Name(s), so what decides is whether the presented name *uses* one
 *   — David's reading, 27 October 2026.
 * - **The line it read was not the holder's.** `@fontsource`'s `LICENSE` rebuilds its copyright line
 *   from the fonts' own name tables, and for ten of ninety-two candidates that line drops the
 *   reservation the holder's `OFL.txt` declares — Libre Baskerville among them, shipped since sprint
 *   24. The texts this reads are now the holder's, kept in the repository with the commit they came
 *   from.
 */

/** Everything before the sentence that starts the licence itself, whitespace collapsed. Every OFL's
 * own §3 mentions Reserved Font Names, so reading past this point says yes about every font. */
export function copyrightNotice(text: string): string {
  const end = text.indexOf("This Font Software is licensed");
  return (end === -1 ? text : text.slice(0, end)).replace(/\s+/g, " ").trim();
}

/**
 * The names a notice reserves, in the forms the surveyed licences actually use:
 * `with Reserved Font Name "Bitter Pro"`, `'Source'`, `“RevReading Lexend”`, `< Fira >`,
 * `Reserved Font Names "PT Sans" and "ParaType"`, and the bare `with Reserved Font Name Domine.`
 *
 * The clause runs to the first full stop outside quotes; inside it, quoted names are the names, and a
 * clause with no quotes is one bare name.
 */
export function reservedFontNames(notice: string): string[] {
  const names: string[] = [];
  const text = notice.replace(/\s+/g, " ");
  const clause =
    /Reserved Font Names?\s*:?\s*((?:"[^"]*"|“[^”]*”|'[^']*'|‘[^’]*’|<[^>]*>|[^."“'‘<])*)/gi;
  for (const match of text.matchAll(clause)) {
    const rest = match[1] ?? "";
    const quoted = [...rest.matchAll(/"([^"]*)"|“([^”]*)”|'([^']*)'|‘([^’]*)’|<([^>]*)>/g)].map(
      (found) => found.slice(1).find((group) => group !== undefined) ?? "",
    );
    const found = quoted.length > 0 ? quoted : [rest.replace(/[,;]+$/, "")];
    names.push(...found.map((name) => name.trim()).filter((name) => name.length > 0));
  }
  return names;
}

/** A name's words, lower-cased, so «Source Sans 3» can be asked whether it contains «Source». */
const words = (name: string) =>
  name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * Whether presenting `family` would use a name this notice reserves: whether any reserved name's words
 * appear, in order and contiguous, among the family's. «Source Sans 3» uses «Source»; «IBM Plex Sans»
 * uses «Plex»; «Bitter» does not use «Bitter Pro».
 */
export function reservesPresentedName(notice: string, family: string): boolean {
  const presented = words(family);
  return reservedFontNames(notice).some((name) => {
    const reserved = words(name);
    if (reserved.length === 0) return false;
    for (let start = 0; start + reserved.length <= presented.length; start += 1) {
      if (reserved.every((word, index) => presented[start + index] === word)) return true;
    }
    return false;
  });
}
