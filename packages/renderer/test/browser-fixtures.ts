import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, join } from "node:path";
import type { Browser, Page } from "@playwright/test";
import {
  CATALOG,
  CONTACT_ID,
  CONTACT_VARIANTS,
  COVER_ID,
  COVER_VARIANTS,
  FOOTER_ID,
  FOOTER_VARIANTS,
  GALLERY_ID,
  GALLERY_VARIANTS,
  LOCATION_ID,
  LOCATION_VARIANTS,
  PRICES_ID,
  PRICES_VARIANTS,
  SERVICES_ID,
  SERVICES_VARIANTS,
  TEAM_ID,
  TEAM_VARIANTS,
  TEASER_ID,
  TEASER_VARIANTS,
  TESTIMONIALS_ID,
  TESTIMONIALS_VARIANTS,
  teaserSection,
} from "@retorika/catalog";
import {
  type ContentElement,
  type Page as DocumentPage,
  fontFamilySlug,
  HEADER_BACKGROUNDS,
  HEADER_LAYOUTS,
  parseDocument,
  type RetorikaDocument,
  SECTIONS_POSITIONS,
  type Section,
} from "@retorika/schema";
import {
  buildTheme,
  DEFAULT_SCALE_ID,
  PALETTES,
  SCALES,
  type Scale,
  TYPE_PAIRS,
} from "@retorika/tokens";
import { render, SHIPPABLE_FAMILIES } from "../src/index.ts";
import { ASSETS_DIR, DOCUMENTS_DIR, REPO_ROOT } from "./corpus.ts";

/**
 * The matrix the browser suites run over, and the page they run it in.
 *
 * Part 8.5, as amended: every preset, every variant and every palette. Type pairs are in the
 * matrix too, because contrast does not depend on the font but overflow does — a wider face
 * is exactly what pushes a heading past 320 pixels.
 *
 * Scales joined the matrix in sprint 9, when «el sistema» stopped having a single setting. They
 * are not a fourth blanket dimension: see `scaleCombinations` and `contrastCombinations` for
 * which sets take them and why each one does.
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
   * for the long-text case and the scale's id appended when it is not the default one.
   *
   * The default scale is left out of the name on purpose: every combination that existed before
   * sprint 9 keeps the name it had, so a failure logged against an older run still points at the
   * same case.
   */
  id: string;
  catalogId: string;
  variantId: string;
  paletteId: string;
  typePairId: string;
  scaleId: string;
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
/**
 * A price list, at the size a real one reaches.
 *
 * Twelve lines rather than the two the other list sections use, because twelve is the cap and a
 * carta is the one list anybody actually fills to it — and because the thing most likely to go
 * wrong at this size is not colour but a long dish name and its price landing on top of each
 * other in a narrow card. That is the overflow suite's business, which is why "long" is one of
 * the text cases here.
 */
function pricesSection(variantId: string, text: TextCase): Section {
  const long = text === "long";
  const textElement = (id: string, role: "heading" | "body", slot: string, value: string) =>
    ({ id, role, hidden: false, slot, value: { kind: "text", text: value } }) as ContentElement;
  const dishes: readonly [string, string][] = [
    ["Ensaladilla de la casa", "6,50 €"],
    ["Croquetas caseras", "7,00 €"],
    ["Salmorejo", "5,50 €"],
    ["Tabla de ibéricos", "14,00 €"],
    ["Queso payoyo curado", "9,00 €"],
    ["Solomillo al whisky", "16,50 €"],
    ["Carrillada al vino tinto", "15,00 €"],
    ["Bacalao confitado", "17,00 €"],
    ["Verduras de temporada", "11,00 €"],
    ["Postre del día", "4,50 €"],
    ["Café solo", "1,40 €"],
    ["Copa de vino de la tierra", "2,80 €"],
  ];
  return {
    id: "sec-prices",
    preset: { catalogId: PRICES_ID, variantId },
    source: "catalog",
    layout: null,
    content: [
      textElement("el-pr-headline", "heading", "headline", "Nuestra carta"),
      textElement("el-pr-intro", "body", "intro", "Pregunta por lo que haya hoy fuera de carta."),
      {
        id: "el-lines",
        role: "list",
        hidden: false,
        slot: "lines",
        items: dishes.map(([name, price], index) => ({
          id: `item-${index + 1}`,
          elements: [
            textElement(
              `el-line-${index + 1}-name`,
              "heading",
              "name",
              long ? `${name} con guarnición de temporada y pan de masa madre` : name,
            ),
            textElement(
              `el-line-${index + 1}-price`,
              "body",
              "price",
              long ? `${price} (media ración disponible)` : price,
            ),
          ],
        })),
      },
    ],
  };
}

/**
 * "Fotos de trabajos" with four photographs, deliberately of three different shapes.
 *
 * That is the whole point of the fixture. The stylesheet's new `.rb-gallery .rb-item img` rule
 * exists because four photographs an owner took on a phone are not all the same shape, and without
 * a declared ratio the four cards come out at four heights with the captions at four levels. Every
 * other fixture asset is 320x200, so a gallery built from those alone would pass whether the rule
 * were there or not — `gallery-tall.svg` (200x320) and `gallery-square.svg` (300x300) are here to
 * make the overflow suite measure something that can actually go wrong.
 *
 * The long case is a caption, which is the field whose length the owner does not choose from a
 * list: the same argument `testimonialsSection` makes for a quote.
 */
function gallerySection(variantId: string, text: TextCase): Section {
  const long = text === "long";
  const photos: readonly [string, string, string][] = [
    ["barbershop.svg", "Interior de la barbería", "Nuestro local"],
    ["gallery-tall.svg", "Corte de pelo terminado, de cuerpo entero", "Corte clásico"],
    ["gallery-square.svg", "Detalle del arreglo de barba", "Barba a navaja"],
    ["academy.svg", "El equipo en un curso de formación", "Nos seguimos formando"],
  ];
  return {
    id: "sec-gallery",
    preset: { catalogId: GALLERY_ID, variantId },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-ga-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Nuestros trabajos" },
      },
      {
        id: "el-ga-intro",
        role: "body",
        hidden: false,
        slot: "intro",
        value: { kind: "text", text: "Algunos de los últimos, tal cual salieron." },
      },
      {
        id: "el-photos",
        role: "list",
        hidden: false,
        slot: "photos",
        items: photos.map(([file, alt, caption], index) => ({
          id: `item-${index + 1}`,
          elements: [
            {
              id: `el-photo-${index + 1}`,
              role: "image",
              hidden: false,
              slot: "photo",
              value: { kind: "image", src: `assets/${file}`, alt },
            } as ContentElement,
            {
              id: `el-caption-${index + 1}`,
              role: "body",
              hidden: false,
              slot: "caption",
              value: {
                kind: "text",
                text: long
                  ? `${caption}, con degradado bajo y perfilado de contorno hecho a navaja en la misma sesión`
                  : caption,
              },
            } as ContentElement,
          ],
        })),
      },
    ],
  };
}

/**
 * The pages an «Avance» needs in order to show anything at all.
 *
 * Every other section is drawn from a one-page document, because until sprint 5 every document had
 * one page. A teaser holds only a link and reads its title and its line from the page it points at,
 * so measuring one on a page with nowhere to point would measure a dead link instead of a teaser.
 *
 * The long case is the destination's own title, which is what the owner typed as the heading of the
 * section they converted — the one piece of a teaser nobody chooses from a list.
 */
function teaserPages(text: TextCase): DocumentPage[] {
  const long = text === "long";
  const page = (id: string, slug: string, title: string, intro: string): DocumentPage => ({
    id,
    slug,
    title,
    sections: [
      {
        id: `sec-${slug}`,
        preset: { catalogId: PRICES_ID, variantId: "stacked" },
        source: "catalog",
        layout: null,
        content: [
          {
            id: `el-${slug}-h`,
            role: "heading",
            hidden: false,
            slot: "headline",
            value: { kind: "text", text: title },
          },
          {
            id: `el-${slug}-i`,
            role: "body",
            hidden: false,
            slot: "intro",
            value: { kind: "text", text: intro },
          },
          {
            id: `el-${slug}-lines`,
            role: "list",
            hidden: false,
            slot: "lines",
            items: [
              {
                id: "item-1",
                elements: [
                  {
                    id: `el-${slug}-n`,
                    role: "heading",
                    hidden: false,
                    slot: "name",
                    value: { kind: "text", text: "Ensaladilla" },
                  },
                  {
                    id: `el-${slug}-p`,
                    role: "body",
                    hidden: false,
                    slot: "price",
                    value: { kind: "text", text: "6,50 €" },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  return [
    page(
      "page-carta",
      "nuestra-carta",
      long ? "Nuestra carta de temporada y sugerencias del día" : "Nuestra carta",
      "Pregunta por lo que haya hoy fuera de carta.",
    ),
    page("page-fotos", "fotos", "Fotos de la casa", "Algunas de las últimas."),
    page("page-donde", "donde-estamos", "Dónde estamos", "En pleno centro de Ronda."),
  ];
}

/** Three avances, which is the case worth measuring: three links that read the same and go to
 * three different places (WCAG 2.4.4), plus the contrast and the box of each. */
function teaserSections(): Section[] {
  return [
    teaserSection("sec-avance-1", "./nuestra-carta.html", "Ver más"),
    teaserSection("sec-avance-2", "./fotos.html", "Ver más"),
    teaserSection("sec-avance-3", "./donde-estamos.html", "Ver más"),
  ];
}

const PRESET_CASES: Record<
  string,
  {
    variants: readonly string[];
    texts: readonly TextCase[];
    sections: (cover: Section, variantId: string, text: TextCase) => Section[];
    /** Pages beyond the one under test. Only «Avance» needs any: it is the only section that
     * reads from somewhere else in the document. */
    extraPages?: (text: TextCase) => DocumentPage[];
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
  [PRICES_ID]: {
    variants: PRICES_VARIANTS,
    texts: ["standard", "long"],
    sections: (cover, variantId, text) => [cover, pricesSection(variantId, text)],
  },
  [GALLERY_ID]: {
    variants: GALLERY_VARIANTS,
    texts: ["standard", "long"],
    sections: (cover, variantId, text) => [cover, gallerySection(variantId, text)],
  },
  [TEAM_ID]: {
    variants: TEAM_VARIANTS,
    texts: ["standard", "long"],
    // "long" matters for the same reason it does on "Opiniones": a job title is a sentence the
    // owner writes for themselves, not a name picked from a list.
    sections: (cover, variantId, text) => [cover, teamSection(variantId, text)],
  },
  [TEASER_ID]: {
    variants: TEASER_VARIANTS,
    texts: ["standard", "long"],
    /**
     * **A headed section joins the avances since ADR 0043**, so this case announces both menus.
     * A cover plus three avances has three pages and *no* sections menu — the cover carries the
     * h1 and an avance lends no anchor — so the matrix would only ever see one landmark and the
     * claim it exists to check, that two are announced the same at both widths, would never be
     * exercised. One contact section gives it the second.
     */
    sections: (cover, variantId) => [cover, ...teaserSections(), contactSection("stacked")],
    extraPages: teaserPages,
  },
  [CONTACT_ID]: {
    variants: CONTACT_VARIANTS,
    texts: ["standard"],
    sections: (cover, variantId) => [cover, contactSection(variantId)],
  },
  [FOOTER_ID]: {
    variants: FOOTER_VARIANTS,
    texts: ["standard", "long"],
    // "long" earns its place here: a registered address is the field nobody shortens, and the
    // inline composition gives it seven columns to overflow out of.
    sections: (cover, variantId, text) => [cover, footerSection(variantId, text)],
  },
};

/** "Pie de página" with every detail ADR 0019 offers, which is the widest it ever gets. */
function footerSection(variantId: string, text: TextCase): Section {
  const long = text === "long";
  const line = (id: string, slot: string, value: string) =>
    ({
      id,
      role: "body",
      hidden: false,
      slot,
      value: { kind: "text", text: value },
    }) as ContentElement;
  return {
    id: "sec-footer",
    preset: { catalogId: FOOTER_ID, variantId },
    source: "catalog",
    layout: null,
    content: [
      line("el-businessName", "businessName", "© Barbería El Corte"),
      line("el-owner", "owner", long ? "Rosario Mendoza Villanueva" : "Rosario M."),
      line("el-taxId", "taxId", "12345678Z"),
      line(
        "el-address",
        "address",
        long
          ? "Calle Virgen de los Remedios 24, 3.º izquierda, 29400 Ronda (Málaga), España"
          : "Calle Espinel 24, Ronda",
      ),
      line("el-email", "email", "hola@barberiaelcorte.example"),
    ],
  };
}

/** "Equipo" with three people, the third's job title hidden rather than removed — the same
 * rule-3 case "Opiniones" below exercises for an anonymous quote, here for a card with no job
 * shown. */
function teamSection(variantId: string, text: TextCase): Section {
  const long = text === "long";
  const members: readonly [file: string, alt: string, name: string, job: string][] = [
    ["rosario.svg", "Rosario, en la consulta", "Rosario Martín", "Fisioterapeuta y dueña"],
    [
      "pedro.svg",
      "Pedro, en recepción",
      "Pedro Salas",
      long
        ? "Recepción, atención al paciente y coordinación de citas con las tres consultas"
        : "Recepción",
    ],
    ["clinica.svg", "Ana, en la sala de rehabilitación", "Ana Vega", "Fisioterapeuta"],
  ];
  return {
    id: "sec-team",
    preset: { catalogId: TEAM_ID, variantId },
    source: "catalog",
    layout: null,
    content: [
      {
        id: "el-team-headline",
        role: "heading",
        hidden: false,
        slot: "headline",
        value: { kind: "text", text: "Quién te atiende" },
      },
      {
        id: "el-team-intro",
        role: "body",
        hidden: false,
        slot: "intro",
        value: { kind: "text", text: "El equipo de la clínica." },
      },
      {
        id: "el-members",
        role: "list",
        hidden: false,
        slot: "members",
        items: members.map(([file, alt, name, job], index) => ({
          id: `item-${index + 1}`,
          elements: [
            {
              id: `el-member-${index + 1}-photo`,
              role: "image",
              hidden: false,
              slot: "photo",
              value: { kind: "image", src: `assets/${file}`, alt },
            } as ContentElement,
            {
              id: `el-member-${index + 1}-name`,
              role: "heading",
              hidden: false,
              slot: "name",
              value: { kind: "text", text: name },
            } as ContentElement,
            {
              id: `el-member-${index + 1}-job`,
              role: "body",
              hidden: index === 2,
              slot: "job",
              value: { kind: "text", text: job },
            } as ContentElement,
          ],
        })),
      },
    ],
  };
}

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

/**
 * The full product — every preset x every variant x every text case x every palette x every
 * type pair — kept as a private builder rather than exported. Issue #25 measured it: two
 * sections gave 409 tests, four gave 649, and the ninth section the concept dossier promises
 * would have landed "around 1,400 tests and well over two minutes" — the point where the suite
 * stops being run before pushing and CI becomes the only place it happens, which is how a
 * harness rots. Landing the sixth section (`footer`, sprint 3 day 5) put the count at 1,033 and
 * closed the "before the sixth section" window that issue named as the moment to act.
 *
 * The product is redundant in a specific way the issue names: contrast is a property of a
 * palette and a role, not of a section — `color.primary` on `color.surface` has the same ratio
 * in the cover as in the contact section, and `packages/tokens/test/contrast.test.ts` already
 * asserts every pair arithmetically. Overflow is a property of a typeface, a width and a
 * geometry, not of a palette — the long-text case that found composition B's 213px column would
 * have found it in any palette. Multiplying the two together re-tests the same fact from every
 * angle instead of testing two different facts once each.
 *
 * `allWithFilters` stays private and does the counting; `geometryCombinations`,
 * `contrastCombinations` and `longTextCombinations` below are three smaller draws from it, each
 * built to answer one question rather than all of them at once.
 */
function allWithFilters(
  select: (catalogId: string) => boolean,
  palettes: typeof PALETTES,
  typePairs: typeof TYPE_PAIRS,
  scales: readonly Scale[],
): Combination[] {
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
    if (!select(catalogId)) continue;
    for (const variantId of preset.variants) {
      for (const text of preset.texts) {
        for (const palette of palettes) {
          for (const typePair of typePairs) {
            for (const scale of scales) {
              const id = [
                catalogId,
                variantId,
                palette.id,
                typePair.id,
                ...(text === "long" ? ["long"] : []),
                ...(scale.id === DEFAULT_SCALE_ID ? [] : [scale.id]),
              ].join("/");
              // Parsed, not cast: a combination that is not a valid document is a bug in this
              // generator, and it must fail here rather than be reported as a finding.
              const document = parseDocument({
                ...base,
                theme: buildTheme({
                  paletteId: palette.id,
                  typePairId: typePair.id,
                  scaleId: scale.id,
                }),
                pages: [
                  { ...page, sections: preset.sections(section, variantId, text) },
                  ...(preset.extraPages?.(text) ?? []),
                ],
              });
              combinations.push({
                id,
                catalogId,
                variantId,
                paletteId: palette.id,
                typePairId: typePair.id,
                scaleId: scale.id,
                text,
                document,
              });
            }
          }
        }
      }
    }
  }
  return combinations;
}

/** The palette and type pair every set below holds fixed when it is not the thing under test:
 * the first of each, which is what a real "elige por dónde empezar" card starts on. Read once,
 * not indexed at each call site, so a catalog shipped with an empty list fails here — loudly,
 * at import time — rather than quietly running every "fixed" set with zero combinations. */
function first<T>(items: readonly T[], name: string): readonly [T] {
  const item = items[0];
  if (!item) throw new Error(`browser-fixtures.ts: ${name} is empty`);
  return [item];
}
const FIXED_PALETTE = first(PALETTES, "PALETTES");
const FIXED_TYPE_PAIR = first(TYPE_PAIRS, "TYPE_PAIRS");

/** The scale every set holds fixed when the scale is not the thing under test — the one every
 * document ever generated carries, and the one the whole golden corpus is rendered with. Found by
 * id rather than taken as `SCALES[0]`, so reordering the list cannot silently change what "fixed"
 * means. */
function scaleOrThrow(id: string): Scale {
  const scale = SCALES.find((s) => s.id === id);
  if (!scale) throw new Error(`browser-fixtures.ts: no scale "${id}" in SCALES`);
  return scale;
}
const FIXED_SCALE: readonly [Scale] = [scaleOrThrow(DEFAULT_SCALE_ID)];

/**
 * Set 1 of 3 (issue #25) — geometry: every section, every variant, one palette, one type pair,
 * standard text only. This is what varies per section — a composition's columns, a card grid's
 * wrapping, a list's item count — so this is the set both the overflow suite and axe's
 * structural rules (heading order, landmark roles, missing alt text) run over.
 *
 * Rough size: 6 sections x ~2.2 variants average x 1 palette x 1 type pair ≈ 13 documents.
 */
export function geometryCombinations(): Combination[] {
  return allWithFilters(() => true, FIXED_PALETTE, FIXED_TYPE_PAIR, FIXED_SCALE).filter(
    (combination) => combination.text === "standard",
  );
}

/**
 * Set 2 of 3 (issue #25) — contrast and fonts: every palette, every type pair, on one
 * composition, standard text only. Colour does not depend on which section is drawn, so the
 * section here is fixed instead of varied.
 *
 * The issue's own wording is "one section that uses every text role"; no single preset covers
 * all of them — `cover` reaches heading, subheading, body, button and link but not list, and
 * `services` is the one that adds list without duplicating the rest. So this set fixes on
 * `cover/image-right` (`COVER_ID`'s first variant), which is the widest single-section role
 * coverage the catalog has, and accepts the small gap: a list item's heading and body reuse the
 * same CSS rules (`.rb-section h3`, `.rb-section p`) as this section's own heading and body, so
 * the colour pair those rules resolve to is exercised here even though `role: "list"` itself is
 * not drawn.
 *
 * **Scales vary here, and that is not the same kind of redundancy as the rest.** Colour does not
 * depend on the scale, but the *threshold* does: WCAG asks 3:1 of large text (24px, or 18.66px
 * bold) and 4.5:1 of everything else, and `.rb-section h2` and `p.rb-subtitle` are drawn at
 * `var(--size-subheading)` — 24px in the default scale, exactly on the line, and **20px in
 * "compact"**, which is on the other side of it. So the compact scale asks a stricter question of
 * the same colours than any run before sprint 9 ever asked. `contrast.test.ts` already answers it
 * arithmetically — all five pairs are asserted at >= 4.5:1, the strict threshold, in every palette
 * — but that is an argument, and this is a browser: axe measures what Chromium actually composited,
 * including text over a photograph, which no arithmetic covers.
 *
 * Rough size: 4 palettes x 3 type pairs x 3 scales x 1 section/variant ≈ 36 documents.
 */
export function contrastCombinations(): Combination[] {
  return allWithFilters((catalogId) => catalogId === COVER_ID, PALETTES, TYPE_PAIRS, SCALES)
    .filter((combination) => combination.text === "standard")
    .filter((combination) => combination.variantId === "image-right");
}

/**
 * Set 4 of 4 (sprint 9) — the scale: every section, every variant, one palette, standard and long
 * text, **on the widest scale only**.
 *
 * The scale is the fourth thing that can push a word past 320 pixels, alongside a geometry, a
 * typeface and a long word: "generous" draws a heading at 3rem where the default draws 2.5rem.
 *
 * **"compact" is deliberately absent, and by an argument rather than by omission.** Every one of
 * its eleven values is smaller than the default's — `scales.test.ts` asserts exactly that, key by
 * key — so nothing it renders can be wider than what the default set already measures green. A
 * suite that ran it anyway would be paying for 156 more page loads to re-prove a monotonicity.
 * The day somebody edits that scale upward, the arithmetic test goes red and says so, which is
 * where the claim belongs.
 *
 * Type pairs vary in the long-text half for the reason `longTextCombinations` gives: a wider face
 * is what pushes a word past its box, and a bigger scale is precisely what makes that margin
 * thinner.
 *
 * Rough size: 13 standard + 39 long ≈ 52 documents.
 */
export function scaleCombinations(): Combination[] {
  const widest = [scaleOrThrow("generous")] as const;
  return [
    ...allWithFilters(() => true, FIXED_PALETTE, FIXED_TYPE_PAIR, widest).filter(
      (combination) => combination.text === "standard",
    ),
    ...allWithFilters(() => true, FIXED_PALETTE, TYPE_PAIRS, widest).filter(
      (combination) => combination.text === "long",
    ),
  ];
}

/**
 * Set 5 (sprint 30 día 2) — the header: the five background schemes over every palette, and the
 * three layouts with the sections' row and the fixed bar over the fixed palette.
 *
 * Two questions, two draws. **Colour**: a scheme writes its entries in `color.surface` on a coloured
 * bar, and `contrast.test.ts` proves the pairs arithmetically; axe here measures what Chromium
 * composited, over every palette, at both widths — including `transparent`, whose words sit over the
 * cover's own `color.surface`, and whose one unprovable case (a transparent bar over a photograph) is
 * the download review's business and not drawn here. **Structure**: the layouts, the row of its own
 * and the fixed bar change the landmarks' arrangement and nothing about colour, so one palette.
 *
 * On the teaser case's document, which is the one that draws both menus (ADR 0043), with a brand and
 * a button so every part of the header is on the page.
 *
 * **Each menu's place** (ADR 0060, sprint 31 día 3) joins it twice. As structure: the sections' five
 * places beside the pages in the bar and in a right rail, at the bar's default look. As colour: the
 * three-column page (pages and brand in a left rail, sections in a right one) and the disclosure, each
 * over the five schemes on the fixed palette — a rail and a floating «Ir a…» draw their own background
 * from the bar's scheme, and that is a pair Chromium composites somewhere new.
 *
 * Rough size: 5 schemes × 5 palettes + 3 layouts × 2 places × 2 fixed + 8 places + 2 × 5 schemes
 * ≈ 55 documents. `railCombinations()` is the subset that draws a rail.
 */
/**
 * One header case on the teaser document: a brand and a button on every page, the given header over
 * it, on the given palette. The constructor of every combination below — and of the menu audit's
 * matrix (`apps/editor/audit`, sprint 33 día 2), which is why it is exported rather than kept as the
 * closure it was.
 */
export function headerCase(
  id: string,
  paletteId: string,
  header: RetorikaDocument["header"],
): Combination {
  const base = baseDocument();
  const [page] = base.pages;
  const [section] = page?.sections ?? [];
  if (!page || !section) throw new Error("the base fixture has no section");
  const teaser = PRESET_CASES[TEASER_ID];
  if (!teaser) throw new Error("no teaser case");
  const variantId = teaser.variants[0] ?? "stacked";
  // **The button goes to a page, not to «Contacto»** (sprint 31 día 3). The home page's one section
  // that lends a menu entry is «Contacto» — the rest are the cover and three avances — and a button
  // takes its destination out of every menu, so with the button there this whole matrix drew no
  // sections menu at all: the row of sprint 30's layouts was never on the page it was measured on,
  // found when the rails' landmark test below asked where «Secciones» was announced. A page as the
  // destination leaves «Contacto» to the sections and two pages to the pages menu.
  const lastPage = teaser.extraPages?.("standard").at(-1);
  if (!lastPage) throw new Error("the teaser case has no page for the button to go to");
  const document = parseDocument({
    ...base,
    theme: buildTheme({
      paletteId,
      typePairId: FIXED_TYPE_PAIR[0].id,
      scaleId: DEFAULT_SCALE_ID,
    }),
    header: {
      brand: { name: true },
      action: { kind: "page", pageId: lastPage.id },
      ...header,
    },
    pages: [
      { ...page, sections: teaser.sections(section, variantId, "standard") },
      ...(teaser.extraPages?.("standard") ?? []),
    ],
  });
  return {
    id,
    catalogId: TEASER_ID,
    variantId,
    paletteId,
    typePairId: FIXED_TYPE_PAIR[0].id,
    scaleId: DEFAULT_SCALE_ID,
    text: "standard",
    document,
  };
}

export function headerCombinations(): Combination[] {
  const make = headerCase;
  const combinations: Combination[] = [];
  for (const background of HEADER_BACKGROUNDS) {
    for (const palette of PALETTES) {
      combinations.push(
        make(`header/${background}/${palette.id}`, palette.id, { look: { background } }),
      );
    }
  }
  // The bar's two places for the sections — beside the pages, or a row of their own — which is what
  // `sections.row` was until 1.17.0.
  for (const layout of HEADER_LAYOUTS) {
    for (const position of ["bar", "row"] as const) {
      for (const sticky of [false, true]) {
        combinations.push(
          make(`header/${layout}/${position}${sticky ? "/fixed" : ""}`, FIXED_PALETTE[0].id, {
            layout,
            sticky,
            sections: { position },
          }),
        );
      }
    }
  }
  // Each menu's place (ADR 0060): the sections' five beside the pages in the bar and in a right
  // rail. The two the loop above already drew (pages in the bar, sections in it or in a row) are not
  // drawn twice.
  for (const pages of ["bar", "right"] as const) {
    for (const sections of SECTIONS_POSITIONS) {
      if (pages === "bar" && (sections === "bar" || sections === "row")) continue;
      combinations.push(
        make(`header/pages-${pages}/sections-${sections}`, FIXED_PALETTE[0].id, {
          pages: { position: pages },
          sections: { position: sections },
        }),
      );
    }
  }
  // The rail's and the disclosure's own backgrounds, from the bar's five schemes.
  for (const background of HEADER_BACKGROUNDS) {
    combinations.push(
      make(`header/three-columns/${background}`, FIXED_PALETTE[0].id, {
        look: { background },
        pages: { position: "left" },
        sections: { position: "right" },
        brandWithPages: true,
      }),
      make(`header/fold/${background}`, FIXED_PALETTE[0].id, {
        look: { background },
        sections: { position: "fold", mobile: "fold" },
      }),
    );
  }
  // A row at every width whose phone is «Ir a…» (sprint 32 día 1): the one pair that drew two copies
  // of the sections at 320, the row beside the disclosure, until the row learnt the phone's choice.
  combinations.push(
    make("header/fold/row-on-wide", FIXED_PALETTE[0].id, {
      sections: { position: "row", mobile: "fold" },
    }),
  );
  return combinations;
}

/**
 * **The brand at its sizes and places** (ADR 0069 and 0070, sprint 35 día 4), a twin of the matrix
 * rather than a dimension of it: with a logo — which `headerCase` never draws — the nine words of size
 * and place on the one-line bar with the name at the heading's size, and the three places on the
 * stacked bar with the large logo. Twelve documents on the fixed palette, measured where the matrix
 * is: by axe at the phone and the desktop, and by check 11 at the four widths the bar holds its lines
 * or folds at.
 */
export function brandCombinations(): Combination[] {
  const logo = { src: "assets/portada.png", width: 2, height: 2 };
  const combinations: Combination[] = [];
  for (const logoSize of ["sm", "md", "lg"] as const) {
    for (const place of ["start", "center", "end"] as const) {
      combinations.push(
        headerCase(`brand/${logoSize}/${place}`, FIXED_PALETTE[0].id, {
          brand: { name: true, logo, logoSize, nameSize: "heading", place },
        }),
      );
    }
  }
  for (const place of ["start", "center", "end"] as const) {
    combinations.push(
      headerCase(`brand/stacked/${place}`, FIXED_PALETTE[0].id, {
        layout: "stacked",
        brand: { name: true, logo, logoSize: "lg", nameSize: "subheading", place },
      }),
    );
  }
  return combinations;
}

/**
 * **A transparent bar taller than one line, over the cover** (sprint 33 día 6): stacked, with the
 * sections' row, both, and the menu audit's own combination — the pages in a left column, the row,
 * stacked — each fixed and in the flow. The forms whose room the stylesheet's estimate of one line
 * got wrong, by 33.6 and 44.8 px, and the one the audit found covering 30 px of the cover at every
 * wide width. `headerCombinations` draws the schemes on the default layout and the layouts on the
 * default scheme, so none of these is in it.
 */
export function transparentCoverCombinations(): Combination[] {
  const forms: readonly [string, NonNullable<RetorikaDocument["header"]>][] = [
    ["stacked", { layout: "stacked" }],
    ["row", { sections: { position: "row" } }],
    ["stacked-row", { layout: "stacked", sections: { position: "row" } }],
    [
      "left-row-stacked",
      { layout: "stacked", pages: { position: "left" }, sections: { position: "row" } },
    ],
  ];
  return forms.flatMap(([name, header]) =>
    [false, true].map((sticky) =>
      headerCase(`header/transparent/${name}${sticky ? "/fixed" : ""}`, FIXED_PALETTE[0].id, {
        ...header,
        sticky,
        look: { background: "transparent" },
      }),
    ),
  );
}

/**
 * **The same combination with short words** (sprint 34 día 2): «Carta», «Fotos» and «Reservar» for
 * the teaser's pages, and a short business name. The teaser's own labels fold the bar into the
 * phone's up to the tablet's widths (ADR 0067), so without this twin the wide form between 721 and
 * 1023 would be measured on no real content at all.
 */
export function shortLabelled(combination: Combination): Combination {
  const labels = ["Carta", "Fotos", "Reservar"];
  const doc = combination.document;
  return {
    ...combination,
    id: `${combination.id}/short`,
    document: parseDocument({
      ...doc,
      siteName: "El Corte",
      pages: doc.pages.map((p, i) => (i === 0 ? p : { ...p, menuLabel: labels[i - 1] })),
    }),
  };
}

/** The header combinations that draw a rail: the ones a width between 1024 and 1247 says something
 * new about, since that is where a rail stands alone or falls. */
export function railCombinations(): Combination[] {
  return headerCombinations().filter((combination) => {
    const header = combination.document.header;
    return (
      (header?.pages?.position ?? "bar") !== "bar" ||
      header?.sections?.position === "left" ||
      header?.sections?.position === "right"
    );
  });
}

/**
 * Set 3 of 3 (issue #25) — long text: unchanged from what the harness already measured, since
 * the issue's own case for it — "every composition that has a narrow column, in every type
 * pair, since that is where a word overflows" — was never redundant with the other two. A wide
 * font is what pushes a word past its box, which is why type pairs vary here and palettes do
 * not: colour plays no part in whether text fits.
 */
export function longTextCombinations(): Combination[] {
  return allWithFilters(() => true, FIXED_PALETTE, TYPE_PAIRS, FIXED_SCALE).filter(
    (combination) => combination.text === "long",
  );
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

const FONT_TYPES: Readonly<Record<string, string>> = { woff2: "font/woff2", woff: "font/woff" };

/** Resolves from the root package, whose own dependencies are every gallery family's `@fontsource`
 * package (`publisher/test/fonts.test.ts` holds the root's pins level with the publisher's). */
const fromRoot = createRequire(join(REPO_ROOT, "package.json"));

/**
 * **The bytes of a face the page names in `fonts/`, as the published ZIP carries it** (sprint 34 día
 * 3): a gallery face from its `@fontsource` package — the files the publisher's `fontData/` is
 * generated from, and held to them byte for byte by `publisher/test/fonts.test.ts`, which this package
 * cannot import — and an owner's own from `fixtures/fonts/`, which stands in for the browser and the
 * account as `fixtures/assets/` does for the photographs. `undefined` for a name neither knows.
 */
function fontBytes(name: string): Buffer | undefined {
  const shipped = SHIPPABLE_FAMILIES.find(({ faces }) => faces.some((f) => f.file === name));
  if (shipped) {
    return readFileSync(
      fromRoot.resolve(`@fontsource/${fontFamilySlug(shipped.family)}/files/${name}`),
    );
  }
  try {
    return readFileSync(join(ASSETS_DIR, "..", "fonts", name));
  } catch {
    return undefined;
  }
}

/**
 * The published page at a given width, with its images.
 *
 * Served through routes rather than page.setContent: setContent has no base URL, so the
 * page's relative "assets/..." images would not load, and axe would then measure the text of
 * image-background against the plain surface and pass it without having compared anything.
 * Every request outside ORIGIN is aborted, so the run needs no network. **And its "fonts/..."
 * faces** since sprint 34 día 3 (`fontBytes`): until then every gallery family was drawn in its
 * fallback, so no suite had measured a page in the letter it is published in.
 *
 * The HTML is exactly render(doc, "html"), the same bytes the golden corpus stores.
 */
export async function openCombination(
  browser: Browser,
  combination: Combination,
  width: number,
  motion = false,
): Promise<Page> {
  return openHtml(
    browser,
    render(combination.document, "html").html,
    width,
    combination.id,
    motion,
  );
}

/**
 * What `openCombination` does once it has the html: the page of any document — the published one,
 * or the canvas's with its own stylesheet (the menu audit, sprint 33 día 2) — served at `ORIGIN`
 * with the corpus's assets, at a width, with its lazy images decoded, or it throws.
 */
export async function openHtml(
  browser: Browser,
  html: string,
  width: number,
  id: string,
  motion = false,
): Promise<Page> {
  // Reduced motion before the first frame (sprint 32 día 0): axe and the overflow walk measure the
  // page a visitor who asked for no movement sees, which is also the settled state of any entrance
  // the stylesheet animates. A half-faded line would be measured at partial opacity, and axe reads
  // that as a contrast it cannot compute. `motion.browser.test.ts` is the twin that opens the same
  // page under `no-preference` and asserts the movement exists and ends in the same place.
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: motion ? "no-preference" : "reduce",
  });
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
    if (url.pathname.startsWith("/fonts/")) {
      const name = basename(url.pathname);
      const body = fontBytes(name);
      const contentType = FONT_TYPES[name.slice(name.lastIndexOf(".") + 1)];
      // Not served is not thrown here — a route handler's error is the browser's, not the test's —
      // but it cannot pass unseen: the face is in `error` below, and that throws.
      if (body && contentType) return route.fulfill({ contentType, body });
    }
    return route.fulfill({ status: 404, body: "" });
  });

  const response = await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  if (response?.status() !== 200) throw new Error(`${id}: page did not load`);
  // Photographs below the first section carry `loading="lazy"` since sprint 18 day 4, and a
  // lazy image below the fold has not even been requested when `load` fires — so the check
  // below read «did not load» for every gallery and team page whose cards sat under the fold,
  // which CI found on 12 October 2026 and a local run would have too, had one been made. Each
  // is scrolled into view and decoded first, then the page goes back to the top: the suites
  // measure geometry and contrast, neither of which depends on when a byte arrived.
  await page.evaluate(async () => {
    for (const img of document.images) if (img.loading === "lazy") img.scrollIntoView();
    await Promise.allSettled([...document.images].map((img) => img.decode()));
    window.scrollTo(0, 0);
  });
  // An image that silently failed would change both layout and contrast; fail instead.
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.src),
  );
  if (broken.length > 0) throw new Error(`${id}: images did not load: ${broken.join(", ")}`);
  // Every face the stylesheet declares, loaded before anything is measured: `font-display: swap`
  // draws the fallback until a face arrives, and a face is only fetched once some text asks for
  // it — so a measure right after `load` could be of either letter. Loading each one says which,
  // and a face that does not load fails the page, as a broken image does.
  const faces = await page.evaluate(async () => {
    const all = [...document.fonts];
    await Promise.allSettled(all.map((face) => face.load()));
    return all.map((face) => ({ face: `${face.family} ${face.weight}`, status: face.status }));
  });
  const unloaded = faces.filter((f) => f.status !== "loaded").map((f) => f.face);
  if (unloaded.length > 0) throw new Error(`${id}: faces did not load: ${unloaded.join(", ")}`);
  return page;
}

/**
 * Horizontal overflow, as `overflow.browser.test.ts` has measured it since sprint 2: the first
 * element past the viewport's right edge, half a pixel of tolerance, what is inside a box that
 * scrolls sideways on purpose exempted. Here since sprint 33 día 2 so the menu audit measures the
 * same thing with the same code, unchanged.
 */
export interface Overflow {
  scrollWidth: number;
  innerWidth: number;
  /** The first element whose box passes the right edge, or null. */
  offender: { selector: string; right: number } | null;
}

export async function measureOverflow(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const describe = (el: Element): string => {
      const tag = el.tagName.toLowerCase();
      for (const name of ["data-slot", "data-section", "data-page"]) {
        const value = el.getAttribute(name);
        if (value !== null) return `${tag}[${name}="${value}"]`;
      }
      const cls = el.getAttribute("class");
      if (cls) return `${tag}.${cls.split(/\s+/).join(".")}`;
      // A bare tag names nothing: a menu link has no class and no data attribute, so its words are
      // the only way to tell which one ran past the edge.
      const words = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      return words ? `${tag} «${words}»` : tag;
    };
    // Inside a strip that scrolls sideways on purpose — the header's row of sections on a phone
    // (ADR 0057) — an entry past the edge is dragged in by the visitor and clipped by the row; the
    // row itself is still judged, and `scrollWidth` below still says whether the page scrolls.
    const insideScroller = (el: Element): boolean => {
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") return true;
      }
      return false;
    };
    const innerWidth = window.innerWidth;
    let offender: { selector: string; right: number } | null = null;
    for (const el of document.querySelectorAll("body *")) {
      const right = el.getBoundingClientRect().right;
      // Half a pixel of tolerance for sub-pixel rounding, never more.
      if (right > innerWidth + 0.5 && !insideScroller(el)) {
        offender = { selector: describe(el), right: Math.round(right * 10) / 10 };
        break;
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth, offender };
  });
}

/** Closes the page's own context, which is what openCombination created. */
export async function closeCombination(page: Page): Promise<void> {
  await page.context().close();
}
