import { sectionsMatching } from "@retorika/catalog";

/**
 * The catalog's search, narrowed to what this document can actually be offered right now.
 *
 * `sectionsMatching` has existed in `packages/catalog` since sprint 4 and had its own tests since
 * sprint 5, and until today **no screen imported it**. That mattered more than an unused function
 * usually does: sprint 4 decided to keep calling the section «Precios» rather than renaming it per
 * sector *because* an owner could type «carta» and find it — a promise held up, for two sprints,
 * by code nothing could reach. The dossier §9 asks for the same thing in the same words: «si busca
 * "hero" encuentra Portada».
 *
 * A separate module rather than logic inside `Editor.tsx` for the reason `photoInventory.ts` gives
 * at more length: `vitest.config.ts` gives `apps/editor` a node project with no DOM, so a
 * component cannot be unit-tested here at all. What can be tested lives here.
 */

/** What the menu is willing to offer — `Editor.tsx`'s own `SectionOffer`, narrowed to the one
 * field this needs, so the test does not have to build names and descriptions it never reads. */
export interface Offerable {
  catalogId: string;
}

/**
 * The offers a query finds, best first; the whole list, in the catalog's own order, for an empty
 * query.
 *
 * **Filtering rather than reordering.** With nine sections a reorder is a change the owner has to
 * notice and then trust; a filter answers the question they asked. An empty query is exactly what
 * this menu showed before the search existed, which is what keeps the search from being something
 * you have to use.
 *
 * **Ranked ids are filtered through `offers`, never trusted as a list to show.** The catalog knows
 * every section; this menu does not offer every section. «Contacto y reservas» is absent whenever
 * question 5 named no destination — `blankSection` refuses to invent one — and «Avance» is never
 * offered by hand at all. Searching «reservas» must not conjure a section the menu had a reason to
 * withhold, and searching «avance» must not offer one that cannot be built.
 */
export function offersMatching<T extends Offerable>(
  offers: readonly T[],
  query: string,
): readonly T[] {
  if (query.trim() === "") return offers;
  return sectionsMatching(query).flatMap((catalogId) =>
    offers.filter((offer) => offer.catalogId === catalogId),
  );
}
