import { COVER_ID, TEASER_ID } from "@retorika/catalog";
import type { Page } from "@retorika/schema";

/**
 * Which sections of a page carry its `<h1>`.
 *
 * **Extracted in sprint 23 because two files now need the same answer.** `build.ts` has always
 * needed it to choose between `<h1>` and `<h2>`; since the menu split in two (ADR 0043),
 * `menu.ts` needs it as well, to know which section is the top of the page and therefore lends no
 * anchor to the sections menu. Two copies of a rule that must agree is a defect waiting for the
 * day somebody changes one of them.
 *
 * The rule itself is unchanged, and it is two clauses:
 *
 * - **A page with a cover: every cover section is h1.** Including a free section built on the cover
 *   preset, which `hidden-and-embed` in the golden corpus tests deliberately.
 * - **A page with no cover at all** — a converted page, since ADR 0022 forbids converting the
 *   cover — promotes its first section, which used to publish with no h1 at all and axe marks.
 *   **A teaser is skipped when choosing**: its heading is borrowed from another page, and
 *   promoting it would make this page claim to be about somewhere else. A page that is nothing but
 *   teasers falls back to its very first section, because one borrowed h1 still beats none.
 */
export function h1SectionIds(page: Page): ReadonlySet<string> {
  const covers = page.sections.filter((section) => section.preset.catalogId === COVER_ID);
  if (covers.length > 0) return new Set(covers.map((section) => section.id));

  const fallback =
    page.sections.find((section) => section.preset.catalogId !== TEASER_ID) ?? page.sections[0];
  return new Set(fallback ? [fallback.id] : []);
}
