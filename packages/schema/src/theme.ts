import type { RetorikaDocument } from "./document.ts";
import {
  FILL_KEYS,
  type PaletteOrigin,
  paletteOriginSchema,
  type Theme,
  TOKEN_KEYS,
  themeSchema,
} from "./tokens.ts";

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
export function setTheme(
  doc: RetorikaDocument,
  theme: Theme,
  /**
   * Where these colours come from, when the caller knows (ADR 0075, sprint 38 día 3): a palette the
   * owner chose in «Estilo», their logo, or their own. **Omitted means «the origin does not change»**
   * — a type pair or a scale is a theme too, and choosing one says nothing about the colours — never
   * «clear it». Nothing clears an origin but undo, which restores the whole document it came from:
   * the generator's untouched start is the only document without one, and no verb makes a new one.
   */
  origin?: PaletteOrigin,
): RetorikaDocument {
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
  //
  // **The fill pair counts** (ADR 0074): a theme whose only change is its fill — the owner moving the
  // button's colour and nothing else — is a change, and comparing the nineteen alone would call it
  // none, open no step and patch nothing.
  const sameTheme = [...TOKEN_KEYS, ...FILL_KEYS].every(
    (key) => doc.theme[key] === parsed.data[key],
  );

  if (origin === undefined) return sameTheme ? doc : { ...doc, theme: parsed.data };

  const checked = paletteOriginSchema.safeParse(origin);
  if (!checked.success) {
    throw new Error(`setTheme: not a palette origin — ${JSON.stringify(origin)}`);
  }
  // The same colours from the same origin are not a change either. The same colours from a *new*
  // origin are: «Neutra» chosen on purpose after the untouched start writes nothing visible and
  // still has to be told apart from it (ADR 0075 §2), which is the one thing the origin is for.
  if (sameTheme && JSON.stringify(doc.palette) === JSON.stringify(checked.data)) return doc;

  return { ...doc, theme: parsed.data, palette: checked.data };
}
