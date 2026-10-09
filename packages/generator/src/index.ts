import {
  parseDocument,
  type RetorikaDocument,
  SCHEMA_VERSION,
  type Section,
} from "@retorika/schema";
import type { Answers, SectorId } from "./answers.ts";
import { buildContact, buildCover, buildFooter, buildLocation, buildServices } from "./sections.ts";
import { themeFor } from "./theme.ts";
import { VARIANTS, type VariantChoice } from "./variants.ts";

export type { Answers, MainAction, SectorId } from "./answers.ts";
export { EMPTY_ANSWERS, SECTOR_IDS } from "./answers.ts";
export { hasLocationSection, LOCATION_SECTION_ID, visitAnchor } from "./destination.ts";
export type { VariantChoice } from "./variants.ts";
export { VARIANTS } from "./variants.ts";

export interface GeneratedSite {
  document: RetorikaDocument;
  /** Keyed the way `@retorika/publisher`'s `buildSite` expects: "assets/<name>" -> bytes. */
  assets: Map<string, Uint8Array>;
}

/**
 * "Otro sector" reads the bank's generic file — the cascade in `@retorika/copybank` falls back to
 * `generico` for any sector with no file of its own, and "otro" is the one launch answer that can
 * never have one. Every named sector had that same gap until 30 September 2026, when the seven
 * drafts sprint 7 wrote were signed.
 */
function effectiveSector(answers: Answers): SectorId {
  return answers.sector ?? "otro";
}

/**
 * The five answers, one chosen composition, and a real `RetorikaDocument` — validated the way
 * every other document in this repository is, so a generator bug fails loudly here rather than
 * publishing a broken site.
 */
export function generate(
  answers: Answers,
  variant: VariantChoice = VARIANTS[0],
  /**
   * Bank ids a sibling card has already taken (ADR 0036). Only `generateVariants` passes it; a
   * lone `generate(answers, variant)` has no siblings and behaves exactly as it did before this
   * parameter existed, which matters because that is the entry point the editor's «añadir
   * sección» paths and most of the tests use.
   */
  avoid: readonly string[] = [],
): GeneratedSite {
  const sector = effectiveSector(answers);
  const cover = buildCover(answers, sector, variant.cover, variant.id, avoid);
  const services = buildServices(answers, sector, variant.services);
  const location = buildLocation(answers, sector);
  const contact = buildContact(answers, sector);
  const footer = buildFooter(answers);

  const sections = [cover, services, location, contact, footer].filter((s) => s !== undefined);

  const document: RetorikaDocument = {
    schemaVersion: SCHEMA_VERSION,
    id: `doc-${slugify(answers.businessName)}`,
    siteName: answers.businessName,
    theme: themeFor(sector, answers.logoPaletteId),
    pages: [
      {
        id: "home",
        slug: "index",
        title: answers.businessName,
        sections,
      },
    ],
    collections: [],
  };

  // Still nothing to add here, for two different reasons now.
  //
  // The placeholder is a data: URI, self-contained in the document and needing no file at all
  // (@retorika/catalog's placeholder-image.ts). A bank photograph *does* need one — but its bytes
  // are not this function's to fetch: `generateVariants` runs in the browser, and reading them
  // would mean a filesystem in a bundle or an `await` in a function every caller treats as pure.
  // So the document names the file and `apps/editor` puts the bytes beside it, through exactly
  // the path an uploaded photo already travels: IndexedDB, the preview's object URL, and the
  // multipart form the download route reads. A bank photograph is an upload the app made on the
  // owner's behalf, and being literally that — rather than merely similar to it — is what keeps
  // the preview, the ZIP and the size bounds from each needing a second case.
  const assets = new Map<string, Uint8Array>();

  return { document: parseDocument(document), assets };
}

/**
 * The contact section this questionnaire's answers justify, or `undefined` when they justify
 * none — exactly the rule `generate` already applies, exposed so the editor can apply it too.
 *
 * The editor needs this because a contact section cannot be born blank: its `primaryAction` is
 * required (1..1) and is a destination, and there is no honest marker for a destination — which
 * is why `blankSection` in the catalog refuses to make one. Question 5 is the only thing that
 * knows where the button points, so a contact section added from the editor is built from the
 * answers, the same way the generated one was. When the answer names no destination ("que vengan
 * al local", or a field left empty) there is nothing to build, and the editor says so rather
 * than offering a section that would be born with a dead button in it.
 */
export function contactSectionFor(answers: Answers): Section | undefined {
  return buildContact(answers, effectiveSector(answers));
}

/**
 * The footer these answers produce — always one, since it needs only the business name, which
 * question 1 requires. Exposed beside `contactSectionFor` so the editor can offer it back from
 * the "Añadir sección aquí" pill after someone deletes it, without reaching for `blankSection`
 * and getting marker text where ADR 0019 says there must be none.
 */
export function footerSectionFor(answers: Answers): Section {
  return buildFooter(answers);
}

/**
 * The three real compositions, for the "elige por dónde empezar" screen.
 *
 * **One draw without replacement, not three independent ones** (ADR 0036). This was
 * `VARIANTS.map(...)`, and three independent hashes of three seeds put the same photograph on two
 * of the three cards for **39.4% of business names** — 787 of 2000, measured with the nine approved
 * `restaurante-bar` photographs and measured again before this change. About 31% is the floor a
 * perfect hash gives with nine, so the draw was never the defect: independence was. «At least
 * eight per sector» was asked for to prevent exactly this and could not, because a bigger bank
 * makes repetition rarer and never impossible.
 *
 * So the fold, and the fold is the point: the three cards are a property of the screen that shows
 * three, not of any one of them. It stays deterministic — the order is fixed by `VARIANTS`, the
 * walk inside `sampleImageFor` is a pure function of the sorted bank and the ids already taken, and
 * there is no clock and no randomness anywhere in the chain.
 *
 * A sector holds zero photographs or at least eight (ADR 0011, enforced by `bank.test.ts`), so with
 * any bank at all the three cards are now three different photographs. With no bank the three share
 * the catalog's placeholder, which is correct and is why the guarantee is written as «never two the
 * same when the sector has three or more» rather than «eight is enough».
 */
export function generateVariants(answers: Answers): GeneratedSite[] {
  const taken: string[] = [];
  return VARIANTS.map((variant) => {
    const site = generate(answers, variant, taken);
    const chosen = coverSampleOf(site.document);
    if (chosen) taken.push(chosen);
    return site;
  });
}

/**
 * Which bank photograph this document's cover ended up with, or `undefined` for the placeholder.
 *
 * Read back out of the document rather than returned alongside it, because the document is what
 * actually shipped: a `GeneratedSite` field saying «and I chose this» could disagree with the
 * element, and then the fold would be avoiding an id no card is showing. `undefined` degrades to
 * no avoidance, which is this function's behaviour before ADR 0036 — the empty-bank case, where
 * the three placeholders are correct.
 */
function coverSampleOf(document: RetorikaDocument): string | undefined {
  for (const section of document.pages[0]?.sections ?? []) {
    if (section.preset.catalogId !== "cover") continue;
    for (const element of section.content) {
      // Asked of the value and not of the role: `value` is optional on a content element, and the
      // `kind` discriminant is what actually proves there is a `sample` to read.
      const value = element.value;
      if (value?.kind === "image") return value.sample;
    }
  }
  return undefined;
}

function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "negocio" : slug;
}
