import type { Page, RetorikaDocument } from "./document.ts";
import { flattenElements } from "./invariants.ts";
import type { Role } from "./roles.ts";
import { SLUG_PATTERN } from "./slug.ts";

/**
 * Buttons and links that point nowhere.
 *
 * A published site is a file on someone's disk with no server behind it (ADR 0001), so a button
 * whose `href` is empty or `#` does not degrade — it is simply dead, and the visitor who presses
 * it learns the business does not work. That is different in kind from marker text, which is
 * visible, embarrassing and fixable by the owner in a second; so this blocks the download and
 * marker text only warns.
 *
 * Only visible elements count. The renderer drops a hidden element entirely
 * (`packages/renderer/src/build.ts`), so a hidden dead link never reaches the published page and
 * refusing over one would be refusing over something nobody can see — rule 3 keeps a hidden
 * element around precisely so the place to fill it in still exists.
 */

/** `#` is what `safeUrl` neutralises a dangerous scheme to, and what a hand-written placeholder
 * href usually is. Either way it navigates nowhere. An empty href re-loads the current page. */
const DEAD_HREFS: ReadonlySet<string> = new Set(["", "#"]);

/**
 * A link from one published page to another: `./precios.html`, optionally with a fragment.
 *
 * The shape is not ours to widen — `docs/tasks/publisher.md` calls the bundle layout "decided — do
 * not improvise", because a link has to resolve identically from `file://` and from a server, and
 * `./precios.html` does where `/precios` and `/precios/` do not. Written here as the same rule
 * `packages/publisher` writes files by; the slug half defers to `SLUG_PATTERN` so there is one
 * answer to "what may a page be called" rather than two that can drift.
 *
 * Deliberately loose about what sits between `./` and `.html`, and strict afterwards: anything
 * shaped like a link into this bundle is *judged*, and `SLUG_PATTERN` then decides whether it names
 * something a page could ever be called. `./../fuera.html` matches the shape, fails the pattern and
 * is dead — where a narrower expression would not have matched at all and would have waved a walk
 * out of the bundle straight through the gate.
 */
const INTERNAL_PAGE = /^\.\/([^#]+)\.html(?:#(.*))?$/;

/** What a link can resolve to: which sections each page holds, and which page each slug names. */
interface Reachable {
  sectionsByPage: ReadonlyMap<string, ReadonlySet<string>>;
  pageBySlug: ReadonlyMap<string, string>;
}

function reachable(doc: RetorikaDocument): Reachable {
  const sectionsByPage = new Map<string, ReadonlySet<string>>();
  const pageBySlug = new Map<string, string>();
  for (const page of doc.pages) {
    sectionsByPage.set(page.id, new Set(page.sections.map((section) => section.id)));
    pageBySlug.set(page.slug, page.id);
  }
  return { sectionsByPage, pageBySlug };
}

/**
 * Whether this href goes nowhere, judged from the page the link is written on.
 *
 * Two of the three cases arrived with pages (sprint 5 day 4), and both were live defects that
 * could not fire while every document had exactly one page:
 *
 * - **An anchor resolves only within its own page.** This used to ask whether the section existed
 *   *anywhere* in the document, which is the same question while there is one page and the wrong
 *   one afterwards: a button on the home page pointing at `#sec-carta`, whose section now lives on
 *   a converted page, is a link that does nothing — and it passed.
 * - **A link to another page is judged at all.** Anything not starting with `#` used to return
 *   `false` unconditionally, so `./precios.html` pointing at a page that does not exist sailed
 *   through the download gate. That is the exact shape this sprint creates by the dozen: a teaser
 *   whose page was deleted. `./precios.html#sec-x` is judged twice over — the page must exist and
 *   the section must be *on that page*.
 *
 * Everything else is still not ours to resolve: an `https:` to another site, a `tel:` or a
 * `mailto:` has no fragment and no bundle path to check. Deliberately not extended to bare
 * relative paths like `precios.html`: nothing in this repository emits one, and refusing them here
 * would block a download over a shape no test has ever produced.
 */
function isDead(href: string, pageId: string, links: Reachable): boolean {
  const trimmed = href.trim();
  if (DEAD_HREFS.has(trimmed)) return true;

  if (trimmed.startsWith("#")) {
    return !links.sectionsByPage.get(pageId)?.has(trimmed.slice(1));
  }

  const internal = INTERNAL_PAGE.exec(trimmed);
  if (!internal) return false;

  const slug = internal[1] ?? "";
  if (!SLUG_PATTERN.test(slug)) return true;
  const target = links.pageBySlug.get(slug);
  if (target === undefined) return true;

  const fragment = internal[2];
  if (fragment === undefined) return false;
  return !links.sectionsByPage.get(target)?.has(fragment);
}

export interface DeadDestination {
  pageId: string;
  sectionId: string;
  elementId: string;
  slot: string;
  role: Role;
  /** The label the visitor would press, which is how a person recognises which button it is. */
  text: string;
}

export function listDeadDestinations(doc: RetorikaDocument): DeadDestination[] {
  const links = reachable(doc);
  const dead: DeadDestination[] = [];
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        if (element.hidden) continue;
        const value = element.value;
        if (value?.kind !== "link") continue;
        if (!isDead(value.href, page.id, links)) continue;
        dead.push({
          pageId: page.id,
          sectionId: section.id,
          elementId: element.id,
          slot: element.slot,
          role: element.role,
          text: value.text,
        });
      }
    }
  }
  return dead;
}

/**
 * The visible links pointing at this section, by its anchor.
 *
 * Read before a delete, not after: once the section is gone the buttons that named it are dead
 * (`listDeadDestinations` will say so at download time), but the moment worth telling the user
 * about is the one where undo is still on screen. ADR 0014 forbids asking first; nothing forbids
 * saying what just happened.
 */
export function listAnchorsTo(doc: RetorikaDocument, sectionId: string): DeadDestination[] {
  const target = `#${sectionId}`;
  return linksMatching(doc, (href) => href === target);
}

/**
 * The visible links pointing at this page, whether or not they aim at a section inside it.
 *
 * The page counterpart of `listAnchorsTo`, and the one `pages.ts` has been promising in a comment
 * since day 1: "what the editor owes the person is the count of what pointed here, said *before*
 * the delete while «Deshacer» is still on screen". Deleting a page that three teasers point at has
 * to be able to say "three", and it has to say it while undo is on screen — afterwards the links
 * are merely dead, which `listDeadDestinations` will report at download time, far too late to be
 * the thing that changes anyone's mind.
 *
 * Matches `./<slug>.html` and `./<slug>.html#anything`: a link into a section of the page still
 * points at the page, and dies with it just the same.
 */
export function listLinksTo(doc: RetorikaDocument, pageId: string): DeadDestination[] {
  const page = doc.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new Error(`listLinksTo: no page "${pageId}"`);
  return linksMatching(doc, (href) => INTERNAL_PAGE.exec(href)?.[1] === page.slug);
}

/** Every visible link whose trimmed href the predicate accepts. */
function linksMatching(
  doc: RetorikaDocument,
  accepts: (href: string) => boolean,
): DeadDestination[] {
  const pointing: DeadDestination[] = [];
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        if (element.hidden) continue;
        const value = element.value;
        if (value?.kind !== "link" || !accepts(value.href.trim())) continue;
        pointing.push({
          pageId: page.id,
          sectionId: section.id,
          elementId: element.id,
          slot: element.slot,
          role: element.role,
          text: value.text,
        });
      }
    }
  }
  return pointing;
}

/** The href a link must carry to reach this page from any other. */
export function hrefForPage(page: Pick<Page, "slug">): string {
  return `./${page.slug}.html`;
}
