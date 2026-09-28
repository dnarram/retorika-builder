import { hrefForPage, listLinksTo } from "./destinations.ts";
import type { ContentElement, Page, RetorikaDocument, Section } from "./document.ts";
import { parseDocument } from "./parse.ts";
import { findSection, mintSectionId } from "./sections.ts";
import { mintSlug } from "./slug.ts";

/**
 * A section becomes a page, and a page folds back into a section.
 *
 * The concept dossier §6 is the whole specification, and ADR 0022 is what settled it: **a page is
 * born by converting a section**, never by a «+ Añadir página» that would create an empty one. So
 * there is no `addPage` in `pages.ts` and the verb that makes a page lives here, beside its inverse.
 *
 * > «Cualquier sección puede convertirse en página. La aplicación mueve el contenido, deja un
 * > resumen con un enlace en la página de inicio y crea la página nueva. […] Y se puede deshacer.»
 *
 * **One step, not three.** `sectionToPage` takes the section out, creates the page, puts the
 * section on it and leaves an avance behind, and returns one document. The editor's history sees a
 * single change, so one «Deshacer» takes back the page *and* the avance together — which is what
 * the dossier's last sentence asks for, and what three separate verbs could never give.
 */

/**
 * How many pages a site may have.
 *
 * Five, which is what `/api/download` has accepted since it was written. It lived there alone while
 * nothing could create a second page; now that something can, the verb that creates them has to
 * know the number too — a sixth page would be built, saved, and then refused at the moment of
 * download, which is the failure this sprint has been moving rules upstream to avoid.
 */
export const MAX_PAGES = 5;

/**
 * The sections that are not the owner's to convert, and why each one is not.
 *
 * - **The cover** is the page's `<h1>` and the promise the site opens with. A home page without one
 *   has nothing at the top and no h1 at all, which axe marks; and a page *made* of a cover would be
 *   a second front door.
 * - **The footer** is chrome, repeated on every page by ADR 0023. A page consisting of a footer is
 *   not a page anybody asked for.
 * - **An avance** is already a reference to a page. Converting one would make a page whose only
 *   content is a link to another page.
 */
const UNCONVERTIBLE: ReadonlySet<string> = new Set(["cover", "footer", "teaser"]);

/** What the caller must build for us: the avance left where the section was. It comes from the
 * catalog, because what a valid section of a given kind looks like is the catalog's business and
 * the dependency arrow runs catalog → schema — the same division `insertSection` makes. */
export type TeaserFactory = (args: {
  sectionId: string;
  href: string;
  pageTitle: string;
}) => Section;

/** A page id not already in use, derived from the slug so the two read alike in a debug dump. */
function mintPageId(doc: RetorikaDocument, slug: string): string {
  const used = new Set(doc.pages.map((page) => page.id));
  const root = `page-${slug}`;
  if (!used.has(root)) return root;
  let suffix = 2;
  while (used.has(`${root}-${suffix}`)) suffix += 1;
  return `${root}-${suffix}`;
}

/**
 * The words a converted page is named by: the section's own heading.
 *
 * The heading is what the owner already wrote and already sees at the top of that section, so a
 * page made from it arrives called the same thing — nothing to name, nothing to confirm. Falls back
 * to the site name only when the section has no visible heading at all, which `mintSlug` then turns
 * into a usable slug or into `pagina`.
 */
function titleForSection(section: Section, fallback: string): string {
  const heading = section.content.find(
    (el) =>
      !el.hidden &&
      el.role === "heading" &&
      el.value?.kind === "text" &&
      el.value.text.trim() !== "",
  );
  return heading?.value?.kind === "text" ? heading.value.text.trim() : fallback;
}

/**
 * A section moved onto a page of its own, with an avance left in its place.
 *
 * Refuses rather than guessing, in every case where carrying on would produce something the owner
 * would have to repair: an unknown section, one of the three kinds that may not be converted, and a
 * sixth page. The page cap is enforced here and not only on the button that will offer this in day
 * 6, because a button is a courtesy and this is the rule.
 */
export function sectionToPage(
  doc: RetorikaDocument,
  sectionId: string,
  makeTeaser: TeaserFactory,
): RetorikaDocument {
  const found = findSection(doc, sectionId);
  if (!found) throw new Error(`sectionToPage: no section "${sectionId}"`);

  const catalogId = found.section.preset.catalogId;
  if (UNCONVERTIBLE.has(catalogId)) {
    throw new Error(`sectionToPage: a "${catalogId}" section cannot become a page`);
  }
  if (doc.pages.length >= MAX_PAGES) {
    throw new Error(`sectionToPage: a site may have ${MAX_PAGES} pages, and this one already does`);
  }

  const title = titleForSection(found.section, doc.siteName);
  const slug = mintSlug(
    title,
    doc.pages.map((page) => page.slug),
  );
  const pageId = mintPageId(doc, slug);
  const newPage: Page = { id: pageId, slug, title, sections: [found.section] };

  const href = hrefForPage(newPage);
  // **The section keeps its own id and the avance gets a new one.** The other way round was tried
  // first and the schema refused it outright: two sections cannot share an id (rule 5), and the
  // section that moved is still the same section — its id is what its own layout, its anchors and
  // any future link into the page are written against.
  const teaser = makeTeaser({
    sectionId: mintSectionId(doc, "sec-avance"),
    href,
    pageTitle: title,
  });

  return parseDocument({
    ...doc,
    pages: [
      ...doc.pages.map((page) =>
        retarget(
          page.id === found.page.id
            ? {
                ...page,
                sections: page.sections.map((section) =>
                  section.id === sectionId ? teaser : section,
                ),
              }
            : page,
          `#${sectionId}`,
          href,
        ),
      ),
      newPage,
    ],
  });
}

/**
 * Every visible link on a page that pointed at `from`, pointed at `to` instead.
 *
 * This is what keeps a conversion from breaking the owner's own buttons. A «Ver la carta» button on
 * the home page says `#sec-prices`; the moment that section moves to a page of its own, the anchor
 * resolves to nothing — and since sprint 5 day 4 `listDeadDestinations` correctly says so, which
 * would mean converting a section silently blocked the download until the owner found and fixed a
 * button they never touched. Rewriting is the only answer that leaves the site working: the button
 * still goes where its words promise, which is now a page rather than a place on this one.
 *
 * Hidden links are rewritten too, unlike everywhere else in this package. A hidden element is one
 * rule 3 kept so the place to fill it in survives, and it would come back pointing at a section
 * that is no longer here.
 */
function retarget(page: Page, from: string, to: string): Page {
  const rewrite = (element: ContentElement): ContentElement => {
    if (element.items) {
      return {
        ...element,
        items: element.items.map((item) => ({ ...item, elements: item.elements.map(rewrite) })),
      };
    }
    if (element.value?.kind !== "link" || element.value.href.trim() !== from) return element;
    return { ...element, value: { ...element.value, href: to } };
  };
  return {
    ...page,
    sections: page.sections.map((section) => ({
      ...section,
      content: section.content.map(rewrite),
    })),
  };
}

/**
 * A page folded back into the section it came from — the dossier's «se puede deshacer» as a verb
 * rather than only as Ctrl+Z.
 *
 * The page's sections go back where the avance is, in order, and both the avance and the page are
 * gone. More than one section comes back when the owner added some to the page after converting;
 * they arrive together, which is the only reading that loses nothing.
 *
 * **Refuses a page no avance points at**, and that is a decision rather than a gap. The verb means
 * "undo this conversion", and without the avance there is no conversion left to undo and no place
 * the sections belong — putting them somewhere chosen by this function would be inventing an answer
 * the owner never gave. A page in that state is deleted with `deletePage`, which already exists and
 * already says what it does.
 */
export function pageToSection(doc: RetorikaDocument, pageId: string): RetorikaDocument {
  const page = doc.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`pageToSection: no page "${pageId}"`);
  if (doc.pages[0]?.id === pageId) {
    throw new Error(`pageToSection: "${pageId}" is the first page, which is the site's entry`);
  }

  const teasers = listLinksTo(doc, pageId).filter(
    (link) => findSection(doc, link.sectionId)?.section.preset.catalogId === "teaser",
  );
  const teaser = teasers[0];
  if (!teaser) {
    throw new Error(
      `pageToSection: nothing points at "${pageId}", so there is no conversion to undo — use deletePage`,
    );
  }

  // The anchor the sections go back to being reachable by, which is the inverse of the rewrite
  // `sectionToPage` did on the way out: a button that was turned from `#sec-prices` into
  // `./nuestra-carta.html` is turned back, so folding a conversion away restores the document it
  // came from rather than something equivalent-looking with a link left pointing at a dead file.
  const first = page.sections[0];
  const backTo = first ? `#${first.id}` : "";

  return parseDocument({
    ...doc,
    pages: doc.pages
      .filter((candidate) => candidate.id !== pageId)
      .map((candidate) => {
        const folded =
          candidate.id === teaser.pageId
            ? {
                ...candidate,
                sections: candidate.sections.flatMap((section) =>
                  section.id === teaser.sectionId ? page.sections : [section],
                ),
              }
            : candidate;
        return backTo === "" ? folded : retarget(folded, hrefForPage(page), backTo);
      }),
  });
}
