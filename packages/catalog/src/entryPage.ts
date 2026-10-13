import type { ContentElement, EntryPageSectionFactory, Section } from "@retorika/schema";
import { blankSection } from "./blank.ts";
import { COVER_ID, COVER_VARIANTS } from "./cover.ts";

/**
 * The one section a page per entry is born with (ADR 0040 §6).
 *
 * A `cover`, because it is the section with a headline, a line under it and a photograph — the
 * shape of a ficha — and because a page without a cover has no `<h1>` of its own. Its headline
 * reads the entry's title field; its body reads the next text field, when the entries carry one;
 * the photograph is the catalog's marker, **the same on every drawn page**, until somebody sets one
 * on the template. A photograph per entry is a field kind the collection does not have, and this
 * does not invent it.
 *
 * Built here and not in `@retorika/schema`, for the reason `teaserSection` is: what a valid section
 * looks like is the catalog's business, and the arrow runs catalog → schema. `addEntryPage` takes
 * this as its factory and parses the result, so a leaf bound to a field no entry carries is refused
 * where it is written.
 *
 * `variantId` is the caller's — the editor hands over the home cover's composition, so the ficha
 * opens the way the site does — and defaults to the first the cover offers.
 */
export function entryPageSection(
  args: Parameters<EntryPageSectionFactory>[0] & { variantId?: string },
): Section {
  const { sectionId, collectionId, titleField, fields } = args;
  const variantId = args.variantId ?? COVER_VARIANTS[0];
  const blank = blankSection(COVER_ID, variantId, sectionId);
  const bodyField = fields.find((field) => field !== titleField);

  const content: ContentElement[] = blank.content.map((element) =>
    element.slot === "headline"
      ? { ...element, binding: { collectionId, field: titleField } }
      : element,
  );
  if (bodyField !== undefined) {
    // `body` is `0..1` on a cover and `blankSection` leaves optional slots out; a bound leaf draws
    // the entry's words, so its own text is empty on purpose — nothing of it is ever published.
    content.push({
      id: "el-body",
      role: "body",
      hidden: false,
      slot: "body",
      value: { kind: "text", text: "" },
      binding: { collectionId, field: bodyField },
    });
  }
  return { ...blank, content };
}
