import { RAIL_WIDTH } from "@retorika/renderer";
import {
  type Header,
  PAGES_POSITIONS,
  type PagesPosition,
  type RetorikaDocument,
  SECTIONS_POSITIONS,
  type SectionsPosition,
} from "@retorika/schema";
import es from "../locales/es.json" with { type: "json" };
import type { Point } from "./barPosition.ts";
import { type HeaderState, pagesPositionPatch, sectionsPositionPatch } from "./headerState.ts";
import { PHONE_BREAKPOINT } from "./overflowCheck.ts";

/**
 * **A menu is dragged to its zone** (ADR 0066, sprint 33 día 4), decided without a DOM.
 *
 * ADR 0060 made each menu's place a word from a closed vocabulary and said every word is a zone a
 * drag would drop the menu on. This is that drag's judgement: which zones a menu has, where each
 * one lies on the frame, which one a point is over, and what letting go there writes — which is
 * exactly the patch the «Dónde va» cards write, and nothing else. The gesture chooses between
 * zones and never makes one: no coordinate reaches the document, and rule 4 stands as ADR 0060 left
 * it. The wiring is in `Editor.tsx` (`wireMenuDrag`), the split `dragGrid.ts` already uses.
 *
 * **The zones' geometry comes from the renderer's constants**, never from measuring a rail that
 * may not be drawn yet (the pages in the bar draw no rail, and the gesture has to show where one
 * would stand): a side is `RAIL_WIDTH` by the window's height; the bar is its own box, or a strip
 * of the stylesheet's estimate where it has collapsed to nothing; the row is a band under the bar;
 * «Ir a…» is a pill at `--rb-header-h + space.md` on the side the pages' rail leaves free, the
 * place `foldCss` puts it. The caller measures the frame once at the start of the gesture.
 */

export type Menu = "pages" | "sections";
export type Zone = PagesPosition | SectionsPosition;

/** The menu a `nav[data-part]` holds, or `null` for a part that is not a menu. */
export function menuOf(part: string | null | undefined): Menu | null {
  if (part === "pagesLinks") return "pages";
  if (part === "sectionsLinks") return "sections";
  return null;
}

export interface MenuZone {
  readonly zone: Zone;
  /** The panel's own word for the place, so the zone and the card say the same thing. */
  readonly label: string;
  /** The menu is there now: dropping here writes nothing. */
  readonly current: boolean;
  /** A side the other menu already holds: dropping here stacks the two (ADR 0060 §2). */
  readonly stacked: Menu | null;
}

/** What `zonesFor` reads of the panel's state: each menu's place and whether it is drawn. */
export type Places = Pick<
  HeaderState,
  "pagesPosition" | "sectionsPosition" | "pagesMenu" | "sectionsMenu"
>;

const OTHER: Record<Menu, Menu> = { pages: "sections", sections: "pages" };

/**
 * The zones of `menu` at a layout width — **none in the phone view** (ADR 0066): no rail stands
 * under 1024, and where the sections go on a phone is `sections.mobile`, a choice of the panel.
 */
export function zonesFor(menu: Menu, places: Places, layoutWidth: number): MenuZone[] {
  if (layoutWidth <= PHONE_BREAKPOINT) return [];
  const words: readonly Zone[] = menu === "pages" ? PAGES_POSITIONS : SECTIONS_POSITIONS;
  const current = menu === "pages" ? places.pagesPosition : places.sectionsPosition;
  const other = OTHER[menu];
  const otherDrawn = other === "pages" ? places.pagesMenu.drawn : places.sectionsMenu.drawn;
  const otherAt = other === "pages" ? places.pagesPosition : places.sectionsPosition;
  return words.map((zone) => ({
    zone,
    label: es[`editor.menuPanel.position.${zone}`],
    current: zone === current,
    stacked: (zone === "left" || zone === "right") && otherDrawn && otherAt === zone ? other : null,
  }));
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The frame as the gesture finds it, in the frame's own pixels, viewport-relative. */
export interface Frame {
  readonly width: number;
  readonly height: number;
  /** The bar's box. A collapsed bar (`data-bar="none"`) has no height: the caller passes the
   * stylesheet's estimate (`--rb-bar-h`) as its height, so the zone is a strip at the top. */
  readonly bar: Rect;
  /** `--rb-header-h` as it resolves inside the header: the bar's height, or 0 on a collapsed one. */
  readonly headerH: number;
  /** `--space-md` in pixels. */
  readonly spaceMd: number;
  /** Where the pages' rail stands or would stand: «Ir a…» goes to the other side (`foldCss`). */
  readonly pagesPosition: PagesPosition;
}

export interface ZoneRect extends Rect {
  readonly zone: Zone;
}

/** The band under the bar that is the row's zone: two spaces, enough to aim at. */
export const ROW_ZONE_HEIGHT = (spaceMd: number) => 2 * spaceMd;
/** «Ir a…»'s pill as a target: about the word and its chevron with the pill's padding. */
export const FOLD_ZONE = (spaceMd: number) => ({ width: 6 * spaceMd, height: 2.5 * spaceMd });

export function zoneRects(zones: readonly MenuZone[], frame: Frame): ZoneRect[] {
  return zones.map(({ zone }) => rectOf(zone, frame));
}

function rectOf(zone: Zone, frame: Frame): ZoneRect {
  switch (zone) {
    case "left":
      return { zone, left: 0, top: 0, width: RAIL_WIDTH, height: frame.height };
    case "right":
      return {
        zone,
        left: frame.width - RAIL_WIDTH,
        top: 0,
        width: RAIL_WIDTH,
        height: frame.height,
      };
    case "bar":
      return { zone, ...frame.bar };
    case "row":
      return {
        zone,
        left: frame.bar.left,
        top: frame.bar.top + frame.bar.height,
        width: frame.bar.width,
        height: ROW_ZONE_HEIGHT(frame.spaceMd),
      };
    case "fold": {
      const pill = FOLD_ZONE(frame.spaceMd);
      const onLeft = frame.pagesPosition === "right";
      return {
        zone,
        left: onLeft ? frame.spaceMd : frame.width - frame.spaceMd - pill.width,
        top: frame.headerH + frame.spaceMd,
        width: pill.width,
        height: pill.height,
      };
    }
    default:
      throw new Error(`zoneRects: no zone called ${String(zone)}`);
  }
}

/**
 * The zone under a point, or `null` off every zone. Where zones overlap — the pill lies inside the
 * right side's column, the bar's strip crosses both columns at the top — the smaller one wins, so
 * what is drawn smallest is what the hand can aim at.
 */
export function zoneAt(point: Point, rects: readonly ZoneRect[]): Zone | null {
  const hit = [...rects]
    .sort((a, b) => a.width * a.height - b.width * b.height)
    .find(
      (r) =>
        point.x >= r.left &&
        point.x < r.left + r.width &&
        point.y >= r.top &&
        point.y < r.top + r.height,
    );
  return hit?.zone ?? null;
}

export type DropOutcome =
  | { readonly kind: "none" }
  | { readonly kind: "write"; readonly zone: Zone; readonly patch: Partial<Header> };

/**
 * What letting go over `zone` does: nothing over no zone or the menu's own, and otherwise the patch
 * the panel's card for that place writes — one `setHeader`, one step of history.
 */
export function dropOutcome(menu: Menu, zone: Zone | null, doc: RetorikaDocument): DropOutcome {
  if (zone === null) return { kind: "none" };
  if (menu === "pages") {
    if (!(PAGES_POSITIONS as readonly string[]).includes(zone)) return { kind: "none" };
    const current = doc.header?.pages?.position ?? "bar";
    if (zone === current) return { kind: "none" };
    return { kind: "write", zone, patch: pagesPositionPatch(doc, zone as PagesPosition) };
  }
  const current = doc.header?.sections?.position ?? "bar";
  if (zone === current) return { kind: "none" };
  return { kind: "write", zone, patch: sectionsPositionPatch(doc, zone as SectionsPosition) };
}

const MENU_NAME: Record<Menu, string> = {
  pages: es["editor.menuDrag.pages"],
  sections: es["editor.menuDrag.sections"],
};

/** The menu's name as the ghost carries it: «Menú de páginas». */
export function menuName(menu: Menu): string {
  return MENU_NAME[menu];
}

/** What the live region says once a menu has landed: «Menú de páginas: columna izquierda». */
export function dropText(menu: Menu, zone: Zone): string {
  const place = es[`editor.menuPanel.position.${zone}`];
  return es["editor.menuDrag.dropped"]
    .replace("{menu}", MENU_NAME[menu])
    .replace("{zone}", place.charAt(0).toLowerCase() + place.slice(1));
}

/** The ghost's second line over a side the other menu holds: «Se apila bajo el menú de páginas». */
export function stackedText(other: Menu): string {
  const name = MENU_NAME[other];
  return es["editor.menuDrag.stacked"].replace(
    "{other}",
    name.charAt(0).toLowerCase() + name.slice(1),
  );
}
