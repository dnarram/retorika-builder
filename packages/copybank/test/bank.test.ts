import { describe, expect, it } from "vitest";
import genericoJson from "../bank/generico.json" with { type: "json" };
import peluqueriaJson from "../bank/peluqueria-barberia.json" with { type: "json" };
import restauranteJson from "../bank/restaurante-bar.json" with { type: "json" };
import tiendaJson from "../bank/tienda.json" with { type: "json" };
import {
  actionLabel,
  GENERIC_SECTOR,
  sectorsInBank,
  suggestionsFor,
  textFor,
} from "../src/index.ts";
import { sectorFileSchema } from "../src/schema.ts";

const FILES = [
  ["generico", genericoJson],
  ["peluqueria-barberia", peluqueriaJson],
  ["restaurante-bar", restauranteJson],
  ["tienda", tiendaJson],
] as const;

describe("every file in the bank", () => {
  it.each(FILES.map(([name]) => name))("%s parses against the schema", (name) => {
    const file = FILES.find(([candidate]) => candidate === name)?.[1];
    expect(() => sectorFileSchema.parse(file)).not.toThrow();
  });

  it.each(FILES.map(([name]) => name))("%s records who approved it and when", (name) => {
    const file = sectorFileSchema.parse(FILES.find(([candidate]) => candidate === name)?.[1]);
    expect(file.review.status).toBe("approved");
    expect(file.review.by.length).toBeGreaterThan(0);
    expect(file.review.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("refuses a file that nobody approved", () => {
    // The whole of ADR 0009's binding decision, as something a test can fail on.
    const unreviewed = {
      ...genericoJson,
      review: { status: "pending", by: "dnr", date: "2026-09-24" },
    };
    expect(() => sectorFileSchema.parse(unreviewed)).toThrow();
  });

  it("gives every entry an id of its own", () => {
    const ids = FILES.flatMap(([, file]) => sectorFileSchema.parse(file).entries).map(
      (entry) => entry.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the {ciudad} rule of ADR 0009", () => {
  it.each(FILES.map(([name]) => name))(
    "%s: every slot that has a text needing a city has one that does not",
    (name) => {
      const file = sectorFileSchema.parse(FILES.find(([candidate]) => candidate === name)?.[1]);
      const needingCity = file.entries.filter((entry) => entry.placeholders.includes("ciudad"));
      for (const entry of needingCity) {
        const alternative = file.entries.find(
          (candidate) =>
            candidate.section === entry.section &&
            candidate.slot === entry.slot &&
            !candidate.placeholders.includes("ciudad"),
        );
        expect(alternative, `${entry.id} has no alternative without {ciudad}`).toBeDefined();
      }
    },
  );

  it("never returns an unfilled placeholder, with or without a city", () => {
    for (const sector of sectorsInBank()) {
      for (const section of ["cover", "services", "location", "contact"]) {
        for (const slot of ["headline", "subheadline", "body", "intro", "map"]) {
          for (const facts of [
            { negocio: "Barbería El Corte", ciudad: "Ronda" },
            { negocio: "Barbería El Corte" },
          ]) {
            const text = textFor(sector, section, slot, facts);
            if (text !== undefined) expect(text, `${sector}.${section}.${slot}`).not.toMatch(/\{/);
          }
        }
      }
    }
  });
});

describe("the cascade", () => {
  it("prefers the sector's own words", () => {
    expect(textFor("tienda", "services", "headline", { negocio: "Conchi" })).toBe(
      "Qué encontrarás",
    );
  });

  it("falls back to the generic file for what a sector does not say", () => {
    expect(textFor("tienda", "location", "headline", { negocio: "Conchi" })).toBe("Dónde estamos");
    expect(textFor(GENERIC_SECTOR, "location", "headline", { negocio: "Conchi" })).toBe(
      "Dónde estamos",
    );
  });

  it("falls back for a sector with no file at all", () => {
    expect(textFor("fisioterapia", "contact", "headline", { negocio: "Fisio Ribera" })).toBe(
      "Hablamos",
    );
  });

  it("drops the city text when there is no city, and keeps it when there is", () => {
    expect(
      textFor("peluqueria-barberia", "cover", "subheadline", { negocio: "X", ciudad: "Ronda" }),
    ).toBe("Cortes y barbas en Ronda");
    expect(textFor("peluqueria-barberia", "cover", "subheadline", { negocio: "X" })).toBe(
      "Cortes y barbas",
    );
  });

  it("returns undefined rather than inventing a text for a slot nobody wrote", () => {
    expect(textFor("tienda", "cover", "quesadilla", { negocio: "Conchi" })).toBeUndefined();
  });
});

describe("suggestions", () => {
  it("are the sector's own, never another's", () => {
    expect(suggestionsFor("restaurante-bar").map((s) => s.title)).toContain("Tapas");
    expect(suggestionsFor("restaurante-bar").map((s) => s.title)).not.toContain(
      "Corte de caballero",
    );
  });

  it("are empty for a sector the bank does not cover, rather than borrowed", () => {
    expect(suggestionsFor("fisioterapia")).toEqual([]);
    expect(suggestionsFor(GENERIC_SECTOR)).toEqual([]);
  });

  it("may carry no description, which is how a card with nothing true to add is written", () => {
    const comidas = suggestionsFor("restaurante-bar").find((s) => s.id === "comidas");
    expect(comidas?.title).toBe("Comidas");
    expect(comidas?.description).toBeUndefined();
  });
});

describe("action labels", () => {
  it("take the sector's words when it has its own", () => {
    expect(actionLabel("restaurante-bar", "book")).toBe("Reservar mesa");
  });

  it("fall back to the generic words", () => {
    expect(actionLabel("peluqueria-barberia", "book")).toBe("Pedir cita");
    expect(actionLabel("tienda", "call")).toBe("Llamar");
  });

  it("say where the link goes, not just that it is a link", () => {
    // A link's words have to say where it leads: "Escríbenos" could be anything.
    expect(actionLabel(GENERIC_SECTOR, "message")).toContain("WhatsApp");
  });

  it("returns undefined for an action the questionnaire cannot produce", () => {
    expect(actionLabel("tienda", "telepatia")).toBeUndefined();
  });
});
