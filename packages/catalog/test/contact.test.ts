import { type ContentElement, checkAgainstPreset, type Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import { CONTACT_SLOTS, CONTACT_VARIANTS, contactPreset } from "../src/contact.ts";
import { presetFor, SEARCH_ALIASES } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };

const headline: ContentElement = {
  id: "el-headline",
  role: "heading",
  hidden: false,
  slot: "headline",
  value: { kind: "text", text: "Pide tu cita" },
};
const body: ContentElement = {
  id: "el-body",
  role: "body",
  hidden: false,
  slot: "body",
  value: { kind: "text", text: "Llámanos o escríbenos por WhatsApp." },
};
const call: ContentElement = {
  id: "el-call",
  role: "button",
  hidden: false,
  slot: "primaryAction",
  value: { kind: "link", text: "Llamar", href: "tel:+34000000000" },
};
const link = (id: string, text: string, href: string): ContentElement => ({
  id,
  role: "link",
  hidden: false,
  slot: "secondaryAction",
  value: { kind: "link", text, href },
});

function section(content: ContentElement[], variantId = "stacked"): Section {
  return {
    id: "sec-contact",
    preset: { catalogId: "contact", variantId },
    source: "catalog",
    content,
    layout: null,
  };
}

describe("the Contacto y reservas preset", () => {
  it("declares its slots with cardinality: a title and one action are required", () => {
    expect(CONTACT_SLOTS).toEqual([
      { slot: "headline", role: "heading", min: 1, max: 1 },
      { slot: "body", role: "body", min: 0, max: 1 },
      { slot: "primaryAction", role: "button", min: 1, max: 1 },
      { slot: "secondaryAction", role: "link", min: 0, max: 3 },
    ]);
  });

  it("is registered in the catalog", () => {
    expect(presetFor("contact")).toBe(contactPreset);
  });

  it("accepts a phone, a WhatsApp and an email beside the main action", () => {
    const content = [
      headline,
      body,
      call,
      link("el-wa", "WhatsApp", "https://wa.me/34000000000"),
      link("el-mail", "Escríbenos", "mailto:hola@example.com"),
    ];
    expect(checkAgainstPreset(section(content), contactPreset)).toEqual([]);
  });

  it("refuses a section with no action: a contact section with nothing to contact is furniture", () => {
    const violations = checkAgainstPreset(section([headline, body]), contactPreset);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.path).toBe("section#sec-contact.slot:primaryAction");
  });

  it("stops at three secondary links, which is what the questionnaire can collect", () => {
    const content = [
      headline,
      call,
      link("el-1", "Uno", "tel:+34000000001"),
      link("el-2", "Dos", "tel:+34000000002"),
      link("el-3", "Tres", "tel:+34000000003"),
      link("el-4", "Cuatro", "tel:+34000000004"),
    ];
    const violations = checkAgainstPreset(section(content), contactPreset);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toMatch(/at most 3/);
  });

  it("declares no field slot, so no form reaches a published site (ADR 0016)", () => {
    expect(CONTACT_SLOTS.some((slot) => slot.role === "field")).toBe(false);
  });
});

describe("compositions", () => {
  it("are the two the dossier asks for, at least", () => {
    expect(CONTACT_VARIANTS).toEqual(["stacked", "side"]);
  });

  it.each(CONTACT_VARIANTS)("%s places every element the document provides", (variantId) => {
    const content = [
      headline,
      body,
      call,
      link("el-wa", "WhatsApp", "https://wa.me/34000000000"),
      link("el-mail", "Escríbenos", "mailto:hola@example.com"),
    ];
    const layout = contactPreset.layoutFor(variantId, content);
    expect(layout.placements.map((p) => p.elementId).sort()).toEqual([
      "el-body",
      "el-call",
      "el-headline",
      "el-mail",
      "el-wa",
    ]);
  });

  it.each(CONTACT_VARIANTS)("%s places all three secondary links", (variantId) => {
    const content = [
      headline,
      call,
      link("el-1", "Uno", "tel:+34000000001"),
      link("el-2", "Dos", "tel:+34000000002"),
      link("el-3", "Tres", "tel:+34000000003"),
    ];
    const placed = contactPreset.layoutFor(variantId, content).placements;
    expect(placed.filter((p) => p.elementId.startsWith("el-")).length).toBe(5);
  });

  it.each(CONTACT_VARIANTS)("%s keeps every placement inside the twelve columns", (variantId) => {
    for (const placement of contactPreset.layoutFor(variantId, [headline, body, call]).placements) {
      expect(placement.column + placement.columnSpan - 1).toBeLessThanOrEqual(12);
    }
  });

  it("differ in geometry", () => {
    const elements = [headline, body, call];
    expect(contactPreset.layoutFor("stacked", elements).placements).not.toEqual(
      contactPreset.layoutFor("side", elements).placements,
    );
  });

  it("refuse an unknown variant instead of falling back to a default", () => {
    expect(() => contactPreset.layoutFor("split", [headline, call])).toThrow(/Unknown variant/);
  });
});

describe("search", () => {
  it("finds it from the words a shop owner would type", () => {
    expect(SEARCH_ALIASES["contact"]).toEqual(
      expect.arrayContaining(["contacto", "reservas", "whatsapp", "pedir cita"]),
    );
  });
});

describe("interface language", () => {
  it("keeps every visible string in the Spanish locale file", () => {
    expect(es["section.contact.name"]).toBe("Contacto y reservas");
    for (const slot of CONTACT_SLOTS) {
      expect(es).toHaveProperty([`section.contact.slot.${slot.slot}`]);
    }
    for (const variant of CONTACT_VARIANTS) {
      expect(es).toHaveProperty([`section.contact.variant.${variant}`]);
    }
  });
});
