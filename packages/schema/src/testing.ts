import fc from "fast-check";
import { type ContentElement, type RetorikaDocument, SCHEMA_VERSION } from "./document.ts";
import type { PresetShape, PresetSlot } from "./preset.ts";
import { type Theme, TOKEN_KEYS } from "./tokens.ts";

/**
 * Generators of *valid* documents, for the property tests.
 *
 * A worked example proves a case; a property proves the rule. These live in the package
 * rather than in a test folder so `@retorika/catalog` and `@retorika/renderer` can share
 * them without reaching across package boundaries by relative path.
 */

const identifier = fc.stringMatching(/^[a-z][a-z0-9-]{0,16}$/);

/** Arbitrary text, including the awkward cases: empty, unicode, quotes, angle brackets. */
export const arbitraryText = fc.oneof(
  fc.string(),
  fc.constant(""),
  fc.constant('a "quoted" value'),
  fc.constant("acentuación y ñ"),
  fc.constant("<b>not markup</b>"),
);

/**
 * A *complete* theme, because a partial one is invalid by design: the map has to cover
 * the whole namespace for a single click to restyle the whole site.
 */
export const arbitraryTheme: fc.Arbitrary<Theme> = fc
  .string({ minLength: 1, maxLength: 8 })
  .map((suffix) => Object.fromEntries(TOKEN_KEYS.map((key) => [key, `${key}-${suffix}`])) as Theme);

/** A value whose kind suits the role, so generated documents render like real ones. */
function arbitraryValue(slot: PresetSlot) {
  switch (slot.role) {
    case "image":
      return arbitraryText.map((alt) => ({ kind: "image" as const, src: "assets/x.svg", alt }));
    case "button":
    case "link":
      return arbitraryText.map((text) => ({ kind: "link" as const, text, href: "#" }));
    default:
      return arbitraryText.map((text) => ({ kind: "text" as const, text }));
  }
}

function arbitraryElement(slot: PresetSlot, index: number): fc.Arbitrary<ContentElement> {
  return fc.record({
    id: identifier.map((base) => `${base}-${slot.slot}-${index}`),
    role: fc.constant(slot.role),
    hidden: fc.boolean(),
    slot: fc.constant(slot.slot),
    value: arbitraryValue(slot),
  });
}

/**
 * A document whose sections match the given preset, so it is valid by construction.
 * Cardinality is respected: every slot gets at least `min` elements and at most `max`.
 *
 * The variant is a parameter because schema must not know which variants a catalog
 * section has — that would reverse the dependency arrow. Callers pass a real one.
 */
export function arbitraryDocument(
  preset: PresetShape,
  variantId: string,
): fc.Arbitrary<RetorikaDocument> {
  const sectionContent = fc
    .tuple(
      ...preset.slots.map((slot) =>
        fc
          .integer({ min: slot.min, max: slot.max })
          .chain((count) =>
            fc.tuple(...Array.from({ length: count }, (_, index) => arbitraryElement(slot, index))),
          ),
      ),
    )
    .map((groups) => groups.flat());

  const section = fc.record({
    id: identifier.map((base) => `section-${base}`),
    preset: fc.constant({ catalogId: preset.catalogId, variantId }),
    source: fc.constant("catalog" as const),
    content: sectionContent,
    layout: fc.constant(null),
  });

  return fc
    .record({
      id: identifier.map((base) => `doc-${base}`),
      siteName: arbitraryText,
      theme: arbitraryTheme,
      section,
    })
    .map(
      ({ id, siteName, theme, section: only }): RetorikaDocument => ({
        schemaVersion: SCHEMA_VERSION,
        id,
        siteName,
        theme,
        pages: [{ id: "home", slug: "index", title: siteName, sections: [only] }],
        collections: [],
      }),
    );
}

/** A sequence of content edits, used by INV_3B to exercise the round-trip under change. */
export const arbitraryContentEdits = fc.array(
  fc.record({
    elementIndex: fc.nat({ max: 8 }),
    text: arbitraryText,
    hide: fc.boolean(),
  }),
  { maxLength: 6 },
);
