/**
 * Escaping, the separate problem of dangerous URL schemes, and theme values inside <style>.
 *
 * Everything here ends up on a client's published site, so user content is never
 * interpolated raw. Three distinct defences live in this file because they protect three
 * distinct contexts, and applying one context's defence in another is the classic way a
 * site ships an exploit — or, as happened with the theme, a broken page (PR #6, finding 4).
 */

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Text content and attribute values. `&` first, or the other replacements get mangled. */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char] ?? char);
}

/**
 * URL schemes that execute rather than navigate.
 *
 * Escaping does **not** help here: `javascript:alert(1)` contains no character that
 * escaping touches, so an escaped href is still a live script. This is a separate
 * defence with its own test for exactly that reason.
 */
const EXECUTABLE_SCHEMES = ["javascript:", "vbscript:"];

export const NEUTRALISED_URL = "#";

/**
 * Browsers ignore control characters and whitespace when parsing a scheme, so
 * "java\tscript:alert(1)" and " javascript:..." both execute. Strip them before testing,
 * but return the *original* string when it is safe — the normalised form is for the
 * check only.
 */
function normaliseForSchemeCheck(input: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
  return input.replace(/[\u0000-\u0020\u007f]/g, "").toLowerCase();
}

export function safeUrl(input: string): string {
  const normalised = normaliseForSchemeCheck(input);

  for (const scheme of EXECUTABLE_SCHEMES) {
    if (normalised.startsWith(scheme)) return NEUTRALISED_URL;
  }

  // `data:` is legitimate for an inline image and dangerous for a link, because
  // data:text/html executes in the document's own origin. Images are allowed; anything
  // else is not.
  if (normalised.startsWith("data:") && !normalised.startsWith("data:image/")) {
    return NEUTRALISED_URL;
  }

  return input;
}

/**
 * The one character set a theme value may use inside <style>, quoted or not: ASCII letters
 * and digits, U+0020 space (never any other whitespace), and # . , - % _.
 *
 * Nothing in it can end the declaration or the rule (; { }), open a comment (/ *), start a
 * CSS escape (\), call a function — so no url() and no network — or begin </style>.
 */
const CSS_SAFE = "A-Za-z0-9 #.,%_-";
const CSS_THEME_VALUE = new RegExp(`^(?:[${CSS_SAFE}]|'[${CSS_SAFE}]*'|"[${CSS_SAFE}]*")+$`);

/**
 * A theme value as it may appear in a CSS custom property inside <style>, returned
 * unchanged, or an error naming the key and the value.
 *
 * Never escapes and never cleans: a value is either safe to emit verbatim or refused.
 *
 * <style> is a raw-text element, so the browser never decodes HTML entities inside it:
 * escapeHtml there does not protect anything, it corrupts the value — 'Times New Roman'
 * became &#39;Times New Roman&#39; and every published font fell back to Times. The CSS
 * context cannot be escaped into safety, only validated, so this is an allowlist. Quotes
 * only delimit a family name; they never admit a character a bare run would refuse, which
 * is what lets no accepted value contain ; { or } anywhere.
 */
export function cssThemeValue(key: string, value: string): string {
  // The pattern alone would accept spaces only; an empty custom property silently
  // disables the style it feeds, so a value needs at least one visible character.
  if (!CSS_THEME_VALUE.test(value) || value.trim() === "") {
    throw new Error(
      `Theme value for "${key}" cannot be emitted into CSS: ${JSON.stringify(value)}. ` +
        `Allowed: ASCII letters and digits, space, # . , - % _ and quoted family names.`,
    );
  }
  return value;
}
