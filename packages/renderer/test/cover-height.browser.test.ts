import { type Browser, chromium } from "@playwright/test";
import { COVER_VARIANTS } from "@retorika/catalog";
import { parseDocument, type RetorikaDocument } from "@retorika/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Combination, closeCombination, openCombination } from "./browser-fixtures.ts";
import { loadCorpus } from "./corpus.ts";

/**
 * **The cover's height is the cover's, not the photograph's.**
 *
 * Until 9 October 2026 `.rb-section img` — width 100%, height auto — handed the cover section
 * whatever shape its photograph had, and the cover is the one section where that is unbounded: the
 * image spans six columns beside the words or all twelve beneath them. Measured in this browser at
 * 1440px, before the rule that this suite now guards:
 *
 *     1024×1024  (the sample bank's squares)      1440px of cover
 *     1536×2048  (a phone photo, held upright)    1888px
 *     1170×2532  (a newer phone, same way up)     3005px
 *
 * Three screens of cover on a 900px window, from a photograph an owner was right to upload.
 *
 * **Asserted as a property, not as a number.** What matters is not that the cover is 594px — a
 * type pair or a scale may legitimately change that — but that **the source's aspect ratio cannot
 * change it**. So every ratio is rendered and the heights are compared with each other, which is
 * a guard that survives every change except the one it exists to catch.
 *
 * It needs a browser for the reason the overflow suite does: `aspect-ratio` with `object-fit:
 * cover` is resolved during layout, and nothing about a string of HTML says how tall the result
 * is.
 */

const WIDTHS = [1440, 400] as const;

/**
 * Four sources, by intrinsic ratio: the square the bank ships today, the 3:2 it would be
 * regenerated to, and two shapes a phone produces held upright — the case that produced the
 * 3005px cover.
 *
 * SVG rather than a real photograph, and that is deliberate: an `<svg>` with `width` and `height`
 * has exactly the intrinsic ratio those attributes declare and needs no encoder, so this suite
 * adds no dependency to a package whose allowlist is two (`pnpm renderer:deps`). What is under
 * test is geometry, and geometry does not care what the pixels are.
 */
const SOURCES: readonly { readonly name: string; readonly w: number; readonly h: number }[] = [
  { name: "1:1 — el cuadrado del banco", w: 1024, h: 1024 },
  { name: "3:2 — la regeneración propuesta", w: 1600, h: 1072 },
  { name: "3:4 — foto de móvil en vertical", w: 1536, h: 2048 },
  { name: "9:19.5 — móvil más reciente", w: 1170, h: 2532 },
];

function sourceUri(w: number, h: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#785a3c"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** The corpus' own cover, re-pointed at one source and re-laid-out as one variant. `layout: null`
 * is what makes the preset recompute the placement, so changing the variant really changes the
 * composition rather than leaving the stored one in place. */
function coverShowing(variantId: string, src: string): RetorikaDocument {
  const base = loadCorpus().find((entry) => entry.name === "cover-and-services");
  if (!base) throw new Error("the corpus has no cover-and-services fixture");
  const page = base.document.pages[0];
  const section = page?.sections[0];
  if (!page || !section) throw new Error("the fixture has no cover");
  if (section.preset.catalogId !== "cover") throw new Error("the fixture's first section moved");

  let images = 0;
  const content = section.content.map((element) => {
    if (element.value?.kind !== "image") return element;
    images += 1;
    return { ...element, value: { ...element.value, src } };
  });
  if (images !== 1) throw new Error(`the cover has ${images} images, expected exactly one`);

  return parseDocument({
    ...base.document,
    pages: base.document.pages.map((p) =>
      p.id !== page.id
        ? p
        : {
            ...p,
            sections: p.sections.map((s) =>
              s.id !== section.id
                ? s
                : { ...s, layout: null, preset: { ...s.preset, variantId }, content },
            ),
          },
    ),
  });
}

async function coverHeight(
  browser: Browser,
  variantId: string,
  source: (typeof SOURCES)[number],
  width: number,
): Promise<{ seccion: number; caja: { w: number; h: number }; objectFit: string }> {
  // `doc`, not `document`: inside `page.evaluate` below the name has to mean the browser's.
  const doc = coverShowing(variantId, sourceUri(source.w, source.h));
  const page = await openCombination(
    browser,
    { id: `cover/${variantId}/${source.name}`, document: doc } as Combination,
    width,
  );
  try {
    return await page.evaluate(() => {
      const section = document.querySelector("section");
      const img = section?.querySelector("img");
      if (!section || !img) throw new Error("no cover image on the page");
      const box = img.getBoundingClientRect();
      return {
        seccion: Math.round(section.getBoundingClientRect().height),
        caja: { w: Math.round(box.width), h: Math.round(box.height) },
        objectFit: getComputedStyle(img).objectFit,
      };
    });
  } finally {
    await closeCombination(page);
  }
}

describe("la portada no debe su alto a la proporción de la foto", () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch();
  }, 60_000);
  afterAll(async () => {
    await browser?.close();
  });

  for (const width of WIDTHS) {
    for (const variantId of COVER_VARIANTS) {
      it(`${variantId} mide lo mismo con las cuatro fuentes, a ${width}px`, async () => {
        const medidas = [];
        for (const source of SOURCES) {
          medidas.push({ source, ...(await coverHeight(browser, variantId, source, width)) });
        }

        // El cuadrado y el vertical largo son los dos extremos: 1,0 y 2,16 de alto por ancho.
        // Si la proporción de la fuente se colara en el diseño, se notaría entre esos dos antes
        // que en ninguna otra pareja.
        const alturas = new Set(medidas.map((m) => m.seccion));
        expect(
          [...alturas],
          `la portada midió distinto según la fuente: ${medidas
            .map((m) => `${m.source.name} → ${m.seccion}px`)
            .join(", ")}`,
        ).toHaveLength(1);

        // Y que el recorte sea real, no que las cuatro coincidan porque ninguna se dibuja.
        for (const m of medidas) {
          expect(m.objectFit, m.source.name).toBe("cover");
          expect(m.caja.w, m.source.name).toBeGreaterThan(0);
          expect(m.caja.h, m.source.name).toBeGreaterThan(0);
        }

        // La caja tiene la proporción que declara la hoja, no la de la fuente: 3/2 a sangre,
        // 4/3 junto al texto. Comprobado sobre la medida y no sobre la regla, que es lo que
        // distingue «la hoja lo dice» de «el navegador lo hace».
        const esperada = variantId === "image-background" ? 3 / 2 : 4 / 3;
        for (const m of medidas) {
          expect(m.caja.w / m.caja.h, `${m.source.name}: proporción de la caja`).toBeCloseTo(
            esperada,
            1,
          );
        }
      }, 120_000);
    }
  }
});
