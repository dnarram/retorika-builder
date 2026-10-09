"use client";

import { EMPTY_ANSWERS } from "@retorika/generator";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserClient } from "../auth/clients.ts";
import es from "../locales/es.json" with { type: "json" };
import { Card, FieldError, Shell, TitleBlock } from "../questionnaire/ui.tsx";
import { Variants } from "../questionnaire/Variants.tsx";
import { type LoadedSite, loadSite } from "./sites.ts";

/**
 * Opening a web the account already has.
 *
 * The editor is `Variants`, the same component the questionnaire hands to — it already took
 * `initialDocuments`, so a site from the account enters through the door that was already there
 * rather than through a second editor. `generateVariants` is never called when documents are
 * given, which is why `EMPTY_ANSWERS` is safe here and not a lie: the five answers are
 * questionnaire input, and a saved site is long past that step.
 *
 * **`initialAccountSite` is what keeps this from costing somebody their work.** It tells `Variants`
 * that this browser is not where the site lives, so the single `localStorage` session slot is left
 * alone — otherwise opening a saved web would silently overwrite whatever anonymous one was in
 * this browser. It also carries the version the document was read at, so edits push back to the
 * right row and a stale write is refused rather than winning (ADR 0034 §8).
 */
export function OpenFromAccount({ id }: { id: string }) {
  const router = useRouter();
  /**
   * The site and who it belongs to, in one state rather than two.
   *
   * A photograph's object is `<owner>/<site>/<src>` (ADR 0037), so the editor needs both — and two
   * separate states would let a render exist with the site present and the owner still null, which
   * is a path with an empty first segment and a photograph that fails for no reason anybody could
   * read. One state makes that unrepresentable.
   */
  const [opened, setOpened] = useState<{ site: LoadedSite; ownerId: string } | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = browserClient();
      const { data } = await client.auth.getUser();
      if (!data.user) {
        router.replace("/entrar");
        return;
      }
      const found = await loadSite(client, id);
      // The owner travels with the site: this is the one place that has already asked who is
      // signed in, and asking twice would be a second round trip for an answer it holds.
      if (!cancelled) setOpened(found === null ? null : { site: found, ownerId: data.user.id });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (opened === undefined) {
    return (
      <Shell>
        <Card width={520}>
          <p role="status" style={{ margin: 0, fontSize: 15, color: "#64748B" }}>
            {es["myWebs.opening"]}
          </p>
        </Card>
      </Shell>
    );
  }

  if (opened === null) {
    // A row that is not there and a row that is not theirs are indistinguishable from here, and
    // the policies make them so deliberately. One sentence covers both, and it does not speculate.
    return (
      <Shell>
        <Card width={520}>
          <TitleBlock title={es["myWebs.title"]} subtitle={es["myWebs.subtitle"]} />
          <FieldError>{es["myWebs.notFound"]}</FieldError>
          <Link href="/mis-webs" style={{ fontSize: 15, color: "#156FE7" }}>
            {es["myWebs.back"]}
          </Link>
        </Card>
      </Shell>
    );
  }

  return (
    <Variants
      answers={EMPTY_ANSWERS}
      initialDocuments={[opened.site.document]}
      initialOpenIndex={0}
      initialAccountSite={{
        id: opened.site.id,
        version: opened.site.version,
        ownerId: opened.ownerId,
      }}
      // «Volver a empezar» from a saved web goes back to the list, not to question 1: the site is
      // in the account and starting a new one is a different act from discarding this one.
      onRestart={() => router.push("/mis-webs")}
    />
  );
}
