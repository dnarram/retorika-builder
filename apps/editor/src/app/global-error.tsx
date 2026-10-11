"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import es from "../locales/es.json" with { type: "json" };

/**
 * The page a person sees when the root layout itself has failed — and the moment that failure is
 * reported, when reporting is on.
 *
 * It replaces the whole document, so it carries its own `<html>` and `<body>`: there is no layout
 * left to put it in. One sentence in Spanish and a button that tries again, which is what Next's
 * `reset` does. Nothing else, because a page that only exists after everything else has broken
 * should not depend on anything that could have.
 *
 * `Sentry.captureException` is a no-op when the SDK was never initialised, which is the inert
 * state `observability/config.ts` describes — so this file does not ask whether reporting is on.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32, color: "#0F172A" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>{es["app.error.title"]}</h1>
        <p style={{ margin: "0 0 20px", maxWidth: 520, lineHeight: 1.5 }}>{es["app.error.body"]}</p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: 0,
            background: "#156FE7",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {es["app.error.retry"]}
        </button>
      </body>
    </html>
  );
}
