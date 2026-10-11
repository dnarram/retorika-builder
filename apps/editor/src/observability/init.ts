import { sentryDsn } from "./config.ts";
import { type ScrubbableEvent, scrubEvent } from "./scrub.ts";

/**
 * The one way the SDK is started, on either side, and the reason it takes the SDK as an argument.
 *
 * `instrumentation.ts` and `instrumentation-client.ts` are where Next looks for this, and both
 * import `@sentry/nextjs` — which drags a browser and a Node runtime into any test that imports
 * them. The decision they make is small and worth covering without either: **start only with a
 * DSN, and always with the scrubber.** So the decision is here, the SDK is handed in, and the two
 * Next files are one line each.
 *
 * A `{ init }` of the SDK's own shape rather than a boolean, so a test can hand in a spy and read
 * exactly what would have been sent to `init` — the DSN, the release, the scrubber — instead of a
 * flag that says «something happened».
 */

export interface SdkLike<Event extends ScrubbableEvent> {
  init(options: {
    dsn: string;
    release: string;
    environment: string;
    sendDefaultPii: false;
    beforeSend: (event: Event) => Event | null;
    tracesSampleRate: number;
  }): unknown;
}

export interface InitInput {
  readonly env: Record<string, string | undefined>;
  readonly version: string;
  readonly environment: string;
}

/**
 * Start the SDK if a DSN is present. Returns what it did, so a caller can log or assert on it.
 *
 * `sendDefaultPii: false` is written out although it is the SDK's default, because the privacy
 * notice is a promise and a default is not a promise. `tracesSampleRate: 0`: errors only. Tracing
 * would be a second category of data about what people do, and nobody has asked for it.
 */
export function initIfConfigured<Event extends ScrubbableEvent>(
  sdk: SdkLike<Event>,
  input: InitInput,
): "started" | "off" {
  const dsn = sentryDsn(input.env);
  if (!dsn) return "off";
  sdk.init({
    dsn,
    release: input.version,
    environment: input.environment,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    tracesSampleRate: 0,
  });
  return "started";
}
