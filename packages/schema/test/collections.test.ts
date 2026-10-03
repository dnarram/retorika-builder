import { describe, expect, it } from "vitest";
import {
  addCollection,
  addEntry,
  bindElement,
  deleteCollection,
  mintCollectionId,
  moveEntry,
  removeEntry,
  renameCollection,
  setEntryField,
  unbindElement,
  usesOfCollection,
} from "../src/collections.ts";
import type { RetorikaDocument, Section } from "../src/document.ts";
import { checkInvariants } from "../src/invariants.ts";
import { parseDocument } from "../src/parse.ts";
import { type Theme, TOKEN_KEYS } from "../src/tokens.ts";

/**
 * «El contenido reutilizable» — the fourth pillar of the studio, and ADR 0033's decisions as
 * assertions.
 *
 * The one worth stating before the tests: **a bound list stores one item and the renderer draws N.**
 * Everything odd-looking below follows from there, because `collectionRefSchema` carries no entry id,
 * so a card's elements cannot be per-entry — they are one shared template.
 */

const theme = Object.fromEntries(TOKEN_KEYS.map((key) => [key, `value-${key}`])) as Theme;

/** A «Qué hago» section whose list may or may not be bound. `services` is 1..6 (ADR 0013), which is
 * the range every cardinality assertion here is about. */
function servicesSection(
  options: { bound?: string; items?: number; field?: string } = {},
): Section {
  const items = Array.from({ length: options.items ?? 1 }, (_unused, index) => ({
    id: `item-${index + 1}`,
    elements: [
      {
        id: index === 0 ? "el-card-title" : `el-card-title-${index + 1}`,
        role: "heading" as const,
        hidden: false,
        slot: "title",
        value: { kind: "text" as const, text: "Comidas" },
        ...(options.bound && options.field
          ? { binding: { collectionId: options.bound, field: options.field } }
          : {}),
      },
    ],
  }));
  return {
    id: "sec-services",
    preset: { catalogId: "services", variantId: "cards" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-list",
        role: "list",
        hidden: false,
        slot: "services",
        items,
        ...(options.bound ? { binding: { collectionId: options.bound } } : {}),
      },
    ],
  } as Section;
}

function docWith(sections: Section[], collections: unknown[] = []): RetorikaDocument {
  return parseDocument({
    schemaVersion: "1.8.0",
    id: "doc-1",
    siteName: "Taberna del Puerto",
    theme,
    collections,
    pages: [{ id: "home", slug: "index", title: "Inicio", sections }],
  });
}

const servicios = (count: number) => [
  {
    id: "col-servicios",
    name: "Servicios",
    entries: Array.from({ length: count }, (_unused, index) => ({
      id: `entry-${index + 1}`,
      fields: { nombre: { text: `Servicio ${index + 1}` } },
    })),
  },
];

/** `services` is 1..6, and nothing else in this file needs the catalog. */
const lookup = (catalogId: string) =>
  catalogId === "services" ? { itemRange: { min: 1, max: 6 } } : undefined;

describe("a collection, created and named", () => {
  it("mints an id from the name, and never one already in use", () => {
    const doc = docWith([servicesSection()]);
    expect(mintCollectionId(doc, "Servicios")).toBe("col-servicios");
    const once = addCollection(doc, "Servicios");
    expect(mintCollectionId(once, "Servicios")).toBe("col-servicios-2");
    // Accents and spaces go the way `slugFrom` already takes them for a page.
    expect(mintCollectionId(doc, "Precios de la carta")).toBe("col-precios-de-la-carta");
  });

  it("starts empty, which is a real state rather than a gap", () => {
    const doc = addCollection(docWith([servicesSection()]), "Servicios");
    expect(doc.collections[0]).toEqual({ id: "col-servicios", name: "Servicios", entries: [] });
    expect(checkInvariants(doc, lookup)).toEqual([]);
  });

  it("refuses a nameless collection and a duplicate id", () => {
    const doc = addCollection(docWith([servicesSection()]), "Servicios");
    expect(() => addCollection(doc, "   ")).toThrow(/needs a name/);
    expect(() => addCollection(doc, "Otra", "col-servicios")).toThrow(/already exists/);
  });

  it("gives back the identical document when a rename changes nothing", () => {
    const doc = addCollection(docWith([servicesSection()]), "Servicios");
    expect(renameCollection(doc, "col-servicios", "Servicios")).toBe(doc);
    expect(renameCollection(doc, "col-servicios", "  Servicios  ")).toBe(doc);
    expect(renameCollection(doc, "col-servicios", "Carta").collections[0]?.name).toBe("Carta");
  });
});

describe("where a collection is used", () => {
  it("names every section whose list is bound to it, and the fields they read", () => {
    const doc = docWith(
      [servicesSection({ bound: "col-servicios", field: "nombre" })],
      servicios(3),
    );
    expect(usesOfCollection(doc, "col-servicios")).toEqual([
      { pageId: "home", sectionId: "sec-services", catalogId: "services", fields: ["nombre"] },
    ]);
    expect(usesOfCollection(doc, "col-otra")).toEqual([]);
  });

  it("does not count a leaf whose list is not bound, because there are no cards to draw", () => {
    // A leaf binding with no bound container above it resolves to nothing. It is refused by
    // `bindElement` and would be a rule-5 violation; what matters here is that it is not a *use*.
    const doc = docWith([servicesSection({ items: 1 })], servicios(3));
    const leafOnly = parseDocument({
      ...doc,
      pages: [
        {
          ...doc.pages[0],
          sections: [
            {
              ...servicesSection(),
              content: [
                {
                  id: "el-list",
                  role: "list",
                  hidden: false,
                  slot: "services",
                  items: [
                    {
                      id: "item-1",
                      elements: [
                        {
                          id: "el-card-title",
                          role: "heading",
                          hidden: false,
                          slot: "title",
                          value: { kind: "text", text: "Comidas" },
                          binding: { collectionId: "col-servicios", field: "nombre" },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(usesOfCollection(leafOnly, "col-servicios")).toEqual([]);
  });
});

describe("deleting a collection something still shows", () => {
  it("refuses, and names the sections", () => {
    // **The clause ADR 0033 was signed without**, answered in its amendment: refuse rather than
    // unbind for the caller, because unbinding changes the page and belongs to a deliberate act.
    const doc = docWith(
      [servicesSection({ bound: "col-servicios", field: "nombre" })],
      servicios(3),
    );
    expect(() => deleteCollection(doc, "col-servicios")).toThrow(/1 section\(s\) still show/);
    expect(() => deleteCollection(doc, "col-servicios")).toThrow(/"sec-services"/);
    // And it says what to do, because a refusal a caller cannot act on gets worked around.
    expect(() => deleteCollection(doc, "col-servicios")).toThrow(/Unbind them first/);
  });

  it("deletes one nothing shows", () => {
    const doc = docWith([servicesSection()], servicios(3));
    expect(deleteCollection(doc, "col-servicios").collections).toEqual([]);
  });
});

describe("entries, and the cardinality that holds in both directions", () => {
  const bound = () =>
    docWith([servicesSection({ bound: "col-servicios", field: "nombre" })], servicios(6));

  it("refuses an entry that would push a bound section past its maximum", () => {
    // Six is the most «Qué hago» shows (ADR 0013). A seventh entry is a seventh card.
    expect(() =>
      addEntry(bound(), "col-servicios", { nombre: { text: "Séptimo" } }, lookup),
    ).toThrow(/shows at most 6 and this would make 7/);
    // The message names the section, which is what the panel has to show.
    expect(() =>
      addEntry(bound(), "col-servicios", { nombre: { text: "Séptimo" } }, lookup),
    ).toThrow(/"sec-services"/);
  });

  it("refuses removing the last entry a bound section needs", () => {
    const doc = docWith(
      [servicesSection({ bound: "col-servicios", field: "nombre" })],
      servicios(1),
    );
    expect(() => removeEntry(doc, "col-servicios", "entry-1", lookup)).toThrow(
      /shows at least 1 and this would leave 0/,
    );
  });

  it("allows both when nothing is bound, because then no section disagrees", () => {
    const loose = docWith([servicesSection()], servicios(6));
    expect(
      addEntry(loose, "col-servicios", { nombre: { text: "Séptimo" } }, lookup).collections[0]
        ?.entries,
    ).toHaveLength(7);
    expect(
      removeEntry(loose, "col-servicios", "entry-1", lookup).collections[0]?.entries,
    ).toHaveLength(5);
  });

  it("refuses an entry missing a field some binding reads", () => {
    // A card drawing a field the entry does not carry is a hole on a published page.
    const doc = docWith(
      [servicesSection({ bound: "col-servicios", field: "nombre" })],
      servicios(2),
    );
    expect(() => addEntry(doc, "col-servicios", { precio: { text: "12 €" } }, lookup)).toThrow(
      /no "nombre"/,
    );
  });

  it("writes one field, and gives back the identical document when it says the same thing", () => {
    const doc = docWith([servicesSection()], servicios(2));
    const value = { text: "Servicio 1" };
    expect(setEntryField(doc, "col-servicios", "entry-1", "nombre", value)).toBe(doc);
    const changed = setEntryField(doc, "col-servicios", "entry-1", "nombre", { text: "Comidas" });
    expect(changed.collections[0]?.entries[0]?.fields["nombre"]).toEqual({ text: "Comidas" });
  });

  it("keeps a field's marks, which is what 1.8.0 widened the shape for", () => {
    const doc = docWith([servicesSection()], servicios(1));
    const marked = {
      text: "Comidas y cenas",
      marks: [{ from: 0, to: 7, mark: "strong" as const }],
    };
    const changed = setEntryField(doc, "col-servicios", "entry-1", "nombre", marked);
    expect(changed.collections[0]?.entries[0]?.fields["nombre"]).toEqual(marked);
  });

  it("refuses marks that do not fit the text they are over", () => {
    // The same `withinText` bounds check every other text in this document goes through, which is
    // the whole reason the shape reuses `marksSchema` instead of declaring its own.
    const doc = docWith([servicesSection()], servicios(1));
    expect(() =>
      setEntryField(doc, "col-servicios", "entry-1", "nombre", {
        text: "Corto",
        marks: [{ from: 0, to: 99, mark: "strong" }],
      }),
    ).toThrow();
  });

  it("moves an entry, and the order is the only thing that decides how cards draw", () => {
    const doc = docWith([servicesSection()], servicios(3));
    const moved = moveEntry(doc, "col-servicios", "entry-3", 0);
    expect(moved.collections[0]?.entries.map((entry) => entry.id)).toEqual([
      "entry-3",
      "entry-1",
      "entry-2",
    ]);
    // Clamped rather than thrown: an index past the end is a drag that went too far, not a bug.
    expect(
      moveEntry(doc, "col-servicios", "entry-1", 99).collections[0]?.entries.map((e) => e.id),
    ).toEqual(["entry-2", "entry-3", "entry-1"]);
    expect(moveEntry(doc, "col-servicios", "entry-1", 0)).toBe(doc);
  });
});

describe("binding a leaf", () => {
  it("refuses a collection that does not exist, which is rule 5 before the fact", () => {
    const doc = docWith([servicesSection()], servicios(2));
    expect(() =>
      bindElement(
        doc,
        { sectionId: "sec-services", elementId: "el-card-title" },
        "col-nope",
        "nombre",
      ),
    ).toThrow(/no collection "col-nope"/);
  });

  it("binds, is idempotent, and unbinds back to the identical document", () => {
    const doc = docWith([servicesSection()], servicios(2));
    const address = { sectionId: "sec-services", elementId: "el-card-title" };
    const once = bindElement(doc, address, "col-servicios", "nombre");
    expect(bindElement(once, address, "col-servicios", "nombre")).toBe(once);
    expect(unbindElement(once, address)).toEqual(doc);
    // Nothing bound: nothing changes, and the same object comes back.
    expect(unbindElement(doc, address)).toBe(doc);
  });

  it("reaches a leaf inside a list item, which is the only place a bound leaf lives", () => {
    const doc = docWith([servicesSection()], servicios(2));
    const bound = bindElement(
      doc,
      { sectionId: "sec-services", elementId: "el-card-title" },
      "col-servicios",
      "nombre",
    );
    const list = bound.pages[0]?.sections[0]?.content[0];
    expect(list?.items?.[0]?.elements[0]?.binding).toEqual({
      collectionId: "col-servicios",
      field: "nombre",
    });
  });
});

describe("the invariants ADR 0033 adds", () => {
  /**
   * **These build the document without `parseDocument`, and the reason is the point.**
   *
   * The first version of these tests went through `parseDocument` like every other test in this file
   * and could not construct their own subject: the parser runs `checkInvariants` and threw. That is
   * the invalid state being *unreachable* rather than merely reported — so each case below asserts
   * both halves, the violation and the refusal, and builds its subject by cast the way
   * `rules.test.ts` does for a deliberately invalid style.
   */
  const raw = (sections: Section[], collections: unknown[]): RetorikaDocument =>
    ({
      schemaVersion: "1.8.0",
      id: "doc-1",
      siteName: "Taberna del Puerto",
      theme,
      collections,
      pages: [{ id: "home", slug: "index", title: "Inicio", sections }],
    }) as unknown as RetorikaDocument;

  it("catches a binding reading a field some entries do not carry", () => {
    // Rule 5's missing half: legal until sprint 14, and a hole on the page.
    const ragged = [
      {
        id: "col-servicios",
        name: "Servicios",
        entries: [
          { id: "entry-1", fields: { nombre: { text: "Comidas" } } },
          { id: "entry-2", fields: { precio: { text: "12 €" } } },
        ],
      },
    ];
    const doc = raw([servicesSection({ bound: "col-servicios", field: "nombre" })], ragged);
    const violations = checkInvariants(doc, lookup);
    expect(violations.map((violation) => violation.message)).toContainEqual(
      expect.stringContaining("1 of its 2 entries do not carry"),
    );
    expect(violations.every((violation) => violation.rule === 5)).toBe(true);
    // And it cannot be stored, which is the half that matters to an owner.
    expect(() => parseDocument(doc)).toThrow(/rule 5/);
  });

  it("catches a bound list storing more than one template item", () => {
    const doc = raw(
      [servicesSection({ bound: "col-servicios", field: "nombre", items: 2 })],
      servicios(3),
    );
    expect(checkInvariants(doc, lookup).map((violation) => violation.message)).toContainEqual(
      expect.stringContaining("stores one template item, not 2"),
    );
    expect(() => parseDocument(doc)).toThrow(/rule 1/);
  });

  it("catches a collection that does not fit the section showing it", () => {
    const doc = docWith(
      [servicesSection({ bound: "col-servicios", field: "nombre" })],
      servicios(9),
    );
    expect(checkInvariants(doc, lookup).map((violation) => violation.message)).toContainEqual(
      expect.stringContaining("has 9 entries and this section shows 1 to 6"),
    );
    /**
     * **And `docWith` built it, which means `parseDocument` let it through** — not an oversight, and
     * the honest seam of ADR 0033 §8: the parser has no catalog, so it cannot know a section shows
     * six. The rule holds where a caller can hand the presets over — the verbs refuse it before it is
     * written, and the gate refuses it before it is published.
     */
    expect(checkInvariants(doc)).toEqual([]);
  });

  it("says nothing about cardinality with no lookup, so every existing caller is unchanged", () => {
    // `checkInvariants(doc)` is what the download route and the generator's tests call. The rule a
    // caller cannot supply the catalog for is the rule it does not get.
    const doc = docWith(
      [servicesSection({ bound: "col-servicios", field: "nombre" })],
      servicios(9),
    );
    expect(checkInvariants(doc)).toEqual([]);
    expect(checkInvariants(doc, lookup)).not.toEqual([]);
  });

  it("passes a well-formed bound section", () => {
    const doc = docWith(
      [servicesSection({ bound: "col-servicios", field: "nombre" })],
      servicios(3),
    );
    expect(checkInvariants(doc, lookup)).toEqual([]);
  });
});
