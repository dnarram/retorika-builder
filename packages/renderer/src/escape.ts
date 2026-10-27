import { FONT_FAMILY_PATTERN } from "@retorika/schema";

/**
 * Escaping, the separate problem of dangerous URL schemes, theme values inside <style>, and
 * document ids inside a CSS selector.
 *
 * Everything here ends up on a client's published site, so user content is never
 * interpolated raw. Four distinct defences live in this file because they protect four
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

/**
 * The one exception to "no `url()` and no network", and it is written as narrowly as the rule it
 * dents (ADR 0028's option A).
 *
 * **Why an exception at all.** A self-hosted `@font-face` is the only way to give the visitor the
 * letterform the editor showed, offline, with no third party — and `cssThemeValue` above cannot be
 * widened to allow it, because a `url()` that a *document* can influence is exactly the hole its
 * comment exists to close. So the exception does not widen anything: it is two functions that accept
 * a short, closed vocabulary and refuse everything else, and `cssThemeValue` is untouched.
 *
 * **Three properties make it safe, and all three are deliberate:**
 *
 * 1. **The caller cannot choose the directory.** `fonts/` is written here, not passed in, so the only
 *    `url()` this renderer can emit anywhere points inside the folder the publisher writes.
 * 2. **The file name must end in `.woff2`**, lower-case, with no dots before it. That alone refuses
 *    `../`, an absolute path, a protocol, a second extension, and a query string.
 * 3. **Neither pattern admits a character that could leave the rule**: no `"`, `'`, `)`, `;`, `{`,
 *    `}`, `/`, `\`, `:`, no whitespace in a file name, and nothing that could start `</style>`.
 *
 * **And the values never come from the document.** `fonts.ts` holds a closed table of family names
 * and file names; a theme *selects* a row from it by exact equality and can never name one. These
 * functions are the second lock on that, for the day somebody wires a document value in by mistake.
 */
// The family pattern is the gallery's own filter 4 (ADR 0046 §3), so it lives beside the gallery in
// `@retorika/schema` and both the filter and this lock read the one regex.
const CSS_FONT_FAMILY = FONT_FAMILY_PATTERN;
const CSS_FONT_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.woff2$/;

/** A shipped family's name, quoted for `font-family` inside `@font-face`. */
export function cssFontFamilyName(family: string): string {
  if (!CSS_FONT_FAMILY.test(family)) {
    throw new Error(
      `Font family cannot be emitted into CSS: ${JSON.stringify(family)}. ` +
        `Allowed: ASCII letters and digits in space-separated words.`,
    );
  }
  return `'${family}'`;
}

/** A shipped face's file, as the whole `src` value — directory included, so the caller cannot
 * choose one. The only `url()` this renderer is able to produce. */
export function cssFontSrc(file: string): string {
  if (!CSS_FONT_FILE.test(file)) {
    throw new Error(
      `Font file cannot be emitted into CSS: ${JSON.stringify(file)}. ` +
        `Allowed: lower-case letters, digits and hyphens, ending in ".woff2".`,
    );
  }
  return `url("fonts/${file}") format("woff2")`;
}

/**
 * A document id as it may appear between the quotes of a CSS attribute selector.
 *
 * **This one escapes where `cssThemeValue` refuses, and the difference is whose value it is.**
 * A theme value is something a person chose, so refusing it is a sentence they can act on. An
 * element id is an opaque key the product minted: refusing one would make a stored document
 * unpublishable for a reason its owner cannot see, let alone fix. CSS string escaping is total —
 * every character has a representation — so there is nothing here that has to be refused, and the
 * selector goes on meaning exactly what it meant.
 *
 * **It closes a real hole rather than hardening a hypothetical one.** `idSchema` is
 * `z.string().min(1).max(128)` with no pattern, and `buildCss` has interpolated section and element
 * ids into `[data-section="…"]` raw since sprint 8 day 6. Measured on this branch, a section whose
 * id is `sec-a"] * { display: none } [data-section="sec-a` published this:
 *
 *     [data-section="sec-a"] * { display: none } [data-section="sec-a"] [data-id="el-h"] { order: 1; }
 *
 * — an arbitrary rule, in the client's own stylesheet, blanking the whole page below 720px. Nothing
 * in the product mints an id like that today, so it has never bitten; but this renderer's rule is
 * that user content is never interpolated raw, and "no current caller does that" is the argument
 * every injection is eventually found behind. Sprint 9 day 3 was about to add a third such site.
 *
 * Backslash and quote take a backslash, which is what a CSS string defines. Control characters —
 * a newline ends a CSS string and turns the rest of the stylesheet into garbage — take the
 * hexadecimal form with its terminating space, the only representation a string admits for them.
 */
export function cssAttributeValue(value: string): string {
  return (
    value
      .replace(/[\\"]/g, (char) => `\\${char}`)
      // biome-ignore lint/suspicious/noControlCharactersInRegex: escaping them is the point
      .replace(/[ -]/g, (char) => `\\${char.codePointAt(0)?.toString(16)} `)
  );
}
