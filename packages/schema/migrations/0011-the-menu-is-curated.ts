/**
 * A section and a page may say whether they appear in the menu (ADR 0043).
 *
 * One optional key, on two objects, for one decision: «el usuario debería ser capaz de decidir si
 * una sección no debería aparecer en ese menú». The menu still writes itself — the words are still
 * a section's own heading and a page's own title, read when the page is drawn. What the document
 * gains is a boolean per destination and never a label, a URL or an order.
 *
 * **The affected set is counted and it is zero.** No stored document can carry either key: nothing
 * could write one before this version, and every object here is a `strictObject`, so a document
 * that somehow had one would never have parsed. Counted across `fixtures/` on 16 October 2026 and
 * true by construction. A shape change that moves no data takes a minor, which is `0005`, `0007`,
 * `0009` and `0010`'s precedent.
 *
 * **`up` stamps and nothing else, and that is said rather than disguised.** There is nothing a
 * 1.9.0 document could hold that 1.10.0 reads differently: absent means «it appears», which is
 * what every menu did before the key existed.
 *
 * **`down` has real work, for `0010`'s reason.** At 1.9.0 a section and a page are strict objects
 * and `inMenu` is an unknown key there, so it would be refused — both are dropped. What is lost on
 * the way down is the owner's visibility choices, and with them the fact that they curated at all:
 * a menu that had been pruned to two entries comes back as a menu of two that the threshold of
 * three then refuses to draw. No word anybody wrote is lost, and that distinction is the one worth
 * holding on to.
 */

interface Section {
  inMenu?: unknown;
}
interface Page {
  inMenu?: unknown;
  sections?: Section[];
}

const migration = {
  version: "1.10.0",
  description:
    "A section and a page may say whether they appear in the menu, which splits in two (ADR 0043).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.10.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const pages = (input["pages"] as Page[] | undefined) ?? [];
    return {
      ...input,
      pages: pages.map((page) => {
        const { inMenu: _droppedFromPage, ...rest } = page;
        return {
          ...rest,
          sections: (rest.sections ?? []).map((section) => {
            const { inMenu: _droppedFromSection, ...keep } = section;
            return keep;
          }),
        };
      }),
      schemaVersion: "1.9.0",
    };
  },
} as const;

export default migration;
