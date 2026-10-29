/**
 * The header is the owner's (ADR 0057): a document may carry a `header` object — which menus are
 * drawn, how the bar is laid out, a brand, one button — and a section or a page may carry the
 * `menuLabel` the menu calls it by.
 *
 * **`up` seals and moves nothing.** Every new key is optional and absent on every document written
 * before today, so a 1.14.0 document is already a valid 1.15.0 one — the shape of `0002`, `0006`,
 * `0008` and `0015`. The affected set is counted rather than assumed: no corpus fixture below this
 * version carries a `header` or a `menuLabel`, and nothing could have written one. Counted 28
 * October 2026. And absent means what the renderer did before the object existed, so a sealed
 * document publishes the navigation it published before.
 *
 * **`down` is lossy and says so.** 1.14.0 has nowhere to keep a header or a label, so both go. What
 * is left is the menu ADR 0043 derived — `inMenu` stays, because 1.14.0 holds it — which is the
 * navigation the document had before anybody opened «Menú».
 */

const migration = {
  version: "1.15.0",
  description:
    "A document may shape its header — two menus, a brand, one button — and label its menu entries (ADR 0057).",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.15.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const { header: _, ...rest } = input;
    const pages = Array.isArray(rest["pages"]) ? (rest["pages"] as Record<string, unknown>[]) : [];
    return {
      ...rest,
      pages: pages.map((page) => {
        const { menuLabel: _label, ...pageRest } = page;
        const sections = Array.isArray(pageRest["sections"])
          ? (pageRest["sections"] as Record<string, unknown>[])
          : [];
        return {
          ...pageRest,
          sections: sections.map((section) => {
            const { menuLabel: _sectionLabel, ...sectionRest } = section;
            return sectionRest;
          }),
        };
      }),
      schemaVersion: "1.14.0",
    };
  },
} as const;

export default migration;
