/**
 * **The rail's layout, and whose it is** (ADR 0072, sprint 37 día 2).
 *
 * The rail can stand fixed on the left, as it always has and as it still does by default, or fold
 * into a radial menu: one button at the edge — the tool that is open — around which the others fan
 * out when the pointer rests on it. Which of the two is the owner's choice, and **it is kept in this
 * browser and nowhere else**: the same two-layer reasoning as `designTools.ts`, of which this file is
 * a copy, with the account layer left for later and named as such in the backlog.
 *
 * **Not a field of `StoredSession`, and not a word of the document**, for the reasons
 * `designTools.ts` gives at length: «Volver a empezar» must not change how the editor is laid out
 * for the person using it, and flipping the switch must not even reach a save. `INV_4`'s argument,
 * for a preference that has nothing to do with the site.
 *
 * Nothing here may import `@retorika/schema` or touch a document. `test/railLayout.test.ts` reads
 * this file and asserts that.
 */

export type RailLayout = "fixed" | "radial";

/**
 * **The rail's tools, top to bottom — the one list both layouts read** (sprint 39 día 2, David's
 * answer E): «Secciones», «Estilo», «Fotos», «Páginas», «Menú», «Compartir». Fotos moved up from last:
 * an owner who comes from Canva looks for their pictures before they look for how a link is shared.
 * «Menú» stays beside «Páginas», because the two menus it governs are the pages' and the sections'
 * (ADR 0057). The radial menu fans out in this order (ADR 0072 §1: the same tools, the same panels),
 * and the tests read the list from here rather than copying it: a copied order agrees with a wrong
 * rail.
 */
export const RAIL_ORDER = ["sections", "style", "photos", "pages", "menu", "share"] as const;

/** The two the design-tools switch adds, after the rest and only while it is on (ADR 0025 §6, ADR
 * 0033 §11). */
export const STUDIO_TOOLS = ["design", "collections"] as const;

export type RailItemId = (typeof RAIL_ORDER)[number] | (typeof STUDIO_TOOLS)[number];

const KEY = "retorika.rail.v1";

/** `"fixed"` on a first visit, on anything that is not the value written below, and on storage that
 * throws — a private window, blocked site data. Nothing stored *is* the fixed rail. */
export function loadRailLayout(): RailLayout {
  try {
    return globalThis.localStorage.getItem(KEY) === "radial" ? "radial" : "fixed";
  } catch {
    return "fixed";
  }
}

/** `false` when storage refuses, so the caller can tell «fixed» from «we could not remember» — the
 * contract `saveDesignTools` and `saveSession` have. The fixed rail leaves no key behind. */
export function saveRailLayout(layout: RailLayout): boolean {
  try {
    if (layout === "radial") globalThis.localStorage.setItem(KEY, "radial");
    else globalThis.localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * **What the shell draws: the stored layout, or `undefined` on a phone**, where the rail is the bar
 * along the bottom of ADR 0042 and there is no edge to put a hub on — so neither the radial menu nor
 * the switch that chooses it is offered. Three states, as `designToolsFor` has them: «fixed» draws a
 * switch somebody can press; «not offered» draws nothing. The stored value is never rewritten by a
 * narrow window: widening it again brings back the layout the owner chose.
 */
export function railLayoutFor(stored: RailLayout, phone: boolean): RailLayout | undefined {
  return phone ? undefined : stored;
}

const OFFER_KEY = "retorika.railNotice.v1";

/**
 * **The radial menu is offered once** (sprint 37 día 6, David's decision of 13 November 2026: «el
 * editor ofrece probarlo una vez»): a sentence in the help line, at rest, with a cross. Pressing the
 * cross, or the switch itself in either direction, writes this — and the offer is not made again in
 * this browser. A browser that refuses to keep it simply offers it again next time, which is the
 * honest consequence of being refused, and costs one sentence.
 */
export function loadRailOfferDismissed(): boolean {
  try {
    return globalThis.localStorage.getItem(OFFER_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveRailOfferDismissed(): boolean {
  try {
    globalThis.localStorage.setItem(OFFER_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Whether the help line offers the radial menu: only where it can be chosen, only while the rail is
 * the fixed one, and only until the offer was answered. */
export function railOfferFor(layout: RailLayout | undefined, dismissed: boolean): boolean {
  return layout === "fixed" && !dismissed;
}
