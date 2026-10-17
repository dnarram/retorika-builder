import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import es from "../locales/es.json" with { type: "json" };

/**
 * The questionnaire's shared visual pieces, transcribed from the seven approved mockups
 * (`docs/design/mockups/01`–`05`, `09`, `10`). Values here are read directly off those files,
 * not redesigned — the mockups are the interface specification (protocol Part 14).
 *
 * One deliberate exception: the mockups' muted text colours, `#94A3B8` on white and `#A3AEC0`
 * on `#F5F7FA`, measure 2.56:1 and 2.08:1 — both fail WCAG AA's 4.5:1 for normal text, caught by
 * axe on this build (not part of día 2's planned scope, checked anyway since the tooling was
 * already running). `#5B6B82` replaces both: 5.43:1 and 5.06:1 on the same two backgrounds, one
 * tone instead of two thresholds to track.
 *
 * **The note used to end «icon strokes at `#94A3B8` are untouched — non-text graphics answer to a
 * 3:1 rule, which that value already clears», and that last clause was wrong.** On white it
 * measures 2.56:1 and clears neither 4.5 nor 3. It clears 3:1 only on a dark surface, which is
 * where the one remaining use of it lives: the persistent toast's dismiss icon on `#0F172A`, at
 * 6.96:1. Corrected 17 October 2026, when the same value turned up failing in two canvas text
 * rules and in a dialog's close icon on white; `chromeContrast.test.ts` now refuses it instead of
 * describing it.
 */

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
};

export function VisuallyHiddenLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} style={visuallyHidden}>
      {children}
    </label>
  );
}

/**
 * The one button shape for the screens that have no mockup — sign in, the account dialog, «Tu
 * cuenta», the landing's «Empezar» (ADR 0034 §20 makes the ADR their specification).
 *
 * **Why this exists: five copies of a button style, every one able to put its own text outside its
 * own border.** Measured on 5 October 2026 after David reported seeing exactly that. Each copy set
 * a fixed `height` with **zero horizontal padding**, and a `<button>` wraps its text by default —
 * so a label too wide for the box grew downwards while the border did not, and the second and
 * third lines were painted outside it. At 320px a `Card` leaves 96px of room, and in 96px the real
 * labels spilled **19 to 46 pixels** past the bottom edge:
 *
 * ```
 * AccountPage.secondary       · "Descargar una copia de mis webs"  botón 46px, texto 64px
 * SaveToAccountDialog.primary · "Descargar una copia de mis webs"  botón 48px, texto 92px
 * forms.buttonStyle           · "Descargar una copia de mis webs"  botón 54px, texto 97px
 * ```
 *
 * Three properties make that impossible rather than unlikely, and all three are the point:
 *
 * - **`minHeight`, never `height`.** A label that needs two lines makes the button taller. Text
 *   cannot leave a box that grows to hold it, which is the only fix that does not depend on
 *   guessing how long a translation will be.
 * - **Real horizontal padding.** Text that starts at the border reads as outside it even when it
 *   is not, and padding is what gives a wrap somewhere to happen before the edge.
 * - **`inline-flex` with both axes centred**, so one line and three lines are both centred rather
 *   than one centred and the other starting at the top.
 *
 * `NavRow`'s own buttons were left alone for being faithful to the approved mockups, which grow
 * sideways instead of clipping — until sprint 21 day 1 measured them on a phone, where there is no
 * sideways to grow into. They hold their `minHeight` now like everything else.
 */
const buttonBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  boxSizing: "border-box",
  width: "100%",
  minHeight: 48,
  padding: "11px 18px",
  borderRadius: 12,
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1.25,
  cursor: "pointer",
  border: "none",
} as const;

/** The affirmative one: «Entrar», «Crear la cuenta y guardar». */
export const primaryButton = {
  ...buttonBase,
  background: "var(--ui-brand)",
  color: "var(--ui-surface)",
} as const;

/** Everything else: «Cerrar», «Volver», «Usar mi cuenta de Google». */
export const secondaryButton = {
  ...buttonBase,
  background: "var(--ui-surface)",
  color: "#1F2937",
  border: "1px solid #D4DCE7",
} as const;

/** The one that destroys something, and reads like it. */
export const dangerButton = {
  ...buttonBase,
  background: "#BE123C",
  color: "var(--ui-surface)",
} as const;

/** Sized to its own text rather than stretched — for a button sitting in a row beside others. */
export const compactButton = {
  ...buttonBase,
  width: "auto",
  minHeight: 40,
  padding: "9px 16px",
  fontSize: 14,
} as const;

/**
 * Retorika naming itself: the full lockup, mark and wordmark in one image.
 *
 * **The rule for which logo goes where, so the next placement does not have to re-decide it:** the
 * lockup where Retorika is naming itself and has horizontal room — this header, and the landing.
 * The mark alone where something else is already named or where it must read small — the editor's
 * top bar, which sits beside the *business's* own name and would otherwise have two names fighting,
 * and the browser tab.
 *
 * This used to be a gradient square with a letter R drawn in CSS, because no logo file existed in
 * the repository at all. The official one arrived on 5 October 2026 and
 * `scripts/brand-assets.ts` is what turns the delivered PNGs into what is served here.
 *
 * `<img>` rather than `next/image`: a fixed-size logo gains nothing from the optimiser, and the
 * one `<img>` already in this application set that precedent.
 */
export function Brand() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        padding: "26px 34px",
        display: "flex",
        alignItems: "center",
      }}
    >
      <img
        src="/brand/retorika-lockup.svg"
        alt={es["brand.name"]}
        width={190}
        height={54}
        style={{ display: "block", height: "auto" }}
      />
    </div>
  );
}

export function Shell({ caption, children }: { caption?: string; children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "var(--ui-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Brand />
      <div
        style={{
          flexGrow: 1,
          boxSizing: "border-box",
          /**
           * **`clamp` rather than a flat 60px, and this is half the overflow fix.**
           *
           * `Shell` took 120px of horizontal padding and `Card` another 104px at every viewport —
           * 224px regardless of the screen. Measured at 320px that left a card, and therefore a
           * button, **96 pixels wide**, which is what forced every long label to wrap in the first
           * place. A phone now keeps its padding proportional and gets about 250px of usable room;
           * a desktop is unchanged at 60px.
           */
          padding: "0 clamp(16px, 6vw, 60px) 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
        }}
      >
        {children}
        {caption ? (
          <span style={{ fontSize: 15, color: "var(--ui-muted)", textAlign: "center" }}>
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ProgressDots({ current }: { current: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 7 }}>
      {[1, 2, 3, 4, 5].map((step) => (
        <span
          key={step}
          /* `ui-slide` carries the width and the colour: the dots were the one thing on these five
             screens that already changed between steps and did it by redrawing. The bar for the
             step just left shrinks from 30 to 22 while the new one grows, which is the progress
             the row is for. `width` here reflows nothing — the dots are a flex row of five spans
             and the row's own size is fixed by the widest arrangement. */
          className="ui-slide"
          style={{
            width: step === current ? 30 : 22,
            height: 5,
            borderRadius: 3,
            background: step <= current ? "var(--ui-brand)" : "#DCE3ED",
          }}
        />
      ))}
    </div>
  );
}

export function TitleBlock({
  step,
  title,
  subtitle,
}: {
  /**
   * «Paso 3 de 5». Optional because the sign-in screens are not a step in anything: they are
   * where somebody comes back to a web they already have (ADR 0034 §2), and a counter above the
   * heading would promise a flow that does not exist.
   */
  step?: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {step ? (
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ui-muted)" }}>{step}</span>
      ) : null}
      <h1
        style={{
          margin: 0,
          // Fluid between a phone and the mockups' 36px, so a question never breaks mid-word.
          fontSize: "clamp(26px, 7vw, 36px)",
          lineHeight: 1.15,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--ui-ink)",
          textAlign: "center",
        }}
      >
        {title}
      </h1>
      <p style={{ margin: 0, fontSize: 16, color: "#64748B", textAlign: "center" }}>{subtitle}</p>
    </div>
  );
}

export function Card({
  width,
  gap = 20,
  children,
}: {
  width: number;
  gap?: number;
  children: ReactNode;
}) {
  return (
    <div
      /* **The card arrives, once per question.** `Questionnaire.tsx` renders one step at a time,
         so a new card is mounted on every «Siguiente» and the entrance plays for each question
         rather than once for the whole flow. `ui-reveal` fills `backwards`, so it holds nothing
         after it lands — see `globals.css`. */
      className="ui-reveal"
      style={{
        width,
        maxWidth: "100%",
        boxSizing: "border-box",
        // The other half: see `Shell` above. 52px on a desktop, 16px on a phone.
        padding: "34px clamp(16px, 5vw, 52px) 28px",
        background: "var(--ui-surface)",
        borderRadius: 20,
        boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {children}
    </div>
  );
}

/**
 * **How far down a staggered queue the delay keeps growing** (sprint 22).
 *
 * A grid reveals itself card by card at `--ui-stagger` apart, which reads as an order instead of a
 * flash. Unbounded, that is a queue: the eleven sectors of step 2 would put the last card 440ms
 * behind the first, and somebody who already knows which one they want would watch it arrive.
 *
 * Capped at seven, so the longest wait in the application is `7 × 40ms` and every screen is at
 * rest inside 600ms of mounting — the number `test/motionBudget.test.ts` holds and
 * `docs/design/REVIEW.md` writes down. Past the cap the cards share the last slot, which nobody
 * can tell apart from their own position in a queue they are not watching.
 */
export const REVEAL_STAGGER_CAP = 7;

/**
 * A card's place in the queue, as the style object the caller spreads into its own.
 *
 * `calc` on the token rather than arithmetic on 40, so the rhythm of the whole application stays
 * the one line in `globals.css` that declares it. And a **style object** rather than a string
 * because a custom property in an inline `style` is not in React's `CSSProperties`: every call
 * site would otherwise need `as React.CSSProperties`, which is a cast repeated for a reason that
 * has nothing to do with the call site. Spread, the cast lives here once.
 */
export function reveal(index: number): CSSProperties {
  return {
    "--ui-reveal-delay": `calc(var(--ui-stagger) * ${Math.min(index, REVEAL_STAGGER_CAP)})`,
  } as CSSProperties;
}

/**
 * The smallest text a field may have, in pixels, on any screen. 16 is the size below which Safari on
 * iOS zooms into a focused field (ADR 0042); it is applied everywhere rather than only on a phone
 * because a field that reads at 16 on a desktop was never too big.
 */
export const FIELD_FONT_FLOOR = 16;

const fieldBase: CSSProperties = {
  boxSizing: "border-box",
  padding: "0 20px",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  fontWeight: 500,
  color: "var(--ui-ink)",
  borderRadius: 12,
  outline: "none",
  width: "100%",
};

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  height?: number;
  fontSize?: number;
  /** A field the questionnaire itself fills is drawn with the "already answered" primary
   * border; an untouched optional field is drawn muted, matching the mockups exactly. */
  variant?: "primary" | "muted" | "error";
  /**
   * The questionnaire asks one question per screen, so its `TitleBlock` *is* the label and the
   * field's own is hidden — which is why this defaults to true and every mockup still matches.
   *
   * The sign-in screens are the first with two fields under one heading, and «Correo» and
   * «Contraseña» cannot both be inferred from a title. Those pass `false` and get a visible
   * label. Added rather than duplicated because three screens needed it at once.
   */
  labelHidden?: boolean;
}

export function TextField({
  id,
  label,
  height = 58,
  fontSize = 16,
  variant = "muted",
  labelHidden = true,
  style,
  ...props
}: TextFieldProps) {
  const borderByVariant: Record<string, string> = {
    primary: "2px solid var(--ui-brand)",
    muted: "1px solid #E3E8F0",
    error: "2px solid #E11D48",
  };
  const backgroundByVariant: Record<string, string> = {
    primary: "var(--ui-surface)",
    muted: "#F6F8FB",
    error: "#FFF9F9",
  };
  return (
    <>
      {labelHidden ? null : (
        <label
          htmlFor={id}
          style={{ fontSize: 14, fontWeight: 600, color: "#334155", marginBottom: -12 }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        style={{
          ...fieldBase,
          height,
          // Never below the floor, whatever a caller asks for: Safari on iOS zooms the whole page
          // into any field whose text is smaller than 16px, and un-zooming is on the owner. The
          // mobile harness measures the computed size of every visible field (ADR 0042).
          fontSize: Math.max(FIELD_FONT_FLOOR, fontSize),
          border: borderByVariant[variant],
          background: backgroundByVariant[variant],
          ...style,
        }}
        {...props}
      />
      {labelHidden ? <VisuallyHiddenLabel htmlFor={id}>{label}</VisuallyHiddenLabel> : null}
    </>
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <span
      /* **Opacity only, which is the whole reason this is `ui-fade-in` and not `ui-reveal`.** An
         error takes its space the instant it appears — that is honest, and it is what the e2e
         «el aviso reserva su sitio» measures — so only its ink arrives late. A `translateY` here
         would move a message somebody is already reading. */
      className="ui-fade-in"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 14,
        fontWeight: 500,
        color: "#BE123C",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#BE123C"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
      {children}
    </span>
  );
}

const checkmark = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#156FE7"
    strokeWidth={2.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export function ChoiceCard({
  name,
  value,
  label,
  selected,
  onSelect,
  dashed = false,
  fullWidth = false,
  index = 0,
}: {
  name: string;
  value: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  dashed?: boolean;
  fullWidth?: boolean;
  /** Its place in the grid, which is its place in the queue of arrivals. */
  index?: number;
}) {
  return (
    <label
      /* **The hover and the press, which no mockup drew** — «la maqueta 08 no tiene ni una regla
         `:hover` ni una `transition`. Ninguna de las diecinueve las tiene» (`REVIEW.md`). A pixel
         of lift and a shadow, behind `@media (hover: hover)` so a tap does not leave a card
         looking chosen. `transform` touches no layout, so the grid walk that caught a card moving
         6.5px under the pointer on sprint 21 day 1 measures exactly what it measured then. */
      className="ui-choice ui-reveal ui-interactive ui-lift"
      style={{
        ...reveal(index),
        display: "flex",
        alignItems: "center",
        gap: 10,
        // `minHeight`, never `height`: on a 390px phone «Que me manden un correo» needs three
        // lines, and a box that cannot grow paints two of them outside itself (sprint 21 day 1).
        minHeight: 56,
        boxSizing: "border-box",
        padding: "10px 16px",
        gridColumn: fullWidth ? "1 / -1" : undefined,
        background: selected ? "#F1F7FE" : "var(--ui-surface)",
        border: selected
          ? "2px solid var(--ui-brand)"
          : dashed
            ? "1px dashed #C9D4E2"
            : "1px solid #E3E8F0",
        borderRadius: 11,
        cursor: "pointer",
      }}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        style={visuallyHidden}
      />
      <span
        style={{
          flexGrow: 1,
          fontSize: 15,
          fontWeight: selected ? 600 : 500,
          color: selected ? "var(--ui-brand)" : "#334155",
        }}
      >
        {label}
      </span>
      {/* The tick's room is reserved whether or not it shows, the way `Step2Sector`'s warning
          reserves its own. Once the box could grow (`minHeight`), a tick that appeared only on
          selection took 28px from the label, wrapped «Restaurante y bar» onto a second line, and
          made the chosen card — and the whole centred step — taller by a line: CI's grid walk
          caught the card moving 6.5px under the pointer on sprint 21 day 1. Now choosing changes
          colours and nothing that measures. */}
      <span
        aria-hidden="true"
        /* `key` so React mounts a new span when the state flips, which is what makes a keyframe
           entrance play at all — an element that was already there has no mount to animate on.
           The reserved `visibility` box above is untouched, so nothing that measures changes. */
        key={selected ? "on" : "off"}
        className={selected ? "ui-fade-in" : undefined}
        style={{
          display: "inline-flex",
          flexShrink: 0,
          visibility: selected ? "visible" : "hidden",
        }}
      >
        {checkmark}
      </span>
    </label>
  );
}

export function CheckboxCard({
  label,
  checked,
  onChange,
  index = 0,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Its place in the list, which is its place in the queue of arrivals. */
  index?: number;
}) {
  return (
    <label
      className="ui-choice ui-reveal ui-interactive ui-lift"
      style={{
        ...reveal(index),
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 58,
        boxSizing: "border-box",
        padding: "10px 17px",
        background: "var(--ui-surface)",
        border: "1px solid #E3E8F0",
        borderRadius: 11,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: 19, height: 19, margin: 0, accentColor: "var(--ui-brand)" }}
      />
      <span style={{ fontSize: 15, fontWeight: 500, color: "#334155" }}>{label}</span>
    </label>
  );
}

export function NavRow({
  onBack,
  onSkip,
  skipLabel,
  primaryLabel,
  onPrimary,
  primaryEnabled = true,
  backLabel,
}: {
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  primaryEnabled?: boolean;
  backLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingTop: 10,
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          /**
           * The colour lives in the classes rather than in `style`, because this is the one place
           * in this file where it has to *change*: an inline `color` wins over any rule, so a
           * `:hover` written as CSS would transition nothing and the transition would be a lie.
           * `hover:` is already behind `@media (hover: hover)` in Tailwind v4, for the same reason
           * `ui-lift` is.
           */
          className="ui-interactive text-ui-muted hover:text-ui-ink"
          style={{
            font: "inherit",
            fontSize: 15,
            fontWeight: 500,
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
          }}
        >
          {backLabel}
        </button>
      ) : (
        <span style={{ fontSize: 15, fontWeight: 500, color: "var(--ui-muted)" }}>{backLabel}</span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="ui-interactive text-ui-muted hover:text-ui-ink"
            style={{
              font: "inherit",
              fontSize: 15,
              fontWeight: 500,
              background: "none",
              border: 0,
              padding: 0,
              cursor: "pointer",
            }}
          >
            {skipLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPrimary}
          disabled={!primaryEnabled}
          /* `:not(:disabled)` inside `ui-lift` is what keeps «Siguiente» still while it is not
             answerable: a disabled button that rises to the pointer is an invitation it cannot
             honour. */
          className="ui-interactive ui-lift"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 50,
            padding: "12px 34px",
            background: primaryEnabled ? "var(--ui-brand)" : "#B9CDEA",
            color: "var(--ui-surface)",
            fontSize: 15,
            fontWeight: 600,
            border: 0,
            borderRadius: 11,
            cursor: primaryEnabled ? "pointer" : "not-allowed",
          }}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
