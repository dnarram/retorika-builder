import type { ErrorEvent } from "@sentry/nextjs";
import * as Sentry from "@sentry/nextjs";
import { initIfConfigured } from "./observability/init.ts";
import { VERSION_VAR } from "./observability/version.ts";

/**
 * The browser half, one line like the server's. See `instrumentation.ts`.
 *
 * `NEXT_PUBLIC_` variables are inlined at build time, which is why the DSN and the version carry
 * that prefix: a client file reads what the build wrote into it, not a process's environment.
 */
initIfConfigured<ErrorEvent>(Sentry, {
  env: {
    NEXT_PUBLIC_SENTRY_DSN: process.env["NEXT_PUBLIC_SENTRY_DSN"],
  },
  version: process.env[VERSION_VAR] ?? "unknown",
  environment: process.env["NODE_ENV"] ?? "development",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
