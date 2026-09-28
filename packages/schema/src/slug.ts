/**
 * A page's slug: what its file is called, and the one thing about a page the owner never sees.
 *
 * ADR 0022. The rules used to live in `packages/publisher/src/site.ts`, where a slug becomes a file
 * name — which is the last thing that runs before a ZIP is written. A page slugged «Mi Página»
 * therefore passed `parseDocument`, passed the download route's bounds checks, and failed *inside*
 * `buildSite`: a 500 at the moment of download rather than a validation error where it was written.
 * They belong here, beside every other rule about what a document may contain.
 *
 * The shape is unchanged and is not ours to widen: `docs/tasks/publisher.md` calls the bundle
 * layout "decided — do not improvise", because a link has to resolve identically from `file://` and
 * from a server. `servicios.html` does; `/servicios` and `/servicios/` do not.
 */

/** A slug that can be a file name on any filesystem and needs no escaping inside a link. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * A title turned into a slug: accents folded, ñ folded, everything else dropped.
 *
 * «Peluquería» → `peluqueria`, «Diseño» → `diseno`, «Cañón» → `canon`, «Menú del día» →
 * `menu-del-dia`. Spanish business names carry accents and eñes as a matter of course, so folding
 * them is the difference between a slug and a throw.
 *
 * NFD then stripping the combining marks, which is the same decomposition
 * `packages/catalog/src/search.ts` already uses to make «Menú» and «menu» the same query. Written
 * out rather than shared: one is about matching what somebody typed, the other about naming a file,
 * and tying them together would mean a change to either reaching the other.
 *
 * Returns `undefined` when nothing survives — a title of only punctuation or only emoji. The caller
 * decides what to do, because only the caller knows whether it has a fallback.
 */
export function slugFrom(title: string): string | undefined {
  const folded = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return SLUG_PATTERN.test(folded) ? folded : undefined;
}

/**
 * A slug no page in this list is using, from a title.
 *
 * `index` is reserved whatever the title: the first page is always the entry
 * (`packages/publisher/src/site.ts`), so a second page claiming it would make one of the two
 * unreachable. `mintSectionId`'s counter, applied to slugs.
 */
export function mintSlug(title: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  used.add("index");
  const root = slugFrom(title) ?? "pagina";
  if (!used.has(root)) return root;
  let suffix = 2;
  while (used.has(`${root}-${suffix}`)) suffix += 1;
  return `${root}-${suffix}`;
}
