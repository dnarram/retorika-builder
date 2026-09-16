/**
 * Escaping, and the separate problem of dangerous URL schemes.
 *
 * Everything here ends up on a client's published site, so user content is never
 * interpolated raw. Two distinct defences live in this file because they protect against
 * two distinct things, and conflating them is the classic way a site ships an exploit.
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
