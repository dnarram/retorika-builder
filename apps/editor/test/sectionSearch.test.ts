import { CONTACT_ID, GALLERY_ID, PRICES_ID, TEASER_ID } from "@retorika/catalog";
import { describe, expect, it } from "vitest";
import { offersMatching } from "../src/editor/sectionSearch.ts";

/**
 * The «Añadir sección aquí» menu's search, tested against the words the two usability sessions
 * actually produced — which is the point of the whole exercise, and what the sprint 6 plan names
 * as this day's verification: «"carta" lleva a Precios, "platos" a Precios y luego a la galería,
 * "hero" a Portada».
 */

/** What the menu offers on a document whose question 5 named a destination: every catalog section
 * except «Avance», which is never added by hand. `Variants.tsx` builds exactly this list. */
const EVERY_OFFER = [
  { catalogId: "cover" },
  { catalogId: "services" },
  { catalogId: "location" },
  { catalogId: "testimonials" },
  { catalogId: PRICES_ID },
  { catalogId: GALLERY_ID },
  { catalogId: CONTACT_ID },
  { catalogId: "footer" },
];

function ids(offers: readonly { catalogId: string }[]): string[] {
  return offers.map((offer) => offer.catalogId);
}

describe("an empty query changes nothing", () => {
  it("is the whole list, in the catalog's own order — what this menu showed before the search", () => {
    expect(offersMatching(EVERY_OFFER, "")).toBe(EVERY_OFFER);
  });

  it("treats whitespace as empty rather than as a query that finds nothing", () => {
    expect(offersMatching(EVERY_OFFER, "   ")).toBe(EVERY_OFFER);
  });
});

describe("the words the sessions produced", () => {
  it("«carta» finds Precios first — the word sprint 4's naming decision rested on", () => {
    // «Precios» kept its name instead of being renamed per sector *because* a restaurant owner
    // typing «carta» would find it. Until today no screen could reach the code that made that
    // true.
    expect(ids(offersMatching(EVERY_OFFER, "carta"))[0]).toBe(PRICES_ID);
  });

  it("«carta» still finds «Qué hacemos» behind it, for dishes with no prices", () => {
    expect(ids(offersMatching(EVERY_OFFER, "carta"))).toContain("services");
  });

  it("«platos» finds Precios, then the gallery — «los platos estrella o poner la carta»", () => {
    const found = ids(offersMatching(EVERY_OFFER, "platos"));
    expect(found.indexOf(PRICES_ID)).toBeLessThan(found.indexOf(GALLERY_ID));
  });

  it("«platos estrella» finds the gallery, which claims that phrase exactly", () => {
    expect(ids(offersMatching(EVERY_OFFER, "platos estrella"))[0]).toBe(GALLERY_ID);
  });

  it("«hero» finds Portada — the dossier §9 promise, in its own words", () => {
    expect(ids(offersMatching(EVERY_OFFER, "hero"))).toEqual(["cover"]);
  });

  it("«horario» finds «Dónde estamos», which is where an owner puts one", () => {
    expect(ids(offersMatching(EVERY_OFFER, "horario"))).toContain("location");
  });

  it("ignores case and accents, so «Menú» and «menu» are one query", () => {
    expect(ids(offersMatching(EVERY_OFFER, "Menú"))).toEqual(
      ids(offersMatching(EVERY_OFFER, "menu")),
    );
  });
});

describe("what the menu is not offering, the search cannot conjure", () => {
  it("does not offer «Contacto y reservas» when question 5 named no destination", () => {
    // The menu withholds it because `blankSection` refuses to invent a destination and a contact
    // section cannot be born without one. A search that answered «reservas» with it anyway would
    // hand back the one section the document has no honest way to build.
    const withoutContact = EVERY_OFFER.filter((offer) => offer.catalogId !== CONTACT_ID);
    expect(ids(offersMatching(withoutContact, "reservas"))).not.toContain(CONTACT_ID);
    expect(ids(offersMatching(withoutContact, "whatsapp"))).toEqual([]);
  });

  it("does not offer «Avance», which is only ever made by converting a section", () => {
    expect(ids(offersMatching(EVERY_OFFER, "avance"))).not.toContain(TEASER_ID);
  });

  it("finds nothing for a word no section answers to, rather than falling back to everything", () => {
    // The menu draws its own "nothing matches" line from this. Falling back to the full list would
    // look like the search had simply ignored what was typed.
    expect(offersMatching(EVERY_OFFER, "zzzz")).toEqual([]);
  });
});
