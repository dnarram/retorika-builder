"use client";

import { type Answers, EMPTY_ANSWERS } from "@retorika/generator";
import { useState } from "react";
import es from "../locales/es.json" with { type: "json" };
import { Step1Name } from "./steps/Step1Name.tsx";
import { Step2Sector } from "./steps/Step2Sector.tsx";
import { Step3Services } from "./steps/Step3Services.tsx";
import { Step4Location } from "./steps/Step4Location.tsx";
import { Step5Action } from "./steps/Step5Action.tsx";
import { Shell } from "./ui.tsx";
import { Variants } from "./Variants.tsx";

/**
 * The five-question flow, held in memory only. No account, no persistence: closing the tab
 * loses it, which is the honest state of this slice (protocol Part 14, Fase 1 note amended by
 * ADR 0017). Submitting hands the answers to `@retorika/generator`'s three real variants
 * (day 4) — there is no account to save progress to, so restarting is the only way back.
 */
export function Questionnaire() {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);

  function update(patch: Partial<Answers>) {
    setAnswers((current) => ({ ...current, ...patch }));
  }

  function restart() {
    setAnswers(EMPTY_ANSWERS);
    setStep(1);
    setDone(false);
  }

  if (done) {
    return <Variants answers={answers} onRestart={restart} />;
  }

  const footerCaption =
    es[`questionnaire.footer.step${step}` as keyof typeof es] ?? es["questionnaire.footer.tagline"];

  return (
    <Shell caption={footerCaption}>
      {step === 1 && <Step1Name answers={answers} update={update} onNext={() => setStep(2)} />}
      {step === 2 && (
        <Step2Sector
          answers={answers}
          update={update}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <Step3Services
          answers={answers}
          update={update}
          onNext={() => setStep(4)}
          onSkip={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && (
        <Step4Location
          answers={answers}
          update={update}
          onNext={() => setStep(5)}
          onSkip={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      )}
      {step === 5 && (
        <Step5Action
          answers={answers}
          update={update}
          onSubmit={() => setDone(true)}
          onBack={() => setStep(4)}
        />
      )}
    </Shell>
  );
}
