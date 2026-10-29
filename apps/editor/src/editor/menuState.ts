import {
  hasMenu,
  MENU_MIN_ENTRIES,
  menuIsCurated,
  pageMenuEntries,
  sectionMenuEntries,
} from "@retorika/renderer";
import type { RetorikaDocument } from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };

/**
 * How much menu is left, for the two places the owner decides it (ADR 0043 §5).
 *
 * **One object, read by both panels, because the two must not disagree.** The switch for a section
 * lives in its fields and the switch for a page lives in its row, and both of them owe the same
 * sentence: how many links the menu has left, and whether the site is showing one at all. Working
 * the arithmetic out twice would be two chances to tell somebody a different number about the same
 * document while they are deciding.
 *
 * **Every question is asked of the renderer**, which is the thing that actually draws the menu —
 * not re-derived here. «Will my site show a menu» has three clauses in a particular order now, and
 * an editor that answered it from its own copy of the rule would eventually promise a menu the
 * published page does not have. That is the failure this file exists to make impossible, and it is
 * the one David named when he approved the day: «Nada de interfaz que prometa más de lo que hay.»
 */
export interface MenuState {
  /** Links the sections menu of the page being edited has left. */
  sections: number;
  /** Links the pages menu has left — «Inicio» is not among them; it is a way back, not an entry. */
  pages: number;
  /**
   * What the threshold counts: the two menus of the **home page**, added (ADR 0043 §4).
   *
   * The home page and not the page being edited, because whether a menu is drawn is one answer for
   * the whole site. So this number can differ from `sections + pages` while standing on another
   * page, and that is correct rather than a bug: the sentence that uses it talks about the site.
   */
  destinations: number;
  /** Whether anybody has decided — the presence of `inMenu` anywhere, not its value (§5). */
  curated: boolean;
  /** Whether the published site shows a menu at all. */
  drawn: boolean;
  /** The threshold, so a sentence can say the number instead of restating it in Spanish. */
  threshold: number;
  /** Which of the three things worth saying out loud is true, or none of them — **for a menu whose
   * `shown` nobody wrote**. The owner's word in the «Menú» panel overrides it; see `menuNoteText`. */
  note: MenuNote;
  /**
   * The owner's word on each menu from the «Menú» panel (ADR 0057), or `undefined` for «Automático».
   * The fourth clause of «will my site show a menu»: present, it answers for that menu and the
   * threshold is silent — so the sentence about the threshold must be too.
   */
  pagesShown: boolean | undefined;
  sectionsShown: boolean | undefined;
}

/**
 * The one sentence the owner is owed beyond the count, if any.
 *
 * - `gone` — nothing is left, so no menu is published at all. David's own clause.
 * - `notYet` — under the threshold and nobody has decided, so no menu is published **yet**. Said
 *   rather than left silent: a switch with a count beside it, on a site showing no menu, would be
 *   an interface promising something that is not there.
 * - `yours` — a menu smaller than the threshold, published because they asked for it. **Named as
 *   theirs**, which is the point: the alternative is a site quietly behaving differently from
 *   every other one with no explanation of why.
 */
export type MenuNote = "none" | "gone" | "notYet" | "yours";

export function menuStateFor(doc: RetorikaDocument, pageId: string | undefined): MenuState {
  const home = doc.pages[0];
  const page = doc.pages.find((candidate) => candidate.id === pageId) ?? home;
  const pages = pageMenuEntries(doc).length;
  const sections = page ? sectionMenuEntries(page).length : 0;
  const destinations = home ? pages + sectionMenuEntries(home).length : 0;
  const curated = menuIsCurated(doc);
  const drawn = hasMenu(doc);

  return {
    sections,
    pages,
    destinations,
    curated,
    drawn,
    threshold: MENU_MIN_ENTRIES,
    note: noteFor({ destinations, drawn, threshold: MENU_MIN_ENTRIES }),
    pagesShown: doc.header?.pages?.shown,
    sectionsShown: doc.header?.sections?.shown,
  };
}

/** The three cases, in the order that makes them mutually exclusive. */
function noteFor({
  destinations,
  drawn,
  threshold,
}: {
  destinations: number;
  drawn: boolean;
  threshold: number;
}): MenuNote {
  if (destinations === 0) return "gone";
  if (!drawn) return "notYet";
  return destinations < threshold ? "yours" : "none";
}

/**
 * The count, in words, for the panel that is about sections.
 *
 * Three keys rather than one with `{n}`: «quedan 1 secciones» is the kind of sentence that tells
 * somebody the interface was not written for them. The same reason `editor.pages.deleteWithLink`
 * has a singular of its own.
 */
export function sectionsLeftText(state: MenuState): string {
  if (state.sections === 0) return es["editor.menu.sectionsLeftNone"];
  if (state.sections === 1) return es["editor.menu.sectionsLeftOne"];
  return es["editor.menu.sectionsLeft"].replace("{n}", String(state.sections));
}

/** The same count for the panel that is about pages. */
export function pagesLeftText(state: MenuState): string {
  if (state.pages === 0) return es["editor.menu.pagesLeftNone"];
  if (state.pages === 1) return es["editor.menu.pagesLeftOne"];
  return es["editor.menu.pagesLeft"].replace("{n}", String(state.pages));
}

/**
 * The sentence about the site's menu as a whole, or nothing when there is nothing worth saying.
 *
 * Both panels show it, because both panels change the number it is about. `min` is the threshold
 * read off the renderer rather than typed into Spanish, so the day somebody argues three down to
 * two the copy follows without being edited.
 *
 * **`menu` is which menu the panel's switch feeds**, and since ADR 0057 it changes the answer: once
 * the owner chose «Siempre» or «Nunca» for that menu in «Menú», the threshold no longer decides it,
 * and a sentence counting towards three would describe a rule that is not being applied. «Nunca»
 * says the switch here changes nothing a visitor sees; «Siempre» says nothing more than the count
 * already does, unless there is nothing to count.
 */
export function menuNoteText(state: MenuState, menu: "pages" | "sections"): string | undefined {
  const shown = menu === "pages" ? state.pagesShown : state.sectionsShown;
  if (shown === false) return es["editor.menu.off"];
  if (shown === true) {
    const left = menu === "pages" ? state.pages : state.sections;
    return left === 0 ? es["editor.menu.emptyAlways"] : undefined;
  }
  const min = String(state.threshold);
  const n = String(state.destinations);
  if (state.note === "gone") return es["editor.menu.gone"];
  if (state.note === "notYet") {
    return state.destinations === 1
      ? es["editor.menu.notYetOne"].replace("{min}", min)
      : es["editor.menu.notYet"].replace("{n}", n).replace("{min}", min);
  }
  if (state.note === "yours") {
    return state.destinations === 1
      ? es["editor.menu.yoursOne"].replace("{min}", min)
      : es["editor.menu.yours"].replace("{n}", n).replace("{min}", min);
  }
  return undefined;
}
