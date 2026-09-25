"use client";

import type { Answers } from "@retorika/generator";
import { useRef, useState } from "react";
import es from "../locales/es.json" with { type: "json" };
import { FieldError } from "./ui.tsx";

type DownloadState = "idle" | "downloading" | "error";

/**
 * The tags `packages/renderer/src/build.ts` emits for a `text` or `link` value: headings,
 * body copy, and a button or link's label. Everything else in the tree (`img`, the `<ul>`
 * a list renders as) carries `data-id` too but is not click-to-edit — there is no text on an
 * image to click, and a list's own children get their own `data-id` individually.
 */
const EDITABLE_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "P", "A"]);

/** From `Content-Disposition: attachment; filename="doc-taberna.zip"`. */
function filenameFrom(response: Response, fallback: string): string {
  const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
  return match?.[1] ?? fallback;
}

/**
 * The chosen variant at real size, editable in place (day 6): every heading, paragraph and
 * button/link label the renderer marks with `data-id` becomes a native `contentEditable`
 * region directly inside the same-origin iframe — reached through `iframe.contentDocument`,
 * no postMessage needed. An edit commits on blur, reported up as `onEdit(elementId, text)` so
 * `Variants` can remember it across "Volver" and re-render the iframe's `srcDoc` with it
 * applied; the iframe then reloads fresh, which is why nothing is written mid-keystroke — only
 * once the user leaves the field, exactly when losing focus is expected anyway.
 *
 * "Descargar" does not trust that state round-trip for its own snapshot: React's state update
 * from a blur fired moments earlier is not guaranteed visible yet in this closure, so download
 * re-reads every editable element's current text straight from the live DOM instead. Sending
 * the full set of current values rather than a diff costs nothing — applyTextEdits treats an
 * unchanged value exactly like a changed one — and it means what downloads is always exactly
 * what is on screen, with no timing window where the two could disagree.
 */
export function FullPreview({
  title,
  html,
  answers,
  variantIndex,
  onEdit,
  onBack,
}: {
  title: string;
  html: string;
  answers: Answers;
  variantIndex: number;
  onEdit: (elementId: string, text: string) => void;
  onBack: () => void;
}) {
  const [state, setState] = useState<DownloadState>("idle");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function wireEditing() {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return;

    const style = iframeDoc.createElement("style");
    style.textContent = [
      '[contenteditable="true"] { cursor: text; border-radius: 3px;',
      "  outline: 2px dashed transparent; outline-offset: 3px; }",
      '[contenteditable="true"]:hover, [contenteditable="true"]:focus { outline-color: #156FE7; }',
    ].join("\n");
    iframeDoc.head.appendChild(style);

    for (const el of iframeDoc.querySelectorAll<HTMLElement>("[data-id]")) {
      if (!EDITABLE_TAGS.has(el.tagName)) continue;
      const elementId = el.dataset.id;
      if (!elementId) continue;

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
        if (next !== original) onEdit(elementId, next);
      });
    }
  }

  function currentEdits(): Record<string, string> {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return {};
    const edits: Record<string, string> = {};
    for (const el of iframeDoc.querySelectorAll<HTMLElement>("[data-id]")) {
      if (!EDITABLE_TAGS.has(el.tagName)) continue;
      const elementId = el.dataset.id;
      const text = (el.textContent ?? "").trim();
      if (elementId && text !== "") edits[elementId] = text;
    }
    return edits;
  }

  async function download() {
    setState("downloading");
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, variantIndex, edits: currentEdits() }),
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
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#F5F7FA",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          background: "#FFFFFF",
          borderBottom: "1px solid #E3E8F0",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            font: "inherit",
            fontSize: 15,
            fontWeight: 600,
            color: "#156FE7",
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
          }}
        >
          ← {es["variants.back"]}
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>{title}</span>
        <button
          type="button"
          onClick={download}
          disabled={state === "downloading"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 38,
            padding: "0 20px",
            background: state === "downloading" ? "#8FB4E9" : "#156FE7",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 600,
            border: 0,
            borderRadius: 9,
            cursor: state === "downloading" ? "not-allowed" : "pointer",
          }}
        >
          {state === "downloading" ? es["variants.downloading"] : es["variants.download"]}
        </button>
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, flexGrow: 1 }}>
        {state === "error" ? <FieldError>{es["variants.downloadError"]}</FieldError> : null}
        <p style={{ margin: 0, fontSize: 13, color: "#5B6B82" }}>{es["variants.editHint"]}</p>
        <iframe
          ref={iframeRef}
          title={title}
          srcDoc={html}
          onLoad={wireEditing}
          style={{
            width: "100%",
            flexGrow: 1,
            minHeight: "70vh",
            border: "1px solid #E3E8F0",
            borderRadius: 12,
            background: "#FFFFFF",
          }}
        />
      </div>
    </div>
  );
}
