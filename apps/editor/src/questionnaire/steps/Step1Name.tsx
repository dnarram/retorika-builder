"use client";

import type { Answers } from "@retorika/generator";
import { PALETTES } from "@retorika/tokens";
import tokensEs from "@retorika/tokens/locales/es" with { type: "json" };
import { useState } from "react";
import { paletteFromLogoFile } from "../../editor/logoImage.ts";
import es from "../../locales/es.json" with { type: "json" };
import {
  Card,
  FieldError,
  NavRow,
  ProgressDots,
  TextField,
  TitleBlock,
  VisuallyHiddenLabel,
} from "../ui.tsx";

export function Step1Name({
  answers,
  update,
  onNext,
}: {
  answers: Answers;
  update: (patch: Partial<Answers>) => void;
  onNext: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const invalid = submitted && answers.businessName.trim() === "";
  // While the logo is being read. Short — a 64×64 draw of an already-decoded bitmap — but a logo
  // is the one thing on this screen that does not answer instantly, and a line that changes from
  // «Leyendo los colores…» to what was found is how the promise above it stops being a claim.
  const [reading, setReading] = useState(false);

  function handleNext() {
    if (answers.businessName.trim() === "") {
      setSubmitted(true);
      return;
    }
    onNext();
  }

  /**
   * The logo is read the moment it is chosen, and what is kept is the palette it chose.
   *
   * Here rather than at generation time because the generator must stay a pure function of its
   * answers — no canvas, no image decoding, no clock (`INV_5` and the golden corpus both rest on
   * it). The file itself goes no further than this screen: `autosave.ts` has always dropped it,
   * and now there is nothing else that wants it.
   */
  async function chooseLogo(file: File | null) {
    if (!file) {
      update({ logo: null, logoPaletteId: null });
      return;
    }
    update({ logo: file, logoPaletteId: null });
    setReading(true);
    try {
      update({ logoPaletteId: await paletteFromLogoFile(file) });
    } finally {
      setReading(false);
    }
  }

  /** What actually happened, in the owner's own terms — and never a claim the logo chose the
   * colours when it did not. A logo with no colour the palettes share leaves the sector deciding,
   * exactly as no logo at all does, and says so. */
  function logoHelp(): string {
    if (!answers.logo) return es["questionnaire.step1.logo.help"];
    if (reading) return es["questionnaire.step1.logo.help.reading"];
    const chosen = PALETTES.find((palette) => palette.id === answers.logoPaletteId);
    if (!chosen) return es["questionnaire.step1.logo.help.noPalette"];
    return es["questionnaire.step1.logo.help.palette"].replace(
      "{palette}",
      tokensEs[chosen.nameKey as keyof typeof tokensEs] ?? chosen.id,
    );
  }

  return (
    <Card width={880} gap={24}>
      <ProgressDots current={1} />
      <TitleBlock
        step={es["questionnaire.step1.step"]}
        title={es["questionnaire.step1.title"]}
        subtitle={es["questionnaire.step1.subtitle"]}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 18, paddingTop: 4 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <TextField
            id="nombre"
            label={es["questionnaire.step1.name.label"]}
            height={60}
            fontSize={18}
            variant={invalid ? "error" : "primary"}
            placeholder={es["questionnaire.step1.name.placeholder"]}
            value={answers.businessName}
            onChange={(event) => update({ businessName: event.target.value })}
          />
          {invalid ? <FieldError>{es["questionnaire.step1.name.error"]}</FieldError> : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: 20,
            background: "#F8FAFC",
            border: "1px dashed #C9D4E2",
            borderRadius: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 62,
              height: 62,
              flexShrink: 0,
              background: "#FFFFFF",
              borderRadius: 10,
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94A3B8"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
          <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>
              {es["questionnaire.step1.logo.title"]}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.45, color: "#64748B" }}>{logoHelp()}</span>
          </div>
          <label
            htmlFor="logo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 42,
              padding: "0 18px",
              background: "#FFFFFF",
              color: "#156FE7",
              fontSize: 14,
              fontWeight: 600,
              border: "1px solid #D5DEE9",
              borderRadius: 9,
              cursor: "pointer",
            }}
          >
            {es["questionnaire.step1.logo.button"]}
          </label>
          <input
            id="logo"
            type="file"
            accept="image/*"
            onChange={(event) => void chooseLogo(event.target.files?.[0] ?? null)}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
          <VisuallyHiddenLabel htmlFor="logo">
            {es["questionnaire.step1.logo.title"]}
          </VisuallyHiddenLabel>
        </div>
      </div>

      <NavRow
        backLabel={es["questionnaire.nav.back"]}
        primaryLabel={es["questionnaire.nav.next"]}
        onPrimary={handleNext}
      />
    </Card>
  );
}
