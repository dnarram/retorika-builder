/**
 * Each menu has its place (ADR 0060, sprint 31 día 2): `header.pages.position` and
 * `header.sections.position` say where each menu sits — the bar, a rail on either side, and for the
 * sections a row of its own or the «Ir a…» disclosure — and `header.brandWithPages` takes the brand
 * and the button into the pages menu's rail. `sections.mobile` gains `fold`.
 *
 * **`up` moves one thing and seals the rest.** `sections.row` was the one place key 1.16.0 had, and
 * it is absorbed: `row: "own"` is `position: "row"` — the same line under the bar, the same
 * published page — and `row: "shared"` is the bar, which an absent `position` already means, so the
 * key goes and nothing replaces it (on the way back it stays absent, which 1.16.0 reads as
 * `"shared"`). Every other new key is optional, so a 1.16.0 document is
 * otherwise already a 1.17.0 one. The affected set is counted rather than assumed: one corpus
 * fixture carries `row`, `cabecera-con-marca`, with `"own"`, and it was moved to 1.17.0 by this
 * migration's own `up`. Counted 31 October 2026.
 *
 * **`down` is lossy and says so.** 1.16.0 has a row and nothing else: `position: "row"` goes back to
 * `row: "own"`, `bar` to nothing, and a rail (`left`, `right`), the disclosure (`fold`), the pages
 * menu's position, `brandWithPages` and a phone's `fold` have nowhere to go and are dropped — what
 * is left is the header in its bar, which is what 1.16.0 publishes.
 */

type Bag = Record<string, unknown>;

function without(bag: Bag, ...keys: string[]): Bag {
  return Object.fromEntries(Object.entries(bag).filter(([key]) => !keys.includes(key)));
}

const migration = {
  version: "1.17.0",
  description:
    "Each menu has its place: the bar, a rail, a row of its own or the disclosure (ADR 0060, sprint 31).",

  up(input: Bag): Bag {
    const header = input["header"] as Bag | undefined;
    const sections = header?.["sections"] as Bag | undefined;
    if (header === undefined || sections === undefined || !("row" in sections)) {
      return { ...input, schemaVersion: "1.17.0" };
    }
    const moved = {
      ...without(sections, "row"),
      ...(sections["row"] === "own" ? { position: "row" } : {}),
    };
    return { ...input, header: { ...header, sections: moved }, schemaVersion: "1.17.0" };
  },

  down(input: Bag): Bag {
    const header = input["header"] as Bag | undefined;
    if (header === undefined) return { ...input, schemaVersion: "1.16.0" };
    // Each menu's object as 1.16.0 can hold it — or `undefined` when this step emptied it. Only what
    // this step itself empties is tidied away, so a 1.16.0 document that already held an empty
    // object gets it back on the round trip.
    const pages = header["pages"] as Bag | undefined;
    const pagesBack =
      pages !== undefined && "position" in pages ? without(pages, "position") : pages;
    const sections = header["sections"] as Bag | undefined;
    const touched =
      sections !== undefined && ("position" in sections || sections["mobile"] === "fold");
    const sectionsBack =
      sections !== undefined && touched
        ? {
            ...without(sections, "position", ...(sections["mobile"] === "fold" ? ["mobile"] : [])),
            ...(sections["position"] === "row" ? { row: "own" } : {}),
          }
        : sections;
    const emptiedPages = pagesBack !== pages && Object.keys(pagesBack ?? {}).length === 0;
    const emptiedSections =
      sectionsBack !== sections && Object.keys(sectionsBack ?? {}).length === 0;
    const back: Bag = {
      ...without(header, "brandWithPages", "pages", "sections"),
      ...(pagesBack === undefined || emptiedPages ? {} : { pages: pagesBack }),
      ...(sectionsBack === undefined || emptiedSections ? {} : { sections: sectionsBack }),
    };
    const { header: _, ...rest } = input;
    // A header that held nothing but what 1.16.0 cannot keep goes with it.
    return Object.keys(back).length === 0 && Object.keys(header).length > 0
      ? { ...rest, schemaVersion: "1.16.0" }
      : { ...rest, header: back, schemaVersion: "1.16.0" };
  },
} as const;

export default migration;
