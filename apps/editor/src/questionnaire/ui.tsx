import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";

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
        Retorika Builder
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
          padding: "0 60px 40px 60px",
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
  step: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: "#5B6B82" }}>{step}</span>
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
        padding: "34px 52px 28px 52px",
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
}

export function TextField({
  id,
  label,
  height = 58,
  fontSize = 16,
  variant = "muted",
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
      <VisuallyHiddenLabel htmlFor={id}>{label}</VisuallyHiddenLabel>
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
