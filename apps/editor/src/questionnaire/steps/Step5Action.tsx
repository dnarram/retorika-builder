"use client";

import { useState } from "react";
import es from "../../locales/es.json" with { type: "json" };
import type { Answers, MainAction } from "../types.ts";
import {
  Card,
  ChoiceCard,
  FieldError,
  NavRow,
  ProgressDots,
  TextField,
  TitleBlock,
} from "../ui.tsx";

const ACTIONS: { id: MainAction; labelKey: keyof typeof es }[] = [
  { id: "call", labelKey: "questionnaire.action.call" },
  { id: "book", labelKey: "questionnaire.action.book" },
  { id: "message", labelKey: "questionnaire.action.message" },
  { id: "email", labelKey: "questionnaire.action.email" },
  { id: "visit", labelKey: "questionnaire.action.visit" },
];

/**
 * No "Saltar" here, deliberately: the approved mockup (05) does not draw one, unlike 03 and 04,
 * which both carry one and say what skipping costs. This is a real difference in the mockup,
 * not an omission — REVIEW.md's own summary says all of questions 3–5 have a skip button, which
 * this file's source mockup contradicts; the mockup wins, being the interface specification. So
 * a main action is required here, with the same attempt-then-error pattern as steps 1 and 2, and
 * this note stays as long as that summary is wrong.
 */
export function Step5Action({
  answers,
  update,
  onSubmit,
  onBack,
}: {
  answers: Answers;
  update: (patch: Partial<Answers>) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const noActionChosen = submitted && answers.mainAction === null;

  // Each action needs somewhere to send the visitor, or the button the generator builds has
  // nothing to point at. "Que vengan al local" is the one exception: it names no destination of
  // its own (docs/tasks/generator.md records why), so nothing is required for it.
  const destinationMissing =
    submitted &&
    ((answers.mainAction === "call" && answers.phone.trim() === "") ||
      (answers.mainAction === "message" && answers.whatsapp.trim() === "") ||
      (answers.mainAction === "email" && answers.email.trim() === "") ||
      (answers.mainAction === "book" && answers.bookingLink.trim() === ""));

  function handleSubmit() {
    if (answers.mainAction === null) {
      setSubmitted(true);
      return;
    }
    const needsDestination =
      (answers.mainAction === "call" && answers.phone.trim() === "") ||
      (answers.mainAction === "message" && answers.whatsapp.trim() === "") ||
      (answers.mainAction === "email" && answers.email.trim() === "") ||
      (answers.mainAction === "book" && answers.bookingLink.trim() === "");
    if (needsDestination) {
      setSubmitted(true);
      return;
    }
    onSubmit();
  }

  return (
    <Card width={900}>
      <ProgressDots current={5} />
      <TitleBlock
        step={es["questionnaire.step5.step"]}
        title={es["questionnaire.step5.title"]}
        subtitle={es["questionnaire.step5.subtitle"]}
      />

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
          {es["questionnaire.step5.fieldset.label"]}
        </legend>
        {ACTIONS.map(({ id, labelKey }) => (
          <ChoiceCard
            key={id}
            name="accion"
            value={id}
            label={es[labelKey]}
            selected={answers.mainAction === id}
            onSelect={() => update({ mainAction: id })}
          />
        ))}
      </fieldset>

      {answers.mainAction === "book" ? (
        <div
          style={{
            padding: 20,
            background: "#F8FAFC",
            border: "1px solid #E3E8F0",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: 13,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: "#0F172A" }}>
            {es["questionnaire.step5.booking.title"]}
          </span>
          <TextField
            id="enlace"
            label={es["questionnaire.step5.booking.label"]}
            height={52}
            fontSize={15}
            variant={destinationMissing ? "error" : "muted"}
            placeholder={es["questionnaire.step5.booking.placeholder"]}
            value={answers.bookingLink}
            onChange={(event) => update({ bookingLink: event.target.value })}
            style={{ background: "#FFFFFF" }}
          />
          {destinationMissing ? <FieldError>{es["questionnaire.step5.error"]}</FieldError> : null}
          <label style={{ display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={answers.alsoPhone}
              onChange={(event) => update({ alsoPhone: event.target.checked })}
              style={{ width: 18, height: 18, margin: 0, accentColor: "#156FE7" }}
            />
            <span style={{ fontSize: 14, color: "#475569" }}>
              {es["questionnaire.step5.booking.alsoPhone"]}
            </span>
          </label>
          {answers.alsoPhone ? (
            <TextField
              id="telefono-reserva"
              label={es["questionnaire.step5.phone.label"]}
              height={52}
              fontSize={15}
              variant="muted"
              placeholder={es["questionnaire.step5.phone.placeholder"]}
              value={answers.phone}
              onChange={(event) => update({ phone: event.target.value })}
              style={{ background: "#FFFFFF" }}
            />
          ) : null}
        </div>
      ) : null}

      {answers.mainAction === "call" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <TextField
            id="telefono"
            label={es["questionnaire.step5.phone.label"]}
            height={54}
            fontSize={15}
            variant={destinationMissing ? "error" : "primary"}
            placeholder={es["questionnaire.step5.phone.placeholder"]}
            value={answers.phone}
            onChange={(event) => update({ phone: event.target.value })}
          />
          {destinationMissing ? (
            <FieldError>{es["questionnaire.step5.phone.error"]}</FieldError>
          ) : null}
        </div>
      ) : null}

      {answers.mainAction === "message" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <TextField
            id="whatsapp"
            label={es["questionnaire.step5.whatsapp.label"]}
            height={54}
            fontSize={15}
            variant={destinationMissing ? "error" : "primary"}
            placeholder={es["questionnaire.step5.whatsapp.placeholder"]}
            value={answers.whatsapp}
            onChange={(event) => update({ whatsapp: event.target.value })}
          />
          {destinationMissing ? (
            <FieldError>{es["questionnaire.step5.whatsapp.error"]}</FieldError>
          ) : null}
        </div>
      ) : null}

      {answers.mainAction === "email" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <TextField
            id="correo"
            type="email"
            label={es["questionnaire.step5.email.label"]}
            height={54}
            fontSize={15}
            variant={destinationMissing ? "error" : "primary"}
            placeholder={es["questionnaire.step5.email.placeholder"]}
            value={answers.email}
            onChange={(event) => update({ email: event.target.value })}
          />
          {destinationMissing ? (
            <FieldError>{es["questionnaire.step5.email.error"]}</FieldError>
          ) : null}
        </div>
      ) : null}

      {noActionChosen ? <FieldError>{es["questionnaire.step5.error"]}</FieldError> : null}

      <NavRow
        backLabel={es["questionnaire.nav.back"]}
        onBack={onBack}
        primaryLabel={es["questionnaire.nav.submit"]}
        onPrimary={handleSubmit}
        primaryEnabled={!noActionChosen && !destinationMissing}
      />
    </Card>
  );
}
