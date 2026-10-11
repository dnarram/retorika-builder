import type { ErrorEvent } from "@sentry/nextjs";
import * as Sentry from "@sentry/nextjs";
import { initIfConfigured } from "./observability/init.ts";
import { VERSION_VAR } from "./observability/version.ts";

/**
 * Next's server-side hook, and the one line it does.
 *
 * `register()` runs once when a server instance starts. The decision — start only with a DSN, and
 * always with the scrubber — lives in `observability/init.ts`, where the `editor` test project can
 * prove it without this file's dependency on the SDK. Here the SDK is handed in.
 *
 * `onRequestError` is how an error thrown by a route handler reaches a report. The routes' own
 * `catch` blocks are untouched: `/api/download` answers its `RequestError`s with an explicit 4xx
 * and re-throws anything else, and only that re-throw arrives here — which is exactly the line
 * between «an answer the route meant to give» and «a failure nobody wrote», and the second is what
 * protocol Part 17 wants to hear about.
 *
 * `environment` is Next's own notion of which build this is; the release is the commit, resolved
 * in `next.config.ts` and read back from the variable it set.
 */
export function register(): void {
  initIfConfigured<ErrorEvent>(Sentry, {
    env: process.env,
    version: process.env[VERSION_VAR] ?? "unknown",
    environment: process.env["NODE_ENV"] ?? "development",
  });
}

export const onRequestError = Sentry.captureRequestError;
