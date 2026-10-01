/**
 * `breakpoints` stops admitting a `tablet` bucket: mobile is the only patch there is (ADR 0030).
 *
 * **A narrowing, and it is cheap for exactly the reason `0003` was cheap.** That migration closed
 * the style vocabulary and took a minor rather than a major because the set of affected documents
 * was empty — nothing had ever written an element style. The same is true here, and it was counted
 * rather than assumed:
 *
 * - **No producer writes one.** The editor makes mobile patches only (`setMobilePatch`); the
 *   questionnaire and the catalogue never touch breakpoints at all.
 * - **No document carries one.** Three fixtures and six prototype documents mention `tablet`, and
 *   every single one holds `[]` — the key present and empty, never a patch.
 * - **The renderer refused one anyway.** `buildCss` has thrown on a non-empty tablet array since
 *   sprint 8, so such a document could never have been published.
 *
 * So no work is lost, which is what makes this a minor (1.3.0 → 1.4.0) under ADR 0004's asymmetry
 * rather than a major. **And, like `0003`, that window was open exactly once:** the day somebody
 * writes a real tablet patch, this `up` would have to choose between dropping it silently and
 * locking them out of their own site, and neither is a good answer.
 *
 * `up` still strips the key, because present-and-empty is the state the fixtures were actually in
 * and a strict schema rejects it. `down` is a version stamp: the key was optional, so every 1.4.0
 * document is already a valid 1.3.0 one.
 */

interface Layout {
  breakpoints?: Record<string, unknown>;
}
interface Section {
  layout?: Layout | null;
}
interface Page {
  sections?: Section[];
}

/** Every section's layout on every page, with `breakpoints.tablet` gone if it was there. */
function withoutTablet(pages: Page[]): Page[] {
  return pages.map((page) => ({
    ...page,
    sections: (page.sections ?? []).map((section) => {
      const breakpoints = section.layout?.breakpoints;
      if (!section.layout || !breakpoints || !("tablet" in breakpoints)) return section;
      const { tablet: _dropped, ...rest } = breakpoints;
      return { ...section, layout: { ...section.layout, breakpoints: rest } };
    }),
  }));
}

export const migration = {
  version: "1.4.0",
  description: "A section's breakpoints hold one bucket: mobile. The tablet bucket is removed.",

  up(input: Record<string, unknown>): Record<string, unknown> {
    const pages = (input["pages"] as Page[] | undefined) ?? [];
    return { ...input, pages: withoutTablet(pages), schemaVersion: "1.4.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.3.0" };
  },
} as const;

export default migration;
