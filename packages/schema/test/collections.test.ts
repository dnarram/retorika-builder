import { describe, expect, it } from "vitest";
import {
  addCollection,
  addEntry,
  addEntryPage,
  bindElement,
  bindList,
  collectionFromList,
  deleteCollection,
  type EntryPageSectionFactory,
  entryPageOf,
  mintCollectionId,
  moveEntry,
  removeEntry,
  renameCollection,
  setEntryField,
  unbindElement,
  unbindList,
  usesOfCollection,
} from "../src/collections.ts";
import type { RetorikaDocument, Section } from "../src/document.ts";
import { checkInvariants } from "../src/invariants.ts";
import { deletePage } from "../src/pages.ts";
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
  options: { bound?: string; items?: number; field?: string; id?: string } = {},
): Section {
  // A second section needs its own ids: rule 5 refuses a repeated section id, and the invariants
  // refuse a repeated element id *within* a section — so a prefix rather than a counter, which keeps
  // every existing caller's ids exactly as they were.
  const id = options.id ?? "sec-services";
  const prefix = options.id ? `${options.id}-` : "";
  const items = Array.from({ length: options.items ?? 1 }, (_unused, index) => ({
    id: `item-${index + 1}`,
    elements: [
      {
        id: index === 0 ? `${prefix}el-card-title` : `${prefix}el-card-title-${index + 1}`,
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
    id,
    preset: { catalogId: "services", variantId: "cards" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: `${prefix}el-list`,
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
      {
        pageId: "home",
        sectionId: "sec-services",
        catalogId: "services",
        kind: "list",
        fields: ["nombre"],
      },
    ]);
    expect(usesOfCollection(doc, "col-otra")).toEqual([]);
  });

  it("refuses a leaf whose list is not bound, because there is no entry to read from", () => {
    /**
     * **This test asserted something weaker until day 4.** It said a leaf with no bound container
     * above it «is not a *use*», which is true and beside the point: the document is invalid, and
     * writing the renderer is what made that obvious — `boundValue` throws on it, and a document the
     * schema accepts and the renderer refuses is the failure ADR 0030 closed for the tablet bucket.
     * So the invariant now catches it, and `parseDocument` is where this test ends up.
     */
    const doc = docWith([servicesSection({ items: 1 })], servicios(3));
    const leafOnly = () =>
      parseDocument({
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
    expect(leafOnly).toThrow(/sits in no list bound to it/);
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

describe("turning the cards that are there into a list", () => {
  /** A «Qué hago» with three written cards, which is what a generated site gives somebody. */
  function written(count = 3): Section {
    return {
      id: "sec-services",
      preset: { catalogId: "services", variantId: "stacked" },
      source: "catalog",
      layout: null,
      content: [
        {
          id: "el-list",
          role: "list",
          hidden: false,
          slot: "services",
          items: Array.from({ length: count }, (_unused, index) => ({
            id: `item-${index + 1}`,
            elements: [
              {
                id: index === 0 ? "el-card-title" : `el-card-title-${index + 1}`,
                role: "heading" as const,
                hidden: false,
                slot: "title",
                value: { kind: "text" as const, text: `Servicio ${index + 1}` },
              },
              {
                id: index === 0 ? "el-card-desc" : `el-card-desc-${index + 1}`,
                role: "body" as const,
                hidden: false,
                slot: "description",
                value: {
                  kind: "text" as const,
                  text: `Lo que es el ${index + 1}`,
                  ...(index === 0 ? { marks: [{ from: 0, to: 2, mark: "strong" as const }] } : {}),
                },
              },
            ],
          })),
        },
      ],
    } as Section;
  }

  it("loses nothing: three cards become three entries and the section shows the same three", () => {
    const doc = collectionFromList(docWith([written()]), "sec-services", "services", "Servicios");
    const collection = doc.collections[0];
    expect(collection?.name).toBe("Servicios");
    expect(collection?.entries.map((entry) => entry.fields["title"]?.text)).toEqual([
      "Servicio 1",
      "Servicio 2",
      "Servicio 3",
    ]);
    // The emphasis came with the words, which is why an entry's field is not a bare string.
    expect(collection?.entries[0]?.fields["description"]?.marks).toEqual([
      { from: 0, to: 2, mark: "strong" },
    ]);
    // One template item, and its leaves bound to the slots they came from.
    const list = doc.pages[0]?.sections[0]?.content[0];
    expect(list?.items).toHaveLength(1);
    expect(list?.binding).toEqual({ collectionId: "col-servicios" });
    expect(list?.items?.[0]?.elements.map((element) => element.binding?.field)).toEqual([
      "title",
      "description",
    ]);
    expect(checkInvariants(doc, lookup)).toEqual([]);
  });

  it("names the fields after the slots, so the panel can label them in Spanish", () => {
    // `itemSlotLabel` reads `section.<catalog>.item.<slot>`, which the fields panel has shown since
    // sprint 3. A field named anything else would be a word invented for a screen.
    const doc = collectionFromList(docWith([written()]), "sec-services", "services", "Servicios");
    expect(Object.keys(doc.collections[0]?.entries[0]?.fields ?? {})).toEqual([
      "title",
      "description",
    ]);
  });

  it("refuses a card carrying anything a field cannot hold, and names it", () => {
    // A gallery's photograph: a field is words and the emphasis over them. Binding it would keep the
    // template's one picture and draw it under every entry — the same photo N times.
    const withPhoto = written(2);
    const list = withPhoto.content[0];
    if (!list?.items) throw new Error("no items");
    list.items[1]?.elements.push({
      id: "el-card-photo",
      role: "image",
      hidden: false,
      slot: "photo",
      value: { kind: "image", src: "assets/x.svg", alt: "Una foto" },
    } as never);
    expect(() =>
      collectionFromList(docWith([withPhoto]), "sec-services", "services", "Fotos"),
    ).toThrow(/carries image, which a list entry cannot hold/);
  });

  it("refuses a list that is already bound, and one with nothing in it", () => {
    const once = collectionFromList(docWith([written()]), "sec-services", "services", "Servicios");
    expect(() => collectionFromList(once, "sec-services", "services", "Otra")).toThrow(
      /already bound/,
    );
  });

  it("keeps a field only a later card has, which is what losing nothing means", () => {
    /**
     * **The defect the e2e found in the first version of this verb**, pinned here where it is cheap
     * to check: the fields were taken from the template alone, so a «Qué hago» whose first card has
     * no description and whose third does lost the third one's words. The copybank fills descriptions
     * sparsely, so this is the ordinary generated site rather than an edge case.
     */
    const sparse = written(3);
    const list = sparse.content[0];
    if (!list?.items) throw new Error("no items");
    // The first card loses its description, exactly as a generated one often has none.
    list.items[0] = { id: "item-1", elements: [list.items[0]?.elements[0] as never] };

    const doc = collectionFromList(docWith([sparse]), "sec-services", "services", "Servicios");
    const entries = doc.collections[0]?.entries ?? [];
    expect(entries.map((entry) => entry.fields["description"]?.text)).toEqual([
      "",
      "Lo que es el 2",
      "Lo que es el 3",
    ]);
    // The template gained the leaf it did not have, bound, so there is somewhere to draw them.
    const bound = doc.pages[0]?.sections[0]?.content[0];
    expect(bound?.items?.[0]?.elements.map((element) => element.binding?.field)).toEqual([
      "title",
      "description",
    ]);
    expect(checkInvariants(doc, lookup)).toEqual([]);
  });

  it("fills a field no card had rather than leaving an entry short of one", () => {
    // The optional description: one card has none, and rule 5 now requires every entry to carry
    // every field some leaf reads. An empty one keeps the document valid; a missing key would not.
    const ragged = written(2);
    const list = ragged.content[0];
    if (!list?.items) throw new Error("no items");
    list.items[1] = { id: "item-2", elements: [list.items[1]?.elements[0] as never] };
    const doc = collectionFromList(docWith([ragged]), "sec-services", "services", "Servicios");
    expect(doc.collections[0]?.entries[1]?.fields["description"]).toEqual({ text: "" });
    expect(checkInvariants(doc, lookup)).toEqual([]);
  });
});

describe("binding an existing list to another section", () => {
  const bound = () =>
    collectionFromList(
      docWith([
        {
          id: "sec-services",
          preset: { catalogId: "services", variantId: "stacked" },
          source: "catalog",
          layout: null,
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
                      value: { kind: "text", text: "Chapa" },
                    },
                  ],
                },
              ],
            },
          ],
        } as Section,
        servicesSection({ items: 1, id: "sec-services-2" }),
      ]),
      "sec-services",
      "services",
      "Servicios",
    );

  it("refuses a collection with no field this section's cards read, and names it", () => {
    // Half a card from the collection and half a sentence repeated three times is worse than a no.
    const doc = bound();
    const other = {
      ...doc,
      collections: [
        { id: "col-otra", name: "Otra", entries: [{ id: "e1", fields: { autor: { text: "x" } } }] },
      ],
    };
    expect(() => bindList(other as typeof doc, "sec-services-2", "services", "col-otra")).toThrow(
      /has no "title"/,
    );
  });

  it("refuses a collection that does not fit the section it is being bound to", () => {
    const doc = bound();
    const many = {
      ...doc,
      collections: doc.collections.map((collection) => ({
        ...collection,
        entries: Array.from({ length: 9 }, (_unused, index) => ({
          id: `entry-${index + 1}`,
          fields: { title: { text: `S${index + 1}` } },
        })),
      })),
    };
    expect(() =>
      bindList(many as typeof doc, "sec-services-2", "services", "col-servicios", lookup),
    ).toThrow(/shows at most 6 and this would make 9/);
  });
});

describe("the exit: unbinding a section", () => {
  const bound = (entries = 3) =>
    docWith(
      [servicesSection({ bound: "col-servicios", field: "title" })],
      [
        {
          id: "col-servicios",
          name: "Servicios",
          entries: Array.from({ length: entries }, (_unused, index) => ({
            id: `entry-${index + 1}`,
            fields: {
              title: {
                text: `Servicio ${index + 1}`,
                ...(index === 0 ? { marks: [{ from: 0, to: 8, mark: "strong" as const }] } : {}),
              },
            },
          })),
        },
      ],
    );

  it("turns the entries into ordinary cards carrying their own words and emphasis", () => {
    const doc = unbindList(bound(), "sec-services", "services");
    const list = doc.pages[0]?.sections[0]?.content[0];
    expect(list?.binding).toBeUndefined();
    expect(list?.items).toHaveLength(3);
    expect(list?.items?.map((item) => item.elements[0]?.value)).toEqual([
      { kind: "text", text: "Servicio 1", marks: [{ from: 0, to: 8, mark: "strong" }] },
      { kind: "text", text: "Servicio 2" },
      { kind: "text", text: "Servicio 3" },
    ]);
    // No binding left anywhere, which is what makes this the exit rather than a half-exit.
    expect(JSON.stringify(doc.pages)).not.toContain("binding");
    expect(checkInvariants(doc, lookup)).toEqual([]);
  });

  it("mints unique element ids, because duplicates within a section are a violation", () => {
    const doc = unbindList(bound(), "sec-services", "services");
    const list = doc.pages[0]?.sections[0]?.content[0];
    const ids = list?.items?.map((item) => item.elements[0]?.id);
    expect(ids).toEqual(["el-card-title", "el-card-title-2", "el-card-title-3"]);
    expect(new Set(ids).size).toBe(3);
    // The first card keeps the template's own ids, so a style naming them still names something.
    expect(ids?.[0]).toBe("el-card-title");
  });

  it("is what makes the collection deletable again", () => {
    // The path the panel's refusal names: unbind, then the list has nothing to take with it.
    const doc = bound();
    expect(() => deleteCollection(doc, "col-servicios")).toThrow(/still show/);
    const freed = unbindList(doc, "sec-services", "services");
    expect(deleteCollection(freed, "col-servicios").collections).toEqual([]);
  });

  it("gives back the identical document for a list that was never bound", () => {
    const doc = docWith([servicesSection()], servicios(2));
    expect(unbindList(doc, "sec-services", "services")).toBe(doc);
  });
});

describe("una página por ficha (ADR 0040)", () => {
  /**
   * **The page is stored once and drawn N times**, the way a bound list stores one card. What the
   * schema holds is one page with a binding and one section whose leaves read the entry's fields;
   * what the publisher emits is one file per entry, named after a slug minted here and held still.
   */
  const ficha: EntryPageSectionFactory = ({ sectionId, collectionId, titleField, fields }) => ({
    id: sectionId,
    preset: { catalogId: "cover", variantId: "image-right" },
    source: "catalog",
    layout: null,
    content: [
      {
        id: `${sectionId}-headline`,
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "" },
        binding: { collectionId, field: titleField },
      },
      ...fields
        .filter((field) => field !== titleField)
        .slice(0, 1)
        .map((field) => ({
          id: `${sectionId}-body`,
          role: "body" as const,
          hidden: false,
          slot: "body",
          value: { kind: "text" as const, text: "" },
          binding: { collectionId, field },
        })),
    ],
  });

  const withPage = (count = 3) =>
    addEntryPage(
      docWith([servicesSection({ bound: "col-servicios", field: "nombre" })], servicios(count)),
      "col-servicios",
      "nombre",
      "Ficha de servicio",
      ficha,
    );

  it("creates one stored page bound to the collection, and every entry gets a slug", () => {
    const doc = withPage();
    const page = entryPageOf(doc, "col-servicios");
    expect(page?.binding).toEqual({ collectionId: "col-servicios", titleField: "nombre" });
    expect(page?.id).toBe("page-ficha-servicios");
    expect(page?.slug).toBe("ficha-de-servicio");
    expect(doc.pages.at(-1)).toBe(page);
    expect(doc.collections[0]?.entries.map((entry) => entry.slug)).toEqual([
      "servicio-1",
      "servicio-2",
      "servicio-3",
    ]);
    // The leaves read the entry, and the invariants accept them there without any list around.
    expect(page?.sections[0]?.content.map((el) => el.binding)).toEqual([
      { collectionId: "col-servicios", field: "nombre" },
    ]);
    expect(checkInvariants(doc, lookup)).toEqual([]);
  });

  it("reports the page's section as a use of kind «page», beside the list that shows the cards", () => {
    const doc = withPage();
    expect(usesOfCollection(doc, "col-servicios")).toEqual([
      {
        pageId: "home",
        sectionId: "sec-services",
        catalogId: "services",
        kind: "list",
        fields: ["nombre"],
      },
      {
        pageId: "page-ficha-servicios",
        sectionId: "sec-ficha",
        catalogId: "cover",
        kind: "page",
        fields: ["nombre"],
      },
    ]);
  });

  it("gives a new entry its slug at birth, with a suffix when the title repeats", () => {
    // «Al añadir una ficha, su página se crea y se enlaza sola»: nothing to do but add it.
    const doc = addEntry(withPage(), "col-servicios", { nombre: { text: "Servicio 1" } }, lookup);
    expect(doc.collections[0]?.entries.at(-1)?.slug).toBe("servicio-1-2");
    expect(checkInvariants(doc, lookup)).toEqual([]);
  });

  it("holds an entry's slug still when its title changes, which is ADR 0022's rule for a page", () => {
    const doc = setEntryField(withPage(), "col-servicios", "entry-1", "nombre", {
      text: "Chapa y pintura",
    });
    expect(doc.collections[0]?.entries[0]?.slug).toBe("servicio-1");
  });

  it("requires the title field of a new entry once the page exists, even where no leaf reads it", () => {
    const doc = addEntryPage(
      docWith(
        [servicesSection({ bound: "col-servicios", field: "nombre" })],
        [
          {
            id: "col-servicios",
            name: "Servicios",
            entries: [
              { id: "entry-1", fields: { nombre: { text: "Comidas" }, precio: { text: "12" } } },
            ],
          },
        ],
      ),
      "col-servicios",
      "precio",
      "Ficha",
      ({ sectionId, collectionId }) => ({
        id: sectionId,
        preset: { catalogId: "cover", variantId: "image-right" },
        source: "catalog",
        layout: null,
        content: [
          {
            id: `${sectionId}-headline`,
            role: "heading",
            hidden: false,
            slot: "headline",
            value: { kind: "text", text: "" },
            binding: { collectionId, field: "nombre" },
          },
        ],
      }),
    );
    expect(() => addEntry(doc, "col-servicios", { nombre: { text: "Cenas" } }, lookup)).toThrow(
      /has no "precio"/,
    );
  });

  it("refuses a second page, a title field some entry lacks, and the page cap", () => {
    const doc = withPage();
    expect(() => addEntryPage(doc, "col-servicios", "nombre", "Otra", ficha)).toThrow(
      /already has its page per entry, "page-ficha-servicios"/,
    );
    expect(() =>
      addEntryPage(
        docWith([servicesSection({ bound: "col-servicios", field: "nombre" })], servicios(3)),
        "col-servicios",
        "precio",
        "Ficha",
        ficha,
      ),
    ).toThrow(/"precio" would title the pages and 3 of 3 entries/);
    const full = {
      ...docWith([servicesSection({ bound: "col-servicios", field: "nombre" })], servicios(3)),
    };
    full.pages = [
      ...full.pages,
      ...[2, 3, 4, 5].map((n) => ({
        id: `page-${n}`,
        slug: `p-${n}`,
        title: `P${n}`,
        sections: [],
      })),
    ];
    expect(() => addEntryPage(full, "col-servicios", "nombre", "Ficha", ficha)).toThrow(
      /a site may have 5 pages/,
    );
  });

  it("refuses to delete the collection while its page exists, and names the page", () => {
    // Unbinding the sections is not enough any more: the page is a second thing standing on it.
    expect(() => deleteCollection(withPage(), "col-servicios")).toThrow(
      /page "page-ficha-servicios" is drawn once per entry/,
    );
  });

  it("keeps the entries' slugs when the page goes, so a re-created page draws the same files", () => {
    const without = deletePage(withPage(), "page-ficha-servicios");
    expect(entryPageOf(without, "col-servicios")).toBeUndefined();
    expect(without.collections[0]?.entries.map((entry) => entry.slug)).toEqual([
      "servicio-1",
      "servicio-2",
      "servicio-3",
    ]);
    const again = addEntryPage(without, "col-servicios", "nombre", "Ficha de servicio", ficha);
    expect(again.collections[0]?.entries.map((entry) => entry.slug)).toEqual([
      "servicio-1",
      "servicio-2",
      "servicio-3",
    ]);
  });

  describe("the invariants ADR 0040 adds", () => {
    const raw = (pages: unknown[], collections: unknown[]): RetorikaDocument =>
      ({
        schemaVersion: "1.9.0",
        id: "doc-1",
        siteName: "Taberna del Puerto",
        theme,
        collections,
        pages,
      }) as unknown as RetorikaDocument;
    const home = { id: "home", slug: "index", title: "Inicio", sections: [servicesSection()] };
    const slugged = (count: number, slugs = true) =>
      servicios(count).map((collection) => ({
        ...collection,
        entries: collection.entries.map((entry, index) => ({
          ...entry,
          ...(slugs ? { slug: `servicio-${index + 1}` } : {}),
        })),
      }));
    const bound = (id: string, titleField = "nombre", sectionId = `sec-${id}`) => ({
      id,
      slug: id,
      title: "Ficha",
      binding: { collectionId: "col-servicios", titleField },
      sections: [
        ficha({ sectionId, collectionId: "col-servicios", titleField, fields: ["nombre"] }),
      ],
    });
    const messages = (doc: RetorikaDocument) =>
      checkInvariants(doc, lookup).map((violation) => violation.message);

    it("passes a well-formed page per entry", () => {
      expect(messages(raw([home, bound("ficha")], slugged(2)))).toEqual([]);
    });

    it("refuses the first page as a page per entry", () => {
      expect(messages(raw([bound("ficha"), home], slugged(2)))).toContainEqual(
        expect.stringContaining(
          "the first page is the site's entry and cannot be drawn once per entry",
        ),
      );
    });

    it("refuses two pages for one collection", () => {
      const doc = raw(
        [home, bound("ficha"), bound("ficha-2", "nombre", "sec-ficha-2")],
        slugged(2),
      );
      expect(messages(doc)).toContainEqual(
        expect.stringContaining("is drawn per entry by more than one page"),
      );
      expect(() => parseDocument(doc)).toThrow(/rule 1/);
    });

    it("refuses a title field some entry does not carry, and an unknown collection", () => {
      expect(messages(raw([home, bound("ficha", "precio")], slugged(2)))).toContainEqual(
        expect.stringContaining('titles its entries by "precio", which 2 of the 2 entries'),
      );
      const orphan = { ...bound("ficha"), binding: { collectionId: "col-nada", titleField: "x" } };
      expect(messages(raw([home, orphan], slugged(2)))).toContainEqual(
        expect.stringContaining('page binding references unknown collection "col-nada"'),
      );
    });

    it("refuses an entry with no slug under a page, and a slug another page already has", () => {
      expect(messages(raw([home, bound("ficha")], slugged(2, false)))).toContainEqual(
        expect.stringContaining("2 of its 2 entries have no slug"),
      );
      const clash = slugged(2).map((collection) => ({
        ...collection,
        entries: collection.entries.map((entry, index) =>
          index === 0 ? { ...entry, slug: "ficha" } : entry,
        ),
      }));
      expect(messages(raw([home, bound("ficha")], clash))).toContainEqual(
        expect.stringContaining("entry slug \"ficha\" is already another page's or entry's"),
      );
    });

    it("still refuses a bound leaf outside any list on an ordinary page", () => {
      const loose = {
        ...bound("ficha"),
        binding: undefined,
      };
      expect(messages(raw([home, loose], slugged(2)))).toContainEqual(
        expect.stringContaining("sits in no list bound to it and on no page drawn per its entry"),
      );
    });
  });
});
