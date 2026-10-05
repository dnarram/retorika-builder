"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import es from "../locales/es.json" with { type: "json" };
import { Card, FieldError, Shell, TextField, TitleBlock } from "../questionnaire/ui.tsx";
import { browserClient } from "./clients.ts";
import {
  type Reason,
  requestPasswordReset,
  setNewPassword,
  signInWithPassword,
  startGoogleSignIn,
} from "./operations.ts";

/**
 * The three screens for getting back in: sign in, ask for a reset mail, set a new password.
 *
 * **These are for coming back, not for getting in.** ADR 0034 §2 keeps the questionnaire
 * anonymous and offers the account at the end, so nobody is ever sent here on their way to making
 * a website — which is why «¿Todavía no tienes cuenta?» below points at starting a web rather
 * than at a sign-up form. There is no sign-up form on these screens on purpose.
 *
 * **On focus, and on what «Escape» means here.** Each screen puts the caret in its first field on
 * arrival, and a failed attempt moves focus to the message so a keyboard or screen-reader user
 * lands on the reason instead of hunting for it. What these screens do *not* do is bind Escape:
 * they are pages, and a page has nothing to escape from — binding it to navigation would throw
 * away a half-typed password on a stray keypress. The focus trap, the Escape key and the returned
 * focus belong to the dialog that offers the account at the end of the journey, which is day 4's,
 * and they are the same four requirements the five existing `aria-modal` dialogs still fail.
 */

const REASON_KEY: Record<Reason, keyof typeof es> = {
  invalid_credentials: "auth.error.invalid_credentials",
  rate_limited: "auth.error.rate_limited",
  weak_password: "auth.error.weak_password",
  expired_link: "auth.error.expired_link",
  already_registered: "auth.error.already_registered",
  needs_confirmation: "auth.error.needs_confirmation",
  unknown: "auth.error.unknown",
};

/**
 * A failure, wrapped in an object rather than held as a bare `Reason`.
 *
 * The wrapper is the whole trick: a second *identical* failure — pressing «Entrar» twice with the
 * same wrong password — produces a new object, so its identity changes even though its reason did
 * not, and the effect below runs again. A bare `Reason` would be `===` to the previous one and
 * announce nothing the second time. (The first version of this used a separate counter, and a
 * `useRef` counter at that, which is read during render and never re-triggers anything.)
 */
type Failure = { reason: Reason } | null;

/** Focus follows the failure, so the reason is where the keyboard already is. */
function useFocusOnFailure(failure: Failure, ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (failure) ref.current?.focus();
  }, [failure, ref]);
}

/** The message region every screen shares: announced when it changes, focusable when it is bad. */
function Message({
  tone,
  children,
  focusRef,
}: {
  tone: "bad" | "good";
  children: ReactNode;
  focusRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={focusRef}
      role={tone === "bad" ? "alert" : "status"}
      aria-live={tone === "bad" ? "assertive" : "polite"}
      tabIndex={-1}
      style={{ outlineOffset: 4 }}
    >
      {tone === "bad" ? (
        <FieldError>{children}</FieldError>
      ) : (
        <span style={{ fontSize: 14, fontWeight: 500, color: "#0F766E" }}>{children}</span>
      )}
    </div>
  );
}

const buttonStyle = {
  height: 54,
  borderRadius: 12,
  border: "none",
  background: "#156FE7",
  color: "#FFFFFF",
  fontSize: 17,
  fontWeight: 600,
  cursor: "pointer",
} as const;

const secondaryButtonStyle = {
  ...buttonStyle,
  background: "#FFFFFF",
  color: "#1F2937",
  border: "1px solid #D4DCE7",
} as const;

/** Shown when the deployment has no Supabase configured — honestly, and without pretending. */
function NotConfigured() {
  return <Message tone="bad">{es["auth.notConfigured"]}</Message>;
}

export function SignInForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // A reason arriving in the query string is the OAuth callback's way of reporting back, since a
  // redirect cannot carry React state.
  const [failure, setFailure] = useState<Failure>(
    params.get("error") ? { reason: params.get("error") as Reason } : null,
  );
  const messageRef = useRef<HTMLDivElement>(null);
  useFocusOnFailure(failure, messageRef);

  function fail(reason: Reason) {
    setFailure({ reason });
    setBusy(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) return;
    if (email.trim() === "") return fail("invalid_credentials");
    if (password === "") return fail("invalid_credentials");
    setBusy(true);
    const outcome = await signInWithPassword(browserClient(), email.trim(), password);
    if (!outcome.ok) return fail(outcome.reason);
    // `refresh` and not just `push`: the server components above have already rendered for a
    // visitor with no session, and the new cookies only mean something once they re-render.
    router.refresh();
    // **To the saved sites, not to the landing.** ADR 0034 §2 says this screen exists «for coming
    // back», and coming back means to the webs you saved — landing on a marketing page with an
    // «Empezar» button is the one destination that makes signing in feel like it did nothing.
    router.push("/mis-webs");
  }

  async function google() {
    if (!configured) return;
    setBusy(true);
    const started = await startGoogleSignIn(
      browserClient(),
      // Same destination as the password half above, for the same reason.
      `${window.location.origin}/auth/callback?next=/mis-webs`,
    );
    if ("url" in started) window.location.assign(started.url);
    else fail(started.reason);
  }

  return (
    <Shell>
      <Card width={520}>
        <TitleBlock title={es["auth.signIn.title"]} subtitle={es["auth.signIn.subtitle"]} />
        {configured ? null : <NotConfigured />}
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <TextField
            id="auth-email"
            label={es["auth.email.label"]}
            labelHidden={false}
            type="email"
            name="email"
            autoComplete="email"
            // The page's only purpose is this form, which is when putting the caret in the first
            // field is the right thing rather than a surprise.
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            id="auth-password"
            label={es["auth.password.label"]}
            labelHidden={false}
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {failure ? (
            <Message tone="bad" focusRef={messageRef}>
              {es[REASON_KEY[failure.reason]]}
            </Message>
          ) : null}
          <button type="submit" style={buttonStyle} disabled={busy || !configured}>
            {busy ? es["auth.signIn.working"] : es["auth.signIn.submit"]}
          </button>
        </form>
        <span style={{ textAlign: "center", fontSize: 14, color: "#64748B" }}>
          {es["auth.signIn.or"]}
        </span>
        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={google}
          disabled={busy || !configured}
        >
          {es["auth.signIn.google"]}
        </button>
        <Link href="/entrar/recuperar" style={{ fontSize: 14, color: "#156FE7" }}>
          {es["auth.signIn.forgot"]}
        </Link>
        <p style={{ margin: 0, fontSize: 14, color: "#64748B", lineHeight: 1.5 }}>
          {es["auth.signIn.noAccount"]}{" "}
          <Link href="/" style={{ color: "#156FE7" }}>
            {es["auth.signIn.start"]}
          </Link>
        </p>
      </Card>
    </Shell>
  );
}

export function ResetRequestForm({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  useFocusOnFailure(failure, messageRef);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    const outcome = await requestPasswordReset(
      browserClient(),
      email.trim(),
      `${window.location.origin}/entrar/nueva-contrasena`,
    );
    setBusy(false);
    // The same answer either way. Saying «no existe esa cuenta» would turn this form into a way
    // of finding out who has an account here.
    if (outcome.ok) setSent(true);
    else setFailure({ reason: outcome.reason });
  }

  return (
    <Shell>
      <Card width={520}>
        <TitleBlock title={es["auth.reset.title"]} subtitle={es["auth.reset.subtitle"]} />
        {configured ? null : <NotConfigured />}
        {sent ? (
          <Message tone="good">{es["auth.reset.sent"]}</Message>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <TextField
              id="auth-reset-email"
              label={es["auth.email.label"]}
              labelHidden={false}
              type="email"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {failure ? (
              <Message tone="bad" focusRef={messageRef}>
                {es[REASON_KEY[failure.reason]]}
              </Message>
            ) : null}
            <button type="submit" style={buttonStyle} disabled={busy || !configured}>
              {busy ? es["auth.reset.working"] : es["auth.reset.submit"]}
            </button>
          </form>
        )}
        <Link href="/entrar" style={{ fontSize: 14, color: "#156FE7" }}>
          {es["auth.back"]}
        </Link>
      </Card>
    </Shell>
  );
}

export function NewPasswordForm({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<Failure>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  useFocusOnFailure(failure, messageRef);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    const outcome = await setNewPassword(browserClient(), password);
    setBusy(false);
    if (outcome.ok) setDone(true);
    else setFailure({ reason: outcome.reason });
  }

  return (
    <Shell>
      <Card width={520}>
        <TitleBlock
          title={es["auth.newPassword.title"]}
          subtitle={es["auth.newPassword.subtitle"]}
        />
        {configured ? null : <NotConfigured />}
        {done ? (
          <>
            <Message tone="good">{es["auth.newPassword.done"]}</Message>
            <Link href="/entrar" style={{ fontSize: 14, color: "#156FE7" }}>
              {es["auth.signIn.submit"]}
            </Link>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <TextField
              id="auth-new-password"
              label={es["auth.newPassword.label"]}
              labelHidden={false}
              type="password"
              name="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {failure ? (
              <Message tone="bad" focusRef={messageRef}>
                {es[REASON_KEY[failure.reason]]}
              </Message>
            ) : null}
            <button type="submit" style={buttonStyle} disabled={busy || !configured}>
              {busy ? es["auth.newPassword.working"] : es["auth.newPassword.submit"]}
            </button>
          </form>
        )}
      </Card>
    </Shell>
  );
}
