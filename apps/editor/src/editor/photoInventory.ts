import { PLACEHOLDER_SAMPLE_ID, presetFor } from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import { type ElementAddress, flattenElements, type RetorikaDocument } from "@retorika/schema";

/**
 * Every photograph in the site, and which of them are not the owner's yet.
 *
 * **A separate module rather than logic inside `PhotosPanel`, and the reason is the test
 * environment.** `vitest.config.ts` gives `apps/editor` a node project with no DOM, so a component
 * cannot be unit-tested here at all — the same split `sectionFields.ts` already makes for
 * `FieldsPanel`. Everything worth asserting lives here, where it can be; the panel that draws it is
 * covered by the browser walk and the e2e.
 *
 * The other reason is that two surfaces ask the same question. The panel lists the photographs and
 * the warning before a download counts them, and if each counted for itself they could disagree —
 * which, for a warning whose whole job is to be believed, is the one defect worth designing out.
 */

/**
 * Where a photograph stands.
 *
 * Three states rather than two, and the third is what the empty bank makes necessary. «Foto de
 * ejemplo» over the grey rectangle that already reads «Tu foto aquí» would be a label on a label,
 * and telling an owner that a visitor «puede pensar que sí» about a photograph that is visibly a
 * placeholder is simply false. So the marker is its own state, and the panel and the warning say
 * different things about it.
 */
export type PhotoState = "empty" | "sample" | "own";

export interface PhotoEntry extends ElementAddress {
  pageId: string;
  /** The page's own title, which is what the owner sees in the tabs. */
  pageTitle: string;
  /** The catalog's Spanish name for the section — «Portada», «Fotos de trabajos». */
  sectionName: string;
  /** Which photograph of a list it is, one-based, for a section that holds several. */
  itemNumber?: number;
  src: string;
  alt: string;
  state: PhotoState;
}

function stateOf(sample: string | undefined): PhotoState {
  if (sample === undefined) return "own";
  return sample === PLACEHOLDER_SAMPLE_ID ? "empty" : "sample";
}

function sectionNameOf(catalogId: string): string {
  const key = `section.${catalogId}.name` as keyof typeof catalogEs;
  return catalogEs[key] ?? catalogId;
}

/**
 * Every image the document holds, in the order the owner scrolls past them: page order, then
 * section order, then element order.
 *
 * `flattenElements` rather than a walk over `section.content`, because a gallery's photographs live
 * inside list items — and every walk in this repository that forgot to look there has been a
 * defect, three of them in one day of sprint 5 alone.
 *
 * Hidden elements are included. Rule 3 keeps a hidden element so the place to fill it in survives,
 * and a photograph the owner has hidden is still a photograph they may want to change; leaving it
 * out would make the panel quietly incomplete, which is the one thing it exists not to be.
 */
export function listPhotos(doc: RetorikaDocument): PhotoEntry[] {
  const photos: PhotoEntry[] = [];

  for (const page of doc.pages) {
    for (const section of page.sections) {
      let sectionName: string;
      try {
        sectionName = sectionNameOf(presetFor(section.preset.catalogId).catalogId);
      } catch {
        // A free section, or one the catalog does not know. Its own id is the honest answer.
        sectionName = section.id;
      }

      // Item numbers are counted per list, so a gallery reads «Foto 1», «Foto 2» and not the
      // element's position among everything in the section.
      const itemOf = new Map<string, number>();
      for (const element of section.content) {
        element.items?.forEach((item, index) => {
          for (const nested of flattenElements(item.elements)) itemOf.set(nested.id, index + 1);
        });
      }

      for (const element of flattenElements(section.content)) {
        if (element.value?.kind !== "image") continue;
        const itemNumber = itemOf.get(element.id);
        photos.push({
          pageId: page.id,
          pageTitle: page.title,
          sectionId: section.id,
          sectionName,
          elementId: element.id,
          ...(itemNumber === undefined ? {} : { itemNumber }),
          src: element.value.src,
          alt: element.value.alt,
          state: stateOf(element.value.sample),
        });
      }
    }
  }

  return photos;
}

export interface PhotoCounts {
  /** Still the catalog's grey marker: no photograph at all yet. */
  empty: number;
  /** A real photograph from the bank, which is not this business's. */
  sample: number;
  /** The owner's own. */
  own: number;
  total: number;
}

/** The same list, counted. The panel's header and the warning before a download both read this,
 * so the two can never disagree about how many photographs are still not the owner's. */
export function countPhotos(doc: RetorikaDocument): PhotoCounts {
  const counts: PhotoCounts = { empty: 0, sample: 0, own: 0, total: 0 };
  for (const photo of listPhotos(doc)) {
    counts[photo.state] += 1;
    counts.total += 1;
  }
  return counts;
}
