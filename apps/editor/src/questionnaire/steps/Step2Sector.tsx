"use client";

import { type Answers, SECTOR_IDS, type SectorId } from "@retorika/generator";
import { useMemo, useState } from "react";
import es from "../../locales/es.json" with { type: "json" };
import {
  Card,
  ChoiceCard,
  FieldError,
  NavRow,
  ProgressDots,
  TextField,
  TitleBlock,
} from "../ui.tsx";

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("es");
}

export function Step2Sector({
  answers,
  update,
  onNext,
  onBack,
}: {
  answers: Answers;
  update: (patch: Partial<Answers>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const visible = useMemo(() => {
    const needle = fold(query.trim());
    if (needle === "") return SECTOR_IDS;
    return SECTOR_IDS.filter((id) =>
      fold(es[`questionnaire.sector.${id}` as keyof typeof es]).includes(needle),
    );
  }, [query]);

  const otherDescriptionInvalid =
    submitted && answers.sector === "otro" && answers.otherSectorDescription.trim() === "";
  const noSectorChosen = submitted && answers.sector === null;

  function handleNext() {
    if (answers.sector === null) {
      setSubmitted(true);
      return;
    }
    if (answers.sector === "otro" && answers.otherSectorDescription.trim() === "") {
      setSubmitted(true);
      return;
    }
    onNext();
  }

  return (
    <Card width={920}>
      <ProgressDots current={2} />
      <TitleBlock
        step={es["questionnaire.step2.step"]}
        title={es["questionnaire.step2.title"]}
        subtitle={es["questionnaire.step2.subtitle"]}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 54,
          boxSizing: "border-box",
          padding: "0 18px",
          background: "#F6F8FB",
          border: "1px solid #E3E8F0",
          borderRadius: 11,
        }}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#94A3B8"
          strokeWidth={2}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.6-3.6" />
        </svg>
        <TextField
          id="buscar"
          label={es["questionnaire.step2.search.label"]}
          height={0}
          variant="muted"
          placeholder={es["questionnaire.step2.search.placeholder"]}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ flexGrow: 1, border: 0, background: "transparent", padding: 0, height: "auto" }}
        />
      </div>

      {answers.sector === "otro" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "14px 16px",
            background: "#FFF8EC",
            border: "1px solid #F4DDB4",
            borderRadius: 11,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#B4740B"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span style={{ fontSize: 14, lineHeight: 1.45, color: "#7A5008" }}>
            {answers.otherSectorDescription.trim() !== ""
              ? es["questionnaire.step2.other.warning"].replace(
                  "{sector}",
                  answers.otherSectorDescription,
                )
              : es["questionnaire.step2.other.warning.generic"]}
          </span>
        </div>
      ) : null}

      <fieldset
        style={{
          margin: 0,
          padding: 0,
          border: 0,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 13,
        }}
      >
        <legend
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          {es["questionnaire.step2.fieldset.label"]}
        </legend>
        {visible.map((id) => (
          <ChoiceCard
            key={id}
            name="sector"
            value={id}
            label={es[`questionnaire.sector.${id}` as keyof typeof es]}
            selected={answers.sector === id}
            onSelect={() => update({ sector: id })}
          />
        ))}
        <ChoiceCard
          name="sector"
          value="otro"
          label={es["questionnaire.sector.otro"]}
          selected={answers.sector === "otro"}
          onSelect={() => update({ sector: "otro" as SectorId })}
          dashed
          fullWidth={answers.sector === "otro"}
        />
      </fieldset>

      {noSectorChosen ? <FieldError>{es["questionnaire.step2.error"]}</FieldError> : null}

      {answers.sector === "otro" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <label htmlFor="describe" style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>
            {es["questionnaire.step2.other.label"]}
          </label>
          <TextField
            id="describe"
            label={es["questionnaire.step2.other.label"]}
            height={56}
            variant={otherDescriptionInvalid ? "error" : "primary"}
            placeholder={es["questionnaire.step2.other.placeholder"]}
            value={answers.otherSectorDescription}
            onChange={(event) => update({ otherSectorDescription: event.target.value })}
          />
          {otherDescriptionInvalid ? (
            <FieldError>{es["questionnaire.step2.other.error"]}</FieldError>
          ) : (
            <span style={{ fontSize: 13, color: "#5B6B82" }}>
              {es["questionnaire.step2.other.help"]}
            </span>
          )}
        </div>
      ) : null}

      <NavRow
        backLabel={es["questionnaire.nav.back"]}
        onBack={onBack}
        primaryLabel={es["questionnaire.nav.next"]}
        onPrimary={handleNext}
      />
    </Card>
  );
}
