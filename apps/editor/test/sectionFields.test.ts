import { presetFor } from "@retorika/catalog";
import { EMPTY_ANSWERS, generate } from "@retorika/generator";
import { clearSlot, escalateSection, fillSlot, type RetorikaDocument } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { sectionFields } from "../src/editor/sectionFields.ts";

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
