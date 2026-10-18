/**
 * The classic pair's heading face stops being Playfair Display (ADR 0045).
 *
 * **The first migration here that moves data rather than stamping a version**, and it moves it for
 * a licence reason rather than a product one. Playfair Display is published «with Reserved Font
 * Name "Playfair Display"»; what this product ships is the latin slice of four, in woff2 — glyphs
 * deleted and format changed, which OFL 1.1 calls a Modified Version twice over, and §3 does not
 * let a Modified Version carry the reserved name. EB Garamond's copyright line reserves nothing.
 * The measurement, the three exits and whose decision it was are in ADR 0045.
 *
 * **Why a stored document has to be rewritten at all.** A theme holds the *resolved* stack, not the
 * pair it came from, so a site made with «Clásica y seria» carries `'Playfair Display', Didot, …`
 * in its own bytes. Changing `TYPE_PAIRS` reaches new sites and no existing one. And the renderer
 * ships a face only when a stack's **first** family is a row of its table, so leaving these
 * documents alone would not leave them as they were: they would publish naming a family nobody
 * sends, and the heading would become whatever the visitor happens to have — which is the exact
 * state ADR 0028 exists to prevent. The letter changes either way; this way it changes to one we
 * ship.
 *
 * **The affected set is counted, not assumed:** 2 of the 19 corpus fixtures carry this stack
 * exactly (`menu-curado`, `menu-y-paginas`), 16 carry `Georgia, serif` and one the editorial pair's
 * body stack. Counted 18 October 2026.
 *
 * **Matched whole, never by prefix.** An owner cannot type a family (ADR 0032 §2 makes it
 * unexpressible), so a heading stack is always one a `TypePair` produced — which makes an exact
 * comparison both sufficient and the narrowest thing that can be written. A prefix match would also
 * catch a hand-built stack nobody can create, and would silently rewrite it.
 *
 * **`down` is lossy and says so.** It puts the Playfair stack back on anything naming EB Garamond
 * first, including a site deliberately made on EB Garamond after this version — there is nothing in
 * the document that distinguishes «was Playfair, migrated» from «chose this». A downgrade here
 * returns the stack 1.10.0 would have produced, which is the most a `down` can honestly promise.
 */

const PLAYFAIR =
  "'Playfair Display', Didot, 'Bodoni MT', 'Big Caslon', Georgia, 'Times New Roman', serif";
const GARAMOND =
  "'EB Garamond', Garamond, Baskerville, 'Big Caslon', Georgia, 'Times New Roman', serif";

/** Swap one heading stack for another, and leave every other token exactly as it is. */
function withHeading(
  input: Record<string, unknown>,
  from: string,
  to: string,
): Record<string, unknown> {
  const theme = input["theme"] as Record<string, unknown> | undefined;
  if (!theme || theme["font.heading"] !== from) return input;
  return { ...input, theme: { ...theme, "font.heading": to } };
}

const migration = {
  version: "1.11.0",
  description:
    "The classic pair's heading face is EB Garamond, because Playfair Display reserves its name (ADR 0045).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...withHeading(input, PLAYFAIR, GARAMOND), schemaVersion: "1.11.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    return { ...withHeading(input, GARAMOND, PLAYFAIR), schemaVersion: "1.10.0" };
  },
} as const;

export default migration;
