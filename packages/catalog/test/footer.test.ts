import { type ContentElement, checkAgainstPreset, type Section } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  FOOTER_ID,
  FOOTER_IDENTITY_SLOTS,
  FOOTER_SLOTS,
  FOOTER_VARIANTS,
  footerPreset,
} from "../src/footer.ts";
import { presetFor, SEARCH_ALIASES } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * "Pie de página" — ADR 0019. The shape *is* the decision: offered, never required, and with no
 * destination anywhere in it.
 */

const line = (id: string, slot: string, text: string): ContentElement => ({
  id,
  role: "body",
  hidden: false,
  slot,
  value: { kind: "text", text },
});

const businessName = line("el-businessName", "businessName", "© Barbería El Corte");

function section(content: ContentElement[], variantId = "stacked"): Section {
  return {
    id: "sec-footer",
    preset: { catalogId: FOOTER_ID, variantId },
    source: "catalog",
    content,
    layout: null,
  };
}

describe("the Pie de página preset", () => {
  it("requires the business name and offers everything else", () => {
    // The whole decision, in one assertion: question 1 is the only answer the questionnaire
    // insists on, so it is the only thing the footer insists on.
    expect(FOOTER_SLOTS).toEqual([
      { slot: "businessName", role: "body", min: 1, max: 1 },
      { slot: "owner", role: "body", min: 0, max: 1 },
      { slot: "taxId", role: "body", min: 0, max: 1 },
      { slot: "address", role: "body", min: 0, max: 1 },
      { slot: "email", role: "body", min: 0, max: 1 },
    ]);
  });

  it("holds no link in any slot, which is what makes it unable to block a download", () => {
    // The download refuses for exactly one thing — a destination that goes nowhere. A section
    // with no destinations has nothing to refuse, so "warns and never blocks" is true rather
    // than nearly true.
    for (const slot of FOOTER_SLOTS) {
      expect(slot.role, slot.slot).toBe("body");
    }
  });

  it("names the four details ADR 0019 offers, and leaves the business name out", () => {
    // Until ADR 0044 these were «the four the editor warns about»; the warning is gone and the
    // four are what «(opcional)» now marks. Marking the business name would contradict question 1,
    // which is the one answer the questionnaire insists on.
    expect([...FOOTER_IDENTITY_SLOTS]).toEqual(["owner", "taxId", "address", "email"]);
    expect(FOOTER_IDENTITY_SLOTS).not.toContain("businessName");
  });

  it("is registered in the catalog", () => {
    expect(presetFor(FOOTER_ID)).toBe(footerPreset);
  });

  it("accepts a footer carrying only the business name, which is how one is born", () => {
    expect(checkAgainstPreset(section([businessName]), footerPreset)).toEqual([]);
  });

  it("accepts a footer with every detail filled", () => {
    const full = section([
      businessName,
      line("el-owner", "owner", "Rosario Mendoza Villanueva"),
      line("el-taxId", "taxId", "12345678Z"),
      line("el-address", "address", "Calle Espinel 24, Ronda"),
      line("el-email", "email", "hola@example.com"),
    ]);
    expect(checkAgainstPreset(full, footerPreset)).toEqual([]);
  });

  it("reports a footer with no business name rather than tolerating it", () => {
    const violations = checkAgainstPreset(section([]), footerPreset);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toMatch(/at least 1/);
  });

  it("counts a hidden business name towards the minimum, so clearing it stays valid", () => {
    // Rule 3, and what `clearSlot` relies on: emptying a field hides it, and the section is
    // still a section.
    const hidden = section([{ ...businessName, hidden: true }]);
    expect(checkAgainstPreset(hidden, footerPreset)).toEqual([]);
  });
});

describe("compositions", () => {
  const filled = [
    businessName,
    line("el-owner", "owner", "Rosario M."),
    line("el-taxId", "taxId", "12345678Z"),
    line("el-address", "address", "Calle Espinel 24"),
    line("el-email", "email", "hola@example.com"),
  ];

  it("are the two this section ships with", () => {
    expect(FOOTER_VARIANTS).toEqual(["stacked", "inline"]);
  });

  it.each(FOOTER_VARIANTS)("%s places every element the document provides", (variantId) => {
    const layout = footerPreset.layoutFor(variantId, filled);
    expect(layout.placements).toHaveLength(filled.length);
  });

  it.each(FOOTER_VARIANTS)("%s keeps every placement inside the twelve columns", (variantId) => {
    for (const placement of footerPreset.layoutFor(variantId, filled).placements) {
      expect(placement.column + placement.columnSpan - 1).toBeLessThanOrEqual(12);
    }
  });

  it.each(FOOTER_VARIANTS)("%s places only what is there", (variantId) => {
    // A footer nobody has filled in has one element, and a composition that placed five would
    // be describing a page that does not exist.
    expect(footerPreset.layoutFor(variantId, [businessName]).placements).toHaveLength(1);
  });

  it("differ in geometry", () => {
    const [first, second] = FOOTER_VARIANTS.map(
      (variantId) => footerPreset.layoutFor(variantId, filled).placements,
    );
    expect(first).not.toEqual(second);
  });

  it("refuse an unknown variant instead of falling back to a default", () => {
    expect(() => footerPreset.layoutFor("split", filled)).toThrow(/Unknown variant/);
  });
});

describe("search", () => {
  it("finds it from the words someone would type, including the legal ones", () => {
    expect(SEARCH_ALIASES["footer"]).toEqual(
      expect.arrayContaining(["pie de página", "aviso legal", "nif", "cif"]),
    );
  });
});

describe("interface language", () => {
  it("keeps every visible string in the Spanish locale file", () => {
    expect(es["section.footer.name"]).toBe("Pie de página");
    expect(es["section.footer.description"]).toBeTruthy();
    for (const slot of FOOTER_SLOTS) {
      expect(es).toHaveProperty([`section.footer.slot.${slot.slot}`]);
    }
    for (const variant of FOOTER_VARIANTS) {
      expect(es).toHaveProperty([`section.footer.variant.${variant}`]);
    }
  });

  /**
   * **The human name, and then the one word a form is allowed.**
   *
   * «NIF o CIF» rather than «Identificación fiscal», «Titular» rather than «Razón social»: the
   * details are named the way the person filling them in would name them, which is what this test
   * has always been about.
   *
   * **«(opcional)» joined them on 17 October 2026** (sprint 24 day 1, ADR 0044), when the editor's
   * advisory — «Las webs de negocios suelen identificar a su titular…» — was removed at David's
   * request. That sentence was the only place the product said these four fields exist and may be
   * left empty; the word carries the second half of it, in the panel where they are filled, and
   * `min: 0` in `FOOTER_SLOTS` is what makes it true rather than reassuring.
   *
   * It is also read aloud: the label is the input's accessible name, so a screen reader now says
   * the field is optional instead of leaving somebody to guess.
   */
  it("names the details the way a person would, and says they are optional", () => {
    expect(es["section.footer.slot.taxId"]).toBe("NIF o CIF (opcional)");
    expect(es["section.footer.slot.owner"]).toBe("Titular (opcional)");
    expect(es["section.footer.slot.address"]).toBe("Domicilio (opcional)");
    expect(es["section.footer.slot.email"]).toBe("Correo de contacto (opcional)");

    // The four ADR 0019 is about, and only those: `businessName` comes from question 1 and is the
    // one slot here the questionnaire insists on, so it carries no qualifier.
    expect(es["section.footer.slot.businessName"]).toBe("Nombre del negocio");
    for (const slot of FOOTER_SLOTS) {
      const label = es[`section.footer.slot.${slot.slot}` as keyof typeof es];
      expect(label.endsWith("(opcional)"), slot.slot).toBe(
        FOOTER_IDENTITY_SLOTS.includes(slot.slot),
      );
    }
  });

  /** And the word is not decoration: the four it marks are the four the preset admits zero of. */
  it("marks exactly the slots the preset makes optional", () => {
    for (const slot of FOOTER_SLOTS) {
      expect(slot.min === 0, slot.slot).toBe(FOOTER_IDENTITY_SLOTS.includes(slot.slot));
    }
  });
});
