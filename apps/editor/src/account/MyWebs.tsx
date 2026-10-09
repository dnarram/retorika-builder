"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { browserClient } from "../auth/clients.ts";
import { signOut } from "../auth/operations.ts";
import es from "../locales/es.json" with { type: "json" };
import { Card, compactButton, Shell, TitleBlock } from "../questionnaire/ui.tsx";
import { listSites, type SiteSummary } from "./sites.ts";

/**
 * «Tus webs guardadas» — the way back.
 *
 * **Guardadas, never «publicadas».** ADR 0008 is unambiguous: «The editor gets no
 * hosted-publishing entry point at all: no button, no API route, no flag.» A list on our domain
 * that said «tus webs publicadas» would imply we host them, which we do not and have no plan to.
 * The only delivery is the download.
 *
 * The list is short by construction — one account, a handful of webs — so it loads in one request
 * with no paging, and `listSites` asks for the newest first. What makes it safe is not this
 * component: the `sites_select_own` policy means the request can only ever come back with this
 * person's rows, whatever this file asks for.
 */
export function MyWebs() {
  const router = useRouter();
  const [sites, setSites] = useState<SiteSummary[] | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const client = browserClient();
      const { data } = await client.auth.getUser();
      if (!data.user) {
        // Not signed in. This screen has nothing to show and no business guessing.
        router.replace("/entrar");
        return;
      }
      const found = await listSites(client);
      if (cancelled) return;
      setEmail(data.user.email ?? null);
      setSites(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <Shell>
      <Card width={620}>
        <TitleBlock title={es["myWebs.title"]} subtitle={es["myWebs.subtitle"]} />

        {sites === null ? (
          <p role="status" style={{ margin: 0, fontSize: 15, color: "#64748B" }}>
            {es["myWebs.loading"]}
          </p>
        ) : sites.length === 0 ? (
          <>
            <p style={{ margin: 0, fontSize: 15, color: "#334155" }}>{es["myWebs.empty"]}</p>
            <Link href="/empezar" style={{ fontSize: 15, color: "#156FE7" }}>
              {es["myWebs.emptyStart"]}
            </Link>
          </>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {sites.map((site) => (
              <li
                key={site.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "14px 16px",
                  border: "1px solid #E3E8F0",
                  borderRadius: 12,
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong style={{ fontSize: 16 }}>{site.name}</strong>
                  <span style={{ fontSize: 13, color: "#64748B" }}>
                    {es["myWebs.updated"].replace(
                      "{date}",
                      new Date(site.updatedAt).toLocaleDateString("es-ES"),
                    )}
                  </span>
                </span>
                <Link
                  href={`/mis-webs/${site.id}`}
                  // `flexShrink: 0` so the row's long site name never squeezes «Abrir» into a
                  // column of letters, which is the other way a label leaves its box.
                  style={{
                    ...compactButton,
                    flexShrink: 0,
                    background: "#156FE7",
                    color: "#FFFFFF",
                    border: "none",
                    textDecoration: "none",
                  }}
                >
                  {es["myWebs.open"]}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* **The warning that stood here is gone, with ADR 0037.** It said the photographs had
            stayed in the browser where they were chosen, which was true for the whole of sprint 15
            and is what this screen existed to disclose on a second computer. They travel now, so
            there is nothing to disclose — and an amber paragraph that no longer applies is worse
            than no paragraph, because the next reader believes it. */}

        {email ? (
          <span style={{ fontSize: 13, color: "#64748B" }}>
            {es["myWebs.signedInAs"].replace("{email}", email)}
          </span>
        ) : null}

        <Link href="/cuenta" style={{ fontSize: 14, color: "#156FE7" }}>
          {es["account.page.link"]}
        </Link>

        <button
          type="button"
          onClick={async () => {
            await signOut(browserClient());
            router.replace("/");
          }}
          style={{ ...compactButton, alignSelf: "flex-start" }}
        >
          {es["auth.signOut"]}
        </button>
      </Card>
    </Shell>
  );
}
