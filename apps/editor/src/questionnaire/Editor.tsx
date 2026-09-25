"use client";

import { render } from "@retorika/renderer";
import type { ElementAddress, RetorikaDocument } from "@retorika/schema";
import { useMemo, useRef, useState } from "react";
import { EditorShell, type SaveStatus } from "../editor/EditorShell.tsx";
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
}

/**
 * The tags `packages/renderer/src/build.ts` emits for a `text` or `link` value: headings,
 * body copy, and a button or link's label. Everything else in the tree (`img`, the `<ul>`
 * a list renders as) carries `data-id` too but is not click-to-edit — there is no text on an
 * image to click, and a list's own children get their own `data-id` individually.
 */
const EDITABLE_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "A"]);

const HANDLE_CORNERS = ["tl", "tr", "bl", "br"] as const;

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
 * since day 4, a small delete button drawn at the selected section's corner, the one action this
 * sprint gives the selection to trigger. There is no confirmation: ADR 0014 is explicit that a
 * delete runs immediately, with the undo it offers afterwards — reported up as
 * `onDeleteSection(sectionId)`, the same pattern as an edit — as the only safety net.
 */
export function Editor({
  title,
  document: doc,
  onEditText,
  onDeleteSection,
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

  // `render` is deterministic, so an unchanged document yields the identical string and the
  // iframe's `srcDoc` does not change — which is what keeps a device toggle or a download from
  // reloading the preview and throwing away the current selection.
  const html = useMemo(() => render(doc, "html").html, [doc]);

  function wireSelection(iframeDoc: Document) {
    const sections = [...iframeDoc.querySelectorAll<HTMLElement>("[data-section]")];

    function select(target: HTMLElement) {
      for (const section of sections) {
        section.classList.remove("rb-selected");
        for (const el of section.querySelectorAll(".rb-handle, .rb-delete")) el.remove();
      }
      target.classList.add("rb-selected");
      for (const corner of HANDLE_CORNERS) {
        const handle = iframeDoc.createElement("span");
        handle.className = `rb-handle rb-handle-${corner}`;
        target.appendChild(handle);
      }

      const sectionId = target.dataset.section;
      if (!sectionId) return;
      const deleteButton = iframeDoc.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "rb-delete";
      deleteButton.setAttribute("aria-label", es["editor.deleteSection"]);
      deleteButton.innerHTML =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" ' +
        'stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>';
      // Stopped here so the click does not also bubble to the section's own listener and
      // re-run select() on a section that is about to be removed from the document entirely.
      deleteButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onDeleteSection(sectionId);
      });
      target.appendChild(deleteButton);
    }

    for (const section of sections) {
      section.addEventListener("click", () => select(section));
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
      ".rb-delete { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px;",
      "  display: flex; align-items: center; justify-content: center; background: #DC2626;",
      "  border: 2px solid #FFFFFF; border-radius: 999px; cursor: pointer;",
      "  box-shadow: 0 2px 6px rgba(15,23,42,0.28); }",
      ".rb-delete:hover { background: #B91C1C; }",
    ].join("\n");
    iframeDoc.head.appendChild(style);

    wireSelection(iframeDoc);
    wireEditing(iframeDoc);
  }

  async function download() {
    setState("downloading");
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc }),
      });
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
        <p className="m-0 text-[13px] text-ui-muted">{es["editor.editHint"]}</p>
      </div>
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
