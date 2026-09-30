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
  type ContentElement,
  canFoldPage,
  type ElementAddress,
  findSection,
  flattenElements,
  isHandDesigned,
  type ListItem,
  listEditableFields,
  listLinksTo,
  MAX_PAGES,
  type PlacementEdit,
  type PresetShape,
  type RetorikaDocument,
  type SlotAddress,
  type SlotFill,
} from "@retorika/schema";
import { useEffect, useMemo, useRef, useState } from "react";
import { designRows, selectedRowId } from "../editor/designTree.ts";
import { type DownloadGate, downloadGateFor } from "../editor/downloadGate.ts";
import { EditorShell, type RailItemId, type SaveStatus } from "../editor/EditorShell.tsx";
import { ACCEPTED_IMAGE_ACCEPT } from "../editor/imageBytes.ts";
import { countPhotos, listPhotos, type PhotoState } from "../editor/photoInventory.ts";
import { withPhotoUrls } from "../editor/previewDocument.ts";
import { sectionFields } from "../editor/sectionFields.ts";
import { offersMatching } from "../editor/sectionSearch.ts";
import es from "../locales/es.json" with { type: "json" };
import { DesignPanel } from "./DesignPanel.tsx";
import { DownloadWarningDialog, TooManyPhotosDialog } from "./DownloadGateDialogs.tsx";
import { FieldsPanel } from "./FieldsPanel.tsx";
import { PagesPanel } from "./PagesPanel.tsx";
import { PhotosPanel } from "./PhotosPanel.tsx";
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
  onSetVariant,
  designTools,
  onDesignToolsChange,
  onEscalateSection,
  onRevertSection,
  onSetPlacement,
  pageId,
  onSelectPage,
  onSectionToPage,
  onRenamePage,
  onMovePage,
  onDeletePage,
  onPageToSection,
  onAddItem,
  onRemoveItem,
  onMoveItem,
  onPickPalette,
  onPickTypePair,
  photoUrls,
  photoError,
  offers,
  contactUnavailable,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saveStatus,
  toast,
  onDismissToast,
  onBack,
}: {
  title: string;
  document: RetorikaDocument;
  onEditText: (address: ElementAddress, text: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onDuplicateSection: (sectionId: string) => void;
  onMoveSection: (sectionId: string, toIndex: number) => void;
  onInsertSection: (catalogId: string, index: number) => void;
  /** The owner chose a file for this image element. Preparing and storing it is `Variants`'
   * business; this component only reports which element was clicked. */
  onPickPhoto: (address: ElementAddress, file: File) => void;
  onFillSlot: (fill: SlotFill) => void;
  onClearSlot: (address: SlotAddress) => void;
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
  onDesignToolsChange: (on: boolean) => void;
  /** This section starts being designed by hand, and goes back to the catalog's layout. One
   * history step each, so Ctrl+Z covers the first minutes — which is what the advanced dossier §5
   * asks for and the reason day 4's dialog is about the durable case rather than this one. */
  onEscalateSection: (sectionId: string) => void;
  onRevertSection: (sectionId: string) => void;
  /** One element moved or resized inside its section's twelve-column grid (rule 4). A partial edit,
   * because one press of a stepper is one number; the panel never sends a value `setPlacement`
   * would refuse, which is what keeps that refusal a backstop rather than a path. */
  onSetPlacement: (sectionId: string, elementId: string, edit: PlacementEdit) => void;
  /** Which page the canvas is showing. Undefined means the document's first, which is what
   * `render` already means by an absent `pageId`. */
  pageId: string | undefined;
  onSelectPage: (pageId: string | undefined) => void;
  /** This section becomes a page of its own (ADR 0022). One history step, so one «Deshacer»
   * takes back the page, the move and the avance together. */
  onSectionToPage: (sectionId: string) => void;
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
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // One input, reused: the picker is opened from inside the frame, and the element that asked
  // for it is remembered here until a file comes back.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImage = useRef<ElementAddress | null>(null);
  // Which section's fields are open, if any. Not tied to selection: clicking a word to edit it
  // selects the section too, and a form sliding in every time someone touches a sentence would
  // be in the way rather than at hand.
  const [fieldsFor, setFieldsFor] = useState<string | null>(null);
  const [rail, setRail] = useState<RailItemId>("sections");
  /** Whether the switch's own question — «¿Montas webs para otros?» — is open. State rather than a
   * ref because the popover is React's to draw, unlike everything inside the canvas. */
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
  const effectiveRail: RailItemId = rail === "design" && !designTools ? "sections" : rail;

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
    const options = pageId === undefined ? {} : { pageId };
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
      // The «Diseño» panel follows the canvas: clicking a section is how you choose what to lay
      // out. The element resets, because the elements of the section just left are not this one's.
      setDesignSectionId(sectionId);
      setDesignElementId(null);
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
      const original = (el.textContent ?? "").trim();

      // Select the whole field the moment it gains focus, the same as clicking into a
      // pre-filled name field: the first keystroke replaces the placeholder text rather
      // than landing mid-word wherever the click happened to fall.
      el.addEventListener("focus", () => {
        const selection = iframeDoc.getSelection();
        if (!selection) return;
        const range = iframeDoc.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
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
          el.blur();
        }
      });

      el.addEventListener("blur", () => {
        const next = (el.textContent ?? "").trim();
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
        if (next !== original) onEditText(address, next);
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
        // Day 4 replaces this with the dialog that shows both versions and what stays behind. Today
        // the return is lossless in every state the product can reach — nothing can add an element a
        // preset cannot place — so going straight there loses nothing, and Ctrl+Z takes it back.
        onRevertSection(sectionId);
      });
      bar.appendChild(back);

      element.classList.add("rb-free");
      element.prepend(bar);
    }

    // The stripes, on whichever section the panel is about. Here as well as in the effect above,
    // because after a remount the effect can fire before the new frame has loaded.
    syncGrid(iframeDoc, designOn ? designSectionId : null, placingElementId);
  }

  function wireInteractions() {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return;

    const style = iframeDoc.createElement("style");
    style.textContent = [
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
    ].join("\n");
    iframeDoc.head.appendChild(style);

    wireLinks(iframeDoc);
    wireSelection(iframeDoc);
    wireInsertion(iframeDoc);
    wireLines(iframeDoc);
    wirePhotos(iframeDoc);
    wireEditing(iframeDoc);
    wireHandmade(iframeDoc);
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
  function requestDownload() {
    const gate = downloadGateFor(countPhotos(doc));
    if (gate.kind === "ready") {
      void download();
      return;
    }
    setDownloadDialog(gate);
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
      onDownload={requestDownload}
      device={device}
      onDeviceChange={setDevice}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={onUndo}
      onRedo={onRedo}
      saveStatus={saveStatus}
      rail={effectiveRail}
      onRailChange={showRail}
      designTools={designTools}
      askingDesignTools={askingDesignTools}
      onAskDesignTools={() => setAskingDesignTools(true)}
      onDismissDesignTools={() => setAskingDesignTools(false)}
      onDesignToolsChange={(on) => {
        setAskingDesignTools(false);
        onDesignToolsChange(on);
      }}
      panel={
        effectiveRail === "photos" ? (
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
            onClose={() => showRail("sections")}
          />
        ) : effectiveRail === "design" ? (
          <DesignPanel
            document={doc}
            sectionId={designSectionId}
            sectionName={designSectionId ? sectionDisplayName(doc, designSectionId) : null}
            selectedElementId={designElementId}
            onSelectElement={setDesignElementId}
            onSetPlacement={(elementId, edit) => {
              if (designSectionId) onSetPlacement(designSectionId, elementId, edit);
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
        onLoad={wireInteractions}
        className="w-full flex-grow border-0 bg-ui-surface"
        style={{ minHeight: "60vh" }}
      />
      {fieldsFor && findSection(doc, fieldsFor) ? (
        <FieldsPanel
          sectionId={fieldsFor}
          sectionName={sectionDisplayName(doc, fieldsFor)}
          rows={sectionFields(doc, fieldsFor)}
          slotOrder={slotOrderOf(doc, fieldsFor)}
          onFill={onFillSlot}
          onClear={onClearSlot}
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
      {downloadDialog?.kind === "tooManyPhotos" ? (
        <TooManyPhotosDialog
          count={downloadDialog.count}
          max={downloadDialog.max}
          onClose={() => setDownloadDialog(null)}
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
          onDownloadAnyway={() => {
            setDownloadDialog(null);
            void download();
          }}
          onCancel={() => setDownloadDialog(null)}
        />
      ) : null}
    </EditorShell>
  );
}
