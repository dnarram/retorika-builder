"use client";

import {
  blankItem,
  COVER_ID,
  FOOTER_ID,
  isPlaceholderText,
  presetFor,
  TEASER_ID,
  variantsFor,
} from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import { buildCss, render, sectionMenuEntries } from "@retorika/renderer";
import {
  bindList,
  canFoldPage,
  type ElementAddress,
  type EntryField,
  entryCountBlock,
  FINE_TRACKS,
  findSection,
  fineTrack,
  fineTrackSpan,
  flattenElements,
  isHandDesigned,
  type ListItem,
  listEditableFields,
  listLinksTo,
  MARKS,
  MAX_PAGES,
  type Mark,
  type MarkRange,
  type MarkRun,
  type MeasuredBox,
  type MobilePatchEdit,
  marksAfterTrim,
  marksFor,
  type Placement,
  type PlacementEdit,
  type PresetShape,
  type RetorikaDocument,
  type RevertImpact,
  ROW_STEP_PX,
  type Role,
  rangeHasMark,
  revertImpact,
  type SlotAddress,
  type SlotFill,
  type StyleException,
  type StyleProperty,
  type StyleValue,
  type SurplusDecision,
  setElementStyle,
  shiftMarks,
  styleFor,
  type TextEdit,
  usesOfCollection,
} from "@retorika/schema";
import type { FontKey } from "@retorika/tokens";
import { useEffect, useMemo, useRef, useState } from "react";
import { type ArrowRun, accumulate, moves, RUN_IDLE_MS } from "../editor/arrowRun.ts";
import { BuildingScreen } from "../editor/BuildingScreen.tsx";
import {
  BAR_INSET,
  type Bounds,
  clampToHost,
  cornerPoint,
  DRAG_THRESHOLD,
  dragged,
  gripKeyAction,
  isDrag,
  isDragBeyond,
  isToolbarShortcut,
  nextCorner,
  offsetBetween,
  type Point,
  stepped,
  type ToolbarGeometry,
  textGripKeyAction,
  tipSide,
  toolbarIndex,
  toolbarKeyAction,
  toolbarPoint,
  toolbarShortcutFor,
  withOffset,
} from "../editor/barPosition.ts";
import { holdFor } from "../editor/buildingScreen.ts";
import { canvasLinkTarget } from "../editor/canvasLinks.ts";
import { CHROME_SCALE, PILL_REST_BORDER, VERB_SCALE } from "../editor/chromeScale.ts";
import { delegate } from "../editor/delegate.ts";
import type { SwitchNotice } from "../editor/designTools.ts";
import {
  designRows,
  elementLabels,
  rowBelowPlacements,
  selectedRowId,
} from "../editor/designTree.ts";
import {
  type AcceptedWarning,
  type DownloadGate,
  downloadGateFor,
} from "../editor/downloadGate.ts";
import {
  announceText,
  arrowAction,
  arrowDrop,
  type Drop,
  dropAt,
  fineColumnAt,
  fineLastColumnAt,
  type GridMetrics,
  lastRowAt,
  reorderAt,
  rowAt,
} from "../editor/dragGrid.ts";
import {
  EditorShell,
  type RailItemId,
  type SavedWhere,
  type SaveStatus,
} from "../editor/EditorShell.tsx";
import { GUIDE_ZONE, type Guide, guidesFor, type Rect } from "../editor/guides.ts";
import { HANDLE_TOUCH, handlesFor } from "../editor/handles.ts";
import { ACCEPTED_IMAGE_ACCEPT } from "../editor/imageBytes.ts";
import { toolbarFamilyLabel } from "../editor/letterGallery.ts";
import { LOOK_AHEAD_DEADLINE_MS, lookAheadStep } from "../editor/lookAhead.ts";
import { menuStateFor } from "../editor/menuState.ts";
import { measureOverflow } from "../editor/overflowCheck.ts";
import {
  chrome,
  HISTORY_TOUCHED_ATTRIBUTE,
  type PatchCause,
  patchCanvas,
  takeHistoryText,
} from "../editor/patchCanvas.ts";
import { countPhotos, listPhotos, type PhotoState } from "../editor/photoInventory.ts";
import { withPhotoUrls } from "../editor/previewDocument.ts";
import { record, serialOf } from "../editor/probe.ts";
import {
  axes,
  cursorFor,
  EDGE_ZONE,
  EDGE_ZONE_WRITING_INSIDE,
  type Edge,
  edgeAt,
  resizeTo,
} from "../editor/resizeBox.ts";
import { sectionFields } from "../editor/sectionFields.ts";
import {
  placeAfterRebuild,
  popupKeyAction,
  rovingTabIndex,
  rovingTabIndexInside,
  sectionKeyAction,
} from "../editor/sectionKeys.ts";
import { offersMatching } from "../editor/sectionSearch.ts";
import { keepsItsOwnUndo, shortcutFor } from "../editor/shortcuts.ts";
import { insertedTextFor, liveFrameOf, offsetFor, textFrameOf } from "../editor/textEdits.ts";
import { hasAnyControl, toolbarFor } from "../editor/textToolbar.ts";
import { chosenHintText, clickAction, textKeyAction } from "../editor/twoStates.ts";
import { isPhoneViewport } from "../editor/viewport.ts";
import es from "../locales/es.json" with { type: "json" };
import { CollectionsPanel } from "./CollectionsPanel.tsx";
import { DesignPanel } from "./DesignPanel.tsx";
import {
  ContrastDialog,
  DownloadWarningDialog,
  OverflowDialog,
  PhotosFailedDialog,
  StackedTextDialog,
  TooManyPhotosDialog,
} from "./DownloadGateDialogs.tsx";
import { FieldsPanel } from "./FieldsPanel.tsx";
import { PagesPanel } from "./PagesPanel.tsx";
import { PhotosPanel } from "./PhotosPanel.tsx";
import { RevertDialog } from "./RevertDialog.tsx";
import { SharePanel } from "./SharePanel.tsx";
import { StylePanel } from "./StylePanel.tsx";
import { FieldError } from "./ui.tsx";

/** `preparing` is the overflow measurement and the gate; `downloading` the request and the hold.
 * Both draw the building screen (`BuildingScreen.tsx`). */
type DownloadState = "idle" | "preparing" | "downloading" | "error";

/** One key for a (section, element) pair. A `Map` keyed by an object would compare by identity and
 * never hit, and the two ids together are what makes an address unique — element ids are unique
 * only within their section (document rule 5). `\u0000` cannot occur in either. */
function addressKey(sectionId: string, elementId: string): string {
  return `${sectionId}\u0000${elementId}`;
}

/**
 * What the delete toast (ADR 0014) shows: a name and whether it stays until dismissed. `Variants`
 * decides `persistent` — it is the one holding the undo history `wasSectionEverEdited` reads —
 * and owns the timer that clears a non-persistent toast, since that has to survive this
 * component unmounting if the user leaves the editor mid-toast.
 */
export interface DeleteToast {
  sectionName: string;
  persistent: boolean;
  /** How many visible buttons pointed at the deleted section by its anchor, counted before the
   * delete. Zero for a section nothing linked to, which is every section until this sprint. */
  brokenAnchors: number;
  /**
   * Which page the section was on, and where among that page's sections — both read **before** the
   * delete, because afterwards there is nothing left to ask.
   *
   * They exist for the dashed notice mockup 11 draws inside the canvas, and they are on the toast
   * rather than in their own state for the reason the name and `persistent` are: it is one event
   * with one lifetime. The toast going takes the notice with it, which is what makes «el hueco
   * desaparecerá solo» true without a second timer to keep in step.
   */
  pageId: string;
  index: number;
}

/**
 * The tags `packages/renderer/src/build.ts` emits for a `text` or `link` value: headings,
 * body copy, and a button or link's label. Everything else in the tree (`img`, the `<ul>`
 * a list renders as) carries `data-id` too but is not click-to-edit — there is no text on an
 * image to click, and a list's own children get their own `data-id` individually.
 */
const EDITABLE_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "A"]);

/**
 * Everything inside a section that Tab could stop on: the renderer's texts and placed elements,
 * the page's own links and buttons, the chrome's verbs, badges and line buttons, and whatever
 * already carries a `tabindex`. `applyCanvasStops` decides which of them are stops right now.
 */
const CANVAS_STOP = "[data-id], a[href], button, input, select, textarea, [tabindex]";

/** The interface's typeface, for chrome injected into the preview frame. Spelled out rather
 * than inherited: inside that frame, "inherit" means the client's own site font. */
const UI_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * One entry of the "Añadir sección aquí" menu: a catalog section the editor may offer at this
 * moment, already named in Spanish by the caller — `Variants` holds the catalog's locale, and
 * which sections are offerable at all is the application's decision, not this component's.
 */
export interface SectionOffer {
  catalogId: string;
  name: string;
  description: string;
}

/** The catalog's Spanish name for the section the panel is showing, e.g. "Portada". */
/**
 * The binding this element carries, with the entry the card on screen is drawing.
 *
 * **The entry comes from the DOM and the field from the document**, and it has to be that way: the
 * document says «this leaf reads `title`» and cannot say which card, because there is one template
 * drawn N times. `data-entry` is the editor-only attribute ADR 0033 §10 exists for.
 */
function boundAt(
  doc: RetorikaDocument,
  address: ElementAddress,
  el: Element,
): { collectionId: string; field: string; entryId: string } | undefined {
  const found = findSection(doc, address.sectionId);
  if (!found) return undefined;
  const element = flattenElements(found.section.content).find(
    (candidate) => candidate.id === address.elementId,
  );
  const binding = element?.binding;
  if (!binding?.field) return undefined;
  const entryId = el.closest("[data-entry]")?.getAttribute("data-entry");
  if (!entryId) return undefined;
  return { collectionId: binding.collectionId, field: binding.field, entryId };
}

/** The bound list in this section, if it has one — what «Desenlazar esta sección» and the section's
 * own «convertir en lista» both need to know. */
function boundListOf(
  doc: RetorikaDocument,
  sectionId: string,
): { slot: string; collectionId: string } | undefined {
  const found = findSection(doc, sectionId);
  if (!found) return undefined;
  for (const element of found.section.content) {
    if (element.role !== "list") continue;
    const binding = element.binding;
    if (binding && binding.field === undefined) {
      return { slot: element.slot, collectionId: binding.collectionId };
    }
  }
  return undefined;
}

/** A list this section has that is **not** bound — the subject of «convertir en lista». */
function looseListOf(doc: RetorikaDocument, sectionId: string): string | undefined {
  const found = findSection(doc, sectionId);
  if (!found) return undefined;
  return found.section.content.find(
    (element) => element.role === "list" && !element.binding && (element.items ?? []).length > 0,
  )?.slot;
}

/**
 * The words the menu would call this section by, or `undefined` when it lends no entry at all.
 *
 * **Asked of the renderer rather than re-derived here.** Which sections lend an anchor is a rule
 * with five clauses — the cover, the footer, an avance, a heading that is missing, the section
 * carrying the page's `<h1>` — and a second copy of it in the editor would drift the first time
 * one of them changed. The section is asked about **as if it were in the menu**, so one the owner
 * has taken out still shows its switch, which is the only way to put it back.
 */
function menuLabelFor(doc: RetorikaDocument, sectionId: string): string | undefined {
  const found = findSection(doc, sectionId);
  if (!found) return undefined;
  const asIfIn = {
    ...found.page,
    sections: found.page.sections.map((section) =>
      section.id === sectionId ? { ...section, inMenu: true } : section,
    ),
  };
  return sectionMenuEntries(asIfIn).find((entry) => entry.sectionId === sectionId)?.label;
}

function sectionDisplayName(doc: RetorikaDocument, sectionId: string): string {
  const found = findSection(doc, sectionId);
  if (!found) return sectionId;
  const key = `section.${found.section.preset.catalogId}.name` as keyof typeof catalogEs;
  return catalogEs[key] ?? sectionId;
}

/** The preset's slots in the order it declares them, which is where a newly created element
 * gets placed. Empty for a section the catalog does not recognise, which the panel treats as
 * having no fields at all. */
function slotOrderOf(doc: RetorikaDocument, sectionId: string): string[] {
  const found = findSection(doc, sectionId);
  if (!found) return [];
  try {
    return presetFor(found.section.preset.catalogId).slots.map((slot) => slot.slot);
  } catch {
    return [];
  }
}

/** The same thing for one line's slots, which is what places a slot created **inside** a line —
 * a card's description belongs between the name and the price, not after it. Empty for a preset
 * with no list, which is every section the panel shows no line groups for anyway. */
function itemSlotOrderOf(doc: RetorikaDocument, sectionId: string): string[] {
  const found = findSection(doc, sectionId);
  if (!found) return [];
  try {
    return (presetFor(found.section.preset.catalogId).itemSlots ?? []).map((slot) => slot.slot);
  } catch {
    return [];
  }
}

/**
 * One composition this section could be drawn with — its id, its Spanish name, and whether it is
 * the one in use.
 */
interface Composition {
  variantId: string;
  name: string;
  current: boolean;
}

/**
 * The compositions to offer for a section, **or an empty list when the choice does not exist**, in
 * which case no button is drawn for it at all.
 *
 * Three reasons a section gets none, and each is a case where a button would light up and do
 * nothing — the dead-button mistake `EditorShell` has refused since sprint 1:
 *
 * - **It carries its own layout.** `build.ts` reads `section.layout ?? preset.layoutFor(variantId,
 *   …)`, so for a hand-designed section the variant id decides nothing; `setVariant` in the schema
 *   refuses outright, and this is what stops anyone reaching that refusal.
 * - **The catalog gives it only one composition.** Every section ships two or three today (asserted
 *   in `packages/catalog/test/variants.test.ts`), so this is a guard against a future section
 *   rather than a live case — cheap, and it fails to a missing button rather than a useless one.
 * - **It is not a catalog section at all**, so there is no preset to ask.
 */
function compositionsFor(doc: RetorikaDocument, sectionId: string): Composition[] {
  const found = findSection(doc, sectionId);
  if (!found || found.section.layout !== null) return [];
  let variantIds: readonly string[];
  try {
    variantIds = variantsFor(found.section.preset.catalogId);
  } catch {
    return [];
  }
  if (variantIds.length < 2) return [];
  return variantIds.map((variantId) => {
    const key =
      `section.${found.section.preset.catalogId}.variant.${variantId}` as keyof typeof catalogEs;
    return {
      variantId,
      name: catalogEs[key] ?? variantId,
      current: variantId === found.section.preset.variantId,
    };
  });
}

/**
 * Whether «Convertir esta sección en página» should be offered for this section.
 *
 * The three kinds `sectionToPage` refuses outright (ADR 0022), plus the page cap the download route
 * has always enforced and `sectionToPage` now enforces too. Asking the same questions the verb asks
 * is duplication of a kind worth having: the verb throwing is the guarantee, and this is what keeps
 * anybody from reaching it — a button that lights up and refuses is worse than no button, which is
 * the rule `compositionsFor` already follows.
 */
function canConvert(doc: RetorikaDocument, sectionId: string): boolean {
  if (doc.pages.length >= MAX_PAGES) return false;
  const found = findSection(doc, sectionId);
  if (!found) return false;
  // A section of a page drawn per entry reads that entry; on a page of its own it would read
  // nothing (ADR 0040). `sectionToPage` refuses it by name, and this keeps the verb from being
  // offered where it would.
  if (found.page.binding) return false;
  return !UNCONVERTIBLE.has(found.section.preset.catalogId);
}

const UNCONVERTIBLE: ReadonlySet<string> = new Set([COVER_ID, FOOTER_ID, TEASER_ID]);

/**
 * The list a section holds, if it holds one: which slot it is in, the lines in it, and whether
 * another would fit.
 *
 * Empty for a section with no list, which is most of them. The cap comes from the preset
 * (`itemRange`) rather than from this component, so "Qué hago" stops at six and a price list at
 * twelve without the editor knowing either number.
 */
interface ListLines {
  slot: string;
  /** Which section this is, so the controls can call its items by their own name. */
  catalogId: string;
  itemIds: string[];
  canAdd: boolean;
  canRemove: boolean;
}

/**
 * The words on the two list controls, which depend on what a section's items actually are.
 *
 * One generic label served every list until sprint 5 day 3, and «Añadir línea» read acceptably
 * under a carta and passably under cards. Under a grid of photographs it does not: a photograph is
 * not a line, and the browser walk that day is where that became obvious rather than arguable.
 *
 * A section only needs a key here when the generic word is wrong for it, so «Qué hago» and
 * «Opiniones» keep the shared label — both have shipped through two usability sessions with it,
 * and changing words those sessions saw is a product decision rather than a tidy-up.
 */
function lineLabel(action: "add" | "remove" | "full" | "up" | "down", catalogId: string): string {
  const table = es as Record<string, string | undefined>;
  return table[`editor.line.${action}.${catalogId}`] ?? es[`editor.line.${action}`];
}

function linesFor(doc: RetorikaDocument, sectionId: string): ListLines | undefined {
  const found = findSection(doc, sectionId);
  if (!found) return undefined;
  let preset: PresetShape;
  try {
    preset = presetFor(found.section.preset.catalogId);
  } catch {
    return undefined;
  }
  const range = preset.itemRange;
  if (!preset.itemSlots || !range) return undefined;
  const list = found.section.content.find((element) => element.role === "list");
  if (!list) return undefined;
  const itemIds = (list.items ?? []).map((item) => item.id);
  return {
    slot: list.slot,
    catalogId: found.section.preset.catalogId,
    itemIds,
    canAdd: itemIds.length < range.max,
    canRemove: itemIds.length > range.min,
  };
}

/** From `Content-Disposition: attachment; filename="doc-taberna.zip"`. */
/**
 * The DOM point `chars` characters into an element's text — **the inverse of how every offset in
 * this file is measured.**
 *
 * Offsets here are counted the way `selectionRange` counts them: a `Range` from the element's start
 * to a position, and the length of its string. So walking the element's text nodes in order and
 * accumulating their lengths lands on the same place, which is what makes a selection survivable
 * across a document that has been rebuilt — the markup changes shape (a mark splits one text node
 * into three), the character count does not.
 *
 * Past the end gives the last text node's end rather than nothing: a selection is still better put
 * back clamped than dropped.
 */
function domPointAt(el: HTMLElement, chars: number): { node: Text; offset: number } | null {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = chars;
  let last: Text | null = null;
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (left <= node.data.length) return { node, offset: left };
    left -= node.data.length;
    last = node;
    node = walker.nextNode() as Text | null;
  }
  return last ? { node: last, offset: last.data.length } : null;
}

function filenameFrom(response: Response, fallback: string): string {
  const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
  return match?.[1] ?? fallback;
}

/**
 * The chosen variant, editable inside the real editor chrome: every heading, paragraph and
 * button/link label the renderer marks with `data-id` becomes a native `contentEditable` region
 * directly inside the same-origin iframe — reached through `iframe.contentDocument`, no
 * postMessage needed. An edit commits on blur, reported up as `onEditText(address, text)`, which
 * `Variants` applies to the document it holds; the canvas then shows that new document by patching
 * the page in place (ADR 0051) — which is why nothing is written mid-keystroke, only once the user
 * leaves the field.
 *
 * **An edit names the section as well as the element** (day 2). Element ids are unique only
 * within a section, so a bare id stops identifying anything the moment a section can be
 * duplicated — which is this sprint's day 5. Fixing the addressing before that arrives is why
 * the document became state today rather than then.
 *
 * "Descargar" sends `document` exactly as this component holds it (day 3): now that the document
 * is the state a blur already commits to, there is no round trip left to distrust — the prop is
 * always the current one, not something read back out of the DOM to work around a stale closure.
 * `/api/download` re-validates it independently; see that route for why sending the whole
 * document, not answers plus a diff, is also what a section that can be added, deleted or
 * reordered requires.
 *
 * Section selection marks a section with a 2px outline injected into the iframe's own DOM — and,
 * since sprint 2 day 4, a small cluster of action buttons drawn at the selected section's corner:
 * move up, move down, its composition, duplicate, the section's fields, delete. Six as of sprint 4
 * day 4, and the composition one is the first that is drawn conditionally: a section whose layout
 * is its own, or one the catalog gives a single composition, gets no button rather than a dead one.
 * No floating toolbar — one action,
 * one button, the same self-contained-in-the-iframe pattern click-to-edit already uses. None of
 * them asks for confirmation: ADR 0014 is explicit that a delete runs immediately, with the undo
 * it offers afterwards as the only safety net, and the same directness applies to the rest, which
 * are no more destructive than a delete and get the identical net.
 *
 * Adding a section (day 6) is the same pattern once more: a dashed rule broken by an "Añadir
 * sección aquí" pill in each gap between sections, injected into the frame because only the
 * frame knows where the gaps fall. What the pill may offer is decided outside this component and
 * arrives as `offers` — "Contacto y reservas" is the one section that cannot be born blank, its
 * button being a destination rather than text, so it is offered only when question 5 gave one,
 * and its absence is explained rather than left as a hole in the list.
 */
export function Editor({
  title,
  document: doc,
  onEditText,
  onDeleteSection,
  onDuplicateSection,
  onMoveSection,
  onInsertSection,
  onPickPhoto,
  onFillSlot,
  onClearSlot,
  onSetSectionInMenu,
  onSetPageInMenu,
  onSetSiteDescription,
  onSetSiteUrl,
  onSetVariant,
  designTools,
  switchNotice,
  onDesignToolsChange,
  onEscalateSection,
  placementWasMoved,
  onRevertSection,
  onSetPlacement,
  onSetMobilePatch,
  onMoveUpOnMobile,
  pageId,
  onSelectPage,
  onSectionToPage,
  onRenameCollection,
  onDeleteCollection,
  onAddEntry,
  onAddEntryPage,
  onCollectionFromList,
  onBindList,
  onUnbindList,
  onSetEntryField,
  onRemoveEntry,
  onMoveEntry,
  onRenamePage,
  onMovePage,
  onDeletePage,
  onPageToSection,
  onAddItem,
  onRemoveItem,
  onMoveItem,
  onPickPalette,
  onPickTypePair,
  onPickFamily,
  onPickScale,
  onSetElementStyle,
  onSetMark,
  photoUrls,
  photoError,
  offers,
  contactUnavailable,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  failedSamples = [],
  onRetrySamples,
  savedWhere,
  photosMissing,
  onSaveToAccount,
  toast,
  onDismissToast,
  onBack,
}: {
  title: string;
  document: RetorikaDocument;
  onEditText: (
    address: ElementAddress,
    text: string,
    marks?: readonly MarkRun[],
    /** The rows the text now needs, measured on the live page (ADR 0050 §3, día 6). It travels in
     * the same history step as the words: one letter must not cost two presses of «Deshacer». */
    rowSpan?: number,
  ) => void;
  onDeleteSection: (sectionId: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, toIndex: number) => void;
  onInsertSection: (catalogId: string, index: number) => void;
  /** The owner chose a file for this image element. Preparing and storing it is `Variants`'
   * business; this component only reports which element was clicked. */
  onPickPhoto: (address: ElementAddress, file: File) => void;
  onFillSlot: (fill: SlotFill) => void;
  onClearSlot: (address: SlotAddress) => void;
  /** A section in or out of the menu (ADR 0043). Not a content edit: nothing the section says
   * changes, only whether it is announced. */
  onSetSectionInMenu: (sectionId: string, inMenu: boolean) => void;
  /** The page half of the same decision (ADR 0043 §3), dispatched from «Páginas». */
  onSetPageInMenu: (pageId: string, inMenu: boolean) => void;
  /** What a shared link says about the whole site (ADR 0029). Site-wide like the theme, so neither
   * names a section. */
  onSetSiteDescription: (text: string) => void;
  onSetSiteUrl: (url: string | undefined) => void;
  /** A different composition for one section, chosen from its own menu. */
  onSetVariant: (sectionId: string, variantId: string) => void;
  /**
   * Whether the design tools are on for this viewport (ADR 0025). What it controls here is narrow
   * and worth stating: it decides whether a section offers «Diseñar a mano» and whether a free one
   * wears its bar. It changes **nothing** about the document, the preview or the published page —
   * turning the tools off leaves every hand-designed section exactly as it is, because the depth
   * belongs to the person looking and not to the site.
   *
   * `undefined` means the editor's own window is too narrow to offer them at all.
   */
  designTools: boolean | undefined;
  /** Whether this browser agreed to remember the switch. Passed straight through to the rail: the
   * canvas has no business with it, and `Variants` is where the write that failed happened. */
  switchNotice: SwitchNotice;
  onDesignToolsChange: (on: boolean) => void;
  /** This section starts being designed by hand, and goes back to the catalog's layout. One
   * history step each, so Ctrl+Z covers the first minutes — which is what the advanced dossier §5
   * asks for and the reason day 4's dialog is about the durable case rather than this one.
   *
   * `boxes` is what the canvas measured the instant before (ADR 0050 §3): the fine grid's rows are
   * eight real pixels, so the only way «no se mueve nada al empezar» can be true for a section the
   * catalog had centred is to write the rows the elements actually had. Both doors measure. */
  onEscalateSection: (sectionId: string, boxes?: readonly MeasuredBox[]) => void;
  /**
   * Whether anybody has laid this section out by hand, which decides whether the return warns.
   *
   * **A prop and not a comparison** (ADR 0050, sprint 25 día 2): the answer lives in the undo
   * history, which `Variants` holds, and the document cannot be asked any more — escalation
   * measures the live page, so a freshly escalated layout equals no re-derivation of the catalog's
   * drawing. `wasPlacementEverMoved` is the selector.
   */
  placementWasMoved: (sectionId: string) => boolean;
  /** `decisions` names one choice per element the preset cannot place. Absent means the interface
   * made none, and `revertSection` then hides every surplus element rather than deleting it — which
   * is only ever the case for a return that had nothing to decide. */
  onRevertSection: (
    sectionId: string,
    decisions?: Readonly<Record<string, SurplusDecision>>,
  ) => void;
  /** One element moved or resized inside its section's twelve-column grid (rule 4). A partial edit,
   * because one press of a stepper is one number; the panel never sends a value `setPlacement`
   * would refuse, which is what keeps that refusal a backstop rather than a path. */
  onSetPlacement: (sectionId: string, elementId: string, edit: PlacementEdit) => void;
  /**
   * Rule 7's three adjustments, and no fourth: `breakpointPatchSchema` is a strict object of exactly
   * `hidden`, `order` and `columnSpan`, so the mobile view cannot quietly grow into the second design
   * the rule exists to prevent.
   *
   * Both refuse a section the catalog still draws, and that refusal is the honest one rather than a
   * backstop: patches live inside `layout`, and a catalog section has `layout: null` — there is
   * nowhere to put them. So adjusting the mobile of a catalog section goes through designing it by
   * hand first, which is the dossier §5's own first entry point. The panel only offers these once the
   * section is free, so nobody meets the refusal.
   */
  onSetMobilePatch: (sectionId: string, elementId: string, edit: MobilePatchEdit) => void;
  onMoveUpOnMobile: (sectionId: string, elementId: string) => void;
  /** Which page the canvas is showing. Undefined means the document's first, which is what
   * `render` already means by an absent `pageId`. */
  pageId: string | undefined;
  onSelectPage: (pageId: string | undefined) => void;
  /** This section becomes a page of its own (ADR 0022). One history step, so one «Deshacer»
   * takes back the page, the move and the avance together. */
  onSectionToPage: (sectionId: string) => void;
  onRenameCollection: (collectionId: string, name: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onAddEntry: (collectionId: string, fields: Record<string, EntryField>) => void;
  /** A page per entry for a collection (ADR 0040 §6): one stored page, drawn once per entry. The
   * title is composed here from `es.json`, because it is what the tabs and «Páginas» show. */
  onAddEntryPage: (collectionId: string, titleField: string, title: string) => void;
  /** Make a list out of the cards a section already has — the lossless way in (ADR 0033). */
  onCollectionFromList: (sectionId: string, slot: string, name: string) => void;
  onBindList: (sectionId: string, slot: string, collectionId: string) => void;
  /** ADR 0033 §7's exit, which is the section's and never a card's. */
  onUnbindList: (sectionId: string, slot: string) => void;
  onSetEntryField: (
    collectionId: string,
    entryId: string,
    field: string,
    value: EntryField,
  ) => void;
  onRemoveEntry: (collectionId: string, entryId: string) => void;
  onMoveEntry: (collectionId: string, entryId: string, toIndex: number) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onMovePage: (pageId: string, toIndex: number) => void;
  onDeletePage: (pageId: string) => void;
  /** That conversion, undone: the page's sections go back where its avance is, and both the
   * avance and the page are gone. One history step, like the conversion itself. */
  onPageToSection: (pageId: string) => void;
  /** One more line in a section's list, or one gone. The line is built by the catalog here and
   * re-minted by the schema, so neither end has to know what a valid one is made of. */
  onAddItem: (sectionId: string, slot: string, item: ListItem) => void;
  onRemoveItem: (sectionId: string, slot: string, itemId: string) => void;
  onMoveItem: (sectionId: string, slot: string, itemId: string, toIndex: number) => void;
  /** A palette or a pair of typefaces chosen in the Estilo panel. This component says which
   * one was picked; assembling the new theme and putting it in the document is `Variants`'
   * business, the same division as every other verb here. */
  onPickPalette: (paletteId: string) => void;
  onPickTypePair: (typePairId: string) => void;
  /** One letter from the gallery, by its real name, for the headings or for the text (ADR 0046).
   * Writes one font token where a pair writes both, which is what makes the two halves separate
   * choices. */
  onPickFamily: (key: FontKey, family: string) => void;
  onPickScale: (scaleId: string) => void;
  /** One property of one element's own style, from the floating toolbar (rule 6). `undefined`
   * takes the property away and lets the site's own rule show through again. Available with the
   * design tools off as well as on: the advanced dossier §4 gives «color del tema» to everybody. */
  onSetElementStyle: (
    address: ElementAddress,
    property: StyleProperty,
    value: StyleValue | undefined,
  ) => void;
  /**
   * Bold or italic over the characters currently selected (ADR 0024, ADR 0027).
   *
   * The offsets are the ones the document uses, read off the selection inside the frame. `on`
   * says which way the press goes, because `B` is one button and the editor already knows whether
   * what is selected is bold.
   */
  onSetMark: (address: ElementAddress, range: MarkRange, mark: Mark, on: boolean) => void;
  /** Object URLs for photos already uploaded, keyed by the `src` the document carries. The
   * preview needs them because a bundle-relative path resolves against the parent page inside a
   * `srcDoc` iframe and 404s — the same trap `placeholder-image.ts` documents. */
  photoUrls: ReadonlyMap<string, string>;
  photoError: string | null;
  offers: readonly SectionOffer[];
  /** Whether to explain the absence of "Contacto y reservas" from `offers`. */
  contactUnavailable: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saveStatus: SaveStatus;
  /** Bank photographs whose fetch failed, by `src`. A download cannot succeed while any remain. */
  failedSamples?: readonly string[];
  onRetrySamples?: (() => void) | undefined;
  savedWhere?: SavedWhere | undefined;
  /** Forwarded to the indicator: how many of this site's photographs are not in the account.
   * `null` means nothing has been counted, which is not the same as none missing. */
  photosMissing?: number | null | undefined;
  onSaveToAccount?: (() => void) | undefined;
  toast: DeleteToast | null;
  onDismissToast: () => void;
  onBack: () => void;
}) {
  const [state, setState] = useState<DownloadState>("idle");
  /** When «Descargar» (or «Descargar igualmente») was pressed — what the minimum is measured from. */
  const buildingStartedAt = useRef(0);
  // What `requestDownload` found the last time «Descargar» was pressed — `null` means neither
  // dialog is open. Recomputed fresh on every press rather than kept in sync with `doc`, because
  // a dialog open while the owner keeps editing behind it would go stale the moment they change
  // the one photograph it is about.
  const [downloadDialog, setDownloadDialog] = useState<DownloadGate | null>(null);
  /**
   * Which warnings this download attempt has already been taken past.
   *
   * It exists because a site can be two kinds of not-quite-ready at once — an unfilled photo
   * marker and a hard-to-read colour — and each deserves its own sentence. Cleared by starting a
   * fresh attempt, never carried across presses: `requestDownload` sets it from its own argument,
   * so closing a dialog and pressing «Descargar» again asks every question over.
   */
  const [acceptedWarnings, setAcceptedWarnings] = useState<ReadonlySet<AcceptedWarning>>(new Set());
  // On a phone the editor opens in the mobile view, which at 320px sits at zoom 1 in the room a
  // phone has, where the desktop page would be a 0.5 scale nobody can read (ADR 0042 §2). The
  // desktop view stays a press away and scales, as it always has. Decided once, on first render:
  // this never runs on the server, and setting it through `changeDevice` would animate the first
  // paint as a change.
  const [device, setDevice] = useState<"desktop" | "mobile">(() =>
    isPhoneViewport() ? "mobile" : "desktop",
  );
  /**
   * **One frame, and its document outlives every edit** (ADR 0051; `swap` retired on sprint 27
   * día 1). It is mounted once, given the first document's html as `srcDoc`, and from then on the
   * page inside it is only ever patched — so the node is never removed, never re-inserted and
   * never reloaded. There was a second slot here until the 27, and the pair of them existed so a
   * rebuild could happen out of sight; with nothing to rebuild, the buffer, its key, its deadline
   * and the promotion went with the route.
   */
  const frame = useRef<HTMLIFrameElement>(null);
  /**
   * Which element the floating toolbar is on, across what every edit does to the canvas: a patch
   * and the redraw that reopens the bar (`settleToolbar`).
   *
   * A ref and not state, for the same reason `fileInputRef` below is: nothing on the React side
   * renders from it, and making it state would re-render the whole editor on every focus. It is
   * ephemeral interface state either way — like the design-tools switch, it belongs to the person
   * looking and never to the site, so it is not in the document (`INV_4`).
   */
  const toolbarOn = useRef<ElementAddress | null>(null);
  /**
   * Which text is **chosen** in the canvas, across what every edit does to it — a patch
   * (ADR 0047, sprint 24 día 7; ADR 0051).
   *
   * A ref for the reason `toolbarOn` above is one: nothing on the React side renders from it, and
   * it belongs to the person looking rather than to the site. It is also what makes «Esc stops
   * writing and leaves the text chosen» survive what a commit does: the element is the same node
   * across the patch, and `settleEditing` marks it again from this ref after every one. Under
   * `swap` it was a different node in a new document with the same address, which is why the
   * address and not the node is what this holds.
   */
  const chosenText = useRef<ElementAddress | null>(null);
  /**
   * What the editor says out loud about a move, **in its own document** (ADR 0049).
   *
   * **The region does not live inside the canvas**, which is David's correction and, under the old
   * route, a defect it would have shipped: every arrow is an edit, every edit replaced the frame's
   * whole `srcDoc`, so a region in there would have been a freshly created one on every move — and
   * a screen reader does not announce the contents of a region that has just appeared. The frame's
   * document now survives every edit and a region in it would too. **It stays here on purpose**,
   * and the reason has changed rather than gone: it is the editor speaking, not the page, and the
   * page is what gets published (ADR 0051's amendment to ADR 0049 §3).
   */
  const [announcement, setAnnouncement] = useState("");
  /**
   * A counter that makes the **same** sentence audible twice.
   *
   * An `aria-live` region announces a change, so «La sección no crece más hacia abajo» twice in a
   * row would be read once. The parity of this counter appends a zero-width space — invisible, and nothing a
   * screen reader reads out — so the second refusal is a change like any other.
   */
  const announcements = useRef(0);
  /**
   * Whether the chosen element should have the keyboard back after this edit — after the patch,
   * read by `settleDragging` from the redraw.
   *
   * **Only a keyboard move asks for it**, which is the whole reason it is a flag rather than a rule:
   * the restoration deliberately does not focus anything, because an edit made by pressing a swatch
   * or a verb must leave the keyboard where the hand was. But an arrow that moves an element and
   * then loses the focus makes the *second* arrow do nothing — three presses, one movement — and
   * David asked for exactly that assertion when he approved the sprint.
   */
  const keepChosenFocus = useRef(false);
  /**
   * Which text should be **written in** again after this edit, if any — after the patch
   * (`settleWriting` reads it from the redraw; sprint 26 día 4).
   *
   * `keepChosenFocus` above restores the outline and the keyboard; this restores the state, and it
   * exists for one gesture: stretching a text's box by its edge while writing in it (ADR 0050, día
   * 4). The placement is an edit like any other and the commit happens first (`el.blur()`), so the
   * element comes out of it chosen rather than being written in — a person who pulled an edge would
   * be left with a box the right size and no caret in it. Nothing typed is lost either way.
   */
  const keepWriting = useRef<ElementAddress | null>(null);
  /** `wireSelection`'s settling tail, callable after a structural patch (día 3). */
  const settleSelection = useRef<() => void>(() => {});
  /**
   * Repaint the touch handles — **one painter per document** (día 7).
   *
   * A ref and not a call, because the two halves are on opposite sides of the frame: `markChosen`
   * knows *when* the handles should change and `wireResizing` is where the gesture they begin is in
   * scope. Empty until the chrome has been wired, and for any document whose design tools were off:
   * a section with no placements has nothing to stretch.
   *
   * **One slot again, because there is one document** (sprint 27 día 1). This was a
   * `WeakMap<Document, …>` for as long as the editor had two live documents whenever an edit was in
   * flight — the one on screen and the buffered one being built — and a single slot held «the
   * painter of whatever was wired last», so choosing in the visible frame repainted the handles
   * into the buffered one and the element the hand had just chosen showed none. On this machine the
   * swap had always finished first; on CI it had not. With `swap` retired the two documents cannot
   * exist, so the question the map answered has one answer and a ref is it. The correction is kept
   * written down because the defect was invisible locally.
   */
  const handlePainter = useRef<(() => void) | null>(null);
  /**
   * Which device view is on **right now**, for the listeners that outlive the render that wired them.
   *
   * **A ref because the switch does not rebuild the document**, which is a stale-closure trap the
   * walk caught: turning the design tools on replaces the frame, so a gate read at wiring time stays
   * true; switching to the phone only changes the canvas card's width, so `wireDragging`'s listeners
   * kept the `device` they were created with and drew the twelve stripes on a one-column page.
   */
  const deviceNow = useRef(device);
  deviceNow.current = device;

  /**
   * **Every value a handler reads comes through a «now» ref** (ADR 0051 §5, sprint 26 día 3).
   *
   * The handlers the canvas wires used to capture `doc`, `designTools` and every callback at
   * wiring time, and that was correct only because each edit threw the document away and wired
   * the next one with the next render's values. The document — and its listeners — now outlive
   * every edit, so a captured `doc` is the document from before the edit, and a captured
   * `onDeleteSection` closes over a history that has since moved. `deviceNow` above is the
   * precedent: the device switch never rebuilt the document either. `closureGuard.test.ts` holds
   * the wiring to these — no bare `doc`, no bare prop — because one read missed is a handler
   * acting on a document that no longer exists, silently.
   */
  const docNow = useRef(doc);
  const photoUrlsNow = useRef(photoUrls);
  const pageIdNow = useRef(pageId);
  docNow.current = doc;
  /** What a patch is made of besides the document (día 5): read through refs because `applyPatch`
   * also runs from `wireOnce`, whose closure can be renders behind — measured as a pending patch
   * applied at wiring with the photo URLs of the render that queued it, so the bank's photographs
   * never replaced their sample names on the keyboard walk. */
  photoUrlsNow.current = photoUrls;
  pageIdNow.current = pageId;
  const designToolsNow = useRef(designTools);
  designToolsNow.current = designTools;
  const propsNow = useRef({
    onAddItem,
    onDeleteSection,
    onDuplicateSection,
    onEditText,
    onEscalateSection,
    onInsertSection,
    onMoveItem,
    onMoveSection,
    onMoveUpOnMobile,
    onRemoveItem,
    onSectionToPage,
    onSelectPage,
    onSetElementStyle,
    onSetEntryField,
    onSetMark,
    onSetPlacement,
    onSetVariant,
    onUnbindList,
  });
  propsNow.current = {
    onAddItem,
    onDeleteSection,
    onDuplicateSection,
    onEditText,
    onEscalateSection,
    onInsertSection,
    onMoveItem,
    onMoveSection,
    onMoveUpOnMobile,
    onRemoveItem,
    onSectionToPage,
    onSelectPage,
    onSetElementStyle,
    onSetEntryField,
    onSetMark,
    onSetPlacement,
    onSetVariant,
    onUnbindList,
  };

  /** Undo and redo, marked as such for the patch that follows (adjustment 2): the one change that
   * is applied to the text being written in, caret kept. */
  const undoFromHistory = () => {
    pendingCause.current = "history";
    onUndo();
  };
  const redoFromHistory = () => {
    pendingCause.current = "history";
    onRedo();
  };
  /** The document the fresh tree is built in, which has no browsing context and loads nothing
   * (adjustment 4). Made on first use, kept for the session. */
  const inertDoc = useRef<Document | null>(null);
  /** The page the last patch drew, so a change of page can start at the top (día 4). */
  const patchedPageId = useRef<string | null>(pageId ?? null);
  /** Where the next patch comes from (adjustment 2; día 4): `history` for undo and redo, `mark`
   * for a mark set from the text's own toolbar — both applied to the focused text as well, the
   * selection kept. Set by the call that changes the document, read and cleared by the patch that
   * follows; `edit` otherwise. */
  const pendingCause = useRef<PatchCause>("edit");
  /** A patch that arrived while a hand was on the page, waiting for the hand to let go
   * (adjustment 3). The gesture's own end calls `flushQueuedPatch`. */
  const queuedPatch = useRef(false);
  const flushQueuedPatch = useRef<() => void>(() => {});
  /** A patch that arrived before the first document was wired; `wireOnce` applies it. */
  const pendingPatch = useRef(false);
  /** One per applied patch or wiring — the e2e's signal that an edit is on the page. */
  const editSerial = useRef(0);
  const announce = (text: string) => {
    announcements.current += 1;
    setAnnouncement(announcements.current % 2 === 0 ? `${text}\u200B` : text);
  };
  /**
   * How the drag opens the «Diseñar a mano» offer that `wireSelection` draws (ADR 0048 §6).
   *
   * A ref and not a second copy of the popup: the offer, its anchoring, its keyboard and its
   * «no» are forty lines inside `wireSelection`'s closure, and a drag that opened its own version
   * would be a second door with its own bugs. Re-assigned on every wiring, like everything else
   * that lives per document.
   */
  const openEscalateOffer = useRef<((sectionId: string, opener: HTMLElement) => void) | null>(null);
  /**
   * How far this section's floating text bar has been pushed from where it would otherwise go.
   *
   * **A displacement and not a position.** The bar is computed afresh for every element it opens
   * on — it flips above or below, it clamps — so a remembered position would have to be
   * re-dragged for each of a cover's five texts, and would freeze a bar whose whole job is to
   * keep following the words. A displacement says what the person meant: in this section, keep it
   * further over than it would otherwise be, and the same sentence applies to the next paragraph
   * they touch.
   *
   * Same contract as the verbs' cluster: a ref, by section id, for this session, never the
   * document, no history step.
   */
  const toolbarOffset = useRef<Map<string, Point>>(new Map());

  /**
   * The words that were chosen, so **using the bar does not cost you them**.
   *
   * Reported by direction as «el cursor de texto», and the defect was written into the shape of
   * this repository's own test for it: the walk that puts both marks on «beber» clicks the text and
   * selects the word *again* between pressing B and pressing I. Using the bar changes the document,
   * the document reloads the frame, and the selection lives in the document that was just thrown
   * away. `wireToolbar` already puts the **bar** back — its note records the earlier half of this
   * same fault, «a person got exactly one press per click into the text» — but with no selection
   * the «Resaltar» group hides itself, because mockup 18 band 2 says those buttons are not drawn
   * without one. So there was nowhere to press for the second mark.
   *
   * Kept as character offsets rather than as a `Range`, which is the only form that can survive:
   * applying a mark splits one text node into three, so every node reference in the old document
   * is meaningless in the new one while `{ from, to }` still names the same letters.
   */
  const lastSelection = useRef<{
    sectionId: string;
    elementId: string;
    from: number;
    to: number;
  } | null>(null);

  /**
   * Put the chosen words back, in an element that has just been rebuilt (`swap`) or patched (`patch`).
   *
   * **The focus needs no guard against `wireEditing`'s select-all, and I measured that rather than
   * reasoned it.** A first version carried a `restoringSelection` flag so the focus handler would
   * skip selecting the whole field; removing the flag changed nothing, because `focus()` dispatches
   * synchronously and the two lines below replace whatever it selected before the browser paints.
   * There is no flash to prevent and so no flag to keep — this file's own rule about the toolbar's
   * `max-width` applies: «proved redundant: removing it changes nothing… It is not kept as
   * insurance».
   *
   * `preventScroll` **is** load-bearing: `focus()` scrolls its element into view by default, which
   * would undo the reading position restored a few lines later in `wireOnce` and give back the jump
   * that `restoreReadingPosition` exists to remove.
   */
  function restoreSelection(
    iframeDoc: Document,
    el: HTMLElement,
    want: { from: number; to: number },
  ) {
    const selection = iframeDoc.getSelection();
    if (!selection) return;
    const frame = textFrameOf(el.textContent ?? "");
    const start = domPointAt(el, frame.indent + want.from);
    const end = domPointAt(el, frame.indent + want.to);
    if (!start || !end) return;
    const range = iframeDoc.createRange();
    try {
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
    } catch {
      // Offsets that no longer fit the text — the edit shortened it under us. Leaving the selection
      // alone is the honest answer; a range guessed from stale numbers would mark the wrong letters.
      return;
    }
    el.focus({ preventScroll: true });
    selection.removeAllRanges();
    selection.addRange(range);
  }
  // One input, reused: the picker is opened from inside the frame, and the element that asked
  // for it is remembered here until a file comes back.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImage = useRef<ElementAddress | null>(null);
  // Which section's fields are open, if any. Not tied to selection: clicking a word to edit it
  // selects the section too, and a form sliding in every time someone touches a sentence would
  // be in the way rather than at hand.
  const [fieldsFor, setFieldsFor] = useState<string | null>(null);
  const [rail, setRail] = useState<RailItemId>("sections");
  /** Whether the switch's own question — «¿Quieres colocar tú cada elemento?» — is open. State rather
   * than a ref because the popover is React's to draw, unlike everything inside the canvas. */
  const [askingDesignTools, setAskingDesignTools] = useState(false);
  /**
   * Which section and element the «Diseño» panel is about.
   *
   * State, unlike `selectedSection` below, and that difference is the whole point: the canvas
   * selection is a ref precisely because nothing React renders depends on it, and this panel is the
   * first thing that does. `select()` inside the frame writes both, so the panel follows the canvas
   * — clicking a section is how you choose what to lay out, which is the only ordering that makes
   * sense when the grid you are working against is drawn on that section.
   *
   * Setting these does not reload the frame: `html` is memoised on the document, the photos and the
   * page, so a re-render produces the identical string and the selection survives.
   */
  const [designSectionId, setDesignSectionId] = useState<string | null>(null);
  const [designElementId, setDesignElementId] = useState<string | null>(null);
  /**
   * The section whose return is being confirmed, and what that return would cost.
   *
   * Held together rather than recomputed while the dialog is open, for the reason `requestDownload`
   * gives about its own two dialogs: what is shown has to be the document **as it stood when the
   * button was pressed**. Recomputing would let an autosave or a redo change the list of things
   * being decided about while somebody is deciding.
   */
  const [revertFor, setRevertFor] = useState<{ sectionId: string; impact: RevertImpact } | null>(
    null,
  );
  /**
   * Which section is selected, and whether its composition menu is open — remembered across the
   * preview's re-renders, which is what makes trying compositions usable at all.
   *
   * The document stays and `redrawChrome` draws the selection again from this ref after every
   * patch (sprint 26 día 3). Under the old route every action replaced the iframe's whole `srcDoc`,
   * so the outline, the handles and the action cluster were destroyed and rebuilt on each one, and
   * without this ref that cost one click to get back — which nobody noticed, because you rarely
   * delete the same section twice.
   * Composition is the first action anyone will repeat deliberately — the whole point is to look at
   * two and keep one — and re-selecting between each try would be a click and a hunt every time.
   *
   * Refs, not state: nothing React renders depends on them. They are read by `wireSelection` when
   * the frame finishes loading, which is outside React's render pass entirely.
   */
  const selectedSection = useRef<string | null>(null);
  /**
   * Where each section's verbs have been dragged to, for as long as this session lasts.
   *
   * **Not in the document, and that is the decision rather than an implementation detail.** A
   * toolbar's position changes nothing a visitor would ever see; writing it into the project would
   * make the document re-serialise for a thing that is not part of it (`INV_4`), would travel in
   * the ZIP, and would put a toolbar nudge in the undo history beside the owner's own words. David
   * asked for «por sección, mientras editas», which is exactly this: a ref, keyed by section id,
   * reapplied by `select()` after every redraw, gone on reload.
   *
   * A ref and not state for the reason the rest of `wireSelection` is one: it has to survive what
   * an edit does to the frame, which is redrawing its chrome over a patched page.
   *
   * Stored **unclamped**. The clamping happens when it is applied, so a bar placed far right on a
   * wide editor comes back to exactly that place after a trip through the mobile view, where it
   * had to be drawn somewhere much narrower.
   */
  const actionsPlace = useRef<Map<string, Point>>(new Map());
  /**
   * Which section the canvas's keyboard is on, by **id and not by index** (sprint 17 day 3).
   *
   * A ref and not state, for the reason the whole of `wireSelection` is: this has to survive the
   * frame being replaced, and replacing the frame is what every edit does. An index would not
   * survive it — a section deleted above the keyboard's place shifts every index below — so the id
   * is kept and the index is looked up each time. `null` means «no section holds it», which is a
   * real state and not an error: a frame just rebuilt (`swap`) has focus nowhere, and the roving tabindex
   * still has to leave a door open on the first section.
   */
  const keyboardSection = useRef<string | null>(null);
  /**
   * The verb that was just pressed, kept so the keyboard can be put back once the document it was
   * pressed in has been replaced (sprint 17 day 4).
   *
   * Four of the section's verbs change the page's sections — a structural patch — and two of those
   * take the section with it, so «put focus back» cannot mean «back on that element»: the element
   * is gone. What survives is a name — the section's id, the index it held, and which verb — and
   * `placeAfterRebuild` turns the first two into a place. Under `swap` the document it lived in was
   * gone too, which is how this came to be a name rather than a node.
   */
  const pendingReturn = useRef<{
    /** `null` for «there is no id to follow» — an insertion, where the section did not exist yet
     * and the index is the whole answer. */
    sectionId: string | null;
    /** A selector inside the section, or absent for the section itself. */
    within?: string;
    index: number;
  } | null>(null);
  /**
   * What the canvas should focus as soon as it is allowed to, and **«allowed to» is the whole
   * reason this is a ref and not a line of code.**
   *
   * A verb that changes how many sections a page has is one structural patch on the one document,
   * and `settleSelection` runs from the redraw (sprint 26 día 3). So the thing to focus exists by
   * the time anything looks for it, and this ref is what carries the asking across the patch.
   *
   * **Under `swap` it produced two documents and threw the first away**, which is the history this
   * ref was shaped by and worth keeping: the verb changed `html`, so the live frame's `srcDoc` was
   * replaced and that document wired; and it changed `chromeKey` — one character per section — so a
   * buffered swap also opened, parsed a *second* document in the other frame, wired that, and
   * promoted it. A move changed neither the count nor any section's `source`, so it never swapped,
   * which is why moving worked and duplicate, delete and «convertir en página» did not.
   *
   * Instrumented rather than reasoned about, because the first explanation was wrong: the log
   * showed focus **landing** on the right button (`took=true`, and the frame was not `inert`), then
   * a second wiring with nothing pending, then focus on the body. The intent was being spent on the
   * document that was about to be discarded. So the intent outlives a single wiring, and
   * `takeCanvasFocus` re-applies it on every document it is given.
   */
  const focusTarget = useRef<{ sectionId: string; within?: string } | null>(null);

  /**
   * Focus whatever `focusTarget` asks for, in the document given, and say nothing if it cannot.
   *
   * The chain is the same one `placeAfterRebuild`'s comment describes: the thing `within` names if
   * it is still there and still usable, else the section itself. A disabled button is skipped rather
   * than focused, because most engines refuse focus to one — which is precisely how focus ends up on
   * the body, the outcome this whole arrangement exists to prevent.
   *
   * **`within` is a selector and not a verb**, since sprint 17 day 5. It started as «the same verb
   * again» and the popups needed something the action cluster cannot express: after choosing a
   * composition the menu reopens, and the place to come back to is the choice now marked
   * `aria-pressed="true"` inside it, not the button that opened the menu. One field that names an
   * element inside the section covers both, and the fallback to the section covers whatever it
   * fails to find.
   */
  function takeCanvasFocus(doc: Document | null | undefined) {
    const want = focusTarget.current;
    if (!want) return;
    if (!doc) {
      record("focus", { want: want.sectionId, why: "no-doc" });
      return;
    }
    const section = doc.querySelector<HTMLElement>(`[data-section="${want.sectionId}"]`);
    if (!section) {
      // The section is not in this document at all, so there is nothing to wait for either.
      record("focus", { want: want.sectionId, why: "no-section", serial: serialOf(doc) });
      focusTarget.current = null;
      return;
    }
    // No `within` means the section itself, which is what an insertion wants: the thing that just
    // appeared is the news, and it has no button worth landing on.
    const again = want.within ? section.querySelector<HTMLButtonElement>(want.within) : null;
    const target = again && !again.disabled ? again : section;
    target.focus();
    /*
     * **Spent as soon as it lands, because the document it landed in is the only one there is.**
     *
     * This used to ask «and is the document going to stay», and it had to: under `swap` the log
     * read `isLive=true buffered=1 frames=2` during a duplicate — the live frame's own `srcDoc`
     * had already been replaced *and* a swap was in flight — so the document focus landed in was
     * discarded moments later and the intent had been spent on a corpse, which is how focus
     * reached the body. The test was «no frame is buffered», asked of the DOM rather than of the
     * buffer state, because this runs inside a closure that can be a render behind.
     *
     * With one document per session (ADR 0051 §1) the question has one answer, so landing is the
     * whole condition. `onLive` is kept in the record because it is still the thing that would be
     * false if this were ever handed a document that is not the canvas's.
     */
    const settled = doc === liveFrame()?.contentDocument;
    record("focus", {
      want: want.sectionId,
      within: want.within ?? null,
      serial: serialOf(doc),
      onLive: settled,
      landed: doc.activeElement === target,
    });
    if (settled && doc.activeElement === target) focusTarget.current = null;
  }
  const compositionMenuOpen = useRef(false);

  /**
   * At most one side surface at a time.
   *
   * The two are not variations of each other — the fields panel is fixed over the right edge and
   * the style panel sits beside the canvas — so with both open the fixed one covers the other. The
   * rule is enforced in both directions here rather than by stacking them, because there is no
   * reading in which having both open is what the person asked for: opening one is a statement
   * about what they are doing now.
   */
  function showRail(item: RailItemId) {
    setRail(item);
    // Any rail item that opens a panel closes the fields panel: **the row has one panel slot**, so
    // the second would replace the first. Until sprint 24 día 3 the reason was that both were
    // `fixed` over the right edge and the second covered the first; the rule is the same and its
    // reason is now structural. It used to name `style` alone, which was complete when `style` was
    // the only panel — `pages` arrived in sprint 5 and could already be covered, and `photos` would
    // have made three. `sections` is the one that does not, because the fields panel *is* its
    // panel.
    if (item !== "sections") setFieldsFor(null);
    // Going anywhere answers the question by walking away from it, which is an answer. Leaving it
    // hanging over a panel that just opened would be the only modal thing in this editor.
    setAskingDesignTools(false);
    // Opening «Diseño» adopts whatever the canvas already had selected, so somebody who clicked a
    // section and then reached for the panel does not have to click it again.
    if (item === "design" && designSectionId === null) setDesignSectionId(selectedSection.current);
  }

  /**
   * The rail item actually shown.
   *
   * «Diseño» exists only while the tools are on, so turning them off with the panel open has to
   * land somewhere. Derived rather than corrected in an effect: an effect would render the invalid
   * pairing once before fixing it, and `rail` is kept as it was so that turning the tools back on
   * returns to the panel rather than to `Secciones`.
   */
  // **Both gated items fall back, not just the first.** `design` has fallen back since sprint 8;
  // `collections` joins it, because the switch going off while either panel is open would otherwise
  // leave a panel on screen that the rail no longer offers a way back to.
  const GATED: readonly RailItemId[] = ["design", "collections"];
  const effectiveRail: RailItemId = GATED.includes(rail) && !designTools ? "sections" : rail;

  /**
   * Open the file picker for one image, from outside the canvas.
   *
   * The same three lines `wirePhotos` runs when the owner clicks the photograph itself, so the
   * «Fotos» panel is a second *way in* and not a second uploader: `preparePhoto`'s sniff, the
   * resize, the EXIF-stripping re-encode, the IndexedDB write and the `setImage` history step are
   * all the ones that already existed. Sprint 5 day 3 found three separate defects in that path;
   * a parallel one would be three more waiting.
   */
  function replacePhoto(address: ElementAddress) {
    pendingImage.current = address;
    const input = fileInputRef.current;
    if (!input) return;
    // Cleared first, so picking the same file twice in a row still fires a change.
    input.value = "";
    input.click();
  }

  /**
   * What «Volver a la original» actually does, which is not always the same thing.
   *
   * **Lossless returns do not ask.** The promise the offer makes is «puedes volver a la original
   * cuando quieras», and the dossier's own row is «Volver es un clic, no destruye nada». A section
   * escalated and left alone — or moved and moved back — loses nothing by returning, and a
   * confirmation over nothing destroyed would be friction defending against the promise it serves.
   *
   * Everything else opens the dialog, which is the only place the surplus decision is made.
   * `revertSection` still defaults to hiding, so the reducer can never be thrown into; the dialog is
   * what turns that default into a choice somebody saw.
   */
  function requestRevert(sectionId: string) {
    const found = findSection(doc, sectionId);
    if (!found) return;
    const impact = revertImpact(doc, sectionId, presetFor(found.section.preset.catalogId), {
      placementsMoved: placementWasMoved(sectionId),
    });
    if (!impact) return;
    if (impact.lossless) {
      onRevertSection(sectionId);
      return;
    }
    setRevertFor({ sectionId, impact });
  }

  /**
   * Open or close «Campos de esta sección», and carry the keyboard across the frame boundary with
   * it (sprint 17 day 5).
   *
   * The panel takes the focus itself on mount — it is a React component in the editor's own
   * document and can. **Coming back is this function's job**, because the thing to come back to is
   * a button `wireInteractions` drew inside the preview, and the panel knows nothing about it.
   * Without this a keyboard user closed the panel and was left on a button that had just been
   * unmounted, which is how focus reaches the body.
   *
   * `fieldsFor` is read before it is cleared, which is the only moment it still says which section
   * the panel belongs to.
   */
  function showFields(sectionId: string | null) {
    if (sectionId === null && fieldsFor !== null) {
      focusTarget.current = {
        sectionId: fieldsFor,
        within: '.rb-actions [data-action="fields"]',
      };
      takeCanvasFocus(liveFrame()?.contentDocument);
    }
    setFieldsFor(sectionId);
    if (sectionId !== null) setRail("sections");
  }

  // `render` is deterministic, so an unchanged document yields the identical string and the
  // iframe's `srcDoc` does not change — which is what keeps a device toggle or a download from
  // reloading the preview and throwing away the current selection.
  // Rendered from a display copy: every image whose src names an uploaded file gets the object
  // URL for its bytes instead. The document itself keeps the bundle-relative name, which is what
  // the ZIP needs — a relative path inside a `srcDoc` iframe resolves against the parent page's
  // URL and 404s, which is exactly why the placeholder is a data: URI and not a file.
  /**
   * Which entry a page drawn per entry is shown for, per page (ADR 0040): the owner's choice from
   * «Viendo:» in the «Páginas» panel while the entry still exists, the collection's first otherwise.
   * Derived against the document on every render rather than trusted, so removing the chosen entry
   * falls back instead of asking the renderer for an entry it would refuse.
   */
  const [entryByPage, setEntryByPage] = useState<Record<string, string>>({});
  function entryShown(forPageId: string | undefined): string | undefined {
    const page = doc.pages.find((candidate) => candidate.id === (forPageId ?? doc.pages[0]?.id));
    const binding = page?.binding;
    if (!page || !binding) return undefined;
    const collection = doc.collections.find((candidate) => candidate.id === binding.collectionId);
    const chosen = entryByPage[page.id];
    if (chosen !== undefined && collection?.entries.some((entry) => entry.id === chosen))
      return chosen;
    return collection?.entries[0]?.id;
  }
  const previewEntryId = entryShown(pageId);
  /** The entry shown, for `applyPatch` (día 5): declared here, where the value is. */
  const previewEntryIdNow = useRef(previewEntryId);
  previewEntryIdNow.current = previewEntryId;

  /**
   * **The bytes of the first paint, and they are the published ones.**
   *
   * Computed once, at mount, and never again: the frame's `srcDoc` is set from this and the
   * document inside it is patched from then on (ADR 0051 §1). It was a `useMemo` over
   * `[doc, photoUrls, pageId, previewEntryId]` while `swap` lived, because that route re-set
   * `srcDoc` on every change — the rebuild. Nothing re-reads it now, so a memo would be a
   * recomputation nobody collects; `useState`'s initialiser runs once and that is the whole
   * requirement.
   */
  const [initialHtml] = useState(() => {
    // `entryHints` (ADR 0033 §10): each card drawn from a collection entry says which entry it is.
    // **Only here.** The document cannot supply it — a binding carries no entry id and every card
    // shares the template's `data-id` — and a published page must never carry it, which is why the
    // option is off by default and `buildSite` does not pass it. `entryId` says which entry a page
    // drawn per entry shows (ADR 0040), and is likewise the editor's business alone.
    const options = {
      entryHints: true,
      ...(pageId === undefined ? {} : { pageId }),
      ...(previewEntryId === undefined ? {} : { entryId: previewEntryId }),
    };
    // `withPhotoUrls` since sprint 6 day 4, when this logic moved out of here and became shared.
    // It had been inline, and the three "elige por dónde empezar" cards rendered the raw document
    // instead — invisible for as long as a generated site's only image was the placeholder, and a
    // broken image on all three cards the moment the generator started asking the bank.
    return render(withPhotoUrls(doc, photoUrls), "html", options).html;
  });

  /**
   * The one frame, and the one document in it.
   *
   * `liveFrame` is the name every call site has used since sprint 15, when there were two slots and
   * the question «which one is on screen» had an answer that changed. It is kept because the answer
   * is now always the same and 19 call sites asking it is not a reason to rename anything.
   */
  function liveFrame(): HTMLIFrameElement | null {
    return frame.current;
  }

  function liveDoc(): Document | null | undefined {
    return liveFrame()?.contentDocument;
  }

  /**
   * The canvas: one `<iframe>`, mounted once, never keyed, never reloaded.
   *
   * `srcDoc` is the first document's html and **nothing re-sets it** (ADR 0051 §1), so the
   * `Document` inside it is the one the whole session edits and every change reaches it as a patch.
   * `wireOnce` attaches the chrome as soon as the page is parsed, which the look-ahead reaches long
   * before `load` — `load` waits out the font requests, and that wait was a window in which the
   * whole preview was visible and completely inert. `onLoad` stays as the backstop.
   *
   * **What used to be here**, until sprint 27 día 1: two absolutely positioned slots, one of them
   * `inert`, `aria-hidden` and `tabIndex={-1}` while it loaded a document behind the live one, a
   * `key` of `chromeKey` and a serial, a promotion when the buffered one finished, a deadline that
   * fell back to a visible remount, a remembered page colour so the frame with nothing in it was
   * not white, and a fade that had to be withheld from every arrival but the first. All of it
   * existed so that a rebuild could happen out of sight. There is no rebuild.
   *
   * `ui-fade-in` is unconditional now: the one arrival is the first one, which has no previous
   * frame to carry and does briefly show the surface colour underneath.
   */
  function previewFrame() {
    return (
      <iframe
        ref={frame}
        title={title}
        srcDoc={initialHtml}
        onLoad={(event) => {
          // **When `load` fired**, which is the number the look-ahead exists to beat: `load` waits
          // out the font requests, and the look-ahead wires the document at `DOMContentLoaded`.
          // Recorded whether or not this wiring does anything, because by the time it runs the
          // look-ahead has usually wired already and `wireOnce` returns at its first line.
          record("load", { wired: liveDoc()?.documentElement.dataset["rbWired"] === "1" });
          wireOnce(event.currentTarget, "onload");
        }}
        className="absolute inset-0 h-full w-full border-0 bg-ui-surface ui-fade-in"
      />
    );
  }

  /**
   * Look for the page every frame until it is there, and wire it the moment it is.
   *
   * **This is what actually closes the window** `wireOnce` describes; `onLoad` is only the
   * backstop. The parent cannot listen for the frame's `DOMContentLoaded`, because at the moment
   * `srcDoc` is set the document that will fire it does not exist yet. So the test is document
   * **identity**: keep looking until `contentDocument` is something the chrome is not attached to,
   * and has sections in it.
   *
   * **Once, at mount, because there is one document.** This used to re-run on every change of
   * `frameHtml` or `chromeKey` — both of which put a *new* document in the frame under `swap` — and
   * to aim at the buffered frame of a swap when there was one, promoting it when it was ready.
   * With `swap` retired (sprint 27 día 1) the only document that ever arrives is the first, so the
   * walk runs once and the deadline is what stops it.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, at mount; `wireOnce` is redeclared every render and reads the frame when it runs
  useEffect(() => {
    let tick = 0;
    const deadline = Date.now() + LOOK_AHEAD_DEADLINE_MS;
    const look = () => {
      const target = liveFrame();
      const iframeDoc = target?.contentDocument;
      /*
       * **Wiring does not end the walk — sprint 18 day 5, and the intermittent of sprint 7.**
       * This used to `return` after `wireOnce`, and six probed failures showed what that cost:
       * the bank's photographs replaced `srcDoc` a few milliseconds after the first document's
       * html, before that document had been wired; this effect re-ran, found the *first* document
       * still in the frame, wired it, and returned — so the *second* document arrived unwired and
       * waited for `load`. The decision is a pure function (`lookAheadStep`) and the rule is:
       * wire, and keep looking until the deadline. The identity guard and the `data-rb-wired` mark
       * make the extra ticks free.
       *
       * A photograph arriving no longer replaces the document — it is an attribute in a patch — so
       * the case that taught this cannot happen. The rule is kept anyway: it costs one property
       * read per frame for two seconds, and it is the cheaper half of the pair.
       */
      const step = lookAheadStep({
        document: iframeDoc !== null && iframeDoc !== undefined,
        unwired: iframeDoc !== null && iframeDoc !== undefined && iframeDoc !== wiredDoc.current,
        parsed: iframeDoc?.readyState !== "loading",
        hasSection: iframeDoc?.querySelector("[data-section]") !== null,
        withinDeadline: Date.now() < deadline,
      });
      if (step === "wire") wireOnce(target, "lookahead");
      if (step !== "stop") tick = requestAnimationFrame(look);
    };
    look();
    return () => cancelAnimationFrame(tick);
  }, []);

  // The probe's view of the one paint there is (sprint 18 day 5, narrowed on 27 día 1: the two
  // things that used to put a new document in a frame were the rendered string changing and the
  // chrome key changing, and neither exists).
  useEffect(() => {
    record("html", { length: initialHtml.length });
  }, [initialHtml]);

  /**
   * **An edit is a patch** (ADR 0051, día 2) — the `patch` route's whole effect.
   *
   * Every change of the document, of a photograph's URL, of the page shown or of the entry shown
   * renders the tree again in the inert document and brings the live one in step with it. The
   * first document still arrives by `srcDoc` and is wired by the look-ahead; a change that lands
   * before that wiring waits for it (`pendingPatch`, applied at the end of `wireOnce`), a change
   * that lands while a hand is on the page waits for the hand (`queuedPatch`, applied by the
   * gesture's own end), and a change the patch cannot take yet — a changed skeleton, which is
   * día 3's — goes by the old route: the frame gets the current html and a new key.
   *
   * A change of `chromeKey` is structural by definition (the tools toggled, a section escalated
   * or returned, the count changed) and takes the old route on día 2 as well; día 4 teaches the
   * patch the chrome's half of those.
   */
  function bumpEdit(iframeDoc: Document) {
    editSerial.current += 1;
    iframeDoc.documentElement.dataset["rbEdit"] = String(editSerial.current);
  }
  function gestureLive(iframeDoc: Document): boolean {
    const root = iframeDoc.documentElement.classList;
    return (
      root.contains("rb-dragging") || root.contains("rb-resizing") || root.contains("rb-arrowing")
    );
  }
  function applyPatch(iframeDoc: Document) {
    if (gestureLive(iframeDoc)) {
      queuedPatch.current = true;
      record("patch", { ok: false, reason: "gesture", queued: true });
      return;
    }
    if (inertDoc.current === null) {
      inertDoc.current = document.implementation.createHTMLDocument("");
    }
    const pageId = pageIdNow.current;
    const previewEntryId = previewEntryIdNow.current;
    const display = withPhotoUrls(docNow.current, photoUrlsNow.current);
    const options = {
      entryHints: true,
      ...(pageId === undefined ? {} : { pageId }),
      ...(previewEntryId === undefined ? {} : { entryId: previewEntryId }),
      document: inertDoc.current,
    };
    const started = performance.now();
    const fresh = render(display, "dom", options);
    const cause = pendingCause.current;
    pendingCause.current = "edit";
    const report = patchCanvas(iframeDoc, fresh, buildCss(display), {
      cause,
      focused: iframeDoc.activeElement,
    });
    if (!report.ok) {
      // **There is no second route to fall back to** (sprint 27 día 1). Every refusal `patchCanvas`
      // could answer with was answered during sprint 26 — `structure` on día 3, `chrome` on día 4,
      // `gesture` above — and the one that is left is `no-body`, a document with no `<body>`, which
      // a wired canvas cannot be: `wireOnce` only runs on a document with a `[data-section]` in it.
      // So this is the house rule for the impossible rather than a path: an explicit throw, because
      // the silent alternative is a canvas that stops answering and a page that looks finished.
      record("patch", { ok: false, reason: report.reason });
      throw new Error(`the canvas refused a patch: ${report.reason}`);
    }
    const ms = Math.round((performance.now() - started) * 10) / 10;
    // The chrome follows the page (día 3): after every patch, structural or not, because a text
    // that grew moved the gap below it and a section that arrived has no verbs yet.
    const redrawMs = redrawChrome(iframeDoc);
    // Another page starts at the top (sprint 26 día 4): the one rule of the reading position that
    // is left, the document being never replaced and so never restored. The same page, patched,
    // keeps its scroll by doing nothing at all.
    const page = pageId ?? null;
    const pageChanged = patchedPageId.current !== page;
    patchedPageId.current = page;
    if (pageChanged) iframeDoc.defaultView?.scrollTo(0, 0);
    record("patch", { ...report, cause, ms, redrawMs, pageChanged });
    bumpEdit(iframeDoc);
  }
  /**
   * **Every piece of chrome, drawn again from the page as it now is** (ADR 0051 §5, día 3): the
   * gaps, the lines' verbs, the photographs' badges, the handmade bars, the hole, the grid, the
   * handles; then what each wiring used to settle at its end — the selection and the return of
   * focus, the chosen text, the focus a gesture asked to keep, the line just added. Each drawing
   * function clears its own chrome first, and no listener is attached here: the listeners are the
   * document's. Returns the cost, for the probe.
   */
  function redrawChrome(iframeDoc: Document): number {
    const started = performance.now();
    prepareTexts(iframeDoc);
    prepareDraggables(iframeDoc);
    drawGaps(iframeDoc);
    drawLines(iframeDoc);
    drawPhotoChrome(iframeDoc);
    wireHandmade(iframeDoc);
    // After every drawing that can add a button to a section, and before the settles that may
    // focus one: the stops of the holder are `0` and the rest `-1` (ADR 0052 §2).
    applyCanvasStops(iframeDoc);
    syncHole(iframeDoc);
    syncGrid(
      iframeDoc,
      designOnNow.current ? designSectionIdNow.current : null,
      placingElementIdNow.current,
    );
    settleSelection.current();
    settleEditing(iframeDoc);
    settleWriting(iframeDoc);
    settleDragging(iframeDoc);
    refreshWriting.current(iframeDoc);
    settleToolbar.current(iframeDoc);
    focusLineAfterChange(iframeDoc);
    observeSections(iframeDoc);
    handlePainter.current?.();
    return Math.round((performance.now() - started) * 10) / 10;
  }
  /**
   * **The canvas is one Tab stop, and a section's insides are stops only while that section holds
   * the keyboard** (ADR 0052 §1 and §2). One pass over the sections and over what is inside them,
   * run at wiring, after every patch and whenever the keyboard's place moves.
   *
   * The sections' half is the roving `tabindex` sprint 17 built: `0` on the holder, `-1` on the
   * rest, the first section as the door when nothing holds it. The insides' half is what that
   * model never said. `prepareTexts` gave every text a `0` on every repaint and `prepareDraggables`
   * every photograph and list with the tools on, nothing ever took one away, and the result was
   * measured on 23 October 2026: about seventy-five stops with the tools on, two hundred presses to
   * reach «Colocación» past them, and a section that could never be reached by Tab once a text of
   * it had been touched, because the `focusin` from the child moved the one `0` to its section —
   * always *behind* the cursor, so `Shift+Tab` was the only way forward.
   *
   * So the insides follow the holder, with `rovingTabIndexInside`: Tab from the holder enters its
   * own texts, verbs and photographs in document order, Tab after the last of them leaves the
   * canvas, and the other sections' insides are not in the way. A click still focuses a text at
   * `-1` — that is what `-1` means — so nothing changes for the hand.
   *
   * Three things are deliberately not this function's. The floating text bar keeps its own
   * contract (one stop on the grip, its controls at `-1`; the arrows are día 4's), so its insides
   * are skipped and the grip is treated like any other button. A placed element with the design
   * tools **off** is not a stop at all — it loses the attribute rather than keeping yesterday's
   * `0`, which is the «nothing ever took one away» above. And the gaps' pills live *between* the
   * sections, so they stay what they are: one native stop per gap, because «añadir una sección
   * aquí» has no other keyboard route.
   */
  function applyCanvasStops(iframeDoc: Document) {
    const sections = [...iframeDoc.querySelectorAll<HTMLElement>("[data-section]")];
    const id = keyboardSection.current;
    const at = id === null ? -1 : sections.findIndex((section) => section.dataset.section === id);
    const indexes = rovingTabIndex(sections.length, at);
    const stops: HTMLElement[] = [];
    const owners: number[] = [];
    for (const [index, section] of sections.entries()) {
      section.setAttribute("tabindex", String(indexes[index] ?? -1));
      for (const el of section.querySelectorAll<HTMLElement>(CANVAS_STOP)) {
        if (el.closest(".rb-toolbar") && !el.classList.contains("rb-toolbar-grip")) continue;
        const placed = el.dataset["id"] !== undefined && !EDITABLE_TAGS.has(el.tagName);
        if (placed && designToolsNow.current !== true) {
          el.removeAttribute("tabindex");
          continue;
        }
        stops.push(el);
        owners.push(index);
      }
    }
    const inside = rovingTabIndexInside(owners, sections.length, at);
    for (const [index, el] of stops.entries()) {
      const want = String(inside[index] ?? -1);
      if (el.getAttribute("tabindex") !== want) el.setAttribute("tabindex", want);
    }
  }
  /** What `wireEditing` registers for the redraw: a text the patch rewrote under the caret
   * (history or its own mark) has its capture re-read from the document, or the next commit would
   * carry the marks from before. */
  const refreshWriting = useRef<(iframeDoc: Document) => void>(() => {});
  /**
   * **The commit, for the floating bar** (ADR 0052 §4, día 3): `wireEditing` registers it and
   * `wireToolbar` calls it before writing a mark, so the words being typed are in the document
   * before anything marks them. `unchanged` until a document is wired, which is the truth: there
   * is no text being written in.
   */
  const commitWriting = useRef<
    (el: HTMLElement) => "no-address" | "reverted" | "written" | "unchanged"
  >(() => "unchanged");
  /** What `wireToolbar` registers for the redraw: the open bar drawn again from the document, with
   * its selection put back — what the wiring did on every rebuild (día 4). */
  const settleToolbar = useRef<(iframeDoc: Document) => void>(() => {});
  flushQueuedPatch.current = () => {
    if (!queuedPatch.current) return;
    queuedPatch.current = false;
    const iframeDoc = liveFrame()?.contentDocument;
    if (iframeDoc) applyPatch(iframeDoc);
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: the switch is the trigger; the redraw reads everything else through refs
  useEffect(() => {
    // **The switch redraws, it does not rebuild** (día 4). The document stays and the chrome is
    // drawn again over it — the handles, the bars, the Tab stops the tools add — and the serial
    // moves, because a walk waiting on «a patch or a repaint» is waiting for exactly this. Skipped
    // on mount: the wiring draws the first chrome. Under `swap`, retired on 27 día 1, toggling the
    // tools instead changed `chromeKey` and a whole new document arrived wired for them.
    const iframeDoc = liveFrame()?.contentDocument;
    if (!iframeDoc || iframeDoc.documentElement.dataset["rbWired"] !== "1") return;
    if (toolsDrawn.current === designTools) return;
    toolsDrawn.current = designTools;
    const redrawMs = redrawChrome(iframeDoc);
    record("redraw", { cause: "tools", designTools, redrawMs });
    bumpEdit(iframeDoc);
  }, [designTools]);
  const toolsDrawn = useRef(designTools);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the four listed are what a patch is made of; everything else is read through refs or is the render's own
  useEffect(() => {
    const iframeDoc = liveFrame()?.contentDocument;
    // Wired is a mark the document carries, not a ref's identity (sprint 18 día 5): under `swap`,
    // after a chrome swap, two documents were wired in a row and `wiredDoc` named the last one,
    // which need not have been the one on screen — a patch parked on that identity test never came
    // back, measured on día 2. With one document the two tests agree, and the mark is kept because
    // it is the document's own answer rather than a ref's memory of it.
    if (!iframeDoc || iframeDoc.documentElement.dataset["rbWired"] !== "1") {
      pendingPatch.current = true;
      return;
    }
    applyPatch(iframeDoc);
  }, [doc, photoUrls, pageId, previewEntryId]);

  /**
   * The grid stripes follow the selected section, **without** remounting the frame.
   *
   * `designSectionId` is deliberately not part of `chromeKey`. Adding it there was the obvious move
   * and it was wrong: `select()` sets it on every click, so keying on it would reload the frame on
   * every click and throw away the selection that very click had just made — the editor would
   * deselect whatever you pressed.
   *
   * Nothing here attaches a listener, so nothing needs re-wiring: it is one class, on or off. The
   * same toggle also runs at the end of `wireHandmade`, because after a remount (`swap`) this effect can fire
   * before the new frame has loaded, and both directions are idempotent.
   */
  function syncGrid(
    iframeDoc: Document | null | undefined,
    sectionId: string | null,
    elementId: string | null,
  ) {
    if (!iframeDoc) return;
    for (const element of iframeDoc.querySelectorAll<HTMLElement>("[data-section]")) {
      const wanted = element.dataset.section === sectionId && element.classList.contains("rb-free");
      element.classList.toggle("rb-designing", wanted);
    }
    // And the one element being stepped, outlined, so the numbers in the panel and the thing on the
    // page are visibly the same subject. `data-id` is what the renderer emits (`build.ts`).
    for (const element of iframeDoc.querySelectorAll<HTMLElement>("[data-id]")) {
      element.classList.toggle(
        "rb-placing",
        elementId !== null && element.dataset["id"] === elementId,
      );
    }
  }

  /**
   * Which element the outline is on — resolved by the same function the panel uses.
   *
   * `designElementId` is `null` until somebody clicks a row, while the panel steps the first row
   * from the moment it opens. Reading the raw state here is what left the canvas outlining nothing
   * while the numbers moved something: `selectedRowId` is now the one answer both read.
   */
  const designOn = designTools === true && effectiveRail === "design";
  const placingElementId = designOn
    ? selectedRowId(designSectionId ? designRows(doc, designSectionId) : [], designElementId)
    : null;

  useEffect(() => {
    syncGrid(liveDoc(), designOn ? designSectionId : null, placingElementId);
  });

  /**
   * The dashed notice mockup 11 draws **inside the canvas**, where the deleted section was.
   *
   * **Mockup 11 is the only approved screen that shipped half-built, and this is the other half.**
   * It draws two things for one delete: the dark toast at the bottom with «Deshacer», which has
   * existed since sprint 4, and a `2px dashed` panel in the flow of the page reading «Aquí estaba
   * «Opiniones»» over «El hueco desaparecerá solo en unos segundos.» Only the toast was built. The
   * toast says what happened; this says *where*, which on a long page is the part the toast cannot
   * give — a section deleted below the fold leaves a page that silently reflows, and «Deshacer»
   * sits at the bottom of the window pointing at nothing the person can see.
   *
   * **Its second line is not the mockup's, in the case ADR 0014 created.** «Desaparecerá solo en
   * unos segundos» is true of a section nobody had edited: six seconds, then both go. A section the
   * owner *had* edited gets no timer at all — ADR 0014 keeps its toast until it is undone or
   * dismissed — so for that one the mockup's sentence would be a promise the product does not keep,
   * and the notice says what actually happens instead. `REVIEW.md` records the divergence and why
   * the drawing loses this clause: it was drawn before the two-speed toast existed.
   *
   * **Injected chrome, not rendered output**, like every other `rb-` node: the section is gone from
   * the document the instant it is deleted (ADR 0003 — there is no trash inside the document), so
   * there is nothing for the renderer to draw. It cannot reach a published page because it is put
   * here, on the live frame, and `render(doc, "html")` never runs this code.
   *
   * It runs on every render rather than on frame load, because it has to **leave** when the toast
   * does — the six-second timer changes no document and reloads no frame — which is the same reason
   * `syncGrid` above is shaped this way. It also runs at the end of `wireInteractions`, and from
   * `redrawChrome` after every patch (sprint 26 día 3) — under `swap` that was what drew it again
   * after a delete, because the reload wiped every `rb-` node with it.
   *
   * **A guard against a stale frame was written here, measured, and removed** (`swap`). A delete
   * changed the document, which changed `srcDoc`, which reloaded the frame — so the reasoning was that this render
   * could land while the old page, deleted section and all, was still on screen, and put the notice
   * beside the very section it says is gone. Instrumented over a real delete it **never once
   * happened**: two calls, both against a frame that had already dropped the section, zero stale. The
   * `srcDoc` swap is in place before a passive effect runs. Taken out on the same grounds the bar's
   * own `max-width` was a few hundred lines down — «proved redundant: removing it changes nothing…
   * It is not kept as insurance» — and the measurement left here so that somebody who does see the
   * notice flash in the wrong place knows this was looked at rather than missed.
   */
  function syncHole(iframeDoc: Document | null | undefined) {
    if (!iframeDoc) return;
    // Removed first, always: the only state this function has is the DOM, and rebuilding is what
    // keeps «no toast», «a second delete» and «the same delete» from needing three code paths.
    for (const old of iframeDoc.querySelectorAll(".rb-hole")) old.remove();
    if (!toast) return;
    // The page being shown, resolved the way the renderer resolves it: absent means the first one.
    const shown = pageId ?? doc.pages[0]?.id;
    if (toast.pageId !== shown || toast.index < 0) return;

    const sections = [...iframeDoc.querySelectorAll<HTMLElement>("[data-section]")];
    const hole = chrome(iframeDoc, "div");
    hole.className = "rb-hole";
    hole.setAttribute("role", "status");
    const was = chrome(iframeDoc, "span");
    was.className = "rb-hole-was";
    was.textContent = es["editor.hole.was"].replace("{name}", toast.sectionName);
    const fate = chrome(iframeDoc, "span");
    fate.className = "rb-hole-fate";
    fate.textContent = toast.persistent ? es["editor.hole.stays"] : es["editor.hole.goes"];
    hole.append(was, fate);

    // Where the section was: before whichever one took its place, or after the last if it was last.
    const after = sections[toast.index];
    if (after) after.before(hole);
    else sections[sections.length - 1]?.after(hole);
  }

  useEffect(() => {
    syncHole(liveDoc());
  });

  /**
   * `Meta+Z` and the rest, against the history the «Deshacer» button already drives.
   *
   * **A second road to the same verb, not a second verb.** `documentHistory` has had undo since
   * sprint 2 and the button has driven it correctly all along; what did not exist was any key
   * handler at all — no `metaKey`, no `ctrlKey`, no `key === "z"` anywhere in `apps/editor/src` —
   * while seven places in the repository described the shortcut as a thing the product had.
   *
   * **`canUndo` is deliberately not consulted.** `undo` and `redo` return the same history when
   * there is nothing to do, so the press is already a no-op — and reading the flag here would mean
   * the frame's listener, which is installed once per iframe load, held whatever value was true at
   * that moment. A stale guard that refuses a legitimate undo is worse than a press that does
   * nothing.
   */
  const handleShortcut = (event: KeyboardEvent) => {
    const shortcut = shortcutFor(event);
    if (!shortcut) return;
    const target = event.target;
    // Built by reading the two properties, rather than cast or tested with `instanceof`: the frame
    // has its own `window`, so an element from inside it fails `instanceof HTMLElement` against this
    // document's constructor — the one cross-realm trap in a listener that runs in two documents.
    const focused =
      target !== null && typeof target === "object"
        ? {
            tagName: String((target as { tagName?: unknown }).tagName ?? ""),
            isContentEditable:
              (target as { isContentEditable?: unknown }).isContentEditable === true,
          }
        : null;
    if (keepsItsOwnUndo(focused)) return;
    event.preventDefault();
    if (shortcut === "undo") undoFromHistory();
    else redoFromHistory();
  };

  // The editor's own document. The frame's is wired in `wireInteractions`, because a key pressed
  // inside an `<iframe>` is dispatched in that document and never reaches this one.
  useEffect(() => {
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  });

  /**
   * Where each photograph stands, by address, so the canvas can label the ones that came from the
   * bank.
   *
   * Read from the document rather than from the markup, because the markup deliberately does not
   * say: the renderer never emits `sample`, which is what keeps «Foto de ejemplo» from being
   * something a published page could ever carry. `listPhotos` is the same function the «Fotos»
   * panel and the pre-download warning read, so all three agree by construction about which
   * photographs are not the owner's.
   */
  const photoStates = useMemo(() => {
    const states = new Map<string, PhotoState>();
    for (const photo of listPhotos(doc)) {
      states.set(addressKey(photo.sectionId, photo.elementId), photo.state);
    }
    return states;
  }, [doc]);

  // Marker text warns, it never blocks: what an added section says is a matter of taste the
  // owner can see and fix in a second, unlike a button pointing nowhere, which the download
  // route refuses outright. Counted by value against the catalog's own markers — the document
  // has no flag saying "still a placeholder", and adding one would be a schema change to record
  // something the text already says.
  const placeholders = useMemo(
    () =>
      listEditableFields(doc).filter(
        (field) => field.text !== undefined && isPlaceholderText(field.text),
      ).length,
    [doc],
  );

  /**
   * **No link inside the preview ever navigates.** The canvas is a picture of the site, not a copy
   * of it that can be browsed.
   *
   * The bug this fixes was reported from the deployed app and is worth writing down in full,
   * because the cause is not where anybody would look. The preview is fed through `srcDoc`, so the
   * frame has no URL of its own and **every relative href resolves against the parent's URL — the
   * editor**. A menu entry written `href="#sec-services"`, which is correct in the published file
   * and works from `file://`, resolves inside this frame to `http://…/#sec-services`: the editor's
   * own address. Clicking it loaded the editor into its own preview, that copy restored the same
   * session from `localStorage` and drew its own preview, and a second click nested again —
   * an editor inside an editor, without end.
   *
   * One delegated listener in the capture phase rather than a handler per anchor: it covers the
   * links the renderer *derives* — the menu (ADR 0023) has no `data-id`, so `wireEditing` never
   * saw it — as well as every link in the document and anything added later. Only the default
   * action is cancelled; focus happens on `mousedown`, so click-to-edit on a button's label still
   * places the cursor exactly as before.
   *
   * Doing nothing is deliberate for now, and it is what every other control in the preview already
   * does: «Reservar mesa» does not dial a telephone either. Making a menu entry move the editor to
   * that page belongs with the page tabs, which is the next day's work.
   */
  // The four «now» refs whose values are born after the block above — placed where all four
  // exist, and still at the component's top level so the hook order never changes.
  const photoStatesNow = useRef(photoStates);
  photoStatesNow.current = photoStates;
  const designOnNow = useRef(designOn);
  designOnNow.current = designOn;
  const designSectionIdNow = useRef(designSectionId);
  designSectionIdNow.current = designSectionId;
  const placingElementIdNow = useRef(placingElementId);
  placingElementIdNow.current = placingElementId;

  function wireLinks(iframeDoc: Document) {
    iframeDoc.addEventListener(
      "click",
      (event) => {
        // Duck-typed rather than `instanceof Element`: the node belongs to the frame's realm, and
        // an `instanceof` against this document's `Element` is false for every one of them.
        const target = event.target as { closest?: (selector: string) => unknown } | null;
        if (typeof target?.closest !== "function") return;
        const anchor = target.closest("a") as {
          getAttribute?: (n: string) => string | null;
        } | null;
        if (!anchor) return;
        event.preventDefault();

        // A menu entry moves the editor to that page, which is the one thing in the preview that
        // now *does* something. It is navigation the owner means, and the tabs do the same job;
        // what it must never be is a real navigation of the frame, which is what nested an editor
        // inside the editor. `./<slug>.html` is the published form, and the slug is the only part
        // of it anybody here needs.
        const href = anchor.getAttribute?.("href") ?? "";
        const destination = canvasLinkTarget(docNow.current, href);
        // A card's title link never reaches here: `wireEditing` unwraps it, so the click edits the
        // title (David's adjustment). What does reach here with an entry's slug is a link the owner
        // typed by hand to a ficha, and that moves the canvas to the ficha, the way a menu entry
        // moves it to a page. `canvasLinks.ts` makes the decision and is tested.
        if (destination.kind === "none") return;
        if (destination.kind === "entry") {
          setEntryByPage((previous) => ({
            ...previous,
            [destination.pageId]: destination.entryId,
          }));
        }
        propsNow.current.onSelectPage(
          docNow.current.pages[0]?.id === destination.pageId ? undefined : destination.pageId,
        );
      },
      true,
    );
  }

  function wireSelection(iframeDoc: Document) {
    // Read every time, never captured (ADR 0051 §5): a section can arrive or leave between two
    // uses of this, and a captured array would be the page from before.
    const sectionsNow = () => [...iframeDoc.querySelectorAll<HTMLElement>("[data-section]")];

    /**
     * The canvas becomes reachable: one Tab stop, arrows between the sectionsNow(), Enter to choose.
     *
     * **`role="group"` and not a named `<section>`, which is David's correction and he was right.**
     * `packages/renderer` emits `element("section", …)`, and a `<section>` with an accessible name
     * is a `region` **landmark** — so naming five to nine of them would have added five to nine
     * landmarks to the editor's accessibility tree, noise for anybody navigating by landmark and
     * present only while editing. `group` overrides that implicit role, so the section gets its
     * name without becoming a place.
     *
     * The name is `sectionDisplayName`, which is the Spanish the «Diseñada a mano» bar, the gap
     * notice and three panels already use. One name per section across the whole interface, so a
     * screen reader cannot come to call something what the panel beside it does not.
     */
    function describeForKeyboard() {
      const names = sectionsNow().map((section) =>
        sectionDisplayName(docNow.current, section.dataset.section ?? ""),
      );
      for (const [index, section] of sectionsNow().entries()) {
        section.setAttribute("role", "group");
        section.setAttribute("aria-label", names[index] ?? "");
      }
      applyRovingTabIndex();
    }

    /** The sections' roving `tabindex` and their insides', in one pass (ADR 0052 §2). */
    function applyRovingTabIndex() {
      applyCanvasStops(iframeDoc);
    }

    /**
     * What the editor says out loud when a section is chosen.
     *
     * **Both halves, because they answer different questions**, and David's adjustment allowed
     * either: `aria-current="true"` is the *state* — a reader arriving at this section later is
     * told it is the chosen one, which matters because the chosen section is what the six action
     * buttons act on — and the live region is the *event*, because choosing does not move focus and
     * a reader that is already on the section would otherwise hear nothing happen.
     *
     * `true` and not `page`: `menu.ts` explains the distinction where it uses `page`, and a section
     * is not a page. The region lives inside the frame rather than in the editor's chrome, because
     * that is the document the focus is in.
     */
    function announceChoice(sectionId: string) {
      for (const section of sectionsNow()) {
        if (section.dataset.section === sectionId) section.setAttribute("aria-current", "true");
        else section.removeAttribute("aria-current");
      }
      let region = iframeDoc.querySelector<HTMLElement>(".rb-announce");
      if (!region) {
        region = chrome(iframeDoc, "div");
        region.className = "rb-announce";
        region.setAttribute("role", "status");
        region.setAttribute("aria-live", "polite");
        iframeDoc.body.appendChild(region);
      }
      region.textContent = es["editor.canvasKeys.chosen"].replace(
        "{section}",
        sectionDisplayName(docNow.current, sectionId),
      );
    }

    /**
     * The key map, in Spanish, on screen — and **on screen the moment it is useful**, which is the
     * answer to where it goes rather than a way of hiding it.
     *
     * It is drawn inside the frame like every other piece of canvas chrome, and it appears when a
     * section takes the keyboard. The alternative homes were measured and rejected: the 58px top bar
     * has a right-hand group pinned at 673px with a browser-run guard over its widths, and the row
     * that holds the canvas is a flex row whose width a `ResizeObserver` turns into the zoom factor.
     * Putting a legend in either means changing a measured layout to document a keyboard.
     *
     * Appearing on arrival is not the hover trap `REVIEW.md` ruled against — «un control que solo
     * aparece bajo un puntero no existe para quien no tiene puntero». This is the opposite case: it
     * appears for the keyboard, it is not a control, and Tab is the universal gesture for «what is
     * focusable here», so the thing that reveals it is the thing it documents.
     *
     * `pointer-events: none`, because a legend that can swallow a click is a bug with a reason.
     */
    function showKeyLegend(visible: boolean) {
      let legend = iframeDoc.querySelector<HTMLElement>(".rb-keys");
      if (!visible) {
        legend?.remove();
        return;
      }
      if (legend) return;
      legend = chrome(iframeDoc, "div");
      legend.className = "rb-keys";
      // `aria-hidden`: a screen reader is told the keys by the section's own role and label plus
      // the live region, and reading a legend out on every arrow would be noise over the name of
      // the section somebody just moved to.
      legend.setAttribute("aria-hidden", "true");
      for (const text of [
        es["editor.canvasKeys.title"],
        es["editor.canvasKeys.move"],
        es["editor.canvasKeys.inside"],
        es["editor.canvasKeys.choose"],
        es["editor.canvasKeys.release"],
        // The way to the text bar, in the keys this machine needs (ADR 0052 §3, David's note 8:
        // without Fn a MacBook's F10 mutes the audio and never arrives). Then the bar's own keys.
        toolbarShortcutFor(window.navigator) === "mac"
          ? es["editor.canvasKeys.toBarMac"]
          : es["editor.canvasKeys.toBar"],
        es["editor.canvasKeys.bar"],
        es["editor.canvasKeys.grip"],
      ]) {
        const row = chrome(iframeDoc, "span");
        row.textContent = text;
        legend.appendChild(row);
      }
      iframeDoc.body.appendChild(legend);
    }

    /**
     * The keyboard for a popup the canvas draws: the composition menu and the offer to design a
     * section by hand (sprint 17 day 5).
     *
     * Both were reachable only by mouse — not because their choices are inaccessible, they are
     * `<button>`s, but because nothing moved focus into them, nothing moved it back, and Escape did
     * nothing at all. A popup a keyboard can open and not leave is worse than one it cannot open.
     *
     * **Neither is modal and neither gets a trap.** They sit over the section, any click outside
     * closes them, and `aria-modal` would be a claim that the rest of the page is unavailable —
     * which is false and, as `useFocusTrap`'s own note says, worse than never claiming it. So Tab
     * leaves and the popup stays: removing it from under a Tab would strand the focus that Tab was
     * computing. Escape is the key that means «I am done here», and it is the only one.
     *
     * The focus goes in on the choice already in use where there is one — the composition the
     * section is wearing, marked `aria-pressed="true"` — because that is where somebody reading the
     * menu starts from, and it tells them what they have before offering what they could have.
     */
    /**
     * Remember where the keyboard should come back to after this press changes the document — a
     * structural patch, which `placeAfterRebuild` turns into a place.
     *
     * The action buttons arm this themselves; the popups cannot, because what rebuilds is a button
     * **inside** what they open, and the place to return to is not the thing that was pressed.
     */
    function armReturn(sectionId: string, within: string) {
      pendingReturn.current = {
        sectionId,
        within,
        index: sectionsNow().findIndex((section) => section.dataset["section"] === sectionId),
      };
    }

    function wirePopup(panel: HTMLElement, opener: HTMLElement) {
      const choices = () => [
        ...panel.querySelectorAll<HTMLButtonElement>("button:not([disabled])"),
      ];
      const open = choices();
      (open.find((choice) => choice.getAttribute("aria-pressed") === "true") ?? open[0])?.focus();

      panel.addEventListener("keydown", (event) => {
        const list = choices();
        const active = iframeDoc.activeElement as HTMLElement | null;
        const action = popupKeyAction(
          {
            key: event.key,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
          },
          {
            count: list.length,
            at: active ? list.findIndex((choice) => choice === active) : -1,
          },
        );
        if (action.kind === "ignore") return;
        event.preventDefault();
        if (action.kind === "focus") {
          list[action.index]?.focus();
          return;
        }
        panel.remove();
        compositionMenuOpen.current = false;
        // Back to the button that opened it, which is the half that makes Escape a way out rather
        // than a way of losing your place. Guarded because a rebuild may have replaced it.
        if (opener.isConnected) opener.focus();
      });
    }

    /**
     * The verbs that replace the document, and therefore the ones with a focus to put back.
     *
     * `composition`, `handmade` and `fields` are left out: they **open** something — two popups and
     * a panel — and nothing is rebuilt until a choice is made inside them. Recording a return here
     * would leave a stale one waiting to hijack the next unrelated edit, which is exactly what
     * `handmade` did between day 4 and day 5: it was in this set, it rebuilds nothing on its own, so
     * pressing it armed a return the next text edit would have spent. Found on day 5 by reading the
     * three openers rather than by a failure, and this line is the fix.
     *
     * The returns for all three are armed from inside what they open, which is day 5's work: a
     * composition choice comes back to the reopened menu, «Sí, diseñar a mano» to the section, and
     * the fields panel to the button that opened it, across the frame boundary.
     */
    const REBUILDS = new Set(["move-up", "move-down", "duplicate", "to-page", "delete"]);

    /** The section the bar is inside, and the bar, both measured — what every rule here takes. */
    const boundsOf = (bar: HTMLElement, host: HTMLElement): Bounds => ({
      hostWidth: host.clientWidth,
      hostHeight: host.clientHeight,
      barWidth: bar.offsetWidth,
      barHeight: bar.offsetHeight,
    });

    /** Where the bar is now, in its section's own coordinates — `[data-section]` is the
     * `offsetParent`, which is what `position: relative` on it has been for since sprint 2. */
    const pointOf = (bar: HTMLElement): Point => ({ x: bar.offsetLeft, y: bar.offsetTop });

    /**
     * Put a popup under the bar that opened it, wherever that bar has been dragged to.
     *
     * **Without this the menu stays in the corner and the bar does not**, which is worse than not
     * being able to move the bar at all: a list of compositions floating away from the button that
     * opened it belongs to nothing. It does nothing while the bar is where the stylesheet puts it,
     * because the stylesheet already places the menu there — `style.left` is the honest test of
     * «has this been moved», since that is the one property `placeActions` writes.
     */
    function anchorPopup(popup: HTMLElement, host: HTMLElement) {
      const bar = host.querySelector<HTMLElement>(".rb-actions");
      if (!bar || bar.style.left === "") return;
      /*
       * **Only the horizontal is clamped, and that is a correction this walk made.** The first
       * version held the menu inside its section on both axes, the way the bar itself is held —
       * and measured, the compositions menu is 230px tall inside a «Comidas» that is 230px tall,
       * so «inside» meant on top of the button that opened it. These menus have always been
       * allowed to hang past their section's bottom edge; the stylesheet's own `top` does it too.
       * A menu over the section below is ordinary. A menu over its own opener is a bug.
       */
      const below = bar.offsetTop + bar.offsetHeight + VERB_SCALE.gap;
      const above = bar.offsetTop - popup.offsetHeight - VERB_SCALE.gap;
      // Above only when below would hang off the end of the page, where nothing can scroll to it —
      // and never above when that would go off the top, which is the same trap upside down.
      const page = host.ownerDocument.documentElement.scrollHeight;
      const reachable = host.offsetTop + below + popup.offsetHeight <= page;
      const y = reachable || above < 0 ? below : above;
      const rightmost = Math.max(BAR_INSET, host.clientWidth - popup.offsetWidth - BAR_INSET);
      const wanted = bar.offsetLeft + bar.offsetWidth - popup.offsetWidth;
      popup.style.right = "auto";
      popup.style.left = `${Math.min(Math.max(wanted, BAR_INSET), rightmost)}px`;
      popup.style.top = `${y}px`;
    }

    /**
     * Draw the bar where this section's own memory says, if it has one.
     *
     * Called from `select()` **after** the cluster is in the document, because a bar that is not in
     * a document has no width to place. Does nothing when the section has never been moved: the
     * stylesheet's corner is the default, and leaving it to CSS means one place decides it.
     */
    function placeActions(bar: HTMLElement, host: HTMLElement, sectionId: string) {
      const kept = actionsPlace.current.get(sectionId);
      if (!kept) return;
      const bounds = boundsOf(bar, host);
      const at = clampToHost(kept, bounds);
      bar.style.right = "auto";
      bar.style.left = `${at.x}px`;
      bar.style.top = `${at.y}px`;
      // The words go above the row once the bar is low enough that one below would be drawn past
      // the section's own edge.
      bar.classList.toggle("rb-actions-low", tipSide(at, bounds) === "above");
      for (const popup of host.querySelectorAll<HTMLElement>(".rb-compositions, .rb-escalate")) {
        anchorPopup(popup, host);
      }
    }

    /** Remember where the bar was put, and put it there. The memory is this section's and this
     * session's; nothing about it reaches the document. */
    function moveActions(bar: HTMLElement, host: HTMLElement, sectionId: string, at: Point) {
      actionsPlace.current.set(sectionId, at);
      placeActions(bar, host, sectionId);
    }

    /** Back to the corner, and forget that it was ever moved — which is what makes `Home` a way
     * out rather than a twentieth arrow press. */
    function homeActions(bar: HTMLElement, host: HTMLElement, sectionId: string) {
      actionsPlace.current.delete(sectionId);
      bar.removeAttribute("style");
      bar.classList.remove("rb-actions-low");
      for (const popup of host.querySelectorAll<HTMLElement>(".rb-compositions, .rb-escalate")) {
        popup.removeAttribute("style");
      }
    }

    /**
     * One of the section's verbs, as a button.
     *
     * **`verb` is a name that survives the document, which is what sprint 17 day 4 needed.** Every
     * one of these buttons is destroyed and built again on each edit — the whole frame is thrown
     * away and parsed — so «put the focus back where it was» cannot mean «back on that element».
     * The `data-action` is the handle: the same verb on the same section is findable in the
     * document that replaced the one the person pressed it in. The `aria-label` could not do the
     * job, being Spanish prose that a copy change would move.
     */
    function action(
      verb: string,
      label: string,
      /** One or two words, shown beside the button and never inside it — see the note above. */
      word: string,
      variant: "move" | "delete" | "grip",
      disabled: boolean,
      svg: string,
      /** Handed the button it is attached to, which an opener needs: a popup has to know what to
       * put the focus back on, and the only thing that knows is the thing that was pressed. */
      onClick: (button: HTMLButtonElement) => void,
    ): HTMLElement {
      const button = chrome(iframeDoc, "button");
      button.type = "button";
      // The grip stands in the same row and wears the same word, and is not a verb: its own class
      // rather than a verb's with half its properties undone.
      button.className = variant === "grip" ? "rb-grip" : `rb-action rb-action-${variant}`;
      button.dataset["action"] = verb;
      button.setAttribute("aria-label", label);
      button.disabled = disabled;
      button.innerHTML = svg;
      // Stopped here so the click does not also bubble to the section's own listener and
      // re-run select() on a section a move or a delete is about to displace or remove.
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (disabled) return;
        /*
         * **Remembered before the verb runs, because afterwards there is nothing to ask.** Four of
         * these verbs change the page's sections — a structural patch — and two of them (delete,
         * «convertir en página») take the section this button belongs to with it. The id, the index and the verb are everything `settle` needs to put
         * the keyboard back when the page is drawn again.
         *
         * Recorded for a mouse click too, and that is deliberate rather than sloppy: a browser
         * leaves focus on a button that was clicked, so a mouse user who has just pressed «subir»
         * three times wants the fourth press to be in the same place as the first. One behaviour
         * for both ways of pressing is also one behaviour to test.
         */
        /*
         * The section and its index are read from the DOM rather than passed in, and that is the
         * better answer rather than the convenient one: this helper is defined outside `select()`,
         * so it has neither in scope, and threading two more arguments through eight call sites to
         * tell a button something it is standing inside would be worse than asking.
         */
        const host = button.closest<HTMLElement>("[data-section]");
        const hostId = host?.dataset["section"];
        if (REBUILDS.has(verb) && host && hostId) {
          pendingReturn.current = {
            sectionId: hostId,
            within: `.rb-actions [data-action="${verb}"]`,
            index: sectionsNow().indexOf(host),
          };
        }
        onClick(button);
      });

      /*
       * **The word is a sibling of the button, never a child of it**, and that placement is the
       * decision rather than a detail of markup.
       *
       * Two things depend on it. The 320px sweep examines every `button` with text in it and
       * measures whether its words stay inside its box; the verbs have always been skipped by it
       * for being icon-only, and a word *inside* the button would newly put eight 32px discs into
       * a test about text overflowing — failing, correctly, and for no reason anybody wanted. And
       * `focus()` in the walks reads `dataset.action` off whatever holds focus, so the handle has
       * to stay on the focusable element itself.
       *
       * `aria-hidden`, because the button's `aria-label` already says «Subir esta sección»: a
       * screen reader that also read «Subir» would hear the same instruction twice, the second
       * time shorter. This is for the eyes — the pair of them that cannot tell eight white glyphs
       * apart, with a pointer or with a keyboard.
       */
      const wrapper = chrome(iframeDoc, "span");
      wrapper.className = "rb-verb";
      const tip = chrome(iframeDoc, "span");
      tip.className = "rb-tip";
      tip.setAttribute("aria-hidden", "true");
      tip.textContent = word;
      wrapper.append(button, tip);
      return wrapper;
    }

    /**
     * The handle the bar is moved by: last in the row, and the only part of it that drags.
     *
     * **Last and not first.** The verbs are the news — that is the argument sprint 17 day 3 made
     * for putting the whole cluster first in the DOM — and a handle is chrome about chrome. Last
     * also leaves every Tab count in this repository exactly as it was: `tabToVerb`'s fourteen, the
     * hundred and sixty to «Estilo» in the mouse-free walk, and the sprint 17 walks that count
     * presses to a named verb. A grip in front would have moved all of them for nothing.
     *
     * **One handle rather than a draggable bar**, which is the choice that makes the keyboard
     * possible at all. A bar you drag by its background cannot be moved without a pointer; a bar
     * you drag by a button can be moved by that button's own keys, and the rule this repository set
     * for itself in `REVIEW.md` — a drag needs its keyboard equivalent the same sprint — is then a
     * line of code rather than a second design. It is also what keeps a drag from starting on a
     * verb: pressing «Borrar» and moving the hand a little must still press «Borrar».
     *
     * Three ways in, one path out. A click sends the bar to the next corner; the arrows nudge it
     * sixteen pixels; `Home` puts it back and forgets. Enter and Space are *not* handled as keys —
     * on a `<button>` they fire a click, which is the corner cycle, so the keyboard and the mouse
     * share one implementation instead of two that have to be kept agreeing.
     */
    function gripFor(bar: HTMLElement, host: HTMLElement, sectionId: string): HTMLElement {
      /*
       * **A drag must not also cycle the corner.** `pointerup` after a real drag is followed by a
       * `click`, and without this the bar would land where it was dropped and then jump to a
       * corner. Cleared by the click it suppresses rather than on a timer: a flag that expires is
       * a flag that expires at the wrong moment on a slow machine.
       */
      let justDragged = false;

      const wrapper = action(
        "grip",
        es["editor.bar.grip"],
        es["editor.verb.grip"],
        "grip",
        false,
        `<svg width="${VERB_SCALE.icon}" height="${VERB_SCALE.icon}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.7"/><circle cx="15" cy="5" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="19" r="1.7"/><circle cx="15" cy="19" r="1.7"/></svg>`,
        () => {
          if (justDragged) {
            justDragged = false;
            return;
          }
          const bounds = boundsOf(bar, host);
          moveActions(bar, host, sectionId, cornerPoint(nextCorner(pointOf(bar), bounds), bounds));
        },
      );

      const grip = wrapper.querySelector("button") as HTMLButtonElement;

      grip.addEventListener("keydown", (event) => {
        const move = gripKeyAction(event);
        if (move.kind === "ignore") return;
        // Stopped as well as prevented: the canvas's own `keydown` listener is on the document in
        // the capture phase, and an arrow that reached it would move between sectionsNow() instead.
        event.preventDefault();
        event.stopPropagation();
        if (move.kind === "home") {
          homeActions(bar, host, sectionId);
          return;
        }
        moveActions(bar, host, sectionId, stepped(pointOf(bar), move, boundsOf(bar, host)));
      });

      /*
       * **Deltas between two events in this frame, which is what makes the zoom a non-question.**
       * The editor scales the whole canvas card with `transform: scale(zoom)` when the window is
       * narrow, so a pointer's position on the screen and the same pointer's position inside the
       * frame are different numbers. Following the pointer's *travel* — `to` minus `from`, both
       * read inside the frame — and adding it to a position also read inside the frame means the
       * scale cancels: the bar stays under the hand at any zoom, with nothing here knowing the
       * factor. The alternative, placing the bar at the pointer, would have needed it.
       *
       * No `preventDefault` on the press. It would suppress the compatibility mouse events, and
       * with them the focus a click puts on the grip — which is worth having, since after cycling
       * corners with the mouse the arrows are already in the right place. Text selection is held
       * off by `user-select` on `.rb-dragging` instead, which is the narrower instrument.
       */
      let from: Point | null = null;
      let start: Point = { x: 0, y: 0 };
      let moving = false;

      grip.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        from = { x: event.clientX, y: event.clientY };
        start = pointOf(bar);
        moving = false;
        // Captured, so a hand that outruns the bar keeps dragging it instead of dropping it the
        // moment the pointer leaves a 24px target.
        grip.setPointerCapture(event.pointerId);
        iframeDoc.documentElement.classList.add("rb-dragging");
      });

      grip.addEventListener("pointermove", (event) => {
        if (!from) return;
        const now = { x: event.clientX, y: event.clientY };
        if (!moving && !isDrag(from, now)) return;
        moving = true;
        justDragged = true;
        moveActions(bar, host, sectionId, dragged(start, from, now, boundsOf(bar, host)));
      });

      const release = () => {
        from = null;
        iframeDoc.documentElement.classList.remove("rb-dragging");
        flushQueuedPatch.current();
      };
      grip.addEventListener("pointerup", release);
      grip.addEventListener("pointercancel", release);
      grip.addEventListener("lostpointercapture", release);

      return wrapper;
    }

    /**
     * The list of compositions, hung under the action cluster.
     *
     * Same visual language as the "Añadir sección aquí" menu and built the same way — inside the
     * frame, because it is anchored to a section only the frame knows the position of. The choices
     * are a toggle group rather than a list of commands: one of them is always the one in use, so
     * each carries `aria-pressed` and the current one is marked rather than hidden.
     */
    function compositionMenu(sectionId: string, compositions: readonly Composition[]): HTMLElement {
      const panel = chrome(iframeDoc, "div");
      panel.className = "rb-compositions";

      const title = chrome(iframeDoc, "p");
      title.className = "rb-menu-title";
      title.textContent = es["editor.composition.title"];
      panel.appendChild(title);

      for (const composition of compositions) {
        const choice = chrome(iframeDoc, "button");
        choice.type = "button";
        choice.className = "rb-menu-choice rb-composition-choice";
        choice.setAttribute("aria-pressed", String(composition.current));
        const name = chrome(iframeDoc, "span");
        name.className = "rb-menu-name";
        name.textContent = composition.name;
        choice.appendChild(name);
        choice.addEventListener("click", (event) => {
          event.stopPropagation();
          /*
           * **Back into the menu, on the choice that is now in use** — not onto the button that
           * opened it. Choosing a composition changes the page (a patch) and
           * `compositionMenuOpen` brings the menu straight back, by design, «so the next try is one
           * click». For a keyboard that
           * means the next try should be one *press*, and the only way that is true is if the
           * keyboard is still inside the menu when it reappears. The `aria-pressed="true"` choice
           * is also the honest place: it is the answer to «what did that do».
           */
          armReturn(sectionId, '.rb-compositions .rb-menu-choice[aria-pressed="true"]');
          // Left open on purpose. Picking the composition already in use is a no-op all the way
          // down (`setVariant` hands back the same document), so the frame does not reload and
          // the menu would otherwise vanish for nothing; picking a different one reloads it, and
          // `compositionMenuOpen` is what brings the menu back so the next try is one click.
          propsNow.current.onSetVariant(sectionId, composition.variantId);
        });
        panel.appendChild(choice);
      }

      const note = chrome(iframeDoc, "p");
      note.className = "rb-menu-note";
      note.textContent = es["editor.composition.note"];
      panel.appendChild(note);

      return panel;
    }

    /**
     * The offer to design this section by hand — mockup 16 band 2, and the promise it has to make
     * before anybody accepts: «No se mueve nada al empezar, y puedes volver a la original cuando
     * quieras.» Both halves are true and neither is a figure of speech: `escalate` copies the layout
     * the catalog was already drawing, and the return is one press of the bar this puts there.
     *
     * The dossier §5's first entry point is «intenta algo que los controles simples no permiten… el
     * editor no dice que no: ofrece diseñar esa sección a mano». There is nothing to attempt yet —
     * the placement controls arrive on day 3 — so for now the offer hangs off the section's own
     * action cluster, where the other questions about where a section's parts sit already live.
     */
    function escalateOffer(sectionId: string): HTMLElement {
      const panel = chrome(iframeDoc, "div");
      panel.className = "rb-compositions rb-escalate";

      const title = chrome(iframeDoc, "p");
      title.className = "rb-menu-title";
      title.textContent = es["editor.section.escalate.title"];
      panel.appendChild(title);

      const body = chrome(iframeDoc, "p");
      body.className = "rb-menu-description";
      body.textContent = es["editor.section.escalate.body"];
      panel.appendChild(body);

      const row = chrome(iframeDoc, "div");
      row.className = "rb-escalate-row";

      const yes = chrome(iframeDoc, "button");
      yes.type = "button";
      yes.className = "rb-escalate-yes";
      yes.textContent = es["editor.section.escalate.yes"];
      yes.addEventListener("click", (event) => {
        event.stopPropagation();
        /*
         * Back to the section's own cluster. The offer is gone once it is accepted — the section is
         * hand-designed now — so there is nothing inside it to return to, and the `handmade` button
         * may or may not still be drawn. `takeCanvasFocus` tries it and falls back to the section,
         * which is the right answer either way: what changed is the section.
         */
        armReturn(sectionId, '.rb-actions [data-action="handmade"]');
        // `iframeDoc` and not `liveDoc()`: this handler lives in the document it has to measure,
        // and was wired into it before it became the visible one.
        propsNow.current.onEscalateSection(sectionId, measurePlaced(iframeDoc, sectionId));
      });
      row.appendChild(yes);

      const no = chrome(iframeDoc, "button");
      no.type = "button";
      no.className = "rb-escalate-no";
      no.textContent = es["editor.section.escalate.no"];
      no.addEventListener("click", (event) => {
        event.stopPropagation();
        panel.remove();
        compositionMenuOpen.current = false;
        /*
         * «No» means the same thing Escape means, so it leaves the keyboard in the same place.
         * Without this a keyboard user who declined the offer was left with focus on a button that
         * had just been removed from the document, which is how focus reaches the body.
         */
        focusTarget.current = { sectionId, within: '.rb-actions [data-action="handmade"]' };
        takeCanvasFocus(iframeDoc);
      });
      row.appendChild(no);

      panel.appendChild(row);
      return panel;
    }

    /**
     * The same door, for a drag that landed in a section the catalog draws (ADR 0048 §6).
     *
     * ADR 0025 §7 is not amended: **the escalation is offered and never done on its own.** So a
     * drag there moves nothing at all and asks the question instead — «nada se mueve al empezar» is
     * the offer's own promise, and a drag that silently rewrote a preset's layout would break it.
     */
    openEscalateOffer.current = (sectionId, opener) => {
      const target = iframeDoc.querySelector<HTMLElement>(
        `[data-section="${CSS.escape(sectionId)}"]`,
      );
      if (!target || compositionMenuOpen.current) return;
      const offer = escalateOffer(sectionId);
      target.appendChild(offer);
      anchorPopup(offer, target);
      compositionMenuOpen.current = true;
      wirePopup(offer, opener);
    };

    function select(target: HTMLElement, via: "click" | "restore" | "return" | "other" = "other") {
      record("select", {
        sectionId: target.dataset.section ?? null,
        via,
        serial: serialOf(iframeDoc),
        readyState: iframeDoc.readyState,
      });
      for (const section of sectionsNow()) {
        section.classList.remove("rb-selected");
        for (const el of section.querySelectorAll(".rb-actions, .rb-compositions")) {
          el.remove();
        }
      }
      target.classList.add("rb-selected");

      const sectionId = target.dataset.section;
      if (!sectionId) return;
      selectedSection.current = sectionId;
      /*
       * Choosing with the mouse moves the keyboard's place too, so Tab-ing back into the canvas
       * returns to the section somebody was just working on rather than to the top. One place, two
       * ways of moving it.
       */
      keyboardSection.current = sectionId;
      applyRovingTabIndex();
      announceChoice(sectionId);
      /**
       * The «Diseño» panel follows the canvas: clicking a section is how you choose what to lay out.
       *
       * **The element only resets when the section actually changes**, and getting that wrong cost a
       * real defect the day-6 walk found. `select()` runs on a genuine click *and* on the restore at
       * the end of `wireSelection` — `settle`, which puts the selection back after every edit,
       * from the redraw.
       * Clearing unconditionally meant every press of a mobile control threw the person back to the
       * first element in the tree — so «Subir» went dead and the next press acted on the wrong thing.
       */
      setDesignSectionId((current) => {
        if (current !== sectionId) setDesignElementId(null);
        return sectionId;
      });
      const index = sectionsNow().indexOf(target);

      const actions = chrome(iframeDoc, "div");
      actions.className = "rb-actions";
      /*
       * **`group` and not `toolbar`.** The WAI-ARIA toolbar pattern promises a keyboard a
       * particular contract: one Tab stop for the whole thing, and the arrows moving between the
       * controls inside it. This cluster keeps neither — every verb is its own Tab stop, which is
       * what sprint 17 day 4's walks are written against, and the arrows belong to the canvas for
       * moving between sectionsNow(). A role that announces a contract the keys do not honour is worse
       * than a plain group with a name, which is all this needs: eight buttons a screen reader
       * used to reach with nothing saying what they were eight of.
       */
      actions.setAttribute("role", "group");
      actions.setAttribute("aria-label", es["editor.actions.label"]);
      actions.appendChild(
        action(
          "move-up",
          es["editor.moveSectionUp"],
          es["editor.verb.moveUp"],
          "move",
          index <= 0,
          `<svg width="${VERB_SCALE.icon}" height="${VERB_SCALE.icon}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>`,
          () => propsNow.current.onMoveSection(sectionId, index - 1),
        ),
      );
      actions.appendChild(
        action(
          "move-down",
          es["editor.moveSectionDown"],
          es["editor.verb.moveDown"],
          "move",
          index < 0 || index >= sectionsNow().length - 1,
          `<svg width="${VERB_SCALE.icon}" height="${VERB_SCALE.icon}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>`,
          () => propsNow.current.onMoveSection(sectionId, index + 1),
        ),
      );
      // Sixth button, and it only appears when there is a choice to make: a section carrying its
      // own layout, or one the catalog gives a single composition, gets no button rather than a
      // dead one. Placed after the two moves because it answers the same kind of question — where
      // this section's parts sit — and before duplicate, fields and delete, which are about the
      // section as a thing.
      const compositions = compositionsFor(docNow.current, sectionId);
      if (compositions.length > 0) {
        actions.appendChild(
          action(
            "composition",
            es["editor.composition.open"],
            es["editor.verb.composition"],
            "move",
            false,
            `<svg width="${VERB_SCALE.icon}" height="${VERB_SCALE.icon}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/></svg>`,
            (button) => {
              const open = target.querySelector(".rb-compositions");
              if (open) {
                open.remove();
                compositionMenuOpen.current = false;
                return;
              }
              const menu = compositionMenu(sectionId, compositions);
              target.appendChild(menu);
              anchorPopup(menu, target);
              compositionMenuOpen.current = true;
              wirePopup(menu, button);
            },
          ),
        );
      }

      // The offer, and only while the tools are on and the catalog is still placing this section.
      // A free section has the bar instead, which is where its way back lives — two controls for
      // the same pair of states would be one too many, and the bar is visible without selecting.
      if (designToolsNow.current && !isHandDesigned(docNow.current, sectionId)) {
        actions.appendChild(
          action(
            "handmade",
            es["editor.section.escalate.yes"],
            es["editor.verb.handmade"],
            "move",
            false,
            `<svg width="${VERB_SCALE.icon}" height="${VERB_SCALE.icon}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h18"/></svg>`,
            (button) => {
              const open = target.querySelector(".rb-escalate");
              if (open) {
                open.remove();
                compositionMenuOpen.current = false;
                return;
              }
              const offer = escalateOffer(sectionId);
              target.appendChild(offer);
              anchorPopup(offer, target);
              compositionMenuOpen.current = true;
              wirePopup(offer, button);
            },
          ),
        );
      }

      actions.appendChild(
        action(
          "duplicate",
          es["editor.duplicateSection"],
          es["editor.verb.duplicate"],
          "move",
          false,
          `<svg width="${VERB_SCALE.icon}" height="${VERB_SCALE.icon}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`,
          () => propsNow.current.onDuplicateSection(sectionId),
        ),
      );
      // Seventh button, and the one this sprint exists for: «Convertir esta sección en página»
      // (ADR 0022). Drawn only when the conversion would actually work, which is the same rule the
      // composition button follows — a button that lights up and refuses is worse than no button.
      // Three kinds of section are never offered it (the cover is the page's h1 and its promise,
      // the footer is chrome, an avance is already a reference to a page), and neither is anything
      // once the site has the five pages the download route accepts.
      if (canConvert(docNow.current, sectionId)) {
        actions.appendChild(
          action(
            "to-page",
            es["editor.sectionToPage"],
            es["editor.verb.toPage"],
            "move",
            false,
            `<svg width="${VERB_SCALE.icon}" height="${VERB_SCALE.icon}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M14 3v6h6"/><path d="M14 3l6 6"/><path d="M11 13h9"/><path d="M17 10l3 3-3 3"/></svg>`,
            () => propsNow.current.onSectionToPage(sectionId),
          ),
        );
      }

      actions.appendChild(
        action(
          "fields",
          es["editor.fields.open"],
          es["editor.verb.fields"],
          "move",
          false,
          `<svg width="${VERB_SCALE.icon}" height="${VERB_SCALE.icon}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10"/><path d="M4 12h16"/><path d="M4 17h7"/><circle cx="18" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>`,
          () => showFields(sectionId),
        ),
      );
      actions.appendChild(
        action(
          "delete",
          es["editor.deleteSection"],
          es["editor.verb.delete"],
          "delete",
          false,
          `<svg width="${VERB_SCALE.icon}" height="${VERB_SCALE.icon}" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>`,
          () => propsNow.current.onDeleteSection(sectionId),
        ),
      );
      actions.appendChild(gripFor(actions, target, sectionId));
      /*
       * **First in the DOM, not last**, which is a change sprint 17 day 3 made on purpose and whose
       * cost is worth stating. The cluster is `position: absolute`, so nothing moves on screen; what
       * changes is Tab order. Appended, a keyboard had to walk through every `contenteditable` in
       * the section before reaching the verbs — which for a cover is a headline, a subheadline, body
       * copy and two buttons. Prepended, the verbs come first.
       *
       * The cost: a screen reader hears the chrome before the section's own words. In an editor that
       * is the right order — you came here to act on this section, and what you can do to it is the
       * news — but it is a judgement, and reverting it is moving one line.
       */
      target.prepend(actions);
      // After the prepend, because a bar that is not in a document has no width to place.
      placeActions(actions, target, sectionId);
    }

    // Delegated (ADR 0051 §5, día 3): one click and one focusin on the document, dispatched to the
    // section the event concerns — so a section that arrives with an edit is heard at once.
    delegate(iframeDoc, "click", "[data-section]", (section) => select(section, "click"));

    /*
     * Clicking into a section's text, or Tab-ing to it, moves the keyboard's place as well —
     * otherwise the arrows would act on wherever the place last was, which is somewhere the
     * person is not. `focusin` and not `focus`, because the thing receiving focus is usually a
     * child: a paragraph being edited, or one of the action buttons.
     */
    delegate(iframeDoc, "focusin", "[data-section]", (section, event) => {
      // The legend says the model the moment a section itself has the keyboard — by Tab as much
      // as by an arrow (ADR 0052 §7). A child taking focus is not that moment.
      if (event.target === section) showKeyLegend(true);
      const id = section.dataset.section;
      if (!id || keyboardSection.current === id) return;
      keyboardSection.current = id;
      applyRovingTabIndex();
    });

    /**
     * The canvas's own keys. Every decision is `sectionKeys.ts`'s; this is the wiring.
     *
     * On the frame's document in the **capture** phase, so it is reached before anything inside a
     * section can swallow it — and it still refuses every press that belongs to whoever has focus,
     * because `sectionKeyAction` asks `keepsItsOwnUndo` first. Registered once per wired document,
     * like the rest of this function.
     */
    iframeDoc.addEventListener(
      "keydown",
      (event) => {
        /*
         * **`at` is read from what has focus, not from the ref**, and that is the correction sprint
         * 17 day 4 made. The ref says which section the keyboard *belongs* to, which is the right
         * input for the roving `tabindex` and the wrong one for deciding whether a press is ours:
         * a section's six verbs are buttons inside the section, so the ref still named the section
         * while «bajar» had focus, and `Enter` was taken as «choose» instead of pressing the
         * button. Asking the DOM settles text, buttons, links and «nothing at all» with one rule.
         *
         * **Shape, never `instanceof`.** This handler closes over `iframeDoc` but runs in the
         * *parent* window's realm, and the frame has a realm of its own: an element from inside it
         * is not an instance of this window's `HTMLElement`. Measured in Chromium on 10 October
         * 2026 — `false` from here, `true` against the frame's own constructor — and `wireEditing`
         * carries two notes saying so.
         */
        const focused = iframeDoc.activeElement as HTMLElement | null;
        const at = focused ? sectionsNow().findIndex((section) => section === focused) : -1;
        const action = sectionKeyAction(
          {
            key: event.key,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
          },
          { count: sectionsNow().length, at },
        );
        if (action.kind === "ignore") return;
        event.preventDefault();

        if (action.kind === "focus") {
          const target = sectionsNow()[action.index];
          if (!target) return;
          keyboardSection.current = target.dataset.section ?? null;
          applyRovingTabIndex();
          target.focus();
          showKeyLegend(true);
          return;
        }
        if (action.kind === "choose") {
          // The focused section, not the remembered one: the two agree because `focusin` keeps the
          // ref in step, and reading the same source the decision was made from is what stops them
          // ever disagreeing in the one direction that matters.
          const target = sectionsNow()[at];
          if (target) select(target);
          return;
        }
        /*
         * Escape gives the keyboard back. The place is kept rather than cleared, so Tab returns to
         * the same section instead of the top — letting go of the canvas is not forgetting where
         * you were. Focus goes to the frame's own body, which is where it would be if nothing in
         * the canvas had ever been touched.
         */
        sectionsNow()[at]?.blur();
        showKeyLegend(false);
      },
      true,
    );

    describeForKeyboard();

    // Anywhere else in the page closes the composition menu, the same way the insertion menu
    // closes. Registered on the frame's document rather than the body so a click on the padding
    // around the sectionsNow() counts too.
    iframeDoc.addEventListener("click", (event) => {
      /*
       * **Duck-typed, and until sprint 17 day 3 this line was dead.** It read `target instanceof
       * Element`, and this callback runs in the parent window's realm while the target belongs to
       * the frame's — so the test was `false` for every click that ever reached it and the early
       * return never happened. Found while fixing the same mistake one screen below, in a handler
       * written the same day; the two notes at `wireEditing` already warned about exactly this,
       * which is the part worth recording.
       *
       * Nothing depended on it, and that is measured rather than assumed: the full `e2e` suite was
       * run with the condition working and stayed green. What actually keeps a click on the menu
       * from closing the menu is `stopPropagation` in `action()` and in each composition choice, so
       * this was belt over a working brace. It is fixed instead of deleted because a guard that
       * reads as load-bearing and is not invites somebody to remove the thing that is.
       */
      const target = event.target as Element | null;
      if (typeof target?.closest === "function" && target.closest(".rb-compositions, .rb-actions"))
        return;
      for (const menu of iframeDoc.querySelectorAll(".rb-compositions")) menu.remove();
      compositionMenuOpen.current = false;
    });

    // Put the selection back where it was before this render replaced the whole frame. A section
    // that is gone — deleted, and this is the render that removed it — simply does not come back,
    // which is the right answer without a special case for it.
    /**
     * **Settling the selection, the return of focus and the pending place — once at wiring, and
     * again after a structural patch** (sprint 26 día 3). This tail used to run only when a new
     * document was wired; a section inserted, moved or removed now changes what it reads without
     * any wiring at all, so `applyPatch` calls it through `settleSelection`.
     */
    const settle = () => {
      const remembered = selectedSection.current;
      if (remembered) {
        const target = sectionsNow().find((section) => section.dataset.section === remembered);
        if (target) {
          select(target, "restore");
          if (compositionMenuOpen.current) {
            const compositions = compositionsFor(docNow.current, remembered);
            if (compositions.length > 0) {
              const menu = compositionMenu(remembered, compositions);
              target.appendChild(menu);
              anchorPopup(menu, target);
              /*
               * **Wired here too, or the menu that comes back is the one nobody can use.** This is
               * the reopening the mouse has had since the menu shipped — `compositionMenuOpen` brings
               * it back after a choice «so the next try is one click» — and until sprint 17 day 5 it
               * came back inert to a keyboard: no focus in it, no arrows, no Escape.
               */
              const opener = target.querySelector<HTMLElement>(
                '.rb-actions [data-action="composition"]',
              );
              if (opener) wirePopup(menu, opener);
            } else {
              compositionMenuOpen.current = false;
            }
          }
        } else {
          selectedSection.current = null;
          compositionMenuOpen.current = false;
        }
      }

      /**
       * **Put the keyboard back after a verb, which is the whole of sprint 17 day 4.**
       *
       * Pressing «subir» moves the section in place and this tail runs from the redraw (sprint 26
       * día 3); under `swap` it threw the frame away and parsed a new one. Before this, focus went
       * nowhere — the element that had it no longer existed — so it fell to the document's body, which is
       * the top of the page. A keyboard user moved a section once and then had to walk all the way
       * back down to move it again; somebody using a screen reader was simply told they were at the
       * beginning of the site.
       *
       * Where it goes is `placeAfterRebuild`'s one rule: follow the section that was acted on, and if
       * it is no longer on this page take whatever is now in its place. Then, inside that section,
       * **the same verb again** if it is still there and still usable — so three presses of «subir»
       * are three presses in one place, which is what a person does with a verb like that. The
       * fallbacks are in order and each one is a real case: the button exists but is now disabled
       * (the section reached the top), or the cluster is not drawn because the thing in this place is
       * a different section (a delete). The section itself is always focusable, so the chain cannot
       * end in nothing while a section exists.
       */
      const pending = pendingReturn.current;
      if (pending) {
        pendingReturn.current = null;
        const place = placeAfterRebuild({
          // `-1` whenever there is no id to follow, which `placeAfterRebuild` reads as «take whatever
          // is in that place now» — the one rule that already served a delete and now serves an
          // insertion without knowing it is one.
          idIndex:
            pending.sectionId === null
              ? -1
              : sectionsNow().findIndex((section) => section.dataset.section === pending.sectionId),
          wasAt: pending.index,
          count: sectionsNow().length,
        });
        const target = place === null ? undefined : sectionsNow()[place];
        const targetId = target?.dataset["section"];
        if (target && targetId) {
          focusTarget.current = {
            sectionId: targetId,
            ...(pending.within === undefined ? {} : { within: pending.within }),
          };
        }
      }

      /*
       * Applied on **every** wiring and not only on the one that read the pending verb, because a
       * single verb can produce two documents and the first is discarded. Re-selecting here as well:
       * the action cluster is what is being focused into, and after a delete the section now in that
       * place was never chosen, so nothing has drawn one for it yet.
       */
      const wanted = focusTarget.current;
      if (wanted) {
        const host = sectionsNow().find(
          (section) => section.dataset["section"] === wanted.sectionId,
        );
        /*
         * **Only when it is not already the chosen one**, and that `if` is a fix rather than a
         * micro-optimisation: `select` clears `.rb-compositions` from every section, so calling it
         * here destroyed the menu the restore above had just reopened — and with it the focus this
         * block exists to place. The case it is actually for is a delete, where the section now in
         * that place was never chosen and nothing has drawn a cluster for it.
         */
        if (host && selectedSection.current !== wanted.sectionId) select(host, "return");
        takeCanvasFocus(iframeDoc);
      }
    };
    settle();
    settleSelection.current = settle;
  }

  /**
   * The insertion pill, in the gap between sections: a dashed rule broken by "Añadir sección
   * aquí", which is where `docs/design/HANDOFF.md` puts it — "never from a list in a side panel",
   * because a list in a panel makes you choose a position after choosing a section, and the gap
   * you clicked already said the position.
   *
   * Injected into the iframe like the selection chrome, for the same reason: the gaps only exist
   * between the real rendered sections, and nothing outside the frame knows where those fall.
   * None of it reaches the published HTML — this runs against the live DOM only, never the
   * document.
   */
  function drawGaps(iframeDoc: Document) {
    // Drawn from a clean slate, like `.rb-menu`, `.rb-toolbar` and `.rb-hole` already are: a second
    // pass over a document that has its gaps must replace them, never add a second row of pills
    // under each. `wireOnce`'s mark is what stops the second pass; this is what makes one harmless.
    for (const old of iframeDoc.querySelectorAll(".rb-gap")) old.remove();
    const sections = [...iframeDoc.querySelectorAll<HTMLElement>("[data-section]")];
    if (sections.length === 0) return;

    /**
     * Close any open insertion menu, and optionally give the keyboard back to what opened it.
     *
     * **`returnTo` is the half that was missing** (sprint 17 day 6). Escape and the visible «Cerrar»
     * have closed this menu since it shipped, and both left focus on an element they had just
     * removed from the document — so a keyboard user who escaped the menu landed on the body, at
     * the top of the page. A click somewhere else deliberately passes nothing: the person has
     * already chosen where they are going, and moving focus for them would be taking it back.
     */
    function closeMenus(returnTo?: HTMLElement) {
      for (const menu of iframeDoc.querySelectorAll(".rb-menu")) menu.remove();
      if (returnTo?.isConnected) returnTo.focus();
    }

    function menu(index: number, pill: HTMLElement): HTMLElement {
      const panel = chrome(iframeDoc, "div");
      panel.className = "rb-menu";
      // Everything inside the menu is a click that must not reach the document-level handler that
      // closes it — typing in the search field would otherwise shut the menu on the first
      // keystroke. The choices below stop their own propagation already, before this ever sees it.
      panel.addEventListener("click", (event) => event.stopPropagation());

      // Escape closes it, and the listener is on the panel rather than on the document so it dies
      // with the menu. Without this the only way out was a click somewhere else, which is no way
      // out at all for someone who arrived here with the keyboard: Tab walks into the menu and
      // then there is nowhere to go but through it.
      panel.addEventListener("keydown", (event) => {
        if ((event as KeyboardEvent).key !== "Escape") return;
        event.stopPropagation();
        closeMenus(pill);
      });

      const header = chrome(iframeDoc, "div");
      header.className = "rb-menu-header";

      const title = chrome(iframeDoc, "p");
      title.className = "rb-menu-title";
      title.textContent = es["editor.addSection.title"];

      // Visible, not only Escape: the sentence has been in `es.json` since the menu shipped with
      // nothing drawing it, and a keyboard user needs a target as well as a shortcut — Escape is
      // the one nobody has to be told about *if they already know it*. Top right, where a card's
      // close control lives everywhere else, which also makes it the first thing Tab reaches
      // inside the menu: the way out before the way in, which is the right order for a control
      // whose absence is what stranded someone in the first place.
      const close = chrome(iframeDoc, "button");
      close.type = "button";
      close.className = "rb-menu-close";
      close.textContent = es["editor.addSection.close"];
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        closeMenus(pill);
      });

      header.append(title, close);
      panel.appendChild(header);

      const search = chrome(iframeDoc, "input");
      search.type = "search";
      search.className = "rb-menu-search";
      search.placeholder = es["editor.addSection.searchPlaceholder"];
      search.setAttribute("aria-label", es["editor.addSection.searchLabel"]);
      panel.appendChild(search);

      const list = chrome(iframeDoc, "div");
      list.className = "rb-menu-list";
      panel.appendChild(list);

      const note = chrome(iframeDoc, "p");
      note.className = "rb-menu-note";
      note.textContent = es["editor.addSection.contactUnavailable"];

      function choice(offer: SectionOffer): HTMLElement {
        const button = chrome(iframeDoc, "button");
        button.type = "button";
        button.className = "rb-menu-choice";
        const name = chrome(iframeDoc, "span");
        name.className = "rb-menu-name";
        name.textContent = offer.name;
        const description = chrome(iframeDoc, "span");
        description.className = "rb-menu-description";
        description.textContent = offer.description;
        button.append(name, description);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          closeMenus();
          /*
           * **The keyboard lands on the section that just appeared.** A gap at index `i` inserts
           * before whatever is at `i`, so after the rebuild the new section *is* `i` — and there is
           * no id to follow, because it did not exist when the button was pressed. `sectionId: null`
           * is how `placeAfterRebuild` is told to take whatever is in that place now, which is the
           * same rule that already served a delete.
           *
           * No `within`: the section itself is the answer. The thing that appeared is the news, and
           * landing on one of its verbs would be answering a question nobody asked.
           */
          pendingReturn.current = { sectionId: null, index };
          propsNow.current.onInsertSection(offer.catalogId, index);
        });
        return button;
      }

      /**
       * Redrawn on every keystroke, in place — the menu's own DOM, never React's. A `setState`
       * here would re-render the editor on every letter, and the menu is chrome the patch parks —
       * a React state per keystroke is the wrong shape for a search box either way. Under `swap` it
       * was worse than wrong: the re-render rebuilt the iframe's whole `srcDoc` and took the open
       * menu with it.
       */
      function draw(query: string) {
        list.replaceChildren();
        const matches = offersMatching(offers, query);

        if (matches.length === 0) {
          const empty = chrome(iframeDoc, "p");
          empty.className = "rb-menu-empty";
          empty.textContent = es["editor.addSection.noMatch"].replace("{query}", query.trim());
          list.appendChild(empty);
        }
        for (const offer of matches) list.appendChild(choice(offer));

        // The note explains an absence, so it belongs with the full list — while a search is
        // narrowing things down, «Contacto y reservas» is one of many sections not on screen and
        // singling it out would answer a question nobody asked.
        if (contactUnavailable && query.trim() === "") panel.appendChild(note);
        else note.remove();
      }

      search.addEventListener("input", () => draw(search.value));
      draw("");
      return panel;
    }

    function gap(index: number): HTMLElement {
      const row = chrome(iframeDoc, "div");
      row.className = "rb-gap";

      const pill = chrome(iframeDoc, "button");
      pill.type = "button";
      pill.className = "rb-pill";
      pill.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#156FE7" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
      pill.appendChild(iframeDoc.createTextNode(es["editor.addSectionHere"]));
      pill.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = row.querySelector(".rb-menu");
        closeMenus();
        if (open) return;
        const panel = menu(index, pill);
        row.appendChild(panel);
        /*
         * **It opens with the cursor already in the search field** (sprint 17 day 6), which is the
         * day's own acceptance. The menu lists every section the catalog offers here and the field
         * is how that list is narrowed, so typing is what somebody came to do: arriving with the
         * caret anywhere else means a keyboard user Tabs past the way out and the way in before
         * reaching it.
         *
         * The «Cerrar» button is still first in the DOM, and that stays deliberate — its own note
         * explains why the way out comes before the way in — but first in the tab order is not the
         * same as where the caret starts.
         */
        panel.querySelector<HTMLInputElement>(".rb-menu-search")?.focus();
      });

      const before = chrome(iframeDoc, "span");
      before.className = "rb-rule";
      const after = chrome(iframeDoc, "span");
      after.className = "rb-rule";
      row.append(before, pill, after);
      return row;
    }

    for (const [index, section] of sections.entries()) section.before(gap(index));
    sections[sections.length - 1]?.after(gap(sections.length));

    // Anywhere else closes an open menu, the same as any menu on the web. Not `capture`, so a
    // choice's own handler runs first and its `stopPropagation` keeps this from firing twice.
    // Wrapped rather than passed, and the typechecker is why: `closeMenus` now takes the element to
    // give the keyboard back to, and handing it the listener's own `Event` would be handing it
    // something that is not an element at all. A click elsewhere passes nothing on purpose — the
    // person has already chosen where they are going.
  }

  /**
   * **What listens on the document itself, once per session** (ADR 0051 §5). The drawing
   * functions used to attach these at the end of their own pass, which was one listener per
   * document while documents were thrown away, and would be one per redraw now.
   */
  function attachDocument(iframeDoc: Document) {
    // A click anywhere closes the «Añadir sección» menu — the pill's own click stops propagation.
    iframeDoc.addEventListener("click", () => {
      for (const menu of iframeDoc.querySelectorAll(".rb-menu")) menu.remove();
    });
  }

  /**
   * Clicking a photo replaces it.
   *
   * The placeholder already says "Tu foto aquí", so the affordance the page needs is the one it
   * already promises — no button of its own in the action cluster, no panel. `EDITABLE_TAGS`
   * leaves `img` out because there is no text on an image to click into; this is the other half
   * of that sentence, which had been missing.
   */
  /**
   * The line controls, on any section whose preset holds a list.
   *
   * **The gap this closes is older than the section that revealed it.** Until now nothing
   * anywhere could add a line to a list: the questionnaire's answers decided how many cards "Qué
   * hago" had, and a section added from the pill got exactly the one line `blankSection` gives
   * it, for ever. That was invisible while the only list sections were generated ones; a price
   * list that can hold twelve lines and can only ever show one is the same bug with the lid off.
   *
   * Injected into the frame like every other piece of section chrome, and for the same reason —
   * the lines only exist in the rendered page. `data-item` is already on each `li` (the renderer
   * puts it there beside `data-id`), so a line needs no new identity scheme to be addressed.
   *
   * Both controls are drawn only where they would do something: no "add" once the preset's
   * maximum is reached, and no "remove" on the last line, since a list with nothing in it renders
   * as nothing and would leave a heading with a hole under it.
   */
  function drawLines(iframeDoc: Document) {
    // Clear-first, so a redraw after a patch draws each line's verbs once and not twice (día 3).
    for (const old of iframeDoc.querySelectorAll(
      ".rb-line-move, .rb-line-remove, .rb-line-add, .rb-line-full",
    )) {
      old.remove();
    }
    for (const section of iframeDoc.querySelectorAll<HTMLElement>("[data-section]")) {
      const sectionId = section.dataset.section;
      if (!sectionId) continue;
      const lines = linesFor(docNow.current, sectionId);
      if (!lines) continue;

      const list = section.querySelector<HTMLElement>(".rb-list");
      if (!list) continue;

      // The row this section's own chrome goes in, so that it cannot take one an element is
      // counting on — see `rowBelowPlacements`, and the 33px it cost on «Qué hago». `undefined`
      // for a section the catalog draws, which keeps auto-placement exactly as it was there.
      const chromeRow = rowBelowPlacements(docNow.current, sectionId);

      const items = [...list.querySelectorAll<HTMLElement>("[data-item]")];
      for (const [index, li] of items.entries()) {
        const itemId = li.dataset.item;
        if (!itemId) continue;
        li.classList.add("rb-line");

        // The two arrows (sprint 7 day 2), and the reason they are here rather than in a panel:
        // «mover libremente las imágenes» is what the second usability session asked for, document
        // rule 4 refuses free positioning, and this is the half of the want the rule leaves open —
        // the order of a list. Drawn on the line itself, where «Quitar esta foto» already lives,
        // because the line is the thing being moved.
        //
        // Each arrow is drawn only where it would do something: none before on the first line,
        // none after on the last. A button that lights up and moves nothing is the dead-button
        // mistake this editor has refused since sprint 1, and on a gallery of eight it would be
        // sixteen controls of which two do nothing.
        //
        // **«Antes» and «después», not «subir» and «bajar»**, which is what the walk corrected.
        // A section stacks vertically and its own controls rightly say «Subir esta sección»; a
        // list does not. A carta's lines run down the page (`.rb-prices .rb-list` is one column)
        // and a gallery's photographs run across it (`repeat(auto-fit, …)`), so the same arrow
        // moves a line up in one section and to the left in another. Order is the thing that is
        // true in both, and it is also what the owner means: the best photograph goes first.
        if (items.length > 1) {
          const move = (direction: "up" | "down") => {
            const button = chrome(iframeDoc, "button");
            button.type = "button";
            button.className = `rb-line-move rb-line-${direction}`;
            button.setAttribute("aria-label", lineLabel(direction, lines.catalogId));
            button.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0F172A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${
              direction === "up" ? "M12 19V5M5 12l7-7 7 7" : "M12 5v14M19 12l-7 7-7-7"
            }"/></svg>`;
            button.addEventListener("click", (event) => {
              event.stopPropagation();
              propsNow.current.onMoveItem(
                sectionId,
                lines.slot,
                itemId,
                direction === "up" ? index - 1 : index + 1,
              );
            });
            return button;
          };
          if (index > 0) li.appendChild(move("up"));
          if (index < items.length - 1) li.appendChild(move("down"));
        }

        if (lines.canRemove) {
          const remove = chrome(iframeDoc, "button");
          remove.type = "button";
          remove.className = "rb-line-remove";
          remove.setAttribute("aria-label", lineLabel("remove", lines.catalogId));
          remove.innerHTML =
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
          remove.addEventListener("click", (event) => {
            event.stopPropagation();
            // The index the line being taken away occupies: after the removal that position holds
            // the line that followed it, which is where the keyboard goes.
            focusAfterLines.current = { kind: "removed", sectionId, index };
            propsNow.current.onRemoveItem(sectionId, lines.slot, itemId);
          });
          li.appendChild(remove);
        }
      }

      if (!lines.canAdd) {
        // Said rather than left as a control that vanished — the shape `PagesPanel` already uses
        // for the same situation, and the sentence has been in `es.json` since the verbs shipped
        // without anything ever drawing it. An owner who fills a gallery to its eighth photograph
        // watched «Añadir foto» disappear with no explanation, which reads like a bug rather than
        // a limit.
        const full = chrome(iframeDoc, "p");
        full.className = "rb-line-full";
        if (chromeRow !== undefined) full.style.gridRow = `${chromeRow} / span 1`;
        // Through `lineLabel`, so it says «fotos» in a gallery where the button beside it says
        // «Añadir foto». The generic sentence talks about «líneas», which is the editor's word and
        // not the owner's, and it would be the only place in this section that used it.
        full.textContent = lineLabel("full", lines.catalogId);
        list.insertAdjacentElement("afterend", full);
        continue;
      }
      const add = chrome(iframeDoc, "button");
      add.type = "button";
      add.className = "rb-line-add";
      if (chromeRow !== undefined) add.style.gridRow = `${chromeRow} / span 1`;
      add.textContent = `+ ${lineLabel("add", lines.catalogId)}`;
      add.addEventListener("click", (event) => {
        event.stopPropagation();
        // Built here from the catalog, because what a valid line is made of is the catalog's
        // business; the schema re-mints its ids against the document it lands in.
        const found = findSection(docNow.current, sectionId);
        if (!found) return;
        focusAfterLines.current = { kind: "added", sectionId, index: items.length };
        propsNow.current.onAddItem(
          sectionId,
          lines.slot,
          blankItem(found.section.preset.catalogId),
        );
      });
      list.insertAdjacentElement("afterend", add);
    }
  }

  /**
   * **One listener for every photograph, delegated** (ADR 0051 §5, día 3): a photograph that
   * arrives with an edit is heard the moment it exists, and a redraw of the chrome below cannot
   * stack a second click on one that stayed.
   */
  function attachPhotos(iframeDoc: Document) {
    delegate(iframeDoc, "click", 'img[data-role="image"]', (image, event) => {
      const elementId = image.dataset["id"];
      const sectionId = image.closest<HTMLElement>("[data-section]")?.dataset["section"];
      if (!elementId || !sectionId) return;
      // Not the section's click too: choosing a photo is not choosing a section.
      event.stopPropagation();
      replacePhoto({ sectionId, elementId });
    });
  }

  /** The photographs' chrome — the class, the title, the «Foto de ejemplo» badge — drawn
   * clear-first, so it can be drawn again after every patch. */
  function drawPhotoChrome(iframeDoc: Document) {
    for (const old of iframeDoc.querySelectorAll(".rb-sample")) old.remove();
    for (const image of iframeDoc.querySelectorAll<HTMLImageElement>('img[data-role="image"]')) {
      const elementId = image.dataset.id;
      const sectionId = image.closest<HTMLElement>("[data-section]")?.dataset.section;
      if (!elementId || !sectionId) continue;

      image.classList.add("rb-photo");
      image.setAttribute("title", es["editor.changePhoto"]);

      if (photoStatesNow.current.get(addressKey(sectionId, elementId)) !== "sample") continue;

      // The badge is absolutely positioned, so it needs a positioned ancestor to anchor to, and
      // the nearest one it would otherwise find is the section — which, for a gallery card, is the
      // wrong box by the height of the whole section. Positioning the image's own parent is a
      // no-op wherever that parent is already positioned, and never reaches the published page:
      // this runs on the iframe's DOM, not on the document.
      // A class and not `style.position` (ADR 0051 §2, adjustment 3): the chrome writes no inline
      // style on a renderer node, because the patch gives `style` to the renderer and would take
      // it back on the next edit.
      const parent = image.parentElement;
      if (parent && iframeDoc.defaultView?.getComputedStyle(parent).position === "static") {
        parent.classList.add("rb-photo-host");
      }
      image.insertAdjacentElement(
        "afterend",
        sampleBadge(iframeDoc, image, { sectionId, elementId }),
      );
    }
  }

  /**
   * «Foto de ejemplo», over a photograph that came from the bank.
   *
   * **Drawn here and never by the renderer**, which is the guarantee that it cannot reach a
   * published page: `render` emits no `sample` attribute at all, so this label exists only inside
   * the editor's own iframe, alongside the selection outlines and the insertion pills. ADR 0011
   * asks for exactly this, and it is the same reason the marker's «Tu foto aquí» is baked into an
   * image while this is not.
   *
   * **Only for `"sample"`, never for `"empty"`.** The catalog's marker already says «Tu foto aquí»
   * in the picture itself; a label on top of it would be a label on a label. The distinction is
   * `photoInventory.ts`'s three states, and it is the same distinction the warning before a
   * download uses — one source, so the two surfaces cannot come to disagree.
   */
  function sampleBadge(
    iframeDoc: Document,
    image: HTMLImageElement,
    address: ElementAddress,
  ): HTMLButtonElement {
    const badge = chrome(iframeDoc, "button");
    badge.type = "button";
    badge.className = "rb-sample";
    badge.textContent = es["editor.photos.state.sample"];
    badge.title = es["editor.changePhoto"];

    // The renderer places a cover's image by inline `grid-column` / `grid-row` (see the golden
    // corpus). Copied onto the badge so that, inside a grid, it is positioned against the
    // photograph's own grid area instead of the section's padding box — which is what puts it on
    // the photograph rather than in the section's top-left corner. An image with no grid placement
    // — a gallery card's, for one — simply anchors to its parent, which the stylesheet positions.
    if (image.style.gridColumn) badge.style.gridColumn = image.style.gridColumn;
    if (image.style.gridRow) badge.style.gridRow = image.style.gridRow;

    badge.addEventListener("click", (event) => {
      event.stopPropagation();
      replacePhoto(address);
    });
    return badge;
  }

  /**
   * The floating toolbar — the advanced dossier §4's "Apagado" row, for everybody, switch or no
   * switch: «Texto, tamaño, **color del tema**, enlace».
   *
   * **It is a child of the section, never of the element, and that is not a styling choice.**
   * `wireEditing` makes every text element `contentEditable` and commits `el.textContent` on blur.
   * A `<div>` inside the `<h1>` is part of that element's text content, so the first click would
   * have **saved the toolbar's own words into the heading**. It is the same trap the renderer
   * documents for the hidden `<span>` of an «Avance» and answered with `aria-label`. Sections are
   * already `position: relative` (`wireInteractions`); elements are not, and do not need to be —
   * the bar's position is computed with `offsetTop`/`offsetLeft` against the section.
   *
   * **`mousedown` is cancelled on the bar**, so pressing a button never moves focus out of the
   * element being edited. Without it every press fires `blur` first, which commits a text edit at
   * the wrong moment and closes the bar underneath the pointer.
   *
   * **It flips below when there is no room above**, which is what mockup 17 draws and what mockup
   * 08 gets wrong: the cover's headline is the first element on the page, so a bar at `top: -52px`
   * lands outside the iframe's own visible area and cannot be clicked. The same trap the section's
   * action cluster already documents and solved by sitting inside.
   */
  function wireToolbar(iframeDoc: Document) {
    /**
     * The one listener that outlives the bar's own element, so `close` has to take it off.
     *
     * `B` has to know whether what is selected *is* bold, and the selection changes after the bar
     * is drawn — `wireEditing` selects the whole element on focus, and then the person drags to
     * pick two words. Reading it once at open time would draw a pressed state about a selection
     * that no longer exists.
     */
    let followSelection: (() => void) | undefined;

    const close = () => {
      if (followSelection) {
        iframeDoc.removeEventListener("selectionchange", followSelection);
        followSelection = undefined;
      }
      for (const bar of iframeDoc.querySelectorAll(".rb-toolbar")) bar.remove();
    };

    /** Forget which element the bar belongs to, as well as removing it. Separate from `close`
     * because a re-wire removes the bar in order to draw it again, and must not forget. */
    const dismiss = () => {
      toolbarOn.current = null;
      close();
    };

    /**
     * What is selected inside `el`, as offsets into the **document's** text — a caret included,
     * where `from === to`.
     *
     * Two corrections, and the second was found by walking it.
     *
     * **Measured with a range from the start of the element**, never off `anchorOffset`: a
     * marked text is several nodes, so the selection may begin inside a `<strong>`, and that
     * node's own offsets say nothing about where the word sits in the sentence the document
     * stores. The span from the element's start counts in the same UTF-16 code units the
     * document uses (ADR 0027 §2).
     *
     * **And the frame's text is not the document's text.** The html target pretty-prints, so an
     * unmarked heading arrives as `"\n      Taberna del Puerto\n    "` — the words with the
     * file's own indentation wrapped around them. `wireEditing` has committed
     * `textContent.trim()` since sprint 2 for exactly that reason, and this has to agree with
     * it: measured against the raw node, every mark landed as many characters to the right as
     * the element happened to be indented. The walk caught it on the first press.
     *
     * The clamp is the other half: a drag that runs past the last word selects into the
     * indentation, and an offset the document has no character for would be refused by
     * `applyMark` — correctly, and far too late to be useful.
     *
     * **Both corrections now live in `textEdits.ts`**, because `wireEditing`'s `beforeinput`
     * listener needs the identical arithmetic on a different kind of range (ADR 0027 §4b). They
     * cost a day to find by walking the toolbar in a browser, and two copies would drift
     * silently — the symptom being a mark landing in the wrong place, which is the whole thing
     * this file is trying to stop.
     *
     * Out here rather than inside the marks, where it was until día 4, because the way back to
     * the words needs the caret too: a collapsed selection is no mark's business and every
     * keyboard's.
     */
    const selectionIn = (el: HTMLElement): { from: number; to: number } | undefined => {
      const selection = iframeDoc.getSelection();
      if (!selection || selection.rangeCount === 0) return undefined;
      const range = selection.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return undefined;

      const frame = textFrameOf(el.textContent ?? "");
      const upTo = iframeDoc.createRange();
      upTo.selectNodeContents(el);
      upTo.setEnd(range.startContainer, range.startOffset);

      const from = offsetFor(frame, upTo.toString().length);
      const to = Math.max(from, Math.min(from + range.toString().length, frame.text.length));
      return { from, to };
    };

    /**
     * **Where the hand was in the words when the keyboard left them for the bar** (ADR 0052 §3,
     * sprint 27 día 4): which text, whether it was being written in, and the selection as offsets
     * into the document's text — the chosen words, or a caret.
     *
     * Taken as the focus crosses from the text into the bar, because that is the last moment it
     * can be: leaving a text ends the writing (`wireEditing` commits on `focusout`), the commit's
     * patch may replace the text's nodes, and with the focus on a button the words are not
     * selected anywhere a `selectionchange` could read them. **Offsets and never a `Range`**
     * (David's adjustment 2): the commit and every mark rewrite the nodes a `Range` would be
     * holding, while `{ from, to }` still names the same letters. And the text it was taken from,
     * so a record an edit has made stale while the bar had the keyboard — an undo pressed from the
     * bar — is dropped rather than put back on other letters.
     *
     * Two things read it: the marks, which stay drawn for the words chosen before the keyboard
     * came (`refresh`), and the way back (`backToTheWords`).
     */
    let home: {
      readonly sectionId: string;
      readonly elementId: string;
      readonly writing: boolean;
      readonly at: { readonly from: number; readonly to: number } | null;
      readonly text: string;
    } | null = null;

    /** The record above, if it is this text's and still true of it. */
    const homeOf = (el: HTMLElement) => {
      const sectionId = el.closest<HTMLElement>("[data-section]")?.dataset.section;
      if (!home || home.elementId !== el.dataset.id || home.sectionId !== sectionId) return null;
      return home.text === textFrameOf(el.textContent ?? "").text ? home : null;
    };

    /**
     * **Back to the words, as they were when the keyboard left them** — writing again if they
     * were being written in, with the caret or the chosen words where they were. The bar is a
     * detour and the text is home (ADR 0052 §3), the same as with the mouse, whose `mousedown`
     * never lets go of the text: a person who Tabs to «B» and presses it is still writing.
     *
     * **The selection goes back a microtask later**, after the select-all `beginWriting` queues
     * on the focus that starting to write gives: put back synchronously, it would be selected
     * over by that, and the next key would replace the whole text. `then` runs in the same
     * microtask, so whatever it presses acts on the words with the DOM and the document agreeing —
     * the identical state a mouse press finds them in.
     */
    const backToTheWords = (el: HTMLElement, then?: () => void) => {
      const was = homeOf(el);
      home = null;
      if (was?.writing) startWriting(el);
      else el.focus({ preventScroll: true });
      queueMicrotask(() => {
        if (was?.at) restoreSelection(iframeDoc, el, was.at);
        then?.();
      });
    };

    /** A press from the keyboard: a button's `click` with no pointer behind it (`detail` 0), on
     * the control that has the focus — which a mouse press on this bar never is, since its
     * `mousedown` keeps the focus on the words. */
    const fromTheKeyboard = (event: MouseEvent, control: HTMLElement) =>
      event.detail === 0 && iframeDoc.activeElement === control;

    /**
     * A control that acts on the words: the marks, the sizes, the families, the swatches. Pressed
     * with the mouse it acts at once, as it always did; pressed from the keyboard it goes back to
     * the words first and acts there, so the focus ends where it would have ended with the mouse.
     * The grip and the two doors — «Enlace», «Desvincular» — are not this: the first acts on the
     * bar, the others go somewhere else.
     */
    const actsOnTheWords = (el: HTMLElement, button: HTMLButtonElement, act: () => void) => {
      button.addEventListener("click", (event) => {
        if (fromTheKeyboard(event, button)) backToTheWords(el, act);
        else act();
      });
    };

    /**
     * The stop Tab reaches after `el` with the bar out of the way: the first thing after the text
     * in document order that the canvas has made a stop, outside the bar and outside the text.
     *
     * **Asked of the document rather than left to the browser, because of where the bar is.** It is
     * inserted after the text's top-level branch (the note at the insertion says why), so the
     * browser's own Tab from the bar goes to whatever follows that branch — and every stop between
     * the text and the end of its branch, a card's paragraph after its title, would be skipped.
     * `null` when nothing in the frame comes after, and then the browser's Tab leaves the frame as
     * it would have.
     */
    const nextStopAfter = (el: HTMLElement): HTMLElement | null => {
      for (const candidate of iframeDoc.querySelectorAll<HTMLElement>(CANVAS_STOP)) {
        if ((el.compareDocumentPosition(candidate) & el.DOCUMENT_POSITION_FOLLOWING) === 0)
          continue;
        if (el.contains(candidate) || candidate.closest(".rb-toolbar")) continue;
        if (candidate.tabIndex < 0 || (candidate as HTMLButtonElement).disabled) continue;
        if (candidate.getClientRects().length === 0) continue;
        return candidate;
      }
      return null;
    };

    /**
     * The handle on the text bar, wired the same three ways as the verbs' cluster.
     *
     * A click puts the bar on **the other side of the words** — which is the move a person wants
     * when a bar is covering the line they came to edit, and the only big one this bar has, since
     * it has no corners to walk. Pressed again it comes back; pressed where there is no other side
     * — a headline with the section's padding and nothing else above it — it undoes whatever the
     * arrows had done, so the press always means «put it where it belongs» and never nothing.
     *
     * ↑ and ↓ nudge it; ← → and Inicio are the toolbar's since día 4 (`textGripKeyAction` says
     * why), and pressing the grip twice is the way home now that `Home` is not. Enter and Space are
     * the button's own click, which is the flip, so the mouse and the keyboard share one
     * implementation.
     */
    interface BarHandle {
      readonly sectionId: string;
      readonly geometry: () => ToolbarGeometry;
      readonly bounds: () => Bounds;
      /** Where the bar is drawn now, in its section's coordinates. */
      readonly at: () => Point;
      /** Draw it from whatever displacement this section is remembering. */
      readonly place: () => void;
    }

    function wireBarGrip(grip: HTMLButtonElement, handle: BarHandle) {
      /** Remember the place by what it is *away from*, so the next paragraph inherits the meaning. */
      const remember = (wanted: Point) => {
        const computed = toolbarPoint(handle.geometry()).point;
        toolbarOffset.current.set(handle.sectionId, offsetBetween(computed, wanted));
        handle.place();
      };

      grip.addEventListener("click", () => {
        if (justDragged) {
          justDragged = false;
          return;
        }
        const geometry = handle.geometry();
        const computed = toolbarPoint(geometry);
        const other = toolbarPoint(geometry, computed.side === "above" ? "below" : "above");
        const flipped = offsetBetween(computed.point, other.point);
        const now = toolbarOffset.current.get(handle.sectionId);
        const alreadyThere = now?.x === flipped.x && now?.y === flipped.y;
        const nowhereElse = flipped.x === 0 && flipped.y === 0;
        if (alreadyThere || nowhereElse) toolbarOffset.current.delete(handle.sectionId);
        else toolbarOffset.current.set(handle.sectionId, flipped);
        handle.place();
      });

      grip.addEventListener("keydown", (event) => {
        const move = textGripKeyAction(event);
        if (move.kind !== "step") return;
        event.preventDefault();
        event.stopPropagation();
        // The step is clamped before it is remembered, so pressing against an edge does not pile up
        // a displacement that would take twenty presses to walk back out of.
        remember(stepped(handle.at(), move, handle.bounds()));
      });

      let from: Point | null = null;
      let start: Point = { x: 0, y: 0 };
      let moving = false;

      grip.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        from = { x: event.clientX, y: event.clientY };
        start = handle.at();
        moving = false;
        grip.setPointerCapture(event.pointerId);
        iframeDoc.documentElement.classList.add("rb-dragging");
      });

      grip.addEventListener("pointermove", (event) => {
        if (!from) return;
        const now = { x: event.clientX, y: event.clientY };
        if (!moving && !isDrag(from, now)) return;
        moving = true;
        justDragged = true;
        remember(dragged(start, from, now, handle.bounds()));
      });

      const release = () => {
        from = null;
        iframeDoc.documentElement.classList.remove("rb-dragging");
        flushQueuedPatch.current();
      };
      grip.addEventListener("pointerup", release);
      grip.addEventListener("pointercancel", release);
      grip.addEventListener("lostpointercapture", release);
    }

    /** A drag must not also flip the bar; cleared by the click it suppresses. Outside `open`
     * because the bar is reopened on every edit, by `settleToolbar`, and the pointer does not
     * care. */
    let justDragged = false;

    /**
     * `held` says the bar is being drawn again under the keyboard — a control of the old one had
     * the focus — so the marks start from the words chosen before the keyboard came, not from a
     * DOM selection that is nowhere while a button is focused.
     */
    const open = (el: HTMLElement, held = false) => {
      close();
      const section = el.closest<HTMLElement>("[data-section]");
      const sectionId = section?.dataset.section;
      const elementId = el.dataset.id;
      const role = el.dataset["role"] as Role | undefined;
      if (!section || !sectionId || !elementId || !role) return;

      const controls = toolbarFor({ role }, designToolsNow.current === true);
      if (!controls || !hasAnyControl(controls)) return;

      const address: ElementAddress = { sectionId, elementId };
      toolbarOn.current = address;
      const current = styleFor(docNow.current, address);

      const bar = chrome(iframeDoc, "div");
      bar.className = "rb-toolbar";
      bar.setAttribute("role", "toolbar");
      bar.setAttribute("aria-label", es["editor.toolbar.label"]);
      /**
       * The press must not take focus off the text — **but only when it lands on a button.**
       *
       * **This listener was on the whole bar, and it switched off half of it.** `preventDefault` on
       * a `mousedown` cancels that element's default action, and for the four kinds of control in
       * this bar that are not buttons, the default action *is* the control: opening a `<select>`'s
       * popup, focusing an `<input type=number>`, opening the system colour picker. So «Espaciado»
       * and «Esquinas» rendered, read «Por defecto» and could not be opened; the three exact-px
       * fields could not be focused, which meant **the digits typed into them landed in the
       * headline**; and the exact colour never opened a picker. Six controls, drawn and unusable,
       * from the day the bar grew its second half in sprint 9.
       *
       * The narrowing honours what the comment above already said — «pressing a **button** never
       * moves focus out of the element being edited». A button needs it, because a `blur` fired
       * before the `click` commits a text edit at the wrong moment and closes the bar under the
       * pointer. Nothing else in here needs it, and `click` fires on a button either way.
       *
       * **Delegated with `closest("button")` rather than attached per button**, which is a change
       * of mind from the sprint plan and worth saying why: both defaults come out right. A control
       * added later that is not a button is unprotected, which is the side that fails loudly at the
       * first press; a button added later is protected, which is what every button in this bar
       * wants. Attaching it per button would have made each new one remember.
       */
      bar.addEventListener("mousedown", (event) => {
        const target = event.target;
        const onButton =
          target !== null && typeof target === "object" && "closest" in target
            ? (target as Element).closest("button") !== null
            : false;
        if (onButton) event.preventDefault();
      });
      bar.addEventListener("click", (event) => event.stopPropagation());

      /**
       * **The other half of `role="toolbar"`** (ADR 0052 §3, sprint 27 día 4): ← and → between the
       * controls, Inicio and Fin to the ends, Escape back to the words, and Tab out of the bar to
       * the stops either side of the text. Every decision is `toolbarKeyAction`'s; this is the
       * wiring. On the bar rather than on each control, so a control added later is walked to
       * without remembering to be; the grip's own ↑ ↓ stop at the grip and never get here.
       *
       * «Walked to» means drawn and enabled: the marks are not drawn without chosen words, and a
       * hidden button is not a place for → to land.
       */
      bar.addEventListener("keydown", (event) => {
        const action = toolbarKeyAction(event);
        if (action.kind === "ignore") return;
        if (action.kind === "leave") {
          // The bar is the stop right after its text (David's note 7), so the stop before it is
          // the text and the stop after it is whatever followed the text.
          if (!action.forward) {
            event.preventDefault();
            el.focus({ preventScroll: true });
            return;
          }
          const next = nextStopAfter(el);
          if (!next) return;
          event.preventDefault();
          next.focus();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (action.kind === "words") {
          backToTheWords(el);
          return;
        }
        const controls = [...bar.querySelectorAll<HTMLElement>("button, select, input")].filter(
          (control) =>
            !(control as HTMLButtonElement).disabled && control.getClientRects().length > 0,
        );
        const at = controls.indexOf(iframeDoc.activeElement as HTMLElement);
        controls[toolbarIndex(controls.length, at, action.to)]?.focus({ preventScroll: true });
      });

      /**
       * **And the bar goes when the keyboard leaves both it and its words**, which is the text's
       * own rule from the other side. The text's deferred blur closes the bar unless the focus went
       * into it; nothing closed it once the focus was *in* it and went on elsewhere, so Tab from
       * the grip on to anything that is not a text — a pill, a verb, a badge — would leave the bar
       * drawn over the page for words nobody is in. The día 4 walk Tabs on until it stands on such
       * a stop and asserts there is no bar.
       * Deferred for the same reason as the text's: a rebuild under the keyboard removes this bar
       * and focuses the same control in the next one before the timer runs.
       */
      bar.addEventListener("focusout", () => {
        setTimeout(() => {
          if (!bar.isConnected) return;
          const active = iframeDoc.activeElement;
          if (active === el || (active !== null && bar.contains(active))) return;
          dismiss();
        }, 0);
      });

      const group = (label: string): HTMLElement => {
        const wrapper = chrome(iframeDoc, "div");
        wrapper.className = "rb-toolbar-group";
        const caption = chrome(iframeDoc, "span");
        caption.className = "rb-toolbar-caption";
        caption.textContent = label;
        wrapper.appendChild(caption);
        return wrapper;
      };

      const write = (property: StyleProperty, value: StyleValue | undefined) => {
        propsNow.current.onSetElementStyle(address, property, value);
      };

      /**
       * `B` and `I`, first in the bar because they act on the **selection** and everything after
       * them acts on the whole element. The divider says so.
       *
       * **The field stays a plain string**, which ADR 0024 calls the thing that would be easiest
       * to get wrong: no `execCommand`, no editable HTML, no second serialisation format. A press
       * reads the character offsets of what is selected, dispatches an action, and the canvas
       * redraws from the document — the identical path every other edit in this editor takes,
       * with the identical undo.
       */
      /**
       * **The warning, on focus, before a character is typed** (ADR 0033 §6).
       *
       * First in the bar, before `B`/`I` and before everything else, because it is not a control: it
       * is the one thing the owner has to know *before* using the controls. Editing this text changes
       * every card that shows this entry, and a product that changes three things when somebody meant
       * to change one — without having said so first — is making exactly the surprise this sprint
       * spent an ADR avoiding.
       *
       * **Two sentences, and which one depends on the count.** With more than one section showing the
       * list, the warning David asked for word for word. With one, there is no surprise to warn
       * about and the useful thing is where the words live — so it says that instead, rather than
       * warning about a consequence that has nowhere to land.
       */
      const boundHere = boundAt(docNow.current, address, el);
      if (boundHere) {
        const collection = docNow.current.collections.find(
          (candidate) => candidate.id === boundHere.collectionId,
        );
        const places = usesOfCollection(docNow.current, boundHere.collectionId).length;
        const notice = chrome(iframeDoc, "div");
        notice.className = "rb-toolbar-notice";
        notice.setAttribute("role", "status");
        notice.textContent =
          places > 1
            ? es["editor.toolbar.boundMany"].replace("{n}", String(places))
            : es["editor.toolbar.boundOne"].replace("{list}", collection?.name ?? "");
        bar.appendChild(notice);

        // **The exit is the section's, never the card's** — ADR 0033 §7, and David's correction to
        // the plan. The elements inside a card are one shared template, so unbinding this card's
        // text would unbind the template and change every card: the surprise the notice above exists
        // to prevent, arriving through the control meant to avoid it.
        const exitGroup = group(es["editor.toolbar.bound"]);
        const exit = chrome(iframeDoc, "button");
        exit.type = "button";
        exit.className = "rb-toolbar-link";
        exit.textContent = es["editor.toolbar.unbindSection"];
        exit.title = es["editor.toolbar.unbindHelp"];
        exit.addEventListener("click", () => {
          dismiss();
          const list = boundListOf(docNow.current, sectionId);
          if (list) propsNow.current.onUnbindList(sectionId, list.slot);
        });
        exitGroup.appendChild(exit);
        bar.appendChild(exitGroup);
      }

      if (controls.marks) {
        const marksGroup = group(es["editor.toolbar.marks"]);

        /** What is selected inside the text, when it is words — `selectionIn` above, which says
         * why it measures from the element's start and why against the document's text. */
        const selectionRange = (): MarkRange | undefined => {
          const at = selectionIn(el);
          return at && at.to > at.from ? at : undefined;
        };

        const buttons: { mark: Mark; node: HTMLButtonElement }[] = [];

        const refresh = (rebuilt = false) => {
          const live = selectionRange();
          // Recorded here rather than at press time because this already runs on every
          // `selectionchange`, so it costs nothing and is never behind. **Cleared when there is no
          // range**, which matters as much as setting it: a stale record would put a selection back
          // onto words the person had already deselected.
          lastSelection.current = live
            ? { sectionId: address.sectionId, elementId: address.elementId, ...live }
            : null;
          /**
           * **While the bar has the keyboard, the words are the ones chosen before it came**
           * (ADR 0052 §3, día 4). With the focus on a control nothing is selected in the text — the
           * commit that leaving it ran may even have replaced its nodes — so the live selection
           * would hide «Resaltar» the moment the keyboard arrived to use it. `home` is the record
           * taken as the keyboard left the words, in offsets; `rebuilt` covers the one moment the
           * focus is in no bar at all, while this bar is being drawn to replace the one that had it.
           */
          const holding = rebuilt || bar.contains(iframeDoc.activeElement);
          const before = holding ? homeOf(el)?.at : undefined;
          const range = live ?? (before && before.to > before.from ? before : undefined);
          const marks = marksFor(docNow.current, address);
          for (const { mark, node } of buttons) {
            const pressed = range !== undefined && rangeHasMark(marks, range, mark);
            node.setAttribute("aria-pressed", String(pressed));
            node.classList.toggle("rb-toolbar-on", pressed);
          }
          /**
           * **Not drawn without a selection, which is what mockup 18 band 2 draws** — «sin selección
           * los dos botones no se dibujan, **no se dibujan apagados**».
           *
           * This drew them disabled from sprint 10, and the comment that stood here argued for it:
           * «"No door" and "the door is here, pick some words first" are different things, and
           * removing the buttons as the selection collapses would make them flicker». The flicker
           * is a real cost and the argument is a good one — **and it was a divergence from an
           * approved drawing that nobody had written down for two sprints**, found by the sweep that
           * closed sprint 12 and decided by David on 2 October 2026 in favour of the mockup.
           *
           * The whole group goes, not the two buttons: a caption «Resaltar» over nothing is the
           * empty row this bar already refuses elsewhere.
           */
          marksGroup.hidden = range === undefined;
        };

        for (const mark of MARKS) {
          const button = chrome(iframeDoc, "button");
          button.type = "button";
          button.className = `rb-toolbar-mark rb-toolbar-mark-${mark}`;
          button.dataset["mark"] = mark;
          button.textContent = es[`editor.toolbar.markOf.${mark}` as keyof typeof es];
          button.title = es[`editor.toolbar.markTitleOf.${mark}` as keyof typeof es];
          button.setAttribute(
            "aria-label",
            es[`editor.toolbar.markTitleOf.${mark}` as keyof typeof es],
          );
          actsOnTheWords(el, button, () => {
            /**
             * **The words are committed first** (ADR 0052 §4, día 3, David's adjustment 3).
             *
             * A mark is written into the document, and until this line the document did not have
             * the words being typed: pressing «B» on them marked the text the document still
             * remembered, and the mark's own patch then put that older text back over what had
             * been written. Committing first makes the DOM and the document say the same thing,
             * which is what lets `selectionRange`'s offsets name the same letters in both.
             *
             * **The mark turns on, rather than being asked of the document, when the words are
             * new**: words that have just been committed did not carry the mark a moment ago,
             * because they were not in the document to carry it. Where nothing was committed the
             * document answers as it always did.
             */
            const fresh = el.isContentEditable ? commitWriting.current(el) : "unchanged";
            if (fresh === "reverted" || fresh === "no-address") return;
            const range = selectionRange();
            if (!range) return;
            // Read at press time, never at draw time: between the two the person chose the words.
            // And named as the text's own act, so the patch applies it to the text being written in
            // instead of deferring it to the blur (rule 3; día 4).
            pendingCause.current = "mark";
            propsNow.current.onSetMark(
              address,
              range,
              mark,
              fresh === "written"
                ? true
                : !rangeHasMark(marksFor(docNow.current, address), range, mark),
            );
          });
          buttons.push({ mark, node: button });
          marksGroup.appendChild(button);
        }

        refresh(held);
        const follow = () => refresh();
        followSelection = follow;
        iframeDoc.addEventListener("selectionchange", follow);
        bar.appendChild(marksGroup);
      }

      if (controls.size.length > 0) {
        const sizes = group(es["editor.toolbar.size"]);
        for (const ref of controls.size) {
          const button = chrome(iframeDoc, "button");
          button.type = "button";
          button.className = "rb-toolbar-step";
          button.dataset["ref"] = ref;
          const chosen =
            current?.fontSize !== undefined && "ref" in current.fontSize
              ? current.fontSize.ref === ref
              : false;
          if (chosen) button.classList.add("rb-toolbar-on");
          button.setAttribute("aria-pressed", String(chosen));
          button.textContent = es[`editor.toolbar.sizeOf.${ref}` as keyof typeof es];
          // Pressing the step already chosen takes it off, which is the only way back to the
          // site's own size without a separate «quitar» for a control of three buttons.
          actsOnTheWords(el, button, () => write("fontSize", chosen ? undefined : { ref }));
          sizes.appendChild(button);
        }

        /**
         * An exact size, with the design tools on — the last entry of ADR 0026's table, and the
         * one it held back until something could measure what a size does at 320 pixels.
         *
         * It sits in this group rather than in `measures` because a size *is* a size: an owner
         * looking for «un poco más grande» looks where the three steps are. The other two exact
         * values live beside their own references for the same reason.
         */
        if (controls.measures?.exact.includes("fontSize")) {
          const exact = chrome(iframeDoc, "input");
          exact.type = "number";
          exact.min = "8";
          exact.max = "200";
          exact.className = "rb-toolbar-exact";
          exact.placeholder = "px";
          exact.title = es["editor.toolbar.exactHelp"];
          exact.setAttribute(
            "aria-label",
            `${es["editor.toolbar.size"]} — ${es["editor.toolbar.exactHelp"]}`,
          );
          const exactSize =
            current?.fontSize !== undefined && "exact" in current.fontSize
              ? current.fontSize.exact
              : "";
          exact.value = exactSize.endsWith("px") ? exactSize.slice(0, -2) : "";
          if (exactSize !== "") exact.classList.add("rb-toolbar-on");
          // `change`, not `input`: a number typed digit by digit would open a history step per
          // keystroke, and the gate would re-measure the page on each one.
          exact.addEventListener("change", () => {
            const raw = exact.value.trim();
            if (raw === "") {
              write("fontSize", undefined);
              return;
            }
            const number = Number(raw);
            if (!Number.isFinite(number) || number <= 0) return;
            write("fontSize", { exact: `${Math.round(number)}px`, exception: true });
          });
          sizes.appendChild(exact);
        }

        bar.appendChild(sizes);
      }

      /**
       * «Letra» — the two families the theme carries, with the design tools on (ADR 0032).
       *
       * **Drawn beside the sizes**, because the two questions about a letter are which one and how
       * big, and an owner looking for the first will look where the second is.
       *
       * **Buttons and not a `<select>`**, which is the same reason the measures are a select read
       * from the other side: five spacing steps as buttons would make a bar nobody can read at the
       * width a section gives it, and two fit the way three sizes fit.
       *
       * **Labelled «Titular» and «Texto», by what the family is for and never by the font.** A
       * heading face is EB Garamond on one type pair and Inter on another, so a button reading
       * «EB Garamond» would be wrong on two pairs out of three; issue #9 settled that vocabulary for
       * the whole product and the `Estilo` panel has followed it since sprint 4.
       *
       * **The family joins the accessible name since the gallery exists** (ADR 0046, sprint 24
       * día 6): with eight families choosable by their real names, the question an owner asks of
       * these two buttons is which letter they are about to apply. The visible label stays the role
       * word — this bar has the width a section gives it, and «Titular (Libre Baskerville)» is not a
       * button that fits — so the name and the tooltip carry it, and only when the family is one we
       * send. `toolbarFamilyLabel` composes both, and a theme heading in Georgia still gets the role
       * word alone.
       */
      if (controls.family) {
        const families = group(es["editor.toolbar.family"]);
        for (const ref of controls.family) {
          const button = chrome(iframeDoc, "button");
          button.type = "button";
          button.className = "rb-toolbar-step";
          button.dataset["ref"] = ref;
          // No `"ref" in` test, unlike every other property here: `fontFamily` has one arm, so the
          // value is a reference or it is absent. That is ADR 0032 §2 showing through the type.
          const chosen = current?.fontFamily?.ref === ref;
          if (chosen) button.classList.add("rb-toolbar-on");
          button.setAttribute("aria-pressed", String(chosen));
          const label = es[`editor.toolbar.familyOf.${ref}` as keyof typeof es];
          button.textContent = label;
          /**
           * The caption spelled into the accessible name, which no other group here needs.
           *
           * «Texto» is already the `color.ink` swatch's label one group over, so this is the first
           * pair of controls in the bar whose names collide. The captions are `<span>`s rather than
           * groups with accessible names, so a screen reader announcing «Texto, botón» twice would
           * give no way to tell the colour from the family. Naming the newcomer rather than renaming
           * the swatch: the swatch is in the mockup, this is not.
           */
          const name = toolbarFamilyLabel(docNow.current.theme, ref);
          button.setAttribute("aria-label", name);
          button.title = name;
          // Pressing the one already chosen takes it off, like the size steps. With two buttons and
          // no exact arm it is the only way back to the family the site's type pair gives this role,
          // and a «quitar» for a control of two would be half the group again.
          actsOnTheWords(el, button, () => write("fontFamily", chosen ? undefined : { ref }));
          families.appendChild(button);
        }
        bar.appendChild(families);
      }

      if (controls.color.length > 0) {
        const colors = group(es["editor.toolbar.color"]);
        for (const ref of controls.color) {
          const button = chrome(iframeDoc, "button");
          button.type = "button";
          button.className = "rb-toolbar-swatch";
          button.dataset["ref"] = ref;
          button.style.background = docNow.current.theme[ref];
          const label = es[`editor.toolbar.colorOf.${ref}` as keyof typeof es];
          button.title = label;
          button.setAttribute("aria-label", label);
          const chosen =
            current?.color !== undefined && "ref" in current.color
              ? current.color.ref === ref
              : false;
          if (chosen) button.classList.add("rb-toolbar-on");
          button.setAttribute("aria-pressed", String(chosen));
          actsOnTheWords(el, button, () => write("color", chosen ? undefined : { ref }));
          colors.appendChild(button);
        }

        /**
         * The exact colour — rule 6's marked exception, and the one control in this bar that only
         * exists because the download gate learned to refuse what it can produce (ADR 0026 §2).
         *
         * A native `<input type="color">` and not a picker of our own: it is the platform's, it is
         * keyboard-accessible, and it can only ever produce `#rrggbb`, which is exactly what the
         * schema admits and what `cssThemeValue` will emit. A hand-rolled picker would be a second
         * place to get hex parsing wrong.
         *
         * `REVIEW.md` refused «a machine for producing» untested contrast. This is that machine
         * with the net in front of it: what it writes is marked as an exception, listed in the
         * audit, and measured before the ZIP leaves.
         */
        if (controls.measures?.exact.includes("color")) {
          const exact = chrome(iframeDoc, "input");
          exact.type = "color";
          exact.className = "rb-toolbar-color";
          exact.title = es["editor.toolbar.exactColor"];
          exact.setAttribute("aria-label", es["editor.toolbar.exactColor"]);
          const exactColor =
            current?.color !== undefined && "exact" in current.color ? current.color.exact : "";
          /**
           * **With no exception it showed `#000000`, which is a colour the document does not have.**
           * An `<input type=color>` defaults to black when nothing is assigned, so the swatch
           * claimed a value nobody had chosen — the same class as a select reading «Por defecto»
           * for an element that is not on it.
           *
           * What it shows now is the colour actually in force: the theme's value for the reference
           * this element carries, or, with no style at all, the first role `colorRolesFor` offers —
           * which is `color.ink` for text and `color.surface` on a button, the same order the
           * swatches draw in and the same one the renderer paints. Derived, not a second table.
           */
          const inForce =
            current?.color !== undefined && "ref" in current.color
              ? current.color.ref
              : controls.color[0];
          exact.value =
            exactColor !== ""
              ? exactColor
              : inForce
                ? (docNow.current.theme[inForce] ?? "#000000")
                : "#000000";
          if (exactColor !== "") exact.classList.add("rb-toolbar-on");
          // `change` rather than `input`: dragging across a colour wheel fires `input` continuously
          // and would open a history step per pixel.
          exact.addEventListener("change", () => {
            write("color", { exact: exact.value, exception: true });
          });
          colors.appendChild(exact);

          if (exactColor !== "") {
            const off = chrome(iframeDoc, "button");
            off.type = "button";
            off.className = "rb-toolbar-step";
            off.textContent = es["editor.toolbar.reset"];
            actsOnTheWords(el, off, () => write("color", undefined));
            colors.appendChild(off);
          }
        }

        bar.appendChild(colors);
      }

      /**
       * The "Encendido" half — «Añade posición, medidas y espaciado» — drawn as a select per
       * property rather than a row of buttons.
       *
       * Five spacing steps and three corner steps beside three sizes, four colours and a link is
       * fifteen controls in one bar, which is a bar nobody can read at the width a section gives
       * it. A `<select>` is a real control: keyboard, grouping and the current value announced, all
       * without a custom menu inside an iframe.
       */
      const measure = (
        property: "padding" | "borderRadius",
        refs: readonly string[],
        caption: string,
      ) => {
        const wrapper = group(caption);
        const value = current?.[property];
        const chosenRef = value !== undefined && "ref" in value ? value.ref : "";
        const exactValue = value !== undefined && "exact" in value ? value.exact : "";

        const select = chrome(iframeDoc, "select");
        select.className = "rb-toolbar-select";
        select.setAttribute("aria-label", caption);
        const none = chrome(iframeDoc, "option");
        none.value = "";
        none.textContent = es["editor.toolbar.default"];
        select.appendChild(none);
        for (const ref of refs) {
          const option = chrome(iframeDoc, "option");
          option.value = ref;
          option.textContent = es[`editor.toolbar.${property}Of.${ref}` as keyof typeof es];
          select.appendChild(option);
        }
        if (exactValue !== "") {
          /**
           * Shown only while an exception exists, so the select never claims «Por defecto» for an
           * element that is visibly not on the default.
           *
           * **Disabled, because it was choosable and did nothing.** Its handler returned early —
           * «Selecting it does nothing» said the comment that stood here — so the list offered an
           * option that looked like every other and was a dead end. It cannot be removed instead:
           * it is what the select *displays* when an exception is in force, and without it the box
           * would read «Por defecto» for an element that visibly is not. So it shows the state and
           * says, by being disabled, that this is not where the state is changed — the number
           * beside it is.
           */
          const marked = chrome(iframeDoc, "option");
          marked.value = "exact";
          marked.disabled = true;
          marked.textContent = `${es["editor.toolbar.exact"]}: ${exactValue}`;
          select.appendChild(marked);
        }
        select.value = exactValue !== "" ? "exact" : chosenRef;
        select.addEventListener("change", () => {
          // Unreachable through the control now that the option is disabled, and kept as the
          // backstop on a path that writes to the owner's document.
          if (select.value === "exact") return;
          write(property, select.value === "" ? undefined : { ref: select.value as never });
        });
        wrapper.appendChild(select);

        if (controls.measures?.exact.includes(property)) {
          const exact = chrome(iframeDoc, "input");
          exact.type = "number";
          exact.min = "0";
          exact.max = "999";
          exact.className = "rb-toolbar-exact";
          exact.placeholder = "px";
          exact.title = es["editor.toolbar.exactHelp"];
          exact.setAttribute("aria-label", `${caption} — ${es["editor.toolbar.exactHelp"]}`);
          exact.value = exactValue === "" ? "" : exactValue.replace("px", "");
          // `change` and not `input`: a number typed digit by digit would open a history step per
          // keystroke, and `setElementStyle` would refuse the intermediate «2» as readily as it
          // accepts «20». One commit when the field is left, like every other text edit here.
          exact.addEventListener("change", () => {
            const raw = exact.value.trim();
            if (raw === "") {
              write(property, undefined);
              return;
            }
            const number = Number(raw);
            if (!Number.isFinite(number) || number < 0) return;
            write(property, { exact: `${Math.round(number)}px`, exception: true });
          });
          wrapper.appendChild(exact);
        }

        bar.appendChild(wrapper);
      };

      if (controls.measures) {
        measure("padding", controls.measures.padding, es["editor.toolbar.padding"]);
        measure("borderRadius", controls.measures.borderRadius, es["editor.toolbar.borderRadius"]);
      }

      if (controls.link) {
        const linkGroup = group(es["editor.toolbar.link"]);
        const button = chrome(iframeDoc, "button");
        button.type = "button";
        button.className = "rb-toolbar-link";
        button.textContent = es["editor.toolbar.link"];
        // A second door, not a second mechanism: it opens the panel that already owns
        // destinations, on this section. Editing an href in the frame would be a second place a
        // destination can be written, and `listDeadDestinations` would have two sources to chase.
        //
        // **Through `showFields` and not `setFieldsFor`, which is a defect this sprint found**
        // (día 3). Calling the setter straight skipped the half of that function that sends the
        // rail back to «Secciones», so selecting a word with «Estilo» open and pressing «Enlace»
        // left **both** side surfaces mounted — and while the drawer was `fixed` it simply covered
        // the other one. Nothing tested it. In the row they would now compete for one slot, so a
        // door that bypasses the rule is a door that loses the panel it opened.
        button.addEventListener("click", () => {
          dismiss();
          showFields(sectionId);
        });
        linkGroup.appendChild(button);
        bar.appendChild(linkGroup);
      }

      /*
       * **The handle, in its own group so the dividers stay where they were.** `:last-child` is
       * what takes the right border off the final group; a bare button appended after the groups
       * would have left the previously-last one bordered and the grip floating beside it.
       */
      const gripGroup = chrome(iframeDoc, "div");
      gripGroup.className = "rb-toolbar-group";
      const grip = chrome(iframeDoc, "button");
      grip.type = "button";
      grip.className = "rb-toolbar-grip";
      grip.dataset["action"] = "grip";
      grip.setAttribute("aria-label", es["editor.bar.grip"]);
      // `title` as well, which is this bar's own idiom for saying what an icon does — six of its
      // controls already carry one. The cluster's word pill would be one thing too many in a bar
      // that is already captioned.
      grip.title = es["editor.bar.grip"];
      grip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="5" r="1.7"/><circle cx="15" cy="5" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="19" r="1.7"/><circle cx="15" cy="19" r="1.7"/></svg>`;
      gripGroup.appendChild(grip);
      bar.appendChild(gripGroup);

      /**
       * **Beside the words it acts on, and not at the end of the section — which is what makes a
       * keyboard able to reach it at all.**
       *
       * It was `section.appendChild(bar)`, so the bar was the section's last child and Tab from a
       * text walked every remaining text, the sample badge and the call to action before arriving.
       * It never arrived: focus landing on the badge is focus leaving the words, and the deferred
       * blur closes the bar then — correctly. Measured on 14 October 2026 writing the walk for the
       * handle: «la barra se cerró a las 3 tabulaciones». So the whole bar, not only this sprint's
       * grip, has been out of a keyboard's reach since sprint 9, and it is the Tab order and not
       * the controls that did it.
       *
       * Inserted after the element's **branch** rather than after the element itself: a caption
       * inside an `.rb-line` would otherwise make that line the bar's `offsetParent`, and every
       * coordinate below is measured against the section. A direct child of the section keeps the
       * section as the offsetParent, which is what the arithmetic assumes.
       *
       * Nothing moves on screen. The bar is `position: absolute`, so it is out of flow and not a
       * grid item: it occupies no track in the section's twelve columns and displaces nothing,
       * whichever child it sits beside. It was already a direct child; only its index changes.
       *
       * **And still after the branch, not after the text, now that the Tab order is asserted with
       * a text that is not the last of its branch** (sprint 27 día 4, David's note 7: «si falla, la
       * barra se inserta justo después del texto, o la PR dice por qué no»). It failed — and not
       * only in a card: Tab from the cover's headline did not reach the bar either, measured the
       * same day. Inserted after the
       * text itself, the bar would sit inside the card, and the card is an `.rb-line`, which the
       * line chrome makes `position: relative`: the card would become the bar's containing block,
       * every `top`/`left` below is in the section's coordinates, and the bar would be drawn a
       * card's offset away from its words. So the order is made by the keys instead: Tab from the
       * text goes to the grip, Tab from the bar goes on to `nextStopAfter(el)`, and Shift+Tab from
       * the bar comes back to the text — the order a person would get if the bar were beside the
       * words, without moving where it is drawn.
       */
      /**
       * **One Tab stop for the whole bar, and it is the handle.**
       *
       * `role="toolbar"` has been on this element since sprint 9 and promises a keyboard exactly
       * this: one stop for the group, arrows between what is inside it. Sprint 20 kept the first
       * half — the controls out of the tab order and the handle left in, so Tab-ing past a
       * paragraph costs one press and not fifteen — and wrote the second down as a day of its own,
       * because «B» needs the words the person chose and Tab-ing off a text takes the focus away
       * from them.
       *
       * **The second half is día 4's** (ADR 0052 §3): the bar's `keydown` walks between the
       * controls, and what they act on is `home`, the record of the words taken as the keyboard
       * left them, in offsets. A press from the keyboard goes back to the words and acts there.
       * The controls stay at `-1` — the stop is the grip, wherever the arrows were last — so the
       * bar is the same one stop every time the keyboard arrives.
       */
      for (const control of bar.querySelectorAll<HTMLElement>("button, select, input")) {
        if (control !== grip) control.tabIndex = -1;
      }

      let branch: HTMLElement = el;
      while (branch.parentElement && branch.parentElement !== section) {
        branch = branch.parentElement;
      }
      if (branch.parentElement === section) branch.after(bar);
      else section.appendChild(bar);

      /**
       * The element's offset from the section's own box, summed up the `offsetParent` chain.
       *
       * **Not `el.offsetTop - section.offsetTop`**, which is what this was and which the walk
       * caught. `offsetTop` is measured against the nearest *positioned* ancestor, and the section
       * already is one (`wireInteractions` sets `position: relative` on every `[data-section]`), so
       * `el.offsetTop` is the number wanted and subtracting the section's own page offset skews it
       * by however far down the page that section sits — 76px for the cover, more for every section
       * after it. It read as correct because the error then pushed the calculation into the flip
       * branch, which pushed the bar back up by roughly the same amount: two mistakes cancelling,
       * and both of them would have come apart on the second section.
       *
       * The loop rather than the single read, because an intermediate positioned ancestor would
       * make the single read wrong again, silently, and there is no reason to depend on there never
       * being one.
       */
      let top = 0;
      let left = 0;
      for (
        let node: HTMLElement | null = el;
        node && node !== section;
        node = node.offsetParent as HTMLElement | null
      ) {
        top += node.offsetTop;
        left += node.offsetLeft;
      }

      /*
       * **The flip and the clamp now live in `barPosition.ts`**, unchanged, so that something can
       * call them: four lines inside a four-hundred-line function had never been asked a question
       * by anything but themselves, and the one time they were wrong — measuring the element
       * against the page instead of against its section — two mistakes cancelled and a walk on the
       * second section is what found it.
       */
      /**
       * **What of this section is on screen, in the section's own coordinates** (día 3).
       *
       * The bar used to be placed against the section alone, and «above the words» meant «above
       * them inside the section», which is not the same as «where somebody can press it»: the
       * canvas is a scrolling document inside an iframe. Choose a section — which focuses it, and
       * focus scrolls — then click a text near the top of what is now on screen, and the place
       * above it is off the top of the frame. Measured on 23 October 2026: `scrollY` 189, the bar
       * drawn at −31, and a press there landing on the editor's chrome *outside* the frame, where
       * it blurs the words, lets the deferred `focusout` close the bar and marks nothing. That is
       * the defect of 15 October, and `toolbarPoint` needs the band to avoid it.
       *
       * Read on every `place()` rather than once: the bar is placed again after every patch, and
       * the scroll is not the same then as it was when the bar opened.
       */
      const viewBand = (): { top: number; height: number } | undefined => {
        const win = iframeDoc.defaultView;
        if (!win) return undefined;
        // The section's own offset in the page, from the box on screen plus the scroll — the same
        // frame of reference `top` above is summed in, and the frame's own pixels throughout.
        const sectionTop = section.getBoundingClientRect().top + win.scrollY;
        return { top: win.scrollY - sectionTop, height: win.innerHeight };
      };
      const geometry = (): ToolbarGeometry => {
        const view = viewBand();
        return {
          elementTop: top,
          elementLeft: left,
          elementHeight: el.offsetHeight,
          barWidth: bar.offsetWidth,
          barHeight: bar.offsetHeight,
          hostWidth: section.clientWidth,
          ...(view ? { view } : {}),
        };
      };
      const bounds = (): Bounds => ({
        hostWidth: section.clientWidth,
        hostHeight: section.clientHeight,
        barWidth: bar.offsetWidth,
        barHeight: bar.offsetHeight,
      });
      const place = () => {
        const computed = toolbarPoint(geometry()).point;
        const nudge = toolbarOffset.current.get(sectionId) ?? { x: 0, y: 0 };
        const at = withOffset(computed, nudge, bounds());
        bar.style.top = `${at.y}px`;
        bar.style.left = `${at.x}px`;
      };
      place();
      wireBarGrip(grip, {
        sectionId,
        geometry,
        bounds,
        at: () => ({ x: bar.offsetLeft, y: bar.offsetTop }),
        place,
      });
    };

    // Delegated (ADR 0051 §5, día 3): `focusin`/`focusout` bubble where `focus`/`blur` do not, and
    // a text that arrives with an edit opens the bar the moment it is focused.
    delegate(iframeDoc, "focusin", "[data-id]", (el) => {
      if (EDITABLE_TAGS.has(el.tagName)) open(el);
    });
    delegate(iframeDoc, "focusout", "[data-id]", (el) => {
      if (!EDITABLE_TAGS.has(el.tagName)) return;
      // Deferred, so a click that lands on the bar itself is not raced by the blur it follows.
      // `mousedown`'s preventDefault stops the blur in the ordinary case; this covers a keyboard
      // tab out, where there is no mousedown at all.
      setTimeout(() => {
        // **Only if the bar is still this element's.** Clicking from one text straight to
        // another fires the new element's `focus` *before* this deferred blur, so the bar has
        // already been rebuilt for the new element by the time this runs — and a blur that
        // closed it unconditionally would tear down the bar it never opened. The walk found
        // exactly that: the toolbar appeared on the cover and on no other section, because
        // every later click opened it and then immediately took it away again.
        if (toolbarOn.current?.elementId !== el.dataset.id) return;
        if (iframeDoc.activeElement !== el && !iframeDoc.activeElement?.closest(".rb-toolbar")) {
          dismiss();
        }
      }, 0);
    });

    /**
     * **`home`, written as the focus crosses from a text into its bar** (día 4). In the capture
     * phase, so it runs before `wireEditing`'s own `focusout` commits the words and ends the
     * writing: after that the text no longer says whether it was being written in. The live
     * selection first, and the one `refresh` last recorded if a press on a `<select>` already
     * took it; a crossing to anywhere else forgets.
     */
    delegate(
      iframeDoc,
      "focusout",
      "[data-id]",
      (el, event) => {
        if (!EDITABLE_TAGS.has(el.tagName)) return;
        // Shape, never `instanceof`: the target belongs to the frame's realm, not this window's.
        const to = event.relatedTarget as Element | null;
        const sectionId = el.closest<HTMLElement>("[data-section]")?.dataset.section;
        const elementId = el.dataset.id;
        const intoTheBar = to !== null && "closest" in to && to.closest(".rb-toolbar") !== null;
        if (!intoTheBar || !sectionId || !elementId) {
          home = null;
          return;
        }
        const recorded =
          lastSelection.current?.sectionId === sectionId &&
          lastSelection.current.elementId === elementId
            ? { from: lastSelection.current.from, to: lastSelection.current.to }
            : null;
        home = {
          sectionId,
          elementId,
          writing: el.isContentEditable,
          at: selectionIn(el) ?? recorded,
          text: textFrameOf(el.textContent ?? "").text,
        };
      },
      { capture: true },
    );

    /**
     * **The two ways from a text to its bar** (ADR 0052 §3, día 4): Tab, because the bar is the
     * stop right after the text that opened it (David's note 7), and Alt+F10, the convention of
     * TinyMCE and CKEditor (his adjustment 4). Tab is taken here rather than left to the browser
     * because the bar sits after the text's whole branch — the note at its insertion says why —
     * and the browser would reach every stop behind the text in that branch first.
     *
     * Only for the text the bar is open on, and only a bare Tab: Shift+Tab from a text goes back
     * to whatever was before it, as it always did.
     */
    delegate(iframeDoc, "keydown", "[data-id]", (el, event) => {
      if (!EDITABLE_TAGS.has(el.tagName)) return;
      const bareTab =
        event.key === "Tab" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
      if (!bareTab && !isToolbarShortcut(event)) return;
      const on = toolbarOn.current;
      const sectionId = el.closest<HTMLElement>("[data-section]")?.dataset.section;
      if (!on || on.elementId !== el.dataset.id || on.sectionId !== sectionId) return;
      const grip = iframeDoc.querySelector<HTMLElement>(".rb-toolbar .rb-toolbar-grip");
      if (!grip) return;
      event.preventDefault();
      grip.focus({ preventScroll: true });
    });

    /**
     * Put the bar back on the element it was on, after an edit changed the canvas under it.
     *
     * **Found by the walk, and it made the control useless: the bar vanished the moment it was
     * used.** Under `swap`, writing a style changed the document, which changed `srcDoc`, which
     * reloaded the iframe — every edit did. Nothing had focus in the new frame, so nothing reopened
     * the bar, and a person got exactly one press per click into the text. The reopening runs from
     * the redraw now (`settleToolbar`, sprint 26 día 4), with the control under the hand kept.
     *
     * **And the chosen words come back with it**, which is the half that was missing. This used to
     * reopen the bar *without focusing*, deliberately: `wireEditing` selects a whole field on focus,
     * which is right when somebody clicks in to type and wrong here — having just pressed a swatch,
     * they would watch their heading flash to selected for no reason. That objection was sound and
     * it is not an argument for doing nothing: putting the **exact** range back is not the flash it
     * guarded against, it is the person's own selection surviving an edit — and the select-all it
     * warned about is overwritten in the same synchronous block, so nothing of it is ever painted.
     * Without this, the «Resaltar» group hides itself for want of a selection and a second mark has
     * nowhere to be pressed.
     */
    const remembered = toolbarOn.current;
    // Read before `open` runs. Its own `refresh` looks at a document nothing is selected in yet and
    // would clear the very record this needs — which is correct of it, and is why the read is here.
    const rememberedSelection = lastSelection.current;

    /**
     * **And the writing itself comes back, for the one gesture that interrupts it** (ADR 0050, día
     * 4): stretching a text's box by its edge while writing in it.
     *
     * Every other edit made while writing goes *through* the writing — a letter, a mark, the
     * toolbar's own buttons — and the commit on blur is what ends it. A resize is the first act
     * that changes the document while the caret should stay where it is, and the frame it rebuilds
     * has no `contenteditable` anywhere. So the state is restored here, **before** the block below
     * puts the bar and the selection back: that restoration focuses the element to place the range,
     * and a range placed in something not editable is a focus with no caret.
     */
    settleWriting(iframeDoc);

    /**
     * **The bar, drawn again from the document as it now is.** Every control in it — the role
     * pressed, the size step, the colour in force — is read at `open` and never after, so the
     * redraw reopens it here after every patch (sprint 26 día 4: the «Aa» walk pressed the body
     * role and the bar still said «false»); each rebuild did it under `swap`. `open` closes
     * first, so the `selectionchange` listener is one, however many times this runs.
     */
    const reopen = (bar: ElementAddress, selection: typeof lastSelection.current) => {
      const section = iframeDoc.querySelector(`[data-section="${CSS.escape(bar.sectionId)}"]`);
      const el = section?.querySelector<HTMLElement>(`[data-id="${CSS.escape(bar.elementId)}"]`);
      // Gone means the element was deleted or hidden while the bar was open; forget it rather than
      // keeping a pointer to something nobody can see.
      if (!el) {
        toolbarOn.current = null;
        return;
      }
      // **The control the hand was on comes back under it.** The bar is rebuilt while a `<select>`
      // or a button of it may hold the focus; `open` removes that node, focus falls to
      // the body, and the text's deferred `focusout` — finding nothing of the bar focused — would
      // dismiss the bar it had just rebuilt (measured: «element(s) not found» on the spacing select
      // right after choosing in it). So the same control, by its `data-ref` or its mark, is focused
      // in the new bar before that timer fires.
      const held = iframeDoc.activeElement?.closest(".rb-toolbar")
        ? (iframeDoc.activeElement as HTMLElement)
        : null;
      const heldRef = held?.dataset["ref"] ?? held?.dataset["mark"] ?? null;
      const heldTag = held?.tagName ?? null;
      open(el, held !== null);
      if (held && heldTag) {
        const again = [...iframeDoc.querySelectorAll<HTMLElement>(`.rb-toolbar ${heldTag}`)].find(
          (node) => (node.dataset["ref"] ?? node.dataset["mark"] ?? null) === heldRef,
        );
        again?.focus({ preventScroll: true });
        if (again) return;
      }
      // Only the element the selection was actually in: the bar can be remembered for one
      // element while the last selection belonged to another.
      if (
        selection &&
        selection.sectionId === bar.sectionId &&
        selection.elementId === bar.elementId
      ) {
        restoreSelection(iframeDoc, el, selection);
      }
    };
    settleToolbar.current = (live) => {
      if (live !== iframeDoc) return;
      const bar = toolbarOn.current;
      if (!bar) return;
      // Read before `open` runs, for the same reason as above: its `refresh` would clear it.
      const selection = lastSelection.current;
      reopen(bar, selection);
    };
    if (remembered) reopen(remembered, rememberedSelection);
  }

  /**
   * Draw «chosen» on one text and take it off whatever had it (ADR 0047).
   *
   * **The chrome is two things and each has a reason.** The solid outline says which text is the
   * one — dashed on hover means «you could», solid means «this is it», the same pair the sections
   * have used since sprint 17. And the hint is the element's own `aria-describedby`, not a
   * decoration with `aria-hidden`: a screen reader arriving at a chosen text is told how to start
   * writing in it, which is the same sentence the eye gets. The Tab stop is not this function's
   * and never depended on being chosen: a text is a stop while its section holds the keyboard
   * (ADR 0052 §2, `applyCanvasStops`), and a click focuses it either way.
   *
   * `el` of `null` means nothing is chosen, and that is a real state — a press of Escape, or a
   * click on the page around the sections.
   */
  function markChosen(iframeDoc: Document, el: HTMLElement | null) {
    for (const had of iframeDoc.querySelectorAll<HTMLElement>(".rb-chosen")) {
      if (had === el) continue;
      had.classList.remove("rb-chosen");
      had.removeAttribute("aria-describedby");
    }
    for (const hint of iframeDoc.querySelectorAll(".rb-hint")) hint.remove();
    if (!el) {
      chosenText.current = null;
      // The handles belong to whatever is chosen, so nothing chosen means none of them (día 7).
      handlePainter.current?.();
      return;
    }
    const section = el.closest<HTMLElement>("[data-section]");
    const sectionId = section?.dataset.section;
    const elementId = el.dataset.id;
    if (!section || !sectionId || !elementId) return;
    chosenText.current = { sectionId, elementId };
    el.classList.add("rb-chosen");

    /**
     * **What the hint says depends on what this element can actually do** (ADR 0049).
     *
     * «Doble clic o Intro para escribir» is true of a text and false of a photograph, and a
     * photograph is choosable from today so that the arrows can reach it. And «Flechas para
     * moverlo» is true only where a placement exists and the design tools are on — a section the
     * catalog draws has no placements, and offering keys that do nothing is the dead control this
     * repository keeps refusing to draw.
     *
     * Both halves can be true at once: a text in a hand-designed section can be written in **and**
     * moved. Neither being true means no hint rather than an empty one.
     */
    const movable =
      designToolsNow.current === true &&
      (findSection(docNow.current, sectionId)?.section.layout?.placements ?? []).some(
        (placement) => placement.elementId === elementId,
      );
    /**
     * The handles go on the element that is chosen now, whatever else this function says about it
     * (día 7) — and in **its own** document, which is not always the caller's idea of the live one.
     * Before the early return below, because an image with no hint still gets handles.
     */
    handlePainter.current?.();

    const says = [
      el.dataset["rbText"] === "1" ? chosenHintText() : "",
      movable ? es["editor.canvas.moveHint"] : "",
    ].filter((part) => part !== "");
    if (says.length === 0) return;

    const hint = chrome(iframeDoc, "div");
    hint.className = "rb-hint";
    hint.id = "rb-hint";
    hint.textContent = says.join(" · ");
    section.appendChild(hint);
    el.setAttribute("aria-describedby", hint.id);
  }

  /**
   * Start writing in a text: the attribute arrives, and the caret with it.
   *
   * **Two lines, and deliberately nothing else.** The element's own `focus` listener in
   * `wireEditing` does the rest — it reads the marks, starts the capture and selects the whole
   * field — so this is callable from anywhere that needs to put somebody into a text, including
   * `focusLineAfterChange` when a new line appears. The order matters: the attribute is set first,
   * so that listener can tell writing from being merely chosen by asking the element.
   */
  /** The writing a gesture interrupted, taken up again (ADR 0050 día 4) — after the patch (sprint
   * 26 día 4: the resize's commit blurs the text and asks for it back, and under `swap` only the
   * wiring listened, which is how `keepWriting` came to have no listener on the patch route). */
  function settleWriting(iframeDoc: Document) {
    const writeAgain = keepWriting.current;
    keepWriting.current = null;
    if (!writeAgain) return;
    const again = iframeDoc
      .querySelector(`[data-section="${CSS.escape(writeAgain.sectionId)}"]`)
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(writeAgain.elementId)}"]`);
    if (!again) return;
    markChosen(iframeDoc, again);
    startWriting(again);
  }

  function startWriting(el: HTMLElement) {
    el.contentEditable = "true";
    el.focus({ preventScroll: true });
  }

  /**
   * Stop writing: the attribute leaves, and **nothing else**.
   *
   * **It used to re-draw «chosen» here, and that made Escape-from-chosen impossible.** Releasing
   * moves focus to the section, which blurs the text, which came back through this function and
   * marked it chosen again — so the outline survived the very press that was meant to take it off.
   * The walk caught it by reading focus and the class together: focus had gone to the section and
   * the class was still on the text.
   *
   * Who re-draws it instead, in each case that needs it: the revert path, which has not moved
   * anywhere; and `settleEditing`, which runs at the wiring (`swap`) and from the redraw (`patch`).
   */
  function stopWriting(el: HTMLElement) {
    el.removeAttribute("contenteditable");
  }

  /** A text's writing state, which used to be a closure per element and is a map since the
   * listeners stopped being per element (ADR 0051 §5). */
  interface EditState {
    original: string;
    liveMarks: MarkRun[];
    liveText: string;
    anchored: boolean;
    chosenWhenPressed: ElementAddress | null;
  }

  /** The texts the editor writes in: the renderer's editable tags, marked by `prepareTexts`. */
  const TEXT = "[data-id][data-rb-text]";

  /** Where an element lives in the document, read from the page. */
  function addressOf(el: HTMLElement): ElementAddress | null {
    const sectionId = el.closest<HTMLElement>("[data-section]")?.dataset["section"];
    const elementId = el.dataset["id"];
    return sectionId && elementId ? { sectionId, elementId } : null;
  }

  /**
   * **What a text needs on itself, and nothing more** (ADR 0051 §5): the mark the delegated
   * handlers dispatch on, and the entry link unwrapped — because the renderer draws a card's title
   * as a link to its page and the editor keeps it plain, and a link inside the element would
   * otherwise be followed on click. Idempotent, so it runs at wiring and again after every patch,
   * over inserted texts and settled ones alike.
   *
   * The Tab stop used to be given here too — `0` to every text on every repaint — and that is the
   * seventy-five stops ADR 0052 counts. It is `applyCanvasStops`'s now: a text is a stop while its
   * section holds the keyboard, and `-1` otherwise.
   */
  function prepareTexts(iframeDoc: Document) {
    for (const el of iframeDoc.querySelectorAll<HTMLElement>("[data-id]")) {
      if (!EDITABLE_TAGS.has(el.tagName)) continue;
      for (const link of el.querySelectorAll("a.rb-entry-link")) {
        link.replaceWith(...link.childNodes);
      }
      if (el.dataset["rbText"] !== "1") el.dataset["rbText"] = "1";
    }
  }

  /**
   * **Writing in a text** (ADRs 0024, 0027, 0047; sprint 26 día 3 for the shape). The listeners are
   * the document's, dispatched to the text the event concerns; each text's state — what it said
   * when writing began, the marks and text the capture believes in, whether every edit was anchored
   * — lives in a map keyed by the element, created on first touch.
   */
  function wireEditing(iframeDoc: Document) {
    const states = new WeakMap<HTMLElement, EditState>();
    const stateOf = (el: HTMLElement): EditState => {
      let state = states.get(el);
      if (!state) {
        state = {
          original: textFrameOf(el.textContent ?? "").text,
          liveMarks: [],
          liveText: "",
          anchored: true,
          chosenWhenPressed: null,
        };
        states.set(el, state);
      }
      return state;
    };

    /** **Re-read every time writing begins** (ADR 0051 §2, adjustment 2): the element outlives every
     * edit, so what it held when it was wired is not what the document says now. */
    const beginWriting = (el: HTMLElement, address: ElementAddress, state: EditState) => {
      state.original = textFrameOf(el.textContent ?? "").text;
      state.liveMarks = marksFor(docNow.current, address) ?? [];
      state.liveText = liveFrameOf(el.textContent ?? "").text;
      state.anchored = true;
      // The hint's instruction has been followed, so it stops being advice and becomes clutter.
      for (const hint of iframeDoc.querySelectorAll(".rb-hint")) hint.remove();
      el.removeAttribute("aria-describedby");
      // Deferred by one microtask: a click's default caret placement runs after the listeners,
      // and a select-all that ran before it would be collapsed by it (measured as
      // «UNODOSTCUATRORESCINCO» after five edits that should each have replaced the heading).
      queueMicrotask(() => {
        if (!el.isContentEditable || !iframeDoc.contains(el)) return;
        const selection = iframeDoc.getSelection();
        if (!selection) return;
        const range = iframeDoc.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      });
    };
    const write = (el: HTMLElement, address: ElementAddress, state: EditState) => {
      startWriting(el);
      beginWriting(el, address, state);
    };

    const editOf = (el: HTMLElement, range: Range, inserted: number): TextEdit | undefined => {
      if (!el.contains(range.commonAncestorContainer)) return undefined;
      const frame = liveFrameOf(el.textContent ?? "");
      const upTo = iframeDoc.createRange();
      upTo.selectNodeContents(el);
      upTo.setEnd(range.startContainer, range.startOffset);
      const from = offsetFor(frame, upTo.toString().length);
      const to = Math.max(from, Math.min(from + range.toString().length, frame.text.length));
      return { from, to, inserted };
    };
    const stillInStep = (el: HTMLElement, state: EditState): boolean =>
      liveFrameOf(el.textContent ?? "").text.trim() === state.liveText.trim();
    const recordEdit = (state: EditState, edit: TextEdit, inserted: string): void => {
      state.liveMarks = shiftMarks(state.liveMarks, edit);
      state.liveText =
        state.liveText.slice(0, edit.from) + inserted + state.liveText.slice(edit.to);
    };
    const liveRange = (el: HTMLElement, target: StaticRange | undefined): Range | undefined => {
      if (target) {
        const range = iframeDoc.createRange();
        range.setStart(target.startContainer, target.startOffset);
        range.setEnd(target.endContainer, target.endOffset);
        return range;
      }
      const selection = iframeDoc.getSelection();
      if (!selection || selection.rangeCount === 0) return undefined;
      const range = selection.getRangeAt(0);
      return el.contains(range.commonAncestorContainer) ? range : undefined;
    };

    // Arriving at a text chooses it; only writing in it starts the capture (ADR 0047).
    delegate(iframeDoc, "focusin", TEXT, (el) => {
      const address = addressOf(el);
      if (!address) return;
      if (!el.isContentEditable) {
        markChosen(iframeDoc, el);
        return;
      }
      beginWriting(el, address, stateOf(el));
    });

    delegate(iframeDoc, "beforeinput", TEXT, (el, event) => {
      const state = stateOf(el);
      const input = event as InputEvent;
      // Whatever is in the field from now on is the person's, not ours.
      delete el.dataset["rbFresh"];
      if (state.anchored && !stillInStep(el, state)) state.anchored = false;
      const targets = input.getTargetRanges();
      const range = liveRange(el, targets[0]);
      if (input.inputType === "insertFromPaste") {
        // Plain text only, placed by hand, so the marks can follow it (ADR 0027 §4b).
        input.preventDefault();
        const text = input.dataTransfer?.getData("text/plain") ?? "";
        if (!range) {
          state.anchored = false;
          return;
        }
        const edit = editOf(el, range, text.length);
        range.deleteContents();
        const node = iframeDoc.createTextNode(text);
        range.insertNode(node);
        const selection = iframeDoc.getSelection();
        if (selection) {
          const caret = iframeDoc.createRange();
          caret.setStartAfter(node);
          caret.collapse(true);
          selection.removeAllRanges();
          selection.addRange(caret);
        }
        if (edit) recordEdit(state, edit, text);
        else state.anchored = false;
        return;
      }
      const inserted = insertedTextFor({
        inputType: input.inputType,
        data: input.data,
        pastedText: null,
      });
      if (inserted === undefined || !range || targets.length > 1) {
        state.anchored = false;
        return;
      }
      const edit = editOf(el, range, inserted.length);
      if (edit) recordEdit(state, edit, inserted);
      else state.anchored = false;
    });

    // What was chosen when the press began decides what the click means (ADR 0047).
    delegate(iframeDoc, "pointerdown", TEXT, (el) => {
      stateOf(el).chosenWhenPressed = chosenText.current;
    });

    delegate(iframeDoc, "click", TEXT, (el, event) => {
      // A link in the page is a text here; following it would leave the editor.
      if (el.tagName === "A") event.preventDefault();
      const address = addressOf(el);
      if (!address) return;
      const state = stateOf(el);
      if (!el.isContentEditable) {
        if (clickAction(state.chosenWhenPressed, address) === "write") {
          write(el, address, state);
        } else {
          markChosen(iframeDoc, el);
          el.focus({ preventScroll: true });
        }
      }
      // A line just added says «escribe aquí»; the first click selects it so typing replaces it.
      if (el.dataset["rbFresh"] === "1") {
        const selection = iframeDoc.getSelection();
        if (!selection) return;
        const range = iframeDoc.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    });

    delegate(iframeDoc, "keydown", TEXT, (el, event) => {
      const address = addressOf(el);
      if (!address) return;
      const state = stateOf(el);
      const mode = el.isContentEditable
        ? "writing"
        : chosenText.current?.sectionId === address.sectionId &&
            chosenText.current?.elementId === address.elementId
          ? "chosen"
          : "idle";
      const action = textKeyAction(
        {
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        },
        mode,
      );
      if (action.kind === "ignore") return;
      if (action.kind === "write") {
        event.preventDefault();
        write(el, address, state);
        return;
      }
      if (action.kind === "release") {
        event.preventDefault();
        markChosen(iframeDoc, null);
        el.closest<HTMLElement>("[data-section]")?.focus({ preventScroll: true });
        return;
      }
      event.preventDefault();
      if (action.kind === "revert") {
        el.textContent = state.original;
        state.liveMarks = marksFor(docNow.current, address) ?? [];
        state.liveText = liveFrameOf(el.textContent ?? "").text;
        state.anchored = true;
        stopWriting(el);
        markChosen(iframeDoc, el);
        el.focus({ preventScroll: true });
        return;
      }
      el.blur();
    });

    /**
     * **The commit a blur does, available without the blur** (ADR 0052 §4, día 3, David's
     * adjustment 3).
     *
     * It was the body of the `focusout` handler below and nothing else could reach it, which is
     * the whole of the defect the backlog recorded on 22 October: **a mark pressed on text that
     * has not been committed marks the document's text, not the typed one.** The bar reads the
     * words from the DOM and writes the mark into the document, and the document does not have
     * what is being typed until the writing ends — so under `patch` the mark's own patch rewrote
     * the focused text with the document's older version and the typed words disappeared under
     * the mark. The fix is the toolbar's and it is this: commit first, then mark, with the DOM and
     * the document saying the same thing, so one set of offsets is good for both.
     *
     * **It stops short of `stopWriting`**, which is the one line that cannot be shared: the blur
     * has already left the text and takes the attribute off, while a mark is pressed from inside
     * the writing and must leave the caret exactly where it is.
     *
     * What it answers is what the caller needs to decide next: `written` means the words in the
     * DOM have just become the document's, so a mark pressed on them is a mark on new words;
     * `unchanged` means there was nothing to commit and the document's own marks still answer;
     * `reverted` means an emptied link or button got its words back, and there is nothing to mark.
     */
    const commit = (el: HTMLElement): "no-address" | "reverted" | "written" | "unchanged" => {
      const address = addressOf(el);
      if (!address) return "no-address";
      const state = stateOf(el);
      const next = textFrameOf(el.textContent ?? "").text;
      // A link or a button emptied would be an anchor with no words: refused, like the download.
      if (next === "" && (el.dataset["role"] === "link" || el.dataset["role"] === "button")) {
        el.textContent = state.original;
        return "reverted";
      }
      /**
       * **Against what the document last said, not against what the person found** (ADR 0051 §2,
       * adjustment 2): a history patch that rewrote these words leaves them behind, read once here,
       * so a blur commits exactly the difference typed after the undo and nothing if nothing was.
       */
      const lastSaid = takeHistoryText(el);
      if (lastSaid !== undefined) state.original = textFrameOf(lastSaid).text;
      if (next !== state.original) {
        // The captured marks, in the coordinates of the text being stored (ADR 0027 §4b), only if
        // every edit was anchored, the listener is still in step, and the trimmed live text is
        // exactly what is committed; otherwise `withText` derives them by diff.
        const anchoredMarks =
          state.anchored && stillInStep(el, state) && state.liveText.trim() === next
            ? marksAfterTrim(state.liveText, state.liveMarks)
            : undefined;
        // A bound text's words live in the list, so that is where the edit goes (ADR 0033 §6).
        const bound = boundAt(docNow.current, address, el);
        if (bound) {
          propsNow.current.onSetEntryField(bound.collectionId, bound.entryId, bound.field, {
            text: next,
            ...(anchoredMarks && anchoredMarks.length > 0 ? { marks: anchoredMarks } : {}),
          });
        } else {
          // And the rows the text now needs, measured, in the same history step as the words
          // (ADR 0050 día 6, David's adjustment 1).
          propsNow.current.onEditText(address, next, anchoredMarks, rowsFor(el));
        }
        return "written";
      }
      return "unchanged";
    };

    // The commit, on leaving — and the attribute leaves with it, whichever way the edit ended.
    delegate(iframeDoc, "focusout", TEXT, (el) => {
      if (commit(el) === "no-address") return;
      stopWriting(el);
    });

    // What the floating bar calls before it marks (ADR 0052 §4): the capture every commit reads
    // belongs to this wiring, so the commit stays here and the bar reaches it through the ref, the
    // way the redraw reaches `settleToolbar` and a patch reaches `refreshWriting`.
    commitWriting.current = commit;

    // **After a history or mark patch under the caret, the capture is re-read** (día 4): the
    // document's marks are not what `beginWriting` captured, and a commit built on the old capture
    // would store the old marks over the new ones. Only for a text still being written in; the
    // attribute itself stays for the `blur`, which is what `takeHistoryText` consumes.
    refreshWriting.current = (live) => {
      for (const el of live.querySelectorAll<HTMLElement>(`[${HISTORY_TOUCHED_ATTRIBUTE}]`)) {
        const state = states.get(el);
        const address = addressOf(el);
        if (!state || !address || !el.isContentEditable) continue;
        state.liveMarks = marksFor(docNow.current, address) ?? [];
        state.liveText = liveFrameOf(el.textContent ?? "").text;
        state.anchored = true;
      }
    };

    prepareTexts(iframeDoc);
    settleEditing(iframeDoc);
  }

  /** The chosen text, put back after a wiring or a structural patch — or let go, if it is gone. */
  function settleEditing(iframeDoc: Document) {
    const stillChosen = chosenText.current;
    if (!stillChosen) return;
    const el = iframeDoc
      .querySelector(`[data-section="${CSS.escape(stillChosen.sectionId)}"]`)
      ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(stillChosen.elementId)}"]`);
    if (el) markChosen(iframeDoc, el);
    else chosenText.current = null;
  }

  /**
   * The bar a hand-designed section wears, and the way back from it (ADR 0025 §7, mockup 16 band 2).
   *
   * Not part of `wireSelection`: the badge answers «which of these did I design myself» for the
   * whole page at once, and having to click each section to find out would make the answer useless.
   * The advanced dossier §5 asks for that marking in a sections panel; ADR 0025 recorded that there
   * is no sections panel, so it goes on the section, where the thing being marked actually is.
   *
   * Drawn only while the tools are on. An owner who never turned them on has no free sections to
   * mark, and someone who turns them off is asking for the simple editor back — the sections stay
   * exactly as they are, which is the point of the depth belonging to the person and not the site.
   */
  /**
   * Which sections already had their «Diseñada a mano» bar, so only a **new** one arrives.
   *
   * `wireHandmade` runs once per document, and a document is replaced on every committed edit — so
   * without this the bar would play its entrance on every keystroke that lands, which is the
   * mistake the fade on the preview frame taught: an entrance that re-runs stops reading as an
   * arrival and starts reading as a flicker.
   */
  const barredSections = useRef<Set<string>>(new Set());

  /**
   * Where the keyboard should land after a line was added or taken away.
   *
   * **Today it lands nowhere.** The three line controls are `<button>`s inside the frame and, unlike
   * the floating toolbar, they do not cancel `mousedown` — so pressing «+ Añadir línea» blurs the
   * text, commits the edit, changes the document (a structural patch, after which `drawLines`
   * redraws the controls) and leaves focus on a button that the change itself destroyed. To type in the new card you have to find it and click it.
   *
   * Kept as an **act and an index**, not as an element id. `mintItem` mints ids against the ones
   * already used, so removing a line and adding another can hand the new one the id the removed one
   * had — an id that matches is not proof of identity across that pair.
   */
  const focusAfterLines = useRef<{
    kind: "added" | "removed";
    sectionId: string;
    index: number;
  } | null>(null);

  /**
   * Put the keyboard where the act implies, in the document that act produced.
   *
   * Added: the first text of the new card, which `addItem` always appends, so it is the last line.
   * **The placeholder arrives selected and typing replaces it, and that costs nothing to arrange** —
   * `wireEditing`'s own `focus` handler already selects a field's contents, which is exactly the
   * «escribir lo sustituye» this wants.
   *
   * Removed: the line that took its place, or the one before it when the last was taken. A list
   * cannot be emptied — every preset in the catalog declares `min: 1` and `canRemove` is
   * `itemIds.length > range.min` — so there is no "nothing left" case to handle, and writing one
   * would be writing for a state the catalog forbids.
   *
   * `preventScroll`, for the reason given at `restoreSelection`: focus scrolls its element into view
   * by default, and this runs a few lines before the reading position is restored.
   */
  function focusLineAfterChange(iframeDoc: Document) {
    const want = focusAfterLines.current;
    focusAfterLines.current = null;
    if (!want) return;
    const list = iframeDoc
      .querySelector(`[data-section="${CSS.escape(want.sectionId)}"]`)
      ?.querySelector<HTMLElement>(".rb-list");
    if (!list) return;
    const items = [...list.querySelectorAll<HTMLElement>("[data-item]")];
    const line =
      want.kind === "added"
        ? items[items.length - 1]
        : (items[want.index] ?? items[want.index - 1]);
    // Asked of the document rather than worked out from the tag, because `wireEditing` has already
    // run by the time this does and it is the one that decides what is editable. **The marker and
    // not the attribute since ADR 0047**: nothing is editable until somebody writes in it, and a
    // line that has just appeared is exactly the case where the editor does that for them.
    const text = line?.querySelector<HTMLElement>("[data-rb-text]");
    if (!text) return;
    /**
     * **Marked as still holding what we put there, and this is a defect the suite caught on me.**
     *
     * `wireEditing` selects a field's whole contents on `focus`, and that is what makes «escribir
     * lo sustituye» true. Focusing the new line here spends that event — so a person who then
     * *clicks* the highlighted placeholder gets no second `focus`, the click collapses the
     * selection, and their words land inside the placeholder. Measured, from the sprint 7 walk:
     * «Escribe aquí de qué es esta fot» + «Segunda foto» + «o».
     *
     * So the field carries a mark meaning «this is still ours», a click on it re-selects the whole
     * thing, and the first keystroke clears the mark. The rule the existing comment states —the
     * first keystroke replaces the placeholder rather than landing mid-word— is restored for the
     * one case that broke it.
     *
     * **Only for a line that was added.** The neighbour of a line that was taken away holds the
     * person's own words, and selecting all of those on a click would be the opposite of helpful.
     */
    if (want.kind === "added") text.dataset["rbFresh"] = "1";
    // **Writing and not merely chosen.** Somebody who just pressed «Añadir» is about to type, and
    // asking them for a second click on a line the editor itself put there would be the two states
    // charging for a choice nobody made.
    markChosen(iframeDoc, text);
    startWriting(text);
  }

  /**
   * The grid of one section, measured in the browser rather than assumed (ADR 0048).
   *
   * **The rows are read and not computed, and that is the whole reason this function exists.**
   * `.rb-section` is twelve `1fr` columns, so a column's width is arithmetic; its rows are
   * **implicit and sized by their content**, so there is nothing to compute — `grid-template-rows`
   * resolves to the used pixel heights, which is the only place that answer lives. A module that
   * assumed uniform rows would snap to the wrong one on every section whose first row is a headline
   * and whose second is a photograph.
   *
   * Everything is in the frame's own coordinates, which is also what `event.clientX` arrives in, so
   * nothing here crosses the frame boundary and no zoom factor is involved.
   */
  /**
   * What each placed element's box is right now, for the escalation that is about to write it
   * (ADR 0050 §3, sprint 25 día 2).
   *
   * **The document is an argument, and that is the whole defect this signature prevents.** The
   * first version asked `liveDoc()` for it and measured nothing at all: the chrome is wired into a
   * frame **before** it becomes the visible one («Wired before it is seen», below), so a handler
   * created there captured a render in which the live slot was still the *other* frame. `liveDoc()`
   * then answered with the document that does not hold this section, `measurePlaced` found none and
   * handed back `undefined`, and the escalation quietly fell back to the theme's rhythm — a section
   * that looked escalated correctly and had derived rows. Measured in Chromium (the headline's row
   * came out 1 where its box said 4) rather than reasoned about. Whoever is inside the frame passes
   * its own document; the panel, which React re-renders, passes `liveDoc()`.
   *
   * **In the frame's own pixels.** The canvas is zoomed by a `transform` on the card *outside* the
   * iframe, so a `getBoundingClientRect` taken inside it is already in the document's own pixels and
   * the difference between two of them needs no dividing — which is what makes these numbers the
   * same eight-pixel rows the published page will have.
   *
   * **What it cannot promise**: that the face the text will settle on is the face it is measuring.
   * A web font arriving after the press moves a heading by a few pixels, and the rows written here
   * are the ones it had. Nobody escalates in the first moments of a preview that has been on screen
   * since the questionnaire, and the alternative — awaiting `document.fonts.ready` inside a click —
   * would delay the act for a case that costs four pixels. ADR 0050 §3 names it with the other
   * vertical drifts.
   *
   * **Top-level children only, and only the ones the renderer named.** A placement exists for an
   * element of the section, not for a line inside a list, and the chrome this file draws into the
   * section — the handmade bar, the ghost, the add-line pill — carries no `data-id`. The panel
   * `.rb-panel` has none either, which is why it cannot be mistaken for content here.
   *
   * `undefined` when there is nothing to measure: no live frame, or a section that is not on screen
   * because the canvas is showing another page. The verb then falls back to the theme's rhythm,
   * which is the honest answer for a page nobody can see rather than a zero anybody would believe.
   */
  function measurePlaced(
    iframeDoc: Document | null | undefined,
    sectionId: string,
  ): MeasuredBox[] | undefined {
    if (!iframeDoc) return undefined;
    let section: HTMLElement | undefined;
    for (const candidate of iframeDoc.querySelectorAll<HTMLElement>("[data-section]")) {
      if (candidate.dataset.section === sectionId) section = candidate;
    }
    if (!section) return undefined;

    const view = section.ownerDocument.defaultView;
    /**
     * **Not from a page drawn in one column**, which is the mobile view (día 8).
     *
     * The preview's layout width is 320 px in the mobile view, under the renderer's own 720
     * breakpoint, so every element is `grid-column: 1 / -1; grid-row: auto` and the section is a
     * stack. Those boxes are a true measurement of the phone and a false one of the hand: sideways
     * the ×8 conversion saves the columns, but the rows would come out in the phone's reading
     * order, and escalating the generated cover from the mobile view put its headline on row 29
     * instead of row 4 — two hundred pixels down, under a photograph whose own area came out
     * twenty-six rows where the desktop measures fifty. Measured, not reasoned about.
     *
     * The honest answer is the one this function already gives for a page nobody can see: hand
     * back nothing and let `escalate` convert the catalog's own drawing with the theme's rhythm,
     * which is what «no se mueve nada al empezar» (ADR 0025 §7) meant before día 2 measured
     * anything. A layout that cannot be measured is not a layout that should be guessed at.
     *
     * Asked of the page and never of the device state, which is día 7's lesson: this runs inside a
     * rebuild (`swap`), where a captured `device` can be the one from before the toggle. One resolved track
     * where the desktop declares twelve or a hundred and seven is the mobile view saying so itself.
     */
    const columnTracks = (view?.getComputedStyle(section).gridTemplateColumns ?? "")
      .split(" ")
      .filter((entry) => entry.trim() !== "").length;
    if (columnTracks <= 1) return undefined;

    const box = section.getBoundingClientRect();
    const padTop = Number.parseFloat(view?.getComputedStyle(section).paddingTop ?? "");
    const contentTop = box.top + (Number.isFinite(padTop) ? padTop : 0);

    const boxes: MeasuredBox[] = [];
    for (const child of section.children) {
      const el = child as HTMLElement;
      const elementId = el.dataset["id"];
      if (!elementId) continue;
      const rect = el.getBoundingClientRect();
      boxes.push({ elementId, top: rect.top - contentTop, height: rect.height });
    }
    // An empty list is «nothing was placed», which is not the same as «there was nothing to read»:
    // handing it over would write no rows at all, and handing back `undefined` lets the rhythm
    // answer for a section whose elements are all hidden.
    return boxes.length > 0 ? boxes : undefined;
  }

  function gridMetricsOf(section: HTMLElement): GridMetrics {
    const view = section.ownerDocument.defaultView;
    const box = section.getBoundingClientRect();
    const style = view?.getComputedStyle(section) ?? null;
    const px = (value: string | undefined): number => {
      const parsed = Number.parseFloat(value ?? "");
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const padLeft = px(style?.paddingLeft);
    const padTop = px(style?.paddingTop);
    const tracks = (value: string | undefined) =>
      (value ?? "")
        .split(" ")
        .map((entry) => Number.parseFloat(entry))
        .filter((entry) => Number.isFinite(entry));
    return {
      left: box.left + padLeft,
      top: box.top + padTop,
      // Both axes as the browser resolved them — the fine grid's 107 column tracks, gutters
      // included, and every row the grid has. Nothing is recomputed from a width and a gap: see
      // `dragGrid.ts` for why the rows cannot be, and why the columns should not be either.
      columns: tracks(style?.gridTemplateColumns),
      rows: tracks(style?.gridTemplateRows),
    };
  }

  /**
   * How many eight-pixel rows an element's box needs, or `undefined` when nobody should be told.
   *
   * The same arithmetic the measured escalation uses (`measuredToFine` ceils, so the content always
   * fits inside its rows and no row has to grow past its minimum), asked of one element at the
   * moment its text is committed.
   */
  function rowsFor(el: HTMLElement): number | undefined {
    const section = el.closest<HTMLElement>("[data-section]");
    const sectionId = section?.dataset.section;
    if (!section || !sectionId) return undefined;
    // Only a hand-designed section has rows of its own to keep true.
    if (!findSection(docNow.current, sectionId)?.section.layout) return undefined;
    if (el.parentElement !== section) return undefined;
    return Math.max(1, Math.ceil(el.getBoundingClientRect().height / ROW_STEP_PX));
  }

  /**
   * The boxes of a section's other placed elements — what the guides line up against.
   *
   * Top-level children with a `data-id`, which is the renderer's own mark: the chrome this file
   * draws into a section carries none, so the handmade bar, the verbs' cluster and the guides
   * themselves cannot become things to line up with. The element being moved is left out, because
   * an element lining up with itself is not a guide.
   */
  function neighbourRects(section: HTMLElement, exceptId: string | undefined): Rect[] {
    const out: Rect[] = [];
    for (const child of section.children) {
      const el = child as HTMLElement;
      const id = el.dataset["id"];
      if (!id || id === exceptId) continue;
      const rect = el.getBoundingClientRect();
      out.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
    }
    return out;
  }

  /** The content box's own centre along x, which is the one line of the section itself the guides
   * offer (`guides.ts` says why the vertical centre is not one). */
  function centreOf(metrics: GridMetrics): number {
    return metrics.left + metrics.columns.reduce((total, width) => total + width, 0) / 2;
  }

  /**
   * The guides, drawn inside the section for as long as the hand is on something (ADR 0050, día 5).
   *
   * `position: absolute`, so they ride the section's own scroll and — the lesson of día 2 — take no
   * row of the grid they are drawn over. `pointer-events: none`, because a line that can swallow
   * the pointer would end the gesture it is guiding.
   */
  function drawGuides(section: HTMLElement, lines: readonly Guide[]) {
    for (const old of section.querySelectorAll(".rb-guide")) old.remove();
    const box = section.getBoundingClientRect();
    for (const line of lines) {
      const guide = chrome(section.ownerDocument, "div");
      guide.className = "rb-guide";
      guide.setAttribute("aria-hidden", "true");
      if (line.axis === "x") {
        guide.style.left = `${Math.round(line.at - box.left)}px`;
        guide.style.top = "0";
        guide.style.width = "1px";
        guide.style.height = "100%";
      } else {
        guide.style.top = `${Math.round(line.at - box.top)}px`;
        guide.style.left = "0";
        guide.style.height = "1px";
        guide.style.width = "100%";
      }
      section.appendChild(guide);
    }
  }

  /**
   * The canvas's zoom, read off the frame itself — **what turns a threshold in screen pixels into
   * one in the frame's** (ADR 0050 §6, David's adjustment 3).
   *
   * The card is scaled by a `transform` outside the iframe, so everything inside it is in the
   * document's own pixels: three of them are 2.2 on screen at a zoom of 0.74, and a gesture that
   * armed at three frame pixels would arm sooner than a hand means it. Dividing the threshold by
   * this is what keeps «three pixels» the same three pixels at every window width.
   *
   * Read rather than passed, and from two numbers the frame itself has: its own box, which is
   * scaled, against its viewport's width, which is not. A `1` for a frame with no view yet is the
   * honest fallback — no zoom is the state the shell starts in.
   */
  function zoomOf(iframeDoc: Document): number {
    const view = iframeDoc.defaultView;
    const frame = view?.frameElement as HTMLElement | null | undefined;
    const inner = view?.innerWidth ?? 0;
    const width = frame?.getBoundingClientRect().width ?? 0;
    return inner > 0 && width > 0 ? width / inner : 1;
  }

  /**
   * **The edges of the chosen element's box stretch it** (ADR 0050, sprint 25 día 4).
   *
   * David's second request for the sprint, and his own gesture for finding it: a zone of ±6 px
   * around the border, a cursor that changes in it, no handles with a mouse — «parecido a como
   * funcionan los cuadros de texto insertados en un documento de Word».
   *
   * **Wired on the section and in the capture phase, and both halves of that are the design.**
   *
   * - *On the section*, because the zone reaches **outside** the element: a `pointermove` three
   *   pixels past a headline's right border is delivered to the section, not to the headline, so an
   *   element-level listener could never show the cursor there — the first version did exactly that
   *   and the walk found the outer half of the zone dead.
   * - *In capture*, because the press has to beat everything the element and the section would
   *   otherwise do with it: choosing, starting to write, closing a menu, or arming the drag. A
   *   capture listener runs before any of them, and `stopPropagation` is what makes the gesture
   *   unambiguous rather than a race between listeners (the plan named this risk; this is the
   *   answer to it).
   *
   * The element it acts on is the one the hand is already working on — the chosen one of this
   * section, written in or not — never every placed element: an edge zone around all of them would
   * turn «drag this» into «stretch this» a few pixels from every border on the page.
   */
  /**
   * **The edges of the chosen element's box stretch it** (ADR 0050 día 4) — and since sprint 26
   * día 3 the listeners are the document's, dispatched to the section the pointer is in (ADR 0051
   * §5, David's adjustment 5). One resize happens at a time, so its state is the document's too:
   * `pulling` names the section as well as the element. Pointer capture on the section still
   * routes the gesture there, and the events bubble to the document. The design-tools gate moved
   * from the wiring into the handlers, because the wiring runs once per session and the tools can
   * be turned on after it.
   */
  function wireResizing(iframeDoc: Document) {
    const coarse = iframeDoc.defaultView?.matchMedia("(pointer: coarse)").matches === true;

    const target = (
      section: HTMLElement,
      sectionId: string,
    ): { el: HTMLElement; writing: boolean } | null => {
      const chosen = chosenText.current;
      if (!chosen || chosen.sectionId !== sectionId) return null;
      const el = section.querySelector<HTMLElement>(`[data-id="${CSS.escape(chosen.elementId)}"]`);
      // Top-level only: a placement belongs to an element of the section, and a line inside a
      // list has none of its own.
      if (!el || el.parentElement !== section) return null;
      return { el, writing: el.isContentEditable };
    };

    /** Which edge of the chosen element the point is on, or `null` for anything that is not a resize. */
    const edgeUnder = (
      event: PointerEvent,
      section: HTMLElement,
      sectionId: string,
    ): { el: HTMLElement; edge: Edge } | null => {
      if (designToolsNow.current !== true) return null;
      // A finger is wider than this zone in every direction, so touch gets real handles instead.
      if (event.pointerType === "touch") return null;
      if (deviceNow.current === "mobile") return null;
      if (!findSection(docNow.current, sectionId)?.section.layout) return null;
      const found = target(section, sectionId);
      if (!found) return null;
      const zoom = zoomOf(iframeDoc);
      const edge = edgeAt(
        { x: event.clientX, y: event.clientY },
        found.el.getBoundingClientRect(),
        {
          // Screen pixels, divided by the canvas zoom (David's adjustment 3 of sprint 25) — and
          // asymmetric while writing, 6 outside and 2 in (adjustment 8).
          outside: EDGE_ZONE / zoom,
          inside: (found.writing ? EDGE_ZONE_WRITING_INSIDE : EDGE_ZONE) / zoom,
        },
      );
      return edge ? { el: found.el, edge } : null;
    };

    let pulling: {
      readonly section: HTMLElement;
      readonly sectionId: string;
      readonly el: HTMLElement;
      readonly edge: Edge;
      readonly from: Placement;
      readonly column: string;
      readonly row: string;
    } | null = null;
    let pulled: PlacementEdit | null = null;

    /** The cursor, on the element and on the section both, as classes (adjustment 3). */
    const showCursor = (section: HTMLElement, el: HTMLElement | null, edge: Edge | null) => {
      for (const node of [section, el]) {
        if (!node) continue;
        for (const name of [...node.classList]) {
          if (name.startsWith("rb-cursor-")) node.classList.remove(name);
        }
        if (edge) node.classList.add(`rb-cursor-${cursorFor(edge).replace("-resize", "")}`);
      }
    };

    const paintHandles = (section: HTMLElement) => {
      const sectionId = section.dataset["section"];
      if (!sectionId) return;
      for (const handle of section.querySelectorAll(".rb-handle")) handle.remove();
      if (!coarse || deviceNow.current === "mobile" || pulling) return;
      if (designToolsNow.current !== true) return;
      // Asked of the page and not of the state (ADR 0050 día 7): `rb-free` is the renderer's own
      // class for a free section, and it is on the document being drawn on.
      if (!section.classList.contains("rb-free")) return;
      const found = target(section, sectionId);
      if (!found) return;
      const host = section.getBoundingClientRect();
      const box = found.el.getBoundingClientRect();
      for (const spot of handlesFor({
        box: {
          left: box.left - host.left,
          top: box.top - host.top,
          width: box.width,
          height: box.height,
        },
        host: { width: host.width, height: host.height },
      })) {
        const handle = chrome(iframeDoc, "div");
        handle.className = `rb-handle rb-handle-${spot.edge}`;
        handle.setAttribute("aria-hidden", "true");
        handle.style.left = `${Math.round(spot.left)}px`;
        handle.style.top = `${Math.round(spot.top)}px`;
        handle.addEventListener("pointerdown", (event) =>
          begin(section, sectionId, spot.edge, found.el, event),
        );
        section.appendChild(handle);
      }
    };
    const repaintAll = () => {
      for (const section of iframeDoc.querySelectorAll<HTMLElement>("[data-section]")) {
        paintHandles(section);
      }
    };

    const stop = () => {
      if (!pulling) return;
      const { section, el } = pulling;
      // The live preview was written onto the element's own inline grid area, which is the
      // renderer's to own: put back exactly what was there. A committed resize gets it again from
      // the patch, and a cancelled one must leave no trace.
      el.style.gridColumn = pulling.column;
      el.style.gridRow = pulling.row;
      for (const guide of section.querySelectorAll(".rb-guide")) guide.remove();
      showCursor(section, el, null);
      iframeDoc.documentElement.classList.remove("rb-resizing");
      flushQueuedPatch.current();
      iframeDoc.documentElement.style.cursor = "";
      pulling = null;
      pulled = null;
      repaintAll();
    };

    const begin = (
      section: HTMLElement,
      sectionId: string,
      edge: Edge,
      el: HTMLElement,
      event: PointerEvent,
    ) => {
      const placement = findSection(docNow.current, sectionId)?.section.layout?.placements.find(
        (candidate) => candidate.elementId === el.dataset["id"],
      );
      if (!placement) return;
      // Taken from the browser and from everything else: without this a press on a chosen text
      // starts a native selection, and the click that follows would choose, write, or close a
      // menu over a gesture that is about one element's own box.
      event.preventDefault();
      event.stopPropagation();
      pulling = {
        section,
        sectionId,
        el,
        edge,
        from: placement,
        column: el.style.gridColumn,
        row: el.style.gridRow,
      };
      pulled = null;
      section.setPointerCapture(event.pointerId);
      for (const handle of section.querySelectorAll(".rb-handle")) handle.remove();
      iframeDoc.documentElement.classList.add("rb-resizing");
      iframeDoc.documentElement.style.cursor = cursorFor(edge);
    };

    // In the capture phase: the press in the zone must beat choosing, writing, closing a menu and
    // arming the drag.
    delegate(
      iframeDoc,
      "pointerdown",
      "[data-section]",
      (section, event) => {
        const sectionId = section.dataset["section"];
        if (!sectionId) return;
        const found = edgeUnder(event, section, sectionId);
        if (found) begin(section, sectionId, found.edge, found.el, event);
      },
      { capture: true },
    );

    delegate(iframeDoc, "pointermove", "[data-section]", (section, event) => {
      if (!pulling) {
        const sectionId = section.dataset["section"];
        if (!sectionId) return;
        // A hand looking for the edge. The cursor is the whole of «se descubra sin explicación».
        const found = edgeUnder(event, section, sectionId);
        showCursor(
          section,
          found?.el ?? target(section, sectionId)?.el ?? null,
          found?.edge ?? null,
        );
        return;
      }
      if (section !== pulling.section) return;
      // The live preview is the element's own grid area, rewritten — not a transform — so a text
      // rewraps as it narrows and a photograph's area grows without the photograph stretching.
      const metrics = gridMetricsOf(section);
      const owns = axes(pulling.edge);
      const guided = guidesFor({
        x: owns.horizontal ? [event.clientX] : [],
        y: owns.vertical ? [event.clientY] : [],
        others: neighbourRects(section, pulling.el.dataset["id"]),
        centreX: centreOf(metrics),
        threshold: GUIDE_ZONE / zoomOf(iframeDoc),
      });
      drawGuides(section, guided.lines);
      const x = event.clientX + guided.dx;
      const y = event.clientY + guided.dy;
      pulled = resizeTo(pulling.from, pulling.edge, {
        startColumn: fineColumnAt(x, metrics),
        endColumn: fineLastColumnAt(x, metrics),
        startRow: rowAt(y, metrics),
        endRow: lastRowAt(y, metrics),
      });
      const next = { ...pulling.from, ...pulled };
      pulling.el.style.gridColumn = `${fineTrack(next.column)}/span ${fineTrackSpan(
        next.column,
        next.columnSpan,
      )}`;
      pulling.el.style.gridRow = `${next.row}/span ${next.rowSpan}`;
    });

    const release = () => {
      if (!pulling) return;
      const { el, sectionId } = pulling;
      const elementId = el.dataset["id"];
      const edit = pulled;
      const wasWriting = el.isContentEditable;
      stop();
      // For the probe: what the gesture decided, before the document is asked to change.
      record("resize", { sectionId, elementId, edge: pulling?.edge ?? null, edit, wasWriting });
      if (!elementId || !edit || Object.keys(edit).length === 0) return;
      if (wasWriting) {
        // The words come first, and then the box (ADR 0050 día 4): this editor commits a text on
        // blur, so the text is committed the way clicking away commits it, and the writing is
        // picked up again on the other side (`keepWriting`).
        keepWriting.current = { sectionId, elementId };
        el.blur();
      } else {
        keepChosenFocus.current = true;
      }
      propsNow.current.onSetPlacement(sectionId, elementId, edit);
    };
    delegate(iframeDoc, "pointerup", "[data-section]", () => release());
    delegate(iframeDoc, "pointercancel", "[data-section]", () => stop());
    delegate(iframeDoc, "lostpointercapture", "[data-section]", () => release());

    // What `markChosen` and the redraw call, found by the document it happened in.
    handlePainter.current = repaintAll;
    repaintAll();
    observeSections(iframeDoc);
  }

  /**
   * **One `ResizeObserver` per document, observing every section the page has** (sprint 25 día 8
   * for the why — handles that stayed behind when the page reflowed — and sprint 26 día 3 for the
   * shape: a patch that inserts a section calls this again, and `observe` on a section already
   * observed is a no-op). The callback asks for the document's painter at the time it fires.
   */
  const sectionObservers = useRef(new WeakMap<Document, ResizeObserver>());
  function observeSections(iframeDoc: Document) {
    const view = iframeDoc.defaultView;
    if (!view) return;
    let watcher = sectionObservers.current.get(iframeDoc);
    if (!watcher) {
      watcher = new view.ResizeObserver(() => handlePainter.current?.());
      sectionObservers.current.set(iframeDoc, watcher);
    }
    for (const section of iframeDoc.querySelectorAll<HTMLElement>("[data-section]")) {
      watcher.observe(section);
    }
  }

  /**
   * **The element follows the hand and stays where it is let go** (ADR 0050 §6, sprint 25 día 3).
   *
   * This is the sprint's own request: «quiero que al arrastrar un elemento visual este se quede en
   * la posición donde se deja», and three of sprint 24's decisions change shape for it.
   *
   * - **No ghost.** The element itself travels, on a `transform` — cromo, never the document, the
   *   same way the floating bar moves. Yesterday's ghost existed because a twelve-column snap moved
   *   the element somewhere else on release, so the honest preview was the destination's rectangle
   *   rather than the element under the hand. With a unit of nine pixels the destination *is* where
   *   the hand is, within four or five, so the element is the preview — and a second thing on screen
   *   saying the same would be noise. (Amends ADR 0048 §5.)
   * - **Overlapping is allowed**, so nothing is refused for being occupied and the stacking order is
   *   the document's own. (Amends ADR 0048 §4.)
   * - **A held click drags, whether or not the element was chosen first.** Yesterday a text had to
   *   be chosen before it could be dragged, because a drag over a text selects words; movement is
   *   what tells the two apart, and it is the thing the browser can be asked about. A click that
   *   does not move still chooses, a second click still writes, and **inside a text being written
   *   in, a drag still selects words** — which is the one place the ambiguity is real. (Amends
   *   ADR 0047 §1 and ADR 0048 §8.)
   *
   * On a phone the gesture still reorders (ADR 0049 §7), and in a section the catalog draws it still
   * asks (ADR 0048 §7): neither of those is about where a pixel lands.
   *
   * **Written on `pointerup` and never on `pointermove`.** One drag is one step of history, which
   * is the product answer — and under `swap` there was a technical one underneath it: every edit
   * replaced the whole `srcDoc`, which destroyed the injected chrome, the listeners of this very
   * drag included. The listeners are the document's now and survive every edit (ADR 0051 §5), so
   * the product answer stands on its own (ADR 0051's amendment to ADR 0048 §6).
   */
  /** A placed element's gesture state — a drag or a run of arrows — kept per element in a map
   * since the listeners stopped being per element (ADR 0051 §5). */
  interface DragState {
    from: Point | null;
    grab: Point;
    took: Rect | null;
    moving: Placement | null;
    moved: boolean;
    outcome: Drop | null;
    mobileSwap: string | null;
    gesture: "none" | "move" | "ask";
    asked: boolean;
    run: ArrowRun | null;
    runTimer: number | undefined;
  }

  /**
   * **What a placed element needs on itself** (ADR 0051 §5): `draggable` off on images and links
   * so the browser's own drag never starts. Only with the tools on, as the whole wiring used to
   * be; idempotent, so it runs at wiring and after every patch.
   *
   * The Tab stop a photograph or a list gets with the tools on is `applyCanvasStops`'s (ADR 0052
   * §2), which also takes it away when the tools go off — the `0` given here used to outlive the
   * switch, because nothing ever removed it.
   */
  function prepareDraggables(iframeDoc: Document) {
    if (designToolsNow.current !== true) return;
    for (const node of iframeDoc.querySelectorAll<HTMLElement>("img, a")) {
      if (node.draggable) node.draggable = false;
    }
  }

  /**
   * **The element follows the hand and stays where it is let go** (ADR 0050 día 3), **the arrows
   * move it a unit and a run is one step** (día 6) — and since sprint 26 día 3 the listeners are
   * the document's, dispatched to the `[data-id]` the event concerns (ADR 0051 §5). The gate on the
   * design tools is in each handler, because the wiring now outlives the switch.
   */
  function wireDragging(iframeDoc: Document) {
    delegate(iframeDoc, "dragstart", "img, a", (_, event) => event.preventDefault());

    const states = new WeakMap<HTMLElement, DragState>();
    const stateOf = (el: HTMLElement): DragState => {
      let state = states.get(el);
      if (!state) {
        state = {
          from: null,
          grab: { x: 0, y: 0 },
          took: null,
          moving: null,
          moved: false,
          outcome: null,
          mobileSwap: null,
          gesture: "none",
          asked: false,
          run: null,
          runTimer: undefined,
        };
        states.set(el, state);
      }
      return state;
    };
    const placedAt = (el: HTMLElement) => {
      const section = el.closest<HTMLElement>("[data-section]");
      const sectionId = section?.dataset["section"];
      const elementId = el.dataset["id"];
      return section && sectionId && elementId ? { section, sectionId, elementId } : null;
    };

    // A click right after a drag is the drag's own release, not a choice (ADR 0048 §2).
    let justDragged = false;
    iframeDoc.addEventListener("pointerdown", () => {
      justDragged = false;
    });
    iframeDoc.addEventListener(
      "click",
      (event) => {
        if (!justDragged) return;
        justDragged = false;
        event.stopPropagation();
        event.preventDefault();
      },
      true,
    );

    // Arriving at a photograph or a list by Tab chooses it, as it does a text.
    delegate(iframeDoc, "focusin", "[data-id]", (el) => {
      if (designToolsNow.current !== true) return;
      if (!EDITABLE_TAGS.has(el.tagName)) markChosen(iframeDoc, el);
    });

    const clear = (el: HTMLElement, section: HTMLElement, state: DragState) => {
      state.from = null;
      state.moving = null;
      state.moved = false;
      state.outcome = null;
      state.mobileSwap = null;
      state.gesture = "none";
      state.asked = false;
      el.classList.remove("rb-moving");
      // The displacement is chrome and lives on the element for exactly as long as the hand does.
      el.style.transform = "";
      state.took = null;
      for (const guide of section.querySelectorAll(".rb-guide")) guide.remove();
      iframeDoc.documentElement.classList.remove("rb-dragging");
      flushQueuedPatch.current();
      for (const ghost of iframeDoc.querySelectorAll(".rb-ghost")) ghost.remove();
    };

    delegate(iframeDoc, "pointerdown", "[data-id]", (el, event) => {
      if (designToolsNow.current !== true) return;
      // Writing wins: inside a text being written in, a drag selects words (ADR 0047).
      if (el.isContentEditable) return;
      const at = placedAt(el);
      if (!at) return;
      const state = stateOf(el);
      const chosen =
        chosenText.current?.sectionId === at.sectionId &&
        chosenText.current?.elementId === at.elementId;
      // A finger drags only what it has chosen; otherwise one finger scrolls (ADR 0049 §7).
      if (event.pointerType === "touch" && !chosen) return;
      const layout = findSection(docNow.current, at.sectionId)?.section.layout ?? null;
      if (layout === null) {
        // A catalog section: a drag past the threshold opens the «Diseñar a mano» offer.
        state.gesture = "ask";
        state.from = { x: event.clientX, y: event.clientY };
        return;
      }
      const found = layout.placements.find((placement) => placement.elementId === at.elementId);
      if (!found) return;
      state.moving = found;
      state.gesture = "move";
      state.from = { x: event.clientX, y: event.clientY };
      const rect = el.getBoundingClientRect();
      state.grab = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      state.took = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      el.setPointerCapture(event.pointerId);
    });

    delegate(iframeDoc, "pointermove", "[data-id]", (el, event) => {
      const state = states.get(el);
      if (!state?.from) return;
      const at = placedAt(el);
      if (!at) return;
      const { section, sectionId, elementId } = at;
      const now = { x: event.clientX, y: event.clientY };
      if (!isDragBeyond(state.from, now, DRAG_THRESHOLD / zoomOf(iframeDoc)) && !state.moved)
        return;
      if (state.gesture === "ask") {
        if (state.asked) return;
        state.asked = true;
        openEscalateOffer.current?.(sectionId, el);
        justDragged = true;
        return;
      }
      if (!state.moving) return;
      if (!state.moved) {
        state.moved = true;
        el.classList.add("rb-moving");
        iframeDoc.documentElement.classList.add("rb-dragging");
        iframeDoc.getSelection()?.removeAllRanges();
      }
      if (deviceNow.current === "mobile") {
        // On a phone the same gesture reorders (ADR 0049, rule 7).
        const rows = [...section.querySelectorAll<HTMLElement>("[data-id]")]
          .filter((node) => node.parentElement === section)
          .map((node) => {
            const box = node.getBoundingClientRect();
            return { elementId: node.dataset["id"] ?? "", top: box.top, bottom: box.bottom };
          })
          .sort((a, b) => a.top - b.top);
        const swap = reorderAt({ rows, moving: elementId, y: now.y });
        state.mobileSwap = swap.kind === "moveUp" ? swap.elementId : null;
        const target = rows.find((row) => row.elementId === state.mobileSwap);
        const host = section.getBoundingClientRect();
        let ghost = section.querySelector<HTMLElement>(".rb-ghost");
        if (!ghost) {
          ghost = chrome(iframeDoc, "div");
          ghost.className = "rb-ghost";
          ghost.setAttribute("aria-hidden", "true");
          section.appendChild(ghost);
        }
        const over = target ?? rows.find((row) => row.elementId === elementId);
        ghost.style.left = "0px";
        ghost.style.width = `${Math.round(host.width)}px`;
        ghost.style.top = `${Math.round((over?.top ?? host.top) - host.top)}px`;
        ghost.style.height = `${Math.round((over?.bottom ?? host.top) - (over?.top ?? host.top))}px`;
        ghost.classList.toggle("rb-ghost-no", state.mobileSwap === null);
        ghost.textContent = state.mobileSwap === null ? es["editor.drag.order"] : "";
        return;
      }
      const metrics = gridMetricsOf(section);
      const raw = { x: now.x - state.from.x, y: now.y - state.from.y };
      const took = state.took;
      const guided = took
        ? guidesFor({
            x: [took.left + raw.x, (took.left + took.right) / 2 + raw.x, took.right + raw.x],
            y: [took.top + raw.y, (took.top + took.bottom) / 2 + raw.y, took.bottom + raw.y],
            others: neighbourRects(section, elementId),
            centreX: centreOf(metrics),
            threshold: GUIDE_ZONE / zoomOf(iframeDoc),
          })
        : { dx: 0, dy: 0, lines: [] };
      el.style.transform = `translate(${raw.x + guided.dx}px, ${raw.y + guided.dy}px)`;
      drawGuides(section, guided.lines);
      state.outcome = dropAt({
        metrics,
        at: { x: now.x - state.grab.x + guided.dx, y: now.y - state.grab.y + guided.dy },
        moving: state.moving,
      });
    });

    const release = (el: HTMLElement) => {
      const state = states.get(el);
      if (!state?.from) return;
      const at = placedAt(el);
      if (!at) return;
      const wasMoved = state.moved && state.gesture === "move";
      const drop = state.outcome;
      const swapWith = state.mobileSwap;
      clear(el, at.section, state);
      if (!wasMoved) return;
      justDragged = true;
      if (swapWith !== null) {
        propsNow.current.onMoveUpOnMobile(at.sectionId, swapWith);
        return;
      }
      if (drop?.kind === "refuse") {
        announce(es["editor.drag.rows"]);
        return;
      }
      if (drop?.kind !== "place") return;
      markChosen(iframeDoc, el);
      keepChosenFocus.current = true;
      propsNow.current.onSetPlacement(at.sectionId, at.elementId, {
        column: drop.at.column,
        row: drop.at.row,
      });
    };
    delegate(iframeDoc, "pointerup", "[data-id]", (el) => release(el));
    delegate(iframeDoc, "pointercancel", "[data-id]", (el) => release(el));
    delegate(iframeDoc, "lostpointercapture", "[data-id]", (el) => release(el));

    // A run of arrows is one movement and one step (ADR 0050 día 6): written on keyup, after
    // 300 ms of quiet, or on blur — the net for the press whose keyup never comes.
    const flushRun = (el: HTMLElement) => {
      const state = states.get(el);
      iframeDoc.documentElement.classList.remove("rb-arrowing");
      flushQueuedPatch.current();
      if (!state) return;
      window.clearTimeout(state.runTimer);
      const total = state.run;
      state.run = null;
      if (!moves(total)) return;
      const at = placedAt(el);
      if (!at) return;
      const layout = findSection(docNow.current, at.sectionId)?.section.layout ?? null;
      const placement = layout?.placements.find(
        (candidate) => candidate.elementId === at.elementId,
      );
      if (!placement || !total) return;
      const drop = arrowDrop({ moving: placement, columns: total.columns, rows: total.rows });
      if (drop.kind !== "place") return;
      keepChosenFocus.current = true;
      const box = el.getBoundingClientRect();
      const metrics = gridMetricsOf(at.section);
      announce(announceText({ x: box.left - metrics.left, y: box.top - metrics.top }));
      propsNow.current.onSetPlacement(at.sectionId, at.elementId, {
        column: drop.at.column,
        row: drop.at.row,
      });
    };

    delegate(iframeDoc, "keydown", "[data-id]", (el, event) => {
      if (designToolsNow.current !== true) return;
      if (el.isContentEditable) return;
      const at = placedAt(el);
      if (!at) return;
      const isChosen =
        chosenText.current?.sectionId === at.sectionId &&
        chosenText.current?.elementId === at.elementId;
      if (!isChosen) return;
      if (event.key === "Escape" && !EDITABLE_TAGS.has(el.tagName)) {
        event.preventDefault();
        markChosen(iframeDoc, null);
        at.section.focus({ preventScroll: true });
        return;
      }
      const action = arrowAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
      });
      if (action.kind === "none") return;
      const layout = findSection(docNow.current, at.sectionId)?.section.layout ?? null;
      if (layout === null) return;
      const placement = layout.placements.find((candidate) => candidate.elementId === at.elementId);
      if (!placement) return;
      event.preventDefault();
      const state = stateOf(el);
      state.run = accumulate(
        state.run,
        { columns: action.columns, rows: action.rows },
        performance.now(),
      );
      // A run previews on the element's own grid area until it is written; a patch that lands
      // meanwhile waits for it (adjustment 3).
      iframeDoc.documentElement.classList.add("rb-arrowing");
      const drop = arrowDrop({
        moving: placement,
        columns: state.run.columns,
        rows: state.run.rows,
      });
      if (drop.kind === "refuse") {
        announce(es["editor.drag.rows"]);
        return;
      }
      if (drop.kind === "place") {
        el.style.gridColumn = `${fineTrack(drop.at.column)}/span ${fineTrackSpan(
          drop.at.column,
          drop.at.columnSpan,
        )}`;
        el.style.gridRow = `${drop.at.row}/span ${drop.at.rowSpan}`;
      }
      window.clearTimeout(state.runTimer);
      state.runTimer = window.setTimeout(() => flushRun(el), RUN_IDLE_MS);
    });
    delegate(iframeDoc, "keyup", "[data-id]", (el, event) => {
      if (event.key.startsWith("Arrow")) flushRun(el);
    });
    delegate(iframeDoc, "focusout", "[data-id]", (el) => {
      if (states.has(el)) flushRun(el);
    });

    prepareDraggables(iframeDoc);
    settleDragging(iframeDoc);
  }

  /** The focus a drag or a run asked to keep, put back on the element after a wiring or a patch. */
  function settleDragging(iframeDoc: Document) {
    if (!keepChosenFocus.current) return;
    keepChosenFocus.current = false;
    const chosen = chosenText.current;
    const back = chosen
      ? iframeDoc
          .querySelector(`[data-section="${CSS.escape(chosen.sectionId)}"]`)
          ?.querySelector<HTMLElement>(`[data-id="${CSS.escape(chosen.elementId)}"]`)
      : null;
    if (back) {
      markChosen(iframeDoc, back);
      back.focus({ preventScroll: true });
    }
  }

  function wireHandmade(iframeDoc: Document) {
    // Which sections carry a bar in *this* document, so the set can be replaced rather than added
    // to: a section that has been reverted has to be able to arrive again if it is escalated twice.
    const arriving: string[] = [];
    // The bars already in this document go first, for the same reason `wireInsertion` clears its
    // gaps: a second pass replaces, it does not stack a second «Diseñada a mano» over the first.
    for (const old of iframeDoc.querySelectorAll(".rb-handmade")) old.remove();
    if (!designToolsNow.current) return;

    for (const element of iframeDoc.querySelectorAll<HTMLElement>("[data-section]")) {
      const sectionId = element.dataset.section;
      if (!sectionId || !isHandDesigned(docNow.current, sectionId)) continue;

      const bar = chrome(iframeDoc, "div");
      bar.className = "rb-handmade";

      const badge = chrome(iframeDoc, "span");
      badge.className = "rb-handmade-badge";
      badge.innerHTML =
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B4740B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l4-1 11-11-3-3L4 17l-1 4z"/></svg>';
      badge.appendChild(iframeDoc.createTextNode(es["editor.section.handmade"]));
      bar.appendChild(badge);

      const name = chrome(iframeDoc, "span");
      name.className = "rb-handmade-name";
      name.textContent = sectionDisplayName(docNow.current, sectionId);
      bar.appendChild(name);

      const back = chrome(iframeDoc, "button");
      back.type = "button";
      back.className = "rb-handmade-back";
      back.textContent = es["editor.section.revert"];
      back.addEventListener("click", (event) => {
        event.stopPropagation();
        requestRevert(sectionId);
      });
      bar.appendChild(back);

      // `rb-free` is the renderer's to add since ADR 0050 — it selects the fine grid's rules in
      // both targets, so the editor adding it here would be a class the preview had for one frame
      // and the published page for none. `wireDesigning` still reads it off the section.
      // **Before the section, not inside it**, which is what mockup 16 draws and what the code had
      // diverged from — see `docs/design/REVIEW.md`, 7 October 2026. Prepended, it was
      // `position: absolute` over the section's own first element: measured on a 320px canvas it
      // covered 31px of the cover's photograph. Its own row covers nothing at any width, and it
      // leaves the client's section exactly the height it will be once published, which a header
      // pushed inside it would not.
      //
      // After `wireInsertion`, so the order down the page is: insertion gap, this bar, the section.
      element.before(bar);
      arriving.push(sectionId);

      // Only a bar that was not there a document ago plays its entrance — see `barredSections`.
      // Measured after inserting, because the height is 44px in the canvas's desktop width and 75
      // at 320 once «Volver a la original» wraps, and only the DOM knows which.
      if (!barredSections.current.has(sectionId)) {
        bar.style.setProperty("--rb-enter-offset", `${bar.offsetHeight}px`);
        bar.classList.add("rb-handmade-in");
      }
    }
    barredSections.current = new Set(arriving);

    // The stripes, on whichever section the panel is about. Here as well as in the effect above,
    // because after a remount (`swap`) the effect can fire before the new frame has loaded.
    syncGrid(
      iframeDoc,
      designOnNow.current ? designSectionIdNow.current : null,
      placingElementIdNow.current,
    );
  }

  /**
   * Which document the chrome is attached to, so attaching it twice is impossible and attaching it
   * *early* is safe. There is one document per session and this names it. Under `swap` a reload
   * and a remount each produced a new `Document`, so the identity was the whole bookkeeping —
   * there was no flag to reset and nothing to clear.
   */
  const wiredDoc = useRef<Document | null>(null);
  /** One number per wired document, stamped on its root as `data-rb-serial` (sprint 18 day 5). */
  const wireSerial = useRef(0);

  /**
   * Attach the canvas's chrome **as soon as the page is parsed**, and never twice.
   *
   * **This closes a window in which the whole preview was visible and completely inert**, measured on
   * 2 October 2026 and the cause of the `e2e` failure this sprint recorded four times:
   *
   * | Moment | When |
   * |---|---|
   * | `[data-section]` queryable, `readyState: "interactive"` | **0.2 ms** |
   * | `wireInteractions` runs, on the frame's `load` | **64.9 ms** |
   *
   * Sixty-four milliseconds in which every section is on screen, looks exactly as it does a moment
   * later, and **nothing is listening**. A click there is not delayed, it is *lost*: instrumented
   * over a real press, the section was never selected and the action cluster was never drawn —
   * `{"selected":0,"actions":0}` two and a half seconds later. A keystroke is lost the same way,
   * because `wireEditing` is what makes anything `contenteditable` in the first place. That is a
   * person clicking the preview the instant it appears and getting nothing back; they click again and
   * never mention it, which is why nothing but a test ever reported it.
   *
   * **The window is the `load` event waiting for subresources.** The rendered page's `@font-face`
   * rules name `fonts/*.woff2` relative, which inside a `srcDoc` iframe resolve against the editor's
   * own origin — eight requests, nothing there to answer them. `load` waits for all eight, so the
   * window is as wide as the slowest of them: ~65 ms on this machine, and wider on a loaded CI
   * runner, which is exactly the correlation the backlog could not explain.
   *
   * `onLoad` stays, as the backstop for anything this misses. It is the same call, and the document
   * identity above is what makes the second one free.
   */
  function wireOnce(
    frame: HTMLIFrameElement | null | undefined,
    via: "lookahead" | "onload" = "onload",
  ) {
    const iframeDoc = frame?.contentDocument;
    if (!iframeDoc || wiredDoc.current === iframeDoc) return;
    // **The document carries its own mark, and the mark is what «never twice» rests on.**
    //
    // Under `swap` `wiredDoc` was one ref shared by two frames, and a ref can only remember one
    // document. With two documents loading at once — a `srcDoc` change (the bank photograph
    // arriving after the editor opened) during a chrome swap (the account's switch preference
    // arriving after mount) — their `load` events interleaved: the entering document was promoted
    // and wired, the outgoing frame's late `load` wired *its* document and moved the ref, and the
    // entering frame's own `load` then found its document was «not the wired one» and wired it a
    // second time. Reported by David on 9 October 2026 on the deployed editor, right after a
    // redeploy when fonts and photographs come off a cold instance: «+ Añadir sección aquí»,
    // «Diseñada a mano», «Portada» and «Volver a la original» drawn twice.
    //
    // One frame cannot interleave with itself, so the ref alone would do now. The mark stays
    // because `onLoad` and the look-ahead still race each other for the one document, and because
    // it is what the patch effect asks before it patches: the document's own answer rather than a
    // ref's memory of it.
    //
    // Checked by sabotage on 9 October 2026: with this ref guard removed so `onLoad` re-enters,
    // the old code drew 12 gaps for 5 sections — the reported picture — and the mark alone, or the
    // clearing in `wireInsertion` and `wireHandmade` alone, each kept it at 6.
    if (iframeDoc.documentElement.dataset["rbWired"] === "1") return;
    iframeDoc.documentElement.dataset["rbWired"] = "1";
    wireSerial.current += 1;
    iframeDoc.documentElement.dataset["rbSerial"] = String(wireSerial.current);
    record("wire", {
      serial: wireSerial.current,
      via,
      readyState: iframeDoc.readyState,
      sections: iframeDoc.querySelectorAll("[data-section]").length,
      live: frame === liveFrame(),
    });
    wiredDoc.current = iframeDoc;
    wireInteractions(iframeDoc);
    focusLineAfterChange(iframeDoc);
    /*
     * **Nothing puts the scroll back any more, because nothing takes it away.**
     *
     * `restoreReadingPosition` ran here, for every new document: under `swap` an ordinary edit
     * replaced the document in place and sent the person to the top of the page, which direction
     * reported on 6 October 2026 — «le obliga a hacer scroll down para volver al área que estaba
     * editando», measured at 500 px → 0. A patched document keeps its scroll by doing nothing at
     * all, so the recorder, the anchor, the restore and its second pass went with the route on
     * sprint 27 día 1. The page's only scroll rule is «another page starts at the top»
     * (`applyPatch`, día 4).
     *
     * **What is still open is a different thing** and it is in the backlog: the page moves when the
     * *card* changes width, which is a panel opening or closing, and that happens under either
     * route. Nothing here ever ran on a width change.
     */
    // A wiring counts as an edit on the page for the e2e's signal; and a change that arrived before
    // this document was wired is applied to it now.
    bumpEdit(iframeDoc);
    if (pendingPatch.current) {
      pendingPatch.current = false;
      applyPatch(iframeDoc);
    }
  }

  function wireInteractions(iframeDoc: Document) {
    // The canvas is an `<iframe srcDoc>`, so a key pressed over the page being edited is dispatched
    // in *its* document and never reaches the editor's. Without this the shortcut would work
    // everywhere except the one place the person is actually looking.
    iframeDoc.addEventListener("keydown", handleShortcut);

    const style = chrome(iframeDoc, "style");
    style.textContent = [
      /*
       * **The cause of this rule is gone, the rule stays, and it is no longer load-bearing —
       * measured, not assumed.** It was added because selecting any section made the preview scroll
       * 4px sideways: `.rb-handle-tr` and `.rb-handle-br` sat at `right: -4px` on a full-bleed
       * section with no margin to absorb the bleed. Sprint 17 day 2 withdrew those handles, and the
       * walk «no dibuja tiradores en las esquinas, y el lienzo sigue sin desplazarse» was then run
       * with this line deleted: it **passed**. Nothing else in the chrome bleeds.
       *
       * Kept anyway, and the reason is the guarantee rather than the handles: the action cluster,
       * the gap pills and the handmade bar all sit inside a section already as wide as the frame,
       * and the next piece of chrome drawn one pixel past an edge would bring the scroll back.
       * Deleting it in the same change that withdrew its cause would be two changes wearing one
       * commit.
       *
       * **What the measurement opened, and this is not the day to close it:** a `clip` here also
       * hides overflow from the *owner's own* content, so the preview can look narrower-than-real
       * while `OverflowDialog` — which measures in its own frame — correctly reports a page that
       * will scroll once published. An editor that shows a tidier page than it publishes is the
       * kind of silence `docs/tasks/backlog.md` now records with this measurement beside it.
       *
       * Editor-only chrome, this stylesheet only: `wireInteractions` runs on the live iframe and
       * never on `render(doc, "html")`, so `overflow-x: clip` here cannot reach a published page.
       * `clip` rather than `hidden`, because `hidden` on one axis makes the other compute to `auto`
       * by spec — this iframe's own vertical scroll must stay exactly what it already is.
       */
      "html, body { overflow-x: clip; }",
      /*
       * **The affordance hangs on the marker, not on the attribute** (ADR 0047, sprint 24 día 7).
       *
       * These two rules used to select `[contenteditable="true"]`, which every text in the canvas
       * was from the moment the frame was wired. Nothing is, now, until somebody writes in it — so
       * selecting the attribute would mean a page of texts with no sign that any of them can be
       * changed, which is the affordance this editor is built on.
       *
       * Three states, three looks, and the pair is the one the sections already use: **dashed on
       * hover** means «you could», **solid** means «this is the one». Writing keeps the solid
       * outline and adds the caret and the selection, which is what distinguishes it — and the hint
       * in the corner disappears, because its instruction has been followed.
       */
      "[data-rb-text] { cursor: text; border-radius: 3px;",
      "  outline: 2px dashed transparent; outline-offset: 3px; }",
      "[data-rb-text]:hover { outline-color: #156FE7; }",
      "[data-rb-text].rb-chosen { outline-style: solid; outline-color: #156FE7; }",
      '[data-rb-text][contenteditable="true"] { outline-style: solid; outline-color: #156FE7; }',
      /*
       * The focus ring of a chosen text, for the same reason a section has one that is not its
       * selection outline: where the keyboard is and what is chosen are two facts, and `#0F172A` at
       * 3px is the darkest ink the interface owns — WCAG 1.4.11 asks 3:1 of anything whose
       * appearance identifies a control, and the brand blue is spoken for by the choice itself.
       */
      "[data-rb-text]:focus-visible { outline: 3px dashed #0F172A; outline-offset: 3px; }",
      /*
       * The hint, in the section's own chrome and at the bottom of it — away from the verbs' cluster
       * at the top right and from the floating text bar, which opens over the words themselves.
       * `pointer-events: none`, because a line of advice that can eat a click is a bug with a
       * reason. It is **not** `aria-hidden`: the chosen text points at it with `aria-describedby`,
       * so a screen reader reading the text is told how to start writing in it.
       */
      `.rb-hint { position: absolute; left: ${VERB_SCALE.inset}px; bottom: ${VERB_SCALE.inset}px;`,
      "  z-index: 10; padding: 5px 9px; border-radius: 999px; pointer-events: none;",
      `  background: ${CHROME_SCALE.ink}; color: #FFFFFF;`,
      `  font: 600 12px/1.3 ${UI_FONT}; box-shadow: ${CHROME_SCALE.shadow2}; }`,
      // Touched screens have no hover and no double click worth the name; the hint still says what
      // to do, and the key legend is the thing that hides there (see `.rb-keys`).
      "@media (hover: none) and (pointer: coarse) { [data-rb-text]:hover { outline-color:",
      "  transparent; } }",
      "[data-section] { position: relative; cursor: pointer; }",
      "[data-section].rb-selected { outline: 2px solid #156FE7; outline-offset: -2px; }",
      /*
       * **The focus ring, and why it is not the selection outline** (sprint 17 day 3). Where the
       * keyboard *is* and which section is *chosen* are two different facts that are often the same
       * section and sometimes not: arrows move the keyboard without choosing anything, so somebody
       * two sections down from their choice must be able to see both. The ring is inset and dashed
       * against the solid selection outline, so the two read as different even in one colour.
       *
       * `:focus-visible` and not `:focus`: a mouse click on a section focuses it too, and drawing a
       * keyboard ring for a mouse user is the noise `:focus-visible` exists to prevent. The ring is
       * 3px at `#0F172A` — about 15:1 on white and the darkest ink the interface owns — because
       * WCAG 1.4.11 asks 3:1 of anything whose appearance identifies a control, and the brand blue
       * is already spoken for by the selection.
       */
      "[data-section]:focus-visible { outline: 3px dashed #0F172A; outline-offset: -5px; }",
      /*
       * **And the selection survives being focused**, which the first version of these two rules
       * did not. It also carried `[data-section]:focus { outline: none; }` as a belt over the
       * browser's default ring — unnecessary, because a modern engine draws that ring only for
       * `:focus-visible` — and `[data-section]:focus` and `[data-section].rb-selected` have the
       * same specificity, so the later one won: **clicking a section selected it and then erased
       * its outline.** Day 2's own walk caught it, asserting `outlineWidth` is `2px` after a click,
       * one day after it was written.
       *
       * The focus ring stays an `outline` and the selection becomes an inset `box-shadow` when the
       * two coincide, in that order on purpose: a focus indicator has to survive forced-colors
       * mode, where `box-shadow` is dropped and `outline` is kept. So the thing that must never
       * disappear is the one drawn with the more robust property.
       */
      ".rb-selected:focus-visible { box-shadow: inset 0 0 0 2px #156FE7; }",
      /*
       * The live region that says which section was chosen. Off screen rather than `display: none`,
       * which would stop a screen reader reading it at all, and clipped to a single pixel rather
       * than moved to a negative offset, which would make the frame scrollable.
       */
      ".rb-announce { position: absolute; width: 1px; height: 1px; overflow: hidden;",
      "  clip-path: inset(50%); white-space: nowrap; }",
      /*
       * The key map. Fixed to the frame's own viewport, so it stays in view while the canvas
       * scrolls, and `pointer-events: none` so a legend can never eat a click. White on `#0F172A`
       * is about 17:1.
       */
      // The key legend is for a keyboard; on a screen that is touched and never hovered there is
      // none, and a fixed box in the corner of a 320px canvas covers what it would explain.
      "@media (hover: none) and (pointer: coarse) { .rb-keys { display: none; } }",
      ".rb-keys { position: fixed; left: 12px; bottom: 12px; z-index: 30; display: flex;",
      "  flex-direction: column; gap: 2px; padding: 8px 11px; border-radius: 10px;",
      "  background: #0F172A; color: #FFFFFF; pointer-events: none;",
      `  font: 500 12px/1.45 ${UI_FONT}; box-shadow: ${CHROME_SCALE.shadow2}; }`,
      ".rb-keys span:first-child { font-weight: 700; letter-spacing: 0.02em; }",
      // Inset within the section, not hung outside it like the corner handles: the cover is
      // the first section, with no room above it, and a button hanging above the top of the
      // page there would sit outside the iframe's own visible area — covered by whatever the
      // parent page draws above the iframe, and unclickable. Every section has room inside it.
      /**
       * **The verbs, at the size David could actually tell apart.**
       *
       * They were 26px with a 13px glyph from sprint 2 until 14 October 2026, a number nothing
       * decided — the mockups never drew this cluster, and 26 looks inherited from the text bar's
       * square buttons, which have no 2px ring eating into them. «Los iconos se ven muy pequeños y
       * no consigo diferenciarlos fácilmente», and measured he was plainly right: 26 minus the
       * ring leaves 22, and a 13px glyph in it is eight silhouettes that read as eight grey marks.
       *
       * `VERB_SCALE` holds the numbers so the walks can assert against what the CSS declares.
       *
       * **The growth is `transform: scale`, never width.** A button that grew by changing its box
       * would push its neighbours sideways — under a pointer that is already travelling towards
       * one of them, which is how you press «Borrar» having aimed at «Campos». A transform grows
       * the drawing and leaves the layout where it was.
       *
       * **`flex-wrap` with a `max-width`**, which is new and is a guard rather than a style: the
       * 320px sweep's own note says that if this cluster ever escaped its section at that width
       * nothing would measure it. Eight buttons 6px wider each is 48px more, so it stops being
       * hypothetical; wrapping keeps it inside, and the walk now measures it.
       *
       * Blue and red come from `CHROME_SCALE` instead of the `#156FE7`/`#DC2626` typed here, which
       * were the same values by luck rather than by reference. The two darker hover hexes go: the
       * emphasis is size and depth now, so a colour that existed only to say «you are on this one»
       * has nothing left to say.
       */
      /*
       * **`z-index` because the sample badge was eating two of these buttons, measured.** At 320px
       * on a cover the cluster is 212px wide and «Foto de ejemplo» is 116px at the opposite corner
       * of the same strip: they overlap by **74px**, and the badge carries `z-index: 6` while the
       * cluster carried none — so the badge painted over «Subir» and «Bajar» and took their clicks.
       * Two dead controls, and they were dead before this day widened the overlap from about 38px.
       *
       * 10 puts the cluster over the badge and still under the menus it opens (20) and the text
       * bar (30). The transient control somebody just summoned wins over the standing label; the
       * badge keeps the half of itself nothing is standing on, and from tomorrow the cluster can
       * simply be dragged off it, which is the whole of what David asked for.
       */
      `.rb-actions { position: absolute; top: ${VERB_SCALE.inset}px; right: ${VERB_SCALE.inset}px;`,
      "  z-index: 10; display: flex; flex-wrap: wrap; justify-content: flex-end;",
      `  gap: ${VERB_SCALE.gap}px; max-width: calc(100% - ${VERB_SCALE.inset * 2}px); }`,
      // The button and its word, as one thing: the word is positioned against this, not against
      // the section, so it follows its own button wherever the cluster sits.
      ".rb-verb { position: relative; display: flex; }",
      // The box a verb and the grip share, so the row stays level and one transition is declared
      // once. What differs between them is the width, the skin and what the cursor says.
      `.rb-action, .rb-grip { height: ${VERB_SCALE.size}px; display: flex; align-items: center;`,
      "  justify-content: center; border-radius: 999px; cursor: pointer;",
      `  box-shadow: ${CHROME_SCALE.shadow2};`,
      `  transition: transform ${CHROME_SCALE.fast} ${CHROME_SCALE.ease},`,
      `    box-shadow ${CHROME_SCALE.fast} ${CHROME_SCALE.ease}; }`,
      `.rb-action { width: ${VERB_SCALE.size}px; border: 2px solid #FFFFFF; }`,
      `.rb-action-move { background: ${CHROME_SCALE.brand}; }`,
      `.rb-action-delete { background: ${CHROME_SCALE.danger}; }`,
      ".rb-action:disabled { background: #B9CDEA; cursor: not-allowed; }",
      /*
       * **The handle, and it is deliberately not a verb.** Ink on white where the eight are white
       * on colour, narrower than they are, and the cursor says what it is for: a thing to pick the
       * bar up by rather than a ninth thing to press. `touch-action: none` so a finger dragging it
       * drags the bar instead of scrolling the page underneath — the one line that makes this work
       * on a tablet at all.
       */
      `.rb-grip { width: ${VERB_SCALE.grip}px; padding: 0; color: ${CHROME_SCALE.ink};`,
      `  background: ${CHROME_SCALE.surface}; border: 1px solid ${CHROME_SCALE.borderStrong};`,
      "  cursor: grab; touch-action: none; }",
      /*
       * While a drag is in flight, nothing underneath may be selected and every cursor is the
       * closed hand — `!important` because the cursor is otherwise decided by whatever the pointer
       * happens to be over, which during a drag is the client's own page.
       */
      ".rb-dragging, .rb-dragging * { user-select: none; cursor: grabbing !important; }",
      // While an edge is being pulled, the cursor is set on the root **inline** (it is one of four,
      // and which one is the gesture's own business), so the only thing a class is needed for is
      // keeping a text from selecting itself as the hand travels across it.
      ".rb-resizing, .rb-resizing * { user-select: none; }",
      /*
       * **The handles a finger gets** (ADR 0050 §6, día 7). Forty-four pixels of target — WCAG
       * 2.5.5's number and both platforms' own — with a dot of twelve drawn in the middle of it:
       * what a finger has to hit is not what the eye needs to see.
       *
       * `touch-action: none` on them and on the chosen element, **and on nothing else**, which is
       * what keeps one finger scrolling the canvas everywhere else (ADR 0049 §7). `z-index: 11`,
       * over the verbs' cluster (10) so a handle at a corner is never buried by it, and under the
       * text bar (30).
       */
      `.rb-handle { position: absolute; z-index: 11; width: ${HANDLE_TOUCH}px;`,
      `  height: ${HANDLE_TOUCH}px; display: grid; place-items: center; touch-action: none; }`,
      '.rb-handle::before { content: ""; width: 12px; height: 12px; border-radius: 50%;',
      `  background: #FFFFFF; border: 2px solid ${CHROME_SCALE.brand};`,
      `  box-shadow: ${CHROME_SCALE.shadow1}; }`,
      /*
       * **The alignment guides** (ADR 0050, día 5): one pixel of brand blue, under the verbs'
       * cluster (10) and the text bar (30) and over the stripes (0), and `pointer-events: none`
       * because a line that could swallow the pointer would end the gesture it is guiding. Drawn
       * `position: absolute`, which is what keeps a child of a grid from taking a row of it — the
       * lesson día 2 paid 33 pixels for.
       */
      `.rb-guide { position: absolute; z-index: 8; pointer-events: none;`,
      `  background: ${CHROME_SCALE.brand}; }`,
      /*
       * **A focus ring, which these eight buttons never had.** `globals.css` has drawn one for the
       * application's own side since sprint 15 and the pills inside the frame got theirs the same
       * day; the verbs were simply missed, so a keyboard got whatever Chromium draws by default on
       * a blue disc — which is a faint ring on a dark ground. Ink rather than the brand blue,
       * because the ring has to be seen *against* the brand blue on seven of the eight.
       *
       * The growth comes with it: a keyboard has no pointer to lead with, and the emphasis a
       * pointer gets at rest is the same emphasis a keyboard has to get on arrival.
       */
      `.rb-action:focus-visible, .rb-grip:focus-visible {`,
      `  outline: 2px solid ${CHROME_SCALE.ink}; outline-offset: 1px;`,
      `  transform: scale(${VERB_SCALE.grow}); }`,
      /*
       * The word.
       *
       * **`visibility: hidden` under the opacity, and the pair of them is the whole of a defect CI
       * found.** Hidden by opacity alone the word still counts as the section's rendered text:
       * `innerText` of a cover came back with «Subir Bajar Aspecto A mano Duplicar Campos Borrar»
       * glued in front of the business name, which is how the buffered-frame walk went red — and
       * the same would be true of a reader's own Ctrl+F, which would find «Duplicar» inside their
       * restaurant. Measured in Chromium on 14 October 2026: `opacity: 0` is collected by
       * `innerText`, `visibility: hidden` is not.
       *
       * The delay is what keeps the fade: shown, visibility flips at once and the opacity carries
       * the travel; hidden, visibility waits for the fade to finish before it takes the word out
       * of the page. `pointer-events: none` so it can never eat a click meant for what it covers,
       * and `aria-hidden` on the element itself, in `action()`.
       */
      `.rb-tip { position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%);`,
      `  padding: 3px 8px; font: 600 12px/1.2 ${UI_FONT}; color: #FFFFFF;`,
      `  background: ${CHROME_SCALE.ink}; border-radius: ${CHROME_SCALE.radiusSm};`,
      "  white-space: nowrap; pointer-events: none; opacity: 0; visibility: hidden;",
      `  transition: opacity ${CHROME_SCALE.fast} ${CHROME_SCALE.ease},`,
      `    visibility 0s linear ${CHROME_SCALE.fast}; }`,
      ".rb-action:focus-visible + .rb-tip, .rb-grip:focus-visible + .rb-tip {",
      "  opacity: 1; visibility: visible; transition-delay: 0s; }",
      // Dragged low in its section, a word under the row would be drawn past the section's own
      // edge, or over the top of the next one. `placeActions` decides the side; this draws it.
      ".rb-actions-low .rb-tip { top: auto; bottom: calc(100% + 6px); }",
      /*
       * **Emphasis inside `@media (hover: hover)`, the rule direction set for the pills.** A touch
       * screen reports a permanent false hover on some engines and never hovers on others, so it
       * is given the resting state always — which is why the resting state had to be the readable
       * one first. The keyboard's half is outside the query, above.
       */
      `@media (hover: hover) { .rb-action:hover:not(:disabled), .rb-grip:hover {`,
      `  transform: scale(${VERB_SCALE.grow}); box-shadow: ${CHROME_SCALE.shadow3}; }`,
      "  .rb-verb:hover .rb-tip { opacity: 1; visibility: visible; transition-delay: 0s; } }",
      // The hole a delete leaves, drawn as mockup 11 draws it — `2px dashed`, its own margin, the
      // name above and what happens next below. `UI_FONT` because it is the editor talking, not the
      // site: every other `rb-` node in this frame does the same.
      `.rb-hole { box-sizing: border-box; margin: 22px 30px; padding: 26px; font-family: ${UI_FONT};`,
      `  background: ${CHROME_SCALE.bg}; border: 1px solid ${CHROME_SCALE.borderStrong};`,
      `  border-radius: ${CHROME_SCALE.radius}; display: flex;`,
      "  flex-direction: column; align-items: center; gap: 6px; }",
      ".rb-hole-was { font-size: 15px; font-weight: 600; color: #475569; }",
      // `#5B6B82` and not the mockups' `#94A3B8`: on this panel's `#f5f7fa` the latter measures
      // **2.39:1** against 4.5 for text, and the former 5.06 — the substitution sprint 1 day 2
      // already made in the components and this stylesheet never heard about.
      ".rb-hole-fate { font-size: 13px; color: #5B6B82; text-align: center; }",
      /**
       * The gap between sections: mockup 08 draws a dashed rule broken by a pill, and the rule is
       * the part that changes. `2px dashed #B9CDEA` measured **1.62:1** against the white this gap
       * paints behind it — a decoration so faint it had to be guessed at, drawn in the one pattern
       * that dates an interface fastest. A 1px solid hairline at `--ui-border-strong` is quieter to
       * look at and **3.24:1** to measure.
       */
      ".rb-gap { position: relative; box-sizing: border-box; height: 76px; padding: 0 40px;",
      `  display: flex; align-items: center; gap: 0; background: ${CHROME_SCALE.surface}; }`,
      `.rb-rule { flex-grow: 1; height: 0; border-top: 1px solid ${CHROME_SCALE.borderStrong}; }`,
      // The interface's own typeface, never the site's. Everything else injected here is an
      // icon, so this is the first piece of chrome with words in it, and `font: inherit` would
      // have drawn them in whatever face the client picked for their own headings — ADR 0015's
      // separation, showing up as a menu set in a display serif.
      `.rb-pill, .rb-menu, .rb-menu button { font-family: ${UI_FONT}; }`,
      /**
       * **«Añadir sección aquí», and the resting state is the decision here.**
       *
       * Its border was `#A9C9F4`: **1.70:1** on the white behind it, below the **3:1** WCAG 1.4.11
       * asks of anything whose look is what identifies a control. It has been a button you could
       * miss since it was drawn.
       *
       * The plan for this day proposed making it fainter still at rest and blooming it on hover.
       * Direction refused that and the refusal is the rule now: **a control that only appears under
       * a pointer does not exist for anyone without one.** So the rest state is the brand blue at
       * **4.71:1**, and the emphasis on top of it is exactly that — on top of a state that already
       * passes.
       *
       * **The emphasis sits inside `@media (hover: hover)`**, so a touch screen — which reports a
       * permanent false hover on some engines, and on others never hovers at all — is simply given
       * the visible version always. And `:focus-visible` gets the same emphasis outside that query,
       * because a keyboard reaches this pill too and has no pointer to lead with.
       */
      ".rb-pill { display: inline-flex; align-items: center; gap: 8px; height: 40px;",
      `  padding: 0 20px; font-size: 14px; font-weight: 600; color: ${CHROME_SCALE.brand};`,
      `  background: ${CHROME_SCALE.surface}; border: 1px solid ${PILL_REST_BORDER};`,
      "  border-radius: 999px; cursor: pointer;",
      `  transition: background-color ${CHROME_SCALE.fast} ${CHROME_SCALE.ease},`,
      `    box-shadow ${CHROME_SCALE.fast} ${CHROME_SCALE.ease},`,
      `    transform ${CHROME_SCALE.fast} ${CHROME_SCALE.ease}; }`,
      `@media (hover: hover) { .rb-pill:hover { background: ${CHROME_SCALE.brandSurface};`,
      `  box-shadow: ${CHROME_SCALE.shadow2}; transform: translateY(-1px); } }`,
      `.rb-pill:focus-visible { background: ${CHROME_SCALE.brandSurface};`,
      `  box-shadow: ${CHROME_SCALE.shadow2}; outline: 2px solid ${CHROME_SCALE.brand};`,
      "  outline-offset: 2px; }",
      // Everything inside the canvas that moves, flattened for somebody who asked for less of it —
      // the destination is never removed, only the travel, which is the same contract `globals.css`
      // keeps on the other side of the boundary.
      "@media (prefers-reduced-motion: reduce) {",
      "  .rb-pill { transition-duration: 0.01ms; }",
      "  .rb-action, .rb-grip { transition-duration: 0.01ms; }",
      // The delay goes with the duration: it is what holds the word in the page while it fades,
      // and there is no fade left to wait for.
      "  .rb-tip { transition-duration: 0.01ms; transition-delay: 0s; }",
      "  .rb-handmade-in { animation-duration: 0.01ms; } }",
      ".rb-menu { position: absolute; top: 60px; left: 50%; transform: translateX(-50%);",
      "  z-index: 20; width: 340px; max-width: calc(100% - 80px); box-sizing: border-box;",
      `  padding: 14px; background: ${CHROME_SCALE.surface}; border: 1px solid ${CHROME_SCALE.border};`,
      `  border-radius: ${CHROME_SCALE.radiusLg};`,
      `  box-shadow: ${CHROME_SCALE.shadow3}; display: flex; flex-direction: column;`,
      "  gap: 4px; text-align: left; }",
      ".rb-menu-header { display: flex; align-items: baseline; justify-content: space-between;",
      "  gap: 12px; margin-bottom: 6px; }",
      ".rb-menu-title { margin: 0; font-size: 13px; font-weight: 700; color: #0F172A; }",
      // A quiet word rather than a cross: it sits beside a title, not over a photograph, and the
      // menu is small enough that an icon would need a label anyway.
      `.rb-menu-close { font-family: ${UI_FONT}; flex-shrink: 0; padding: 2px 6px; font-size: 12px;`,
      `  font-weight: 600; color: ${CHROME_SCALE.muted}; background: none; border: 0;`,
      `  border-radius: ${CHROME_SCALE.radiusSm};`,
      "  cursor: pointer; }",
      ".rb-menu-close:hover { background: #F2F7FE; color: #156FE7; }",
      // The catalog's search, finally on a screen. Quiet until it is used: a plain field with no
      // icon and no button, because there is nothing to submit — it filters as you type.
      `.rb-menu-search { font-family: ${UI_FONT}; box-sizing: border-box; width: 100%;`,
      "  margin: 0 0 6px 0; height: 34px; padding: 0 10px; font-size: 13px; color: #0F172A;",
      `  background: ${CHROME_SCALE.bg}; border: 1px solid ${CHROME_SCALE.border};`,
      `  border-radius: ${CHROME_SCALE.radius}; outline: none; }`,
      ".rb-menu-search:focus { border-color: #156FE7; background: #FFFFFF; }",
      ".rb-menu-list { display: flex; flex-direction: column; gap: 4px; }",
      ".rb-menu-empty { margin: 4px 0; font-size: 12px; line-height: 1.4; color: #5B6B82; }",
      ".rb-menu-choice { display: flex; flex-direction: column; gap: 2px; padding: 9px 10px;",
      `  text-align: left; background: none; border: 0; border-radius: ${CHROME_SCALE.radius};`,
      "  cursor: pointer; }",
      ".rb-menu-choice:hover { background: #F2F7FE; }",
      ".rb-menu-name { font-size: 14px; font-weight: 600; color: #0F172A; }",
      ".rb-menu-description { font-size: 12px; line-height: 1.35; color: #5B6B82; }",
      ".rb-menu-note { margin: 8px 0 0 0; padding-top: 10px; border-top: 1px solid #EDF1F6;",
      "  font-size: 12px; line-height: 1.4; color: #5B6B82; }",
      // The composition menu: the insertion menu's card, anchored under the action cluster
      // instead of centred in a gap, because this one belongs to a section rather than to a
      // space between two. Narrower, since every choice is a short name with no description.
      `.rb-compositions { font-family: ${UI_FONT}; position: absolute;`,
      `  top: ${VERB_SCALE.inset + VERB_SCALE.size + VERB_SCALE.gap}px; right: ${VERB_SCALE.inset}px;`,
      "  z-index: 20; width: 240px; max-width: calc(100% - 16px); box-sizing: border-box;",
      "  padding: 12px; text-align: left; background: #FFFFFF; border: 1px solid #E5E9F0;",
      "  border-radius: 13px; box-shadow: 0 14px 38px rgba(15,23,42,0.18); display: flex;",
      "  flex-direction: column; gap: 2px; }",
      ".rb-composition-choice { font-family: inherit; }",
      // The offer: the composition card, wider because it has a sentence to say and two decisions
      // to offer rather than a list of short names.
      ".rb-escalate { width: 320px; gap: 10px; }",
      ".rb-escalate .rb-menu-description { line-height: 1.5; }",
      ".rb-escalate-row { display: flex; gap: 8px; }",
      `.rb-escalate-yes, .rb-escalate-no { font-family: ${UI_FONT}; flex-grow: 1; height: 36px;`,
      `  font-size: 13px; border-radius: ${CHROME_SCALE.radius}; cursor: pointer; }`,
      ".rb-escalate-yes { font-weight: 600; color: #FFFFFF; background: #156FE7; border: 0; }",
      ".rb-escalate-yes:hover { background: #0E5BC4; }",
      ".rb-escalate-no { font-weight: 500; color: #334155; background: #FFFFFF;",
      "  border: 1px solid #E3E8F0; }",
      ".rb-escalate-no:hover { background: #F2F7FE; border-color: #156FE7; }",
      // The bar a hand-designed section wears — chrome floating over the section, like the action
      // cluster above and `.rb-sample` below, and **not** a child in the section's flow.
      //
      // It was in flow first, with `grid-column: 1 / -1` and `order: -2`, and walking it in a
      // browser showed two things wrong with that. A section is a twelve-column grid whose elements
      // are *explicitly* placed by row, so a child with no row of its own is auto-placed into the
      // first free one — which is after all of them. The bar came out near the bottom, overlapping
      // the content, 210px below the top of a section it was supposed to label; `order` does nothing
      // to an explicitly placed grid, so that had no effect either. And it made the section 44px
      // taller, which pushed every section after it down the page — a hand-designed section is
      // supposed to change nothing about how the site looks, and that changed the whole page.
      //
      // Absolute, over the top of the section, changes no layout at all. `[data-section]` is already
      // `position: relative` for the corner handles.
      // `z-index: 5` puts it under `.rb-sample`'s 6 on purpose. The two can only meet on a section
      // whose photograph is flush with its top edge, and there the badge belongs on top: «Foto de
      // ejemplo» is a statement about the picture, and chrome hiding it would be how an owner ships
      // a stock photograph without noticing.
      // In the flow of the page, as a header attached to the section below it. It was absolutely
      // positioned over the section, which is where both of the defects reported on 7 October 2026
      // came from: it covered editable content, and having no room of its own there was nothing for
      // its controls to wrap into.
      //
      // `flex-wrap` and the two `nowrap`s are one decision, taken by direction: at 320px the three
      // controls ask for 282px in 272, and **nothing is cut** — the badge and «Volver a la original»
      // are atomic, so the button moves whole onto a second line rather than being clipped or
      // shortened. The name is the only part that may wrap, and `min-width: 0` plus
      // `overflow-wrap` is what stops a long one overflowing instead.
      `.rb-handmade { font-family: ${UI_FONT}; box-sizing: border-box; display: flex;`,
      "  flex-wrap: wrap; align-items: center; gap: 8px; padding: 9px 13px;",
      "  background: #F8FAFD; border-bottom: 1px solid #E3E8F0; }",
      // **It arrives rather than appearing, and that is what makes the 44px honest.** Accepting
      // «Diseñar a mano» now adds the bar's height to the flow, so the section below it moves down.
      // Anywhere but the very top of the page the reading anchor absorbs that and nothing is seen to
      // move (measured: a section at `top: 0` stays at `top: 0`, the scroll number taking the 44px).
      // At the top there is nothing to give, so the room has to open visibly — and direction's
      // instruction was that it read as an arrival and not as a jump.
      //
      // The same two keyframes the rail's own items use, down to the curve: the negative margin is
      // what makes everything below travel instead of teleporting, and `--rb-enter-offset` carries
      // the height because only the caller can measure it. `--ui-ease-shape` is carried into
      // `CHROME_SCALE` for this, which is the first thing inside the preview ever to animate.
      "@keyframes rb-handmade-in { from { opacity: 0; transform: translateY(-6px);",
      "  margin-top: calc(-1 * var(--rb-enter-offset, 0px)); } }",
      `.rb-handmade-in { animation: rb-handmade-in ${CHROME_SCALE.base} ${CHROME_SCALE.easeShape} both; }`,
      ".rb-handmade-badge { display: inline-flex; flex-shrink: 0; white-space: nowrap;",
      "  align-items: center; gap: 5px; padding: 4px 9px;",
      "  font-size: 11px; font-weight: 600; color: #8A5A08; background: #FFF4E5;",
      `  border: 1px solid #F4DDB4; border-radius: ${CHROME_SCALE.radiusSm}; }`,
      ".rb-handmade-name { flex-grow: 1; min-width: 0; overflow-wrap: anywhere;",
      "  font-size: 12px; color: #5B6B82; }",
      `.rb-handmade-back { font-family: ${UI_FONT}; flex-shrink: 0; white-space: nowrap;`,
      "  padding: 5px 10px;",
      "  font-size: 11px; font-weight: 600; color: #156FE7; background: #FFFFFF;",
      `  border: 1px solid ${CHROME_SCALE.brand}; border-radius: ${CHROME_SCALE.radiusSm};`,
      "  cursor: pointer; }",
      ".rb-handmade-back:hover { background: #F2F7FE; border-color: #156FE7; }",
      // The twelve columns of rule 4, behind the section being laid out — mockup 16's own stripes.
      //
      // Only on the one section the panel is about: stripes are an answer to «where will this land»,
      // not decoration, and every free section wearing them at once would make the page unreadable
      // at the moment somebody needs to read it.
      //
      // A pseudo-element rather than an injected node, because the toggle then costs one class and
      // needs no re-wiring — see `syncGrid`. `position: absolute` keeps it out of the grid, which is
      // the lesson the bar above had to learn the hard way. One twelfth is 8.3333%.
      //
      // **And only when the panel is open, since sprint 25 día 3.** The stripes used to come up
      // during a drag as well, to answer «which column will this land in». With ninety-six units
      // the answer is «where your hand is» — the element itself travels there now — and stripes
      // every 8.3333% would be marking twelve of the section's twelve *bands* while the hand works
      // in ninths of one. The bands are still real (they are where the gutters are), which is why
      // the panel's own class keeps them.
      '.rb-designing::before { content: ""; position: absolute; inset: 0;',
      "  z-index: 0; pointer-events: none; background: repeating-linear-gradient(90deg,",
      "    rgba(21,111,231,0.16) 0 1px, transparent 1px 8.3333%); }",
      /*
       * **The ghost: where the element would land, drawn before anybody lets go.**
       *
       * Brand blue and dashed for a destination that is free; `--ui-danger` and a word for one that
       * is refused, because «nothing happened» is the one answer a drag must never give silently.
       * `pointer-events: none` — a preview that can swallow the pointer would end the drag it is
       * previewing — and `z-index: 9`, under the verbs' cluster (10) and the text bar (30) and over
       * the stripes (0).
       */
      ".rb-ghost { position: absolute; z-index: 9; pointer-events: none; display: flex;",
      "  align-items: center; justify-content: center; text-align: center;",
      `  border: 2px dashed ${CHROME_SCALE.brand}; border-radius: 6px;`,
      "  background: rgba(21,111,231,0.10); color: #FFFFFF;",
      `  font: 600 12px/1.3 ${UI_FONT}; }`,
      `.rb-ghost-no { border-color: ${CHROME_SCALE.danger}; border-style: solid;`,
      "  background: rgba(220,38,38,0.12); color: #7F1D1D; }",
      // The element being moved, while it is being moved: dimmed, so the ghost is what the eye
      // follows. It keeps its place in the grid — see `wireDragging` on why it does not follow the
      // pointer — so this is the only sign that it is the subject.
      // The element being carried: **a layer of its own and a shadow**, where it used to be dimmed
      // behind a ghost. `transform` makes it a stacking context, so without the `z-index` it would
      // travel under every sibling that comes after it in the document (David's adjustment 5); the
      // shadow is what says «picked up» now that nothing else on screen does.
      `.rb-moving { z-index: 5; box-shadow: ${CHROME_SCALE.shadow2}; }`,
      /*
       * **`touch-action: none` on the chosen element and on nothing else** (ADR 0049).
       *
       * A finger's gesture is decided at `touchstart`, so this has to be declared before the touch
       * begins rather than when a long press fires — which is why the drag on touch asks for an
       * element that is **already chosen** instead of a long press. One element is the whole of the
       * cost: everywhere else one finger scrolls the canvas exactly as it did, which the mobile
       * walk measures rather than assumes.
       */
      ".rb-chosen { touch-action: none; }",
      // The element the panel is stepping, outlined the way mockup 16 draws it, so the numbers in
      // the panel and the thing on the page are visibly the same subject.
      ".rb-designing .rb-placing { outline: 2px solid #156FE7; outline-offset: 2px;",
      "  border-radius: 4px; }",
      // The one in use is marked, not hidden: a toggle group where something is always chosen.
      '.rb-composition-choice[aria-pressed="true"] { background: #EAF2FE; }',
      '.rb-composition-choice[aria-pressed="true"] .rb-menu-name { color: #156FE7; }',
      // A photo reads as replaceable the same way an editable text does: the dashed outline on
      // hover, and nothing until then.
      ".rb-photo { cursor: pointer; outline: 2px dashed transparent; outline-offset: 3px; }",
      // The two classes that replace inline styles the chrome used to write on renderer nodes
      // (ADR 0051 §2, adjustment 3): the badge's positioned host, and the border zone's cursor.
      ".rb-photo-host { position: relative; }",
      ".rb-cursor-ew { cursor: ew-resize; } .rb-cursor-ns { cursor: ns-resize; }",
      ".rb-cursor-nwse { cursor: nwse-resize; } .rb-cursor-nesw { cursor: nesw-resize; }",
      ".rb-photo:hover { outline-color: #156FE7; }",
      // «Foto de ejemplo», over a photograph the bank supplied. Dark and slightly translucent
      // rather than the blue of the editor's own controls: it is a statement about the picture,
      // not a control belonging to the chrome — though pressing it does open "Cambiar foto", since
      // the label is exactly where someone who disagrees with it is already looking.
      `.rb-sample { font-family: ${UI_FONT}; position: absolute; top: 10px; left: 10px; z-index: 6;`,
      "  align-self: start; justify-self: start; margin: 0; padding: 5px 11px; font-size: 12px;",
      "  font-weight: 600; line-height: 1.2; color: #FFFFFF; background: rgba(15,23,42,0.78);",
      "  border: 0; border-radius: 999px; cursor: pointer; backdrop-filter: blur(3px); }",
      ".rb-sample:hover { background: rgba(15,23,42,0.92); }",
      // The line controls. The pill echoes the section one, smaller and left-aligned under the
      // list it belongs to rather than centred in a gap, because it adds to a thing rather than
      // between two things.
      /**
       * **`white-space: nowrap`, and the label has needed it since the day it was written.**
       *
       * The pill is 30px tall by declaration and its text was free to wrap, so «+ Añadir línea»
       * broke onto two lines inside a one-line box: measured in Chromium as a **48px text in a
       * 30px pill, 9px of it painted outside**. It is `inline-flex`, so refusing the wrap costs
       * nothing — the pill simply takes the width its own words need.
       *
       * It dates from 28 September and no restyle caused it. What the restyle did was put it next
       * to «Añadir sección aquí», which is the same kind of control and now looks deliberate, and
       * that is what made this one look broken by comparison.
       *
       * Its border came from the same tint as that pill's — `#A9C9F4`, **1.70:1** on the white
       * behind it, under WCAG 1.4.11's 3:1 — so it gets the same resting colour for the same
       * reason, and the same emphasis behind `@media (hover: hover)` plus `:focus-visible`.
       */
      // `grid-column: 1 / -1; justify-self: start`: the button is a direct child of the section's
      // grid, and in a hand-designed section a track is one unit of eight pixels (ADR 0050), so an
      // auto-placed pill of 102px spilled 72px past its cell — the canvas overflow walk caught it
      // the day the fine grid landed. Spanning the row and sitting at its start keeps it the same
      // pill in the same place on the catalog's grid, where a column was wide enough to hide this.
      `.rb-line-add { font-family: ${UI_FONT}; margin-top: 10px; display: inline-flex;`,
      "  grid-column: 1 / -1; justify-self: start;",
      "  align-items: center; height: 30px; padding: 0 14px; font-size: 13px; font-weight: 600;",
      "  white-space: nowrap;",
      `  color: ${CHROME_SCALE.brand}; background: ${CHROME_SCALE.surface};`,
      `  border: 1px solid ${PILL_REST_BORDER}; border-radius: 999px; cursor: pointer;`,
      `  transition: background-color ${CHROME_SCALE.fast} ${CHROME_SCALE.ease},`,
      `    box-shadow ${CHROME_SCALE.fast} ${CHROME_SCALE.ease}; }`,
      `@media (hover: hover) { .rb-line-add:hover { background: ${CHROME_SCALE.brandSurface};`,
      `  box-shadow: ${CHROME_SCALE.shadow2}; } }`,
      `.rb-line-add:focus-visible { background: ${CHROME_SCALE.brandSurface};`,
      `  outline: 2px solid ${CHROME_SCALE.brand}; outline-offset: 2px; }`,
      // The same slot the add button occupies, in the muted voice a limit deserves: it is not an
      // action and must not look like one.
      //
      // `grid-column: 1 / -1` because a section is a 12-column grid and this `<p>` is a direct
      // child of it, so without the span it is auto-placed into a single narrow track and the
      // sentence comes out one word per line. The add button gets away with it by being an
      // `inline-flex` pill narrow enough not to notice; a paragraph does not.
      `.rb-line-full { font-family: ${UI_FONT}; grid-column: 1 / -1; margin: 10px 0 0 0;`,
      "  font-size: 13px; line-height: 1.4; color: #5B6B82; }",
      // On the line itself, and only visible while the pointer is over it: a cross on every row
      // at all times would draw the eye away from the words, which are the thing being written.
      ".rb-line { position: relative; }",
      ".rb-line-remove { position: absolute; top: 2px; right: 0; width: 20px; height: 20px;",
      "  display: flex; align-items: center; justify-content: center; background: #DC2626;",
      "  border: 2px solid #FFFFFF; border-radius: 999px; cursor: pointer; opacity: 0;",
      "  box-shadow: 0 2px 6px rgba(15,23,42,0.28); }",
      ".rb-line:hover .rb-line-remove, .rb-line-remove:focus { opacity: 1; }",
      // The two arrows, in the same corner and on the same hover as the cross, to the left of it:
      // one cluster on a line rather than controls scattered around it. White on a light grey so
      // they read as chrome and not as part of the photograph underneath.
      ".rb-line-move { position: absolute; top: 2px; width: 20px; height: 20px; display: flex;",
      "  align-items: center; justify-content: center; background: #FFFFFF;",
      "  border: 1px solid #D5DEE9; border-radius: 999px; cursor: pointer; opacity: 0;",
      "  box-shadow: 0 2px 6px rgba(15,23,42,0.18); }",
      // 20px wide each, 5px apart: the cross at 0, the second arrow at 25, the first at 50.
      // Measured rather than eyeballed — the first spacing put them 3px and 5px apart, which looks
      // like a mistake at this size even though nothing overlapped.
      ".rb-line-up { right: 50px; }",
      ".rb-line-down { right: 25px; }",
      ".rb-line:hover .rb-line-move, .rb-line-move:focus { opacity: 1; }",
      ".rb-line-move:hover { border-color: #156FE7; background: #F2F7FE; }",

      // The floating toolbar (mockup 17, band 1). Absolute inside the section, which is already
      // `position: relative` — never inside the element, whose `textContent` is what `wireEditing`
      // saves on blur.
      `.rb-toolbar { font-family: ${UI_FONT}; position: absolute; z-index: 30;`,
      // **`wrap` is what keeps every control reachable, and it was found by walking a narrow
      // window.** With the design tools on the bar reaches 904px, and `MIN_STUDIO_WIDTH` lets the
      // switch be turned on at 1024 — so at an editor 1100px wide the section is 828px and the bar
      // ran 124px past its right edge, behind this frame's own `overflow-x: clip`. The last group,
      // «Esquinas», was on the screen and could not be pressed: the dead button in its worst form.
      //
      // The bar is absolutely positioned inside the section, so its shrink-to-fit width is already
      // capped by the section's box — it simply could not *use* that cap while the flex row refused
      // to break. A `max-width` was tried alongside this and proved redundant: removing it changes
      // nothing, removing `wrap` puts the e2e back in red. It is not kept as insurance.
      "  display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 5px;",
      "  background: #FFFFFF; border: 1px solid #E3E8F0; border-radius: 11px;",
      "  box-shadow: 0 6px 18px rgba(15,23,42,0.14);",
      // **`pointer-events: none` on the bar itself, re-enabled per control — found by the day-7
      // walk, not designed in from the start.** Wrapping (above) keeps every control reachable
      // within the bar; it does nothing about what sits *beneath* the bar. A short section — the
      // cover's own headline immediately followed by its subheadline — puts the next element close
      // enough that a tall, wrapped bar (colour, size, and with the tools on, a letter and two
      // measures each with its own exact-value field) can cover it entirely. Every click inside a plain `<div>`'s
      // box is swallowed by that div first, including its padding and the gaps between controls —
      // `bar.addEventListener("click", stopPropagation)` was catching them all, on purpose, and
      // that included clicks the person meant for the paragraph hidden underneath. Reproduced at
      // an editor 1100px wide — inside `MIN_STUDIO_WIDTH`'s own floor, not a contrived width —
      // where painting the headline grew its bar to 66px tall and put its bottom edge past the
      // body text's own top.
      //
      // `none` here and `auto` on every interactive child turns the bar's blank space — its
      // padding, its dividers, the gaps a caption leaves — into glass: a click there reaches
      // whatever is genuinely behind it, which opens that element's own toolbar in turn, rather
      // than landing on nothing. `pointer-events: none` is a hit-testing rule only; it does not
      // stop `mousedown`'s `preventDefault` or a button's own `click` listener from firing, because
      // both are attached to descendants the click still originates on and then bubbles up through.",
      "  pointer-events: none; }",
      // **`[hidden]` needs saying here, and that is not boilerplate.** The browser's own stylesheet
      // gives `[hidden]` a `display: none`, and an author rule with an explicit `display` beats it —
      // so the marks group set `hidden` and went on being drawn. Found by the test written for
      // mockup 18, after a probe that read the `.hidden` property and believed it.
      // The notice is not a control and does not look like one: full width of the bar, its own line
      // above the groups, and no border — so nothing about it invites a press.
      `.rb-toolbar-notice { font-family: ${UI_FONT}; flex-basis: 100%; padding: 2px 7px 4px;`,
      "  font-size: 11px; line-height: 1.35; color: #92400E; }",
      ".rb-toolbar-group[hidden] { display: none; }",
      ".rb-toolbar-group { display: flex; align-items: center; gap: 4px; padding: 0 7px;",
      "  border-right: 1px solid #EDF1F6; }",
      ".rb-toolbar-group:last-child { border-right: 0; }",
      // Same substitution, same reason: 11px of `#94A3B8` on this bar's white measured
      // **2.56:1**, and `#5B6B82` measures 5.43. axe caught it on 17 October 2026 only because
      // a bar that had moved happened to land over white — over a photograph it reads as
      // «not measured» and says nothing. `chromeContrast.test.ts` is where it cannot hide.
      ".rb-toolbar-caption { font-size: 11px; font-weight: 600; color: #5B6B82; }",
      // Re-enabled here rather than only on the specific classes below, because it is the one
      // property every interactive element in the bar needs and the failure mode of missing it on
      // any one of them is silent — a control sitting over a swallowed click, indistinguishable
      // from a working one until someone tries to press it.
      `.rb-toolbar button, .rb-toolbar select, .rb-toolbar input { pointer-events: auto; }`,
      `.rb-toolbar button, .rb-toolbar select { font-family: ${UI_FONT}; cursor: pointer; }`,
      // `B` and `I`: square, because they are one glyph each and a padded pill would read as a
      // word. Drawn in the weight and slant they apply, which is what makes them legible without a
      // caption — the group still has one, for a screen reader.
      /*
       * The bar's own handle: ink on white like the cluster's, at the height of the bar's controls
       * rather than the cluster's. 24 wide because WCAG 2.5.8 asks 24 of a pointer target, and the
       * thing somebody has to catch to move a bar out of their way is the last one to shave.
       */
      `.rb-toolbar-grip { width: ${VERB_SCALE.grip}px; height: 26px; display: flex;`,
      `  align-items: center; justify-content: center; padding: 0; color: ${CHROME_SCALE.ink};`,
      `  background: ${CHROME_SCALE.surface}; border: 1px solid ${CHROME_SCALE.borderStrong};`,
      "  border-radius: 999px; cursor: grab; touch-action: none; }",
      `.rb-toolbar-grip:focus-visible { outline: 2px solid ${CHROME_SCALE.ink};`,
      "  outline-offset: 1px; }",
      ".rb-toolbar-mark { width: 26px; height: 26px; padding: 0; font-size: 13px;",
      "  color: #334155; background: #FFFFFF; border: 1px solid #E3E8F0; border-radius: 7px; }",
      ".rb-toolbar-mark-strong { font-weight: 800; }",
      ".rb-toolbar-mark-em { font-style: italic; font-family: Georgia, serif; }",
      ".rb-toolbar-mark:hover:not(:disabled) { background: #F2F7FE; border-color: #156FE7; }",
      ".rb-toolbar-mark.rb-toolbar-on { color: #156FE7; background: #E8F1FE; border-color: #156FE7; }",
      // Faded rather than gone: the control applies here, there is just nothing selected yet.
      ".rb-toolbar-mark:disabled { opacity: 0.42; cursor: default; }",
      ".rb-toolbar-step { height: 26px; padding: 0 9px; font-size: 12px; font-weight: 500;",
      "  color: #334155; background: #FFFFFF; border: 1px solid #E3E8F0; border-radius: 7px; }",
      ".rb-toolbar-step:hover { background: #F2F7FE; border-color: #156FE7; }",
      ".rb-toolbar-step.rb-toolbar-on { font-weight: 700; color: #156FE7;",
      "  background: #E8F1FE; border-color: #156FE7; }",
      // A ring rather than a tick, so the chosen swatch is marked without hiding the colour it is
      // there to show.
      ".rb-toolbar-swatch { width: 20px; height: 20px; padding: 0; border-radius: 999px;",
      "  border: 1px solid rgba(15,23,42,0.18); }",
      ".rb-toolbar-swatch.rb-toolbar-on { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #156FE7; }",
      ".rb-toolbar-link { height: 26px; padding: 0 11px; font-size: 12px; font-weight: 500;",
      "  color: #334155; background: #FFFFFF; border: 1px solid #E3E8F0; border-radius: 7px; }",
      ".rb-toolbar-link:hover { background: #F2F7FE; border-color: #156FE7; }",
      `.rb-toolbar-select, .rb-toolbar-exact { font-family: ${UI_FONT}; height: 26px;`,
      "  font-size: 12px; color: #334155; background: #FFFFFF; border: 1px solid #E3E8F0;",
      "  border-radius: 7px; }",
      ".rb-toolbar-select { padding: 0 4px; }",
      ".rb-toolbar-color { width: 26px; height: 22px; padding: 0; border: 1px solid #E3E8F0;",
      "  border-radius: 6px; background: #FFFFFF; cursor: pointer; }",
      ".rb-toolbar-color.rb-toolbar-on { box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px #156FE7; }",
      ".rb-toolbar-exact { width: 52px; padding: 0 6px; }",
      ".rb-toolbar-select:focus, .rb-toolbar-exact:focus { outline: 2px solid #156FE7;",
      "  outline-offset: 1px; }",
    ].join("\n");
    iframeDoc.head.appendChild(style);

    wireLinks(iframeDoc);
    wireSelection(iframeDoc);
    attachDocument(iframeDoc);
    attachPhotos(iframeDoc);
    drawGaps(iframeDoc);
    drawLines(iframeDoc);
    drawPhotoChrome(iframeDoc);
    wireEditing(iframeDoc);
    // After `wireEditing`, which is what makes an element focusable in the first place.
    wireToolbar(iframeDoc);
    // After both: the drag asks `wireEditing`'s state whether a text is chosen, and it must not be
    // armed on an element the editing layer has not finished wiring.
    wireDragging(iframeDoc);
    // After the drag, so a press in an edge zone is the resize's: its own listener is in the
    // capture phase and stops the press there, which is what keeps the two gestures apart.
    wireResizing(iframeDoc);
    wireHandmade(iframeDoc);
    // `wireReadingPosition` was here, recording where the person was reading so the next document
    // could put them back. There is no next document (sprint 27 día 1), and a patched page keeps
    // its scroll by doing nothing.
    // Last: the pass that actually draws the delete notice. It goes after `wireInsertion`, which
    // inserts the `.rb-gap` rows the notice is positioned among.
    syncHole(iframeDoc);
  }

  /**
   * The photo srcs this document actually names. An upload that has since been undone still has
   * its bytes in memory, and the route refuses a photo the document does not reference.
   *
   * `flattenElements` since sprint 5 day 3, for the reason `collectAssets` in the renderer already
   * uses it: a gallery's photographs live inside list items, and walking `section.content` alone
   * left every one of them out of the multipart body. The page would then be published referencing
   * files the route never received — the worst shape of this bug, because it only shows up in the
   * downloaded ZIP, after the owner has gone.
   */
  function referencedPhotos(): string[] {
    const srcs = new Set<string>();
    for (const page of doc.pages) {
      for (const section of page.sections) {
        for (const element of flattenElements(section.content)) {
          if (element.value?.kind === "image" && photoUrls.has(element.value.src)) {
            srcs.add(element.value.src);
          }
        }
      }
    }
    return [...srcs];
  }

  async function download() {
    setState("downloading");
    try {
      // The screen is already up since `requestDownload`; a press that skipped the gate starts
      // the clock here, which the measurement's own start already set.
      // Multipart since ADR 0018: the document as a field, each photo as a file named by the
      // src the document carries. The object URL is the handle to the bytes already in memory,
      // so nothing is re-read from storage to build this.
      const form = new FormData();
      form.set("document", JSON.stringify(doc));
      for (const src of referencedPhotos()) {
        const url = photoUrls.get(src);
        if (!url) continue;
        const blob = await (await fetch(url)).blob();
        form.append("photo", new File([blob], src, { type: blob.type }));
      }
      const response = await fetch("/api/download", { method: "POST", body: form });
      if (!response.ok) throw new Error(`download failed: ${response.status}`);
      const blob = await response.blob();
      // The hold: the building screen stays up for David's minimum, measured from the press, and
      // the ZIP is handed over the instant it ends — the screen and the file in the same frame.
      const remaining = holdFor(buildingStartedAt.current, performance.now());
      if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFrom(response, "mi-web.zip");
      link.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  /**
   * What «Descargar» actually does — `downloadGateFor` decides, from the same counts the «Fotos»
   * panel reads, whether that is downloading immediately, stopping to ask, or refusing outright.
   *
   * Recomputed on every press rather than kept as derived state watching `doc`: the two dialogs
   * this can open are meant to reflect the document *as it stood the moment «Descargar» was
   * pressed*, and computing fresh here is what makes closing one and pressing «Descargar» again
   * — after fixing the one photograph the dialog was about — re-evaluate rather than reopen the
   * same stale verdict.
   */
  /**
   * **Asynchronous, because measuring is**, and the asynchrony stops here rather than spreading
   * into the gate. `measureOverflow` loads the page into a hidden 320px frame and waits for it to
   * lay out; `downloadGateFor` stays pure and takes the result as data, which is what keeps every
   * one of its cases testable without a browser.
   *
   * The measurement runs on every press and is never cached. It is cheap next to reading every
   * photograph off disk, which is what happens immediately afterwards, and a cached one would be
   * wrong exactly when it matters — after the owner has fixed the thing the dialog named.
   */
  async function requestDownload(accepted: ReadonlySet<AcceptedWarning> = new Set()) {
    // The building screen from the press, so the measurement — the longest phase, and until
    // 13 October 2026 the one with no signal at all — is covered too.
    buildingStartedAt.current = performance.now();
    setState("preparing");
    const overflow = await measureOverflow(doc, { hostDocument: window.document });
    const gate = downloadGateFor(countPhotos(doc), doc, accepted, overflow, failedSamples);
    if (gate.kind === "ready") {
      void download();
      return;
    }
    // Back to idle **before** the dialog opens: the screen and the dialogs share `z-20`, and a
    // veil over the dialog would hide «Descargar igualmente» behind it.
    setState("idle");
    setAcceptedWarnings(accepted);
    setDownloadDialog(gate);
  }

  /** Going past one warning asks the gate again rather than downloading, so a site with two things
   * worth saying says both. See `downloadGateFor`'s `accepted`. */
  function acceptAndContinue(warning: AcceptedWarning) {
    setDownloadDialog(null);
    void requestDownload(new Set([...acceptedWarnings, warning]));
  }

  /**
   * The contrast dialog's «Volver al color del tema» — day 6's one-click fix, corrected on day 7's
   * buffer after the walk found what it missed.
   *
   * **Found by painting two elements unreadable at once.** The dialog listed both, fixing the
   * first closed the dialog entirely, and the second — still unreadable — went unmentioned. The
   * document was genuinely still wrong and the interface looked like it had finished: the closed
   * dialog is exactly the silence a fixed page gets, so nothing told the owner the site was not
   * ready. Pressing «Descargar» again did re-surface it (the gate is always recomputed fresh), but
   * nothing said that press was necessary.
   *
   * **Computes the fixed document itself, rather than trusting `doc`.** `doc` is this render's
   * value and the write this makes has not reached React's state yet, so reading `doc` right after
   * dispatching would see the *previous* document — the same exception, still there. `setElementStyle`
   * is called twice on purpose: once here, synchronously, purely to decide what to show next;
   * once through `onSetElementStyle`, which is the one that actually reaches history, undo and
   * autosave. Two calls to a pure function that can only ever agree, not two sources of truth.
   *
   * **Never downloads on its own**, even when fixing the last finding leaves the document clean.
   * `download()` reads `doc` from this same closure and would ship that same stale copy — the
   * exception this fix just removed, still in the file. A press that closes the dialog because
   * there is nothing left to say is not the same act as a press that means "go ahead and publish
   * this", so the dialog simply closes and «Descargar» is there to press again, reading the
   * document fresh.
   */
  function fixException(exception: StyleException) {
    const fixed = setElementStyle(
      doc,
      { sectionId: exception.sectionId, elementId: exception.elementId },
      exception.property,
      undefined,
    );
    onSetElementStyle(
      { sectionId: exception.sectionId, elementId: exception.elementId },
      exception.property,
      undefined,
    );

    // Deliberately without `failedSamples`: this re-check exists only to ask whether the colour
    // the owner just fixed is still a problem, and it filters to the two contrast kinds on the
    // next line. A photograph that failed to load is not something this fix could have changed.
    const gate = downloadGateFor(countPhotos(fixed), fixed, acceptedWarnings);
    setDownloadDialog(gate.kind === "unreadable" || gate.kind === "lowContrast" ? gate : null);
  }

  return (
    <EditorShell
      // The business name, not the variant's. The bar said «Clásica» — the caption of whichever of
      // the three cards was opened — where mockup 08 shows «Barbería El Corte», and it had said so
      // since the editor existed. Found by walking the editor on sprint 4 day 2 and recorded in
      // `docs/design/REVIEW.md` as direction's to settle, which it did. `title` still names the
      // preview frame, where "which of the three am I in" is exactly the useful thing to say.
      siteName={doc.siteName}
      pages={doc.pages.map((page) => ({ id: page.id, title: page.title }))}
      currentPageId={pageId ?? doc.pages[0]?.id}
      onSelectPage={(id) => onSelectPage(doc.pages[0]?.id === id ? undefined : id)}
      onBack={onBack}
      downloadState={state}
      overlay={
        state === "preparing" || state === "downloading" ? (
          <BuildingScreen returnFocusTo="download" />
        ) : null
      }
      // Wrapped, not passed by reference: React hands a click handler the event, and
      // `requestDownload`'s optional parameter would have received it as the set of accepted
      // warnings. `() => void` accepts `(accepted?: …) => void`, so the compiler could not see it,
      // and the failure was precise enough to look like something else — `accepted.has` threw only
      // on the warning path, because the blocking check runs before it, so the block dialog worked
      // perfectly and the warning silently did nothing.
      onDownload={() => void requestDownload()}
      device={device}
      onDeviceChange={setDevice}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={undoFromHistory}
      onRedo={redoFromHistory}
      saveStatus={saveStatus}
      savedWhere={savedWhere}
      photosMissing={photosMissing}
      onSaveToAccount={onSaveToAccount}
      rail={effectiveRail}
      onRailChange={showRail}
      designTools={designTools}
      switchNotice={switchNotice}
      askingDesignTools={askingDesignTools}
      onAskDesignTools={() => setAskingDesignTools(true)}
      onDismissDesignTools={() => setAskingDesignTools(false)}
      onDesignToolsChange={(on) => {
        setAskingDesignTools(false);
        onDesignToolsChange(on);
      }}
      panel={
        /**
         * **The fields drawer is the first branch, and it is in this slot at all since sprint 24
         * día 3.** It used to be rendered among `children` — inside the canvas card — and `fixed`
         * to the viewport's right edge, which painted 340 pixels of itself over the section being
         * edited. David's words: «no ocultar elementos que van a ser editados». In the row it
         * narrows the preview instead, through the `ResizeObserver` the shell already has.
         *
         * First because the slot holds one node and the two can only be open together by a bug:
         * `showFields` sends the rail back to «Secciones» and `showRail` closes the drawer, so the
         * rule «as most one side surface at a time» is enforced at both doors. Being first keeps
         * the drawer winning if a third door ever appears, which is what the fixed version did by
         * covering the other.
         */
        fieldsFor && findSection(doc, fieldsFor) ? (
          <FieldsPanel
            sectionId={fieldsFor}
            sectionName={sectionDisplayName(doc, fieldsFor)}
            rows={sectionFields(doc, fieldsFor)}
            slotOrder={slotOrderOf(doc, fieldsFor)}
            itemSlotOrder={itemSlotOrderOf(doc, fieldsFor)}
            onFill={onFillSlot}
            onClear={onClearSlot}
            menuLabel={menuLabelFor(doc, fieldsFor)}
            inMenu={findSection(doc, fieldsFor)?.section.inMenu}
            onSetInMenu={onSetSectionInMenu}
            menu={menuStateFor(doc, pageId)}
            // The panel commits a words-only change through the very same callback the canvas
            // does, and since sprint 12 day 3 it anchors that change in the range the browser is
            // replacing too — so the marks arrive measured rather than guessed, exactly as they do
            // from the canvas. Absent still means the diff, the documented floor (ADR 0027 §4b).
            onEditText={onEditText}
            onClose={() => showFields(null)}
          />
        ) : effectiveRail === "share" ? (
          <SharePanel
            doc={doc}
            photoUrls={photoUrls}
            onSetDescription={onSetSiteDescription}
            onSetUrl={onSetSiteUrl}
            onClose={() => showRail("sections")}
          />
        ) : effectiveRail === "photos" ? (
          <PhotosPanel
            document={doc}
            photoUrls={photoUrls}
            photosMissing={photosMissing}
            onReplacePhoto={replacePhoto}
            onGoToPhoto={(photo) => {
              // The panel is also a way of finding a photograph: show the page it is on and select
              // its section, which scrolls the canvas to it.
              onSelectPage(doc.pages[0]?.id === photo.pageId ? undefined : photo.pageId);
              selectedSection.current = photo.sectionId;
            }}
            onClose={() => showRail("sections")}
          />
        ) : effectiveRail === "pages" ? (
          <PagesPanel
            document={doc}
            currentPageId={pageId}
            onSelectPage={(id) => onSelectPage(doc.pages[0]?.id === id ? undefined : id)}
            onRenamePage={onRenamePage}
            onMovePage={onMovePage}
            onDeletePage={onDeletePage}
            onPageToSection={onPageToSection}
            onSetPageInMenu={onSetPageInMenu}
            menu={menuStateFor(doc, pageId)}
            canFold={(id) => canFoldPage(doc, id)}
            linksTo={(id) => listLinksTo(doc, id).length}
            entryShown={entryShown}
            onPreviewEntry={(id, entryId) =>
              setEntryByPage((previous) => ({ ...previous, [id]: entryId }))
            }
            onClose={() => showRail("sections")}
          />
        ) : effectiveRail === "style" ? (
          <StylePanel
            theme={doc.theme}
            onPickPalette={onPickPalette}
            onPickTypePair={onPickTypePair}
            onPickFamily={onPickFamily}
            onPickScale={onPickScale}
            // `=== true` rather than truthiness, and the panel's prop is a plain boolean: the
            // three states of `designTools` matter to the rail, which has to keep the «Diseño»
            // item out of a window too narrow to offer it. They do not matter here — a group the
            // panel is not showing is not showing for either reason — so the third state is
            // collapsed at this one boundary and nowhere else.
            designTools={designTools === true}
            onClose={() => showRail("sections")}
          />
        ) : effectiveRail === "collections" ? (
          <CollectionsPanel
            document={doc}
            sectionName={(sectionId) => sectionDisplayName(doc, sectionId)}
            // The schema's own reader, handed the catalog: the panel's message and the verb's
            // refusal are then two renderings of one fact rather than two rules that agree today.
            blockFor={(collectionId, would) =>
              entryCountBlock(doc, collectionId, would, (catalogId) => presetFor(catalogId))
            }
            // Every section with cards and no list yet, named by the catalog. Read from the document
            // rather than tracked, so no new verb has to remember to keep a list of candidates.
            candidates={doc.pages.flatMap((page) =>
              page.sections.flatMap((section) => {
                const slot = looseListOf(doc, section.id);
                return slot === undefined
                  ? []
                  : [
                      {
                        sectionId: section.id,
                        slot,
                        suggestedName: sectionDisplayName(doc, section.id),
                      },
                    ];
              }),
            )}
            onMakeList={onCollectionFromList}
            onBindList={onBindList}
            // **Asked by trying it**, which is the only way to keep this answer and `bindList`'s own
            // refusals from drifting: the verb is pure, so calling it is cheaper than restating its
            // three conditions here and keeping the restatement in step.
            canBind={(sectionId, slot, collectionId) => {
              try {
                bindList(doc, sectionId, slot, collectionId, (catalogId) => presetFor(catalogId));
                return true;
              } catch {
                return false;
              }
            }}
            onAddEntry={onAddEntry}
            // A page per entry (ADR 0040 §6). The title is interface text — what the tabs and
            // «Páginas» call the template — composed here from the locale file, never published.
            onAddEntryPage={(collectionId, titleField) =>
              onAddEntryPage(
                collectionId,
                titleField,
                es["editor.collections.entryPage.pageTitle"].replace(
                  "{list}",
                  doc.collections.find((collection) => collection.id === collectionId)?.name ?? "",
                ),
              )
            }
            onRemoveEntryPage={onDeletePage}
            onShowPage={(id) => onSelectPage(doc.pages[0]?.id === id ? undefined : id)}
            pagesFull={doc.pages.length >= MAX_PAGES}
            // Which of a card's fields are headings, by the catalog: the one that names each page.
            headingFieldsFor={(catalogId) =>
              (presetFor(catalogId).itemSlots ?? [])
                .filter((slot) => slot.role === "heading")
                .map((slot) => slot.slot)
            }
            onRenameCollection={onRenameCollection}
            onDeleteCollection={onDeleteCollection}
            onSetEntryField={onSetEntryField}
            onRemoveEntry={onRemoveEntry}
            onMoveEntry={onMoveEntry}
            onClose={() => showRail("sections")}
          />
        ) : effectiveRail === "design" ? (
          <DesignPanel
            document={doc}
            sectionId={designSectionId}
            sectionName={designSectionId ? sectionDisplayName(doc, designSectionId) : null}
            selectedElementId={designElementId}
            onSelectElement={setDesignElementId}
            // The «arreglo en un clic»: drop the exception and the reference underneath shows
            // through again. It is the default state of rule 6 rather than a colour somebody's
            // code guessed at, which is what makes it the honest repair — and it is the same act
            // day 6's contrast review offers from its own dialog, through this same verb.
            onClearException={(exception) =>
              onSetElementStyle(
                { sectionId: exception.sectionId, elementId: exception.elementId },
                exception.property,
                undefined,
              )
            }
            onSetPlacement={(elementId, edit) => {
              if (designSectionId) onSetPlacement(designSectionId, elementId, edit);
            }}
            onSetMobilePatch={(elementId, edit) => {
              if (designSectionId) onSetMobilePatch(designSectionId, elementId, edit);
            }}
            onMoveUpOnMobile={(elementId) => {
              if (designSectionId) onMoveUpOnMobile(designSectionId, elementId);
            }}
            onPreviewMobile={() => setDevice("mobile")}
            // The same verb the section header's own «Diseñar a mano» calls, so the two doors are
            // one offer (ADR 0025's amendment), measuring through the same function so the two
            // cannot produce different rows for the same section. Nothing is escalated without a
            // press.
            onEscalate={() => {
              if (designSectionId)
                onEscalateSection(designSectionId, measurePlaced(liveDoc(), designSectionId));
            }}
            onClose={() => showRail("sections")}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 border-b border-ui-border px-4 py-3">
        {state === "error" ? <FieldError>{es["editor.downloadError"]}</FieldError> : null}
        {photoError ? <FieldError>{photoError}</FieldError> : null}
        {placeholders > 0 ? (
          <p className="m-0 text-[13px] font-medium text-[#92400E]">
            {placeholders === 1
              ? es["editor.placeholder.one"]
              : es["editor.placeholder.many"].replace("{count}", String(placeholders))}
          </p>
        ) : null}
        <p className="m-0 text-[13px] text-ui-muted">{es["editor.editHint"]}</p>
        {/* Where a moved element says where it went. `role="status"` with `aria-live="polite"`, so
            two quick presses do not queue two interruptions, and `sr-only` because this is for a
            screen reader: the eye already sees the element move. It is **outside the canvas** on
            purpose — see `announce`. */}
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const address = pendingImage.current;
          pendingImage.current = null;
          if (file && address) onPickPhoto(address, file);
        }}
      />
      {/*
        **One frame, one document, and the chrome is re-drawn rather than re-attached.**

        Every piece of chrome inside the canvas is attached by `wireInteractions` when the frame's
        document is parsed, once per session, and kept in step by `redrawChrome` after every patch.
        Two acts used to break that, both by being invisible in the rendered page — which is
        exactly what they promise to be:

        1. **The switch changes no document at all** (`INV_4`). Nothing reloaded, and
           `wireSelection`'s closure kept the old value: turning the tools on did nothing until the
           next unrelated edit. It is a redraw now (día 4), and the closures read the present
           through `*Now` refs (día 3).
        2. **Escalating changes the document and renders byte for byte the same.** Measured, not
           assumed: `escalationChrome.test.ts` asserts the HTML and the CSS are identical before and
           after. That is «no se mueve ni un píxel» at the only level where it can be checked, and
           the reason accepting the offer left no bar behind. It is a patch and a redraw now.

        **What stood here until sprint 27 día 1** was the answer those two got in sprint 15: a
        second frame. `chromeKey` decided when the chrome had to be re-attached and did it by
        putting a new `Document` in a frame nobody could see, the live one kept painting until the
        new one was wired, and the two changed places. It worked, and it cost: the page was parsed
        twice per swap, the text caret did not survive it, a keystroke in the window between the
        paint and the wiring was lost, and some seventy pieces of machinery in this file existed to
        survive it. ADR 0051 replaced all of it with one document and a patch; the key, the slots,
        the promotion, the deadline, the remembered background and the restore of the reading
        position left on 27 día 1, and `docs/tasks/swap-route-retirement.md` is the list they left
        by. The published bytes never changed: no golden moved in either sprint.
      */}
      <div
        // The frame fills this box, so it is what reserves the canvas's height — it was
        // `minHeight` on the frame itself, and the number has not changed. `relative` is here to
        // be the containing block the absolutely positioned frame is laid out against: the canvas
        // card is only a containing block while it happens to be scaled, which is not something to
        // rest on.
        //
        // **`phone:min-h-0` (sprint 21 day 4).** 60vh is a floor for the ordinary case, where the
        // card's own height is whatever the row leaves it. On a phone, `EditorShell` instead gives
        // the card an exact, compensated height — `${100/zoom}%`, chosen so the scaled result fills
        // the row to the pixel — and a `vh` floor on a child inside it answers to the *window*, not
        // to that budget: at 320×568 it asked for 341px in a card that had 187 left after its own
        // hint strip, and `canvas-card`'s `overflow-hidden` clipped 146px of the live preview with
        // nothing on screen to say so. The floor was never wrong on a desktop window large enough
        // that it never bound; a phone is exactly where it does.
        className="relative w-full flex-grow min-h-[60vh] phone:min-h-0"
      >
        {previewFrame()}
      </div>
      {toast ? (
        <div className="fixed bottom-[34px] left-1/2 z-10 flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-wrap items-center gap-5 rounded-[13px] bg-[#0F172A] py-3.5 pr-3.5 pl-5 shadow-[0_10px_30px_rgba(15,23,42,0.28)] phone:bottom-[calc(72px+env(safe-area-inset-bottom))]">
          <span className="inline-flex items-center gap-2.5 text-[15px] font-medium text-white">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94A3B8"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 7h16" />
              <path d="M9 7V5h6v2" />
              <path d="M6 7l1 13h10l1-13" />
            </svg>
            {es["editor.toast.deleted"].replace("{name}", toast.sectionName)}
          </span>
          {toast.brokenAnchors > 0 ? (
            <span className="max-w-[26ch] text-[13px] leading-snug text-[#FCA5A5]">
              {toast.brokenAnchors === 1
                ? es["editor.toast.deletedAnchors.one"]
                : es["editor.toast.deletedAnchors.many"].replace(
                    "{count}",
                    String(toast.brokenAnchors),
                  )}
            </span>
          ) : null}
          <button
            type="button"
            onClick={undoFromHistory}
            className="h-9 cursor-pointer rounded-[9px] border-0 bg-white px-[18px] text-sm font-semibold text-ui-ink"
          >
            {es["editor.toast.undo"]}
          </button>
          {toast.persistent ? (
            <button
              type="button"
              onClick={onDismissToast}
              aria-label={es["editor.toast.dismiss"]}
              // `#94A3B8` stays **here** and nowhere else on a light surface: this toast paints
              // `#0F172A`, where the stroke measures **6.96:1** against the 3:1 a non-text graphic
              // answers to (WCAG 1.4.11). The same value on white is 2.56 and clears neither
              // threshold, which is what `ui.tsx`'s note used to get wrong.
              className="cursor-pointer border-0 bg-transparent text-[#94A3B8]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
      {downloadDialog?.kind === "photosFailed" ? (
        <PhotosFailedDialog
          srcs={downloadDialog.srcs}
          onRetry={() => {
            setDownloadDialog(null);
            onRetrySamples?.();
          }}
          onClose={() => setDownloadDialog(null)}
        />
      ) : null}
      {downloadDialog?.kind === "tooManyPhotos" ? (
        <TooManyPhotosDialog
          count={downloadDialog.count}
          max={downloadDialog.max}
          onClose={() => setDownloadDialog(null)}
        />
      ) : null}
      {downloadDialog?.kind === "unreadable" || downloadDialog?.kind === "lowContrast" ? (
        <ContrastDialog
          findings={downloadDialog.findings}
          level={downloadDialog.kind === "unreadable" ? "block" : "warn"}
          // The «arreglo en un clic», through the same verb the `Diseño` panel's audit calls:
          // dropping the exception returns the element to the reference it overwrote, which is
          // rule 6's own default rather than a colour this dialog picked. `fixException` is what
          // reopens over a remaining finding instead of silently closing on one — see its own
          // comment for the walk that found the gap.
          onFix={fixException}
          {...(downloadDialog.kind === "lowContrast"
            ? { onDownloadAnyway: () => acceptAndContinue("contrast") }
            : {})}
          onCancel={() => setDownloadDialog(null)}
        />
      ) : null}
      {downloadDialog?.kind === "overflows" ? (
        <OverflowDialog
          findings={downloadDialog.findings}
          onDownloadAnyway={() => acceptAndContinue("overflow")}
          onCancel={() => setDownloadDialog(null)}
        />
      ) : null}
      {downloadDialog?.kind === "textOverText" ? (
        <StackedTextDialog
          findings={downloadDialog.findings}
          onDownloadAnyway={() => acceptAndContinue("layout")}
          onCancel={() => setDownloadDialog(null)}
        />
      ) : null}
      {downloadDialog?.kind === "warn" ? (
        <DownloadWarningDialog
          document={doc}
          photoUrls={photoUrls}
          onReplacePhoto={(address) => {
            setDownloadDialog(null);
            replacePhoto(address);
          }}
          onDownloadAnyway={() => acceptAndContinue("photos")}
          onCancel={() => setDownloadDialog(null)}
        />
      ) : null}
      {revertFor ? (
        <RevertDialog
          sectionName={sectionDisplayName(doc, revertFor.sectionId)}
          impact={revertFor.impact}
          // The same Spanish names the fields and design panels use, from the catalog's own locale,
          // so the dialog cannot call an element something the rest of the editor calls otherwise.
          labelFor={(elementId) =>
            elementLabels(doc, revertFor.sectionId).get(elementId) ?? elementId
          }
          onCancel={() => setRevertFor(null)}
          onConfirm={(decisions) => {
            /*
             * **Where the keyboard goes after a revert, which the dialog cannot answer itself.**
             * `useFocusTrap` returns focus to whatever had it, and what had it was the `<iframe>` —
             * so focusing it restores the element the frame's own document still holds, which is
             * «Volver a la original» on the hand-design bar. That works when the dialog is
             * cancelled and is wrong when it is confirmed: reverting puts the section back under the
             * catalog, the bar goes with it, and the button focus would return to no longer exists.
             *
             * Reverting also flips the section's `source`, which changes `chromeKey` and sends the
             * rebuild through the buffered swap — so this has to be the intent that survives two
             * documents rather than a `.focus()` here.
             */
            focusTarget.current = {
              sectionId: revertFor.sectionId,
              within: '.rb-actions [data-action="handmade"]',
            };
            setRevertFor(null);
            onRevertSection(revertFor.sectionId, decisions);
          }}
        />
      ) : null}
    </EditorShell>
  );
}
