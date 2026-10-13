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

/**
 * Every category of automatic collection the SDK offers that could carry a person, switched off by
 * name. `dataCollection` is the option that governs SDK 11; `sendDefaultPii` was removed in that
 * major and this file carried it until 13 October 2026, when activation was approved and the
 * installed types were read: a dead option that TypeScript never flagged, because a method's
 * parameter is checked bivariantly and an object type gets no excess-property check there.
 *
 * What each `false` buys, read off `@sentry/browser`'s client and `@sentry/core`'s resolver:
 *
 * - `userInfo: false` — no `user.ip_address: "{{auto}}"` on events **or on sessions** (sessions
 *   never pass through `beforeSend`, so the scrubber alone could not have kept the IP out), and
 *   the SDK tells Sentry's ingest `infer_ip: "never"`, so the server does not read it off the
 *   connection either.
 * - `httpHeaders: false` — the browser SDK stops putting `User-Agent` and `Referer` into the
 *   event's request; `cookies: false`, `httpBodies: []`, `urlQueryParams: false` — nothing of a
 *   request's contents travels; `stackFrameVariables: false` — a local variable holding the
 *   document is not serialised into a stack frame «to help».
 *
 * The scrubber stays as belt and braces, and the Sentry project's own «Prevent Storing of IP
 * Addresses» setting is the third layer (`docs/runbook.md` §8). What the notice promises is what
 * the three together guarantee, which is David's rule for it.
 */
export interface DataCollectionOff {
  readonly userInfo: false;
  readonly cookies: false;
  readonly httpHeaders: false;
  readonly httpBodies: never[];
  readonly urlQueryParams: false;
  readonly stackFrameVariables: false;
}

export const DATA_COLLECTION_OFF: DataCollectionOff = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
};

export interface SdkLike<Event extends ScrubbableEvent> {
  init(options: {
    dsn: string;
    release: string;
    environment: string;
    dataCollection: DataCollectionOff;
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
 * `dataCollection` is written out category by category although the SDK has defaults, because
 * the privacy notice is a promise and a default is not a promise — and the defaults are the wrong
 * way round for that promise: every one of them is `true`. `tracesSampleRate: 0`: errors only.
 * Tracing would be a second category of data about what people do, and nobody has asked for it.
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
    dataCollection: DATA_COLLECTION_OFF,
    beforeSend: scrubEvent,
    tracesSampleRate: 0,
  });
  return "started";
}
