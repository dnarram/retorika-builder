"use client";

import { suggestionsFor } from "@retorika/copybank";
import { useState } from "react";
import es from "../../locales/es.json" with { type: "json" };
import type { Answers } from "../types.ts";
import { Card, CheckboxCard, NavRow, ProgressDots, TextField, TitleBlock } from "../ui.tsx";

export function Step3Services({
  answers,
  update,
  onNext,
  onSkip,
  onBack,
}: {
  answers: Answers;
  update: (patch: Partial<Answers>) => void;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [ownService, setOwnService] = useState("");
  // The words come from the bank, not from here: the same string is a tick box now and a
  // card title on the published site, so it is content and lives in @retorika/copybank.
  const suggestions = suggestionsFor(answers.sector ?? "");
  const isSuggested = (label: string) => suggestions.some((s) => s.title === label);

  function toggle(label: string, checked: boolean) {
    update({
      services: checked
        ? [...answers.services, label]
        : answers.services.filter((s) => s !== label),
    });
  }

  function addOwnService() {
    const value = ownService.trim();
    if (value === "" || answers.services.includes(value)) return;
    update({ services: [...answers.services, value] });
    setOwnService("");
  }

  return (
    <Card width={900}>
      <ProgressDots current={3} />
      <TitleBlock
        step={es["questionnaire.step3.step"]}
        title={es["questionnaire.step3.title"]}
        subtitle={es["questionnaire.step3.subtitle"]}
      />

      {suggestions.length > 0 ? (
        <fieldset
          style={{
            margin: 0,
            padding: 0,
            border: 0,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
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
            {es["questionnaire.step3.fieldset.label"]}
          </legend>
          {suggestions.map((suggestion) => (
            <CheckboxCard
              key={suggestion.id}
              label={suggestion.title}
              checked={answers.services.includes(suggestion.title)}
              onChange={(checked) => toggle(suggestion.title, checked)}
            />
          ))}
        </fieldset>
      ) : (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#64748B" }}>
          {es["questionnaire.step3.empty"]}
        </p>
      )}

      {answers.services.filter((s) => !isSuggested(s)).length > 0 ? (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {answers.services
            .filter((s) => !isSuggested(s))
            .map((label) => (
              <li
                key={label}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 36,
                  padding: "0 8px 0 14px",
                  background: "#F1F7FE",
                  color: "#156FE7",
                  fontSize: 14,
                  fontWeight: 500,
                  borderRadius: 9,
                }}
              >
                {label}
                <button
                  type="button"
                  onClick={() => update({ services: answers.services.filter((s) => s !== label) })}
                  aria-label={`Quitar ${label}`}
                  style={{
                    font: "inherit",
                    color: "inherit",
                    background: "none",
                    border: 0,
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    padding: 4,
                  }}
                >
                  ×
                </button>
              </li>
            ))}
        </ul>
      ) : null}

      <div style={{ display: "flex", gap: 12 }}>
        <TextField
          id="propio"
          label={es["questionnaire.step3.own.label"]}
          height={54}
          fontSize={15}
          variant="muted"
          placeholder={es["questionnaire.step3.own.placeholder"]}
          value={ownService}
          onChange={(event) => setOwnService(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addOwnService();
            }
          }}
          style={{ flexGrow: 1, width: "auto" }}
        />
        <button
          type="button"
          onClick={addOwnService}
          style={{
            height: 54,
            padding: "0 22px",
            fontFamily: "var(--font-inter), system-ui, sans-serif",
            fontSize: 15,
            fontWeight: 600,
            color: "#156FE7",
            background: "#FFFFFF",
            border: "1px solid #D5DEE9",
            borderRadius: 11,
            cursor: "pointer",
          }}
        >
          {es["questionnaire.step3.own.add"]}
        </button>
      </div>

      <NavRow
        backLabel={es["questionnaire.nav.back"]}
        onBack={onBack}
        onSkip={onSkip}
        skipLabel={es["questionnaire.nav.skip"]}
        primaryLabel={es["questionnaire.nav.next"]}
        onPrimary={onNext}
      />
    </Card>
  );
}
