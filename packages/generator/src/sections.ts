import {
  CONTACT_ID,
  COVER_ID,
  type CoverVariant,
  FOOTER_ID,
  GALLERY_ID,
  LOCATION_ID,
  SERVICES_ID,
  type ServicesVariant,
} from "@retorika/catalog";
import { actionLabel, type Facts, suggestionsFor, textFor } from "@retorika/copybank";
import { hasSamplePhotos, sampleImageFor } from "@retorika/photobank";
import type { ContentElement, Section } from "@retorika/schema";
import type { Answers, SectorId } from "./answers.ts";
import {
  hasLocationSection,
  LOCATION_SECTION_ID,
  resolveDestination,
  secondaryPhoneDestination,
  visitAnchor,
} from "./destination.ts";

/**
 * `{ciudad}` has no source today. Question 4 collects one free-text address
 * ("Calle Espinel 24, Ronda"), never a separate city — extracting one would be a guess dressed
 * up as data. Every bank text that uses `{ciudad}` has a sibling that does not (ADR 0009), so
 * this is always safe, never a missing text: `ciudad` stays undefined until a real source exists.
 */
function factsFor(answers: Answers): Facts {
  return { negocio: answers.businessName };
}

function heading(id: string, slot: string, value: string): ContentElement {
  return { id, role: "heading", hidden: false, slot, value: { kind: "text", text: value } };
}

function body(id: string, slot: string, value: string): ContentElement {
  return { id, role: "body", hidden: false, slot, value: { kind: "text", text: value } };
}

function link(
  id: string,
  role: "button" | "link",
  slot: string,
  label: string,
  href: string,
): ContentElement {
  return { id, role, hidden: false, slot, value: { kind: "link", text: label, href } };
}

/**
 * The cover always exists: headline and image are the only required slots, and both always
 * resolve — the business name is required by question 1, the image comes from the bank.
 * The main action's button is added only when it resolves to a real destination
 * (`resolveDestination`); the cover's `primaryAction` is optional (0..1), so it is simply absent
 * otherwise, most notably for "visit", which names no destination of its own.
 *
 * `variantId` — `"v1"`/`"v2"`/`"v3"` — rather than the `CoverVariant` composition, because **v1 and
 * v3 are both `image-right`**: seeded on the composition, two of the three cards would offer the
 * identical photograph and the screen that exists to show three real choices would show two.
 */
export function buildCover(
  answers: Answers,
  sector: SectorId,
  variant: CoverVariant,
  variantId: string,
  /**
   * Bank ids the sibling cards have already taken, so this one does not repeat them (ADR 0036).
   * Empty or absent is the ordinary case and behaves exactly as it did before `avoid` existed.
   */
  avoid: readonly string[] = [],
): Section {
  const facts = factsFor(answers);
  const subheadline = textFor(sector, "cover", "subheadline", facts);
  const bodyText = textFor(sector, "cover", "body", facts);
  // An external destination if question 5 named one; otherwise the in-page anchor that "que
  // vengan al local" now has (#19's sibling change — sections carry ids since this sprint's
  // day 2). Still nothing for an answer that names neither.
  const destination = resolveDestination(answers) ?? visitAnchor(answers);
  const actionText = answers.mainAction ? actionLabel(sector, answers.mainAction) : undefined;

  const content: ContentElement[] = [heading("el-headline", "headline", answers.businessName)];
  if (subheadline) {
    content.push({
      id: "el-subheadline",
      role: "subheading",
      hidden: false,
      slot: "subheadline",
      value: { kind: "text", text: subheadline },
    });
  }
  if (bodyText) content.push(body("el-body", "body", bodyText));
  content.push({
    id: "el-image",
    role: "image",
    hidden: false,
    slot: "image",
    // Sampled, and the document says so: a generated site's one photograph is nobody's yet.
    //
    // The bank answers this, and it answers it even when it holds nothing — an empty sector falls
    // back to the catalog's placeholder *inside* `sampleImageFor`, which is why this call site
    // has no fallback of its own and needs none. That is the whole design: the day photographs
    // land in `bank/<sector>.json`, not one line here changes.
    //
    // The seed is everything that already has to be a pure input, and nothing that is not: the
    // business, the sector, which of the three cards, and which element. No clock and no
    // randomness, because `INV_5`, the golden corpus and "same answers, same site" all depend on
    // this function being a pure function of its arguments.
    // The seed is everything that already has to be a pure input, and `avoid` is the sibling
    // cards' choices — which are themselves pure, because the order the three are built in is
    // fixed by `VARIANTS`. ADR 0036: a distinct seed was never a distinct photograph, and three
    // independent hashes of three seeds repeated for 39.4% of business names.
    value: sampleImageFor(
      sector,
      `${answers.businessName}:${sector}:${variantId}:sec-cover:el-image`,
      { avoid },
    ),
  });
  if (destination && actionText) {
    content.push(link("el-cta", "button", "primaryAction", actionText, destination));
  }

  return {
    id: "sec-cover",
    preset: { catalogId: COVER_ID, variantId: variant },
    source: "catalog",
    layout: null,
    content,
  };
}

function buildServiceItem(
  title: string,
  description: string | undefined,
  index: number,
): { id: string; elements: ContentElement[] } {
  const n = index + 1;
  const elements: ContentElement[] = [heading(`el-card-${n}-title`, "title", title)];
  if (description) elements.push(body(`el-card-${n}-description`, "description", description));
  return { id: `item-${n}`, elements };
}

/** Question 3 is skippable, and zero services ticked means no section at all (ADR 0013). */
export function buildServices(
  answers: Answers,
  sector: SectorId,
  variant: ServicesVariant,
): Section | undefined {
  if (answers.services.length === 0) return undefined;
  const facts = factsFor(answers);
  const headline = textFor(sector, "services", "headline", facts) ?? "Qué hacemos";
  const intro = textFor(sector, "services", "intro", facts);

  const content: ContentElement[] = [heading("el-services-headline", "headline", headline)];
  if (intro) content.push(body("el-services-intro", "intro", intro));
  // A ticked suggestion carries its bank description into the card; a service the owner typed
  // themselves gets a title only — its description would be invented (README.md's own rule).
  const suggestions = suggestionsFor(sector);
  content.push({
    id: "el-services",
    role: "list",
    hidden: false,
    slot: "services",
    items: answers.services.map((serviceTitle, index) => {
      const suggestion = suggestions.find((candidate) => candidate.title === serviceTitle);
      return buildServiceItem(serviceTitle, suggestion?.description, index);
    }),
  });

  return {
    id: "sec-services",
    preset: { catalogId: SERVICES_ID, variantId: variant },
    source: "catalog",
    layout: null,
    content,
  };
}

/**
 * Four, not eight (ADR 0039).
 *
 * The catalog allows eight; four is the cap David set when he accepted the gallery, and the ADR
 * carries the reason: every sample photograph that reaches a published page is one more occasion
 * for a restaurateur to publish a dish that is not theirs as their own. Four gives the page the
 * warmth three sessions asked for without turning it into a shop window of somebody else's food.
 * With the cover that is **five** sample photographs per site, and the download warning names each.
 */
export const GALLERY_SAMPLE_COUNT = 4;

/**
 * The bank's gallery — **only for a sector whose bank is filled** (ADR 0039).
 *
 * `undefined` for the ten sectors with no photographs, and it has to be: a gallery born on the
 * catalog's grey marker would publish four markers and four «Escribe aquí de qué es esta foto»,
 * which is a page that looks broken rather than a page with one photograph missing. The cover is
 * the one place a marker is tolerable, because a cover with no photograph is still a cover.
 *
 * **Four draws without replacement, folded through `avoid`** — the shape ADR 0036 said a gallery
 * would need when it was written. `avoid` arrives holding the cover ids this card and its earlier
 * siblings chose, and each draw adds its own, so the four never repeat each other and never repeat
 * a cover on the screen of three. Sibling galleries may overlap (three cards want fifteen
 * photographs from a bank of nine), and the ADR says so rather than pretending otherwise.
 *
 * **The caption is the record's `alt`**, the words a reviewer wrote for that photograph under ADR
 * 0011, and not the catalog's marker four times over: four markers would publish four «Escribe aquí»
 * and add four rows to the owner's list of things to fix for a section they did not ask for. An
 * `alt` describes a scene («Terraza con mesas redondas…»); it is also the one text under a sample
 * photograph that does not claim the photograph is of this business, which is the risk the ADR
 * exists to treat.
 *
 * Seeds follow the cover's shape — business, sector, card, section, element — so `INV_5` holds and
 * the same answers give the same four, in the same order, every time.
 */
export function buildGallery(
  answers: Answers,
  sector: SectorId,
  variantId: string,
  avoid: readonly string[] = [],
): Section | undefined {
  if (!hasSamplePhotos(sector)) return undefined;
  const facts = factsFor(answers);
  const headline = textFor(sector, "gallery", "headline", facts);
  const intro = textFor(sector, "gallery", "intro", facts);
  // The bank's generic file carries both, so this is a loader defect and not a sector's gap; it
  // throws for the same reason an unknown section does — a gallery with no title gets published.
  if (!headline) throw new Error(`buildGallery: no gallery headline in the bank for "${sector}"`);

  const taken = [...avoid];
  const items: { id: string; elements: ContentElement[] }[] = [];
  for (let n = 1; n <= GALLERY_SAMPLE_COUNT; n += 1) {
    const image = sampleImageFor(
      sector,
      `${answers.businessName}:${sector}:${variantId}:sec-gallery:item-${n}`,
      { avoid: taken },
    );
    taken.push(image.sample);
    items.push({
      id: `item-${n}`,
      elements: [
        { id: `el-photo-${n}`, role: "image" as const, hidden: false, slot: "photo", value: image },
        body(`el-caption-${n}`, "caption", image.alt),
      ],
    });
  }

  const content: ContentElement[] = [heading("el-gallery-headline", "headline", headline)];
  if (intro) content.push(body("el-gallery-intro", "intro", intro));
  content.push({ id: "el-gallery", role: "list", hidden: false, slot: "photos", items });

  return {
    id: "sec-gallery",
    // One composition for the three cards: the cards already differ where it shows — the cover and
    // the services — and a gallery's grid flows the same way under either title placement. ADR 0039.
    preset: { catalogId: GALLERY_ID, variantId: "stacked" },
    source: "catalog",
    layout: null,
    content,
  };
}

/** Question 4 is skippable; "no tengo local" and an empty address both mean no section. */
export function buildLocation(answers: Answers, sector: SectorId): Section | undefined {
  if (!hasLocationSection(answers)) return undefined;
  const facts = factsFor(answers);
  const headline = textFor(sector, "location", "headline", facts) ?? "Dónde estamos";

  const content: ContentElement[] = [
    heading("el-location-headline", "headline", headline),
    body("el-address", "address", answers.address.trim()),
  ];
  if (answers.hours.trim() !== "") content.push(body("el-hours", "hours", answers.hours.trim()));
  // The map slot needs latitude/longitude; question 4 collects free text only. Left unfilled
  // rather than guessed — it is optional in the catalog (0..1), the same shape as ADR 0004's
  // other half, still pending a tile provider.

  return {
    id: LOCATION_SECTION_ID,
    preset: { catalogId: LOCATION_ID, variantId: "stacked" },
    source: "catalog",
    layout: null,
    content,
  };
}

/**
 * Only generated when the main action resolves to a real destination: `primaryAction` is
 * required (1..1), so "visit" and an action whose field was left empty produce no section at
 * all, rather than one with a button pointing nowhere.
 */
export function buildContact(answers: Answers, sector: SectorId): Section | undefined {
  const destination = resolveDestination(answers);
  if (!destination || !answers.mainAction) return undefined;
  const facts = factsFor(answers);
  const headline = textFor(sector, "contact", "headline", facts) ?? "Hablamos";
  const bodyText = textFor(sector, "contact", "body", facts);
  const actionText = actionLabel(sector, answers.mainAction) ?? "Contactar";

  const content: ContentElement[] = [heading("el-contact-headline", "headline", headline)];
  if (bodyText) content.push(body("el-contact-body", "body", bodyText));
  content.push(link("el-primary-action", "button", "primaryAction", actionText, destination));

  const secondaryPhone = secondaryPhoneDestination(answers);
  if (secondaryPhone) {
    const phoneLabel = actionLabel(sector, "call") ?? "Llamar";
    content.push(link("el-secondary-phone", "link", "secondaryAction", phoneLabel, secondaryPhone));
  }

  return {
    id: "sec-contact",
    preset: { catalogId: CONTACT_ID, variantId: "stacked" },
    source: "catalog",
    layout: null,
    content,
  };
}

/**
 * Pie de página — always, because the one thing it needs is the one answer the questionnaire
 * insists on.
 *
 * Only the business name is filled. The titular, the NIF, the domicilio and the correo are the
 * owner's to add through the editor's field panel, and ADR 0019 is explicit that they are
 * offered rather than required: nothing here invents them, and nothing here leaves a marker
 * reading "Escribe aquí tu NIF" on a published page.
 */
export function buildFooter(answers: Answers): Section {
  return {
    id: "sec-footer",
    preset: { catalogId: FOOTER_ID, variantId: "stacked" },
    source: "catalog",
    layout: null,
    content: [body("el-businessName", "businessName", `© ${answers.businessName}`)],
  };
}
