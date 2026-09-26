import type { RetorikaDocument } from "./document.ts";
import { flattenElements } from "./invariants.ts";
import type { Role } from "./roles.ts";

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

/** Every section id in the document: what an in-page anchor has to name to resolve. */
function sectionIds(doc: RetorikaDocument): ReadonlySet<string> {
  return new Set(doc.pages.flatMap((page) => page.sections.map((section) => section.id)));
}

/**
 * Whether this href goes nowhere.
 *
 * The anchor case is the one that is not obvious, and it arrived with anchors themselves: once a
 * button can point at `#sec-contact`, deleting that section leaves the button pointing at nothing
 * — and the href is neither empty nor `#`, so the two checks above would wave it through. A
 * browser given an unresolvable fragment simply does nothing, which on a static page with no
 * error state is indistinguishable from a broken site.
 *
 * Only same-page anchors are judged. An `href` to another site is not ours to resolve, and a
 * `tel:`/`mailto:` has no fragment.
 */
function isDead(href: string, sections: ReadonlySet<string>): boolean {
  const trimmed = href.trim();
  if (DEAD_HREFS.has(trimmed)) return true;
  if (!trimmed.startsWith("#")) return false;
  return !sections.has(trimmed.slice(1));
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
  const sections = sectionIds(doc);
  const dead: DeadDestination[] = [];
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        if (element.hidden) continue;
        const value = element.value;
        if (value?.kind !== "link") continue;
        if (!isDead(value.href, sections)) continue;
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
  const pointing: DeadDestination[] = [];
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        if (element.hidden) continue;
        const value = element.value;
        if (value?.kind !== "link" || value.href.trim() !== target) continue;
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
