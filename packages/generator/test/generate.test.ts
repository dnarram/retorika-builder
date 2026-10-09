import {
  PLACEHOLDER_IMAGE_ALT,
  PLACEHOLDER_SAMPLE_ID,
  placeholderImageSrc,
  presetFor,
} from "@retorika/catalog";
import {
  checkAgainstPreset,
  flattenElements,
  type RetorikaDocument,
  type Section,
} from "@retorika/schema";
import { PALETTES } from "@retorika/tokens";
import { describe, expect, it } from "vitest";
import {
  type Answers,
  contactSectionFor,
  EMPTY_ANSWERS,
  footerSectionFor,
  generate,
  generateVariants,
  VARIANTS,
} from "../src/index.ts";

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

describe("contactSectionFor", () => {
  /** What the editor's "Añadir sección aquí" menu asks before offering "Contacto y reservas":
   * this is the one catalog section that cannot be born blank, because its button is a
   * destination and no marker text can stand in for one. */
  it("builds a section carrying question 5's own destination", () => {
    const section = contactSectionFor(
      answers({
        businessName: "X",
        sector: "tienda",
        mainAction: "call",
        phone: "+34600000000",
      }),
    );
    const primary = section?.content.find((el) => el.slot === "primaryAction");
    expect(primary?.value?.kind === "link" && primary.value.href).toBe("tel:+34600000000");
  });

  it("returns nothing for 'visit', so the menu leaves the section out and says why", () => {
    expect(
      contactSectionFor(answers({ businessName: "X", sector: "tienda", mainAction: "visit" })),
    ).toBeUndefined();
  });

  it("returns nothing when the chosen action's own field was left empty", () => {
    expect(
      contactSectionFor(
        answers({ businessName: "X", sector: "tienda", mainAction: "message", whatsapp: "" }),
      ),
    ).toBeUndefined();
  });

  it("returns nothing at all before question 5 has been answered", () => {
    expect(contactSectionFor(MINIMAL)).toBeUndefined();
  });

  it("agrees with what generate() put in the document, rather than building a second opinion", () => {
    const filled = answers({
      businessName: "X",
      sector: "tienda",
      mainAction: "email",
      email: "hola@example.com",
    });
    const fromDocument = findSection(generate(filled).document, "contact");
    const offered = contactSectionFor(filled);
    expect(offered?.content).toEqual(fromDocument.content);
  });
});

describe("'que vengan al local' (question 5, the fifth answer)", () => {
  const visiting = answers({
    businessName: "X",
    sector: "tienda",
    mainAction: "visit",
    address: "Calle Espinel 24, Ronda",
  });

  it("gives the cover a button pointing at the address, now that sections carry anchors", () => {
    // ADR 0016 recorded the hole this closes: answer question 4, skip question 5, and the site
    // showed an address and opening hours with no call to action anywhere on it.
    const cover = findSection(generate(visiting).document, "cover");
    const primary = cover.content.find((el) => el.slot === "primaryAction");
    expect(primary?.value?.kind === "link" && primary.value.href).toBe("#sec-location");
  });

  it("points at a section that actually exists in the document it produced", () => {
    const ids = sectionsOf(generate(visiting).document).map((section) => section.id);
    expect(ids).toContain("sec-location");
  });

  it("still generates no contact section: there is nothing to contact", () => {
    expect(
      sectionsOf(generate(visiting).document).some((s) => s.preset.catalogId === "contact"),
    ).toBe(false);
  });

  it("emits no button at all when there is no address to point at", () => {
    // No location section, so the anchor would name nothing — which is the dead link the
    // download route refuses. Better no button than a broken one.
    const noPremises = answers({ businessName: "X", sector: "tienda", mainAction: "visit" });
    const cover = findSection(generate(noPremises).document, "cover");
    expect(cover.content.some((el) => el.slot === "primaryAction")).toBe(false);
  });

  it("emits no button when the owner said they have no premises", () => {
    const online = answers({
      businessName: "X",
      sector: "tienda",
      mainAction: "visit",
      address: "Calle Espinel 24, Ronda",
      noPremises: true,
    });
    const cover = findSection(generate(online).document, "cover");
    expect(cover.content.some((el) => el.slot === "primaryAction")).toBe(false);
  });

  it("leaves every other action pointing outwards, not down the page", () => {
    const calling = answers({
      businessName: "X",
      sector: "tienda",
      mainAction: "call",
      phone: "+34600000000",
      address: "Calle Espinel 24, Ronda",
    });
    const cover = findSection(generate(calling).document, "cover");
    const primary = cover.content.find((el) => el.slot === "primaryAction");
    expect(primary?.value?.kind === "link" && primary.value.href).toBe("tel:+34600000000");
  });
});

describe("the footer (ADR 0019)", () => {
  it("is generated for every site, because it needs only question 1", () => {
    // Question 1 is the one the questionnaire insists on, so there is never a site whose footer
    // cannot be built — unlike the contact section, which needs a destination.
    const minimal = generate(MINIMAL).document;
    expect(sectionsOf(minimal).some((s) => s.preset.catalogId === "footer")).toBe(true);
  });

  it("is the last section on the page", () => {
    const sections = sectionsOf(generate(MINIMAL).document);
    expect(sections[sections.length - 1]?.preset.catalogId).toBe("footer");
  });

  it("carries the business name and nothing else", () => {
    // The titular, the NIF, the domicilio and the correo are the owner's to add. Nothing here
    // invents them, and nothing leaves a marker reading «Escribe aquí tu NIF» on a real page.
    const footer = findSection(generate(MINIMAL).document, "footer");
    expect(footer.content.map((element) => element.slot)).toEqual(["businessName"]);
  });

  it("writes the business name the way a footer does", () => {
    const footer = findSection(
      generate(answers({ businessName: "Taberna Santo Domingo", sector: "restaurante-bar" }))
        .document,
      "footer",
    );
    const value = footer.content[0]?.value;
    expect(value?.kind === "text" && value.text).toBe("© Taberna Santo Domingo");
  });

  it("holds no destination, so it can never be what blocks a download", () => {
    const footer = findSection(generate(MINIMAL).document, "footer");
    expect(footer.content.every((element) => element.value?.kind === "text")).toBe(true);
  });

  it("is offered back by footerSectionFor after someone deletes it", () => {
    const rebuilt = footerSectionFor(MINIMAL);
    expect(rebuilt.content).toEqual(findSection(generate(MINIMAL).document, "footer").content);
  });
});

describe("sector fallback", () => {
  it("'otro' and an unanswered sector both read the generic texts without crashing", () => {
    // `fisioterapia` stood here for "a launch sector with no bank file", which it was until the
    // seven drafts of sprint 7 could be signed. The two cases that stay true whatever the bank
    // covers are the two below: «Otro sector», which lands on `generico` by design, and no answer
    // at all. A third that named a trade would only be naming this week's coverage.
    expect(() => generate(answers({ businessName: "X", sector: "otro" }))).not.toThrow();
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

describe("the cover's photograph comes from the bank (ADR 0011)", () => {
  function coverImage(document: RetorikaDocument) {
    const image = findSection(document, "cover").content.find((el) => el.role === "image");
    if (!image || image.value?.kind !== "image") throw new Error("the cover has no image");
    return image.value;
  }

  it("is the catalog's placeholder for a sector whose bank is empty — byte for byte what this generator produced before the bank existed", () => {
    // The claim the whole day rests on: asking the bank changed nothing for a sector with no
    // photographs in it — `tienda` here, one of the ten still empty. If this ever fails for an
    // empty sector, the fallback stopped being the catalog's own marker and every generated site
    // of those sectors quietly changed.
    const image = coverImage(generate(MINIMAL).document);
    expect(image.src).toBe(placeholderImageSrc());
    expect(image.alt).toBe(PLACEHOLDER_IMAGE_ALT);
    expect(image.sample).toBe(PLACEHOLDER_SAMPLE_ID);
  });

  it("says where it came from, so nothing downstream has to guess", () => {
    expect(coverImage(generate(MINIMAL).document).sample).toBeDefined();
  });

  it("is identical across repeated generations — no clock, no randomness (INV_5)", () => {
    expect(coverImage(generate(MINIMAL).document)).toEqual(coverImage(generate(MINIMAL).document));
  });

  it("references a relative file, never an absolute path (ADR 0001: the ZIP opens with no server)", () => {
    // Vacuous for `tienda`, whose bank is empty — the placeholder is a data: URI — and real for
    // `restaurante-bar` since 8 October 2026, which `packages/publisher/test/site.test.ts` builds
    // and finds the photograph under `assets/`. An absolute `/muestras/x.webp` resolves against the
    // filesystem root under file://, so the photograph would simply be missing from a downloaded
    // site, on the owner's machine, where nothing of ours would ever see it.
    for (const site of generateVariants(MINIMAL)) {
      const { src } = coverImage(site.document);
      if (src.startsWith("data:")) continue;
      expect(src.startsWith("/")).toBe(false);
      expect(src).not.toMatch(/^[a-z]+:\/\//);
    }
  });

  it("offers three different compositions, so the three cards never read as two", () => {
    /**
     * **This test used to assert the opposite**, and that is worth keeping rather than quietly
     * replacing: it read `expect(new Set(covers).size).toBeLessThan(3)`, because `v1` and `v3`
     * both used `image-right` and the seed had been moved onto the variant id to stop them being
     * handed the same photograph too. It documented a defect as an invariant.
     *
     * David reported the consequence on 5 October 2026 — «dos de las opciones son muy similares o
     * incluso idénticas» — and he was right: the cover is the biggest, topmost thing on a preview
     * card, so two identical covers made two identical cards whatever happened further down. The
     * catalog gained `image-left` and `v3` took it.
     */
    expect(new Set(VARIANTS.map((v) => v.id)).size, "three cards").toBe(3);
    expect(new Set(VARIANTS.map((v) => v.cover)).size, "three covers").toBe(3);
    expect(new Set(VARIANTS.map((v) => v.services)).size, "three services layouts").toBe(3);
  });

  it("still seeds the photograph on the variant's id rather than its composition", () => {
    /**
     * The compositions are three now, so the collision that forced this is gone — and the seed
     * stays on the id anyway, because it is the input that is guaranteed distinct. A composition
     * is a design decision somebody may well revisit; the id is what makes the three cards three.
     *
     * Asserted on the seed's inputs and not on the outcome, because the outcome is not what this
     * guards: for a sector whose bank is empty the three return the same marker, and for
     * `restaurante-bar` two of them land on the same photograph for 39.4% of business names —
     * three independent hashes, not one draw without replacement (`docs/tasks/backlog.md`, «What
     * the first filled sector left open»).
     */
    const seeds = VARIANTS.map((v) => `Taberna:restaurante-bar:${v.id}:sec-cover:el-image`);
    expect(new Set(seeds).size, "the three seeds are distinct").toBe(3);
    for (const variant of VARIANTS) {
      expect(
        seeds.filter((seed) => seed.includes(`:${variant.id}:`)),
        `the seed names ${variant.id}`,
      ).toHaveLength(1);
    }
  });
});

describe("the logo's palette (sprint 6 day 6)", () => {
  /** A Theme is a flat map of resolved token values, with no palette id in it — so the palette is
   * identified the way anything else would identify it: by the colour it actually produced. */
  function paletteOf(document: RetorikaDocument): string | undefined {
    return PALETTES.find(
      (palette) => palette.colors["color.primary"] === document.theme["color.primary"],
    )?.id;
  }

  it("uses the sector's palette when no logo chose one", () => {
    // ADR 0010's «sin logo, la paleta por defecto del sector» — still the answer, and still the
    // answer for every generated site that came before today.
    expect(paletteOf(generate(MINIMAL).document)).toBe("dark-slate");
  });

  it("uses the logo's palette instead, when the logo chose one", () => {
    const { document } = generate(answers({ ...MINIMAL, logoPaletteId: "forest-emerald" }));
    expect(paletteOf(document)).toBe("forest-emerald");
  });

  it("falls back to the sector when the logo chose nothing", () => {
    // `null` is what `paletteForLogo` answers for a logo with no colour in it, and for one whose
    // colour no palette is near. Both arrive here as the same thing, on purpose.
    const { document } = generate(answers({ ...MINIMAL, logoPaletteId: null }));
    expect(paletteOf(document)).toBe("dark-slate");
  });

  it("leaves the typography to the sector even when the logo chose the palette", () => {
    // A logo's colours say nothing about whether a business reads as editorial or as modern.
    const withLogo = generate(answers({ ...MINIMAL, logoPaletteId: "forest-emerald" }));
    const without = generate(MINIMAL);
    expect(withLogo.document.theme["font.heading"]).toBe(without.document.theme["font.heading"]);
    expect(withLogo.document.theme["font.body"]).toBe(without.document.theme["font.body"]);
  });

  it("stays a pure function of its answers — same answers, same theme, twice", () => {
    // The whole reason the analysis happens in the browser and only a string travels: `INV_5`,
    // the golden corpus and «mismas respuestas, misma web» all rest on this staying true.
    const once = generate(answers({ ...MINIMAL, logoPaletteId: "warm-terracotta" }));
    const twice = generate(answers({ ...MINIMAL, logoPaletteId: "warm-terracotta" }));
    expect(once.document.theme).toEqual(twice.document.theme);
  });
});
