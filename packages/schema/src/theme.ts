import type { RetorikaDocument } from "./document.ts";
import { type Theme, TOKEN_KEYS, themeSchema } from "./tokens.ts";

/**
 * The document's theme, replaced whole.
 *
 * There is no `setPaletteColor` and there will not be one. A theme is a *total* map over the
 * namespace — `themeSchema` is a `z.strictObject` with every key required — so the only coherent
 * edit is to swap all nineteen values at once. That is also the shape of the decision the editor
 * actually offers: a palette and a type pair, assembled by `buildTheme`, never a colour at a
 * time. `packages/tokens` owns which combinations exist and which ones pass contrast; this owns
 * nothing but putting one into a document.
 *
 * It lives in its own file rather than in `tokens.ts` because `tokens.ts` cannot see
 * `document.ts` — the dependency runs the other way, and a document verb there would be a cycle.
 *
 * Why this one validates when `setElementText` does not: an element's text is a string and any
 * string is a legal one, so re-parsing on every keystroke's blur would buy nothing. A theme
 * arrives as a whole object from a caller assembling it, and a missing or empty key there is not
 * a broken sentence — it is a CSS custom property the renderer emits with no value, in a page
 * that gets published. `buildTheme` already refuses to produce such a thing; this refuses to
 * accept one however it was built, and once per palette click costs nothing.
 *
 * The invariants are not re-checked, because there is nothing here for them to check: all five
 * are structural — orphan elements, roles, placements inside the grid — and a theme touches no
 * page, no section and no element.
 */
export function setTheme(doc: RetorikaDocument, theme: Theme): RetorikaDocument {
  const parsed = themeSchema.safeParse(theme);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("; ");
    throw new Error(`setTheme: not a complete theme — ${detail}`);
  }

  // The same theme back is not a change, and the caller gets the very same document so that a
  // history built on reference equality does not open a step. Pressing the palette a site is
  // already using should leave the undo arrow exactly as it was, not light it up for a step that
  // undoes to itself.
  if (TOKEN_KEYS.every((key) => doc.theme[key] === parsed.data[key])) return doc;

  return { ...doc, theme: parsed.data };
}
