import { presetFor } from "@retorika/catalog";
import {
  checkAgainstPreset,
  flattenElements,
  type RetorikaDocument,
  type Section,
} from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { type Answers, EMPTY_ANSWERS, generate, generateVariants, VARIANTS } from "../src/index.ts";

function answers(overrides: Partial<Answers>): Answers {
  return { ...EMPTY_ANSWERS, ...overrides };
}

const MINIMAL: Answers = answers({ businessName: "Negocio de Prueba", sector: "tienda" });

/** noNonNullAssertion is on; every access below goes through explicit, throwing guards instead. */
function sectionsOf(document: RetorikaDocument): Section[] {
  const page = document.pages[0];
  if (!page) throw new Error("generate() produced a document with no page");
  return page.sections;
}

function findSection(document: RetorikaDocument, catalogId: string): Section {
  const section = sectionsOf(document).find((s) => s.preset.catalogId === catalogId);
  if (!section) throw new Error(`no "${catalogId}" section in the generated document`);
  return section;
}

describe("every generated document", () => {
  it("validates against the schema and the invariants", () => {
    // generate() already calls parseDocument; a throw here is the test failing.
    expect(() => generate(MINIMAL)).not.toThrow();
  });

  it("gives each generated section to its own preset, not just the schema", () => {
    const { document } = generate(
      answers({
        businessName: "Barbería El Corte",
        sector: "peluqueria-barberia",
        services: ["Corte de caballero", "Arreglo de barba"],
        address: "Calle Espinel 24, Ronda",
        mainAction: "book",
        bookingLink: "https://reservas.example.com",
      }),
    );
    for (const section of sectionsOf(document)) {
      const preset = presetFor(section.preset.catalogId);
      expect(checkAgainstPreset(section, preset), section.id).toEqual([]);
    }
  });

  it("never publishes an unfilled {placeholder}, because {ciudad} is never populated today", () => {
    const { document } = generate(
      answers({
        businessName: "Café Ronda",
        sector: "restaurante-bar",
        services: ["Comidas"],
        address: "Plaza Duquesa de Parcent, Ronda",
        mainAction: "email",
        email: "hola@example.com",
      }),
    );
    for (const section of sectionsOf(document)) {
      for (const el of flattenElements(section.content)) {
        if (el.value?.kind === "text") expect(el.value.text).not.toMatch(/\{/);
      }
    }
  });

  it("gives the cover a self-contained placeholder image, no separate asset needed", () => {
    // A relative "assets/placeholder.svg" only resolves where something serves it there — not
    // in a live preview, not in a ZIP without the publisher copying it in. A data: URI needs
    // neither, so there is nothing to also find in `assets`.
    const { document, assets } = generate(MINIMAL);
    const cover = findSection(document, "cover");
    const image = flattenElements(cover.content).find((el) => el.role === "image");
    expect(
      image?.value?.kind === "image" && image.value.src.startsWith("data:image/svg+xml,"),
    ).toBe(true);
    expect(assets.size).toBe(0);
  });
});

describe("the cover", () => {
  it("always exists: headline and image are always resolvable", () => {
    const { document } = generate(answers({ businessName: "X", sector: null }));
    expect(sectionsOf(document)[0]?.preset.catalogId).toBe("cover");
  });

  it("carries no primaryAction for 'visit', which names no destination", () => {
    const { document } = generate(
      answers({ businessName: "X", sector: "tienda", mainAction: "visit" }),
    );
    const cover = findSection(document, "cover");
    expect(cover.content.some((el) => el.slot === "primaryAction")).toBe(false);
  });

  it("carries no primaryAction when the chosen action's destination was left empty", () => {
    const { document } = generate(
      answers({ businessName: "X", sector: "tienda", mainAction: "call", phone: "" }),
    );
    const cover = findSection(document, "cover");
    expect(cover.content.some((el) => el.slot === "primaryAction")).toBe(false);
  });
});

describe("services (question 3)", () => {
  it("is absent when nothing was ticked, not an empty list (ADR 0013)", () => {
    const { document } = generate(answers({ businessName: "X", sector: "tienda", services: [] }));
    expect(sectionsOf(document).some((s) => s.preset.catalogId === "services")).toBe(false);
  });

  it("carries a bank description for a ticked suggestion, and none for what the owner typed", () => {
    const { document } = generate(
      answers({
        businessName: "X",
        sector: "peluqueria-barberia",
        services: ["Corte de caballero", "Depilación con hilo"],
      }),
    );
    const services = findSection(document, "services");
    const list = services.content.find((el) => el.role === "list");
    const items = list?.items ?? [];
    expect(items[0]?.elements.some((el) => el.slot === "description")).toBe(true);
    expect(items[1]?.elements.some((el) => el.slot === "description")).toBe(false);
  });
});

describe("location (question 4)", () => {
  it("is absent when 'no tengo local' was ticked", () => {
    const { document } = generate(
      answers({ businessName: "X", sector: "tienda", noPremises: true, address: "Calle X" }),
    );
    expect(sectionsOf(document).some((s) => s.preset.catalogId === "location")).toBe(false);
  });

  it("is absent when the address was left empty (question skipped)", () => {
    const { document } = generate(answers({ businessName: "X", sector: "tienda", address: "" }));
    expect(sectionsOf(document).some((s) => s.preset.catalogId === "location")).toBe(false);
  });

  it("never carries a map: question 4 collects no coordinates", () => {
    const { document } = generate(
      answers({ businessName: "X", sector: "tienda", address: "Calle Cruz Verde 7, Ronda" }),
    );
    const location = findSection(document, "location");
    expect(location.content.some((el) => el.role === "map")).toBe(false);
  });
});

describe("contact (question 5)", () => {
  it.each([
    ["call", { phone: "+34600000000" }, "tel:+34600000000"],
    ["book", { bookingLink: "https://reservas.example.com" }, "https://reservas.example.com"],
    ["message", { whatsapp: "+34 600 00 00 00" }, "https://wa.me/34600000000"],
    ["email", { email: "hola@example.com" }, "mailto:hola@example.com"],
  ] as const)("generates a section with the right href for %s", (action, fields, expectedHref) => {
    const { document } = generate(
      answers({ businessName: "X", sector: "tienda", mainAction: action, ...fields }),
    );
    const contact = findSection(document, "contact");
    const primary = contact.content.find((el) => el.slot === "primaryAction");
    expect(primary?.value?.kind === "link" && primary.value.href).toBe(expectedHref);
  });

  it("is absent for 'visit': primaryAction is required and visit names no destination", () => {
    const { document } = generate(
      answers({ businessName: "X", sector: "tienda", mainAction: "visit" }),
    );
    expect(sectionsOf(document).some((s) => s.preset.catalogId === "contact")).toBe(false);
  });

  it("is absent when the chosen action's field was left empty", () => {
    const { document } = generate(
      answers({ businessName: "X", sector: "tienda", mainAction: "email", email: "" }),
    );
    expect(sectionsOf(document).some((s) => s.preset.catalogId === "contact")).toBe(false);
  });

  it("carries a secondary phone link when 'Añadir también mi teléfono' was ticked under book", () => {
    const { document } = generate(
      answers({
        businessName: "X",
        sector: "tienda",
        mainAction: "book",
        bookingLink: "https://reservas.example.com",
        alsoPhone: true,
        phone: "+34600000000",
      }),
    );
    const contact = findSection(document, "contact");
    const secondary = contact.content.find((el) => el.slot === "secondaryAction");
    expect(secondary?.value?.kind === "link" && secondary.value.href).toBe("tel:+34600000000");
  });
});

describe("sector fallback", () => {
  it("'otro' and a sector with no bank file both read the generic texts without crashing", () => {
    expect(() => generate(answers({ businessName: "X", sector: "otro" }))).not.toThrow();
    expect(() => generate(answers({ businessName: "X", sector: "fisioterapia" }))).not.toThrow();
    expect(() => generate(answers({ businessName: "X", sector: null }))).not.toThrow();
  });
});

describe("the three variants", () => {
  it("are three, and differ in composition", () => {
    const sites = generateVariants(MINIMAL);
    expect(sites).toHaveLength(3);
    const covers = sites.map((s) => sectionsOf(s.document)[0]?.preset.variantId);
    expect(new Set(covers).size).toBeGreaterThan(1);
  });

  it("carry the same content, only the composition changes", () => {
    const sites = generateVariants(
      answers({ businessName: "X", sector: "tienda", services: ["Envíos"] }),
    );
    const names = sites.map((s) => s.document.siteName);
    expect(new Set(names)).toEqual(new Set(["X"]));
  });

  it("VARIANTS matches what generateVariants actually used", () => {
    const sites = generateVariants(MINIMAL);
    expect(sites.map((s) => sectionsOf(s.document)[0]?.preset.variantId)).toEqual(
      VARIANTS.map((v) => v.cover),
    );
  });
});
