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
import { listOwnPhotoSrcs } from "../editor/ownPhotos.ts";
import es from "../locales/es.json" with { type: "json" };
import { FieldError, primaryButton, secondaryButton, TextField } from "../questionnaire/ui.tsx";
import { uploadSitePhotos } from "./photoStorage.ts";
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
 * - that the photographs travel with it (ADR 0037, amending §5), and how many did not make it when
 *   some did not — never a tick the save has not earned;
 * - what is stored, who processes it and that deleting really deletes (§13 and §14), **including
 *   the photographs**, which that notice did not mention until they started leaving the browser.
 */

/**
 * What the dialog says once the row is in. Four sentences rather than one, because «Guardada en tu
 * cuenta.» is only the whole truth when every photograph is up there too.
 *
 * A site with no photographs of its own — which is every generated site before the first upload,
 * since its one photograph is the bank's — gets the plain sentence. It would be strange to tell
 * somebody that nought of their photographs were stored.
 */
function savedSentence(photos: number, failed: number): string {
  if (failed > 0) {
    return failed === 1
      ? es["account.save.photosFailed.one"]
      : es["account.save.photosFailed.many"].replace("{count}", String(failed));
  }
  if (photos === 0) return es["account.save.done"];
  return photos === 1
    ? es["account.save.doneWithPhotos.one"]
    : es["account.save.doneWithPhotos.many"].replace("{count}", String(photos));
}

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
  /** The row exists and the bytes are on their way. Counted, because an owner watching a progress
   * line wants to know it is moving and how much is left. */
  | { name: "uploading"; done: number; total: number }
  /** `photosFailed` is how many of the owner's photographs the store refused. Zero is the ordinary
   * case and the only one that gets an unqualified «Guardada». */
  | { name: "saved"; photos: number; photosFailed: number }
  | { name: "failed"; reason: Reason | "save" | "stale" };

export function SaveToAccountDialog({
  document: doc,
  photoUrls,
  configured,
  onSaved,
  onClose,
}: {
  document: RetorikaDocument;
  /**
   * The open variant's object URLs, keyed by the `src` the document carries — the editor's own
   * `photoUrls` map for this card.
   *
   * **Handed in rather than read from storage**, because this is the same map the preview is
   * showing and the download already builds from: what the owner can see is what gets stored, and
   * there is no second source that could disagree with it. The bytes behind these URLs are
   * `preparePhoto`'s output, which a canvas produced and which therefore carries no EXIF and no
   * GPS (ADR 0018, and ADR 0037 §4 for why that now matters twice).
   */
  photoUrls: ReadonlyMap<string, string>;
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
    if (!created.ok) {
      setStage({ name: "failed", reason: "save" });
      return;
    }

    /**
     * The photographs, after the row and before `onSaved` (ADR 0037).
     *
     * **After the row** because the object's path contains the site's id, which does not exist
     * until the insert comes back. **Before `onSaved`** because that callback is what moves the
     * editor's indicator to «guardado en tu cuenta», and a site whose photographs are still in
     * flight is not that yet. A failed upload does not undo the save: the document is up there and
     * the bytes are still in this browser, so the honest report is «saved, and this many photographs
     * did not make it», which is what the owner can act on.
     *
     * Only the owner's own. A bank photograph is ours, immutable and already served by
     * `/api/muestras/[id]`; `listOwnPhotoSrcs` is what draws that line, out of the document's own
     * `sample` field rather than out of the shape of a file name.
     */
    const srcs = listOwnPhotoSrcs(doc);
    let report = { uploaded: [] as string[], failed: [] as string[] };
    if (srcs.length > 0) {
      setStage({ name: "uploading", done: 0, total: srcs.length });
      let done = 0;
      report = await uploadSitePhotos(
        client,
        { ownerId: user.id, siteId: created.id, srcs },
        async (src) => {
          const url = photoUrls.get(src);
          // No URL means this browser does not hold those bytes — a site it did not upload the
          // photograph in. `uploadSitePhotos` reports that as neither uploaded nor failed.
          if (!url) return undefined;
          try {
            const blob = await (await fetch(url)).blob();
            return new Uint8Array(await blob.arrayBuffer());
          } catch {
            // A revoked object URL. Nothing to upload and nothing to claim.
            return undefined;
          } finally {
            done += 1;
            setStage({ name: "uploading", done, total: srcs.length });
          }
        },
      );
    }

    setStage({
      name: "saved",
      photos: report.uploaded.length,
      photosFailed: report.failed.length,
    });
    onSaved({ id: created.id, version: created.version });
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
      /**
       * **Back to the editor, not to the landing, and not to the list.**
       *
       * Google's flow leaves the page, so whatever this says is where somebody lands holding a
       * half-finished website. `/` is the landing, which would drop them on a marketing page with
       * their own web nowhere in sight; they would have to press «Empezar» to get it back, and
       * «Empezar» reads like starting over. `/empezar` restores this browser's session and reopens
       * the editor on the web they were saving, which is the only destination that continues what
       * they were doing.
       */
      `${window.location.origin}/auth/callback?next=/empezar`,
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

        {stage.name === "uploading" ? (
          <p role="status" style={{ margin: 0, fontSize: 15, color: "#334155" }}>
            {es["account.save.uploadingPhotos"]
              .replace("{done}", String(stage.done))
              .replace("{total}", String(stage.total))}
          </p>
        ) : null}

        {stage.name === "saved" ? (
          <>
            <p
              role="status"
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                // Amber rather than green when something did not make it: the save worked and the
                // sentence beside it is not unqualified good news.
                color: stage.photosFailed > 0 ? "#92400E" : "#0F766E",
              }}
            >
              {savedSentence(stage.photos, stage.photosFailed)}
            </p>
            {/* The way back, from the moment there is something to come back to. */}
            <a href="/mis-webs" style={{ fontSize: 15, color: "#156FE7" }}>
              {es["account.save.doneOpen"]}
            </a>
          </>
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
            style={primaryButton}
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
              <button type="submit" disabled={busy} style={primaryButton}>
                {busy ? es["account.save.creating"] : es["account.save.create"]}
              </button>
            </form>
            <span style={{ textAlign: "center", fontSize: 13, color: "#64748B" }}>
              {es["account.save.or"]}
            </span>
            <button type="button" onClick={google} disabled={busy} style={secondaryButton}>
              {es["account.save.google"]}
            </button>
            <p style={{ margin: 0, fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
              {es["account.save.haveAccount"]}
            </p>
          </>
        )}

        {/* ADR 0037, amending §5: the photographs travel now, and this says so. It was amber
            because it was a warning; it is slate because it is an ordinary fact. */}
        <p style={{ margin: 0, fontSize: 13, color: "#334155", lineHeight: 1.5 }}>
          {es["account.save.photosStay"]}
        </p>

        {/* §13 and §14, and it ships this sprint by David's adjustment: what is stored, who
            processes it, where, and that deletion is real. */}
        <p style={{ margin: 0, fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
          {es["account.save.privacy"]}
        </p>

        <button type="button" onClick={close} style={secondaryButton}>
          {es["account.save.close"]}
        </button>
      </div>
    </div>
  );
}
