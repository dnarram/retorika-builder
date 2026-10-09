"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { browserClient } from "../auth/clients.ts";
import es from "../locales/es.json" with { type: "json" };
import {
  Card,
  dangerButton,
  FieldError,
  Shell,
  secondaryButton,
  TitleBlock,
} from "../questionnaire/ui.tsx";
import {
  accountState,
  cancelAccountDeletion,
  exportSites,
  listSites,
  requestAccountDeletion,
} from "./sites.ts";
import { useFocusTrap } from "./useFocusTrap.ts";

/**
 * «Tu cuenta» — the copy you take with you, and the way out.
 *
 * **The export comes first on the screen and not by accident.** Protocol Part 16: «La exportación
 * siempre funciona, incluso con la cuenta caducada o en disputa», and «Si alguna vez una decisión
 * técnica choca con una de estas tres, gana la regla.» A deletion path with no export in front of
 * it would be that collision, so the copy is offered above the delete and again inside its
 * confirmation.
 *
 * The grace window is 30 days (ADR 0034 §12), the number read from `@retorika/db` rather than
 * retyped here, so the sentence an owner reads and the interval the sweep uses cannot drift.
 */

/** ADR 0034 §12. Imported as a value would pull a server-only module into the browser bundle, which
 * `scripts/secrets-scope.ts` would refuse — so it is restated and the test below pins the two
 * together. */
const GRACE_WINDOW_DAYS = 30;

export function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [siteCount, setSiteCount] = useState(0);
  const [pendingSince, setPendingSince] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [problem, setProblem] = useState<"export" | "delete" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = browserClient();
      const { data } = await client.auth.getUser();
      if (!data.user) {
        router.replace("/entrar");
        return;
      }
      const [sites, state] = await Promise.all([
        listSites(client),
        accountState(client, data.user.id),
      ]);
      if (cancelled) return;
      setEmail(data.user.email ?? null);
      setUserId(data.user.id);
      setSiteCount(sites.length);
      setPendingSince(state.deletionRequestedAt);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function exportEverything() {
    setExporting(true);
    setProblem(null);
    const payload = await exportSites(browserClient());
    setExporting(false);
    if (payload.sites.length === 0 && siteCount > 0) {
      setProblem("export");
      return;
    }
    // A Blob and an object URL, the same way `/api/download` hands over a ZIP. This is the editor
    // application, not a published site, so there is no ADR 0001 question here.
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "retorika-mis-webs.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  const deletesOn = pendingSince
    ? new Date(
        new Date(pendingSince).getTime() + GRACE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      ).toLocaleDateString("es-ES")
    : null;

  return (
    <Shell>
      <Card width={620}>
        <TitleBlock title={es["account.page.title"]} subtitle={es["account.page.subtitle"]} />

        {email ? (
          <span style={{ fontSize: 14, color: "#64748B" }}>
            {es["account.page.email"].replace("{email}", email)}
          </span>
        ) : null}

        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{es["account.export.title"]}</h2>
          <p style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
            {es["account.export.body"]}
          </p>
          <button
            type="button"
            onClick={exportEverything}
            disabled={exporting}
            style={secondaryButton}
          >
            {exporting ? es["account.export.working"] : es["account.export.button"]}
          </button>
          {problem === "export" ? <FieldError>{es["account.export.failed"]}</FieldError> : null}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{es["account.delete.title"]}</h2>

          {pendingSince && deletesOn ? (
            <>
              <p role="status" style={{ margin: 0, fontSize: 14, color: "#92400E" }}>
                {es["account.delete.pending"].replace("{date}", deletesOn)}
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (!userId) return;
                  const ok = await cancelAccountDeletion(browserClient(), userId);
                  if (ok) setPendingSince(null);
                  else setProblem("delete");
                }}
                style={secondaryButton}
              >
                {es["account.delete.undo"]}
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
                {es["account.delete.body"].replace("{days}", String(GRACE_WINDOW_DAYS))}
              </p>
              <button type="button" onClick={() => setConfirming(true)} style={dangerButton}>
                {es["account.delete.button"]}
              </button>
            </>
          )}

          {/* What goes and what stays, in that order, since ADR 0037 gave the first half a second
              item. The photographs leave with the account — they are files in a bucket and the
              sweep removes them — and saying so beside «borrar mi cuenta» is the difference between
              a person deciding and a person finding out. The second sentence is the one this
              product can say because of ADR 0001: what they already downloaded is theirs. */}
          <p style={{ margin: 0, fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
            {es["account.delete.whatGoes"]}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B", lineHeight: 1.5 }}>
            {es["account.delete.whatStays"]}
          </p>
          {problem === "delete" ? <FieldError>{es["account.delete.failed"]}</FieldError> : null}
        </section>

        <Link href="/mis-webs" style={{ fontSize: 14, color: "#156FE7" }}>
          {es["myWebs.back"]}
        </Link>
      </Card>

      {confirming && userId ? (
        <ConfirmDeletion
          siteCount={siteCount}
          onExport={exportEverything}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            const result = await requestAccountDeletion(browserClient(), userId);
            setConfirming(false);
            // `result.ok`, never `if (result)`: the function used to return a boolean and now
            // returns a result object, and an object is always truthy — so the obvious shape of
            // this line would have reported success unconditionally, which is a worse version of
            // the bug being fixed. The date comes from `requestedAt`, which is what the database
            // actually stored, not from this browser's clock at the moment of the click.
            if (result.ok) setPendingSince(result.requestedAt);
            else setProblem("delete");
          }}
        />
      ) : null}
    </Shell>
  );
}

/**
 * The confirmation, and the second use of `useFocusTrap` — which is what makes it an abstraction
 * rather than a hook written for one caller.
 *
 * Focus moves in, Tab cycles, Escape closes, focus returns. **The default focus is the cancel
 * button and not the confirm**: a dialog that destroys something should not have its destructive
 * action under a stray Return key.
 */
function ConfirmDeletion({
  siteCount,
  onExport,
  onConfirm,
  onClose,
}: {
  siteCount: number;
  onExport: () => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const close = useCallback(() => onClose(), [onClose]);
  const container = useFocusTrap(true, close);

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
    >
      <div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        tabIndex={-1}
        style={{
          width: 500,
          maxWidth: "100%",
          boxSizing: "border-box",
          padding: "26px 30px",
          background: "#FFFFFF",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h2 id="confirm-delete-title" style={{ margin: 0, fontSize: 21 }}>
          {es["account.delete.confirmTitle"]}
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: "#334155", lineHeight: 1.5 }}>
          {es["account.delete.confirmBody"]
            .replace("{count}", String(siteCount))
            .replace("{days}", String(GRACE_WINDOW_DAYS))}
        </p>

        {/* Offered again here, because this is the last moment it is useful. */}
        <p style={{ margin: 0, fontSize: 14, color: "#92400E" }}>
          {es["account.delete.confirmExport"]}
        </p>
        <button type="button" onClick={onExport} style={secondaryButton}>
          {es["account.export.button"]}
        </button>

        {/* Cancel first in the DOM, so it is what the trap focuses and what Return reaches. */}
        <button type="button" onClick={onClose} style={secondaryButton}>
          {es["account.delete.cancel"]}
        </button>
        <button type="button" onClick={onConfirm} style={dangerButton}>
          {es["account.delete.confirm"]}
        </button>
      </div>
    </div>
  );
}
