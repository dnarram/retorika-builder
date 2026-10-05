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
 * tone instead of two thresholds to track. Icon strokes at `#94A3B8` are untouched — non-text
 * graphics answer to a 3:1 rule, which that value already clears.
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
 * `NavRow`'s own buttons are deliberately left alone: they are faithful to the approved mockups,
 * and they do not have this defect — they grow sideways instead of clipping.
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
export const primaryButton = { ...buttonBase, background: "#156FE7", color: "#FFFFFF" } as const;

/** Everything else: «Cerrar», «Volver», «Usar mi cuenta de Google». */
export const secondaryButton = {
  ...buttonBase,
  background: "#FFFFFF",
  color: "#1F2937",
  border: "1px solid #D4DCE7",
} as const;

/** The one that destroys something, and reads like it. */
export const dangerButton = { ...buttonBase, background: "#BE123C", color: "#FFFFFF" } as const;

/** Sized to its own text rather than stretched — for a button sitting in a row beside others. */
export const compactButton = {
  ...buttonBase,
  width: "auto",
  minHeight: 40,
  padding: "9px 16px",
  fontSize: 14,
} as const;

export function Brand() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        padding: "26px 34px",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          background: "linear-gradient(135deg, #2B9BF4, #1554D8)",
          borderRadius: 10,
          color: "#FFFFFF",
          fontSize: 18,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        R
      </span>
      <span style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>
        {es["brand.name"]}
      </span>
    </div>
  );
}

export function Shell({ caption, children }: { caption?: string; children: ReactNode }) {
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
          <span style={{ fontSize: 15, color: "#5B6B82", textAlign: "center" }}>{caption}</span>
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
          style={{
            width: step === current ? 30 : 22,
            height: 5,
            borderRadius: 3,
            background: step <= current ? "#156FE7" : "#DCE3ED",
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
        <span style={{ fontSize: 14, fontWeight: 500, color: "#5B6B82" }}>{step}</span>
      ) : null}
      <h1
        style={{
          margin: 0,
          fontSize: 36,
          lineHeight: 1.15,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "#0F172A",
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
      style={{
        width,
        maxWidth: "100%",
        boxSizing: "border-box",
        // The other half: see `Shell` above. 52px on a desktop, 16px on a phone.
        padding: "34px clamp(16px, 5vw, 52px) 28px",
        background: "#FFFFFF",
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

const fieldBase: CSSProperties = {
  boxSizing: "border-box",
  padding: "0 20px",
  fontFamily: "var(--font-inter), system-ui, sans-serif",
  fontWeight: 500,
  color: "#0F172A",
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
    primary: "2px solid #156FE7",
    muted: "1px solid #E3E8F0",
    error: "2px solid #E11D48",
  };
  const backgroundByVariant: Record<string, string> = {
    primary: "#FFFFFF",
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
          fontSize,
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
}: {
  name: string;
  value: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  dashed?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: selected ? 10 : 0,
        height: 56,
        boxSizing: "border-box",
        padding: "0 16px",
        gridColumn: fullWidth ? "1 / -1" : undefined,
        background: selected ? "#F1F7FE" : "#FFFFFF",
        border: selected
          ? "2px solid #156FE7"
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
          color: selected ? "#156FE7" : "#334155",
        }}
      >
        {label}
      </span>
      {selected ? checkmark : null}
    </label>
  );
}

export function CheckboxCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: 58,
        boxSizing: "border-box",
        padding: "0 17px",
        background: "#FFFFFF",
        border: "1px solid #E3E8F0",
        borderRadius: 11,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        style={{ width: 19, height: 19, margin: 0, accentColor: "#156FE7" }}
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
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 10,
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          style={{
            font: "inherit",
            fontSize: 15,
            fontWeight: 500,
            color: "#5B6B82",
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
          }}
        >
          {backLabel}
        </button>
      ) : (
        <span style={{ fontSize: 15, fontWeight: 500, color: "#5B6B82" }}>{backLabel}</span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            style={{
              font: "inherit",
              fontSize: 15,
              fontWeight: 500,
              color: "#5B6B82",
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
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 50,
            padding: "0 34px",
            background: primaryEnabled ? "#156FE7" : "#B9CDEA",
            color: "#FFFFFF",
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
