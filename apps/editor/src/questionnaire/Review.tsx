"use client";

import es from "../locales/es.json" with { type: "json" };
import type { Answers, MainAction } from "./types.ts";
import { Brand } from "./ui.tsx";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "16px 0",
        borderTop: "1px solid #E3E8F0",
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#5B6B82",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 16, color: "#0F172A" }}>{value}</span>
    </div>
  );
}

const ACTION_LABEL: Record<MainAction, keyof typeof es> = {
  call: "questionnaire.action.call",
  book: "questionnaire.action.book",
  message: "questionnaire.action.message",
  email: "questionnaire.action.email",
  visit: "questionnaire.action.visit",
};

/**
 * Day 2's honest terminus: no fake "montando tu web" animation promising steps (sections
 * chosen, texts written, palette extracted) that do not exist yet. This is a straight read-back
 * of what the questionnaire captured — day 3's generator input, and today's proof that the
 * right question fills the right field.
 */
export function Review({ answers, onRestart }: { answers: Answers; onRestart: () => void }) {
  const sectorLabel =
    answers.sector === "otro"
      ? `${es["questionnaire.sector.otro"]} — ${answers.otherSectorDescription || "—"}`
      : answers.sector
        ? es[`questionnaire.sector.${answers.sector}` as keyof typeof es]
        : "—";

  const locationValue = answers.noPremises
    ? es["review.location.noPremises"]
    : answers.address
      ? [answers.address, answers.hours].filter(Boolean).join(" · ")
      : es["review.location.empty"];

  const actionValue = answers.mainAction
    ? es[ACTION_LABEL[answers.mainAction]] +
      (answers.mainAction === "book" && answers.bookingLink ? ` — ${answers.bookingLink}` : "")
    : es["review.location.empty"];

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
          padding: "0 60px 40px 60px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 720,
            maxWidth: "100%",
            boxSizing: "border-box",
            padding: "34px 52px 28px 52px",
            background: "#FFFFFF",
            borderRadius: 20,
            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#0F172A",
            }}
          >
            {es["review.title"]}
          </h1>
          <p style={{ margin: "0 0 8px", fontSize: 15, lineHeight: 1.5, color: "#64748B" }}>
            {es["review.subtitle"]}
          </p>

          <Row label={es["review.name"]} value={answers.businessName || "—"} />
          <Row label={es["review.sector"]} value={sectorLabel} />
          <Row
            label={es["review.services"]}
            value={
              answers.services.length > 0
                ? answers.services.join(", ")
                : es["review.services.empty"]
            }
          />
          <Row label={es["review.location"]} value={locationValue} />
          <Row label={es["review.action"]} value={actionValue} />

          <button
            type="button"
            onClick={onRestart}
            style={{
              alignSelf: "flex-start",
              marginTop: 16,
              font: "inherit",
              fontSize: 15,
              fontWeight: 600,
              color: "#156FE7",
              background: "none",
              border: 0,
              padding: 0,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {es["review.restart"]}
          </button>
        </div>
      </div>
    </div>
  );
}
