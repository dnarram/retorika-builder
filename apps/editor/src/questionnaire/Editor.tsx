"use client";

import {
  blankItem,
  COVER_ID,
  FOOTER_ID,
  FOOTER_IDENTITY_SLOTS,
  isPlaceholderText,
  presetFor,
  TEASER_ID,
  variantsFor,
} from "@retorika/catalog";
import catalogEs from "@retorika/catalog/locales/es" with { type: "json" };
import { render } from "@retorika/renderer";
import {
  bindList,
  canFoldPage,
  type ElementAddress,
  type EntryField,
  entryCountBlock,
  findSection,
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
  type MobilePatchEdit,
  marksAfterTrim,
  marksFor,
  type PlacementEdit,
  type PresetShape,
  type RetorikaDocument,
  type RevertImpact,
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
import { useEffect, useMemo, useRef, useState } from "react";
import { designRows, elementLabels, selectedRowId } from "../editor/designTree.ts";
import {
  type AcceptedWarning,
  type DownloadGate,
  downloadGateFor,
} from "../editor/downloadGate.ts";
import {
  EditorShell,
  type RailItemId,
  type SavedWhere,
  type SaveStatus,
} from "../editor/EditorShell.tsx";
import { ACCEPTED_IMAGE_ACCEPT } from "../editor/imageBytes.ts";
import { measureOverflow } from "../editor/overflowCheck.ts";
import { countPhotos, listPhotos, type PhotoState } from "../editor/photoInventory.ts";
import { withPhotoUrls } from "../editor/previewDocument.ts";
import { sectionFields } from "../editor/sectionFields.ts";
import { offersMatching } from "../editor/sectionSearch.ts";
import { keepsItsOwnUndo, shortcutFor } from "../editor/shortcuts.ts";
import { insertedTextFor, liveFrameOf, offsetFor, textFrameOf } from "../editor/textEdits.ts";
import { hasAnyControl, toolbarFor } from "../editor/textToolbar.ts";
import es from "../locales/es.json" with { type: "json" };
import { CollectionsPanel } from "./CollectionsPanel.tsx";
import { DesignPanel } from "./DesignPanel.tsx";
import {
  ContrastDialog,
  DownloadWarningDialog,
  OverflowDialog,
  PhotosFailedDialog,
  TooManyPhotosDialog,
} from "./DownloadGateDialogs.tsx";
import { FieldsPanel } from "./FieldsPanel.tsx";
import { PagesPanel } from "./PagesPanel.tsx";
import { PhotosPanel } from "./PhotosPanel.tsx";
import { RevertDialog } from "./RevertDialog.tsx";
import { SharePanel } from "./SharePanel.tsx";
import { StylePanel } from "./StylePanel.tsx";
import { FieldError } from "./ui.tsx";

type DownloadState = "idle" | "downloading" | "error";

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

const HANDLE_CORNERS = ["tl", "tr", "bl", "br"] as const;

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
function filenameFrom(response: Response, fallback: string): string {
  const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
  return match?.[1] ?? fallback;
}

/**
 * The chosen variant, editable inside the real editor chrome: every heading, paragraph and
 * button/link label the renderer marks with `data-id` becomes a native `contentEditable` region
 * directly inside the same-origin iframe — reached through `iframe.contentDocument`, no
 * postMessage needed. An edit commits on blur, reported up as `onEditText(address, text)`, which
 * `Variants` applies to the document it holds; the iframe then reloads from that new document,
 * which is why nothing is written mid-keystroke — only once the user leaves the field.
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
 * Section selection marks a section with a 2px outline and four corner handles injected into the
 * iframe's own DOM, mirroring mockup 08's per-element selection at section granularity — and,
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
  onSetSiteDescription,
  onSetSiteUrl,
  onSetVariant,
  designTools,
  toolsRemembered,
  onDesignToolsChange,
  onEscalateSection,
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
  onSaveToAccount,
  toast,
  onDismissToast,
  onBack,
}: {
  title: string;
  document: RetorikaDocument;
  onEditText: (address: ElementAddress, text: string, marks?: readonly MarkRun[]) => void;
  onDeleteSection: (sectionId: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, toIndex: number) => void;
  onInsertSection: (catalogId: string, index: number) => void;
  /** The owner chose a file for this image element. Preparing and storing it is `Variants`'
   * business; this component only reports which element was clicked. */
  onPickPhoto: (address: ElementAddress, file: File) => void;
  onFillSlot: (fill: SlotFill) => void;
  onClearSlot: (address: SlotAddress) => void;
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
  toolsRemembered: boolean;
  onDesignToolsChange: (on: boolean) => void;
  /** This section starts being designed by hand, and goes back to the catalog's layout. One
   * history step each, so Ctrl+Z covers the first minutes — which is what the advanced dossier §5
   * asks for and the reason day 4's dialog is about the durable case rather than this one. */
  onEscalateSection: (sectionId: string) => void;
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
  onSaveToAccount?: (() => void) | undefined;
  toast: DeleteToast | null;
  onDismissToast: () => void;
  onBack: () => void;
}) {
  const [state, setState] = useState<DownloadState>("idle");
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
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  /**
   * Which element the floating toolbar is on, across the frame reloads every edit causes.
   *
   * A ref and not state, for the same reason `fileInputRef` below is: nothing on the React side
   * renders from it, and making it state would re-render the whole editor on every focus. It is
   * ephemeral interface state either way — like the design-tools switch, it belongs to the person
   * looking and never to the site, so it is not in the document (`INV_4`).
   */
  const toolbarOn = useRef<ElementAddress | null>(null);
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
   * Every action in this editor replaces the iframe's whole `srcDoc`, so the selection outline, the
   * handles and the action cluster are all destroyed and rebuilt on each one. Until now that cost
   * one click to get back, which nobody noticed because you rarely delete the same section twice.
   * Composition is the first action anyone will repeat deliberately — the whole point is to look at
   * two and keep one — and re-selecting between each try would be a click and a hunt every time.
   *
   * Refs, not state: nothing React renders depends on them. They are read by `wireSelection` when
   * the frame finishes loading, which is outside React's render pass entirely.
   */
  const selectedSection = useRef<string | null>(null);
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
    // Any rail item that opens a panel closes the fields panel: both are fixed over the right edge
    // and the second would cover the first. It used to name `style` alone, which was complete when
    // `style` was the only panel — `pages` arrived in sprint 5 and could already be covered, and
    // `photos` would have made three. `sections` is the one that does not, because the fields panel
    // *is* its panel.
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
    const impact = revertImpact(doc, sectionId, presetFor(found.section.preset.catalogId));
    if (!impact) return;
    if (impact.lossless) {
      onRevertSection(sectionId);
      return;
    }
    setRevertFor({ sectionId, impact });
  }

  function showFields(sectionId: string | null) {
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
  const html = useMemo(() => {
    // `entryHints` (ADR 0033 §10): each card drawn from a collection entry says which entry it is.
    // **Only here.** The document cannot supply it — a binding carries no entry id and every card
    // shares the template's `data-id` — and a published page must never carry it, which is why the
    // option is off by default and `buildSite` does not pass it.
    const options = { entryHints: true, ...(pageId === undefined ? {} : { pageId }) };
    // `withPhotoUrls` since sprint 6 day 4, when this logic moved out of here and became shared.
    // It had been inline, and the three "elige por dónde empezar" cards rendered the raw document
    // instead — invisible for as long as a generated site's only image was the placeholder, and a
    // broken image on all three cards the moment the generator started asking the bank.
    return render(withPhotoUrls(doc, photoUrls), "html", options).html;
  }, [doc, photoUrls, pageId]);

  /**
   * What the canvas's chrome depends on but the rendered page does not — see the long note at the
   * `<iframe>`. Kept as a string so React's own `key` comparison does the work, and derived rather
   * than tracked, so no new action has to remember to bump it.
   */
  const chromeKey = useMemo(
    () =>
      `${designTools}|${doc.pages
        .flatMap((page) => page.sections)
        .map((section) => (section.source === "free" ? "1" : "0"))
        .join("")}`,
    [designTools, doc],
  );

  /**
   * Look for the new page every frame until it is there, and wire it the moment it is.
   *
   * **This is what actually closes the window** `wireOnce` describes; `onLoad` is only the backstop.
   * The parent cannot listen for the frame's `DOMContentLoaded`, because at the moment `srcDoc`
   * changes the document that will fire it does not exist yet — and the document that *does* exist is
   * the outgoing one, already wired. So the test is document **identity**: keep looking until
   * `contentDocument` is something other than what the chrome is attached to, and has sections in it.
   *
   * Bounded, and it terminates on the first interesting frame in every real case: this effect runs
   * only when `html` or `chromeKey` changes, and both of those mean a new document is on its way.
   * The deadline is for the one case where neither produces one, so a missed swap costs a second of
   * idle frames rather than a loop with no end.
   */
  /*
   * `wireOnce` is deliberately not a dependency. The two that are listed are the whole trigger — a
   * new rendered string, or a remount — and they are the only two things that put a new document in
   * the frame. `wireOnce` is redeclared on every render, so listing it would restart this look-ahead
   * on every render instead, which is the opposite of what it is for; and it can hold nothing stale,
   * because it reads the frame's document at the moment it runs.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: see the note above this line
  useEffect(() => {
    let frame = 0;
    const deadline = Date.now() + 1_000;
    const look = () => {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (
        iframeDoc &&
        iframeDoc !== wiredDoc.current &&
        // **Parsed, not merely started.** `readyState` leaves `"loading"` at the frame's own
        // `DOMContentLoaded`, which is exactly the moment every section exists and still long
        // before `load` waits out the eight font requests nothing answers — so this closes the
        // window this look-ahead was written for without opening a worse one.
        //
        // Without it the test was «has it got a section yet», and a streaming document has its
        // first section long before its last. The chrome was then attached to a partial page: gaps
        // for the sections parsed so far and none for the rest, with `onLoad` arriving later and
        // doing nothing, because by then the document is already the wired one.
        //
        // Measured on 5 October 2026 with the fonts held 1.5s and the CPU throttled 20x, counting
        // `.rb-gap` against `[data-section]` on a five-section page: 1 run in 6 wired a partial
        // document on `main`, and 3 in 4 once the canvas started resizing itself on mount — which
        // is how CI found it. The counts came out 5, 4 and 2 where 6 was right; CI printed 2.
        iframeDoc.readyState !== "loading" &&
        iframeDoc.querySelector("[data-section]") !== null
      ) {
        wireOnce();
        return;
      }
      if (Date.now() < deadline) frame = requestAnimationFrame(look);
    };
    look();
    return () => cancelAnimationFrame(frame);
  }, [html, chromeKey]);

  /**
   * The grid stripes follow the selected section, **without** remounting the frame.
   *
   * `designSectionId` is deliberately not part of `chromeKey`. Adding it there was the obvious move
   * and it was wrong: `select()` sets it on every click, so keying on it would reload the frame on
   * every click and throw away the selection that very click had just made — the editor would
   * deselect whatever you pressed.
   *
   * Nothing here attaches a listener, so nothing needs re-wiring: it is one class, on or off. The
   * same toggle also runs at the end of `wireHandmade`, because after a remount this effect can fire
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
    syncGrid(
      iframeRef.current?.contentDocument,
      designOn ? designSectionId : null,
      placingElementId,
    );
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
   * `syncGrid` above is shaped this way. It also runs at the end of `wireInteractions`, which is what
   * draws it after a delete: that reloads the frame, and the reload wipes every `rb-` node with it.
   *
   * **A guard against a stale frame was written here, measured, and removed.** A delete changes the
   * document, which changes `srcDoc`, which reloads the frame — so the reasoning was that this render
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
    const hole = iframeDoc.createElement("div");
    hole.className = "rb-hole";
    hole.setAttribute("role", "status");
    const was = iframeDoc.createElement("span");
    was.className = "rb-hole-was";
    was.textContent = es["editor.hole.was"].replace("{name}", toast.sectionName);
    const fate = iframeDoc.createElement("span");
    fate.className = "rb-hole-fate";
    fate.textContent = toast.persistent ? es["editor.hole.stays"] : es["editor.hole.goes"];
    hole.append(was, fate);

    // Where the section was: before whichever one took its place, or after the last if it was last.
    const after = sections[toast.index];
    if (after) after.before(hole);
    else sections[sections.length - 1]?.after(hole);
  }

  useEffect(() => {
    syncHole(iframeRef.current?.contentDocument);
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
    if (shortcut === "undo") onUndo();
    else onRedo();
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
  /**
   * Whether the footer is on the page with none of the owner's details filled in.
   *
   * ADR 0019: this warns and never blocks, and it warns **once**, only when every one of them is
   * empty. Somebody who filled two and left two made a decision; nagging about the rest would be
   * exactly the ruling on what is enough that the decision refuses to make. A hidden element
   * counts as empty, because on the page it is.
   */
  const footerNeedsIdentity = useMemo(() => {
    const footer = doc.pages
      .flatMap((page) => page.sections)
      .find((section) => section.preset.catalogId === FOOTER_ID);
    if (!footer) return false;
    return !footer.content.some(
      (element) =>
        FOOTER_IDENTITY_SLOTS.includes(element.slot) &&
        !element.hidden &&
        element.value?.kind === "text" &&
        element.value.text.trim() !== "",
    );
  }, [doc]);

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
        const slug = /^\.\/([^#]+)\.html(?:#.*)?$/.exec(href.trim())?.[1];
        if (slug === undefined) return;
        const page = doc.pages.find((candidate) => candidate.slug === slug);
        if (page) onSelectPage(doc.pages[0]?.id === page.id ? undefined : page.id);
      },
      true,
    );
  }

  function wireSelection(iframeDoc: Document) {
    const sections = [...iframeDoc.querySelectorAll<HTMLElement>("[data-section]")];

    function action(
      label: string,
      variant: "move" | "delete",
      disabled: boolean,
      svg: string,
      onClick: () => void,
    ): HTMLButtonElement {
      const button = iframeDoc.createElement("button");
      button.type = "button";
      button.className = `rb-action rb-action-${variant}`;
      button.setAttribute("aria-label", label);
      button.disabled = disabled;
      button.innerHTML = svg;
      // Stopped here so the click does not also bubble to the section's own listener and
      // re-run select() on a section a move or a delete is about to displace or remove.
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!disabled) onClick();
      });
      return button;
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
      const panel = iframeDoc.createElement("div");
      panel.className = "rb-compositions";

      const title = iframeDoc.createElement("p");
      title.className = "rb-menu-title";
      title.textContent = es["editor.composition.title"];
      panel.appendChild(title);

      for (const composition of compositions) {
        const choice = iframeDoc.createElement("button");
        choice.type = "button";
        choice.className = "rb-menu-choice rb-composition-choice";
        choice.setAttribute("aria-pressed", String(composition.current));
        const name = iframeDoc.createElement("span");
        name.className = "rb-menu-name";
        name.textContent = composition.name;
        choice.appendChild(name);
        choice.addEventListener("click", (event) => {
          event.stopPropagation();
          // Left open on purpose. Picking the composition already in use is a no-op all the way
          // down (`setVariant` hands back the same document), so the frame does not reload and
          // the menu would otherwise vanish for nothing; picking a different one reloads it, and
          // `compositionMenuOpen` is what brings the menu back so the next try is one click.
          onSetVariant(sectionId, composition.variantId);
        });
        panel.appendChild(choice);
      }

      const note = iframeDoc.createElement("p");
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
      const panel = iframeDoc.createElement("div");
      panel.className = "rb-compositions rb-escalate";

      const title = iframeDoc.createElement("p");
      title.className = "rb-menu-title";
      title.textContent = es["editor.section.escalate.title"];
      panel.appendChild(title);

      const body = iframeDoc.createElement("p");
      body.className = "rb-menu-description";
      body.textContent = es["editor.section.escalate.body"];
      panel.appendChild(body);

      const row = iframeDoc.createElement("div");
      row.className = "rb-escalate-row";

      const yes = iframeDoc.createElement("button");
      yes.type = "button";
      yes.className = "rb-escalate-yes";
      yes.textContent = es["editor.section.escalate.yes"];
      yes.addEventListener("click", (event) => {
        event.stopPropagation();
        onEscalateSection(sectionId);
      });
      row.appendChild(yes);

      const no = iframeDoc.createElement("button");
      no.type = "button";
      no.className = "rb-escalate-no";
      no.textContent = es["editor.section.escalate.no"];
      no.addEventListener("click", (event) => {
        event.stopPropagation();
        panel.remove();
        compositionMenuOpen.current = false;
      });
      row.appendChild(no);

      panel.appendChild(row);
      return panel;
    }

    function select(target: HTMLElement) {
      for (const section of sections) {
        section.classList.remove("rb-selected");
        for (const el of section.querySelectorAll(".rb-handle, .rb-actions, .rb-compositions")) {
          el.remove();
        }
      }
      target.classList.add("rb-selected");
      for (const corner of HANDLE_CORNERS) {
        const handle = iframeDoc.createElement("span");
        handle.className = `rb-handle rb-handle-${corner}`;
        target.appendChild(handle);
      }

      const sectionId = target.dataset.section;
      if (!sectionId) return;
      selectedSection.current = sectionId;
      /**
       * The «Diseño» panel follows the canvas: clicking a section is how you choose what to lay out.
       *
       * **The element only resets when the section actually changes**, and getting that wrong cost a
       * real defect the day-6 walk found. `select()` runs on a genuine click *and* on the restore at
       * the end of `wireSelection`, which puts the selection back after every edit reloads the frame.
       * Clearing unconditionally meant every press of a mobile control threw the person back to the
       * first element in the tree — so «Subir» went dead and the next press acted on the wrong thing.
       */
      setDesignSectionId((current) => {
        if (current !== sectionId) setDesignElementId(null);
        return sectionId;
      });
      const index = sections.indexOf(target);

      const actions = iframeDoc.createElement("div");
      actions.className = "rb-actions";
      actions.appendChild(
        action(
          es["editor.moveSectionUp"],
          "move",
          index <= 0,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>',
          () => onMoveSection(sectionId, index - 1),
        ),
      );
      actions.appendChild(
        action(
          es["editor.moveSectionDown"],
          "move",
          index < 0 || index >= sections.length - 1,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>',
          () => onMoveSection(sectionId, index + 1),
        ),
      );
      // Sixth button, and it only appears when there is a choice to make: a section carrying its
      // own layout, or one the catalog gives a single composition, gets no button rather than a
      // dead one. Placed after the two moves because it answers the same kind of question — where
      // this section's parts sit — and before duplicate, fields and delete, which are about the
      // section as a thing.
      const compositions = compositionsFor(doc, sectionId);
      if (compositions.length > 0) {
        actions.appendChild(
          action(
            es["editor.composition.open"],
            "move",
            false,
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M10 4v16"/></svg>',
            () => {
              const open = target.querySelector(".rb-compositions");
              if (open) {
                open.remove();
                compositionMenuOpen.current = false;
                return;
              }
              target.appendChild(compositionMenu(sectionId, compositions));
              compositionMenuOpen.current = true;
            },
          ),
        );
      }

      // The offer, and only while the tools are on and the catalog is still placing this section.
      // A free section has the bar instead, which is where its way back lives — two controls for
      // the same pair of states would be one too many, and the bar is visible without selecting.
      if (designTools && !isHandDesigned(doc, sectionId)) {
        actions.appendChild(
          action(
            es["editor.section.escalate.yes"],
            "move",
            false,
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h18"/></svg>',
            () => {
              const open = target.querySelector(".rb-escalate");
              if (open) {
                open.remove();
                compositionMenuOpen.current = false;
                return;
              }
              target.appendChild(escalateOffer(sectionId));
              compositionMenuOpen.current = true;
            },
          ),
        );
      }

      actions.appendChild(
        action(
          es["editor.duplicateSection"],
          "move",
          false,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
          () => onDuplicateSection(sectionId),
        ),
      );
      // Seventh button, and the one this sprint exists for: «Convertir esta sección en página»
      // (ADR 0022). Drawn only when the conversion would actually work, which is the same rule the
      // composition button follows — a button that lights up and refuses is worse than no button.
      // Three kinds of section are never offered it (the cover is the page's h1 and its promise,
      // the footer is chrome, an avance is already a reference to a page), and neither is anything
      // once the site has the five pages the download route accepts.
      if (canConvert(doc, sectionId)) {
        actions.appendChild(
          action(
            es["editor.sectionToPage"],
            "move",
            false,
            '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M14 3v6h6"/><path d="M14 3l6 6"/><path d="M11 13h9"/><path d="M17 10l3 3-3 3"/></svg>',
            () => onSectionToPage(sectionId),
          ),
        );
      }

      actions.appendChild(
        action(
          es["editor.fields.open"],
          "move",
          false,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h10"/><path d="M4 12h16"/><path d="M4 17h7"/><circle cx="18" cy="7" r="2"/><circle cx="15" cy="17" r="2"/></svg>',
          () => showFields(sectionId),
        ),
      );
      actions.appendChild(
        action(
          es["editor.deleteSection"],
          "delete",
          false,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>',
          () => onDeleteSection(sectionId),
        ),
      );
      target.appendChild(actions);
    }

    for (const section of sections) {
      section.addEventListener("click", () => select(section));
    }

    // Anywhere else in the page closes the composition menu, the same way the insertion menu
    // closes. Registered on the frame's document rather than the body so a click on the padding
    // around the sections counts too.
    iframeDoc.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".rb-compositions, .rb-actions")) return;
      for (const menu of iframeDoc.querySelectorAll(".rb-compositions")) menu.remove();
      compositionMenuOpen.current = false;
    });

    // Put the selection back where it was before this render replaced the whole frame. A section
    // that is gone — deleted, and this is the render that removed it — simply does not come back,
    // which is the right answer without a special case for it.
    const remembered = selectedSection.current;
    if (remembered) {
      const target = sections.find((section) => section.dataset.section === remembered);
      if (target) {
        select(target);
        if (compositionMenuOpen.current) {
          const compositions = compositionsFor(doc, remembered);
          if (compositions.length > 0) {
            target.appendChild(compositionMenu(remembered, compositions));
          } else {
            compositionMenuOpen.current = false;
          }
        }
      } else {
        selectedSection.current = null;
        compositionMenuOpen.current = false;
      }
    }
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
  function wireInsertion(iframeDoc: Document) {
    const sections = [...iframeDoc.querySelectorAll<HTMLElement>("[data-section]")];
    if (sections.length === 0) return;

    function closeMenus() {
      for (const menu of iframeDoc.querySelectorAll(".rb-menu")) menu.remove();
    }

    function menu(index: number): HTMLElement {
      const panel = iframeDoc.createElement("div");
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
        closeMenus();
      });

      const header = iframeDoc.createElement("div");
      header.className = "rb-menu-header";

      const title = iframeDoc.createElement("p");
      title.className = "rb-menu-title";
      title.textContent = es["editor.addSection.title"];

      // Visible, not only Escape: the sentence has been in `es.json` since the menu shipped with
      // nothing drawing it, and a keyboard user needs a target as well as a shortcut — Escape is
      // the one nobody has to be told about *if they already know it*. Top right, where a card's
      // close control lives everywhere else, which also makes it the first thing Tab reaches
      // inside the menu: the way out before the way in, which is the right order for a control
      // whose absence is what stranded someone in the first place.
      const close = iframeDoc.createElement("button");
      close.type = "button";
      close.className = "rb-menu-close";
      close.textContent = es["editor.addSection.close"];
      close.addEventListener("click", (event) => {
        event.stopPropagation();
        closeMenus();
      });

      header.append(title, close);
      panel.appendChild(header);

      const search = iframeDoc.createElement("input");
      search.type = "search";
      search.className = "rb-menu-search";
      search.placeholder = es["editor.addSection.searchPlaceholder"];
      search.setAttribute("aria-label", es["editor.addSection.searchLabel"]);
      panel.appendChild(search);

      const list = iframeDoc.createElement("div");
      list.className = "rb-menu-list";
      panel.appendChild(list);

      const note = iframeDoc.createElement("p");
      note.className = "rb-menu-note";
      note.textContent = es["editor.addSection.contactUnavailable"];

      function choice(offer: SectionOffer): HTMLElement {
        const button = iframeDoc.createElement("button");
        button.type = "button";
        button.className = "rb-menu-choice";
        const name = iframeDoc.createElement("span");
        name.className = "rb-menu-name";
        name.textContent = offer.name;
        const description = iframeDoc.createElement("span");
        description.className = "rb-menu-description";
        description.textContent = offer.description;
        button.append(name, description);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          closeMenus();
          onInsertSection(offer.catalogId, index);
        });
        return button;
      }

      /**
       * Redrawn on every keystroke, in place — the menu's own DOM, never React's. A `setState`
       * here would rebuild the iframe's whole `srcDoc` and take the open menu with it.
       */
      function draw(query: string) {
        list.replaceChildren();
        const matches = offersMatching(offers, query);

        if (matches.length === 0) {
          const empty = iframeDoc.createElement("p");
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
      const row = iframeDoc.createElement("div");
      row.className = "rb-gap";

      const pill = iframeDoc.createElement("button");
      pill.type = "button";
      pill.className = "rb-pill";
      pill.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#156FE7" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
      pill.appendChild(iframeDoc.createTextNode(es["editor.addSectionHere"]));
      pill.addEventListener("click", (event) => {
        event.stopPropagation();
        const open = row.querySelector(".rb-menu");
        closeMenus();
        if (!open) row.appendChild(menu(index));
      });

      const before = iframeDoc.createElement("span");
      before.className = "rb-rule";
      const after = iframeDoc.createElement("span");
      after.className = "rb-rule";
      row.append(before, pill, after);
      return row;
    }

    for (const [index, section] of sections.entries()) section.before(gap(index));
    sections[sections.length - 1]?.after(gap(sections.length));

    // Anywhere else closes an open menu, the same as any menu on the web. Not `capture`, so a
    // choice's own handler runs first and its `stopPropagation` keeps this from firing twice.
    iframeDoc.addEventListener("click", closeMenus);
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
  function wireLines(iframeDoc: Document) {
    for (const section of iframeDoc.querySelectorAll<HTMLElement>("[data-section]")) {
      const sectionId = section.dataset.section;
      if (!sectionId) continue;
      const lines = linesFor(doc, sectionId);
      if (!lines) continue;

      const list = section.querySelector<HTMLElement>(".rb-list");
      if (!list) continue;

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
            const button = iframeDoc.createElement("button");
            button.type = "button";
            button.className = `rb-line-move rb-line-${direction}`;
            button.setAttribute("aria-label", lineLabel(direction, lines.catalogId));
            button.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0F172A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${
              direction === "up" ? "M12 19V5M5 12l7-7 7 7" : "M12 5v14M19 12l-7 7-7-7"
            }"/></svg>`;
            button.addEventListener("click", (event) => {
              event.stopPropagation();
              onMoveItem(sectionId, lines.slot, itemId, direction === "up" ? index - 1 : index + 1);
            });
            return button;
          };
          if (index > 0) li.appendChild(move("up"));
          if (index < items.length - 1) li.appendChild(move("down"));
        }

        if (lines.canRemove) {
          const remove = iframeDoc.createElement("button");
          remove.type = "button";
          remove.className = "rb-line-remove";
          remove.setAttribute("aria-label", lineLabel("remove", lines.catalogId));
          remove.innerHTML =
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
          remove.addEventListener("click", (event) => {
            event.stopPropagation();
            onRemoveItem(sectionId, lines.slot, itemId);
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
        const full = iframeDoc.createElement("p");
        full.className = "rb-line-full";
        // Through `lineLabel`, so it says «fotos» in a gallery where the button beside it says
        // «Añadir foto». The generic sentence talks about «líneas», which is the editor's word and
        // not the owner's, and it would be the only place in this section that used it.
        full.textContent = lineLabel("full", lines.catalogId);
        list.insertAdjacentElement("afterend", full);
        continue;
      }
      const add = iframeDoc.createElement("button");
      add.type = "button";
      add.className = "rb-line-add";
      add.textContent = `+ ${lineLabel("add", lines.catalogId)}`;
      add.addEventListener("click", (event) => {
        event.stopPropagation();
        // Built here from the catalog, because what a valid line is made of is the catalog's
        // business; the schema re-mints its ids against the document it lands in.
        const found = findSection(doc, sectionId);
        if (!found) return;
        onAddItem(sectionId, lines.slot, blankItem(found.section.preset.catalogId));
      });
      list.insertAdjacentElement("afterend", add);
    }
  }

  function wirePhotos(iframeDoc: Document) {
    for (const image of iframeDoc.querySelectorAll<HTMLImageElement>('img[data-role="image"]')) {
      const elementId = image.dataset.id;
      const sectionId = image.closest<HTMLElement>("[data-section]")?.dataset.section;
      if (!elementId || !sectionId) continue;

      image.classList.add("rb-photo");
      image.setAttribute("title", es["editor.changePhoto"]);
      image.addEventListener("click", (event) => {
        // Not the section's click too: choosing a photo is not choosing a section.
        event.stopPropagation();
        replacePhoto({ sectionId, elementId });
      });

      if (photoStates.get(addressKey(sectionId, elementId)) !== "sample") continue;

      // The badge is absolutely positioned, so it needs a positioned ancestor to anchor to, and
      // the nearest one it would otherwise find is the section — which, for a gallery card, is the
      // wrong box by the height of the whole section. Positioning the image's own parent is a
      // no-op wherever that parent is already positioned, and never reaches the published page:
      // this runs on the iframe's DOM, not on the document.
      const parent = image.parentElement;
      if (parent && iframeDoc.defaultView?.getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
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
    const badge = iframeDoc.createElement("button");
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

    const open = (el: HTMLElement) => {
      close();
      const section = el.closest<HTMLElement>("[data-section]");
      const sectionId = section?.dataset.section;
      const elementId = el.dataset.id;
      const role = el.dataset["role"] as Role | undefined;
      if (!section || !sectionId || !elementId || !role) return;

      const controls = toolbarFor({ role }, designTools === true);
      if (!controls || !hasAnyControl(controls)) return;

      const address: ElementAddress = { sectionId, elementId };
      toolbarOn.current = address;
      const current = styleFor(doc, address);

      const bar = iframeDoc.createElement("div");
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

      const group = (label: string): HTMLElement => {
        const wrapper = iframeDoc.createElement("div");
        wrapper.className = "rb-toolbar-group";
        const caption = iframeDoc.createElement("span");
        caption.className = "rb-toolbar-caption";
        caption.textContent = label;
        wrapper.appendChild(caption);
        return wrapper;
      };

      const write = (property: StyleProperty, value: StyleValue | undefined) => {
        onSetElementStyle(address, property, value);
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
      const boundHere = boundAt(doc, address, el);
      if (boundHere) {
        const collection = doc.collections.find(
          (candidate) => candidate.id === boundHere.collectionId,
        );
        const places = usesOfCollection(doc, boundHere.collectionId).length;
        const notice = iframeDoc.createElement("div");
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
        const exit = iframeDoc.createElement("button");
        exit.type = "button";
        exit.className = "rb-toolbar-link";
        exit.textContent = es["editor.toolbar.unbindSection"];
        exit.title = es["editor.toolbar.unbindHelp"];
        exit.addEventListener("click", () => {
          dismiss();
          const list = boundListOf(doc, sectionId);
          if (list) onUnbindList(sectionId, list.slot);
        });
        exitGroup.appendChild(exit);
        bar.appendChild(exitGroup);
      }

      if (controls.marks) {
        const marksGroup = group(es["editor.toolbar.marks"]);

        /**
         * What is selected, as offsets into the **document's** text.
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
         */
        const selectionRange = (): MarkRange | undefined => {
          const selection = iframeDoc.getSelection();
          if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return undefined;
          const range = selection.getRangeAt(0);
          if (!el.contains(range.commonAncestorContainer)) return undefined;

          const frame = textFrameOf(el.textContent ?? "");
          const upTo = iframeDoc.createRange();
          upTo.selectNodeContents(el);
          upTo.setEnd(range.startContainer, range.startOffset);

          const from = offsetFor(frame, upTo.toString().length);
          const to = Math.max(from, Math.min(from + range.toString().length, frame.text.length));
          return to > from ? { from, to } : undefined;
        };

        const buttons: { mark: Mark; node: HTMLButtonElement }[] = [];

        const refresh = () => {
          const range = selectionRange();
          const marks = marksFor(doc, address);
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
          const button = iframeDoc.createElement("button");
          button.type = "button";
          button.className = `rb-toolbar-mark rb-toolbar-mark-${mark}`;
          button.dataset["mark"] = mark;
          button.textContent = es[`editor.toolbar.markOf.${mark}` as keyof typeof es];
          button.title = es[`editor.toolbar.markTitleOf.${mark}` as keyof typeof es];
          button.setAttribute(
            "aria-label",
            es[`editor.toolbar.markTitleOf.${mark}` as keyof typeof es],
          );
          button.addEventListener("click", () => {
            const range = selectionRange();
            if (!range) return;
            // Read at press time, never at draw time: between the two the person chose the words.
            onSetMark(address, range, mark, !rangeHasMark(marksFor(doc, address), range, mark));
          });
          buttons.push({ mark, node: button });
          marksGroup.appendChild(button);
        }

        refresh();
        followSelection = refresh;
        iframeDoc.addEventListener("selectionchange", refresh);
        bar.appendChild(marksGroup);
      }

      if (controls.size.length > 0) {
        const sizes = group(es["editor.toolbar.size"]);
        for (const ref of controls.size) {
          const button = iframeDoc.createElement("button");
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
          button.addEventListener("click", () => write("fontSize", chosen ? undefined : { ref }));
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
          const exact = iframeDoc.createElement("input");
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
       * **Named «Titular» and «Texto», by what the family is for and never by the font.** A heading
       * face is Playfair on one type pair and Inter on another, so a button reading «Playfair» would
       * be wrong on two pairs out of three; issue #9 settled that vocabulary for the whole product
       * and the `Estilo` panel has followed it since sprint 4.
       */
      if (controls.family) {
        const families = group(es["editor.toolbar.family"]);
        for (const ref of controls.family) {
          const button = iframeDoc.createElement("button");
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
          button.setAttribute("aria-label", `${es["editor.toolbar.family"]} — ${label}`);
          button.title = `${es["editor.toolbar.family"]} — ${label}`;
          // Pressing the one already chosen takes it off, like the size steps. With two buttons and
          // no exact arm it is the only way back to the family the site's type pair gives this role,
          // and a «quitar» for a control of two would be half the group again.
          button.addEventListener("click", () => write("fontFamily", chosen ? undefined : { ref }));
          families.appendChild(button);
        }
        bar.appendChild(families);
      }

      if (controls.color.length > 0) {
        const colors = group(es["editor.toolbar.color"]);
        for (const ref of controls.color) {
          const button = iframeDoc.createElement("button");
          button.type = "button";
          button.className = "rb-toolbar-swatch";
          button.dataset["ref"] = ref;
          button.style.background = doc.theme[ref];
          const label = es[`editor.toolbar.colorOf.${ref}` as keyof typeof es];
          button.title = label;
          button.setAttribute("aria-label", label);
          const chosen =
            current?.color !== undefined && "ref" in current.color
              ? current.color.ref === ref
              : false;
          if (chosen) button.classList.add("rb-toolbar-on");
          button.setAttribute("aria-pressed", String(chosen));
          button.addEventListener("click", () => write("color", chosen ? undefined : { ref }));
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
          const exact = iframeDoc.createElement("input");
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
                ? (doc.theme[inForce] ?? "#000000")
                : "#000000";
          if (exactColor !== "") exact.classList.add("rb-toolbar-on");
          // `change` rather than `input`: dragging across a colour wheel fires `input` continuously
          // and would open a history step per pixel.
          exact.addEventListener("change", () => {
            write("color", { exact: exact.value, exception: true });
          });
          colors.appendChild(exact);

          if (exactColor !== "") {
            const off = iframeDoc.createElement("button");
            off.type = "button";
            off.className = "rb-toolbar-step";
            off.textContent = es["editor.toolbar.reset"];
            off.addEventListener("click", () => write("color", undefined));
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

        const select = iframeDoc.createElement("select");
        select.className = "rb-toolbar-select";
        select.setAttribute("aria-label", caption);
        const none = iframeDoc.createElement("option");
        none.value = "";
        none.textContent = es["editor.toolbar.default"];
        select.appendChild(none);
        for (const ref of refs) {
          const option = iframeDoc.createElement("option");
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
          const marked = iframeDoc.createElement("option");
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
          const exact = iframeDoc.createElement("input");
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
        const button = iframeDoc.createElement("button");
        button.type = "button";
        button.className = "rb-toolbar-link";
        button.textContent = es["editor.toolbar.link"];
        // A second door, not a second mechanism: it opens the panel that already owns
        // destinations, on this section. Editing an href in the frame would be a second place a
        // destination can be written, and `listDeadDestinations` would have two sources to chase.
        button.addEventListener("click", () => {
          dismiss();
          setFieldsFor(sectionId);
        });
        linkGroup.appendChild(button);
        bar.appendChild(linkGroup);
      }

      // Appended to the section, then measured, then placed: the height is not known until it is
      // in the document, and the flip depends on the height.
      section.appendChild(bar);

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

      const above = top - bar.offsetHeight - 8;
      // Below when there is no room above — the cover's headline under a tight scale, where the
      // section's own padding is all the room there is. Mockup 08 puts the bar at `top: -52px`
      // unconditionally, which for the first element of the page lands outside the iframe's visible
      // area and cannot be clicked; mockup 17 draws this flip instead.
      bar.style.top = above < 0 ? `${top + el.offsetHeight + 8}px` : `${above}px`;
      // Clamped at both ends: `0` keeps it from starting left of the section, and the right clamp
      // keeps a bar anchored to an element far across the grid from running off the other side.
      // The `max-width` above is what handles a bar wider than the section; this is what handles a
      // bar that merely starts too far right.
      const rightmost = Math.max(section.clientWidth - bar.offsetWidth - 8, 0);
      bar.style.left = `${Math.min(Math.max(left, 0), rightmost)}px`;
    };

    for (const el of iframeDoc.querySelectorAll<HTMLElement>("[data-id]")) {
      if (!EDITABLE_TAGS.has(el.tagName)) continue;
      el.addEventListener("focus", () => open(el));
      el.addEventListener("blur", () => {
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
    }

    /**
     * Put the bar back on the element it was on, after an edit rebuilt the frame.
     *
     * **Found by the walk, and it made the control useless: the bar vanished the moment it was
     * used.** Writing a style changes the document, which changes `srcDoc`, which reloads the
     * iframe — every edit in this editor does. Nothing had focus in the new frame, so nothing
     * reopened the bar, and a person got exactly one press per click into the text.
     *
     * Reopened **without focusing**, deliberately. `wireEditing` selects a whole field on focus,
     * which is right when somebody clicks into it to type and wrong here — having just pressed a
     * swatch, they would watch their heading flash to selected for no reason. The words stay put
     * and the bar stays put; clicking the text again is what resumes typing.
     */
    const remembered = toolbarOn.current;
    if (remembered) {
      const section = iframeDoc.querySelector(
        `[data-section="${CSS.escape(remembered.sectionId)}"]`,
      );
      const el = section?.querySelector<HTMLElement>(
        `[data-id="${CSS.escape(remembered.elementId)}"]`,
      );
      // Gone means the element was deleted or hidden while the bar was open; forget it rather than
      // keeping a pointer to something nobody can see.
      if (el) open(el);
      else toolbarOn.current = null;
    }
  }

  function wireEditing(iframeDoc: Document) {
    for (const el of iframeDoc.querySelectorAll<HTMLElement>("[data-id]")) {
      if (!EDITABLE_TAGS.has(el.tagName)) continue;
      const elementId = el.dataset.id;
      // The section this field lives in, read off the same markup: `data-section` is what makes
      // the address unambiguous once two sections can carry the same element id.
      const sectionId = el.closest<HTMLElement>("[data-section]")?.dataset.section;
      if (!elementId || !sectionId) continue;
      const address: ElementAddress = { sectionId, elementId };

      el.contentEditable = "true";
      // Through `textFrameOf`, not a bare `.trim()`: it is the one place that also takes out the
      // non-breaking spaces `contentEditable` invents, which otherwise reach the document and the
      // owner's ZIP. `original` is compared against `next` to decide whether anything changed, so
      // the two have to be normalised the same way or a space turning into U+00A0 reads as an edit.
      const original = textFrameOf(el.textContent ?? "").text;

      /**
       * The marks after every edit this focus has seen, the text they believe in, and whether every
       * one of those edits was anchored in a range the browser gave us (ADR 0027 §4b).
       *
       * `anchored` going false is not an error: it is the mechanism choosing to fall back. An IME
       * composition, the browser's own undo, or an engine whose `getTargetRanges()` returns nothing
       * all land here, and the commit then takes §4's path — the diff — exactly as it did before
       * this listener existed. Degrading to what shipped is the floor.
       *
       * **`liveText` is what makes the capture checkable rather than merely plausible.** Each edit
       * is applied to it as well as to the marks, so after every keystroke it must equal what the
       * element actually holds. When it does not, something changed the text that this listener never
       * saw, the offsets are no longer about the string in front of the person, and the only honest
       * answer is to stop claiming they are.
       */
      let liveMarks: MarkRun[] = [];
      let liveText = "";
      let anchored = true;

      // Select the whole field the moment it gains focus, the same as clicking into a
      // pre-filled name field: the first keystroke replaces the placeholder text rather
      // than landing mid-word wherever the click happened to fall.
      el.addEventListener("focus", () => {
        liveMarks = marksFor(doc, address) ?? [];
        liveText = liveFrameOf(el.textContent ?? "").text;
        anchored = true;
        const selection = iframeDoc.getSelection();
        if (!selection) return;
        const range = iframeDoc.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
      });

      /**
       * The range `beforeinput` says it is about to replace, as offsets into the document's text.
       *
       * `getTargetRanges()` hands back `StaticRange`s, which carry the four container/offset fields
       * and none of a live `Range`'s methods — so it is copied into one, which is also what makes
       * `toString()` available for the same code-unit measurement the toolbar uses.
       */
      const editOf = (range: Range, inserted: number): TextEdit | undefined => {
        if (!el.contains(range.commonAncestorContainer)) return undefined;
        // `liveFrameOf`, not `textFrameOf`: trailing whitespace stays, because `trim()` moves under
        // somebody who types a space at the end and every offset after that would be one short.
        const frame = liveFrameOf(el.textContent ?? "");
        const upTo = iframeDoc.createRange();
        upTo.selectNodeContents(el);
        upTo.setEnd(range.startContainer, range.startOffset);
        const from = offsetFor(frame, upTo.toString().length);
        const to = Math.max(from, Math.min(from + range.toString().length, frame.text.length));
        return { from, to, inserted };
      };

      /**
       * Whether this listener's picture of the text still matches the element's.
       *
       * **Checked on the way in to the next edit and again at the commit, never with a timer.**
       * `beforeinput` runs before the browser applies anything, so the result of an edit can only be
       * read later — and "later" has two moments that are already there and are exactly the ones that
       * matter. A `setTimeout` would buy the same answer with a scheduling race attached.
       *
       * A mismatch means something changed the text that this listener never saw, so every offset it
       * has is about a string that is not in front of the person any more. Falling back then is not
       * caution, it is correctness.
       *
       * **Compared trimmed, and that is not laxness — it was measured.** The html target prints a
       * trailing `"\n    "` after the words, and Chromium's select-all reports a target range that
       * covers only the visible text while removing that whitespace as well. So after the very first
       * edit, `liveText` carries a tail the element no longer has, every later check fails, and the
       * anchored path is lost for the rest of the session — which is exactly what the walk found
       * happening on an ordinary replacement. Whitespace at the two ends is the one difference that
       * cannot matter here, because `marksAfterTrim` removes it before anything is committed.
       */
      const stillInStep = (): boolean =>
        liveFrameOf(el.textContent ?? "").text.trim() === liveText.trim();

      /** One captured edit, applied to the marks and to the text they believe in, together. */
      const record = (edit: TextEdit, inserted: string): void => {
        liveMarks = shiftMarks(liveMarks, edit);
        liveText = liveText.slice(0, edit.from) + inserted + liveText.slice(edit.to);
      };

      const liveRange = (target: StaticRange | undefined): Range | undefined => {
        if (target) {
          const range = iframeDoc.createRange();
          range.setStart(target.startContainer, target.startOffset);
          range.setEnd(target.endContainer, target.endOffset);
          return range;
        }
        // No target range is the fallback's own case, and paste still has to be made plain — so the
        // live selection stands in for it there, and nowhere else.
        const selection = iframeDoc.getSelection();
        if (!selection || selection.rangeCount === 0) return undefined;
        const range = selection.getRangeAt(0);
        return el.contains(range.commonAncestorContainer) ? range : undefined;
      };

      /**
       * Where the edit stops being a guess (ADR 0027 §4b).
       *
       * Fires **before** the browser changes anything, which is the whole point: the range it is
       * about to replace is still measurable, and `inputType` says what is going in. `textEditBetween`
       * cannot recover either from the two strings afterwards, and gets both wrong in ways that
       * silently corrupt a mark — `"pan y pan y aceite"` with the second `pan y ` deleted destroys a
       * bold on the first `pan`, measured.
       */
      el.addEventListener("beforeinput", (event) => {
        const input = event as InputEvent;
        // The previous edit's result is in the element by now, so this is where it gets verified.
        if (anchored && !stillInStep()) anchored = false;
        const targets = input.getTargetRanges();
        const range = liveRange(targets[0]);

        // **Paste is forced to plain text, whatever the clipboard holds.** `contentEditable` pastes
        // HTML by default, and ADR 0024 requires this field to stay a flat string — one paste of a
        // formatted sentence from a word processor would otherwise put markup where the document
        // expects characters. The text the table measures and the text inserted here are the same
        // `text/plain`, so the anchored edit describes exactly what happened.
        //
        // Cancelled and done by hand even when the capture has already fallen back, because the
        // plain-text rule is not about marks: it is what keeps the value a flat string at all.
        if (input.inputType === "insertFromPaste") {
          input.preventDefault();
          const text = input.dataTransfer?.getData("text/plain") ?? "";
          if (!range) {
            anchored = false;
            return;
          }
          const edit = editOf(range, text.length);
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
          if (edit) record(edit, text);
          else anchored = false;
          return;
        }

        const inserted = insertedTextFor({
          inputType: input.inputType,
          data: input.data,
          pastedText: null,
        });
        // An unmapped type, or more than one target range — which the specification allows and no
        // engine is known to produce for a plain text field. Either way the honest answer is that
        // this edit was not measured, so the commit must not pretend it was.
        if (inserted === undefined || !range || targets.length > 1) {
          anchored = false;
          return;
        }
        const edit = editOf(range, inserted.length);
        if (edit) record(edit, inserted);
        else anchored = false;
      });

      // These are real hrefs (a "Reservar mesa" button, say): clicking one to place a
      // cursor must not also navigate the preview away.
      if (el.tagName === "A") el.addEventListener("click", (event) => event.preventDefault());

      el.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          el.blur();
        } else if (event.key === "Escape") {
          el.textContent = original;
          // A programmatic reset no `beforeinput` ever reported, so the captured marks now describe
          // a text that is gone. The blur below commits nothing, since the text is back to
          // `original` — but leaving stale offsets behind would be a trap for whoever reads them.
          liveMarks = marksFor(doc, address) ?? [];
          liveText = liveFrameOf(el.textContent ?? "").text;
          anchored = true;
          el.blur();
        }
      });

      el.addEventListener("blur", () => {
        const next = textFrameOf(el.textContent ?? "").text;
        // **Emptying a text is a real edit**, and used to be silently undone here. The comment
        // that guarded it said "nothing here offers a real way to hide the element instead", and
        // that stopped being true twice: the fields panel clears a section's slot (sprint 3
        // day 4), and an empty text now renders as nothing rather than as an empty tag (day 6).
        // Nothing is lost either way — a section slot comes back through that panel, a list line
        // through remove-and-add, and both through undo, which is the same net ADR 0014 gives a
        // deleted section.
        //
        // Found by building a carta: a dish with no price could not be given one, so the line
        // published «Escribe aquí el precio» — a marker on a real restaurant's page — and made
        // "the price is optional per line" false in practice.
        //
        // **A link or a button is the exception, and the original reasoning holds for it word for
        // word.** Its value is a destination, so emptying the label leaves an anchor that still
        // points somewhere with no words in it: invisible on the page and nameless to a screen
        // reader. The download refuses a button that goes nowhere; this refuses one that says
        // nothing.
        if (next === "" && (el.dataset["role"] === "link" || el.dataset["role"] === "button")) {
          el.textContent = original;
          return;
        }
        if (next === original) return;

        /**
         * The captured marks, in the coordinates of the text actually being stored (ADR 0027 §4b).
         *
         * Three conditions, and all three have to hold for the capture to be used:
         *
         * 1. **Every edit was anchored.** One unmapped input type in the session is enough to make
         *    the running offsets wrong, and there is no way to repair them halfway.
         * 2. **The listener is still in step with the element**, which also verifies the last edit —
         *    the one no later `beforeinput` was ever going to check.
         * 3. **Trimming `liveText` gives exactly the text being committed.** `marksAfterTrim` removes
         *    the whitespace at the two ends; if what is left is not the committed string, then the
         *    element changed some other way and the offsets are not about it.
         *
         * Failing any of them hands `onEditText` no marks at all, and `withText` derives them by
         * diff exactly as it did before §4b existed. That is the floor, and it is reached by
         * returning less information rather than by a different code path.
         */
        const anchoredMarks =
          anchored && stillInStep() && liveText.trim() === next
            ? marksAfterTrim(liveText, liveMarks)
            : undefined;

        /**
         * **A bound text's words live in the list, so that is where the edit goes** (ADR 0033 §6).
         *
         * Same gesture, same commit, different destination — and the destination is the whole point:
         * one edit changes every card that shows this entry. The toolbar has already said so, on
         * focus, before a character was typed.
         *
         * The marks go straight through: `anchoredMarks` is already in the coordinates of the text
         * being stored, which is exactly what an entry's field wants.
         */
        const bound = boundAt(doc, address, el);
        if (bound) {
          onSetEntryField(bound.collectionId, bound.entryId, bound.field, {
            text: next,
            ...(anchoredMarks && anchoredMarks.length > 0 ? { marks: anchoredMarks } : {}),
          });
          return;
        }
        onEditText(address, next, anchoredMarks);
      });
    }
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
  function wireHandmade(iframeDoc: Document) {
    if (!designTools) return;

    for (const element of iframeDoc.querySelectorAll<HTMLElement>("[data-section]")) {
      const sectionId = element.dataset.section;
      if (!sectionId || !isHandDesigned(doc, sectionId)) continue;

      const bar = iframeDoc.createElement("div");
      bar.className = "rb-handmade";

      const badge = iframeDoc.createElement("span");
      badge.className = "rb-handmade-badge";
      badge.innerHTML =
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B4740B" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21l4-1 11-11-3-3L4 17l-1 4z"/></svg>';
      badge.appendChild(iframeDoc.createTextNode(es["editor.section.handmade"]));
      bar.appendChild(badge);

      const name = iframeDoc.createElement("span");
      name.className = "rb-handmade-name";
      name.textContent = sectionDisplayName(doc, sectionId);
      bar.appendChild(name);

      const back = iframeDoc.createElement("button");
      back.type = "button";
      back.className = "rb-handmade-back";
      back.textContent = es["editor.section.revert"];
      back.addEventListener("click", (event) => {
        event.stopPropagation();
        requestRevert(sectionId);
      });
      bar.appendChild(back);

      element.classList.add("rb-free");
      element.prepend(bar);
    }

    // The stripes, on whichever section the panel is about. Here as well as in the effect above,
    // because after a remount the effect can fire before the new frame has loaded.
    syncGrid(iframeDoc, designOn ? designSectionId : null, placingElementId);
  }

  /**
   * Which document the chrome is attached to, so attaching it twice is impossible and attaching it
   * *early* is safe. A reload and a remount both produce a new `Document`, so the identity is the
   * whole bookkeeping — there is no flag to reset and nothing to clear.
   */
  const wiredDoc = useRef<Document | null>(null);

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
  function wireOnce() {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc || wiredDoc.current === iframeDoc) return;
    wiredDoc.current = iframeDoc;
    wireInteractions();
  }

  function wireInteractions() {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return;

    // The canvas is an `<iframe srcDoc>`, so a key pressed over the page being edited is dispatched
    // in *its* document and never reaches the editor's. Without this the shortcut would work
    // everywhere except the one place the person is actually looking.
    iframeDoc.addEventListener("keydown", handleShortcut);

    const style = iframeDoc.createElement("style");
    style.textContent = [
      // The buffer fix noted on day 3 and again on day 5: selecting *any* section made the
      // preview scroll 4px sideways. Measured to the culprit rather than guessed — `.rb-handle-tr`
      // and `.rb-handle-br` sit at `right: -4px` on a full-bleed section, which is a deliberate
      // touch (a resize handle straddling its selection outline, not hugging it) that only becomes
      // a problem because the section itself has no margin to absorb 4px of bleed.
      //
      // Editor-only chrome, this stylesheet only: `wireInteractions` runs on the live iframe and
      // never on `render(doc, "html")`, so `overflow-x: clip` here cannot reach a published page.
      // `clip` rather than `hidden`, because `hidden` on one axis makes the other compute to
      // `auto` by spec — this iframe's own vertical scroll must stay exactly what it already is.
      "html, body { overflow-x: clip; }",
      '[contenteditable="true"] { cursor: text; border-radius: 3px;',
      "  outline: 2px dashed transparent; outline-offset: 3px; }",
      '[contenteditable="true"]:hover, [contenteditable="true"]:focus { outline-color: #156FE7; }',
      "[data-section] { position: relative; cursor: pointer; }",
      "[data-section].rb-selected { outline: 2px solid #156FE7; outline-offset: -2px; }",
      ".rb-handle { position: absolute; width: 7px; height: 7px; background: #FFFFFF;",
      "  border: 2px solid #156FE7; border-radius: 2px; pointer-events: none; }",
      ".rb-handle-tl { top: -4px; left: -4px; } .rb-handle-tr { top: -4px; right: -4px; }",
      ".rb-handle-bl { bottom: -4px; left: -4px; } .rb-handle-br { bottom: -4px; right: -4px; }",
      // Inset within the section, not hung outside it like the corner handles: the cover is
      // the first section, with no room above it, and a button hanging above the top of the
      // page there would sit outside the iframe's own visible area — covered by whatever the
      // parent page draws above the iframe, and unclickable. Every section has room inside it.
      ".rb-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; }",
      ".rb-action { width: 26px; height: 26px; display: flex; align-items: center;",
      "  justify-content: center; border: 2px solid #FFFFFF; border-radius: 999px;",
      "  cursor: pointer; box-shadow: 0 2px 6px rgba(15,23,42,0.28); }",
      ".rb-action-move { background: #156FE7; } .rb-action-move:hover { background: #0E5BC4; }",
      ".rb-action-delete { background: #DC2626; } .rb-action-delete:hover { background: #B91C1C; }",
      ".rb-action:disabled { background: #B9CDEA; cursor: not-allowed; }",
      // The hole a delete leaves, drawn as mockup 11 draws it — `2px dashed`, its own margin, the
      // name above and what happens next below. `UI_FONT` because it is the editor talking, not the
      // site: every other `rb-` node in this frame does the same.
      `.rb-hole { box-sizing: border-box; margin: 22px 30px; padding: 26px; font-family: ${UI_FONT};`,
      "  background: #F7FAFE; border: 2px dashed #B9CDEA; border-radius: 11px; display: flex;",
      "  flex-direction: column; align-items: center; gap: 6px; }",
      ".rb-hole-was { font-size: 15px; font-weight: 600; color: #475569; }",
      ".rb-hole-fate { font-size: 13px; color: #94A3B8; text-align: center; }",
      // The gap between sections, drawn as mockup 08 draws it: a dashed rule broken by a pill.
      ".rb-gap { position: relative; box-sizing: border-box; height: 76px; padding: 0 40px;",
      "  display: flex; align-items: center; gap: 0; background: #FFFFFF; }",
      ".rb-rule { flex-grow: 1; height: 0; border-top: 2px dashed #B9CDEA; }",
      // The interface's own typeface, never the site's. Everything else injected here is an
      // icon, so this is the first piece of chrome with words in it, and `font: inherit` would
      // have drawn them in whatever face the client picked for their own headings — ADR 0015's
      // separation, showing up as a menu set in a display serif.
      `.rb-pill, .rb-menu, .rb-menu button { font-family: ${UI_FONT}; }`,
      ".rb-pill { display: inline-flex; align-items: center; gap: 8px; height: 40px;",
      "  padding: 0 20px; font-size: 14px; font-weight: 600; color: #156FE7;",
      "  background: #FFFFFF; border: 1px solid #A9C9F4; border-radius: 999px; cursor: pointer; }",
      ".rb-pill:hover { background: #F2F7FE; border-color: #156FE7; }",
      ".rb-menu { position: absolute; top: 60px; left: 50%; transform: translateX(-50%);",
      "  z-index: 20; width: 340px; max-width: calc(100% - 80px); box-sizing: border-box;",
      "  padding: 14px; background: #FFFFFF; border: 1px solid #E5E9F0; border-radius: 13px;",
      "  box-shadow: 0 14px 38px rgba(15,23,42,0.18); display: flex; flex-direction: column;",
      "  gap: 4px; text-align: left; }",
      ".rb-menu-header { display: flex; align-items: baseline; justify-content: space-between;",
      "  gap: 12px; margin-bottom: 6px; }",
      ".rb-menu-title { margin: 0; font-size: 13px; font-weight: 700; color: #0F172A; }",
      // A quiet word rather than a cross: it sits beside a title, not over a photograph, and the
      // menu is small enough that an icon would need a label anyway.
      `.rb-menu-close { font-family: ${UI_FONT}; flex-shrink: 0; padding: 2px 6px; font-size: 12px;`,
      "  font-weight: 600; color: #5B6B82; background: none; border: 0; border-radius: 7px;",
      "  cursor: pointer; }",
      ".rb-menu-close:hover { background: #F2F7FE; color: #156FE7; }",
      // The catalog's search, finally on a screen. Quiet until it is used: a plain field with no
      // icon and no button, because there is nothing to submit — it filters as you type.
      `.rb-menu-search { font-family: ${UI_FONT}; box-sizing: border-box; width: 100%;`,
      "  margin: 0 0 6px 0; height: 34px; padding: 0 10px; font-size: 13px; color: #0F172A;",
      "  background: #F6F8FB; border: 1px solid #E3E8F0; border-radius: 9px; outline: none; }",
      ".rb-menu-search:focus { border-color: #156FE7; background: #FFFFFF; }",
      ".rb-menu-list { display: flex; flex-direction: column; gap: 4px; }",
      ".rb-menu-empty { margin: 4px 0; font-size: 12px; line-height: 1.4; color: #5B6B82; }",
      ".rb-menu-choice { display: flex; flex-direction: column; gap: 2px; padding: 9px 10px;",
      "  text-align: left; background: none; border: 0; border-radius: 9px; cursor: pointer; }",
      ".rb-menu-choice:hover { background: #F2F7FE; }",
      ".rb-menu-name { font-size: 14px; font-weight: 600; color: #0F172A; }",
      ".rb-menu-description { font-size: 12px; line-height: 1.35; color: #5B6B82; }",
      ".rb-menu-note { margin: 8px 0 0 0; padding-top: 10px; border-top: 1px solid #EDF1F6;",
      "  font-size: 12px; line-height: 1.4; color: #5B6B82; }",
      // The composition menu: the insertion menu's card, anchored under the action cluster
      // instead of centred in a gap, because this one belongs to a section rather than to a
      // space between two. Narrower, since every choice is a short name with no description.
      `.rb-compositions { font-family: ${UI_FONT}; position: absolute; top: 40px; right: 8px;`,
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
      "  font-size: 13px; border-radius: 9px; cursor: pointer; }",
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
      `.rb-handmade { font-family: ${UI_FONT}; position: absolute; top: 0; left: 0; right: 0;`,
      "  z-index: 5; box-sizing: border-box; display: flex; align-items: center; gap: 8px;",
      "  padding: 9px 13px; background: rgba(248,250,253,0.96); backdrop-filter: blur(2px);",
      "  border-bottom: 1px solid #E3E8F0; }",
      // And the action cluster steps below it, rather than the two drawing over each other. The
      // cluster's own `top: 8px` is measured from the section, so this is the bar's height plus the
      // same 8px of air.
      ".rb-free .rb-actions { top: 52px; }",
      ".rb-handmade-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 9px;",
      "  font-size: 11px; font-weight: 600; color: #8A5A08; background: #FFF4E5;",
      "  border: 1px solid #F4DDB4; border-radius: 7px; }",
      ".rb-handmade-name { flex-grow: 1; font-size: 12px; color: #5B6B82; }",
      `.rb-handmade-back { font-family: ${UI_FONT}; flex-shrink: 0; padding: 5px 10px;`,
      "  font-size: 11px; font-weight: 600; color: #156FE7; background: #FFFFFF;",
      "  border: 1px solid #C6D9F3; border-radius: 7px; cursor: pointer; }",
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
      '.rb-designing::before { content: ""; position: absolute; inset: 0; z-index: 0;',
      "  pointer-events: none; background: repeating-linear-gradient(90deg,",
      "    rgba(21,111,231,0.16) 0 1px, transparent 1px 8.3333%); }",
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
      `.rb-line-add { font-family: ${UI_FONT}; margin-top: 10px; display: inline-flex;`,
      "  align-items: center; height: 30px; padding: 0 14px; font-size: 13px; font-weight: 600;",
      "  color: #156FE7; background: #FFFFFF; border: 1px solid #A9C9F4; border-radius: 999px;",
      "  cursor: pointer; }",
      ".rb-line-add:hover { background: #F2F7FE; border-color: #156FE7; }",
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
      ".rb-toolbar-caption { font-size: 11px; font-weight: 600; color: #94A3B8; }",
      // Re-enabled here rather than only on the specific classes below, because it is the one
      // property every interactive element in the bar needs and the failure mode of missing it on
      // any one of them is silent — a control sitting over a swallowed click, indistinguishable
      // from a working one until someone tries to press it.
      `.rb-toolbar button, .rb-toolbar select, .rb-toolbar input { pointer-events: auto; }`,
      `.rb-toolbar button, .rb-toolbar select { font-family: ${UI_FONT}; cursor: pointer; }`,
      // `B` and `I`: square, because they are one glyph each and a padded pill would read as a
      // word. Drawn in the weight and slant they apply, which is what makes them legible without a
      // caption — the group still has one, for a screen reader.
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
    wireInsertion(iframeDoc);
    wireLines(iframeDoc);
    wirePhotos(iframeDoc);
    wireEditing(iframeDoc);
    // After `wireEditing`, which is what makes an element focusable in the first place.
    wireToolbar(iframeDoc);
    wireHandmade(iframeDoc);
    // Last, and on the load rather than only on a render: a delete reloads this frame, so the render
    // that opened the toast ran against the document that still had the section in it. This is the
    // pass that actually draws the notice. It goes after `wireInsertion`, which inserts the `.rb-gap`
    // rows the notice is positioned among.
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
    const overflow = await measureOverflow(doc, { hostDocument: window.document });
    const gate = downloadGateFor(countPhotos(doc), doc, accepted, overflow, failedSamples);
    if (gate.kind === "ready") {
      void download();
      return;
    }
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
      onUndo={onUndo}
      onRedo={onRedo}
      saveStatus={saveStatus}
      savedWhere={savedWhere}
      onSaveToAccount={onSaveToAccount}
      rail={effectiveRail}
      onRailChange={showRail}
      designTools={designTools}
      toolsRemembered={toolsRemembered}
      askingDesignTools={askingDesignTools}
      onAskDesignTools={() => setAskingDesignTools(true)}
      onDismissDesignTools={() => setAskingDesignTools(false)}
      onDesignToolsChange={(on) => {
        setAskingDesignTools(false);
        onDesignToolsChange(on);
      }}
      panel={
        effectiveRail === "share" ? (
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
            onReplacePhoto={replacePhoto}
            onGoToPhoto={(photo) => {
              // The panel is also a way of finding a photograph: show the page it is on and select
              // its section, which scrolls the canvas to it.
              onSelectPage(doc.pages[0]?.id === photo.pageId ? undefined : photo.pageId);
              selectedSection.current = photo.sectionId;
            }}
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
            canFold={(id) => canFoldPage(doc, id)}
            linksTo={(id) => listLinksTo(doc, id).length}
          />
        ) : effectiveRail === "style" ? (
          <StylePanel
            theme={doc.theme}
            onPickPalette={onPickPalette}
            onPickTypePair={onPickTypePair}
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
            // one offer (ADR 0025's amendment). Nothing is escalated without a press.
            onEscalate={() => {
              if (designSectionId) onEscalateSection(designSectionId);
            }}
            onClose={() => showRail("sections")}
          />
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 border-b border-ui-border px-4 py-3">
        {state === "error" ? <FieldError>{es["editor.downloadError"]}</FieldError> : null}
        {photoError ? <FieldError>{photoError}</FieldError> : null}
        {footerNeedsIdentity ? (
          <p className="m-0 text-[13px] text-ui-muted">{es["editor.footerIdentity"]}</p>
        ) : null}
        {placeholders > 0 ? (
          <p className="m-0 text-[13px] font-medium text-[#92400E]">
            {placeholders === 1
              ? es["editor.placeholder.one"]
              : es["editor.placeholder.many"].replace("{count}", String(placeholders))}
          </p>
        ) : null}
        <p className="m-0 text-[13px] text-ui-muted">{es["editor.editHint"]}</p>
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
        `key` on the chrome's own state, and it is the fix for two defects the browser walk found
        that no test in this repository could have.

        Every piece of chrome inside the canvas is attached by `wireInteractions` on the frame's
        `load`, and the comment above `html` explains why that is normally enough: an unchanged
        document renders to the identical string, the frame does not reload, and the selection
        survives. Two things this sprint break that assumption, both by being invisible in the
        rendered page — which is exactly what they promise to be:

        1. **The switch changes no document at all** (`INV_4`). So nothing reloaded, and
           `wireSelection`'s closure kept the old value: turning the tools on did nothing until the
           next unrelated edit.
        2. **Escalating changes the document and renders byte for byte the same.** Measured, not
           assumed: `escalationChrome.test.ts` asserts the HTML and the CSS are identical before and
           after. That is «no se mueve ni un píxel» at the only level where it can be checked, and
           the reason accepting the offer left no bar behind.

        Remounting re-runs the wiring against the current state. It costs the selection, which is the
        right trade for two acts that are deliberate and rare — and re-attaching every listener in
        place would be this remount with more ways to go wrong.
      */}
      <iframe
        key={chromeKey}
        ref={iframeRef}
        title={title}
        srcDoc={html}
        onLoad={wireOnce}
        className="w-full flex-grow border-0 bg-ui-surface"
        style={{ minHeight: "60vh" }}
      />
      {fieldsFor && findSection(doc, fieldsFor) ? (
        <FieldsPanel
          sectionId={fieldsFor}
          sectionName={sectionDisplayName(doc, fieldsFor)}
          rows={sectionFields(doc, fieldsFor)}
          slotOrder={slotOrderOf(doc, fieldsFor)}
          itemSlotOrder={itemSlotOrderOf(doc, fieldsFor)}
          onFill={onFillSlot}
          onClear={onClearSlot}
          // The panel commits a words-only change through the very same callback the canvas does,
          // and since sprint 12 day 3 it anchors that change in the range the browser is replacing
          // too — so the marks arrive measured rather than guessed, exactly as they do from the
          // canvas. Absent still means the diff, which is the documented floor (ADR 0027 §4b).
          onEditText={onEditText}
          onClose={() => showFields(null)}
        />
      ) : null}
      {toast ? (
        <div className="fixed bottom-[34px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-5 rounded-[13px] bg-[#0F172A] py-3.5 pr-3.5 pl-5 shadow-[0_10px_30px_rgba(15,23,42,0.28)]">
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
            onClick={onUndo}
            className="h-9 cursor-pointer rounded-[9px] border-0 bg-white px-[18px] text-sm font-semibold text-ui-ink"
          >
            {es["editor.toast.undo"]}
          </button>
          {toast.persistent ? (
            <button
              type="button"
              onClick={onDismissToast}
              aria-label={es["editor.toast.dismiss"]}
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
            setRevertFor(null);
            onRevertSection(revertFor.sectionId, decisions);
          }}
        />
      ) : null}
    </EditorShell>
  );
}
