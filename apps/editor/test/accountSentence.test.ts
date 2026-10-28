import { describe, expect, it } from "vitest";
import { accountSentence } from "../src/editor/accountSentence.ts";

/**
 * What the indicator says once a site is in the account — since sprint 29 día 6 about the owner's
 * own fonts as well as the photographs. Every state is a different claim, and `null` («not looked
 * yet») is never a zero.
 */
describe("accountSentence", () => {
  it("says the plain sentence when nothing is missing or nothing has been counted", () => {
    expect(accountSentence(null, null)).toBe("Guardado en tu cuenta");
    expect(accountSentence(0, 0)).toBe("Guardado en tu cuenta");
    expect(accountSentence(null, 0)).toBe("Guardado en tu cuenta");
  });

  it("counts the photographs as it always did", () => {
    expect(accountSentence(1, null)).toBe("Guardado en tu cuenta · 1 foto sin subir");
    expect(accountSentence(3, 0)).toBe("Guardado en tu cuenta · 3 fotos sin subir");
  });

  it("counts the fonts, by font", () => {
    expect(accountSentence(null, 1)).toBe("Guardado en tu cuenta · 1 fuente sin subir");
    expect(accountSentence(0, 2)).toBe("Guardado en tu cuenta · 2 fuentes sin subir");
  });

  it("says both when both are short, photographs first", () => {
    expect(accountSentence(2, 1)).toBe(
      "Guardado en tu cuenta · 2 fotos sin subir · 1 fuente sin subir",
    );
  });
});
