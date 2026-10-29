"use client";

import { type Answers, VARIANTS } from "@retorika/generator";
import { PALETTES } from "@retorika/tokens";
import tokensEs from "@retorika/tokens/locales/es" with { type: "json" };
import { useState } from "react";
import { ACCEPTED_IMAGE_ACCEPT } from "../../editor/imageBytes.ts";
import { paletteFromLogoFile } from "../../editor/logoImage.ts";
import { logoSrcFor, mintLogoId, prepareLogo, savePhoto } from "../../editor/photos.ts";
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
  /** Why the chosen file was not taken, in the owner's terms, or `null`. */
  const [rejection, setRejection] = useState<string | null>(null);

  function handleNext() {
    if (answers.businessName.trim() === "") {
      setSubmitted(true);
      return;
    }
    onNext();
  }

  /**
   * The logo is read the moment it is chosen: its palette, as since sprint 6, **and its bytes are
   * kept** (ADR 0059) — as a PNG of at most 512px, under the name the document will carry, in this
   * browser's photo store for each of the three cards the generator is about to make. That store
   * is where the editor puts a session's photographs back from on a reload, so the logo reaches
   * the cards by exactly the path a photograph takes, and the generator stays a pure function of
   * its answers: it is handed a name (`logoSrc`), never a file.
   *
   * A file that cannot be kept — markup, an unreadable file — is not kept at all, and says why.
   * A store that will not take the bytes (a private window) keeps the palette and drops the name,
   * so no document ever names a logo nobody holds; the line under the button says so.
   */
  async function chooseLogo(file: File | null) {
    setRejection(null);
    if (!file) {
      update({ logo: null, logoSrc: null, logoPaletteId: null });
      return;
    }
    update({ logo: file, logoSrc: null, logoPaletteId: null });
    setReading(true);
    try {
      const prepared = await prepareLogo(file);
      if (!prepared.ok) {
        setRejection(es[`editor.logo.${prepared.error.reason}` as keyof typeof es]);
        update({ logo: null, logoSrc: null, logoPaletteId: null });
        return;
      }
      const src = logoSrcFor(mintLogoId());
      const kept = (
        await Promise.all(
          VARIANTS.map((_, variant) =>
            savePhoto({ kind: "variant", variant }, src, prepared.logo.bytes),
          ),
        )
      ).every(Boolean);
      const logoPaletteId = await paletteFromLogoFile(file);
      update({ logoSrc: kept ? src : null, logoPaletteId });
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
    const colours = chosen
      ? es["questionnaire.step1.logo.help.palette"].replace(
          "{palette}",
          tokensEs[chosen.nameKey as keyof typeof tokensEs] ?? chosen.id,
        )
      : es["questionnaire.step1.logo.help.noPalette"];
    // And whether the mark itself will be on the site: kept, or not kept and why (ADR 0059).
    return `${colours} ${
      answers.logoSrc === null
        ? es["questionnaire.step1.logo.notKept"]
        : es["questionnaire.step1.logo.kept"]
    }`;
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
            {rejection ? <FieldError>{rejection}</FieldError> : null}
          </div>
          <label
            htmlFor="logo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 42,
              padding: "9px 18px",
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
            // The three raster formats and nothing else, which is a filter on the picker and not a
            // check; `prepareLogo` reads the bytes, and an SVG dropped in anyway is refused by name.
            accept={ACCEPTED_IMAGE_ACCEPT}
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
