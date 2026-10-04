"use client";

import type { RetorikaDocument } from "@retorika/schema";
import { useCallback, useEffect, useState } from "react";
import { browserClient } from "../auth/clients.ts";
import {
  type Reason,
  signInWithPassword,
  signUpWithPassword,
  startGoogleSignIn,
} from "../auth/operations.ts";
import es from "../locales/es.json" with { type: "json" };
import { FieldError, TextField } from "../questionnaire/ui.tsx";
import { createSite, listSites, renameOf } from "./sites.ts";
import { useFocusTrap } from "./useFocusTrap.ts";

/**
 * «Guarda tu web en tu cuenta» — the offer at the end of the journey.
 *
 * ADR 0034 §2, from the concept dossier: «La cuenta se crea al final, cuando ya tiene una web que
 * no quiere perder.» So this is a dialog in the editor and not a gate at the front door, and the
 * questionnaire behind it never changed.
 *
 * **It can only ever add a site. It cannot replace one.** David's adjustment of 4 October: if
 * there is an anonymous web in this browser and the account already has one, neither is
 * overwritten — this one is saved as a *new* site, and the dialog says how many were already
 * there. `sites.ts` has no upsert for the same reason; creating an account must never be an
 * operation that costs somebody a web they had.
 *
 * **Three honest sentences it will not drop**, because each is a thing the owner would otherwise
 * find out later:
 *
 * - which web is being saved, since the editor holds three variants and this saves the open one;
 * - that the photos stay in this browser (§5), so another computer shows the web without them;
 * - what is stored, who processes it and that deleting really deletes (§13 and §14).
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

type Stage =
  | { name: "form" }
  | { name: "working" }
  | { name: "saved" }
  | { name: "failed"; reason: Reason | "save" | "stale" };

export function SaveToAccountDialog({
  document: doc,
  configured,
  onSaved,
  onClose,
}: {
  document: RetorikaDocument;
  configured: boolean;
  /**
   * Fired only once a save has actually landed, so the indicator never claims it early — and it
   * carries the site's id and version, because the editor has to keep pushing later edits to it.
   * Handing back only "it worked" is what would leave the label true once and false afterwards.
   */
  onSaved: (site: { id: string; version: number }) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<Stage>({ name: "form" });
  /** How many sites the account already has — only known once somebody is signed in. */
  const [existing, setExisting] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  const close = useCallback(() => onClose(), [onClose]);
  const container = useFocusTrap(true, close);

  // Whether somebody is already signed in, asked once when the dialog opens. A person saving a
  // second web does not need to see a sign-up form.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void (async () => {
      const client = browserClient();
      const { data } = await client.auth.getUser();
      if (cancelled || !data.user) return;
      setSignedIn(true);
      setExisting((await listSites(client)).length);
    })();
    return () => {
      cancelled = true;
    };
  }, [configured]);

  async function save() {
    const client = browserClient();
    const { data } = await client.auth.getUser();
    const user = data.user;
    if (!user) return setStage({ name: "failed", reason: "unknown" });

    // Insert only. Never an upsert, never a replace — see the note above.
    const created = await createSite(client, {
      ownerId: user.id,
      name: renameOf(doc),
      document: doc,
    });
    if (created.ok) {
      setStage({ name: "saved" });
      onSaved({ id: created.id, version: created.version });
      return;
    }
    setStage({ name: "failed", reason: "save" });
  }

  async function createAccountAndSave(event: React.FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setStage({ name: "working" });
    const client = browserClient();

    const signedUp = await signUpWithPassword(client, email.trim(), password);
    if (!signedUp.ok) {
      // The likeliest mistake is somebody who already has an account typing the address they
      // already use. That is not a failure to report, it is the thing they meant.
      if (signedUp.reason === "already_registered") {
        const back = await signInWithPassword(client, email.trim(), password);
        if (!back.ok) return setStage({ name: "failed", reason: back.reason });
      } else {
        return setStage({ name: "failed", reason: signedUp.reason });
      }
    }
    await save();
  }

  async function google() {
    if (!configured) return;
    setStage({ name: "working" });
    const started = await startGoogleSignIn(
      browserClient(),
      `${window.location.origin}/auth/callback?next=/`,
    );
    if ("url" in started) window.location.assign(started.url);
    else setStage({ name: "failed", reason: started.reason });
  }

  const busy = stage.name === "working";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 60,
      }}
      // **No click-to-close on the backdrop.** It would be a mouse handler on a static element,
      // which is an accessibility lint error and, more to the point, the wrong behaviour here: a
      // stray click outside would throw away a half-typed password. Escape closes it, and so does
      // the «Cerrar» button at the bottom — keyboard and mouse both covered, neither by accident.
    >
      <div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-save-title"
        tabIndex={-1}
        style={{
          width: 520,
          maxWidth: "100%",
          maxHeight: "100%",
          overflowY: "auto",
          boxSizing: "border-box",
          padding: "28px 32px",
          background: "#FFFFFF",
          borderRadius: 18,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <h2 id="account-save-title" style={{ margin: 0, fontSize: 24, color: "#0F172A" }}>
          {es["account.save.title"]}
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: "#64748B" }}>{es["account.save.subtitle"]}</p>

        {/* Which web, because the editor holds three and this saves one. */}
        <p style={{ margin: 0, fontSize: 14, color: "#334155" }}>{es["account.save.whichOne"]}</p>

        {stage.name === "saved" ? (
          <p role="status" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0F766E" }}>
            {es["account.save.done"]}
          </p>
        ) : null}

        {existing !== null && existing > 0 && stage.name !== "saved" ? (
          <p style={{ margin: 0, fontSize: 14, color: "#334155" }}>
            {existing === 1
              ? es["account.save.alreadyHave.one"]
              : es["account.save.alreadyHave.many"].replace("{count}", String(existing))}
          </p>
        ) : null}

        {stage.name === "failed" ? (
          <FieldError>
            {stage.reason === "save"
              ? es["account.save.failed"]
              : stage.reason === "stale"
                ? es["account.save.stale"]
                : es[REASON_KEY[stage.reason]]}
          </FieldError>
        ) : null}

        {!configured ? (
          <FieldError>{es["auth.notConfigured"]}</FieldError>
        ) : stage.name === "saved" ? null : signedIn ? (
          <button
            type="button"
            onClick={() => {
              setStage({ name: "working" });
              void save();
            }}
            disabled={busy}
            style={primary}
          >
            {busy ? es["account.save.saving"] : es["account.save.asNew"]}
          </button>
        ) : (
          <>
            <form
              onSubmit={createAccountAndSave}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <TextField
                id="account-email"
                label={es["auth.email.label"]}
                labelHidden={false}
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <TextField
                id="account-password"
                label={es["auth.password.label"]}
                labelHidden={false}
                type="password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button type="submit" disabled={busy} style={primary}>
                {busy ? es["account.save.creating"] : es["account.save.create"]}
              </button>
            </form>
            <span style={{ textAlign: "center", fontSize: 13, color: "#64748B" }}>
              {es["account.save.or"]}
            </span>
            <button type="button" onClick={google} disabled={busy} style={secondary}>
              {es["account.save.google"]}
            </button>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
              {es["account.save.haveAccount"]}
            </p>
          </>
        )}

        {/* §5: the photos do not travel yet, and nobody is going to discover that on another
            computer. Shown whether or not the save has happened. */}
        <p style={{ margin: 0, fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>
          {es["account.save.photosStay"]}
        </p>

        {/* §13 and §14, and it ships this sprint by David's adjustment: what is stored, who
            processes it, where, and that deletion is real. */}
        <p style={{ margin: 0, fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
          {es["account.save.privacy"]}
        </p>

        <button type="button" onClick={close} style={secondary}>
          {es["account.save.close"]}
        </button>
      </div>
    </div>
  );
}

const primary = {
  height: 48,
  borderRadius: 10,
  border: "none",
  background: "#156FE7",
  color: "#FFFFFF",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
} as const;

const secondary = {
  ...primary,
  background: "#FFFFFF",
  color: "#1F2937",
  border: "1px solid #D4DCE7",
} as const;
