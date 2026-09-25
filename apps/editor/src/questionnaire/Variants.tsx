"use client";

import { type Answers, type GeneratedSite, generateVariants } from "@retorika/generator";
import { render } from "@retorika/renderer";
import { applyTextEdits } from "@retorika/schema";
import { useState } from "react";
import es from "../locales/es.json" with { type: "json" };
import { Editor } from "./Editor.tsx";
import { Brand } from "./ui.tsx";

/**
 * "Elige por dónde empezar" (mockup 07), with real sites instead of drawings: each card is a
 * live `<iframe>` of what `@retorika/generator` actually produced for these five answers, not a
 * screenshot. That was only a screenshot in `docs/design/prototype/`, because those files sit on
 * disk and Chrome will not render a `file://` page inside an `iframe` of another `file://` page
 * — this app is served over HTTP, same origin, so the live frame works.
 *
 * No "volver a generar otras tres": the generator is deterministic (no clock, no randomness),
 * so clicking it would produce the exact same three sites again. Offering it would be a button
 * that lies about what it does.
 *
 * `sites` itself (generateVariants' output) never changes after day 6: `edits` is a pure
 * overlay applied on top of it via applyTextEdits, kept here rather than in `sites` state so
 * the base stays exactly what the generator produced and the edits stay exactly what the user
 * typed — two different things, not one merged into the other.
 */
const CAPTIONS: readonly { titleKey: keyof typeof es; captionKey: keyof typeof es }[] = [
  { titleKey: "variants.v1.title", captionKey: "variants.v1.caption" },
  { titleKey: "variants.v2.title", captionKey: "variants.v2.caption" },
  { titleKey: "variants.v3.title", captionKey: "variants.v3.caption" },
];

function ThumbnailFrame({ html, title }: { html: string; title: string }) {
  const width = 1280;
  const height = 900;
  const scale = 0.28;
  return (
    <div
      style={{
        width: "100%",
        height: height * scale,
        overflow: "hidden",
        borderRadius: 8,
        border: "1px solid #EDF1F6",
        background: "#FFFFFF",
      }}
    >
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <iframe
          title={title}
          srcDoc={html}
          scrolling="no"
          style={{ width, height, border: 0, pointerEvents: "none" }}
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export function Variants({ answers, onRestart }: { answers: Answers; onRestart: () => void }) {
  const [sites] = useState<GeneratedSite[]>(() => generateVariants(answers));
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Keyed by variant index, then element id: day 6's edits, kept here rather than inside
  // FullPreview so they survive "Volver" and reopening the same card — the one piece of
  // continuity this in-memory-only slice owes the user within a single session.
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});

  function editedHtml(index: number, site: GeneratedSite): string {
    return render(applyTextEdits(site.document, edits[index] ?? {}), "html").html;
  }

  if (openIndex !== null) {
    const site = sites[openIndex];
    const caption = CAPTIONS[openIndex];
    if (!site || !caption) return null;
    return (
      <Editor
        title={es[caption.titleKey]}
        html={editedHtml(openIndex, site)}
        answers={answers}
        variantIndex={openIndex}
        onEdit={(elementId, text) =>
          setEdits((current) => ({
            ...current,
            [openIndex]: { ...current[openIndex], [elementId]: text },
          }))
        }
        onBack={() => setOpenIndex(null)}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "#F5F7FA",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Brand />
      <div
        style={{
          flexGrow: 1,
          boxSizing: "border-box",
          padding: "0 40px 40px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            maxWidth: 640,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 32,
              lineHeight: 1.2,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#0F172A",
              textAlign: "center",
            }}
          >
            {es["variants.title"]}
          </h1>
          <p style={{ margin: 0, fontSize: 16, color: "#64748B", textAlign: "center" }}>
            {es["variants.subtitle"]}
          </p>
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 1180,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 20,
          }}
        >
          {sites.map((site, index) => {
            const caption = CAPTIONS[index];
            if (!caption) return null;
            const highlighted = index === 1;
            const html = editedHtml(index, site);
            return (
              <div
                key={site.document.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: 14,
                  background: "#FFFFFF",
                  border: highlighted ? "2px solid #156FE7" : "1px solid #E5E9F0",
                  boxShadow: highlighted ? "0 0 0 3px #E8F1FE" : undefined,
                  borderRadius: 14,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>
                    {es[caption.titleKey]}
                  </span>
                  {highlighted ? (
                    <span
                      style={{
                        padding: "3px 9px",
                        background: "#E8F1FE",
                        color: "#156FE7",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 999,
                      }}
                    >
                      {es["variants.recommended"]}
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  style={{
                    padding: 0,
                    border: 0,
                    background: "none",
                    cursor: "pointer",
                    display: "block",
                  }}
                  aria-label={`${es["variants.viewFull"]}: ${es[caption.titleKey]}`}
                >
                  <ThumbnailFrame html={html} title={es[caption.titleKey]} />
                </button>

                <span style={{ fontSize: 12, lineHeight: 1.4, color: "#64748B" }}>
                  {es[caption.captionKey]}
                </span>

                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#156FE7",
                    background: "none",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {es["variants.viewFull"]} →
                </button>

                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 46,
                    background: highlighted ? "#156FE7" : "#FFFFFF",
                    color: highlighted ? "#FFFFFF" : "#334155",
                    fontSize: 14,
                    fontWeight: 600,
                    border: highlighted ? 0 : "1px solid #E5E9F0",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  {es["variants.use"]}
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onRestart}
          style={{
            font: "inherit",
            fontSize: 14,
            fontWeight: 600,
            color: "#156FE7",
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {es["variants.restart"]}
        </button>
      </div>
    </div>
  );
}
