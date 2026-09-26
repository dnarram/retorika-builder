"use client";

import { isPlaceholderText } from "@retorika/catalog";
import { render } from "@retorika/renderer";
import { type ElementAddress, listEditableFields, type RetorikaDocument } from "@retorika/schema";
import { useMemo, useRef, useState } from "react";
import { EditorShell, type SaveStatus } from "../editor/EditorShell.tsx";
import { ACCEPTED_IMAGE_ACCEPT } from "../editor/imageBytes.ts";
import es from "../locales/es.json" with { type: "json" };
import { FieldError } from "./ui.tsx";

type DownloadState = "idle" | "downloading" | "error";

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
 * since day 4, a small cluster of action buttons drawn at the selected section's corner: move up,
 * move down, duplicate, delete. No floating toolbar this sprint — one action, one button, the
 * same self-contained-in-the-iframe pattern click-to-edit already uses. None of the four ask for
 * confirmation: ADR 0014 is explicit that a delete runs immediately, with the undo it offers
 * afterwards as the only safety net, and the same directness applies to the other three, which
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
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // One input, reused: the picker is opened from inside the frame, and the element that asked
  // for it is remembered here until a file comes back.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImage = useRef<ElementAddress | null>(null);

  // `render` is deterministic, so an unchanged document yields the identical string and the
  // iframe's `srcDoc` does not change — which is what keeps a device toggle or a download from
  // reloading the preview and throwing away the current selection.
  // Rendered from a display copy: every image whose src names an uploaded file gets the object
  // URL for its bytes instead. The document itself keeps the bundle-relative name, which is what
  // the ZIP needs — a relative path inside a `srcDoc` iframe resolves against the parent page's
  // URL and 404s, which is exactly why the placeholder is a data: URI and not a file.
  const html = useMemo(() => {
    if (photoUrls.size === 0) return render(doc, "html").html;
    const forPreview: RetorikaDocument = {
      ...doc,
      pages: doc.pages.map((page) => ({
        ...page,
        sections: page.sections.map((section) => ({
          ...section,
          content: section.content.map((element) => {
            if (element.value?.kind !== "image") return element;
            const url = photoUrls.get(element.value.src);
            return url ? { ...element, value: { ...element.value, src: url } } : element;
          }),
        })),
      })),
    };
    return render(forPreview, "html").html;
  }, [doc, photoUrls]);

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

    function select(target: HTMLElement) {
      for (const section of sections) {
        section.classList.remove("rb-selected");
        for (const el of section.querySelectorAll(".rb-handle, .rb-actions")) el.remove();
      }
      target.classList.add("rb-selected");
      for (const corner of HANDLE_CORNERS) {
        const handle = iframeDoc.createElement("span");
        handle.className = `rb-handle rb-handle-${corner}`;
        target.appendChild(handle);
      }

      const sectionId = target.dataset.section;
      if (!sectionId) return;
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
      actions.appendChild(
        action(
          es["editor.duplicateSection"],
          "move",
          false,
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
          () => onDuplicateSection(sectionId),
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

      const title = iframeDoc.createElement("p");
      title.className = "rb-menu-title";
      title.textContent = es["editor.addSection.title"];
      panel.appendChild(title);

      for (const offer of offers) {
        const choice = iframeDoc.createElement("button");
        choice.type = "button";
        choice.className = "rb-menu-choice";
        const name = iframeDoc.createElement("span");
        name.className = "rb-menu-name";
        name.textContent = offer.name;
        const description = iframeDoc.createElement("span");
        description.className = "rb-menu-description";
        description.textContent = offer.description;
        choice.append(name, description);
        choice.addEventListener("click", (event) => {
          event.stopPropagation();
          closeMenus();
          onInsertSection(offer.catalogId, index);
        });
        panel.appendChild(choice);
      }

      if (contactUnavailable) {
        const note = iframeDoc.createElement("p");
        note.className = "rb-menu-note";
        note.textContent = es["editor.addSection.contactUnavailable"];
        panel.appendChild(note);
      }

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
   * already promises — no fifth button in the action cluster, no panel. `EDITABLE_TAGS` leaves
   * `img` out because there is no text on an image to click into; this is the other half of that
   * sentence, which had been missing.
   */
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
        pendingImage.current = { sectionId, elementId };
        const input = fileInputRef.current;
        if (!input) return;
        // Cleared first, so picking the same file twice in a row still fires a change.
        input.value = "";
        input.click();
      });
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
        if (next === "") {
          // Never save a heading or a button empty: nothing here offers a real way to
          // hide the element instead (document rule 3 needs a real editor action for
          // that), so an empty save would just be a broken word missing from the page.
          el.textContent = original;
          return;
        }
        if (next !== original) onEditText(address, next);
      });
    }
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
      ".rb-menu-title { margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #0F172A; }",
      ".rb-menu-choice { display: flex; flex-direction: column; gap: 2px; padding: 9px 10px;",
      "  text-align: left; background: none; border: 0; border-radius: 9px; cursor: pointer; }",
      ".rb-menu-choice:hover { background: #F2F7FE; }",
      ".rb-menu-name { font-size: 14px; font-weight: 600; color: #0F172A; }",
      ".rb-menu-description { font-size: 12px; line-height: 1.35; color: #5B6B82; }",
      ".rb-menu-note { margin: 8px 0 0 0; padding-top: 10px; border-top: 1px solid #EDF1F6;",
      "  font-size: 12px; line-height: 1.4; color: #5B6B82; }",
      // A photo reads as replaceable the same way an editable text does: the dashed outline on
      // hover, and nothing until then.
      ".rb-photo { cursor: pointer; outline: 2px dashed transparent; outline-offset: 3px; }",
      ".rb-photo:hover { outline-color: #156FE7; }",
    ].join("\n");
    iframeDoc.head.appendChild(style);

    wireSelection(iframeDoc);
    wireInsertion(iframeDoc);
    wirePhotos(iframeDoc);
    wireEditing(iframeDoc);
  }

  /** The photo srcs this document actually names. An upload that has since been undone still has
   * its bytes in memory, and the route refuses a photo the document does not reference. */
  function referencedPhotos(): string[] {
    const srcs = new Set<string>();
    for (const page of doc.pages) {
      for (const section of page.sections) {
        for (const element of section.content) {
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

  return (
    <EditorShell
      siteName={title}
      onBack={onBack}
      downloadState={state}
      onDownload={download}
      device={device}
      onDeviceChange={setDevice}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={onUndo}
      onRedo={onRedo}
      saveStatus={saveStatus}
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
      <iframe
        ref={iframeRef}
        title={title}
        srcDoc={html}
        onLoad={wireInteractions}
        className="w-full flex-grow border-0 bg-ui-surface"
        style={{ minHeight: "60vh" }}
      />
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
    </EditorShell>
  );
}
