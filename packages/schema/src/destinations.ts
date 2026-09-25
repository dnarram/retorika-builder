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
  const dead: DeadDestination[] = [];
  for (const page of doc.pages) {
    for (const section of page.sections) {
      for (const element of flattenElements(section.content)) {
        if (element.hidden) continue;
        const value = element.value;
        if (value?.kind !== "link") continue;
        if (!DEAD_HREFS.has(value.href.trim())) continue;
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
