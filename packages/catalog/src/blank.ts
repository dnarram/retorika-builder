import type { ContentElement, ContentValue, PresetSlot, Section } from "@retorika/schema";
import es from "./locales/es.json" with { type: "json" };
import { PLACEHOLDER_IMAGE_ALT, placeholderImageSrc } from "./placeholder-image.ts";
import { presetFor, variantsFor } from "./presets.ts";

/**
 * An empty section that is nevertheless valid against its own preset.
 *
 * "Empty" cannot mean empty: `cover` requires an image (1..1) and `services` requires a list
 * (1..1), so a section with no elements would fail `checkAgainstPreset` the moment it was
 * inserted. Nor can a required slot be filled with an empty string — that publishes `<h1></h1>`
 * inside the client's ZIP — or with `hidden: true`, which would leave an invisible band the user
 * cannot click to fill in. So every required slot gets real Spanish marker text, from this
 * package's own locale file like all interface text in this repository.
 *
 * That text is the honest cost of the feature: a section added and never touched publishes
 * "Escribe aquí tu titular" as its heading. The editor warns about exactly that and does not
 * block on it — marker text is a matter of taste, which the owner can see and fix, unlike a
 * button pointing nowhere.
 */

/** The marker strings, as a set: what `isPlaceholderText` recognises and the editor counts. */
const PLACEHOLDER_TEXTS: ReadonlySet<string> = new Set(
  Object.entries(es)
    .filter(([key]) => key.includes(".placeholder."))
    .map(([, text]) => text),
);

/**
 * Whether a text is still one of this package's own markers, compared by value.
 *
 * By value and not by a flag on the element, deliberately: a flag would be a new key in the
 * document schema — rejected by its strict shape, and needing a migration — to record something
 * the text already says. The cost is that a user who types a marker's exact words back in is
 * counted as not having changed it, which is a warning being over-cautious about a sentence
 * nobody writes on purpose.
 */
export function isPlaceholderText(text: string): boolean {
  return PLACEHOLDER_TEXTS.has(text.trim());
}

/**
 * The roles a marker can honestly fill. `button` and `link` are the ones that matter by their
 * absence: their value is a destination, and there is no marker for a destination — an empty
 * `href` is not a placeholder, it is a broken link, and the download route refuses a document
 * carrying one. The catalog has no idea where a given business wants its button to point, so it
 * declines rather than guessing.
 */
function canFill(role: PresetSlot["role"], preset: { itemSlots?: readonly PresetSlot[] }): boolean {
  switch (role) {
    case "heading":
    case "subheading":
    case "body":
    case "image":
      return true;
    case "list":
      return (preset.itemSlots ?? []).every((slot) => slot.min === 0 || canFill(slot.role, {}));
    default:
      return false;
  }
}

/** The marker text for a slot, or an error naming the locale key that has to exist. */
function placeholderFor(catalogId: string, path: string): string {
  const key = `section.${catalogId}.placeholder.${path}` as keyof typeof es;
  const text = es[key];
  if (!text) {
    throw new Error(
      `blankSection: no marker text for "${catalogId}" slot "${path}" — add "${key}" to the catalog locale`,
    );
  }
  return text;
}

function valueForRole(role: PresetSlot["role"], marker: () => string): ContentValue | undefined {
  switch (role) {
    case "heading":
    case "subheading":
    case "body":
      return { kind: "text", text: marker() };
    case "image":
      return { kind: "image", src: placeholderImageSrc(), alt: PLACEHOLDER_IMAGE_ALT };
    default:
      return undefined;
  }
}

/**
 * The elements one slot is born with: `min` of them, none for an optional slot.
 *
 * `idPrefix` and `keyPrefix` are what let this run unchanged for a slot of the section and for a
 * slot of a list item. Ids must not collide across the two — rule 5 scopes element-id uniqueness
 * to the whole section, items included — and the locale keys are separate for the same reason a
 * card's "Nombre" is not the section's "Título".
 */
function elementsForSlot(
  catalogId: string,
  slot: PresetSlot,
  itemSlots: readonly PresetSlot[] | undefined,
  idPrefix: string,
  keyPrefix: string,
): ContentElement[] {
  const elements: ContentElement[] = [];

  for (let occurrence = 0; occurrence < slot.min; occurrence += 1) {
    const suffix = occurrence === 0 ? "" : `-${occurrence + 1}`;
    const base = { id: `${idPrefix}${slot.slot}${suffix}`, role: slot.role, hidden: false };

    if (slot.role === "list") {
      if (!itemSlots) {
        throw new Error(
          `blankSection: "${catalogId}" requires slot "${slot.slot}" to hold a list, but its preset declares no itemSlots`,
        );
      }
      // One item, never more: how many a list wants is the section's own business (ADR 0013
      // puts "Qué hago" at 1..6), and one is the smallest thing that is both valid against the
      // preset and visibly a list the user can see and fill in.
      elements.push({
        ...base,
        slot: slot.slot,
        items: [
          {
            id: "item-1",
            elements: itemSlots.flatMap((itemSlot) =>
              elementsForSlot(catalogId, itemSlot, undefined, "el-item-1-", "item."),
            ),
          },
        ],
      });
      continue;
    }

    const value = valueForRole(slot.role, () =>
      placeholderFor(catalogId, `${keyPrefix}${slot.slot}`),
    );
    if (!value) {
      throw new Error(
        `blankSection: "${catalogId}" slot "${slot.slot}" has role "${slot.role}", which no marker can fill honestly`,
      );
    }
    elements.push({ ...base, slot: slot.slot, value });
  }

  return elements;
}

/**
 * A section of this catalog id and variant, filled only where its preset insists.
 *
 * Optional slots are left out on purpose. Filling them too would mean more marker text for the
 * user to find and clear, in return for nothing the preset needs — and a subheading nobody asked
 * for reads as an invitation to write one, which is a different feature.
 *
 * `layout` is null, meaning "use the preset's own", the same as every section the generator
 * produces. The id is the caller's to choose, since only the document knows which are free;
 * `mintSectionId` in `@retorika/schema` is what produces one.
 *
 * Throws for a section no marker can fill — `contact`, whose `primaryAction` is required and is a
 * destination. `canBeBlank` answers that without provoking the throw.
 */
export function blankSection(catalogId: string, variantId: string, sectionId: string): Section {
  const preset = presetFor(catalogId);
  const variants = variantsFor(catalogId);
  if (!variants.includes(variantId)) {
    throw new Error(
      `blankSection: "${catalogId}" has no variant "${variantId}". Known: ${variants.join(", ")}`,
    );
  }

  // Checked before anything is built, so the refusal names the real reason. Left to surface
  // from inside the walk it would come out as whichever required slot happened to be missing a
  // locale key first — true, but an invitation to add that key and make a section that cannot
  // honestly exist.
  const unfillable = preset.slots.find((slot) => slot.min > 0 && !canFill(slot.role, preset));
  if (unfillable) {
    throw new Error(
      `blankSection: "${catalogId}" requires slot "${unfillable.slot}" (role "${unfillable.role}"), which no marker can fill honestly`,
    );
  }

  return {
    id: sectionId,
    preset: { catalogId, variantId },
    source: "catalog",
    layout: null,
    content: preset.slots.flatMap((slot) =>
      elementsForSlot(catalogId, slot, preset.itemSlots, "el-", ""),
    ),
  };
}

/**
 * Whether this catalog section can be born blank at all.
 *
 * False for one whose preset requires a destination only the questionnaire's answers know. The
 * editor asks this to decide what the "Añadir sección aquí" pill may offer; `contact` is offered
 * from the generator's own `contactSectionFor` instead, which does know where the button points.
 */
export function canBeBlank(catalogId: string): boolean {
  const preset = presetFor(catalogId);
  return preset.slots.every((slot) => slot.min === 0 || canFill(slot.role, preset));
}
