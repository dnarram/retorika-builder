/**
 * Libre Baskerville stops being a family this product ships, and Gelasio takes its place (ADR 0045,
 * amended in sprint 29).
 *
 * **The second time the same licence reason moves data, and this time the filter was what failed.**
 * Libre Baskerville's holders publish it «with Reserved Font Name Libre Baskerville» — in google/fonts'
 * `ofl/librebaskerville/OFL.txt`, read 27 October 2026. What this product ships is the latin slice in
 * woff2, a Modified Version under OFL 1.1, and §3 does not let a Modified Version carry the reserved
 * name. It entered the gallery in sprint 24 (ADR 0046) because the filter read `@fontsource`'s
 * `LICENSE`, whose copyright line is rebuilt from the fonts' name tables and drops the reservation.
 *
 * **Why Gelasio, and why its stack keeps the fallback word for word.** David's choice: Gelasio is drawn
 * to Georgia's metrics, and Georgia is what Libre Baskerville's own stack falls back to — so a page
 * whose visitor never received the face reads exactly as it did, and a page that did receives the
 * letter that moves its lines least. The new stack is Gelasio's own gallery stack, which carries Libre
 * Baskerville's fallback chain verbatim, so a migrated site and a site that chooses Gelasio by hand
 * publish the same bytes.
 *
 * **Either half, because the gallery let either half choose it.** Unlike `0012`, which only ever
 * touched a pair's heading, Libre Baskerville was a row an owner could pick for the headings or for
 * the text — so both font tokens are matched, each on its own.
 *
 * **The affected set is counted, not assumed:** none of the 19 corpus fixtures names Libre
 * Baskerville, and no type pair does — only an owner's choice in the gallery could have written it.
 * Counted 27 October 2026. Sites already downloaded as a ZIP keep the face they were built with; no
 * migration reaches a file on somebody else's disk, and the ADR says so.
 *
 * **Matched whole, never by prefix**, for `0012`'s reason: an owner cannot type a family (ADR 0032 §2),
 * so the stack is always the one the gallery wrote.
 *
 * **`down` is lossy and says so**, as `0012`'s is: it puts Libre Baskerville back on anything naming
 * Gelasio first, including a site that chose Gelasio after this version — nothing in the document
 * tells the two apart, and 1.12.0 shipped no Gelasio for such a site to keep.
 */

const BASKERVILLE = "'Libre Baskerville', Georgia, Cambria, 'Times New Roman', Times, serif";
const GELASIO = "Gelasio, Georgia, Cambria, 'Times New Roman', Times, serif";

const FONT_TOKENS = ["font.heading", "font.body"] as const;

/** Swap one stack for another wherever a font token holds it exactly, and leave every other token
 * exactly as it is. */
function withStack(
  input: Record<string, unknown>,
  from: string,
  to: string,
): Record<string, unknown> {
  const theme = input["theme"] as Record<string, unknown> | undefined;
  if (!theme || FONT_TOKENS.every((key) => theme[key] !== from)) return input;
  const swapped = { ...theme };
  for (const key of FONT_TOKENS) if (swapped[key] === from) swapped[key] = to;
  return { ...input, theme: swapped };
}

const migration = {
  version: "1.13.0",
  description:
    "Libre Baskerville becomes Gelasio, because Libre Baskerville reserves its name (ADR 0045, amended).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...withStack(input, BASKERVILLE, GELASIO), schemaVersion: "1.13.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    return { ...withStack(input, GELASIO, BASKERVILLE), schemaVersion: "1.12.0" };
  },
} as const;

export default migration;
