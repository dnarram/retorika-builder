"use client";

import es from "../../locales/es.json" with { type: "json" };
import type { Answers } from "../types.ts";
import { Card, NavRow, ProgressDots, TextField, TitleBlock } from "../ui.tsx";

export function Step4Location({
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
  return (
    <Card width={880} gap={22}>
      <ProgressDots current={4} />
      <TitleBlock
        step={es["questionnaire.step4.step"]}
        title={es["questionnaire.step4.title"]}
        subtitle={es["questionnaire.step4.subtitle"]}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 13, paddingTop: 4 }}>
        <TextField
          id="direccion"
          label={es["questionnaire.step4.address.label"]}
          height={58}
          fontSize={17}
          variant="primary"
          placeholder={es["questionnaire.step4.address.placeholder"]}
          value={answers.address}
          disabled={answers.noPremises}
          onChange={(event) => update({ address: event.target.value })}
        />
        <TextField
          id="horario"
          label={es["questionnaire.step4.hours.label"]}
          height={58}
          variant="muted"
          placeholder={es["questionnaire.step4.hours.placeholder"]}
          value={answers.hours}
          disabled={answers.noPremises}
          onChange={(event) => update({ hours: event.target.value })}
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 13,
          padding: 18,
          background: "#F8FAFC",
          border: "1px solid #E3E8F0",
          borderRadius: 12,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={answers.noPremises}
          onChange={(event) =>
            update(
              event.target.checked
                ? { noPremises: true, address: "", hours: "" }
                : { noPremises: false },
            )
          }
          style={{ width: 19, height: 19, margin: "1px 0 0 0", accentColor: "#156FE7" }}
        />
        <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>
            {es["questionnaire.step4.noPremises.title"]}
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: "#64748B" }}>
            {es["questionnaire.step4.noPremises.help"]}
          </span>
        </span>
      </label>

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
