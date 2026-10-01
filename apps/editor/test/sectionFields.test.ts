import { blankSection, GALLERY_ID, PRICES_ID, presetFor } from "@retorika/catalog";
import { EMPTY_ANSWERS, generate } from "@retorika/generator";
import {
  clearSlot,
  escalateSection,
  fillSlot,
  insertSection,
  type RetorikaDocument,
  setElementText,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  type FieldRow,
  fieldCommitFor,
  groupedFields,
  sectionFields,
} from "../src/editor/sectionFields.ts";

/**
 * The rows the field panel lists. They come from the **preset**, not from the document, which is
 * the whole reason the panel exists: an optional slot nobody filled is absent, renders as
 * nothing, and click-to-edit cannot reach it.
 */

const ANSWERS = {
  ...EMPTY_ANSWERS,
  businessName: "Taberna Santo Domingo",
  sector: "restaurante-bar" as const,
  services: ["Comidas"],
  address: "Cta. de Santo Domingo, 2, Ronda",
  mainAction: "book" as const,
  bookingLink: "https://reservas.example.com/taberna",
};

const doc: RetorikaDocument = generate(ANSWERS).document;
const COVER_SLOTS = [
  "headline",
  "subheadline",
  "body",
  "image",
  "primaryAction",
  "secondaryAction",
];

function labels(document: RetorikaDocument, sectionId: string): string[] {
  return sectionFields(document, sectionId).map((row) => row.label);
}

describe("sectionFields", () => {
  it("lists a slot the document does not have, which is the point", () => {
    // The generated cover carries no secondary link; the preset allows two.
    expect(doc.pages[0]?.sections[0]?.content.some((e) => e.slot === "secondaryAction")).toBe(
      false,
    );
    expect(labels(doc, "sec-cover")).toContain("Enlace secundario");
  });

  it("names every row from the catalog's Spanish locale", () => {
    expect(labels(doc, "sec-cover")).toEqual([
      "Titular",
      "Subtítulo",
      "Texto",
      "Botón principal",
      "Enlace secundario",
    ]);
  });

  it("numbers the extra rows of a slot that holds more than one", () => {
    const withOne = fillSlot(doc, {
      sectionId: "sec-cover",
      slot: "secondaryAction",
      role: "link",
      value: { kind: "link", text: "Cómo llegar", href: "#sec-location" },
      slotOrder: COVER_SLOTS,
    });
    expect(labels(withOne, "sec-cover")).toContain("Enlace secundario 2");
  });

  it("offers no further row once the slot is full", () => {
    let full = doc;
    for (const occurrence of [0, 1]) {
      full = fillSlot(full, {
        sectionId: "sec-cover",
        slot: "secondaryAction",
        occurrence,
        role: "link",
        value: { kind: "link", text: `Enlace ${occurrence}`, href: "#sec-location" },
        slotOrder: COVER_SLOTS,
      });
    }
    // secondaryAction is 0..2 on the cover.
    expect(labels(full, "sec-cover").filter((l) => l.startsWith("Enlace secundario"))).toHaveLength(
      2,
    );
  });

  it("leaves out the roles a text box cannot honestly edit", () => {
    // The image has its own affordance (click the photo); a list holds items, not a value; and a
    // map wants coordinates, which do not exist yet. An empty box for any of them would be a
    // field nobody can fill.
    expect(labels(doc, "sec-cover")).not.toContain("Foto");
    expect(labels(doc, "sec-services")).not.toContain("Tarjetas");
    expect(labels(doc, "sec-location")).not.toContain("Mapa");
  });

  it("gives a link two halves and everything else one", () => {
    const rows = sectionFields(doc, "sec-cover");
    expect(rows.find((row) => row.slot === "primaryAction")?.kind).toBe("link");
    expect(rows.find((row) => row.slot === "headline")?.kind).toBe("text");
    expect(rows.find((row) => row.slot === "headline")?.href).toBeUndefined();
  });

  it("carries the value that is on the page", () => {
    const rows = sectionFields(doc, "sec-cover");
    expect(rows.find((row) => row.slot === "headline")?.text).toBe("Taberna Santo Domingo");
    expect(rows.find((row) => row.slot === "primaryAction")?.href).toBe(
      "https://reservas.example.com/taberna",
    );
  });

  it("shows a hidden element as an empty field, because that is what it looks like", () => {
    const hidden = clearSlot(doc, { sectionId: "sec-cover", slot: "body" });
    const row = sectionFields(hidden, "sec-cover").find((candidate) => candidate.slot === "body");
    expect(row).toBeDefined();
    expect(row?.text).toBe("");
    // And it is the same row, not a new sibling offered beside the hidden one.
    expect(sectionFields(hidden, "sec-cover").filter((r) => r.slot === "body")).toHaveLength(1);
  });

  it("marks which rows the preset requires", () => {
    const rows = sectionFields(doc, "sec-cover");
    expect(rows.find((row) => row.slot === "headline")?.required).toBe(true);
    expect(rows.find((row) => row.slot === "body")?.required).toBe(false);
  });

  it("flags a destination that goes nowhere, by the rule the download route refuses on", () => {
    const dead = fillSlot(doc, {
      sectionId: "sec-cover",
      slot: "secondaryAction",
      role: "link",
      value: { kind: "link", text: "Cómo llegar", href: "" },
      slotOrder: COVER_SLOTS,
    });
    const row = sectionFields(dead, "sec-cover").find((r) => r.slot === "secondaryAction");
    expect(row?.dead).toBe(true);
  });

  it("does not flag a destination that resolves", () => {
    const rows = sectionFields(doc, "sec-cover");
    expect(rows.find((row) => row.slot === "primaryAction")?.dead).toBeUndefined();
  });

  it("carries the field's marks, which is what a box anchors its edit against", () => {
    // Read once, when the box takes focus. Carried on the row because the panel has rows and not
    // the document (ADR 0027 §4b).
    const marked = setElementText(
      doc,
      { sectionId: "sec-cover", elementId: "el-headline" },
      "Taberna Santo Domingo",
      [{ mark: "strong", from: 0, to: 7 }],
    );
    const row = sectionFields(marked, "sec-cover").find((r) => r.slot === "headline");
    expect(row?.marks).toEqual([{ mark: "strong", from: 0, to: 7 }]);
  });

  it("carries no marks for a field that has none, rather than an empty list", () => {
    // Absent and empty mean the same thing to `withText`, but the row is compared in tests and
    // stored in nothing, so the honest shape is the one the document has.
    const row = sectionFields(doc, "sec-cover").find((r) => r.slot === "headline");
    expect(row?.marks).toBeUndefined();
  });

  it("is empty for a section that is not there", () => {
    expect(sectionFields(doc, "sec-nope")).toEqual([]);
  });
});

describe("a section that is designed by hand", () => {
  /**
   * `INV_1` — «Simple view opens every document and exposes every content field» — reached from the
   * one state that has never existed until this sprint.
   *
   * The panel used to answer nothing at all for a section whose `source` was not `catalog`. Nobody
   * noticed because nothing could produce such a section outside the schema's own tests; the day
   * the switch offers «Diseñar a mano», it becomes a section whose fields vanish the instant it is
   * accepted. That is the opposite of what the advanced dossier §2 promises — «es el mismo
   * documento en las dos vistas» — and the reason it is fixed on the same day as the button.
   */
  const free = escalateSection(doc, "sec-cover", presetFor("cover"));

  it("is free, so the old guard would have had something to refuse", () => {
    expect(free.pages[0]?.sections[0]?.source).toBe("free");
  });

  it("lists exactly the rows it listed under the catalog", () => {
    // Not "lists some rows": the identical list. Designing a section by hand changes where its
    // layout lives, and nothing at all about which fields it has.
    expect(sectionFields(free, "sec-cover")).toEqual(sectionFields(doc, "sec-cover"));
  });

  it("still offers the slot the document does not have", () => {
    // The rows come from the preset, and a free section keeps its preset reference — that is what
    // makes the return of day 4 possible, and it is what keeps this row here.
    expect(labels(free, "sec-cover")).toContain("Enlace secundario");
  });

  it("still carries the values that are on the page, so they can still be corrected", () => {
    const rows = sectionFields(free, "sec-cover");
    expect(rows.find((row) => row.slot === "headline")?.text).toBe("Taberna Santo Domingo");
    expect(rows.find((row) => row.slot === "primaryAction")?.href).toBe(
      "https://reservas.example.com/taberna",
    );
  });

  it("goes back to listing nothing when the catalog id is the one thing it cannot resolve", () => {
    // The `presetFor` guard is a different refusal from the one being deleted, and it stays: a
    // section whose catalog id nothing recognises has no shape to list, free or not.
    const unknown: RetorikaDocument = {
      ...free,
      pages: free.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) =>
          section.id === "sec-cover"
            ? { ...section, preset: { ...section.preset, catalogId: "no-such-preset" } }
            : section,
        ),
      })),
    };
    expect(sectionFields(unknown, "sec-cover")).toEqual([]);
  });
});

describe("fieldCommitFor — which of the three things a box's blur means", () => {
  /**
   * The bug this function exists for, measured on 1 October 2026: the panel sent **every** commit
   * through `fillSlot`, which replaces an element's whole value — so editing a bolded field from the
   * panel came back unbolded, and so did blurring one that had not been edited at all. The canvas has
   * shifted marks since sprint 10; the panel threw them away, which is the exact split `withText`'s
   * own comment warns about.
   */
  const text = (over: Partial<FieldRow> = {}): FieldRow => ({
    slot: "headline",
    occurrence: 0,
    role: "heading",
    label: "Titular",
    kind: "text",
    elementId: "el-headline",
    text: "pan y aceite",
    required: true,
    ...over,
  });

  const link = (over: Partial<FieldRow> = {}): FieldRow =>
    text({
      slot: "cta",
      role: "button",
      kind: "link",
      elementId: "el-cta",
      href: "#contacto",
      ...over,
    });

  it("a words-only change is a text edit, which is what carries the marks over", () => {
    expect(fieldCommitFor(text(), "pan y aceite de oliva", "")).toEqual({
      kind: "text",
      elementId: "el-headline",
      text: "pan y aceite de oliva",
    });
  });

  it("an unchanged box is still a text edit, never a value replacement", () => {
    // The worse half of the bug: this path used to rebuild the value and strip the formatting off a
    // field nobody had touched. `setElementText` with the same text is a no-op on the marks.
    expect(fieldCommitFor(text(), "pan y aceite", "")).toEqual({
      kind: "text",
      elementId: "el-headline",
      text: "pan y aceite",
    });
  });

  it("trims, because that is what both paths store", () => {
    expect(fieldCommitFor(text(), "  pan y aceite  ", "")).toEqual({
      kind: "text",
      elementId: "el-headline",
      text: "pan y aceite",
    });
  });

  it("an emptied box clears the field, whatever the destination says", () => {
    expect(fieldCommitFor(text(), "", "")).toEqual({ kind: "clear" });
    expect(fieldCommitFor(text(), "   ", "")).toEqual({ kind: "clear" });
    expect(fieldCommitFor(link(), "", "#contacto")).toEqual({ kind: "clear" });
  });

  it("a slot the document does not have yet is a fill: there is no element to edit", () => {
    // Built by omission rather than by `elementId: undefined`: with `exactOptionalPropertyTypes`
    // those are different types, and the row a missing slot really produces has no such key.
    const { elementId: _none, ...noElement } = text();
    expect(fieldCommitFor(noElement, "pan", "")).toEqual({ kind: "fill" });
  });

  it("a link whose destination moved is a fill, because a whole value changed", () => {
    expect(fieldCommitFor(link(), "Reserva ya", "#reservas")).toEqual({ kind: "fill" });
  });

  it("a link whose label changed but not its destination is a text edit", () => {
    // The case that makes the distinction worth drawing: a button's label can carry marks too
    // (ADR 0027 §6), and renaming it must not drop them.
    expect(fieldCommitFor(link({ text: "Reserva ya" }), "Reserva mesa", "#contacto")).toEqual({
      kind: "text",
      elementId: "el-cta",
      text: "Reserva mesa",
    });
  });

  it("compares the destination trimmed, so whitespace alone is not a value change", () => {
    expect(fieldCommitFor(link(), "Reserva ya", "  #contacto  ")).toEqual({
      kind: "text",
      elementId: "el-cta",
      text: "Reserva ya",
    });
  });
});

/**
 * A line's own slots, which nothing in this product could reach until sprint 12 (#133).
 *
 * Two of them were unreachable and they were the only two: `SERVICES_ITEM_SLOTS.description` and
 * `PRICES_ITEM_SLOTS.description`, both `0..1`, so absent from a line nobody filled, so no text on
 * the page to click — and this panel listed the section's slots only.
 */
describe("the slots of a line", () => {
  // Two cards, and the generator fills the second's description from the bank and not the first's.
  // Left as the fixture rather than hand-built, because it is the state a real questionnaire
  // produces: one row that exists and one that does not, side by side.
  const twoCards = generate({
    ...ANSWERS,
    services: ["Comidas", "Tapas"],
  }).document;
  const servicesId =
    twoCards.pages[0]?.sections.find((s) => s.preset.catalogId === "services")?.id ?? "";
  const itemRows = (document: RetorikaDocument, sectionId: string) =>
    sectionFields(document, sectionId).filter((row) => row.item !== undefined);

  const SERVICE_LINE_SLOTS = ["title", "description"];

  it("lists the description of a card that does not have one, which is the whole point", () => {
    const first = itemRows(twoCards, servicesId).filter((row) => row.item?.id === "item-1");
    const description = first.find((row) => row.slot === "description");
    // Absent from the document: there is nothing on the page to click, which is why the canvas
    // could never reach it.
    expect(
      twoCards.pages[0]?.sections
        .find((s) => s.id === servicesId)
        ?.content.find((e) => e.role === "list")
        ?.items?.[0]?.elements.some((e) => e.slot === "description"),
    ).toBe(false);
    expect(description).toBeDefined();
    expect(description?.elementId).toBeUndefined();
    expect(description?.text).toBe("");
    expect(description?.required).toBe(false);
  });

  it("carries the value of a line slot that is filled", () => {
    const second = itemRows(twoCards, servicesId).filter((row) => row.item?.id === "item-2");
    const description = second.find((row) => row.slot === "description");
    expect(description?.elementId).toBe("el-card-2-description");
    expect(description?.text).toBe("Para picar algo en la barra o en la mesa.");
  });

  it("names a line's slots from the catalog's own Spanish, inventing no word", () => {
    // Every one of these keys already existed: they were written when a line gained its add and
    // remove controls.
    expect(itemRows(twoCards, servicesId).map((row) => row.label)).toEqual([
      "Nombre",
      "Descripción",
      "Nombre",
      "Descripción",
    ]);
  });

  it("heads a line's group with the line's own words, not with a number", () => {
    // «Ensaladilla» is findable by reading; «Línea 7» makes the owner count rows on the page.
    expect(itemRows(twoCards, servicesId).map((row) => row.lineName)).toEqual([
      "Comidas",
      "Comidas",
      "Tapas",
      "Tapas",
    ]);
  });

  it("falls back to the generic word and a number when the line has no words yet", () => {
    const blank = insertSection(
      twoCards,
      "home",
      1,
      blankSection(PRICES_ID, "stacked", "sec-prices"),
    );
    const rows = itemRows(blank, "sec-prices");
    // A blank line carries its name slot as placeholder text, so what is asserted here is the
    // fallback's shape rather than an empty document: the heading is a word plus a 1-based number.
    expect(rows.every((row) => row.lineName !== undefined && row.lineName !== "")).toBe(true);
    const cleared = clearSlot(blank, {
      sectionId: "sec-prices",
      slot: "name",
      item: { list: "lines", id: "item-1" },
    });
    expect(itemRows(cleared, "sec-prices")[0]?.lineName).toBe("Línea 1");
  });

  it("calls a gallery's lines photos, by the table `editor.line.*` already keeps", () => {
    // A photograph is not a line. `gallery` is the only override there, and the only one here —
    // «Qué hago» and «Opiniones» have shipped through two usability sessions calling theirs a line,
    // and changing a word those sessions saw is a product decision, not a tidy-up.
    const withGallery = insertSection(
      twoCards,
      "home",
      1,
      blankSection(GALLERY_ID, "stacked", "sec-gallery"),
    );
    const cleared = clearSlot(withGallery, {
      sectionId: "sec-gallery",
      slot: "caption",
      item: { list: "photos", id: "item-1" },
    });
    expect(itemRows(cleared, "sec-gallery")[0]?.lineName).toBe("Foto 1");
  });

  it("leaves out a line's photo, which has its own affordance", () => {
    const withGallery = insertSection(
      twoCards,
      "home",
      1,
      blankSection(GALLERY_ID, "stacked", "sec-gallery"),
    );
    // `GALLERY_ITEM_SLOTS` is photo + caption; only the caption is a box a person can honestly type
    // in (ADR 0018 gives the photograph its own).
    expect(itemRows(withGallery, "sec-gallery").map((row) => row.slot)).toEqual(["caption"]);
  });

  it("gives each row its own line's address", () => {
    expect(itemRows(twoCards, servicesId).map((row) => row.item)).toEqual([
      { list: "services", id: "item-1" },
      { list: "services", id: "item-1" },
      { list: "services", id: "item-2" },
      { list: "services", id: "item-2" },
    ]);
  });

  it("lists no line rows for a section whose preset has no list", () => {
    expect(itemRows(twoCards, "sec-cover")).toEqual([]);
  });

  it("fills the line the row names, between the name and the price", () => {
    // The round trip the panel actually makes: the row's own address, and the **line's** slot order
    // rather than the section's. Placed by that order is why a description lands before the price.
    const withPrices = insertSection(
      twoCards,
      "home",
      1,
      blankSection(PRICES_ID, "stacked", "sec-prices"),
    );
    const row = itemRows(withPrices, "sec-prices").find((r) => r.slot === "description");
    expect(row?.item).toEqual({ list: "lines", id: "item-1" });
    const filled = fillSlot(withPrices, {
      sectionId: "sec-prices",
      slot: row?.slot ?? "",
      ...(row?.item ? { item: row.item } : {}),
      role: row?.role ?? "body",
      value: { kind: "text", text: "Con mayonesa de casa" },
      slotOrder: presetFor(PRICES_ID).itemSlots?.map((slot) => slot.slot) ?? [],
    });
    expect(
      filled.pages[0]?.sections
        .find((s) => s.id === "sec-prices")
        ?.content.find((e) => e.role === "list")
        ?.items?.[0]?.elements.map((e) => e.slot),
    ).toEqual(["name", "description", "price"]);
  });

  describe("groupedFields", () => {
    it("keeps a line's rows together, in the order the page has them", () => {
      const { sectionRows, lines } = groupedFields(sectionFields(twoCards, servicesId));
      expect(sectionRows.map((row) => row.slot)).toEqual(["headline", "intro"]);
      expect(lines.map((line) => [line.id, line.name])).toEqual([
        ["item-1", "Comidas"],
        ["item-2", "Tapas"],
      ]);
      expect(lines.map((line) => line.rows.map((row) => row.slot))).toEqual([
        ["title", "description"],
        ["title", "description"],
      ]);
    });

    it("does not merge two lines that carry the same slot and occurrence", () => {
      // The collision worth a test: every line has a `description` at occurrence 0, so keyed by
      // slot and occurrence alone the second dish's box and the first dish's box are one box.
      const { lines } = groupedFields(sectionFields(twoCards, servicesId));
      expect(lines).toHaveLength(2);
      const keys = lines.flatMap((line) =>
        line.rows.map((row) => `${line.id}:${row.slot}:${row.occurrence}`),
      );
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("puts a section with no lines entirely in sectionRows", () => {
      const { sectionRows, lines } = groupedFields(sectionFields(twoCards, "sec-cover"));
      expect(lines).toEqual([]);
      expect(sectionRows.length).toBeGreaterThan(0);
    });
  });

  describe("what a line's box commits", () => {
    it("is a fill when the line does not carry the slot yet", () => {
      const row = itemRows(twoCards, servicesId).find(
        (r) => r.item?.id === "item-1" && r.slot === "description",
      );
      expect(row).toBeDefined();
      expect(fieldCommitFor(row as FieldRow, "Con mayonesa", "")).toEqual({ kind: "fill" });
    });

    it("is a text edit when it does, so the line's marks move with the words", () => {
      // `fieldCommitFor` needed no change for lines, and this is why: a text edit is addressed by
      // element id, and `setElementText` has recursed into a line's elements since sprint 1.
      const row = itemRows(twoCards, servicesId).find(
        (r) => r.item?.id === "item-2" && r.slot === "description",
      );
      expect(fieldCommitFor(row as FieldRow, "Otra cosa", "")).toEqual({
        kind: "text",
        elementId: "el-card-2-description",
        text: "Otra cosa",
      });
    });

    it("clears the line's slot when the box is emptied", () => {
      const row = itemRows(twoCards, servicesId).find(
        (r) => r.item?.id === "item-2" && r.slot === "description",
      );
      expect(fieldCommitFor(row as FieldRow, "   ", "")).toEqual({ kind: "clear" });
    });
  });

  it("the line slot order it fills by is the line's, not the section's", () => {
    // Named here because getting it wrong is silent: the section's order has no "description" in
    // it, so `rank` would return the length for every slot and the new element would land last.
    expect(SERVICE_LINE_SLOTS).toEqual(
      presetFor("services").itemSlots?.map((slot) => slot.slot) ?? [],
    );
  });
});
