import type { ContentElement, Page, Section } from "../src/document.ts";

/**
 * An image may say which sample it is — the catalog's grey marker, or a photo from the bank
 * (ADR 0011). The field is optional, so **every 1.0.0 document is already a valid 1.1.0
 * document** and `up` has nothing to change but the version it claims.
 *
 * That is what makes this the right first migration to run for real. The product has had the
 * guard since sprint 1 and never exercised it: `isInitialState` let every schema change through
 * while `0001-initial` stood alone, which is why sprints 1 to 5 added files to `packages/schema/src`
 * without one. From here the guard bites for good, and it bites on a step whose failure mode is
 * nothing — which is exactly when you want to find out the machinery works.
 *
 * `down` is not decoration. It is what the round-trip test compares against, and the only proof
 * that the new field is genuinely additive: strip it everywhere, including inside list items, and
 * what comes back is the document that went in.
 */

function withoutSample(element: ContentElement): ContentElement {
  const items = element.items?.map((item) => ({
    ...item,
    elements: item.elements.map(withoutSample),
  }));

  if (element.value?.kind !== "image" || element.value.sample === undefined) {
    return items ? { ...element, items } : element;
  }
  // Rebuilt without the key rather than set to undefined: `exactOptionalPropertyTypes` and the
  // strict schema both treat "absent" and "present and undefined" as different things, and only
  // the first of them round-trips.
  const { sample: _dropped, ...value } = element.value;
  return items ? { ...element, value, items } : { ...element, value };
}

export const migration = {
  version: "1.1.0",
  description:
    "An image value may name the sample it is, so the editor can tell it from the owner's own photo.",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.1.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const pages = (input["pages"] as Page[] | undefined) ?? [];
    return {
      ...input,
      schemaVersion: "1.0.0",
      pages: pages.map((page) => ({
        ...page,
        sections: page.sections.map((section: Section) => ({
          ...section,
          content: section.content.map(withoutSample),
        })),
      })),
    };
  },
} as const;

export default migration;
