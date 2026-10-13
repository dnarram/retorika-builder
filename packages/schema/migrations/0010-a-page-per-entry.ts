/**
 * A page may be bound to a collection, and an entry may carry a slug (ADR 0040).
 *
 * Two optional keys, one decision: «una página por ficha». A page with `binding` is the stored
 * template that the publisher draws once per entry; an entry's `slug` is the file name that drawing
 * gets, minted once from the title field and then held still (ADR 0022's rule, applied to entries).
 *
 * **The affected set is counted and it is zero.** No stored document has either key: nothing could
 * write a page binding before this version, and a slug is only minted the day a collection gains a
 * page. Counted across `fixtures/` on 13 October 2026 — one fixture carries a collection
 * (`contenido-reutilizable`, three entries, no page) — and true by construction. A shape change that
 * moves no data takes a minor, which is `0005`, `0007` and `0009`'s precedent.
 *
 * **`up` stamps and nothing else, and that is said rather than disguised.** `0009` wrote a real
 * transform because 1.7.0 fields were bare strings and a hand-written document could carry one;
 * here there is nothing a 1.8.0 document could hold that 1.9.0 reads differently. Both new keys are
 * optional and absent means what absent meant before.
 *
 * **`down` has real work, because 1.8.0's objects are strict.** A page binding and an entry slug are
 * unknown keys there and would be refused, so both are dropped. And a page that *was* bound carried
 * leaves reading the collection outside any bound list — legal at 1.9.0 on that page, a rule-5
 * violation at 1.8.0 («sits in no list bound to it»). Those bindings are dropped too, which leaves
 * each leaf showing the words it was last drawn with: the page becomes an ordinary page carrying the
 * template's text, the same thing `unbindList` does for a card. What is lost on the way down is the
 * page-per-entry itself, not any word anybody wrote.
 */

interface Element {
  binding?: { collectionId?: string; field?: string };
  role?: string;
  items?: { elements?: Element[] }[];
}
interface Section {
  content?: Element[];
}
interface Page {
  binding?: unknown;
  sections?: Section[];
}
interface Entry {
  slug?: unknown;
}
interface Collection {
  entries?: Entry[];
}

/** Leaf bindings dropped everywhere except inside a bound list, which is the only place 1.8.0
 * admits them. The list's own binding, and its template's leaves, are left exactly as they are. */
function withoutPageLevelBindings(elements: Element[]): Element[] {
  return elements.map((element) => {
    if (element.role === "list" && element.binding && element.binding.field === undefined) {
      return element;
    }
    const next: Element = { ...element };
    if (next.binding?.field !== undefined) delete next.binding;
    if (next.items) {
      next.items = next.items.map((item) => ({
        ...item,
        elements: withoutPageLevelBindings(item.elements ?? []),
      }));
    }
    return next;
  });
}

export const migration = {
  version: "1.9.0",
  description:
    "A page may be bound to a collection as its page per entry, and an entry may carry a slug (ADR 0040).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.9.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const pages = (input["pages"] as Page[] | undefined) ?? [];
    const collections = (input["collections"] as Collection[] | undefined) ?? [];
    return {
      ...input,
      pages: pages.map((page) => {
        const { binding, ...rest } = page;
        if (binding === undefined) return page;
        return {
          ...rest,
          sections: (rest.sections ?? []).map((section) => ({
            ...section,
            content: withoutPageLevelBindings(section.content ?? []),
          })),
        };
      }),
      collections: collections.map((collection) => ({
        ...collection,
        entries: (collection.entries ?? []).map((entry) => {
          const { slug: _dropped, ...rest } = entry;
          return rest;
        }),
      })),
      schemaVersion: "1.8.0",
    };
  },
} as const;

export default migration;
