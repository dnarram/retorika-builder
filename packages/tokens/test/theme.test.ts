import { parseDocument, TOKEN_KEYS } from "@retorika/schema";
import { describe, expect, it } from "vitest";
import {
  buildTheme,
  DEFAULT_SCALE_ID,
  PALETTES,
  RETORIKA_BRAND,
  SCALES,
  TYPE_PAIRS,
} from "../src/index.ts";

describe("theme", () => {
  it("builds a theme with exactly the namespace keys", () => {
    const theme = buildTheme({
      paletteId: PALETTES[0]?.id ?? "",
      typePairId: TYPE_PAIRS[0]?.id ?? "",
    });

    const themeKeys = Object.keys(theme).sort();
    const expectedKeys = [...TOKEN_KEYS].sort();
    expect(themeKeys).toEqual(expectedKeys);
  });

  it("produces a theme accepted by parseDocument inside a minimal document", () => {
    const theme = buildTheme({
      paletteId: PALETTES[0]?.id ?? "",
      typePairId: TYPE_PAIRS[0]?.id ?? "",
    });

    const doc = {
      schemaVersion: "1.0.0",
      id: "doc-barbershop",
      siteName: "Barbería El Corte",
      theme,
      pages: [
        {
          id: "home",
          slug: "index",
          title: "Barbería El Corte",
          sections: [
            {
              id: "sec-cover",
              preset: {
                catalogId: "cover",
                variantId: "image-right",
              },
              source: "catalog",
              content: [
                {
                  id: "el-headline",
                  role: "heading",
                  hidden: false,
                  slot: "headline",
                  value: {
                    kind: "text",
                    text: "Tu corte de siempre, sin esperas",
                  },
                },
                {
                  id: "el-sub",
                  role: "subheading",
                  hidden: false,
                  slot: "subheadline",
                  value: {
                    kind: "text",
                    text: "Reserva en treinta segundos",
                  },
                },
                {
                  id: "el-body",
                  role: "body",
                  hidden: false,
                  slot: "body",
                  value: {
                    kind: "text",
                    text: "Abierto de martes a sábado en el centro del barrio.",
                  },
                },
                {
                  id: "el-image",
                  role: "image",
                  hidden: false,
                  slot: "image",
                  value: {
                    kind: "image",
                    src: "assets/barbershop.svg",
                    alt: "Interior de la barbería",
                  },
                },
                {
                  id: "el-cta",
                  role: "button",
                  hidden: false,
                  slot: "primaryAction",
                  value: {
                    kind: "link",
                    text: "Pedir cita",
                    href: "#reservas",
                  },
                },
              ],
              layout: null,
            },
          ],
        },
      ],
      collections: [],
    };

    const parsed = parseDocument(doc);
    expect(parsed.id).toBe("doc-barbershop");
  });

  it("throws on unknown paletteId, typePairId, or scaleId", () => {
    const validPaletteId = PALETTES[0]?.id ?? "";
    const validPairId = TYPE_PAIRS[0]?.id ?? "";

    expect(() => buildTheme({ paletteId: "unknown-palette", typePairId: validPairId })).toThrow();

    expect(() => buildTheme({ paletteId: validPaletteId, typePairId: "unknown-pair" })).toThrow();

    expect(() =>
      buildTheme({
        paletteId: validPaletteId,
        typePairId: validPairId,
        scaleId: "unknown-scale",
      }),
    ).toThrow();
  });

  it("has unique ids in PALETTES, TYPE_PAIRS, and SCALES", () => {
    const paletteIds = PALETTES.map((p) => p.id);
    expect(new Set(paletteIds).size).toBe(paletteIds.length);

    const typePairIds = TYPE_PAIRS.map((t) => t.id);
    expect(new Set(typePairIds).size).toBe(typePairIds.length);

    const scaleIds = SCALES.map((s) => s.id);
    expect(new Set(scaleIds).size).toBe(scaleIds.length);
  });

  it("has DEFAULT_SCALE_ID existing in SCALES", () => {
    expect(SCALES.some((s) => s.id === DEFAULT_SCALE_ID)).toBe(true);
  });

  it("does not include RETORIKA_BRAND as an entry in PALETTES", () => {
    for (const palette of PALETTES) {
      expect(palette.colors).not.toEqual(RETORIKA_BRAND);
    }
  });
});
