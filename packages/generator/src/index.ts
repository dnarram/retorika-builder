import {
  parseDocument,
  type RetorikaDocument,
  SCHEMA_VERSION,
  type Section,
} from "@retorika/schema";
import type { Answers, SectorId } from "./answers.ts";
import { buildContact, buildCover, buildLocation, buildServices } from "./sections.ts";
import { themeFor } from "./theme.ts";
import { VARIANTS, type VariantChoice } from "./variants.ts";

export type { Answers, MainAction, SectorId } from "./answers.ts";
export { EMPTY_ANSWERS, SECTOR_IDS } from "./answers.ts";
export type { VariantChoice } from "./variants.ts";
export { VARIANTS } from "./variants.ts";

export interface GeneratedSite {
  document: RetorikaDocument;
  /** Keyed the way `@retorika/publisher`'s `buildSite` expects: "assets/<name>" -> bytes. */
  assets: Map<string, Uint8Array>;
}

/**
 * "Otro sector" reads the bank's generic file, same as any of the seven launch sectors with no
 * file of their own — the cascade in `@retorika/copybank` already falls back to `generico`.
 */
function effectiveSector(answers: Answers): SectorId {
  return answers.sector ?? "otro";
}

/**
 * The five answers, one chosen composition, and a real `RetorikaDocument` — validated the way
 * every other document in this repository is, so a generator bug fails loudly here rather than
 * publishing a broken site.
 */
export function generate(answers: Answers, variant: VariantChoice = VARIANTS[0]): GeneratedSite {
  const sector = effectiveSector(answers);
  const cover = buildCover(answers, sector, variant.cover);
  const services = buildServices(answers, sector, variant.services);
  const location = buildLocation(answers, sector);
  const contact = buildContact(answers, sector);

  const sections = [cover, services, location, contact].filter((s) => s !== undefined);

  const document: RetorikaDocument = {
    schemaVersion: SCHEMA_VERSION,
    id: `doc-${slugify(answers.businessName)}`,
    siteName: answers.businessName,
    theme: themeFor(sector),
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

  // Nothing to add: the placeholder image is a data: URI, self-contained in the document
  // itself, needing no separate asset entry — see @retorika/catalog’s placeholder-image.ts.
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

/** The three real compositions, for the "elige por dónde empezar" screen. */
export function generateVariants(answers: Answers): GeneratedSite[] {
  return VARIANTS.map((variant) => generate(answers, variant));
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
