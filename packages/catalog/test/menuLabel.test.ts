import { describe, expect, it } from "vitest";
import { CATALOG, menuLabelOf } from "../src/index.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * The short name the menu calls each kind of section by (ADR 0057): a word for a place, where
 * `section.<id>.name` is a phrase for the chooser. The three kinds that lend no menu entry have none,
 * and asking throws — a word invented here would be published on a client's site.
 */
describe("menuLabelOf", () => {
  const lends = ["services", "location", "testimonials", "prices", "gallery", "team", "contact"];
  const lendsNot = ["cover", "footer", "teaser"];

  it("names every kind the menu can hold, and only those", () => {
    expect([...lends, ...lendsNot].sort()).toEqual(Object.keys(CATALOG).sort());
    for (const id of lends) {
      expect(menuLabelOf(id), id).toBe(es[`section.${id}.menuLabel` as keyof typeof es]);
      expect(menuLabelOf(id).length, id).toBeGreaterThan(1);
      expect(menuLabelOf(id).length, id).toBeLessThanOrEqual(20);
    }
  });

  it("is a word, not the chooser's phrase", () => {
    expect(menuLabelOf("location")).toBe("Dónde estamos");
    expect(menuLabelOf("contact")).toBe("Contacto");
    expect(menuLabelOf("gallery")).toBe("Galería");
    expect(es["section.contact.name"]).not.toBe(menuLabelOf("contact"));
  });

  it("throws for the kinds that lend no entry, rather than inventing a word", () => {
    for (const id of lendsNot) {
      expect(`section.${id}.menuLabel` in es, id).toBe(false);
      expect(() => menuLabelOf(id), id).toThrow(/lends no menu entry/);
    }
    expect(() => menuLabelOf("nothing")).toThrow();
  });
});
