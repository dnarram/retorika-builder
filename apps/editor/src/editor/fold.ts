/**
 * A string flattened for matching: accents stripped, lower-cased the Spanish way.
 *
 * `«Peluquería»` and `peluqueria` are the same word to a person typing on a phone keyboard that
 * puts the accented letters behind a long press, so a search that compared them as different would
 * be telling the person their spelling is wrong. `NFD` splits a letter from its combining marks and
 * the range `U+0300`–`U+036F` is those marks; `toLocaleLowerCase("es")` so that a Turkish-locale
 * machine does not turn `I` into a dotless `ı`.
 *
 * **The third use.** The sector search in `Step2Sector.tsx` wrote it first (sprint 20), the section
 * search in `packages/catalog/src/search.ts` has its own copy for the same reason, and the letter
 * chooser (sprint 29 día 1) is the third — which is the number this project waits for before it
 * shares a function. The catalog's copy stays where it is: a package that travels with the
 * renderer's allowlist does not import from the app.
 */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es");
}
