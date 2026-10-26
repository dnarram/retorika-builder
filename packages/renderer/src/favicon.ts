import type { Theme } from "@retorika/schema";
import { escapeHtml } from "./escape.ts";

/**
 * The site's icon in a browser tab (ADR 0054): the business name's first letter on a disc of the
 * theme's primary colour.
 *
 * **One file beside the pages, named here so the page and the bundle cannot disagree.** The page
 * links it by this name and `buildSite` writes it under this name; a second spelling of it anywhere
 * would be a tab with no icon and a 404 in every visitor's console, which is what Lighthouse
 * counted against best practices from sprint 18 to this one.
 */
export const FAVICON_PATH = "favicon.svg";

/**
 * The first letter or digit of the name, as a capital — or nothing, when the name has none.
 *
 * **Letters and digits by Unicode property, not by an ASCII range** (`\p{L}`, `\p{N}`), so «Ñandú»
 * gives Ñ and «Ελιά» gives Ε, and punctuation a name opens with is skipped: «¡Hola!» is H, «"La
 * Tasca"» is L, «#1 Pizzas» is 1. NFC first, so an «É» typed as E and a combining accent is one
 * letter and keeps its accent. Uppercased in Spanish and then cut to its first code point, because
 * an uppercase can be longer than its letter — «ß» is «SS» — and a disc holds one.
 */
export function faviconLetter(siteName: string): string | undefined {
  const first = siteName.normalize("NFC").match(/[\p{L}\p{N}]/u)?.[0];
  if (first === undefined) return undefined;
  return [...first.toLocaleUpperCase("es")][0];
}

/**
 * The icon itself, as SVG text.
 *
 * **Surface on primary, because that pair is proved**: it is the button's own pair, one of the five
 * `CONTRAST_PAIRS` in `packages/tokens` that clear 4.5:1 in every palette, so whatever palette the
 * owner chose, the letter reads. A name with no letter or digit gets the disc alone — never a
 * placeholder glyph, which would be a letter the business does not have.
 *
 * **The letter is drawn in the visitor's own system font** (`system-ui`), and that is said rather
 * than hidden: a favicon is loaded as an image, and an image cannot fetch the site's web fonts, so
 * the letter in the tab is the device's sans-serif and not the site's heading face. Outlining the
 * glyph would fix that and needs a font parser in the renderer, which the allowlist refuses.
 *
 * Deterministic like the rest of the renderer: the same theme and name are the same bytes. Every
 * value that reaches an attribute or the text is escaped, because a theme colour is any non-empty
 * string to the schema.
 */
export function faviconSvg(theme: Theme, siteName: string): string {
  const disc = `<circle cx="16" cy="16" r="16" fill="${escapeHtml(theme["color.primary"])}"/>`;
  const letter = faviconLetter(siteName);
  const glyph =
    letter === undefined
      ? ""
      : `<text x="16" y="16" dy=".35em" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="${escapeHtml(theme["color.surface"])}">${escapeHtml(letter)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${disc}${glyph}</svg>\n`;
}
