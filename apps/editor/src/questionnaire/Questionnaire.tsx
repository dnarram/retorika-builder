"use client";

import { type Answers, EMPTY_ANSWERS } from "@retorika/generator";
import type { RetorikaDocument } from "@retorika/schema";
import { useEffect, useState } from "react";
import { clearSession, loadSession } from "../editor/autosave.ts";
import es from "../locales/es.json" with { type: "json" };
import { Step1Name } from "./steps/Step1Name.tsx";
import { Step2Sector } from "./steps/Step2Sector.tsx";
import { Step3Services } from "./steps/Step3Services.tsx";
import { Step4Location } from "./steps/Step4Location.tsx";
import { Step5Action } from "./steps/Step5Action.tsx";
import { Shell } from "./ui.tsx";
import { Variants } from "./Variants.tsx";

interface Restored {
  answers: Answers;
  documents: RetorikaDocument[];
  openIndex: number | null;
}

/**
 * The five-question flow itself is still held in memory only: closing the tab mid-questionnaire
 * loses it, and that stays the honest state of this slice (protocol Part 14, Fase 1 note amended
 * by ADR 0017) — there is no case for persisting an answer nobody has generated anything from
 * yet. What day 3 changes is what happens *after* submitting: `Variants` now saves the editing
 * session to this browser's `localStorage` (see `editor/autosave.ts`), and this component's job
 * is to look for one on mount and, if it finds one, skip the questionnaire entirely and open
 * straight into it.
 *
 * That check runs in an effect, never during the render itself: this is a client component with
 * no server data, so the first render — server and client alike — has to stay `step 1` for
 * hydration to match, and only after mount is it safe to reach for `localStorage` and switch.
 * The gap is a single check of already-parsed JSON against a few small documents, not a network
 * round trip, so nothing meaningful is asked to wait on it.
 */
export function Questionnaire() {
  const [restoring, setRestoring] = useState(true);
  const [restored, setRestored] = useState<Restored | null>(null);

  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setRestored({
        answers: { ...EMPTY_ANSWERS, ...session.answers },
        documents: session.documents,
        openIndex: session.openIndex,
      });
      setDone(true);
    }
    setRestoring(false);
    // Runs once, on mount: this is a one-time check of what was there when the page loaded, not
    // a subscription to storage changes.
  }, []);

  function update(patch: Partial<Answers>) {
    setAnswers((current) => ({ ...current, ...patch }));
  }

  function restart() {
    clearSession();
    setRestored(null);
    setAnswers(EMPTY_ANSWERS);
    setStep(1);
    setDone(false);
  }

  if (restoring) return null;

  if (done) {
    return restored ? (
      <Variants
        answers={restored.answers}
        initialDocuments={restored.documents}
        initialOpenIndex={restored.openIndex}
        onRestart={restart}
      />
    ) : (
      <Variants answers={answers} onRestart={restart} />
    );
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
