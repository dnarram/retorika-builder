"use client";

import type { Answers } from "@retorika/generator";
import { useState } from "react";
import es from "../locales/es.json" with { type: "json" };
import { FieldError } from "./ui.tsx";

type DownloadState = "idle" | "downloading" | "error";

/** From `Content-Disposition: attachment; filename="doc-taberna.zip"`. */
function filenameFrom(response: Response, fallback: string): string {
  const match = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
  return match?.[1] ?? fallback;
}

/**
 * The chosen variant at real size, with the real "Descargar" button (day 5): it posts the same
 * five answers back to /api/download, which regenerates this exact variant server-side and
 * returns the ZIP built in memory — Render's disk is ephemeral, so nothing is ever written to
 * it. Regenerating rather than re-sending the rendered HTML is deliberate: `generate()` is
 * deterministic, so the server reproducing it from the answers is exactly as correct as sending
 * the bytes over would be, and it is the one payload every other screen already holds in state.
 */
export function FullPreview({
  title,
  html,
  answers,
  variantIndex,
  onBack,
}: {
  title: string;
  html: string;
  answers: Answers;
  variantIndex: number;
  onBack: () => void;
}) {
  const [state, setState] = useState<DownloadState>("idle");

  async function download() {
    setState("downloading");
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, variantIndex }),
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
        <p style={{ margin: 0, fontSize: 13, color: "#5B6B82" }}>{es["variants.downloadHint"]}</p>
        <iframe
          title={title}
          srcDoc={html}
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
