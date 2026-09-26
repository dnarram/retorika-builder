import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Browser, Page } from "@playwright/test";
import {
  CATALOG,
  CONTACT_ID,
  CONTACT_VARIANTS,
  COVER_ID,
  COVER_VARIANTS,
  LOCATION_ID,
  LOCATION_VARIANTS,
  SERVICES_ID,
  SERVICES_VARIANTS,
  TESTIMONIALS_ID,
  TESTIMONIALS_VARIANTS,
} from "@retorika/catalog";
import {
  type ContentElement,
  parseDocument,
  type RetorikaDocument,
  type Section,
} from "@retorika/schema";
import { buildTheme, PALETTES, TYPE_PAIRS } from "@retorika/tokens";
import { render } from "../src/index.ts";
import { ASSETS_DIR, DOCUMENTS_DIR } from "./corpus.ts";

/**
 * The matrix the browser suites run over, and the page they run it in.
 *
 * Part 8.5, as amended: every preset, every variant and every palette. Type pairs are in the
 * matrix too, because contrast does not depend on the font but overflow does — a wider face
 * is exactly what pushes a heading past 320 pixels.
 */

/**
 * "standard" is the content a real page would carry. "long" puts the longest plausible Spanish
 * words where a composition is narrowest, for the overflow suite only (docs/tasks/catalog-que-hago.md,
 * step 9): at 768, composition B's title column is about 210px.
 */
export type TextCase = "standard" | "long";

export interface Combination {
  /**
   * Stable, human-readable: "cover/image-right/dark-slate/modern-sans", with "/long" appended
   * for the long-text case.
   */
  id: string;
  catalogId: string;
  variantId: string;
  paletteId: string;
  typePairId: string;
  text: TextCase;
  document: RetorikaDocument;
}

/**
 * A preset's variants, its text cases, and the page's sections for each: the section under
 * test with content that exercises every slot it declares, after whatever it needs above it
 * for a realistic heading order. Built from the base fixture's cover.
 *
 * Keyed by catalog id and checked against CATALOG below: a new preset that is not listed here
 * makes allCombinations() throw, rather than quietly leaving the matrix one preset short.
 */
const PRESET_CASES: Record<
  string,
  {
    variants: readonly string[];
    texts: readonly TextCase[];
    sections: (cover: Section, variantId: string, text: TextCase) => Section[];
  }
> = {
  [COVER_ID]: {
    variants: COVER_VARIANTS,
    texts: ["standard"],
    sections: (cover, variantId) => [
      {
        ...cover,
        preset: { catalogId: COVER_ID, variantId },
        source: "catalog",
        layout: null,
        content: [...cover.content, ...secondaryActions()],
      },
    ],
  },
  [SERVICES_ID]: {
    variants: SERVICES_VARIANTS,
    texts: ["standard", "long"],
    // The cover first, so the page reads h1, h2, h3 as a real one does.
    sections: (cover, variantId, text) => [cover, servicesSection(variantId, text)],
  },
  [LOCATION_ID]: {
    variants: LOCATION_VARIANTS,
    texts: ["standard"],
    sections: (cover, variantId) => [cover, locationSection(variantId)],
  },
  [TESTIMONIALS_ID]: {
    variants: TESTIMONIALS_VARIANTS,
    texts: ["standard", "long"],
    // "long" matters more here than anywhere: a quote is the one field whose length the owner
    // does not choose from a list — they paste what a customer actually wrote.
    sections: (cover, variantId, text) => [cover, testimonialsSection(variantId, text)],
  },
  [CONTACT_ID]: {
    variants: CONTACT_VARIANTS,
    texts: ["standard"],
    sections: (cover, variantId) => [cover, contactSection(variantId)],
  },
};

/**
 * "Opiniones" with two quotes, the second of them anonymous — an author hidden rather than
 * removed (document rule 3), which is how a quote whose customer does not want to be named
 * stays valid against a preset that requires one.
 */
function testimonialsSection(variantId: string, text: TextCase): Section {
  const long = text === "long";
  const textElement = (id: string, role: "heading" | "body", slot: string, value: string) =>
    ({ id, role, hidden: false, slot, value: { kind: "text", text: value } }) as ContentElement;
  return {
    id: "sec-testimonials",
    preset: { catalogId: TESTIMONIALS_ID, variantId },
    source: "catalog",
    layout: null,
    content: [
      textElement("el-op-headline", "heading", "headline", "Lo que dicen de nosotros"),
      textElement("el-op-intro", "body", "intro", "Opiniones que nos han dejado en Google."),
      {
        id: "el-opinions",
        role: "list",
        hidden: false,
        slot: "opinions",
        items: [
          {
            id: "item-1",
            elements: [
              textElement(
                "el-opinion-1-author",
                "heading",
                "author",
                long ? "Rosario Mendoza Villanueva" : "Rosario M.",
              ),
              textElement(
                "el-opinion-1-quote",
                "body",
                "quote",
                long
                  ? "Llevo yendo dos años y nunca he salido descontenta; te explican lo que te van a hacer antes de tocarte el pelo y respetan la hora que te dan."
                  : "Llevo yendo dos años y nunca he salido descontenta.",
              ),
            ],
          },
          {
            id: "item-2",
            elements: [
              {
                ...textElement("el-opinion-2-author", "heading", "author", "Un cliente"),
                hidden: true,
              },
              textElement(
                "el-opinion-2-quote",
                "body",
                "quote",
                "Se agradece que te cojan a la hora que te dan.",
              ),
            ],
          },
        ],
      },
    ],
  };
}

/** Every slot "Horario y ubicación" declares, so the harness measures all of them. */
function locationSection(variantId: string): Section {
  const text = (id: string, role: "heading" | "body", slot: string, value: string) =>
    ({ id, role, hidden: false, slot, value: { kind: "text", text: value } }) as ContentElement;
  return {
    id: "sec-location",
    preset: { catalogId: LOCATION_ID, variantId },
    source: "catalog",
    layout: null,
    content: [
      text("el-location-headline", "heading", "headline", "Dónde estamos"),
      text("el-address", "body", "address", "Calle Espinel 24, Ronda (Málaga)."),
      text("el-hours", "body", "hours", "De martes a sábado, de 10:00 a 20:00."),
      {
        id: "el-map",
        role: "map",
        hidden: false,
        slot: "map",
        value: { kind: "map", label: "Ver en el mapa", latitude: 36.7419, longitude: -5.1673 },
      },
    ],
  };
}

/**
 * "Contacto y reservas" with its main action and the three links the questionnaire can collect.
 * The numbers cannot be anyone's: no Spanish number starts with a zero.
 */
function contactSection(variantId: string): Section {
  const link = (id: string, role: "button" | "link", slot: string, text: string, href: string) =>
    ({ id, role, hidden: false, slot, value: { kind: "link", text, href } }) as ContentElement;
  return {
    id: "sec-contact",
    preset: { catalogId: CONTACT_ID, variantId },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-contact-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Pide tu cita" },
      },
      {
        id: "el-contact-body",
        role: "body",
        hidden: false,
        slot: "body",
        value: { kind: "text", text: "Llámanos o escríbenos por WhatsApp." },
      },
      link("el-call", "button", "primaryAction", "Llamar", "tel:+34000000000"),
      link("el-whatsapp", "link", "secondaryAction", "WhatsApp", "https://wa.me/34000000000"),
      link("el-email", "link", "secondaryAction", "Escríbenos", "mailto:hola@example.com"),
      link("el-map-link", "link", "secondaryAction", "Cómo llegar", "#"),
    ],
  };
}

/**
 * "Qué hago" with four visible cards. The long case uses a single long word as the section
 * title, "Electrodomésticos", which cannot wrap, and a long card title.
 */
function servicesSection(variantId: string, text: TextCase): Section {
  const long = text === "long";
  const textElement = (id: string, role: "heading" | "body", slot: string, value: string) =>
    ({ id, role, hidden: false, slot, value: { kind: "text", text: value } }) as ContentElement;
  const cards: [string, string][] = [
    [long ? "Especialidades de temporada" : "Corte", "Con tijera o con máquina, a tu gusto."],
    ["Barba", "Arreglo y perfilado con navaja."],
    ["Color", "Tintes y mechas."],
    ["Niños", "Cortes para los más pequeños."],
  ];
  return {
    id: "sec-services",
    preset: { catalogId: SERVICES_ID, variantId },
    source: "catalog",
    layout: null,
    content: [
      textElement(
        "el-services-headline",
        "heading",
        "headline",
        long ? "Electrodomésticos" : "Qué hacemos",
      ),
      textElement("el-services-intro", "body", "intro", "Cortes, arreglos de barba y color."),
      {
        id: "el-services",
        role: "list",
        hidden: false,
        slot: "services",
        items: cards.map(([title, description], i) => ({
          id: `item-${i + 1}`,
          elements: [
            textElement(`el-card-${i + 1}-title`, "heading", "title", title),
            textElement(`el-card-${i + 1}-description`, "body", "description", description),
          ],
        })),
      },
    ],
  };
}

/**
 * The fixture fills every cover slot except secondaryAction, which admits two links. Added
 * here rather than in the fixture, which is golden input: without them the harness would never
 * measure the colour of a plain link, which is the one text colour the stylesheet leaves to
 * the browser.
 */
function secondaryActions(): ContentElement[] {
  const link = (id: string, text: string, href: string): ContentElement => ({
    id,
    role: "link",
    hidden: false,
    slot: "secondaryAction",
    value: { kind: "link", text, href },
  });
  return [
    link("el-secondary-1", "Ver servicios", "#servicios"),
    link("el-secondary-2", "Cómo llegar", "#contacto"),
  ];
}

function baseDocument(): RetorikaDocument {
  const raw: unknown = JSON.parse(
    readFileSync(join(DOCUMENTS_DIR, "barbershop-cover.json"), "utf8"),
  );
  return parseDocument(raw);
}

/** Every preset x every variant x every palette (x every type pair). This is Part 8.5, as code. */
export function allCombinations(): Combination[] {
  const base = baseDocument();
  const [page] = base.pages;
  const [section] = page?.sections ?? [];
  if (!page || !section) throw new Error("the base fixture has no section");

  const combinations: Combination[] = [];
  for (const catalogId of Object.keys(CATALOG).sort()) {
    const preset = PRESET_CASES[catalogId];
    if (!preset) {
      throw new Error(
        `Catalog preset "${catalogId}" has no entry in browser-fixtures.ts, so no browser check covers it`,
      );
    }
    for (const variantId of preset.variants) {
      for (const text of preset.texts) {
        for (const palette of PALETTES) {
          for (const typePair of TYPE_PAIRS) {
            const id = [
              catalogId,
              variantId,
              palette.id,
              typePair.id,
              ...(text === "long" ? ["long"] : []),
            ].join("/");
            // Parsed, not cast: a combination that is not a valid document is a bug in this
            // generator, and it must fail here rather than be reported as a finding.
            const document = parseDocument({
              ...base,
              theme: buildTheme({ paletteId: palette.id, typePairId: typePair.id }),
              pages: [{ ...page, sections: preset.sections(section, variantId, text) }],
            });
            combinations.push({
              id,
              catalogId,
              variantId,
              paletteId: palette.id,
              typePairId: typePair.id,
              text,
              document,
            });
          }
        }
      }
    }
  }
  return combinations;
}

/** The combinations axe runs over: the long-text case is for the overflow suite only. */
export function standardCombinations(): Combination[] {
  return allCombinations().filter((combination) => combination.text === "standard");
}

/** A made-up origin the page is served from; nothing ever resolves it over the network. */
const ORIGIN = "http://site.test";

const ASSET_TYPES: Readonly<Record<string, string>> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/**
 * The published page at a given width, with its images.
 *
 * Served through routes rather than page.setContent: setContent has no base URL, so the
 * page's relative "assets/..." images would not load, and axe would then measure the text of
 * image-background against the plain surface and pass it without having compared anything.
 * Every request outside ORIGIN is aborted, so the run needs no network.
 *
 * The HTML is exactly render(doc, "html"), the same bytes the golden corpus stores.
 */
export async function openCombination(
  browser: Browser,
  combination: Combination,
  width: number,
): Promise<Page> {
  const html = render(combination.document, "html").html;
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    if (url.pathname === "/") {
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
    }
    if (url.pathname.startsWith("/assets/")) {
      const name = basename(url.pathname);
      const contentType = ASSET_TYPES[name.slice(name.lastIndexOf(".") + 1)];
      if (!contentType) throw new Error(`no content type for asset ${name}`);
      return route.fulfill({ contentType, body: readFileSync(join(ASSETS_DIR, name)) });
    }
    return route.fulfill({ status: 404, body: "" });
  });

  const response = await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  if (response?.status() !== 200) throw new Error(`${combination.id}: page did not load`);
  // An image that silently failed would change both layout and contrast; fail instead.
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src),
  );
  if (broken.length > 0)
    throw new Error(`${combination.id}: images did not load: ${broken.join(", ")}`);
  return page;
}

/** Closes the page's own context, which is what openCombination created. */
export async function closeCombination(page: Page): Promise<void> {
  await page.context().close();
}
