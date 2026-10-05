import Link from "next/link";
import es from "@/locales/es.json" with { type: "json" };

/**
 * The landing. Minimal, which is what David asked for, and deliberately **inert**.
 *
 * **It reads nothing.** No session, no database, no `cookies()`, no `authConfigured()` — so Next
 * prerenders it at build time and a cold visit paints without waiting on anything but the server
 * itself. That is not tidiness: it is what makes David's adjustment 5 possible to evaluate at all.
 * A page that touched the session could not be moved to a Render static site, and a Render static
 * site is the only thing in this stack that does not sleep. `docs/tasks/arranque-en-frio.md` has
 * the evaluation and the measurement; this file's job is to not foreclose it.
 *
 * **«Empezar» goes to the questionnaire and asks for nothing**, because the account is created at
 * the end, when there is a web worth keeping (ADR 0034 §2). «Ya tengo cuenta» is for coming back,
 * and it is the second button rather than the first for the same reason.
 *
 * There is no mockup for this screen — `protocolo.md:971` makes the mockups the interface
 * specification and none was ever drawn for a landing — so ADR 0034 §20 makes the ADR and this
 * file the specification instead. The Spanish lives in `locales/es.json` like everything else.
 */
export const metadata = {
  title: es["landing.title"],
  description: es["landing.lede"],
};

export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        background: "#F5F7FA",
        color: "#0F172A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 48,
        padding: "72px 24px 64px",
      }}
    >
      <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 44,
            lineHeight: 1.1,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            textAlign: "center",
          }}
        >
          {es["landing.title"]}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 19,
            lineHeight: 1.5,
            color: "#475569",
            textAlign: "center",
          }}
        >
          {es["landing.lede"]}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
          }}
        >
          <Link
            href="/empezar"
            /**
             * `minHeight` and real padding, like every other button in the application — see
             * `primaryButton` in `questionnaire/ui.tsx`. Not that style itself, because this one
             * is sized to its own text rather than stretched across a card, and it is the one
             * button on a page that has no card.
             */
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              minHeight: 56,
              padding: "14px 40px",
              borderRadius: 12,
              background: "#156FE7",
              color: "#FFFFFF",
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.25,
              textDecoration: "none",
            }}
          >
            {es["landing.start"]}
          </Link>
          <span style={{ fontSize: 14, color: "#64748B", textAlign: "center" }}>
            {es["landing.startHint"]}
          </span>
          <Link href="/entrar" style={{ fontSize: 15, color: "#156FE7", marginTop: 8 }}>
            {es["landing.enter"]}
          </Link>
        </div>
      </div>

      <section style={{ maxWidth: 680, width: "100%" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 700 }}>
          {es["landing.how.title"]}
        </h2>
        <ol
          style={{
            margin: 0,
            paddingLeft: 24,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            fontSize: 16,
            lineHeight: 1.5,
            color: "#334155",
          }}
        >
          <li>{es["landing.how.one"]}</li>
          <li>{es["landing.how.two"]}</li>
          <li>{es["landing.how.three"]}</li>
          <li>{es["landing.how.four"]}</li>
        </ol>
      </section>

      {/* The download promise, which is ADR 0001 said in the owner's own terms rather than ours.
          It belongs on the landing because it is the thing that makes Retorika different from the
          products this one is competing with, and because it is true. */}
      <section style={{ maxWidth: 680, width: "100%" }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>
          {es["landing.yours.title"]}
        </h2>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#334155" }}>
          {es["landing.yours.body"]}
        </p>
      </section>
    </main>
  );
}
