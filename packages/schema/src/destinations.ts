import type { ContentElement, Page, RetorikaDocument } from "./document.ts";
import { flattenElements } from "./invariants.ts";
import { mapHref } from "./map.ts";
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
 * **The closed list of what is dead** (sprint 42 día 1, David's adjustment 1a): the schemes the
 * renderer neutralises to `#` (`safeUrl`, `escape.ts`) and the one that cannot leave the visitor's
 * own disk. Everything else with something after the colon is alive — `geo:`, `whatsapp:`, `tg:`,
 * `facetime:`, `sms:`, an `https:` to another site — because the gate cannot resolve it and a list
 * that said «everything else is dead» would block downloads that work today.
 */
const DEAD_SCHEMES: ReadonlySet<string> = new Set(["javascript", "data", "vbscript", "file"]);

/** `scheme:` at the start of an href, as RFC 3986 spells a scheme: a letter, then letters, digits,
 * `+`, `-` or `.`. `612 345 678` and `hola@bar.es` have none, which is how they are told apart. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/** The file extensions a bundle or a disk could hold, so `precios.html` is a relative path and
 * never a domain called «precios» in the «html» country. */
const NOT_A_TLD: ReadonlySet<string> = new Set([
  "html",
  "htm",
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "svg",
  "css",
  "js",
  "json",
  "zip",
  "txt",
]);

/**
 * What a destination typed without a scheme was meant to be, in exactly three shapes — and
 * nothing else (sprint 42 día 1, decision *a*: guessing more is guessing wrong):
 *
 * - digits, with `+`, spaces, dots, hyphens or parentheses between them → `tel:` and the digits,
 *   the leading `+` kept — the generator's own spelling (`generator/src/destination.ts`), with no
 *   country code invented;
 * - one `@` with something on both sides and a dot after it → `mailto:`;
 * - `dominio.tld`, with or without `www.` and a path → `https://`.
 *
 * `null` when the text already carries a scheme, is an anchor or a bundle link (nothing to
 * normalise), or is not one of the three (nothing understood: `isDead` then calls it what it is).
 */
export function normaliseDestination(raw: string): string | null {
  const text = raw.trim();
  if (text === "" || text.startsWith("#") || text.startsWith("./") || text.startsWith("/")) {
    return null;
  }
  if (SCHEME.test(text)) return null;

  const digits = text.replace(/[\s().-]/g, "");
  if (/^\+?\d{6,15}$/.test(digits)) return `tel:${digits}`;

  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/.]+$/.test(text)) return `mailto:${text}`;

  const domain = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.([a-z]{2,})(?:[/?#]\S*)?$/i.exec(text);
  if (domain && !NOT_A_TLD.has((domain[1] ?? "").toLowerCase())) return `https://${text}`;

  return null;
}

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
    // A page per entry is reached by its entries' slugs, never by its own (ADR 0040): each entry
    // is a file named after its slug, holding the template's sections, and no file is ever
    // written under the template's own slug — a link to it would be a 404 on disk.
    const binding = page.binding;
    if (!binding) {
      pageBySlug.set(page.slug, page.id);
      continue;
    }
    const collection = doc.collections.find((candidate) => candidate.id === binding.collectionId);
    for (const entry of collection?.entries ?? []) {
      if (entry.slug !== undefined) pageBySlug.set(entry.slug, page.id);
    }
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
 * **A scheme is judged by the closed list** (`DEAD_SCHEMES`), and by whether anything follows
 * the colon: `tel:+34612345678` and `geo:36.7,-5.1` are alive, `mailto:` alone is not. **A bare
 * relative path is dead** (`precios.html`, `612 345 678`, `hola@bar.es`): the bundle holds no file
 * under it, so from `file://` the visitor lands on `…/612 345 678`. This paragraph used to say the
 * opposite — «nothing in this repository emits one» — and it was never true: «Campos» has written
 * whatever the owner typed into «A dónde lleva» since sprint 3 día 4 (`route.ts` said so, this
 * file did not). Sprint 42 día 1 measured it in the ZIP and closed the gap; `normaliseDestination`
 * is the half that turns the three shapes people actually type into links that work.
 */
function isDead(href: string, pageId: string, links: Reachable): boolean {
  const trimmed = href.trim();
  if (DEAD_HREFS.has(trimmed)) return true;

  if (trimmed.startsWith("#")) {
    return !links.sectionsByPage.get(pageId)?.has(trimmed.slice(1));
  }

  const scheme = SCHEME.exec(trimmed);
  if (scheme) {
    if (DEAD_SCHEMES.has((scheme[1] ?? "").toLowerCase())) return true;
    return trimmed.length === scheme[0].length;
  }

  const internal = INTERNAL_PAGE.exec(trimmed);
  if (!internal) return true;

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
  /** What the link says it leads to, trimmed, so the dialog can show «612 345 678» beside the
   * button's words. Empty for the header's button and for a map, whose href is derived. */
  href: string;
  /**
   * The href `normaliseDestination` would write instead, when it understands the one written —
   * «612 345 678» → `tel:612345678`. Present only on a link element; the download gate offers
   * «Arreglarlos» for these and «Campos» for the rest (sprint 42 día 1, David's adjustment 1b).
   */
  fix?: string;
}

/**
 * The header's button, read as a destination like any link the owner wrote (ADR 0057).
 *
 * It lives outside every page and is drawn on all of them, so it is reported under a sectionId of
 * `"header"` and the slot `"action"` — words the editor can take somebody to, since the «Menú»
 * panel is where the button is chosen. `href` is what the renderer will write for it: a local anchor
 * when the section is on the page being drawn, a link into the page otherwise; here it is judged
 * once, by whether the destination exists at all, because the renderer builds the href from the
 * destination and cannot build a dead one from a live destination.
 */
function headerDestination(
  doc: RetorikaDocument,
): { dead: boolean; href: string; entry: DeadDestination } | undefined {
  const action = doc.header?.action;
  if (!action) return undefined;
  const entry: DeadDestination = {
    pageId: doc.pages[0]?.id ?? "",
    sectionId: "header",
    elementId: "action",
    slot: "action",
    role: "button",
    text: "",
    href: "",
  };
  if (action.kind === "section") {
    const owner = doc.pages.find((page) => page.sections.some((s) => s.id === action.sectionId));
    if (!owner) return { dead: true, href: `#${action.sectionId}`, entry };
    return { dead: false, href: `#${action.sectionId}`, entry };
  }
  const page = doc.pages.find((candidate) => candidate.id === action.pageId);
  if (!page || page.binding) return { dead: true, href: "", entry };
  return { dead: false, href: hrefForPage(page), entry };
}

export function listDeadDestinations(doc: RetorikaDocument): DeadDestination[] {
  const links = reachable(doc);
  const dead: DeadDestination[] = [];
  // The invariants make a dangling action unrepresentable through `parseDocument`; this is the
  // guarantee that stays whether or not anything can trigger it, because the download route is a
  // public endpoint and the filter is the validation, not the trust.
  const action = headerDestination(doc);
  if (action?.dead) dead.push(action.entry);
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        if (element.hidden) continue;
        const value = element.value;
        // **A «Cómo llegar» is a link too** (ADR 0080, sprint 40 día 4): one that follows the
        // address leads nowhere when the address is gone, and the download says so like any other.
        if (value?.kind === "map") {
          if (mapHref(value, section) !== "") continue;
          dead.push({
            pageId: page.id,
            sectionId: section.id,
            elementId: element.id,
            slot: element.slot,
            role: element.role,
            text: value.label,
            href: "",
          });
          continue;
        }
        if (value?.kind !== "link") continue;
        if (!isDead(value.href, page.id, links)) continue;
        const fix = normaliseDestination(value.href);
        dead.push({
          pageId: page.id,
          sectionId: section.id,
          elementId: element.id,
          slot: element.slot,
          role: element.role,
          text: value.text,
          href: value.href.trim(),
          // A fix is offered only when the fixed href would pass this very gate; the three shapes
          // always do (a scheme with something after it), and the check keeps that a fact rather
          // than a belief.
          ...(fix !== null && !isDead(fix, page.id, links) ? { fix } : {}),
        });
      }
    }
  }
  return dead;
}

/**
 * The document with every dead destination that has a `fix` written as its fix — «Arreglarlos» in
 * the download gate (sprint 42 día 1). Pure, and the same document back when there is nothing to
 * fix, so the history can tell a press that changed nothing from one that did. Only the href moves:
 * the words and the marks of the link are untouched, which is why this writes the value directly
 * rather than going through `fillSlot`, whose whole-value write is for a slot being created.
 */
export function fixDestinations(doc: RetorikaDocument): RetorikaDocument {
  const fixes = new Map<string, string>();
  for (const entry of listDeadDestinations(doc)) {
    if (entry.fix !== undefined) fixes.set(`${entry.sectionId}/${entry.elementId}`, entry.fix);
  }
  if (fixes.size === 0) return doc;
  const fixElement = (sectionId: string, element: ContentElement): ContentElement => {
    const fix = fixes.get(`${sectionId}/${element.id}`);
    if (fix !== undefined && element.value?.kind === "link") {
      return { ...element, value: { ...element.value, href: fix } };
    }
    if (element.items) {
      return {
        ...element,
        items: element.items.map((item) => ({
          ...item,
          elements: item.elements.map((child) => fixElement(sectionId, child)),
        })),
      };
    }
    return element;
  };
  return {
    ...doc,
    pages: doc.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => ({
        ...section,
        content: section.content.map((element) => fixElement(section.id, element)),
      })),
    })),
  };
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
  // A page per entry answers to every entry's slug (ADR 0040): deleting it kills every link into
  // any of the files it would have been drawn as.
  const slugs = new Set([page.slug]);
  if (page.binding) {
    const collection = doc.collections.find((c) => c.id === page.binding?.collectionId);
    for (const entry of collection?.entries ?? [])
      if (entry.slug !== undefined) slugs.add(entry.slug);
  }
  return linksMatching(doc, (href) => {
    const slug = INTERNAL_PAGE.exec(href)?.[1];
    return slug !== undefined && slugs.has(slug);
  });
}

/** Every visible link whose trimmed href the predicate accepts. */
function linksMatching(
  doc: RetorikaDocument,
  accepts: (href: string) => boolean,
): DeadDestination[] {
  const pointing: DeadDestination[] = [];
  // The header's button counts among what points here: deleting the page or the section it names
  // takes the button away, and the person deciding is owed that in the same count.
  const action = headerDestination(doc);
  if (action && !action.dead && accepts(action.href)) pointing.push(action.entry);
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
          href: value.href.trim(),
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
