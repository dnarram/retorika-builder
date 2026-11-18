import { describe, expect, it } from "vitest";
import { widthPhrase } from "../src/editor/headerState.ts";
import es from "../src/locales/es.json" with { type: "json" };

/**
 * **No word of the trade in the interface** (sprint 39 día 4, David's point 3: «¿la entiende alguien
 * que no sabe qué es una cabecera, un token o un pliegue?»).
 *
 * The inventory of 18 November 2026 listed the words an owner coming from Canva or Word reads and does
 * not know, each with its plain replacement; this holds the editor's Spanish to that list, so the next
 * sentence written in a hurry cannot bring one back. A closed list, like the motion budget's: a word
 * joins it by decision, and a sentence that needs one of them names its key in `ALLOWED` with why.
 */
const TRADE_WORDS: readonly { word: RegExp; plain: string }[] = [
  { word: /\bcabecera\b/i, plain: "la barra de arriba" },
  { word: /\blienzo\b/i, plain: "la vista previa" },
  { word: /navegador de secciones/i, plain: "menú de secciones" },
  { word: /\bsistema\b/i, plain: "de la web, puesto a mano" },
  { word: /\bcatálogo\b/i, plain: "viene colocada de serie" },
  { word: /\bdestinos?\b/i, plain: "enlaces" },
  { word: /\bse dibuja\b/i, plain: "se muestra" },
  { word: /\bse pliega\b/i, plain: "vuelve a la barra" },
  { word: /\bentradas?\b/i, plain: "enlace del menú" },
  { word: /\bDisposición\b/, plain: "Cómo se coloca" },
  { word: /\breutilizables?\b/i, plain: "Listas" },
  { word: /\bdesenlaz/i, plain: "quitar la lista" },
  { word: /\bconversión\b/i, plain: "Volver a ser sección" },
  { word: /\bMatiz\b/i, plain: "Tono" },
  { word: /\bAl publicar\b/i, plain: "En tu web descargada" },
];

/** Keys whose word means something else there, each with its reason. */
const ALLOWED: Readonly<Record<string, string>> = {
  // A booking system is what the owner calls it: «Pega el enlace de tu sistema de reservas».
  "questionnaire.step5.booking.placeholder": "the owner's own word for their booking tool",
};

describe("the editor's Spanish carries no word of the trade", () => {
  it("finds none of the closed list in any sentence", () => {
    const found: string[] = [];
    for (const [key, text] of Object.entries(es)) {
      if (key in ALLOWED) continue;
      for (const { word, plain } of TRADE_WORDS) {
        if (word.test(text)) found.push(`${key}: «${text}» — say «${plain}»`);
      }
    }
    expect(found).toEqual([]);
  });

  it("allows nothing it does not need", () => {
    for (const key of Object.keys(ALLOWED)) {
      const text = es[key as keyof typeof es];
      expect(text, `${key} is gone`).toBeDefined();
      expect(
        TRADE_WORDS.some(({ word }) => word.test(text)),
        `${key} no longer carries a word of the list: take it out of ALLOWED`,
      ).toBe(true);
    }
  });
});

/**
 * **«{w} px» says the truth by the width** (David's adjustment 3 approving sprint 39): one function,
 * the weight of ADR 0067 — a tablet under 1024, a desktop from 1024 — and its unit at 805 (where a
 * third of generated bars fold) and at 1290.
 */
describe("widthPhrase", () => {
  it("names tablets at 805 and desktops at 1290, from that width", () => {
    expect(widthPhrase(805, "from")).toBe("tabletas y pantallas de 805 px o más");
    expect(widthPhrase(1290, "from")).toBe("pantallas de ordenador de 1290 px o más");
  });

  it("names what is narrower, the phone left to the sentence", () => {
    expect(widthPhrase(805, "upTo")).toBe("tabletas de hasta 805 px");
    expect(widthPhrase(1290, "upTo")).toBe(
      "pantallas de hasta 1290 px, ordenadores pequeños incluidos",
    );
    expect(widthPhrase(805, "below")).toBe("tabletas de menos de 805 px");
    expect(widthPhrase(1290, "below")).toBe(
      "pantallas de menos de 1290 px, ordenadores pequeños incluidos",
    );
  });

  it("puts 1024 with the desktops when it is included, and with the tablets when it is not", () => {
    expect(widthPhrase(1024, "from")).toMatch(/^pantallas de ordenador/);
    expect(widthPhrase(1024, "upTo")).toMatch(/ordenadores pequeños incluidos$/);
    expect(widthPhrase(1024, "below")).toBe("tabletas de menos de 1024 px");
    expect(widthPhrase(1023, "from")).toMatch(/^tabletas/);
  });

  it("refuses a width that is not a number rather than publishing «Infinity px»", () => {
    expect(() => widthPhrase(Number.POSITIVE_INFINITY, "from")).toThrow(/no screens/);
  });

  it("is the only way a width enters the editor's sentences", () => {
    // Every sentence that names screens by width takes `{screens}` and never `{width} px` again.
    for (const [key, text] of Object.entries(es)) {
      expect(text, key).not.toMatch(/\{width\} px/);
    }
  });
});
