/**
 * An element may choose between the two families its theme already carries (ADR 0032).
 *
 * **Additive, so `up` is a version stamp.** `fontFamily` is an optional property on an optional
 * object: every 1.6.0 document is already a valid 1.7.0 one, and nothing has to be filled in. An
 * element that says nothing about its family goes on inheriting the one the section's stylesheet
 * gives it, which is what every document written before today publishes and what they will go on
 * publishing.
 *
 * **It ships no face, and that is why it costs nothing.** `font.heading` and `font.body` are already
 * keys of the closed token namespace and already resolve, through the type pair the site is on, to
 * families the ZIP either carries (ADR 0028's option A) or degrades from honestly (option C). The
 * property lets an element pick the *other* one; it never introduces a third.
 *
 * `down` strips it, for the reason `0002` strips `sample` and `0006` strips the two share fields:
 * 1.6.0 is a strict schema with nowhere to put it, so carrying it down would produce a document
 * that does not parse at the version it claims. The key is deleted rather than set to `undefined`,
 * which the strict schema and `exactOptionalPropertyTypes` both treat as a different thing — and an
 * element left with an empty `style` object loses that too, because `setElementStyle` never stores
 * one and a document that comes back carrying one would not round-trip.
 */

interface Element {
  style?: Record<string, unknown>;
  items?: { elements?: Element[] }[];
}
interface Section {
  content?: Element[];
}
interface Page {
  sections?: Section[];
}

/** Every element, items included — the same walk `flattenElements` makes, written out here because
 * a migration reads raw JSON and may not import the schema it is migrating. */
function withoutFontFamily(elements: Element[]): Element[] {
  return elements.map((element) => {
    const next: Element = { ...element };
    if (next.style && "fontFamily" in next.style) {
      const { fontFamily: _dropped, ...rest } = next.style;
      if (Object.keys(rest).length === 0) delete next.style;
      else next.style = rest;
    }
    if (next.items) {
      next.items = next.items.map((item) => ({
        ...item,
        elements: withoutFontFamily(item.elements ?? []),
      }));
    }
    return next;
  });
}

export const migration = {
  version: "1.7.0",
  description:
    "An element may name one of the two font families its theme carries (ADR 0032). No exact value.",

  up(input: Record<string, unknown>): Record<string, unknown> {
    return { ...input, schemaVersion: "1.7.0" };
  },

  down(input: Record<string, unknown>): Record<string, unknown> {
    const pages = (input["pages"] as Page[] | undefined) ?? [];
    return {
      ...input,
      pages: pages.map((page) => ({
        ...page,
        sections: (page.sections ?? []).map((section) => ({
          ...section,
          content: withoutFontFamily(section.content ?? []),
        })),
      })),
      schemaVersion: "1.6.0",
    };
  },
} as const;

export default migration;
