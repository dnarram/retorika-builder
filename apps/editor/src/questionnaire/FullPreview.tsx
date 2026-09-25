"use client";

import es from "../locales/es.json" with { type: "json" };

/**
 * The chosen variant at real size. No download and no editor exist yet (day 5 and day 6), so
 * the banner says so rather than the screen pretending "Usar esta" finished something.
 */
export function FullPreview({
  title,
  html,
  onBack,
}: {
  title: string;
  html: string;
  onBack: () => void;
}) {
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
        <span style={{ width: 60 }} />
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, flexGrow: 1 }}>
        <div
          style={{
            padding: "12px 16px",
            background: "#FFF8EC",
            border: "1px solid #F4DDB4",
            borderRadius: 11,
            fontSize: 14,
            color: "#7A5008",
          }}
        >
          {es["variants.downloadNote"]}
        </div>
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
