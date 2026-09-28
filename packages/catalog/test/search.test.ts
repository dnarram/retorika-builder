import { describe, expect, it } from "vitest";
import { CATALOG, SEARCH_ALIASES, SHARED_ALIASES, sectionsMatching } from "../src/index.ts";

/**
 * The catalog search, as a whole rather than section by section.
 *
 * Every section's own test already checks that its words find it. What none of them can check is
 * the thing that only exists between sections: **a word that more than one section claims**. There
 * are two of those today — «carta» and «platos» — and for each of them the order of the results is
 * a product judgement written down in `SHARED_ALIASES`.
 *
 * This file exists because of a hole found while adding the eighth section. `SHARED_ALIASES` was
 * given its «platos» entry and every test still passed with the entry deleted: `CATALOG`'s own
 * insertion order happened to give the same answer, so the declaration was decorative and the real
 * behaviour rested on the order of a registry whose order is about something else entirely — it is
 * the order the "Añadir sección aquí" menu reads in. Reordering that menu would silently reorder
 * search results, and nothing would have said so.
 */

/** Lower case, unaccented — the same folding `sectionsMatching` does to a query. */
function normalise(text: string): string {
  return text.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Every alias claimed, word for word, by more than one section. */
function contestedAliases(): Map<string, string[]> {
  const claimants = new Map<string, string[]>();
  for (const [catalogId, aliases] of Object.entries(SEARCH_ALIASES)) {
    for (const alias of aliases) {
      const key = normalise(alias);
      claimants.set(key, [...(claimants.get(key) ?? []), catalogId]);
    }
  }
  return new Map([...claimants].filter(([, sections]) => sections.length > 1));
}

describe("a word more than one section claims", () => {
  it("is declared in SHARED_ALIASES, so no result order is an accident of the registry", () => {
    // The guard the hole above needed. Give a third section the word «carta» and this fails here,
    // at the table, instead of quietly changing what an owner is offered.
    expect([...contestedAliases().keys()].sort()).toEqual(Object.keys(SHARED_ALIASES).sort());
  });

  it("names in the table exactly the sections that claim it", () => {
    for (const [alias, claimants] of contestedAliases()) {
      expect([...(SHARED_ALIASES[alias] ?? [])].sort(), alias).toEqual([...claimants].sort());
    }
  });

  it("is answered in the declared order, ahead of everything that only matches partially", () => {
    for (const [alias, order] of Object.entries(SHARED_ALIASES)) {
      expect(sectionsMatching(alias).slice(0, order.length), alias).toEqual([...order]);
    }
  });

  it("does not survive in the table once a section stops claiming it", () => {
    // The other direction, which is the one that rots quietly: an alias removed from a section
    // leaves an entry here deciding an order nobody needs any more.
    for (const alias of Object.keys(SHARED_ALIASES)) {
      expect(contestedAliases().has(alias), `${alias} is declared but no longer contested`).toBe(
        true,
      );
    }
  });
});

describe("what the search may point at", () => {
  it("only names sections the catalog actually has", () => {
    // An alias list for a section that was renamed or removed would offer the owner a section the
    // editor cannot build, and `presetFor` would throw at the moment they picked it.
    for (const catalogId of Object.keys(SEARCH_ALIASES)) {
      expect(CATALOG, catalogId).toHaveProperty([catalogId]);
    }
    for (const sections of Object.values(SHARED_ALIASES)) {
      for (const catalogId of sections) expect(CATALOG, catalogId).toHaveProperty([catalogId]);
    }
  });

  it("gives every section in the catalog something to be found by", () => {
    // The eighth section was added to the registry and the locale file before it was added here;
    // between those two commits it existed in the menu and answered to nothing anybody would type.
    for (const catalogId of Object.keys(CATALOG)) {
      expect(SEARCH_ALIASES[catalogId], catalogId).toBeDefined();
      expect(SEARCH_ALIASES[catalogId]?.length ?? 0, catalogId).toBeGreaterThan(0);
    }
  });
});
